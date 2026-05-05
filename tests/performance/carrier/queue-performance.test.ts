import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { performance } from 'node:perf_hooks';

/**
 * Carrier queue performance tests.
 *
 * These tests measure whether carrier queue entries can be fetched, filtered,
 * normalized, and converted into app-level queue objects within the response
 * time threshold defined in the Test Plan.
 *
 * Firebase and Firestore are mocked. The purpose is not to test Firebase
 * performance, but to test the carrier-side queue processing logic under
 * larger and repeated queue datasets.
 */

const mockDb = { app: 'performance-test-db' };

const mockAuth: { currentUser: { uid: string } | null } = {
  currentUser: { uid: 'carrier-1' },
};

type QueueEntryRow = {
  id: string;
  data: Record<string, any>;
};

type PerformanceResult = {
  testName: string;
  iterations: number;
  durationMs: number;
  averageMs: number;
  maxAllowedMs: number;
  passed: boolean;
};

let queueRows: QueueEntryRow[] = [];
const performanceResults: PerformanceResult[] = [];

const mockCollection = jest.fn((database: unknown, name: string) => ({
  __type: 'collection',
  database,
  name,
}));

const mockWhere = jest.fn((field: string, operator: string, value: unknown) => ({
  __type: 'where',
  field,
  operator,
  value,
}));

const mockQuery = jest.fn((...args: unknown[]) => ({
  __type: 'query',
  args,
}));

const mockGetDocs = jest.fn<(...args: any[]) => Promise<any>>();

jest.mock('@/services/firebase', () => ({
  auth: mockAuth,
  db: mockDb,
}));

jest.mock('firebase/firestore', () => ({
  collection: mockCollection,
  getDocs: mockGetDocs,
  query: mockQuery,
  where: mockWhere,
}));

import { fetchQueueEntries } from '@/api/queue-entries';

const queueDocSnap = (id: string, data: Record<string, any>) => ({
  id,
  data: () => data,
});

const seedQueueEntry = (id: string, data: Record<string, any>) => {
  queueRows.push({
    id,
    data: { ...data },
  });
};

const resolveDocsFromQuery = (target: any) => {
  const args = target?.__type === 'query' ? target.args : [target];
  const collectionRef = args[0];
  const collectionName = collectionRef?.name;

  if (collectionName !== 'QueueEntry') {
    return [];
  }

  const whereClauses = args.filter((arg: any) => arg?.__type === 'where');

  let rows = queueRows;

  for (const clause of whereClauses) {
    if (clause.operator !== '==') {
      continue;
    }

    rows = rows.filter((row) => row.data[clause.field] === clause.value);
  }

  return rows.map((row) => queueDocSnap(row.id, row.data));
};

const seedLargeQueueDataset = (count: number) => {
  const baseTime = new Date('2026-05-01T08:00:00.000Z').getTime();

  for (let index = 0; index < count; index += 1) {
    const carrierId = index % 2 === 0 ? 'carrier-1' : 'carrier-2';
    const stationNumber = (index % 10) + 1;
    const bookingNumber = (index % 40) + 1;

    const entryTime = new Date(baseTime + index * 60_000).toISOString();
    const serviceTime = new Date(baseTime + index * 60_000 + 20 * 60_000).toISOString();
    const exitTime = new Date(baseTime + index * 60_000 + 55 * 60_000).toISOString();

    const statusVariant =
      index % 3 === 0
        ? 'queued'
        : index % 3 === 1
          ? 'in_service'
          : 'done';

    seedQueueEntry(`queue-${index + 1}`, {
      Queue_ID: `queue-public-${index + 1}`,
      carrierId,
      Carrier_ID: carrierId,
      Facility_ID: 'facility-1',
      Station_ID: `station-${stationNumber}`,
      Booking_ID: `booking-${bookingNumber}`,
      Status: statusVariant,
      EntryTime: entryTime,
      ServiceTime: serviceTime,
      ExitTime: exitTime,
      CreatedAt: entryTime,
      UpdatedAt: exitTime,
    });
  }
};

const measureAsyncPerformance = async (
  testName: string,
  iterations: number,
  maxAllowedMs: number,
  callback: () => Promise<void>,
) => {
  const start = performance.now();

  for (let index = 0; index < iterations; index += 1) {
    await callback();
  }

  const durationMs = performance.now() - start;
  const averageMs = durationMs / iterations;
  const passed = durationMs <= maxAllowedMs;

  performanceResults.push({
    testName,
    iterations,
    durationMs: Number(durationMs.toFixed(3)),
    averageMs: Number(averageMs.toFixed(3)),
    maxAllowedMs,
    passed,
  });

  return {
    durationMs: Number(durationMs.toFixed(3)),
    averageMs: Number(averageMs.toFixed(3)),
    passed,
  };
};

describe('carrier queue performance tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockAuth.currentUser = { uid: 'carrier-1' };
    queueRows = [];

    mockGetDocs.mockImplementation(async (target: any) => ({
      docs: resolveDocsFromQuery(target),
    }));
  });

  it('fetches and normalizes a large carrier queue list within the acceptable time limit', async () => {
    seedLargeQueueDataset(1000);
    let entries: Awaited<ReturnType<typeof fetchQueueEntries>> = [];

    const result = await measureAsyncPerformance(
      'Fetch and normalize large carrier queue list',
      50,
      3000,
      async () => {
        entries = await fetchQueueEntries({
          carrierId: 'carrier-1',
        });
      },
    );

    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]).toHaveProperty('carrierId');
    expect(entries[0]).toHaveProperty('status');
    expect(result.durationMs).toBeLessThanOrEqual(3000);
  });

  it('filters queue entries by station and booking without noticeable delay', async () => {
    seedLargeQueueDataset(1000);
    let entries: Awaited<ReturnType<typeof fetchQueueEntries>> = [];

    const result = await measureAsyncPerformance(
      'Filter queue entries by station and booking',
      50,
      3000,
      async () => {
        entries = await fetchQueueEntries({
          carrierId: 'carrier-1',
          stationId: 'station-1',
          bookingId: 'booking-21',
        });
      },
    );

    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.stationId).toBe('station-1');
      expect(entry.bookingId).toBe('booking-21');
    }
    expect(result.durationMs).toBeLessThanOrEqual(3000);
  });

  it('maps legacy Firestore queue fields under repeated access within the acceptable time limit', async () => {
    for (let index = 0; index < 500; index += 1) {
      seedQueueEntry(`legacy-queue-${index + 1}`, {
        Queue_ID: `legacy-public-${index + 1}`,
        Carrier_ID: 'carrier-1',
        Facility_ID: 'facility-1',
        Station_ID: `station-${(index % 8) + 1}`,
        Booking_ID: `booking-${(index % 20) + 1}`,
        Status: index % 2 === 0 ? 'Waiting' : 'Completed',
        EntryTime: '2026-05-01T08:00:00.000Z',
        ServiceTime: '2026-05-01T08:20:00.000Z',
        ExitTime: '2026-05-01T09:00:00.000Z',
      });
    }
    let entries: Awaited<ReturnType<typeof fetchQueueEntries>> = [];

    const result = await measureAsyncPerformance(
      'Legacy queue field mapping',
      50,
      3000,
      async () => {
        entries = await fetchQueueEntries({
          carrierId: 'carrier-1',
        });
      },
    );

    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].carrierId).toBe('carrier-1');
    expect(entries[0].stationId).toBeDefined();
    expect(result.durationMs).toBeLessThanOrEqual(3000);
  });

  it('calculates waiting and service minutes for completed queue entries within the acceptable time limit', async () => {
    for (let index = 0; index < 500; index += 1) {
      seedQueueEntry(`completed-queue-${index + 1}`, {
        carrierId: 'carrier-1',
        Facility_ID: 'facility-1',
        Station_ID: `station-${(index % 5) + 1}`,
        Booking_ID: `booking-${index + 1}`,
        Status: 'Completed',
        EntryTime: '2026-05-01T08:00:00.000Z',
        ServiceTime: '2026-05-01T08:30:00.000Z',
        ExitTime: '2026-05-01T09:10:00.000Z',
      });
    }
    let entries: Awaited<ReturnType<typeof fetchQueueEntries>> = [];

    const result = await measureAsyncPerformance(
      'Waiting and service minute calculation',
      50,
      3000,
      async () => {
        entries = await fetchQueueEntries({
          carrierId: 'carrier-1',
        });
      },
    );

    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].waitingMinutes).toBe(30);
    expect(entries[0].serviceMinutes).toBe(40);
    expect(result.durationMs).toBeLessThanOrEqual(3000);
  });

  it('handles 50 concurrent queue fetch operations without failure', async () => {
    seedLargeQueueDataset(1000);

    const start = performance.now();

    const operations = Array.from({ length: 50 }, async () =>
      fetchQueueEntries({
        carrierId: 'carrier-1',
      }),
    );

    const settledResults = await Promise.allSettled(operations);
    const durationMs = performance.now() - start;

    const successfulOperationCount = settledResults.filter(
      (item) => item.status === 'fulfilled',
    ).length;

    performanceResults.push({
      testName: '50 concurrent queue fetch operations',
      iterations: 50,
      durationMs: Number(durationMs.toFixed(3)),
      averageMs: Number((durationMs / 50).toFixed(3)),
      maxAllowedMs: 3000,
      passed: durationMs <= 3000 && successfulOperationCount === 50,
    });

    expect(successfulOperationCount).toBe(50);
    expect(durationMs).toBeLessThanOrEqual(3000);
  });
});

afterAll(() => {
  console.log('\nCarrier Queue Performance Test Summary');
  console.table(performanceResults);
});
