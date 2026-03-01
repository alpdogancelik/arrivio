import { appConfig } from '@/config';
import { StationRecommendationResponseSchema, type StationRecommendationResponse } from '@/types/api';
import { fetchQueueEntries } from '@/api/queue-entries';
import { fetchStations } from '@/api/stations';
import {
  buildStationRecommendations,
} from '@/utils/recommendation';
import { db } from '@/services/firebase';
import { collection, getDocs } from 'firebase/firestore';

export type StationRecommendationParams = {
  facilityId?: string;
  arrivalTime: string;
  // Explicit slot label (e.g. "10-11"). Prefer this over deriving from `arrivalTime`
  // to avoid timezone ambiguity when talking to the backend.
  slot?: string;
  carrierLat?: number;
  carrierLng?: number;
  // Kept for backward compatibility with earlier versions.
  windowMinutes?: number;
};

const ensureDb = () => {
  if (!db) {
    throw new Error('Firestore is disabled');
  }
  return db;
};

const toStringValue = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

const toIsoString = (value: any) => {
  if (!value) return undefined;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }
  if (value?.toDate) {
    try {
      return value.toDate().toISOString();
    } catch {
      return undefined;
    }
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return undefined;
};

const normalizeBookingStatus = (value: unknown) => {
  const raw = String(value ?? '').toLowerCase();
  if (raw === 'completed' || raw === 'complete') return 'completed';
  return raw;
};

const normalizeSlotLabel = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;
  // Accept "10-11" / "10:00-11:00" / "10 - 11" variants.
  const match = raw.match(/(\d{1,2})(?::\d{2})?\s*-\s*(\d{1,2})(?::\d{2})?/);
  if (!match) return undefined;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return undefined;
  if (start < 0 || start > 23 || end < 0 || end > 23) return undefined;
  return `${start}-${end}`;
};

const deriveSlotLabelFromIso = (iso: string) => {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return undefined;
  const d = new Date(ms);
  return `${d.getHours()}-${(d.getHours() + 1) % 24}`;
};

const fetchStationRecommendationFromFunction = async (
  params: StationRecommendationParams,
): Promise<StationRecommendationResponse> => {
  const url = appConfig.getRecommendationUrl;
  if (!url) {
    throw new Error('getRecommendationUrl is not configured');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      facilityId: params.facilityId,
      arrivalTime: params.arrivalTime,
      slot: params.slot ?? params.arrivalTime,
      carrierLat: params.carrierLat,
      carrierLng: params.carrierLng,
      windowMinutes: params.windowMinutes,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`getRecommendation failed (${response.status}): ${text || response.statusText}`);
  }

  const data = await response.json();
  const parsed = StationRecommendationResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error('getRecommendation returned an invalid payload');
  }
  return parsed.data;
};

export const fetchStationRecommendation = async (
  params: StationRecommendationParams,
): Promise<StationRecommendationResponse> => {
  if (appConfig.getRecommendationUrl) {
    try {
      return await fetchStationRecommendationFromFunction(params);
    } catch (err) {
      console.warn('Falling back to client-side station recommendation', err);
    }
  }

  const facilityId = params.facilityId;
  const slot = normalizeSlotLabel(params.slot) ?? deriveSlotLabelFromIso(params.arrivalTime);
  if (!slot) {
    throw new Error('Invalid slot');
  }

  const windowDays = 7;
  const sinceMs = Date.now() - windowDays * 24 * 60 * 60 * 1000;

  const stations = await fetchStations(facilityId);
  const stationIds = stations.map((station) => station.id);
  const stationIdSet = new Set(stationIds);

  const [queueEntries, bookingSnaps] = await Promise.all([
    fetchQueueEntries(),
    getDocs(collection(ensureDb(), 'Booking')),
  ]);

  const waiting = new Map<string, number>();
  const servicing = new Map<string, number>();
  for (const entry of queueEntries) {
    if (!entry.stationId || !stationIdSet.has(entry.stationId)) continue;
    const status = entry.status ?? 'Waiting';
    if (status === 'Servicing') {
      servicing.set(entry.stationId, (servicing.get(entry.stationId) ?? 0) + 1);
    } else if (status === 'Waiting') {
      waiting.set(entry.stationId, (waiting.get(entry.stationId) ?? 0) + 1);
    }
  }

  const completedBookingsByStation = new Map<string, number>();
  for (const docSnap of bookingSnaps.docs) {
    const data = docSnap.data() as Record<string, any>;

    if (facilityId) {
      const bookingFacilityId =
        toStringValue(
          data.Facility_ID ??
            data.FacilityId ??
            data.facilityId ??
            data.facility_id ??
            data.Facility,
        ) ?? undefined;
      if (bookingFacilityId && bookingFacilityId !== facilityId) continue;
    }

    const status = normalizeBookingStatus(data.Booking_Status ?? data.status);
    if (status !== 'completed') continue;

    const completedAtIso = toIsoString(data.ServiceEndTime ?? data.serviceEndTime ?? data.UpdatedAt ?? data.updatedAt);
    const completedAtMs = completedAtIso ? new Date(completedAtIso).getTime() : NaN;
    if (!Number.isFinite(completedAtMs) || completedAtMs < sinceMs) continue;

    const stationId =
      toStringValue(
        data.Station_ID ??
          data.StationId ??
          data.stationId ??
          data.station_id ??
          data.Sation_ID ??
          data.SationId,
      ) ?? undefined;
    if (!stationId || !stationIdSet.has(stationId)) continue;

    const bookingSlot =
      normalizeSlotLabel(data.Slot ?? data.slot) ??
      (toIsoString(data.ArrivalTime ?? data.arrivalTime)
        ? deriveSlotLabelFromIso(toIsoString(data.ArrivalTime ?? data.arrivalTime) ?? '')
        : undefined);

    if (bookingSlot !== slot) continue;

    completedBookingsByStation.set(stationId, (completedBookingsByStation.get(stationId) ?? 0) + 1);
  }

  const stationsWithScores = buildStationRecommendations({
    stations,
    slot,
    activeQueueByStation: { waiting, servicing },
    completedBookingsByStation,
    windowDays,
  });

  return {
    suggestedStationId: stationsWithScores.suggestedStationId,
    stations: stationsWithScores.stations,
    windowMinutes: windowDays * 24 * 60,
  };
};
