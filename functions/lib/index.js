"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onQueueEntryCreated = exports.onBookingCompleted = exports.getRecommendation = exports.TRAVEL_PENALTY_PER_KM_MIN = exports.LIMITED_PENALTY_MIN = exports.DEFAULT_ACTIVE_QUEUE_LOOKBACK_MINUTES = exports.DEFAULT_WINDOW_MINUTES = exports.DEFAULT_SERVERS = exports.DEFAULT_LAMBDA_PER_MIN = exports.DEFAULT_AVG_SERVICE_SEC = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const logger = __importStar(require("firebase-functions/logger"));
const firestore_2 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
exports.DEFAULT_AVG_SERVICE_SEC = 900;
exports.DEFAULT_LAMBDA_PER_MIN = 0;
exports.DEFAULT_SERVERS = 1;
exports.DEFAULT_WINDOW_MINUTES = 360;
exports.DEFAULT_ACTIVE_QUEUE_LOOKBACK_MINUTES = 360;
exports.LIMITED_PENALTY_MIN = 8;
exports.TRAVEL_PENALTY_PER_KM_MIN = 0.35;
const safeNumber = (value) => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const toMillis = (value) => {
    if (!value)
        return undefined;
    if (value instanceof Date) {
        const ms = value.getTime();
        return Number.isFinite(ms) ? ms : undefined;
    }
    const parsed = new Date(value);
    const ms = parsed.getTime();
    return Number.isFinite(ms) ? ms : undefined;
};
const toStringValue = (value) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);
const toNumberValue = (value) => {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
};
const normalizeQueueEntryStatus = (value) => {
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw)
        return undefined;
    if (raw === 'waiting')
        return 'Waiting';
    if (raw === 'servicing' || raw === 'serving' || raw === 'inservice' || raw === 'in_service')
        return 'Servicing';
    if (raw === 'completed' || raw === 'done')
        return 'Completed';
    return String(value);
};
const toIsoString = (value) => {
    if (!value)
        return undefined;
    if (typeof value === 'string') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (value instanceof firestore_1.Timestamp) {
        return value.toDate().toISOString();
    }
    if (typeof value?.toDate === 'function') {
        try {
            return value.toDate().toISOString();
        }
        catch {
            return undefined;
        }
    }
    return undefined;
};
const deriveHourSlot = (hour) => `${hour}-${(hour + 1) % 24}`;
const getHourInTimeZone = (iso, timeZone) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()))
        return undefined;
    if (timeZone) {
        try {
            const parts = new Intl.DateTimeFormat('en-GB', {
                timeZone,
                hour: '2-digit',
                hour12: false,
            }).formatToParts(date);
            const hourPart = parts.find((part) => part.type === 'hour')?.value;
            const hour = hourPart ? Number(hourPart) : Number.NaN;
            if (Number.isFinite(hour) && hour >= 0 && hour <= 23)
                return hour;
        }
        catch {
            // fallback below
        }
    }
    const fallbackHour = date.getHours();
    return Number.isFinite(fallbackHour) ? fallbackHour : undefined;
};
const normalizeSlotLabel = (value, options) => {
    if (!value)
        return undefined;
    // Timestamps / Date objects (Firestore may store slot as a Timestamp or Date).
    if (value instanceof Date || value instanceof firestore_1.Timestamp || typeof value?.toDate === 'function') {
        const iso = toIsoString(value);
        if (!iso)
            return undefined;
        const start = getHourInTimeZone(iso, options?.timeZone);
        return start === undefined ? undefined : deriveHourSlot(start);
    }
    // Explicit "HH-HH" or "HH:MM-HH:MM" (recommended representation).
    const raw = String(value).trim();
    const match = raw.match(/^(\d{1,2})(?::\d{2})?\s*-\s*(\d{1,2})(?::\d{2})?$/);
    if (match) {
        const start = Number(match[1]);
        const end = Number(match[2]);
        if (!Number.isFinite(start) || !Number.isFinite(end))
            return undefined;
        if (start < 0 || start > 23 || end < 0 || end > 23)
            return undefined;
        return `${start}-${end}`;
    }
    // Explicit "HH:MM" or "H:MM" (slot key used by mobile).
    const singleTimeMatch = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (singleTimeMatch) {
        const start = Number(singleTimeMatch[1]);
        const minute = Number(singleTimeMatch[2]);
        if (!Number.isFinite(start) || !Number.isFinite(minute))
            return undefined;
        if (start < 0 || start > 23 || minute < 0 || minute > 59)
            return undefined;
        return deriveHourSlot(start);
    }
    // Fallback: ISO/date-like string (e.g. "2026-01-15T10:00:00Z").
    const ms = toMillis(raw);
    if (ms === undefined)
        return undefined;
    const iso = new Date(ms).toISOString();
    const start = getHourInTimeZone(iso, options?.timeZone);
    return start === undefined ? undefined : deriveHourSlot(start);
};
const normalizeStationStatus = (value) => {
    const raw = String(value ?? '').toLowerCase();
    if (raw === 'open' || raw === 'closed' || raw === 'limited')
        return raw;
    if (raw === 'active')
        return 'open';
    if (raw === 'inactive' || raw === 'disabled')
        return 'closed';
    return undefined;
};
const normalizeQueueEventType = (value) => {
    const raw = String(value ?? '').toLowerCase();
    if (raw.includes('join'))
        return 'queue_joined';
    if (raw.includes('start'))
        return 'service_start';
    if (raw.includes('end'))
        return 'service_end';
    if (raw === 'queue_joined' || raw === 'service_start' || raw === 'service_end')
        return raw;
    return 'queue_joined';
};
const computePrediction = (input) => {
    const nowMs = input.now?.getTime() ?? Date.now();
    const arrivalMs = toMillis(input.arrivalTime) ?? nowMs;
    const dtMin = Math.max(0, (arrivalMs - nowMs) / 60000);
    const fallbackAvgService = input.defaultAvgServiceSec ?? exports.DEFAULT_AVG_SERVICE_SEC;
    const fallbackLambda = input.defaultLambdaPerMin ?? exports.DEFAULT_LAMBDA_PER_MIN;
    const fallbackServers = input.defaultServers ?? exports.DEFAULT_SERVERS;
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
const toRad = (deg) => (deg * Math.PI) / 180;
const computeTravelPenaltyMin = (station, carrierLat, carrierLng, perKm = exports.TRAVEL_PENALTY_PER_KM_MIN) => {
    const lat = safeNumber(station.latitude);
    const lng = safeNumber(station.longitude);
    if (lat === undefined || lng === undefined)
        return 0;
    if (carrierLat === undefined || carrierLng === undefined)
        return 0;
    const dLat = toRad(carrierLat - lat);
    const dLng = toRad(carrierLng - lng);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat)) * Math.cos(toRad(carrierLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = 6371 * c;
    return distanceKm * perKm;
};
const computeStationScore = (station, prediction, carrierLat, carrierLng, limitedPenaltyMin = exports.LIMITED_PENALTY_MIN, travelPenaltyPerKmMin = exports.TRAVEL_PENALTY_PER_KM_MIN) => {
    const status = station.status ?? 'open';
    const limitedPenalty = status === 'limited' ? limitedPenaltyMin : 0;
    const travelPenalty = computeTravelPenaltyMin(station, carrierLat, carrierLng, travelPenaltyPerKmMin);
    return prediction.predictedWaitMin + limitedPenalty + travelPenalty;
};
const countActiveQueueByStation = (events, options) => {
    const nowMs = options?.now?.getTime() ?? Date.now();
    const lookback = options?.lookbackMinutes ?? exports.DEFAULT_ACTIVE_QUEUE_LOOKBACK_MINUTES;
    const sinceMs = nowMs - lookback * 60000;
    const filtered = events
        .map((event) => ({ event, ts: toMillis(event.ts) }))
        .filter((entry) => entry.ts && entry.ts >= sinceMs && entry.ts <= nowMs)
        .sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
    const stateByStation = new Map();
    for (const { event, ts } of filtered) {
        if (!ts)
            continue;
        const stationId = event.stationId;
        if (!stationId)
            continue;
        const key = event.bookingId ?? event.carrierId ?? event.id;
        let stationState = stateByStation.get(stationId);
        if (!stationState) {
            stationState = new Map();
            stateByStation.set(stationId, stationState);
        }
        const entry = stationState.get(key) ?? {};
        if (event.type === 'queue_joined') {
            entry.lastJoin = ts;
        }
        else if (event.type === 'service_start') {
            entry.lastStart = ts;
        }
        stationState.set(key, entry);
    }
    const counts = new Map();
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
const buildStationRecommendations = (input) => {
    const now = input.now ?? new Date();
    const statsByStation = input.statsByStation ?? new Map();
    const queueByStation = input.currentQueueByStation ?? new Map();
    const stations = input.stations.filter((station) => (station.status ?? 'open') !== 'closed');
    const recommendations = stations.map((station) => {
        const stationStats = statsByStation.get(station.id);
        const currentQueue = queueByStation.get(station.id) ?? 0;
        const prediction = computePrediction({
            arrivalTime: input.arrivalTime,
            now,
            currentQueue,
            avgServiceSec: stationStats?.avgServiceSec,
            lambdaPerMin: stationStats?.lambdaPerMin,
            servers: station.servers,
        });
        const score = computeStationScore(station, prediction, input.carrierLat, input.carrierLng);
        return {
            stationId: station.id,
            stationName: station.name,
            facilityId: station.facilityId,
            status: station.status,
            predictedWaitMin: prediction.predictedWaitMin,
            predictedPosition: prediction.predictedPosition,
            predictedQueue: prediction.predictedQueue,
            score,
        };
    });
    recommendations.sort((a, b) => a.score - b.score);
    return {
        suggestedStationId: recommendations[0]?.stationId ?? null,
        stations: recommendations,
    };
};
const resolveStationId = (id, data) => toStringValue(data.Station_ID ??
    data.stationId ??
    data.StationId ??
    data.stationID ??
    data.StationID ??
    data.station_id) ?? id;
const resolveFacilityId = (data) => toStringValue(data.Facility_ID ??
    data.facilityId ??
    data.FacilityId ??
    data.facilityID ??
    data.FacilityID ??
    data.facility_id);
const resolveStationName = (data, stationId) => toStringValue(data.Name ?? data.Station_Name ?? data.stationName ?? data.name) ?? stationId;
const mapStation = (id, data) => {
    const stationId = resolveStationId(id, data);
    const facilityId = resolveFacilityId(data);
    return {
        id: stationId,
        facilityId: facilityId ?? 'unknown',
        name: resolveStationName(data, stationId),
        servers: toNumberValue(data.Servers ?? data.servers ?? data.ServerCount ?? data.serverCount ?? data.c),
        latitude: toNumberValue(data.Latitude ?? data.latitude ?? data.lat),
        longitude: toNumberValue(data.Longitude ?? data.longitude ?? data.lng),
        status: normalizeStationStatus(data.Status ?? data.status),
        avgServiceTimeMin: toNumberValue(data.avgServiceTimeMin ?? data.AvgServiceTimeMin ?? data.Avg_Service_Time_Min),
        totalServiceTimeMin: toNumberValue(data.totalServiceTimeMin ?? data.TotalServiceTimeMin),
        completedJobsCount: toNumberValue(data.completedJobsCount ?? data.CompletedJobsCount),
    };
};
const mapStationStats = (id, data) => ({
    stationId: toStringValue(data.Station_ID ?? data.StationId ?? data.stationId ?? data.station_id) ?? id,
    windowMinutes: toNumberValue(data.WindowMinutes ?? data.windowMinutes ?? data.Window_Minutes) ?? exports.DEFAULT_WINDOW_MINUTES,
    avgServiceSec: toNumberValue(data.AvgServiceSec ?? data.avgServiceSec ?? data.Avg_Service_Sec) ?? 0,
    avgWaitSec: toNumberValue(data.AvgWaitSec ?? data.avgWaitSec ?? data.Avg_Wait_Sec) ?? 0,
    lambdaPerMin: toNumberValue(data.LambdaPerMin ?? data.lambdaPerMin ?? data.lambda_per_min) ?? 0,
    updatedAt: toIsoString(data.UpdatedAt ?? data.updatedAt),
});
const mapQueueEvent = (id, data) => ({
    id: toStringValue(data.Event_ID ?? data.EventId ?? data.QueueEvent_ID ?? data.QueueEventId ?? data.id) ?? id,
    facilityId: toStringValue(data.Facility_ID ??
        data.facilityId ??
        data.FacilityId ??
        data.facilityID ??
        data.FacilityID ??
        data.facility_id) ?? 'unknown',
    stationId: toStringValue(data.Station_ID ??
        data.stationId ??
        data.StationId ??
        data.stationID ??
        data.StationID ??
        data.station_id) ?? 'unknown',
    carrierId: toStringValue(data.Carrier_ID ??
        data.carrierId ??
        data.CarrierId ??
        data.carrierID ??
        data.carrier_id) ?? 'unknown',
    bookingId: toStringValue(data.Booking_ID ?? data.bookingId ?? data.booking_id) ?? null,
    type: normalizeQueueEventType(data.Type ?? data.type ?? data.EventType ?? data.eventType),
    ts: toIsoString(data.Timestamp ?? data.ts ?? data.TS ?? data.createdAt ?? data.CreatedAt) ?? new Date().toISOString(),
});
const fetchStationsByFacility = async (facilityId) => {
    const snap = await db.collection('Station').get();
    const stations = snap.docs.map((doc) => mapStation(doc.id, doc.data()));
    return stations
        .map((station) => (station.facilityId === 'unknown' ? { ...station, facilityId } : station))
        .filter((station) => station.facilityId === facilityId);
};
const fetchAllStations = async () => {
    const snap = await db.collection('Station').get();
    return snap.docs.map((doc) => mapStation(doc.id, doc.data()));
};
const getStationAvgServiceTimeMin = (station) => {
    const direct = safeNumber(station.avgServiceTimeMin);
    if (direct !== undefined && direct > 0)
        return direct;
    const total = safeNumber(station.totalServiceTimeMin);
    const count = safeNumber(station.completedJobsCount);
    if (total !== undefined && count !== undefined && count > 0) {
        const computed = total / count;
        if (Number.isFinite(computed) && computed > 0)
            return computed;
    }
    return 15; // fallback when station hasn't learned yet
};
const fetchActiveQueueCountsByStation = async (stationIds) => {
    const stationIdSet = new Set(stationIds);
    const waiting = new Map();
    const servicing = new Map();
    const tryQuery = async (statusField) => db.collection('QueueEntry').where(statusField, 'in', ['Waiting', 'Servicing']).get();
    let docs = [];
    try {
        docs = (await tryQuery('status')).docs;
    }
    catch (err) {
        logger.debug('QueueEntry status query failed', err);
    }
    if (!docs.length) {
        try {
            docs = (await tryQuery('Status')).docs;
        }
        catch (err) {
            logger.debug('QueueEntry Status query failed', err);
        }
    }
    if (!docs.length) {
        const snap = await db.collection('QueueEntry').get();
        docs = snap.docs;
    }
    for (const doc of docs) {
        const data = doc.data();
        const stationId = toStringValue(data.stationId ?? data.StationId ?? data.Station_ID ?? data.station_id ?? data.Sation_ID) ??
            undefined;
        if (!stationId || !stationIdSet.has(stationId))
            continue;
        const status = normalizeQueueEntryStatus(data.status ?? data.Status);
        if (status === 'Waiting') {
            waiting.set(stationId, (waiting.get(stationId) ?? 0) + 1);
        }
        else if (status === 'Servicing') {
            servicing.set(stationId, (servicing.get(stationId) ?? 0) + 1);
        }
    }
    return { waiting, servicing };
};
const fetchRecentBookings = async (since) => {
    const results = new Map();
    // We try a few common timestamp fields to avoid needing composite indexes.
    // For recommendation we care about *recently completed* bookings, so ServiceEndTime is preferred.
    const tries = [
        'ServiceEndTime',
        'serviceEndTime',
        'UpdatedAt',
        'updatedAt',
        'CreatedAt',
        'createdAt',
        'Timestamp',
        'timestamp',
    ];
    for (const field of tries) {
        try {
            const snap = await db.collection('Booking').where(field, '>=', since).get();
            for (const doc of snap.docs)
                results.set(doc.id, doc);
        }
        catch (err) {
            logger.debug(`Booking query by ${field} failed`, err);
        }
    }
    if (!results.size) {
        const snap = await db.collection('Booking').get();
        for (const doc of snap.docs)
            results.set(doc.id, doc);
    }
    return Array.from(results.values());
};
const resolveBookingStationId = (data) => toStringValue(data.StationId ??
    data.Station_ID ??
    data.stationId ??
    data.station_id ??
    data.Sation_ID ??
    data.SationId);
const resolveBookingFacilityId = (data) => toStringValue(data.Facility_ID ??
    data.FacilityId ??
    data.facilityId ??
    data.facility_id ??
    data.Facility);
const resolveBookingSlotLabel = (data, options) => normalizeSlotLabel(data.Slot ?? data.slot ?? data.ArrivalTime ?? data.arrivalTime, options);
const resolveBookingCompletedAtMs = (data) => {
    const iso = toIsoString(data.ServiceEndTime ??
        data.serviceEndTime ??
        data.UpdatedAt ??
        data.updatedAt ??
        data.CreatedAt ??
        data.createdAt ??
        data.Timestamp ??
        data.timestamp);
    if (!iso)
        return undefined;
    const ms = new Date(iso).getTime();
    return Number.isFinite(ms) ? ms : undefined;
};
const buildMm1Recommendations = (input) => {
    const stationIds = input.stations.map((station) => station.id);
    const stationIdSet = new Set(stationIds);
    const requestedSlot = normalizeSlotLabel(input.slot, { timeZone: input.timeZone });
    const windowDays = 7;
    const windowHours = windowDays * 24;
    const maxTheoreticalWqMin = 10_000;
    return (async () => {
        const sevenDaysAgo = firestore_1.Timestamp.fromMillis(Date.now() - windowDays * 24 * 60 * 60 * 1000);
        const sinceMs = sevenDaysAgo.toMillis();
        const [activeCounts, bookingDocs] = await Promise.all([
            fetchActiveQueueCountsByStation(stationIds),
            fetchRecentBookings(sevenDaysAgo),
        ]);
        const bookingsCountByStation = new Map();
        for (const doc of bookingDocs) {
            const data = doc.data();
            if (input.facilityId) {
                const fac = resolveBookingFacilityId(data);
                if (fac && fac !== input.facilityId)
                    continue;
            }
            const rawStatus = String(data.Booking_Status ?? data.status ?? '').toLowerCase();
            const isCompleted = rawStatus === 'completed' || rawStatus === 'complete';
            if (!isCompleted)
                continue;
            const completedAtMs = resolveBookingCompletedAtMs(data);
            if (completedAtMs === undefined || completedAtMs < sinceMs)
                continue;
            const stationId = resolveBookingStationId(data);
            if (!stationId)
                continue;
            if (!stationIdSet.has(stationId))
                continue;
            if (requestedSlot) {
                const bookingSlot = resolveBookingSlotLabel(data, { timeZone: input.timeZone });
                if (!bookingSlot || bookingSlot !== requestedSlot)
                    continue;
            }
            bookingsCountByStation.set(stationId, (bookingsCountByStation.get(stationId) ?? 0) + 1);
        }
        const stations = [];
        for (const station of input.stations) {
            const stationId = station.id;
            const avgServiceTimeMin = getStationAvgServiceTimeMin(station);
            const waitingCount = activeCounts.waiting.get(stationId) ?? 0;
            const servicingCount = activeCounts.servicing.get(stationId) ?? 0;
            // Real-time hybrid model:
            // TotalWaiting(min) = (ActiveJobs × AvgServiceTimeMin) + Wq(min)
            //
            // We normalize λ over the whole window (days × 24 hours) to keep units consistent
            // with μ = 60 / AvgServiceTimeMin (jobs/hour) and keep Wq as a baseline term.
            const lambda = (bookingsCountByStation.get(stationId) ?? 0) / windowHours; // jobs/hour
            const mu = 60 / avgServiceTimeMin; // jobs/hour
            let wqMin = 0;
            if (lambda > 0 && mu > 0) {
                if (lambda >= mu) {
                    wqMin = maxTheoreticalWqMin;
                }
                else {
                    const wqHours = lambda / (mu * (mu - lambda));
                    wqMin = wqHours * 60;
                }
            }
            if (!Number.isFinite(wqMin) || wqMin < 0)
                wqMin = 0;
            if (wqMin > maxTheoreticalWqMin)
                wqMin = maxTheoreticalWqMin;
            const baseWaitingMin = (waitingCount + servicingCount) * avgServiceTimeMin;
            const totalWaitingMin = baseWaitingMin + wqMin;
            const predictedQueue = waitingCount + servicingCount;
            logger.info('------------------------------');
            logger.info(`Station: ${stationId}`);
            logger.info(`Avg Service Time (min): ${avgServiceTimeMin}`);
            logger.info(`Servicing: ${servicingCount}`);
            logger.info(`Waiting: ${waitingCount}`);
            logger.info(`Base Waiting (min): ${baseWaitingMin.toFixed(2)}`);
            logger.info(`Theoretical Wq (min): ${wqMin.toFixed(2)}`);
            logger.info(`TOTAL Waiting (min): ${totalWaitingMin.toFixed(2)}`);
            logger.info('------------------------------');
            stations.push({
                stationId,
                stationName: station.name,
                facilityId: station.facilityId,
                status: station.status,
                predictedWaitMin: totalWaitingMin,
                predictedPosition: predictedQueue + 1,
                predictedQueue,
                score: totalWaitingMin,
            });
        }
        stations.sort((a, b) => a.score - b.score);
        const best = stations[0];
        if (best) {
            logger.info('FINAL RECOMMENDATION');
            logger.info(`Best Station: ${best.stationId}`);
            logger.info(`Expected Waiting (min): ${best.predictedWaitMin.toFixed(2)}`);
            logger.info('==============================');
        }
        return {
            suggestedStationId: stations[0]?.stationId ?? null,
            stations,
        };
    })();
};
const fetchStationStatsByStationIds = async (stationIds, windowMinutes) => {
    if (!stationIds.length)
        return [];
    const refs = stationIds.map((stationId) => db.collection('StationStat').doc(`${stationId}_${windowMinutes}`));
    const snaps = await db.getAll(...refs);
    return snaps
        .filter((snap) => snap.exists)
        .map((snap) => mapStationStats(snap.id, snap.data()));
};
const fetchQueueEventsForFacilitySince = async (facilityId, sinceIso) => {
    const sinceMs = new Date(sinceIso).getTime();
    const filterSince = Number.isFinite(sinceMs) ? sinceMs : 0;
    const tryQuery = async (field) => {
        const query = db.collection('QueueEvent').where(field, '==', facilityId);
        const snap = await query.get();
        return snap.docs;
    };
    let docs = [];
    try {
        docs = await tryQuery('Facility_ID');
    }
    catch (err) {
        logger.debug('QueueEvent query by Facility_ID failed', err);
    }
    if (!docs.length) {
        try {
            docs = await tryQuery('facilityId');
        }
        catch (err) {
            logger.debug('QueueEvent query by facilityId failed', err);
        }
    }
    if (!docs.length) {
        const snap = await db.collection('QueueEvent').get();
        docs = snap.docs;
    }
    const events = docs.map((doc) => mapQueueEvent(doc.id, doc.data()));
    return events.filter((event) => {
        if (event.facilityId !== facilityId)
            return false;
        const ts = new Date(event.ts).getTime();
        return Number.isFinite(ts) && ts >= filterSince;
    });
};
const readBody = async (req) => {
    if (req.body && typeof req.body === 'object')
        return req.body;
    return null;
};
exports.getRecommendation = (0, https_1.onRequest)({ region: 'us-central1', cors: true }, async (req, res) => {
    try {
        const body = await readBody(req);
        const facilityId = toStringValue(body?.facilityId ?? req.query?.facilityId);
        const slot = toStringValue(body?.slot ?? body?.arrivalTime ?? req.query?.slot ?? req.query?.arrivalTime);
        const clientTimeZone = toStringValue(body?.clientTimeZone ?? body?.timeZone ?? req.query?.clientTimeZone ?? req.query?.timeZone);
        const carrierLat = toNumberValue(body?.carrierLat ?? req.query?.carrierLat);
        const carrierLng = toNumberValue(body?.carrierLng ?? req.query?.carrierLng);
        if (!slot) {
            res.status(400).json({ error: 'slot is required' });
            return;
        }
        const requestedSlot = normalizeSlotLabel(slot, { timeZone: clientTimeZone }) ?? slot;
        // Logging format mirrors the slides/screenshots for easier verification.
        logger.info('==============================');
        logger.info('NEW RECOMMENDATION REQUEST');
        logger.info(`Requested slot: ${requestedSlot}`);
        if (clientTimeZone)
            logger.info(`Client time zone: ${clientTimeZone}`);
        logger.info('==============================');
        const stations = facilityId ? await fetchStationsByFacility(facilityId) : await fetchAllStations();
        if (!stations.length) {
            res.status(404).json({ error: 'No stations found' });
            return;
        }
        const built = await buildMm1Recommendations({
            stations,
            slot,
            facilityId: facilityId ?? undefined,
            carrierLat: carrierLat ?? undefined,
            carrierLng: carrierLng ?? undefined,
            timeZone: clientTimeZone ?? undefined,
        });
        if (!built.suggestedStationId) {
            res.status(404).json({ error: 'No suitable station found' });
            return;
        }
        const payload = {
            ...built,
            recommendedStation: built.suggestedStationId ?? undefined,
            waitingTimeMin: built.stations[0]?.predictedWaitMin,
        };
        res.set('Cache-Control', 'no-store');
        res.status(200).json(payload);
    }
    catch (err) {
        logger.error('getRecommendation failed', err);
        res.status(500).json({ error: 'internal_error' });
    }
});
const normalizeBookingStatus = (value) => {
    const raw = String(value ?? '').toLowerCase();
    if (raw === 'pending' ||
        raw === 'confirmed' ||
        raw === 'arrived' ||
        raw === 'servicing' ||
        raw === 'completed' ||
        raw === 'cancelled') {
        return raw;
    }
    if (raw === 'active')
        return 'confirmed';
    if (raw === 'canceled')
        return 'cancelled';
    if (raw === 'complete')
        return 'completed';
    return 'pending';
};
const makeQueueEventDoc = (input) => ({
    Event_ID: input.id,
    Facility_ID: input.facilityId,
    Station_ID: input.stationId,
    Carrier_ID: input.carrierId,
    Booking_ID: input.bookingId ?? null,
    Type: input.type,
    Timestamp: input.ts ?? firestore_1.FieldValue.serverTimestamp(),
    UpdatedAt: firestore_1.FieldValue.serverTimestamp(),
});
const resolveQueueEntryIds = (data) => ({
    stationId: toStringValue(data.stationId ?? data.StationId ?? data.Station_ID ?? data.station_id ?? data.Sation_ID) ??
        'unknown',
    carrierId: toStringValue(data.carrierId ?? data.Carrier_ID ?? data.CarrierId) ?? 'unknown',
    bookingId: toStringValue(data.bookingId ?? data.Booking_ID ?? data.booking_id ?? data.BookingId) ?? null,
    facilityId: toStringValue(data.facilityId ??
        data.Facility_ID ??
        data.FacilityId ??
        data.facility_id ??
        data.Facility) ??
        undefined,
});
const resolveBookingIds = (data) => ({
    bookingId: toStringValue(data.Booking_ID ?? data.bookingId ?? data.id) ?? undefined,
    stationId: toStringValue(data.StationId ?? data.Station_ID ?? data.stationId ?? data.station_id ?? data.Sation_ID) ??
        undefined,
    carrierId: toStringValue(data.Carrier_ID ?? data.carrierId) ?? undefined,
    facilityId: toStringValue(data.Facility_ID ??
        data.FacilityId ??
        data.facilityId ??
        data.facility_id ??
        data.Facility) ?? undefined,
});
exports.onBookingCompleted = (0, firestore_2.onDocumentUpdated)({ document: 'Booking/{bookingId}', region: 'europe-west3' }, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after)
        return;
    const beforeStatus = normalizeBookingStatus(before.Booking_Status ?? before.status);
    const afterStatus = normalizeBookingStatus(after.Booking_Status ?? after.status);
    if (beforeStatus === afterStatus || afterStatus !== 'completed')
        return;
    const bookingId = String(event.params.bookingId);
    const ids = resolveBookingIds(after);
    const stationId = ids.stationId ?? 'unknown';
    const carrierId = ids.carrierId ?? 'unknown';
    let facilityId = ids.facilityId ?? 'unknown';
    if (facilityId === 'unknown' && stationId !== 'unknown') {
        try {
            const stationSnap = await db.collection('Station').doc(stationId).get();
            if (stationSnap.exists) {
                const station = mapStation(stationSnap.id, stationSnap.data());
                if (station.facilityId && station.facilityId !== 'unknown')
                    facilityId = station.facilityId;
            }
        }
        catch (err) {
            logger.debug('Station lookup for Booking failed', err);
        }
    }
    const servicingSnap = await db
        .collection('QueueEntry')
        .where('stationId', '==', stationId)
        .where('status', '==', 'Servicing')
        .get()
        .catch(() => ({ empty: true, docs: [] }));
    const waitingSnap = await db
        .collection('QueueEntry')
        .where('stationId', '==', stationId)
        .where('status', '==', 'Waiting')
        .get()
        .catch(() => ({ empty: true, docs: [] }));
    const servicingDoc = servicingSnap.empty
        ? null
        : servicingSnap.docs.find((doc) => doc.data()?.bookingId === bookingId) ?? servicingSnap.docs[0];
    const waitingDoc = waitingSnap.empty
        ? null
        : waitingSnap.docs
            .map((doc) => {
            const data = doc.data();
            const createdAt = data.createdAt?.toDate?.()?.getTime() ??
                data.CreatedAt?.toDate?.()?.getTime() ??
                Number.POSITIVE_INFINITY;
            return { doc, createdAt };
        })
            .sort((a, b) => a.createdAt - b.createdAt)[0]?.doc ?? null;
    await db.runTransaction(async (tx) => {
        const bookingRef = db.collection('Booking').doc(bookingId);
        const stationRef = db.collection('Station').doc(stationId);
        const bookingSnap = await tx.get(bookingRef);
        const stationSnap = await tx.get(stationRef);
        const booking = bookingSnap.data() ?? {};
        const station = stationSnap.exists ? mapStation(stationSnap.id, stationSnap.data()) : null;
        const endTs = firestore_1.Timestamp.now();
        tx.update(bookingRef, { ServiceEndTime: endTs, UpdatedAt: firestore_1.FieldValue.serverTimestamp() });
        const serviceStartIso = toIsoString(booking.ServiceStartTime ?? booking.serviceStartTime);
        if (serviceStartIso && station) {
            const startMs = new Date(serviceStartIso).getTime();
            const endMs = endTs.toDate().getTime();
            const serviceTimeMin = (endMs - startMs) / 60000;
            if (Number.isFinite(serviceTimeMin) && serviceTimeMin > 0) {
                const total = (safeNumber(station.totalServiceTimeMin) ?? 0) + serviceTimeMin;
                const count = (safeNumber(station.completedJobsCount) ?? 0) + 1;
                tx.set(stationRef, {
                    totalServiceTimeMin: total,
                    completedJobsCount: count,
                    avgServiceTimeMin: total / count,
                    UpdatedAt: firestore_1.FieldValue.serverTimestamp(),
                }, { merge: true });
            }
        }
        if (servicingDoc) {
            tx.set(servicingDoc.ref, { status: 'Completed', updatedAt: firestore_1.FieldValue.serverTimestamp() }, { merge: true });
        }
        if (waitingDoc) {
            const nextQueue = waitingDoc;
            const nextData = nextQueue.data();
            const nextBookingId = toStringValue(nextData.bookingId ?? nextData.Booking_ID ?? nextData.booking_id) ?? null;
            tx.set(nextQueue.ref, { status: 'Servicing', updatedAt: firestore_1.FieldValue.serverTimestamp() }, { merge: true });
            if (nextBookingId) {
                tx.set(db.collection('Booking').doc(nextBookingId), {
                    Booking_Status: 'Servicing',
                    ServiceStartTime: firestore_1.FieldValue.serverTimestamp(),
                    UpdatedAt: firestore_1.FieldValue.serverTimestamp(),
                }, { merge: true });
            }
        }
    });
    const serviceEndEventId = `${bookingId}_service_end`;
    await db.collection('QueueEvent').doc(serviceEndEventId).set(makeQueueEventDoc({
        id: serviceEndEventId,
        facilityId,
        stationId,
        carrierId,
        bookingId,
        type: 'service_end',
        ts: new Date(),
    }), { merge: true });
    if (waitingDoc) {
        const nextData = waitingDoc.data();
        const nextBookingId = toStringValue(nextData.bookingId ?? nextData.Booking_ID ?? nextData.booking_id) ?? null;
        const nextCarrierId = toStringValue(nextData.carrierId ?? nextData.Carrier_ID ?? nextData.carrierId) ?? carrierId;
        const startEventId = `${waitingDoc.id}_service_start`;
        await db.collection('QueueEvent').doc(startEventId).set(makeQueueEventDoc({
            id: startEventId,
            facilityId,
            stationId,
            carrierId: nextCarrierId,
            bookingId: nextBookingId,
            type: 'service_start',
            ts: new Date(),
        }), { merge: true });
    }
});
exports.onQueueEntryCreated = (0, firestore_2.onDocumentCreated)({ document: 'QueueEntry/{queueEntryId}', region: 'us-central1', maxInstances: 20 }, async (event) => {
    const snap = event.data;
    const data = snap?.data();
    if (!snap || !data)
        return;
    const queueEntryId = String(event.params.queueEntryId);
    const ids = resolveQueueEntryIds(data);
    const stationId = ids.stationId;
    const carrierId = ids.carrierId;
    const bookingId = ids.bookingId;
    let facilityId = ids.facilityId;
    if (!facilityId && stationId !== 'unknown') {
        try {
            const stationSnap = await db.collection('Station').doc(stationId).get();
            if (stationSnap.exists) {
                const station = mapStation(stationSnap.id, stationSnap.data());
                if (station.facilityId && station.facilityId !== 'unknown')
                    facilityId = station.facilityId;
            }
        }
        catch (err) {
            logger.debug('Station lookup for QueueEntry failed', err);
        }
    }
    const status = normalizeQueueEntryStatus(data.status ?? data.Status) ?? 'Waiting';
    const canonical = {
        stationId,
        carrierId,
        bookingId,
        facilityId: facilityId ?? null,
        status,
    };
    if (!data.createdAt && !data.CreatedAt) {
        canonical.createdAt = firestore_1.FieldValue.serverTimestamp();
    }
    await snap.ref.set(canonical, { merge: true });
    const resolvedFacilityId = facilityId ?? 'unknown';
    const joinedEventId = `${queueEntryId}_queue_joined`;
    await db.collection('QueueEvent').doc(joinedEventId).set(makeQueueEventDoc({
        id: joinedEventId,
        facilityId: resolvedFacilityId,
        stationId,
        carrierId,
        bookingId,
        type: 'queue_joined',
        ts: new Date(),
    }), { merge: true });
    const servicingSnap = await db
        .collection('QueueEntry')
        .where('stationId', '==', stationId)
        .where('status', '==', 'Servicing')
        .limit(1)
        .get();
    if (!servicingSnap.empty)
        return;
    const waitingSnap = await db
        .collection('QueueEntry')
        .where('stationId', '==', stationId)
        .where('status', '==', 'Waiting')
        .get();
    if (waitingSnap.empty)
        return;
    const nextQueue = waitingSnap.docs
        .map((doc) => {
        const d = doc.data();
        const createdAt = d.createdAt?.toDate?.()?.getTime() ??
            d.CreatedAt?.toDate?.()?.getTime() ??
            Number.POSITIVE_INFINITY;
        return { doc, createdAt };
    })
        .sort((a, b) => a.createdAt - b.createdAt)[0]?.doc;
    if (!nextQueue)
        return;
    const nextBookingId = toStringValue(nextQueue.data()?.bookingId) ?? null;
    await db.runTransaction(async (tx) => {
        const stillServicing = await tx.get(db.collection('QueueEntry').where('stationId', '==', stationId).where('status', '==', 'Servicing').limit(1));
        if (!stillServicing.empty)
            return;
        tx.set(nextQueue.ref, { status: 'Servicing', updatedAt: firestore_1.FieldValue.serverTimestamp() }, { merge: true });
        if (nextBookingId) {
            tx.set(db.collection('Booking').doc(nextBookingId), {
                Booking_Status: 'Servicing',
                ServiceStartTime: firestore_1.FieldValue.serverTimestamp(),
                UpdatedAt: firestore_1.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
    });
    const startEventId = `${nextQueue.id}_service_start`;
    await db.collection('QueueEvent').doc(startEventId).set(makeQueueEventDoc({
        id: startEventId,
        facilityId: resolvedFacilityId,
        stationId,
        carrierId: toStringValue(nextQueue.data()?.carrierId) ?? carrierId,
        bookingId: nextBookingId,
        type: 'service_start',
        ts: new Date(),
    }), { merge: true });
});
