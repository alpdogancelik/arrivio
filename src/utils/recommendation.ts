import type { QueueEvent, Station, StationRecommendation, StationStats } from '@/types/api';

export const DEFAULT_AVG_SERVICE_SEC = 900;
export const DEFAULT_LAMBDA_PER_MIN = 0;
export const DEFAULT_SERVERS = 1;
export const DEFAULT_WINDOW_MINUTES = 360;
export const DEFAULT_ACTIVE_QUEUE_LOOKBACK_MINUTES = 360;
export const LIMITED_PENALTY_MIN = 8;
export const TRAVEL_PENALTY_PER_KM_MIN = 0.35;

const safeNumber = (value?: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const toMillis = (value?: string | Date) => {
  if (!value) return undefined;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : undefined;
  }
  const parsed = new Date(value);
  const ms = parsed.getTime();
  return Number.isFinite(ms) ? ms : undefined;
};

export type PredictionInput = {
  arrivalTime: string | Date;
  now?: Date;
  currentQueue?: number;
  avgServiceSec?: number;
  lambdaPerMin?: number;
  servers?: number;
  defaultAvgServiceSec?: number;
  defaultLambdaPerMin?: number;
  defaultServers?: number;
};

export type PredictionOutput = {
  dtMin: number;
  expectedArrivals: number;
  expectedServices: number;
  effectiveServicePerMin: number;
  predictedQueue: number;
  predictedWaitMin: number;
  predictedPosition: number;
};

export const computePrediction = (input: PredictionInput): PredictionOutput => {
  const nowMs = input.now?.getTime() ?? Date.now();
  const arrivalMs = toMillis(input.arrivalTime) ?? nowMs;
  const dtMin = Math.max(0, (arrivalMs - nowMs) / 60000);

  const fallbackAvgService = input.defaultAvgServiceSec ?? DEFAULT_AVG_SERVICE_SEC;
  const fallbackLambda = input.defaultLambdaPerMin ?? DEFAULT_LAMBDA_PER_MIN;
  const fallbackServers = input.defaultServers ?? DEFAULT_SERVERS;

  const rawAvgService = safeNumber(input.avgServiceSec);
  const avgServiceSec = rawAvgService && rawAvgService > 0 ? rawAvgService : fallbackAvgService;
  const rawLambda = safeNumber(input.lambdaPerMin);
  const lambdaPerMin = rawLambda && rawLambda > 0 ? rawLambda : fallbackLambda;
  const servers = Math.max(1, safeNumber(input.servers) ?? fallbackServers);

  const effectiveServicePerMin = (servers / avgServiceSec) * 60;
  const expectedArrivals = lambdaPerMin * dtMin;
  const expectedServices = effectiveServicePerMin * dtMin;
  const currentQueue = safeNumber(input.currentQueue) ?? 0;

  const predictedQueue = Math.max(0, currentQueue + expectedArrivals - expectedServices);
  const predictedWaitMin = effectiveServicePerMin > 0 ? predictedQueue / effectiveServicePerMin : 0;
  const predictedPosition = Math.floor(predictedQueue) + 1;

  return {
    dtMin,
    expectedArrivals,
    expectedServices,
    effectiveServicePerMin,
    predictedQueue,
    predictedWaitMin,
    predictedPosition,
  };
};

const toRad = (deg: number) => (deg * Math.PI) / 180;

export const computeTravelPenaltyMin = (
  station: Station,
  carrierLat?: number,
  carrierLng?: number,
  perKm = TRAVEL_PENALTY_PER_KM_MIN,
) => {
  const lat = safeNumber(station.latitude);
  const lng = safeNumber(station.longitude);
  if (lat === undefined || lng === undefined) return 0;
  if (carrierLat === undefined || carrierLng === undefined) return 0;

  const dLat = toRad(carrierLat - lat);
  const dLng = toRad(carrierLng - lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat)) * Math.cos(toRad(carrierLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = 6371 * c;
  return distanceKm * perKm;
};

export const computeStationScore = (
  station: Station,
  prediction: PredictionOutput,
  carrierLat?: number,
  carrierLng?: number,
  limitedPenaltyMin = LIMITED_PENALTY_MIN,
  travelPenaltyPerKmMin = TRAVEL_PENALTY_PER_KM_MIN,
) => {
  const status = station.status ?? 'open';
  const limitedPenalty = status === 'limited' ? limitedPenaltyMin : 0;
  const travelPenalty = computeTravelPenaltyMin(station, carrierLat, carrierLng, travelPenaltyPerKmMin);
  return prediction.predictedWaitMin + limitedPenalty + travelPenalty;
};

export type ActiveQueueOptions = {
  now?: Date;
  lookbackMinutes?: number;
};

export const countActiveQueueByStation = (events: QueueEvent[], options?: ActiveQueueOptions) => {
  const nowMs = options?.now?.getTime() ?? Date.now();
  const lookback = options?.lookbackMinutes ?? DEFAULT_ACTIVE_QUEUE_LOOKBACK_MINUTES;
  const sinceMs = nowMs - lookback * 60000;

  const filtered = events
    .map((event) => ({ event, ts: toMillis(event.ts) }))
    .filter((entry) => entry.ts && entry.ts >= sinceMs && entry.ts <= nowMs)
    .sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));

  const stateByStation = new Map<string, Map<string, { lastJoin?: number; lastStart?: number }>>();

  for (const { event, ts } of filtered) {
    if (!ts) continue;
    const stationId = event.stationId;
    if (!stationId) continue;
    const key = event.bookingId ?? event.carrierId ?? event.id;

    let stationState = stateByStation.get(stationId);
    if (!stationState) {
      stationState = new Map();
      stateByStation.set(stationId, stationState);
    }

    const entry = stationState.get(key) ?? {};
    if (event.type === 'queue_joined') {
      entry.lastJoin = ts;
    } else if (event.type === 'service_start') {
      entry.lastStart = ts;
    }
    stationState.set(key, entry);
  }

  const counts = new Map<string, number>();
  for (const [stationId, entries] of stateByStation.entries()) {
    let active = 0;
    for (const entry of entries.values()) {
      if (entry.lastJoin && (!entry.lastStart || entry.lastStart < entry.lastJoin)) {
        active += 1;
      }
    }
    counts.set(stationId, active);
  }

  return counts;
};

const avg = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export const calculateStationStats = (events: QueueEvent[], windowMinutes: number, now = new Date()) => {
  const nowMs = now.getTime();
  const windowStartMs = nowMs - windowMinutes * 60000;

  const filtered = events
    .map((event) => ({ event, ts: toMillis(event.ts) }))
    .filter((entry) => entry.ts && entry.ts >= windowStartMs && entry.ts <= nowMs)
    .sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));

  const stationSamples = new Map<
    string,
    { waitSamples: number[]; serviceSamples: number[]; joinCount: number }
  >();
  const stateByStation = new Map<string, Map<string, { lastJoin?: number; lastStart?: number }>>();

  const getSamples = (stationId: string) => {
    let samples = stationSamples.get(stationId);
    if (!samples) {
      samples = { waitSamples: [], serviceSamples: [], joinCount: 0 };
      stationSamples.set(stationId, samples);
    }
    return samples;
  };

  for (const { event, ts } of filtered) {
    if (!ts) continue;
    const stationId = event.stationId;
    if (!stationId) continue;
    const key = event.bookingId ?? event.carrierId ?? event.id;

    let stationState = stateByStation.get(stationId);
    if (!stationState) {
      stationState = new Map();
      stateByStation.set(stationId, stationState);
    }

    const entry = stationState.get(key) ?? {};
    const samples = getSamples(stationId);

    if (event.type === 'queue_joined') {
      samples.joinCount += 1;
      entry.lastJoin = ts;
    } else if (event.type === 'service_start') {
      if (entry.lastJoin && ts >= entry.lastJoin) {
        samples.waitSamples.push((ts - entry.lastJoin) / 1000);
      }
      entry.lastJoin = undefined;
      entry.lastStart = ts;
    } else if (event.type === 'service_end') {
      if (entry.lastStart && ts >= entry.lastStart) {
        samples.serviceSamples.push((ts - entry.lastStart) / 1000);
      }
      entry.lastStart = undefined;
    }

    stationState.set(key, entry);
  }

  const statsByStation = new Map<string, StationStats>();
  for (const [stationId, samples] of stationSamples.entries()) {
    statsByStation.set(stationId, {
      stationId,
      windowMinutes,
      avgServiceSec: avg(samples.serviceSamples),
      avgWaitSec: avg(samples.waitSamples),
      lambdaPerMin: windowMinutes > 0 ? samples.joinCount / windowMinutes : 0,
      updatedAt: new Date(nowMs).toISOString(),
    });
  }

  return statsByStation;
};

export type RecommendationBuildInput = {
  stations: Station[];
  // Carrier-selected slot label (e.g. "10-11").
  // We keep this explicit so we don't depend on timezone parsing of ISO strings.
  slot: string;
  // Real-time queue state derived from QueueEntry documents.
  activeQueueByStation?: { waiting: Map<string, number>; servicing: Map<string, number> };
  // Historical completed-booking counts for the selected slot, over the last `windowDays` days.
  completedBookingsByStation?: Map<string, number>;
  // Sliding window size used to compute λ (arrival rate). Defaults to 7 days.
  windowDays?: number;
};

export const buildStationRecommendations = (input: RecommendationBuildInput) => {
  const windowDays = Math.max(1, input.windowDays ?? 7);
  const completedByStation = input.completedBookingsByStation ?? new Map<string, number>();
  const waitingByStation = input.activeQueueByStation?.waiting ?? new Map<string, number>();
  const servicingByStation = input.activeQueueByStation?.servicing ?? new Map<string, number>();

  // ------------------------------------------------------------
  // Real-time hybrid waiting-time model (from the provided slides)
  //
  // TotalWaiting(min) = (ActiveJobs × AvgServiceTimeMin) + Wq(min)
  //
  // - ActiveJobs: current number of vehicles (waiting + servicing)
  // - AvgServiceTimeMin: station's learned average service time (minutes)
  // - Wq: theoretical queue waiting time from M/M/1 (baseline congestion)
  //
  // IMPORTANT: We normalize λ over (days × 24) to get a per-hour arrival rate.
  // This keeps units consistent with μ = 60 / AvgServiceTimeMin (jobs/hour)
  // and keeps Wq as a small baseline that complements live queue state.
  // ------------------------------------------------------------

  const stations = input.stations.filter((station) => (station.status ?? 'open') !== 'closed');
  const recommendations: StationRecommendation[] = stations.map((station) => {
    const avgServiceTimeMin = getStationAvgServiceTimeMin(station);
    const waiting = waitingByStation.get(station.id) ?? 0;
    const servicing = servicingByStation.get(station.id) ?? 0;
    const activeJobs = waiting + servicing;

    const completedBookings = completedByStation.get(station.id) ?? 0;
    const lambdaPerHour = completedBookings / (windowDays * 24); // jobs/hour
    const muPerHour = 60 / avgServiceTimeMin; // jobs/hour

    const theoreticalWqMin = computeTheoreticalWqMin(lambdaPerHour, muPerHour);
    const baseWaitingMin = activeJobs * avgServiceTimeMin;
    const totalWaitingMin = baseWaitingMin + theoreticalWqMin;

    return {
      stationId: station.id,
      stationName: station.name,
      facilityId: station.facilityId,
      status: station.status,
      predictedWaitMin: totalWaitingMin,
      predictedPosition: activeJobs + 1,
      predictedQueue: activeJobs,
      score: totalWaitingMin,
    };
  });

  recommendations.sort((a, b) => a.score - b.score);
  return {
    suggestedStationId: recommendations[0]?.stationId ?? null,
    stations: recommendations,
  };
};

const DEFAULT_AVG_SERVICE_TIME_MIN = 15;
const MAX_THEORETICAL_WQ_MIN = 10_000;

const getStationAvgServiceTimeMin = (station: Station) => {
  const direct = safeNumber(station.avgServiceTimeMin);
  if (direct !== undefined && direct > 0) return direct;

  const total = safeNumber(station.totalServiceTimeMin);
  const count = safeNumber(station.completedJobsCount);
  if (total !== undefined && count !== undefined && count > 0) {
    const computed = total / count;
    if (Number.isFinite(computed) && computed > 0) return computed;
  }

  return DEFAULT_AVG_SERVICE_TIME_MIN;
};

const computeTheoreticalWqMin = (lambdaPerHour: number, muPerHour: number) => {
  // M/M/1 queue waiting time (excluding service time):
  //   Wq = λ / ( μ(μ - λ) )
  // where λ and μ are in jobs/hour. Result is in hours -> convert to minutes.
  if (!Number.isFinite(lambdaPerHour) || !Number.isFinite(muPerHour)) return 0;
  if (lambdaPerHour <= 0 || muPerHour <= 0) return 0;

  // If λ >= μ, the system is unstable and theoretical waiting time diverges.
  if (lambdaPerHour >= muPerHour) return MAX_THEORETICAL_WQ_MIN;

  const wqHours = lambdaPerHour / (muPerHour * (muPerHour - lambdaPerHour));
  const wqMin = wqHours * 60;
  if (!Number.isFinite(wqMin) || wqMin < 0) return 0;
  return Math.min(MAX_THEORETICAL_WQ_MIN, wqMin);
};
