import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

/**
 * Carrier booking performance tests.
 *
 * These tests measure whether carrier booking operations can be fetched,
 * normalized, created, updated, cancelled, and completed within the response
 * time threshold defined in the Test Plan.
 *
 * Firebase and Firestore are mocked. The purpose is not to test Firebase
 * infrastructure performance, but to test the carrier-side booking processing
 * logic under repeated and larger booking datasets.
 */

const mockDb = { app: 'performance-test-db' };

const mockAuth: { currentUser: { uid: string } | null } = {
  currentUser: { uid: 'carrier-1' },
};

type BookingRow = {
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

let bookingRows: BookingRow[] = [];
let generatedDocCounter = 0;

const performanceResults: PerformanceResult[] = [];

const mockCollection = jest.fn((database: unknown, name: string) => ({
  __type: 'collection',
  database,
  name,
}));

const mockDoc = jest.fn((...args: any[]) => {
  if (args.length === 1 && args[0]?.__type === 'collection') {
    generatedDocCounter += 1;

    return {
      __type: 'doc',
      collectionName: args[0].name,
      id: `generated-booking-${generatedDocCounter}`,
    };
  }

  return {
    __type: 'doc',
    database: args[0],
    collectionName: args[1],
    id: args[2],
  };
});

const mockGetDocs = jest.fn<(...args: any[]) => Promise<any>>();
const mockGetDoc = jest.fn<(...args: any[]) => Promise<any>>();
const mockLimit = jest.fn((count: number) => ({
  __type: 'limit',
  count,
}));
const mockQuery = jest.fn((...args: unknown[]) => ({
  __type: 'query',
  args,
}));
const mockSetDoc = jest.fn<(...args: any[]) => Promise<any>>();
const mockUpdateDoc = jest.fn<(...args: any[]) => Promise<any>>();
const mockWhere = jest.fn((field: string, operator: string, value: unknown) => ({
  __type: 'where',
  field,
  operator,
  value,
}));

const mockServerTimestamp = jest.fn(() => new Date('2026-05-01T08:00:00.000Z'));

jest.mock('@/services/firebase', () => ({
  auth: mockAuth,
  db: mockDb,
}));

jest.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  limit: mockLimit,
  query: mockQuery,
  serverTimestamp: mockServerTimestamp,
  setDoc: mockSetDoc,
  updateDoc: mockUpdateDoc,
  where: mockWhere,
}));

jest.mock('@/api/queue-events', () => ({
  fetchQueueEvents: jest.fn(),
}));

jest.mock('@/api/station-stats', () => ({
  fetchStationStats: jest.fn(),
}));

jest.mock('@/api/stations', () => ({
  fetchStations: jest.fn(),
}));

import {
  cancelBooking,
  completeBooking,
  createBooking,
  fetchBooking,
  fetchBookings,
  updateBooking,
} from '@/api/bookings';

const bookingDocSnap = (id: string, data: Record<string, any>) => ({
  id,
  exists: () => true,
  data: () => data,
});

const emptyDocSnap = {
  exists: () => false,
  data: () => undefined,
};

const seedBooking = (id: string, data: Record<string, any>) => {
  bookingRows.push({
    id,
    data: { ...data },
  });
};

const findBookingRow = (id: string) => bookingRows.find((row) => row.id === id);

const resolveBookingDocsFromQuery = (target: any) => {
  const args = target?.__type === 'query' ? target.args : [target];
  const collectionRef = args[0];
  const collectionName = collectionRef?.name ?? collectionRef?.collectionName;

  if (collectionName !== 'Booking') {
    return [];
  }

  const whereClauses = args.filter((arg: any) => arg?.__type === 'where');
  const limitClause = args.find((arg: any) => arg?.__type === 'limit');

  let rows = bookingRows;

  for (const clause of whereClauses) {
    if (clause.operator !== '==') {
      continue;
    }

    rows = rows.filter((row) => row.data[clause.field] === clause.value);
  }

  if (typeof limitClause?.count === 'number') {
    rows = rows.slice(0, limitClause.count);
  }

  return rows.map((row) => bookingDocSnap(row.id, row.data));
};

const seedLargeBookingDataset = (count: number) => {
  const baseTime = new Date('2026-05-01T08:00:00.000Z').getTime();

  for (let index = 0; index < count; index += 1) {
    const carrierId = index % 2 === 0 ? 'carrier-1' : 'carrier-2';
    const stationNumber = (index % 10) + 1;
    const arrivalTime = new Date(baseTime + index * 60 * 60_000).toISOString();

    const status =
      index % 5 === 0
        ? 'Pending'
        : index % 5 === 1
          ? 'Confirmed'
          : index % 5 === 2
            ? 'Arrived'
            : index % 5 === 3
              ? 'Completed'
              : 'Cancelled';

    seedBooking(`booking-${index + 1}`, {
      Booking_ID: `booking-${index + 1}`,
      Booking_Status: status,
      ArrivalTime: arrivalTime,
      Slot: `${new Date(arrivalTime).getHours()}-${(new Date(arrivalTime).getHours() + 1) % 24}`,
      Facility_ID: 'facility-1',
      Facility_Name: 'Main Facility',
      Station_ID: `station-${stationNumber}`,
      StationId: `station-${stationNumber}`,
      Station_Name: `Station ${stationNumber}`,
      Carrier_ID: carrierId,
      carrierId,
      Notes: `Mock booking ${index + 1}`,
      RecommendedStationId: `station-${stationNumber}`,
      RecommendedWaitMin: index % 20,
      Recommendations: [
        {
          stationId: `station-${stationNumber}`,
          stationName: `Station ${stationNumber}`,
          predictedWaitMin: index % 20,
          predictedPosition: (index % 8) + 1,
          predictedQueue: index % 8,
          score: index % 20,
        },
      ],
      CreatedAt: arrivalTime,
      UpdatedAt: arrivalTime,
    });
  }
};

const measureAsyncPerformance = async (
  testName: string,
  iterations: number,
  maxAllowedMs: number,
  callback: () => Promise<void>,
) => {
  const start = Date.now();

  for (let index = 0; index < iterations; index += 1) {
    await callback();
  }

  const durationMs = Date.now() - start;
  const averageMs = durationMs / iterations;
  const passed = durationMs <= maxAllowedMs;

  performanceResults.push({
    testName,
    iterations,
    durationMs,
    averageMs: Number(averageMs.toFixed(3)),
    maxAllowedMs,
    passed,
  });

  return {
    durationMs,
    averageMs,
    passed,
  };
};

describe('carrier booking performance tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockAuth.currentUser = { uid: 'carrier-1' };
    bookingRows = [];
    generatedDocCounter = 0;

    mockGetDocs.mockImplementation(async (target: any) => ({
      docs: resolveBookingDocsFromQuery(target),
    }));

    mockGetDoc.mockImplementation(async (target: any) => {
      const row = findBookingRow(target?.id);

      if (!row) {
        return emptyDocSnap;
      }

      return bookingDocSnap(row.id, row.data);
    });

    mockSetDoc.mockImplementation(async (target: any, data: Record<string, any>) => {
      seedBooking(target.id, {
        ...data,
        ArrivalTime:
          data.ArrivalTime instanceof Date ? data.ArrivalTime.toISOString() : data.ArrivalTime,
        CreatedAt:
          data.CreatedAt instanceof Date ? data.CreatedAt.toISOString() : data.CreatedAt,
        UpdatedAt:
          data.UpdatedAt instanceof Date ? data.UpdatedAt.toISOString() : data.UpdatedAt,
      });
    });

    mockUpdateDoc.mockImplementation(async (target: any, updates: Record<string, any>) => {
      const row = findBookingRow(target?.id);

      if (!row) {
        return;
      }

      row.data = {
        ...row.data,
        ...updates,
        ArrivalTime:
          updates.ArrivalTime instanceof Date
            ? updates.ArrivalTime.toISOString()
            : updates.ArrivalTime ?? row.data.ArrivalTime,
        UpdatedAt:
          updates.UpdatedAt instanceof Date
            ? updates.UpdatedAt.toISOString()
            : updates.UpdatedAt ?? row.data.UpdatedAt,
      };
    });
  });

  it('fetches and normalizes a large carrier booking list within the acceptable time limit', async () => {
    seedLargeBookingDataset(1000);

    const result = await measureAsyncPerformance(
      'Fetch and normalize large carrier booking list',
      50,
      3000,
      async () => {
        const bookings = await fetchBookings({
          status: 'all',
        });

        expect(bookings.length).toBeGreaterThan(0);
        expect(bookings.every((booking) => booking.id)).toBe(true);
        expect(bookings.every((booking) => booking.facilityId)).toBe(true);
      },
    );

    expect(result.durationMs).toBeLessThanOrEqual(3000);
  });

  it('filters carrier bookings by status without noticeable delay', async () => {
    seedLargeBookingDataset(1000);

    const result = await measureAsyncPerformance(
      'Filter carrier bookings by confirmed status',
      50,
      3000,
      async () => {
        const bookings = await fetchBookings({
          status: 'confirmed',
        });

        expect(bookings.every((booking) => booking.status === 'confirmed')).toBe(true);
      },
    );

    expect(result.durationMs).toBeLessThanOrEqual(3000);
  });

  it('creates carrier booking records repeatedly within the acceptable time limit', async () => {
    const result = await measureAsyncPerformance(
      'Create carrier booking records repeatedly',
      50,
      3000,
      async () => {
        const booking = await createBooking({
          facilityId: 'facility-1',
          facilityName: 'Main Facility',
          stationId: 'station-1',
          stationName: 'Station 1',
          arrivalTime: '2026-05-01T10:30:00.000Z',
          notes: 'Performance test booking',
          recommendedStationId: 'station-1',
          recommendedWaitMin: 12,
          recommendations: [
            {
              stationId: 'station-1',
              stationName: 'Station 1',
              predictedWaitMin: 12,
              predictedPosition: 2,
              predictedQueue: 1,
              score: 12,
            },
          ],
        });

        expect(booking.id).toBeDefined();
        expect(booking.facilityId).toBe('facility-1');
        expect(booking.stationId).toBe('station-1');
      },
    );

    expect(result.durationMs).toBeLessThanOrEqual(3000);
  });

  it('updates carrier booking records repeatedly within the acceptable time limit', async () => {
    seedLargeBookingDataset(100);

    const result = await measureAsyncPerformance(
      'Update carrier booking records repeatedly',
      50,
      3000,
      async () => {
        const booking = await updateBooking('booking-1', {
          stationId: 'station-2',
          arrivalTime: '2026-05-01T12:00:00.000Z',
          notes: 'Updated by performance test',
        });

        expect(booking.id).toBe('booking-1');
        expect(booking.stationId).toBe('station-2');
      },
    );

    expect(result.durationMs).toBeLessThanOrEqual(3000);
  });

  it('cancels carrier booking records repeatedly within the acceptable time limit', async () => {
    seedLargeBookingDataset(100);

    const result = await measureAsyncPerformance(
      'Cancel carrier booking records repeatedly',
      50,
      3000,
      async () => {
        const booking = await cancelBooking('booking-1', 'Performance test cancellation');

        expect(booking.id).toBe('booking-1');
        expect(booking.status).toBe('cancelled');
      },
    );

    expect(result.durationMs).toBeLessThanOrEqual(3000);
  });

  it('completes carrier booking records repeatedly within the acceptable time limit', async () => {
    seedLargeBookingDataset(100);

    const result = await measureAsyncPerformance(
      'Complete carrier booking records repeatedly',
      50,
      3000,
      async () => {
        const booking = await completeBooking('booking-1');

        expect(booking.id).toBe('booking-1');
        expect(booking.status).toBe('completed');
      },
    );

    expect(result.durationMs).toBeLessThanOrEqual(3000);
  });

  it('handles 50 concurrent booking creation operations without failure', async () => {
    const start = Date.now();

    const operations = Array.from({ length: 50 }, (_item, index) =>
      createBooking({
        facilityId: 'facility-1',
        facilityName: 'Main Facility',
        stationId: `station-${(index % 5) + 1}`,
        stationName: `Station ${(index % 5) + 1}`,
        arrivalTime: new Date(
          new Date('2026-05-01T08:00:00.000Z').getTime() + index * 60 * 60_000,
        ).toISOString(),
        notes: `Concurrent performance booking ${index + 1}`,
        recommendedStationId: `station-${(index % 5) + 1}`,
        recommendedWaitMin: index % 15,
      }),
    );

    const settledResults = await Promise.allSettled(operations);
    const durationMs = Date.now() - start;

    const successfulOperationCount = settledResults.filter(
      (item) => item.status === 'fulfilled',
    ).length;

    performanceResults.push({
      testName: '50 concurrent booking creation operations',
      iterations: 50,
      durationMs,
      averageMs: Number((durationMs / 50).toFixed(3)),
      maxAllowedMs: 3000,
      passed: durationMs <= 3000 && successfulOperationCount === 50,
    });

    expect(successfulOperationCount).toBe(50);
    expect(durationMs).toBeLessThanOrEqual(3000);
  });

  it('fetches a single booking repeatedly within the acceptable time limit', async () => {
    seedLargeBookingDataset(100);

    const result = await measureAsyncPerformance(
      'Fetch single carrier booking repeatedly',
      50,
      3000,
      async () => {
        const booking = await fetchBooking('booking-1');

        expect(booking.id).toBe('booking-1');
        expect(booking.facilityId).toBe('facility-1');
      },
    );

    expect(result.durationMs).toBeLessThanOrEqual(3000);
  });
});

afterAll(() => {
  console.log('\nCarrier Booking Performance Test Summary');
  console.table(performanceResults);
});
