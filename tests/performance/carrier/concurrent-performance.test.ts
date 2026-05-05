import { afterAll, describe, expect, it } from '@jest/globals';

/**
 * Carrier concurrent performance tests.
 *
 * These tests simulate 30–50 concurrent carrier-side operations without using
 * production Firebase services. The goal is to verify that repeated carrier
 * actions such as recommendation calculation, booking-like processing,
 * queue-like processing, and issue-like processing can complete within the
 * 3-second threshold defined in the Test Plan.
 */

type PerformanceResult = {
  testName: string;
  concurrentOperations: number;
  durationMs: number;
  averageMs: number;
  maxAllowedMs: number;
  successfulOperations: number;
  failedOperations: number;
  passed: boolean;
};

type MockStation = {
  id: string;
  name: string;
  status: 'open' | 'limited' | 'closed';
  activeQueue: number;
  averageServiceMinutes: number;
  completedBookings: number;
};

type MockBooking = {
  id: string;
  carrierId: string;
  stationId: string;
  facilityId: string;
  arrivalTime: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
};

type MockQueueEntry = {
  id: string;
  carrierId: string;
  stationId: string;
  bookingId: string;
  status: 'waiting' | 'servicing' | 'completed';
  entryTime: string;
  serviceStartTime?: string;
  exitTime?: string;
};

type MockIssue = {
  id: string;
  carrierId: string;
  bookingId: string;
  category: 'Delay' | 'Facility' | 'Technical';
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'cancelled';
};

const performanceResults: PerformanceResult[] = [];

const createStations = (count: number): MockStation[] =>
  Array.from({ length: count }, (_item, index) => ({
    id: `station-${index + 1}`,
    name: `Station ${index + 1}`,
    status: index % 12 === 0 ? 'limited' : 'open',
    activeQueue: index % 9,
    averageServiceMinutes: 5 + (index % 6) * 3,
    completedBookings: 20 + index,
  }));

const createBookings = (count: number): MockBooking[] => {
  const baseTime = new Date('2026-05-01T08:00:00.000Z').getTime();

  return Array.from({ length: count }, (_item, index) => ({
    id: `booking-${index + 1}`,
    carrierId: index % 2 === 0 ? 'carrier-1' : 'carrier-2',
    stationId: `station-${(index % 10) + 1}`,
    facilityId: 'facility-1',
    arrivalTime: new Date(baseTime + index * 60 * 60_000).toISOString(),
    status:
      index % 4 === 0
        ? 'pending'
        : index % 4 === 1
          ? 'confirmed'
          : index % 4 === 2
            ? 'completed'
            : 'cancelled',
  }));
};

const createQueueEntries = (count: number): MockQueueEntry[] => {
  const baseTime = new Date('2026-05-01T08:00:00.000Z').getTime();

  return Array.from({ length: count }, (_item, index) => {
    const entryTime = new Date(baseTime + index * 60_000).toISOString();
    const serviceStartTime = new Date(baseTime + index * 60_000 + 20 * 60_000).toISOString();
    const exitTime = new Date(baseTime + index * 60_000 + 55 * 60_000).toISOString();

    return {
      id: `queue-${index + 1}`,
      carrierId: index % 2 === 0 ? 'carrier-1' : 'carrier-2',
      stationId: `station-${(index % 10) + 1}`,
      bookingId: `booking-${(index % 50) + 1}`,
      status:
        index % 3 === 0
          ? 'waiting'
          : index % 3 === 1
            ? 'servicing'
            : 'completed',
      entryTime,
      serviceStartTime,
      exitTime,
    };
  });
};

const createIssues = (count: number): MockIssue[] =>
  Array.from({ length: count }, (_item, index) => ({
    id: `issue-${index + 1}`,
    carrierId: index % 2 === 0 ? 'carrier-1' : 'carrier-2',
    bookingId: `booking-${(index % 50) + 1}`,
    category:
      index % 3 === 0
        ? 'Delay'
        : index % 3 === 1
          ? 'Facility'
          : 'Technical',
    description: `Mock carrier issue ${index + 1}`,
    status:
      index % 4 === 0
        ? 'open'
        : index % 4 === 1
          ? 'in_progress'
          : index % 4 === 2
            ? 'resolved'
            : 'cancelled',
  }));

const calculateRecommendationScore = (station: MockStation) => {
  const availabilityPenalty = station.status === 'open' ? 0 : station.status === 'limited' ? 20 : 100;
  const queuePenalty = station.activeQueue * 8;
  const servicePenalty = station.averageServiceMinutes * 2;
  const reliabilityBonus = Math.min(station.completedBookings, 100) * 0.2;

  return queuePenalty + servicePenalty + availabilityPenalty - reliabilityBonus;
};

const runRecommendationOperation = async (stations: MockStation[]) => {
  const availableStations = stations.filter((station) => station.status !== 'closed');

  const rankedStations = availableStations
    .map((station) => ({
      ...station,
      score: calculateRecommendationScore(station),
      expectedWaitMinutes: station.activeQueue * station.averageServiceMinutes,
    }))
    .sort((first, second) => first.score - second.score);

  return rankedStations[0];
};

const runBookingOperation = async (bookings: MockBooking[], index: number) => {
  const carrierBookings = bookings.filter((booking) => booking.carrierId === 'carrier-1');
  const activeBookings = carrierBookings.filter(
    (booking) => booking.status === 'pending' || booking.status === 'confirmed',
  );

  const newBooking: MockBooking = {
    id: `generated-booking-${index + 1}`,
    carrierId: 'carrier-1',
    stationId: `station-${(index % 10) + 1}`,
    facilityId: 'facility-1',
    arrivalTime: new Date(
      new Date('2026-05-01T08:00:00.000Z').getTime() + index * 60 * 60_000,
    ).toISOString(),
    status: 'pending',
  };

  return {
    activeBookingCount: activeBookings.length,
    newBooking,
  };
};

const runQueueOperation = async (queueEntries: MockQueueEntry[]) => {
  const carrierEntries = queueEntries.filter((entry) => entry.carrierId === 'carrier-1');

  const normalizedEntries = carrierEntries.map((entry) => {
    const entryMs = new Date(entry.entryTime).getTime();
    const serviceStartMs = entry.serviceStartTime ? new Date(entry.serviceStartTime).getTime() : entryMs;
    const exitMs = entry.exitTime ? new Date(entry.exitTime).getTime() : serviceStartMs;

    const waitingMinutes = Math.max(0, Math.round((serviceStartMs - entryMs) / 60_000));
    const serviceMinutes = Math.max(0, Math.round((exitMs - serviceStartMs) / 60_000));

    return {
      ...entry,
      waitingMinutes,
      serviceMinutes,
    };
  });

  return normalizedEntries;
};

const runIssueOperation = async (issues: MockIssue[], index: number) => {
  const carrierIssues = issues.filter((issue) => issue.carrierId === 'carrier-1');
  const openIssues = carrierIssues.filter((issue) => issue.status === 'open');

  const newIssue: MockIssue = {
    id: `generated-issue-${index + 1}`,
    carrierId: 'carrier-1',
    bookingId: `booking-${(index % 50) + 1}`,
    category: index % 2 === 0 ? 'Delay' : 'Facility',
    description: `Concurrent carrier issue ${index + 1}`,
    status: 'open',
  };

  return {
    openIssueCount: openIssues.length,
    newIssue,
  };
};

const measureConcurrentPerformance = async (
  testName: string,
  concurrentOperations: number,
  maxAllowedMs: number,
  operations: Array<Promise<unknown>>,
) => {
  const start = Date.now();
  const settledResults = await Promise.allSettled(operations);
  const durationMs = Date.now() - start;

  const successfulOperations = settledResults.filter((result) => result.status === 'fulfilled').length;
  const failedOperations = settledResults.length - successfulOperations;
  const passed = durationMs <= maxAllowedMs && failedOperations === 0;

  performanceResults.push({
    testName,
    concurrentOperations,
    durationMs,
    averageMs: Number((durationMs / concurrentOperations).toFixed(3)),
    maxAllowedMs,
    successfulOperations,
    failedOperations,
    passed,
  });

  return {
    durationMs,
    successfulOperations,
    failedOperations,
    passed,
  };
};

describe('carrier concurrent performance tests', () => {
  it('handles 30 concurrent recommendation operations within the acceptable time limit', async () => {
    const stations = createStations(50);

    const operations = Array.from({ length: 30 }, () => runRecommendationOperation(stations));

    const result = await measureConcurrentPerformance(
      '30 concurrent recommendation operations',
      30,
      3000,
      operations,
    );

    expect(result.failedOperations).toBe(0);
    expect(result.durationMs).toBeLessThanOrEqual(3000);
  });

  it('handles 50 concurrent recommendation operations within the acceptable time limit', async () => {
    const stations = createStations(50);

    const operations = Array.from({ length: 50 }, () => runRecommendationOperation(stations));

    const result = await measureConcurrentPerformance(
      '50 concurrent recommendation operations',
      50,
      3000,
      operations,
    );

    expect(result.failedOperations).toBe(0);
    expect(result.durationMs).toBeLessThanOrEqual(3000);
  });

  it('handles 50 concurrent booking-like operations within the acceptable time limit', async () => {
    const bookings = createBookings(1000);

    const operations = Array.from({ length: 50 }, (_item, index) =>
      runBookingOperation(bookings, index),
    );

    const result = await measureConcurrentPerformance(
      '50 concurrent booking-like operations',
      50,
      3000,
      operations,
    );

    expect(result.failedOperations).toBe(0);
    expect(result.durationMs).toBeLessThanOrEqual(3000);
  });

  it('handles 50 concurrent queue-like operations within the acceptable time limit', async () => {
    const queueEntries = createQueueEntries(1000);

    const operations = Array.from({ length: 50 }, () => runQueueOperation(queueEntries));

    const result = await measureConcurrentPerformance(
      '50 concurrent queue-like operations',
      50,
      3000,
      operations,
    );

    expect(result.failedOperations).toBe(0);
    expect(result.durationMs).toBeLessThanOrEqual(3000);
  });

  it('handles 50 concurrent issue-like operations within the acceptable time limit', async () => {
    const issues = createIssues(1000);

    const operations = Array.from({ length: 50 }, (_item, index) =>
      runIssueOperation(issues, index),
    );

    const result = await measureConcurrentPerformance(
      '50 concurrent issue-like operations',
      50,
      3000,
      operations,
    );

    expect(result.failedOperations).toBe(0);
    expect(result.durationMs).toBeLessThanOrEqual(3000);
  });

  it('handles mixed carrier-side concurrent operations without failure', async () => {
    const stations = createStations(50);
    const bookings = createBookings(1000);
    const queueEntries = createQueueEntries(1000);
    const issues = createIssues(1000);

    const operations = [
      ...Array.from({ length: 15 }, () => runRecommendationOperation(stations)),
      ...Array.from({ length: 15 }, (_item, index) => runBookingOperation(bookings, index)),
      ...Array.from({ length: 10 }, () => runQueueOperation(queueEntries)),
      ...Array.from({ length: 10 }, (_item, index) => runIssueOperation(issues, index)),
    ];

    const result = await measureConcurrentPerformance(
      '50 mixed carrier-side concurrent operations',
      50,
      3000,
      operations,
    );

    expect(result.failedOperations).toBe(0);
    expect(result.durationMs).toBeLessThanOrEqual(3000);
  });
});

afterAll(() => {
  console.log('\nCarrier Concurrent Performance Test Summary');
  console.table(performanceResults);
});