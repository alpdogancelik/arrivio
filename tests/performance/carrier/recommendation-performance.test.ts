import { afterAll, describe, expect, it } from '@jest/globals';
import { performance } from 'node:perf_hooks';

import {
  buildStationRecommendations,
  calculateStationStats,
  computePrediction,
  countActiveQueueByStation,
} from '@/utils/recommendation';

/**
 * Performance tests for carrier-side recommendation and queue processing.
 *
 * These tests do not call Firebase, Firestore, navigation, or UI rendering.
 * They use deterministic mock data to measure whether the core carrier
 * recommendation logic can process repeated and larger inputs within the
 * response time threshold defined in the Test Plan.
 */

type PerformanceResult = {
  testName: string;
  iterations: number;
  durationMs: number;
  averageMs: number;
  maxAllowedMs: number;
  passed: boolean;
};

const performanceResults: PerformanceResult[] = [];

const measurePerformance = (
  testName: string,
  iterations: number,
  maxAllowedMs: number,
  callback: () => void,
) => {
  const start = performance.now();

  for (let index = 0; index < iterations; index += 1) {
    callback();
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

const station = (overrides: Record<string, unknown>) =>
  ({
    id: 'station-1',
    name: 'Station 1',
    facilityId: 'facility-1',
    status: 'open',
    latitude: 35,
    longitude: 33,
    avgServiceTimeMin: 10,
    ...overrides,
  }) as any;

const queueEvent = (overrides: Record<string, unknown>) =>
  ({
    id: 'event-1',
    stationId: 'station-1',
    carrierId: 'carrier-1',
    bookingId: 'booking-1',
    type: 'queue_joined',
    ts: '2026-05-01T08:00:00.000Z',
    ...overrides,
  }) as any;

const createStations = (count: number) =>
  Array.from({ length: count }, (_item, index) =>
    station({
      id: `station-${index + 1}`,
      name: `Station ${index + 1}`,
      status: index % 12 === 0 ? 'limited' : 'open',
      latitude: 35 + index * 0.001,
      longitude: 33 + index * 0.001,
      avgServiceTimeMin: 5 + (index % 6) * 3,
      totalServiceTimeMin: 100 + index * 5,
      completedJobsCount: 5 + (index % 8),
    }),
  );

const createQueueEvents = (stationCount: number, eventCount: number) => {
  const events: any[] = [];
  const baseTime = new Date('2026-05-01T08:00:00.000Z').getTime();

  for (let index = 0; index < eventCount; index += 1) {
    const stationId = `station-${(index % stationCount) + 1}`;
    const bookingId = `booking-${index + 1}`;
    const carrierId = `carrier-${index + 1}`;

    events.push(
      queueEvent({
        id: `queue-joined-${index + 1}`,
        stationId,
        bookingId,
        carrierId,
        type: 'queue_joined',
        ts: new Date(baseTime + index * 60_000).toISOString(),
      }),
    );

    if (index % 3 === 0) {
      events.push(
        queueEvent({
          id: `service-start-${index + 1}`,
          stationId,
          bookingId,
          carrierId,
          type: 'service_start',
          ts: new Date(baseTime + index * 60_000 + 10 * 60_000).toISOString(),
        }),
      );
    }

    if (index % 5 === 0) {
      events.push(
        queueEvent({
          id: `service-end-${index + 1}`,
          stationId,
          bookingId,
          carrierId,
          type: 'service_end',
          ts: new Date(baseTime + index * 60_000 + 25 * 60_000).toISOString(),
        }),
      );
    }
  }

  return events;
};

describe('carrier recommendation performance tests', () => {
  it('computes repeated queue predictions within the acceptable time limit', () => {
    let prediction: ReturnType<typeof computePrediction> | undefined;

    const result = measurePerformance('Repeated queue prediction calculation', 10_000, 3000, () => {
      prediction = computePrediction({
        now: new Date('2026-05-01T08:00:00.000Z'),
        arrivalTime: '2026-05-01T09:00:00.000Z',
        currentQueue: 10,
        avgServiceSec: 600,
        lambdaPerMin: 0.1,
        servers: 2,
      });
    });

    expect(prediction?.predictedQueue).toBeGreaterThanOrEqual(0);
    expect(prediction?.predictedPosition).toBeGreaterThanOrEqual(1);
    expect(result.durationMs).toBeLessThanOrEqual(3000);
  });

  it('counts active queue records from a large event list within the acceptable time limit', () => {
    const events = createQueueEvents(20, 500);
    let activeQueueByStation: ReturnType<typeof countActiveQueueByStation> | undefined;

    const result = measurePerformance('Active queue counting from large event list', 500, 3000, () => {
      activeQueueByStation = countActiveQueueByStation(events, {
        now: new Date('2026-05-01T18:00:00.000Z'),
        lookbackMinutes: 720,
      });
    });

    expect(activeQueueByStation).toBeInstanceOf(Map);
    expect(activeQueueByStation?.size).toBeGreaterThan(0);
    expect(result.durationMs).toBeLessThanOrEqual(3000);
  });

  it('calculates station statistics from repeated queue events within the acceptable time limit', () => {
    const events = createQueueEvents(20, 500);
    let stationStats: ReturnType<typeof calculateStationStats> | undefined;

    const result = measurePerformance('Station statistics calculation from queue events', 300, 3000, () => {
      stationStats = calculateStationStats(events, 720, new Date('2026-05-01T18:00:00.000Z'));
    });

    expect(stationStats).toBeInstanceOf(Map);
    expect(result.durationMs).toBeLessThanOrEqual(3000);
  });

  it('builds carrier station recommendations for many stations within the acceptable time limit', () => {
    const stations = createStations(50);

    const activeQueueByStation = {
      waiting: new Map(stations.map((item, index) => [item.id, index % 7])),
      servicing: new Map(stations.map((item, index) => [item.id, index % 3])),
    };

    const completedBookingsByStation = new Map(
      stations.map((item, index) => [item.id, 10 + index]),
    );

    let recommendations: ReturnType<typeof buildStationRecommendations> | undefined;

    const result = measurePerformance('Station recommendation ranking for many stations', 500, 3000, () => {
      recommendations = buildStationRecommendations({
        slot: '10-11',
        stations,
        activeQueueByStation,
        completedBookingsByStation,
        windowDays: 1,
      });
    });

    expect(recommendations?.stations.length).toBeGreaterThan(0);
    expect(recommendations?.suggestedStationId).not.toBeNull();
    expect(result.durationMs).toBeLessThanOrEqual(3000);
  });

  it('handles 50 repeated recommendation calculations without failure', () => {
    const stations = createStations(50);

    const activeQueueByStation = {
      waiting: new Map(stations.map((item, index) => [item.id, index % 7])),
      servicing: new Map(stations.map((item, index) => [item.id, index % 3])),
    };

    const completedBookingsByStation = new Map(
      stations.map((item, index) => [item.id, 10 + index]),
    );

    const start = performance.now();

    const results = Array.from({ length: 50 }, () =>
      buildStationRecommendations({
        slot: '10-11',
        stations,
        activeQueueByStation,
        completedBookingsByStation,
        windowDays: 1,
      }),
    );

    const durationMs = performance.now() - start;
    const successfulOperationCount = results.filter(
      (item) => item.stations.length > 0 && item.suggestedStationId,
    ).length;

    performanceResults.push({
      testName: '50 repeated recommendation calculations',
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
  console.log('\nCarrier Recommendation Performance Test Summary');
  console.table(performanceResults);
});
