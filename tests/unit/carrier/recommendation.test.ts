import { describe, expect, it } from '@jest/globals';

import {
  buildStationRecommendations,
  calculateStationStats,
  computePrediction,
  computeStationScore,
  computeTravelPenaltyMin,
  countActiveQueueByStation,
} from '@/utils/recommendation';

/**
 * These tests focus only on recommendation and queue calculation logic.
 * No Firebase, UI, navigation, or network dependency is used here.
 *
 * This makes the file a true unit test file:
 * input data goes in, calculation output is verified.
 */

const station = (overrides: Record<string, unknown>) =>
  ({
    id: 'station-1',
    name: 'Station 1',
    facilityId: 'facility-1',
    status: 'open',
    latitude: 35,
    longitude: 33,
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

describe('carrier recommendation calculations', () => {
  describe('computePrediction', () => {
    it('predicts future queue size, waiting time, and position from arrival/service rates', () => {
      /**
       * Scenario:
       * Current queue has 10 vehicles.
       * The carrier arrives 60 minutes later.
       * Arrival rate is 0.1 vehicle/min => 6 expected arrivals.
       * Two servers with 10 min average service time => 0.2 service/min => 12 expected services.
       *
       * Predicted queue = 10 + 6 - 12 = 4
       * Predicted wait = 4 / 0.2 = 20 min
       * Predicted position = floor(4) + 1 = 5
       */
      const prediction = computePrediction({
        now: new Date('2026-05-01T08:00:00.000Z'),
        arrivalTime: '2026-05-01T09:00:00.000Z',
        currentQueue: 10,
        avgServiceSec: 600,
        lambdaPerMin: 0.1,
        servers: 2,
      });

      expect(prediction).toMatchObject({
        dtMin: 60,
        expectedArrivals: 6,
        expectedServices: 12,
        effectiveServicePerMin: 0.2,
        predictedQueue: 4,
        predictedWaitMin: 20,
        predictedPosition: 5,
      });
    });

    it('does not produce negative queue values when service capacity is higher than demand', () => {
      /**
       * Service capacity can be greater than expected arrivals.
       * In that case, the queue should be clamped to zero instead of becoming negative.
       */
      const prediction = computePrediction({
        now: new Date('2026-05-01T08:00:00.000Z'),
        arrivalTime: '2026-05-01T09:00:00.000Z',
        currentQueue: 1,
        avgServiceSec: 300,
        lambdaPerMin: 0,
        servers: 2,
      });

      expect(prediction.predictedQueue).toBe(0);
      expect(prediction.predictedWaitMin).toBe(0);
      expect(prediction.predictedPosition).toBe(1);
    });

    it('treats past arrival times as immediate arrivals', () => {
      /**
       * If the selected arrival time is already in the past,
       * dtMin must be zero. This prevents invalid negative prediction windows.
       */
      const prediction = computePrediction({
        now: new Date('2026-05-01T09:00:00.000Z'),
        arrivalTime: '2026-05-01T08:00:00.000Z',
        currentQueue: 3,
        avgServiceSec: 900,
        lambdaPerMin: 0.2,
        servers: 1,
      });

      expect(prediction.dtMin).toBe(0);
      expect(prediction.expectedArrivals).toBe(0);
      expect(prediction.expectedServices).toBe(0);
      expect(prediction.predictedQueue).toBe(3);
      expect(prediction.predictedPosition).toBe(4);
    });

    it('uses safe defaults when invalid service rate inputs are provided', () => {
      /**
       * Defensive test:
       * Bad service time, bad lambda, and invalid server count should not crash the calculation.
       * The function falls back to default values and still returns a valid prediction object.
       */
      const prediction = computePrediction({
        now: new Date('2026-05-01T08:00:00.000Z'),
        arrivalTime: '2026-05-01T08:30:00.000Z',
        currentQueue: 2,
        avgServiceSec: -1,
        lambdaPerMin: -5,
        servers: 0,
      });

      expect(prediction.dtMin).toBe(30);
      expect(prediction.effectiveServicePerMin).toBeGreaterThan(0);
      expect(prediction.predictedQueue).toBeGreaterThanOrEqual(0);
      expect(prediction.predictedPosition).toBeGreaterThanOrEqual(1);
    });
  });

  describe('computeTravelPenaltyMin and computeStationScore', () => {
    it('returns zero travel penalty when station or carrier coordinates are missing', () => {
      /**
       * Coordinates may be missing in incomplete Firestore station records.
       * Recommendation logic should remain stable and assign no travel penalty.
       */
      expect(
        computeTravelPenaltyMin(
          station({
            latitude: undefined,
            longitude: undefined,
          }),
          35,
          33,
        ),
      ).toBe(0);

      expect(computeTravelPenaltyMin(station({}), undefined, undefined)).toBe(0);
    });

    it('calculates a positive travel penalty when the carrier is far from the station', () => {
      /**
       * A one-degree latitude difference is roughly 111 km.
       * With the default per-km penalty, the result should be clearly positive.
       */
      const penalty = computeTravelPenaltyMin(
        station({
          latitude: 35,
          longitude: 33,
        }),
        36,
        33,
      );

      expect(penalty).toBeGreaterThan(30);
    });

    it('adds limited station penalty to the station score', () => {
      /**
       * Limited stations are still usable but should be ranked worse than open stations.
       * This test verifies that the limited penalty is included in the score.
       */
      const score = computeStationScore(
        station({
          status: 'limited',
          latitude: 35,
          longitude: 33,
        }),
        {
          dtMin: 0,
          expectedArrivals: 0,
          expectedServices: 0,
          effectiveServicePerMin: 1,
          predictedQueue: 10,
          predictedWaitMin: 10,
          predictedPosition: 11,
        },
        35,
        33,
      );

      expect(score).toBe(18);
    });
  });

  describe('countActiveQueueByStation', () => {
    it('counts joined carriers as active until their service starts', () => {
      const counts = countActiveQueueByStation(
        [
          queueEvent({
            id: 'event-1',
            bookingId: 'booking-1',
            carrierId: 'carrier-1',
            stationId: 'station-1',
            type: 'queue_joined',
            ts: '2026-05-01T08:00:00.000Z',
          }),
          queueEvent({
            id: 'event-2',
            bookingId: 'booking-2',
            carrierId: 'carrier-2',
            stationId: 'station-1',
            type: 'queue_joined',
            ts: '2026-05-01T08:10:00.000Z',
          }),
        ],
        {
          now: new Date('2026-05-01T08:30:00.000Z'),
          lookbackMinutes: 60,
        },
      );

      expect(counts.get('station-1')).toBe(2);
    });

    it('removes a carrier from active queue after service_start', () => {
      /**
       * Once service starts, the carrier is no longer waiting in the active queue.
       */
      const counts = countActiveQueueByStation(
        [
          queueEvent({
            bookingId: 'booking-1',
            stationId: 'station-1',
            type: 'queue_joined',
            ts: '2026-05-01T08:00:00.000Z',
          }),
          queueEvent({
            bookingId: 'booking-1',
            stationId: 'station-1',
            type: 'service_start',
            ts: '2026-05-01T08:20:00.000Z',
          }),
        ],
        {
          now: new Date('2026-05-01T08:30:00.000Z'),
          lookbackMinutes: 60,
        },
      );

      expect(counts.get('station-1')).toBe(0);
    });

    it('uses the latest queue_joined event if the same booking joins again after service_start', () => {
      /**
       * This protects against event order edge cases.
       * If a new queue_joined event is newer than service_start, the entry should be active again.
       */
      const counts = countActiveQueueByStation(
        [
          queueEvent({
            bookingId: 'booking-1',
            stationId: 'station-1',
            type: 'service_start',
            ts: '2026-05-01T08:00:00.000Z',
          }),
          queueEvent({
            bookingId: 'booking-1',
            stationId: 'station-1',
            type: 'queue_joined',
            ts: '2026-05-01T08:10:00.000Z',
          }),
        ],
        {
          now: new Date('2026-05-01T08:30:00.000Z'),
          lookbackMinutes: 60,
        },
      );

      expect(counts.get('station-1')).toBe(1);
    });

    it('ignores queue events outside the active lookback window', () => {
      const counts = countActiveQueueByStation(
        [
          queueEvent({
            bookingId: 'old-booking',
            stationId: 'station-1',
            type: 'queue_joined',
            ts: '2026-05-01T06:00:00.000Z',
          }),
        ],
        {
          now: new Date('2026-05-01T08:30:00.000Z'),
          lookbackMinutes: 60,
        },
      );

      expect(counts.get('station-1')).toBeUndefined();
    });
  });

  describe('calculateStationStats', () => {
    it('calculates average wait time, service time, and arrival rate per station', () => {
      /**
       * Two completed visits in a 60-minute window:
       *
       * booking-1:
       * queue_joined 08:00 -> service_start 08:10 = 10 min wait
       * service_start 08:10 -> service_end 08:40 = 30 min service
       *
       * booking-2:
       * queue_joined 08:20 -> service_start 08:30 = 10 min wait
       * service_start 08:30 -> service_end 09:00 = 30 min service
       *
       * Average wait = 600 sec
       * Average service = 1800 sec
       * Lambda = 2 joins / 60 min
       */
      const stats = calculateStationStats(
        [
          queueEvent({
            bookingId: 'booking-1',
            stationId: 'station-1',
            type: 'queue_joined',
            ts: '2026-05-01T08:00:00.000Z',
          }),
          queueEvent({
            bookingId: 'booking-1',
            stationId: 'station-1',
            type: 'service_start',
            ts: '2026-05-01T08:10:00.000Z',
          }),
          queueEvent({
            bookingId: 'booking-1',
            stationId: 'station-1',
            type: 'service_end',
            ts: '2026-05-01T08:40:00.000Z',
          }),
          queueEvent({
            bookingId: 'booking-2',
            stationId: 'station-1',
            type: 'queue_joined',
            ts: '2026-05-01T08:20:00.000Z',
          }),
          queueEvent({
            bookingId: 'booking-2',
            stationId: 'station-1',
            type: 'service_start',
            ts: '2026-05-01T08:30:00.000Z',
          }),
          queueEvent({
            bookingId: 'booking-2',
            stationId: 'station-1',
            type: 'service_end',
            ts: '2026-05-01T09:00:00.000Z',
          }),
        ],
        60,
        new Date('2026-05-01T09:00:00.000Z'),
      );

      const stationStats = stats.get('station-1');

      expect(stationStats).toMatchObject({
        stationId: 'station-1',
        windowMinutes: 60,
        avgWaitSec: 600,
        avgServiceSec: 1800,
        lambdaPerMin: 2 / 60,
        updatedAt: '2026-05-01T09:00:00.000Z',
      });
    });

    it('ignores malformed or out-of-window events when calculating statistics', () => {
      const stats = calculateStationStats(
        [
          queueEvent({
            bookingId: 'old-booking',
            stationId: 'station-1',
            type: 'queue_joined',
            ts: '2026-05-01T06:00:00.000Z',
          }),
          queueEvent({
            bookingId: 'bad-date',
            stationId: 'station-1',
            type: 'queue_joined',
            ts: 'not-a-date',
          }),
        ],
        60,
        new Date('2026-05-01T09:00:00.000Z'),
      );

      expect(stats.get('station-1')).toBeUndefined();
    });
  });

  describe('buildStationRecommendations', () => {
    it('excludes closed stations from carrier recommendations', () => {
      const result = buildStationRecommendations({
        slot: '10-11',
        stations: [
          station({
            id: 'open-station',
            name: 'Open Station',
            status: 'open',
          }),
          station({
            id: 'closed-station',
            name: 'Closed Station',
            status: 'closed',
          }),
        ],
      });

      /**
       * Closed stations must not be offered to the carrier.
       */
      expect(result.stations).toHaveLength(1);
      expect(result.stations[0].stationId).toBe('open-station');
      expect(result.suggestedStationId).toBe('open-station');
    });

    it('ranks stations by lowest predicted waiting time', () => {
      const result = buildStationRecommendations({
        slot: '10-11',
        stations: [
          station({
            id: 'slow-station',
            name: 'Slow Station',
            avgServiceTimeMin: 20,
          }),
          station({
            id: 'fast-station',
            name: 'Fast Station',
            avgServiceTimeMin: 5,
          }),
        ],
        activeQueueByStation: {
          waiting: new Map([
            ['slow-station', 2],
            ['fast-station', 1],
          ]),
          servicing: new Map([
            ['slow-station', 1],
            ['fast-station', 0],
          ]),
        },
      });

      /**
       * slow-station: activeJobs 3 * 20 min = 60 min
       * fast-station: activeJobs 1 * 5 min = 5 min
       *
       * The fast station must be recommended first.
       */
      expect(result.suggestedStationId).toBe('fast-station');
      expect(result.stations.map((item) => item.stationId)).toEqual([
        'fast-station',
        'slow-station',
      ]);

      expect(result.stations[0]).toMatchObject({
        stationId: 'fast-station',
        predictedQueue: 1,
        predictedPosition: 2,
        predictedWaitMin: 5,
        score: 5,
      });

      expect(result.stations[1]).toMatchObject({
        stationId: 'slow-station',
        predictedQueue: 3,
        predictedPosition: 4,
        predictedWaitMin: 60,
        score: 60,
      });
    });

    it('uses computed average service time when avgServiceTimeMin is missing', () => {
      const result = buildStationRecommendations({
        slot: '10-11',
        stations: [
          station({
            id: 'computed-station',
            name: 'Computed Station',
            totalServiceTimeMin: 80,
            completedJobsCount: 4,
          }),
        ],
        activeQueueByStation: {
          waiting: new Map([['computed-station', 2]]),
          servicing: new Map(),
        },
      });

      /**
       * Average service time = totalServiceTimeMin / completedJobsCount = 80 / 4 = 20 min.
       * Active jobs = 2.
       * Predicted wait = 2 * 20 = 40 min.
       */
      expect(result.stations[0]).toMatchObject({
        stationId: 'computed-station',
        predictedQueue: 2,
        predictedPosition: 3,
        predictedWaitMin: 40,
        score: 40,
      });
    });

    it('uses default 15 minute service time when no station service data exists', () => {
      const result = buildStationRecommendations({
        slot: '10-11',
        stations: [
          station({
            id: 'default-station',
            name: 'Default Station',
            avgServiceTimeMin: undefined,
            totalServiceTimeMin: undefined,
            completedJobsCount: undefined,
          }),
        ],
        activeQueueByStation: {
          waiting: new Map([['default-station', 2]]),
          servicing: new Map(),
        },
      });

      /**
       * Default average service time is 15 minutes.
       * Active jobs = 2.
       * Predicted wait = 30 minutes.
       */
      expect(result.stations[0]).toMatchObject({
        stationId: 'default-station',
        predictedQueue: 2,
        predictedPosition: 3,
        predictedWaitMin: 30,
        score: 30,
      });
    });

    it('adds M/M/1 theoretical waiting time from historical completed bookings', () => {
      const result = buildStationRecommendations({
        slot: '10-11',
        windowDays: 1,
        stations: [
          station({
            id: 'historical-station',
            name: 'Historical Station',
            avgServiceTimeMin: 30,
          }),
        ],
        completedBookingsByStation: new Map([['historical-station', 24]]),
      });

      /**
       * windowDays = 1
       * completedBookings = 24
       * lambda = 24 / 24 = 1 job/hour
       * avgServiceTime = 30 min => mu = 60 / 30 = 2 jobs/hour
       *
       * Wq = lambda / mu(mu - lambda)
       * Wq = 1 / 2(2 - 1) = 0.5 hours = 30 min
       */
      expect(result.stations[0].predictedWaitMin).toBeCloseTo(30);
      expect(result.stations[0].score).toBeCloseTo(30);
    });

    it('caps theoretical waiting time when the M/M/1 system is unstable', () => {
      const result = buildStationRecommendations({
        slot: '10-11',
        windowDays: 1,
        stations: [
          station({
            id: 'unstable-station',
            name: 'Unstable Station',
            avgServiceTimeMin: 60,
          }),
          station({
            id: 'stable-station',
            name: 'Stable Station',
            avgServiceTimeMin: 10,
          }),
        ],
        completedBookingsByStation: new Map([
          ['unstable-station', 48],
          ['stable-station', 0],
        ]),
      });

      /**
       * unstable-station:
       * lambda = 48 / 24 = 2 jobs/hour
       * mu = 60 / 60 = 1 job/hour
       *
       * Since lambda >= mu, the theoretical queue is unstable.
       * The function protects the app by capping Wq to 10000 minutes.
       */
      const unstable = result.stations.find((item) => item.stationId === 'unstable-station');
      const stable = result.stations.find((item) => item.stationId === 'stable-station');

      expect(unstable?.predictedWaitMin).toBe(10000);
      expect(stable?.predictedWaitMin).toBe(0);
      expect(result.suggestedStationId).toBe('stable-station');
    });

    it('returns null suggestedStationId when there are no available stations', () => {
      const result = buildStationRecommendations({
        slot: '10-11',
        stations: [
          station({
            id: 'closed-station',
            name: 'Closed Station',
            status: 'closed',
          }),
        ],
      });

      expect(result.suggestedStationId).toBeNull();
      expect(result.stations).toEqual([]);
    });
  });
});
