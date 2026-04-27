const path = require("node:path");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { describe, test } = require("node:test");
const Ajv = require("ajv");

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "arrivio-271aa";
const ENV_REGION = process.env.FIREBASE_FUNCTIONS_REGION || "europe-west3";
const EXPLICIT_BASE_URL = process.env.QUEUE_FUNCTIONS_BASE_URL || "";
const RUN_LIVE = process.env.RUN_QUEUE_CONTRACT_LIVE === "1";

let resolvedBaseUrl = null;

function buildBaseUrl(region) {
  return `http://127.0.0.1:5001/${PROJECT_ID}/${region}`;
}

async function functionExistsAt(baseUrl, functionName) {
  try {
    const res = await fetch(`${baseUrl}/${functionName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    return res.status !== 404;
  } catch {
    return false;
  }
}

async function resolveBaseUrl() {
  if (resolvedBaseUrl) return resolvedBaseUrl;

  if (EXPLICIT_BASE_URL) {
    resolvedBaseUrl = EXPLICIT_BASE_URL.replace(/\/+$/, "");
    return resolvedBaseUrl;
  }

  const candidates = [
    buildBaseUrl(ENV_REGION),
    buildBaseUrl("europe-west3"),
    buildBaseUrl("us-central1"),
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  for (const base of candidates) {
    if (await functionExistsAt(base, "enterQueue")) {
      resolvedBaseUrl = base;
      return resolvedBaseUrl;
    }
  }

  throw new Error(
    [
      "Queue functions endpoint not found (enterQueue returned 404 on all candidates).",
      "Start backend emulator that contains queue HTTP functions or set QUEUE_FUNCTIONS_BASE_URL.",
      `Tried: ${candidates.join(", ")}`,
    ].join(" "),
  );
}

const SCHEMA_DIR = path.resolve(process.cwd(), "contracts", "queue");

const ajv = new Ajv({ allErrors: true, strict: false });

function readJson(filename) {
  const fullPath = path.join(SCHEMA_DIR, filename);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

const schemaEnterQueueRequest = readJson("enterQueue.request.json");
const schemaEnterQueueResponse = readJson("enterQueue.response.json");
const schemaGetStationQueueResponse = readJson("getStationQueue.response.json");

const validateEnterQueueRequest = ajv.compile(schemaEnterQueueRequest);
const validateEnterQueueResponse = ajv.compile(schemaEnterQueueResponse);
const validateGetStationQueueResponse = ajv.compile(schemaGetStationQueueResponse);

function assertSchema(validate, data, label) {
  const ok = validate(data);
  if (!ok) {
    const message = `${label} schema validation failed: ${ajv.errorsText(validate.errors, {
      separator: " | ",
    })}`;
    assert.fail(message);
  }
}

async function post(functionName, body) {
  const baseUrl = await resolveBaseUrl();
  const res = await fetch(`${baseUrl}/${functionName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  return { status: res.status, data };
}

async function createQueueEntry({
  carrierId,
  stationId = "ST-1",
  slotStart = "2026-04-21T10:00:00Z",
  slotEnd = "2026-04-21T10:15:00Z",
}) {
  const requestBody = { carrierId, stationId, slotStart, slotEnd };
  assertSchema(validateEnterQueueRequest, requestBody, "enterQueue.request");
  const enter = await post("enterQueue", requestBody);
  assert.equal(
    enter.status,
    200,
    `enterQueue expected 200, got ${enter.status}. Response: ${JSON.stringify(enter.data)}`,
  );
  assertSchema(validateEnterQueueResponse, enter.data, "enterQueue.response");
  return enter.data.queueEntryId;
}

function toIso(minutesFromBase) {
  const base = Date.parse("2026-04-21T14:00:00Z");
  return new Date(base + minutesFromBase * 60_000).toISOString();
}
function uniqueStation(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}


describe("Contracts - Queue Schema Validation", () => {
  test("enterQueue.request accepts valid payload", () => {
    const payload = {
      carrierId: "C-100",
      stationId: "ST-1",
      slotStart: "2026-04-21T10:00:00Z",
      slotEnd: "2026-04-21T10:15:00Z",
    };
    assertSchema(validateEnterQueueRequest, payload, "enterQueue.request");
  });

  test("enterQueue.request rejects missing required fields", () => {
    const payload = {
      carrierId: "C-100",
      stationId: "ST-1",
      slotStart: "2026-04-21T10:00:00Z",
    };
    const ok = validateEnterQueueRequest(payload);
    assert.equal(ok, false);
  });
});

describe("Integration - Queue Flow (Contract-Validated)", () => {
  test(
    "TC-IT-01 Carrier -> Backend -> Operator | queue entry is created and listed with correct order",
    { skip: !RUN_LIVE },
    async () => {
      const stationId = uniqueStation("ST-TC1");
      const q1 = await createQueueEntry({
        carrierId: "C-100",
        stationId,
        slotStart: "2026-04-21T10:00:00Z",
        slotEnd: "2026-04-21T10:15:00Z",
      });
      const q2 = await createQueueEntry({
        carrierId: "C-101",
        stationId,
        slotStart: "2026-04-21T10:15:00Z",
        slotEnd: "2026-04-21T10:30:00Z",
      });

      const queue = await post("getStationQueue", { stationId, limit: 50 });
      assert.equal(queue.status, 200);
      assertSchema(
        validateGetStationQueueResponse,
        queue.data,
        "getStationQueue.response",
      );
      assert.equal(queue.data.stationId, stationId);

      const e1 = queue.data.queue.find((x) => x.id === q1);
      const e2 = queue.data.queue.find((x) => x.id === q2);
      assert.ok(e1);
      assert.ok(e2);
      assert.equal(e1.queueStatus, "Queued");
      assert.equal(e2.queueStatus, "Queued");
      assert.equal(typeof e1.slotKey, "string");
      assert.ok(e1.slotKey.length > 0);

      const i1 = queue.data.queue.findIndex((x) => x.id === q1);
      const i2 = queue.data.queue.findIndex((x) => x.id === q2);
      assert.ok(i1 < i2);
    },
  );

  test(
    "TC-IT-02 Operator -> Backend -> Carrier | start and complete service updates active queue",
    { skip: !RUN_LIVE },
    async () => {
      const stationId = uniqueStation("ST-TC2");
      const startCandidate = await createQueueEntry({
        carrierId: "C-200",
        stationId,
        slotStart: "2026-04-21T11:00:00Z",
        slotEnd: "2026-04-21T11:15:00Z",
      });

      const start = await post("startService", {
        queueEntryId: startCandidate,
        operatorId: "OP-1",
      });
      assert.equal(start.status, 200);

      const complete = await post("completeService", {
        queueEntryId: startCandidate,
        operatorId: "OP-1",
      });
      assert.equal(complete.status, 200);

      const queue = await post("getStationQueue", { stationId, limit: 50 });
      assert.equal(queue.status, 200);
      assertSchema(
        validateGetStationQueueResponse,
        queue.data,
        "getStationQueue.response",
      );
      assert.equal(
        queue.data.queue.some((x) => x.id === startCandidate),
        false,
      );
    },
  );

  test(
    "TC-IT-03 Operator -> Backend -> Carrier | no-show removes queued entry from active list",
    { skip: !RUN_LIVE },
    async () => {
      const stationId = uniqueStation("ST-TC3");
      const noShowCandidate = await createQueueEntry({
        carrierId: "C-300",
        stationId,
        slotStart: "2026-04-21T12:00:00Z",
        slotEnd: "2026-04-21T12:15:00Z",
      });

      const noShow = await post("cancelQueueEntry", {
        queueEntryId: noShowCandidate,
        operatorId: "OP-2",
        reason: "NoShow",
      });
      assert.equal(noShow.status, 200);

      const queue = await post("getStationQueue", { stationId, limit: 50 });
      assert.equal(queue.status, 200);
      assertSchema(
        validateGetStationQueueResponse,
        queue.data,
        "getStationQueue.response",
      );
      assert.equal(
        queue.data.queue.some((x) => x.id === noShowCandidate),
        false,
      );
    },
  );

  test(
    "TC-IT-04 Invalid state transitions are prevented",
    { skip: !RUN_LIVE },
    async () => {
      const stationId = uniqueStation("ST-TC4");
      const otherStationId = uniqueStation("ST-TC5");
      const inProgressCandidate = await createQueueEntry({
        carrierId: "C-400",
        stationId,
        slotStart: "2026-04-21T13:00:00Z",
        slotEnd: "2026-04-21T13:15:00Z",
      });
      const blockedStartCandidate = await createQueueEntry({
        carrierId: "C-401",
        stationId,
        slotStart: "2026-04-21T13:15:00Z",
        slotEnd: "2026-04-21T13:30:00Z",
      });
      const invalidCompleteCandidate = await createQueueEntry({
        carrierId: "C-402",
        stationId: otherStationId,
        slotStart: "2026-04-21T13:00:00Z",
        slotEnd: "2026-04-21T13:15:00Z",
      });

      const start = await post("startService", {
        queueEntryId: inProgressCandidate,
        operatorId: "OP-3",
      });
      assert.equal(start.status, 200);

      const doubleStart = await post("startService", {
        queueEntryId: blockedStartCandidate,
        operatorId: "OP-3",
      });
      assert.equal(doubleStart.status, 409);
      assert.equal(doubleStart.data.code, "ALREADY_IN_PROGRESS");

      const invalidComplete = await post("completeService", {
        queueEntryId: invalidCompleteCandidate,
        operatorId: "OP-3",
      });
      assert.equal(invalidComplete.status, 409);
      assert.equal(invalidComplete.data.code, "NOT_IN_PROGRESS");
    },
  );

  test(
    "TC-IT-05 Carrier -> Backend -> Operator | multiple carriers are queued and listed in order",
    { skip: !RUN_LIVE },
    async () => {
      const stationId = uniqueStation("ST-TC6");
      const carrierCount = 12;
      const queueEntryIds = [];

      for (let i = 0; i < carrierCount; i += 1) {
        const slotStart = toIso(i * 15);
        const slotEnd = toIso((i + 1) * 15);
        const queueEntryId = await createQueueEntry({
          carrierId: `C-5${String(i).padStart(2, "0")}`,
          stationId,
          slotStart,
          slotEnd,
        });
        queueEntryIds.push(queueEntryId);
      }

      const queue = await post("getStationQueue", { stationId, limit: 200 });
      assert.equal(queue.status, 200);
      assertSchema(
        validateGetStationQueueResponse,
        queue.data,
        "getStationQueue.response",
      );
      assert.ok(queue.data.queue.length >= carrierCount);

      for (const id of queueEntryIds) {
        const entry = queue.data.queue.find((x) => x.id === id);
        assert.ok(entry);
        assert.equal(entry.queueStatus, "Queued");
      }

      for (let i = 1; i < queueEntryIds.length; i += 1) {
        const prev = queue.data.queue.findIndex((x) => x.id === queueEntryIds[i - 1]);
        const next = queue.data.queue.findIndex((x) => x.id === queueEntryIds[i]);
        assert.ok(prev < next);
      }
    },
  );
});
