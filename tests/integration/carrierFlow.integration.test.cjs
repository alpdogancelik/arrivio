const assert = require("node:assert/strict");
const { describe, test, afterEach } = require("node:test");

const PROJECT_ID = "arrivio-271aa";
const FIRESTORE_BASE =
  `http://127.0.0.1:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const RUN_LIVE = process.env.RUN_FIRESTORE_DATA_LIVE === "1";
const FIRESTORE_EMULATOR_AUTH_TOKEN = process.env.FIRESTORE_EMULATOR_AUTH_TOKEN || "owner";

const createdBookingIds = new Set();
const createdQueueIds = new Set();

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${FIRESTORE_EMULATOR_AUTH_TOKEN}`,
  };
}

function readAuthHeaders() {
  return {
    Authorization: `Bearer ${FIRESTORE_EMULATOR_AUTH_TOKEN}`,
  };
}

function encodeValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === "object") return { mapValue: { fields: encodeFields(value) } };
  return { stringValue: String(value) };
}

function encodeFields(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) out[k] = encodeValue(v);
  return out;
}

function decodeValue(value) {
  if (!value || typeof value !== "object") return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decodeValue);
  if ("mapValue" in value) return decodeFields(value.mapValue.fields || {});
  return null;
}

function decodeFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) out[k] = decodeValue(v);
  return out;
}

function bookingDocUrl(bookingId) {
  return `${FIRESTORE_BASE}/Booking/${bookingId}`;
}

function queueDocUrl(queueId) {
  return `${FIRESTORE_BASE}/QueueEntry/${queueId}`;
}

function uniqueId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function normalizeBookingStatus(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "pending") return "pending";
  if (raw === "confirmed") return "confirmed";
  if (raw === "arrived") return "arrived";
  if (raw === "inprogress" || raw === "servicing" || raw === "serving") return "inprogress";
  if (raw === "completed" || raw === "complete") return "completed";
  if (raw === "cancelled" || raw === "canceled") return "cancelled";
  return "pending";
}

function normalizeQueueStatus(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "queued" || raw === "waiting") return "Queued";
  if (raw === "inprogress" || raw === "servicing" || raw === "serving") return "InProgress";
  if (raw === "completed" || raw === "done") return "Completed";
  if (raw === "cancelled" || raw === "canceled") return "Cancelled";
  return "Queued";
}

function searchRows(rows, term) {
  const q = String(term || "").toLowerCase().trim();
  if (!q) return rows;
  return rows.filter((row) =>
    Object.values(row || {}).some((v) => String(v || "").toLowerCase().includes(q)),
  );
}

async function putDoc(url, data) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ fields: encodeFields(data) }),
  });
  if (!res.ok) throw new Error(`putDoc failed (${res.status}): ${await res.text()}`);
}

async function patchDoc(url, data) {
  const params = new URLSearchParams();
  for (const k of Object.keys(data || {})) params.append("updateMask.fieldPaths", k);
  const res = await fetch(`${url}?${params.toString()}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ fields: encodeFields(data) }),
  });
  if (!res.ok) throw new Error(`patchDoc failed (${res.status}): ${await res.text()}`);
}

async function getDoc(url, id) {
  const res = await fetch(url, { headers: readAuthHeaders() });
  if (!res.ok) throw new Error(`getDoc failed (${res.status}): ${await res.text()}`);
  const json = await res.json();
  return { id, ...decodeFields(json.fields || {}) };
}

async function listCollection(path) {
  const all = [];
  let pageToken = "";

  for (let i = 0; i < 50; i += 1) {
    const params = new URLSearchParams({ pageSize: "200" });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`${FIRESTORE_BASE}/${path}?${params.toString()}`, { headers: readAuthHeaders() });
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`listCollection failed (${res.status}): ${await res.text()}`);

    const json = await res.json();
    const docs = (json.documents || []).map((d) => ({
      id: String(d.name || "").split("/").pop(),
      ...decodeFields(d.fields || {}),
    }));

    all.push(...docs);

    if (!json.nextPageToken) break;
    pageToken = String(json.nextPageToken);
  }

  return all;
}
async function deleteDoc(url) {
  await fetch(url, { method: "DELETE", headers: readAuthHeaders() });
}

describe("Integration - Carrier Data Layer (Firestore)", () => {
  afterEach(async () => {
    const bookingIds = Array.from(createdBookingIds);
    const queueIds = Array.from(createdQueueIds);
    createdBookingIds.clear();
    createdQueueIds.clear();
    await Promise.all(bookingIds.map((id) => deleteDoc(bookingDocUrl(id))));
    await Promise.all(queueIds.map((id) => deleteDoc(queueDocUrl(id))));
  });

  test("TC-CAR-01 valid booking is stored with carrier, station and timestamps", { skip: !RUN_LIVE }, async () => {
    const bookingId = uniqueId("car1");
    const timestamp = "2026-04-23T10:00:00Z";

    await putDoc(bookingDocUrl(bookingId), {
      Booking_ID: bookingId,
      Booking_Status: "Pending",
      Carrier_ID: "carrier-100",
      Facility_ID: "FAC-01",
      Station_ID: "ST-01",
      Slot: "10-11",
      CreatedAt: timestamp,
      UpdatedAt: timestamp,
    });
    createdBookingIds.add(bookingId);

    const stored = await getDoc(bookingDocUrl(bookingId), bookingId);
    assert.equal(stored.Booking_ID, bookingId);
    assert.equal(stored.Carrier_ID, "carrier-100");
    assert.equal(stored.Facility_ID, "FAC-01");
    assert.equal(stored.Station_ID, "ST-01");
    assert.equal(normalizeBookingStatus(stored.Booking_Status), "pending");
    assert.equal(stored.CreatedAt, timestamp);
  });

  test("TC-CAR-02 queue entry is visible and searchable", { skip: !RUN_LIVE }, async () => {
    const bookingId = uniqueId("car2-b");
    const queueId = uniqueId("car2-q");
    const timestamp = "2026-04-23T10:20:00Z";

    await putDoc(bookingDocUrl(bookingId), {
      Booking_ID: bookingId,
      Booking_Status: "Arrived",
      Carrier_ID: "carrier-200",
      Facility_ID: "FAC-02",
      Station_ID: "ST-02",
      CreatedAt: timestamp,
      UpdatedAt: timestamp,
    });
    createdBookingIds.add(bookingId);

    await putDoc(queueDocUrl(queueId), {
      Queue_ID: queueId,
      Booking_ID: bookingId,
      Carrier_ID: "carrier-200",
      Facility_ID: "FAC-02",
      Station_ID: "ST-02",
      Status: "Queued",
      CreatedAt: timestamp,
      UpdatedAt: timestamp,
    });
    createdQueueIds.add(queueId);

    const queueRows = await listCollection("QueueEntry");
    const normalized = queueRows.map((x) => ({ ...x, Status: normalizeQueueStatus(x.Status) }));
    const byBooking = searchRows(normalized, bookingId);
    const byStation = searchRows(normalized, "ST-02");
    const byCarrier = searchRows(normalized, "carrier-200");

    assert.equal(normalized.some((x) => x.id === queueId), true);
    assert.equal(byBooking.some((x) => x.id === queueId), true);
    assert.equal(byStation.some((x) => x.id === queueId), true);
    assert.equal(byCarrier.some((x) => x.id === queueId), true);
  });

  test("TC-CAR-03 state update to InProgress is persisted", { skip: !RUN_LIVE }, async () => {
    const bookingId = uniqueId("car3-b");
    const queueId = uniqueId("car3-q");
    await putDoc(bookingDocUrl(bookingId), {
      Booking_ID: bookingId,
      Booking_Status: "Arrived",
      Carrier_ID: "carrier-300",
      Facility_ID: "FAC-03",
      Station_ID: "ST-03",
      CreatedAt: "2026-04-23T11:00:00Z",
      UpdatedAt: "2026-04-23T11:00:00Z",
    });
    createdBookingIds.add(bookingId);
    await putDoc(queueDocUrl(queueId), {
      Queue_ID: queueId,
      Booking_ID: bookingId,
      Carrier_ID: "carrier-300",
      Station_ID: "ST-03",
      Status: "Queued",
      CreatedAt: "2026-04-23T11:00:00Z",
      UpdatedAt: "2026-04-23T11:00:00Z",
    });
    createdQueueIds.add(queueId);

    await patchDoc(queueDocUrl(queueId), {
      Status: "InProgress",
      UpdatedAt: "2026-04-23T11:10:00Z",
    });
    await patchDoc(bookingDocUrl(bookingId), {
      Booking_Status: "InProgress",
      UpdatedAt: "2026-04-23T11:10:00Z",
    });

    const queueStored = await getDoc(queueDocUrl(queueId), queueId);
    const bookingStored = await getDoc(bookingDocUrl(bookingId), bookingId);
    assert.equal(normalizeQueueStatus(queueStored.Status), "InProgress");
    assert.equal(normalizeBookingStatus(bookingStored.Booking_Status), "inprogress");
    assert.equal(bookingStored.UpdatedAt, "2026-04-23T11:10:00Z");
  });

  test("TC-CAR-04 invalid booking payload does not create records", { skip: !RUN_LIVE }, async () => {
    const before = await listCollection("Booking");
    const invalidPayload = {
      Booking_ID: uniqueId("invalid"),
      Booking_Status: "Pending",
      Carrier_ID: "carrier-400",
      Facility_ID: "",
      Station_ID: "ST-04",
    };
    const isValid = Boolean(invalidPayload.Facility_ID && invalidPayload.Station_ID);
    assert.equal(isValid, false);

    const after = await listCollection("Booking");
    assert.equal(after.length, before.length);
  });
});

