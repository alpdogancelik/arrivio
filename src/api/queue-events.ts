import { db } from '@/services/firebase';
import { USE_MOCK_DATA } from '@/config/mock';
import type { QueueEvent, QueueEventType } from '@/types/api';
import { createMockQueueEvent, listMockQueueEvents } from '@/mock/data';
import { collection, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';

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

const normalizeEventType = (value: unknown): QueueEventType => {
  const raw = String(value ?? '').toLowerCase();
  if (raw.includes('join')) return 'queue_joined';
  if (raw.includes('start')) return 'service_start';
  if (raw.includes('end')) return 'service_end';
  if (raw === 'queue_joined' || raw === 'service_start' || raw === 'service_end') return raw as QueueEventType;
  return 'queue_joined';
};

const mapQueueEvent = (id: string, data: Record<string, any>): QueueEvent => ({
  id: toStringValue(data.Event_ID ?? data.EventId ?? data.QueueEvent_ID ?? data.QueueEventId ?? data.id) ?? id,
  facilityId:
    toStringValue(
      data.Facility_ID ??
        data.facilityId ??
        data.FacilityId ??
        data.facilityID ??
        data.FacilityID ??
        data.facility_id,
    ) ?? 'unknown',
  stationId:
    toStringValue(
      data.Station_ID ??
        data.stationId ??
        data.StationId ??
        data.stationID ??
        data.StationID ??
        data.station_id,
    ) ?? 'unknown',
  carrierId:
    toStringValue(
      data.Carrier_ID ??
        data.carrierId ??
        data.CarrierId ??
        data.carrierID ??
        data.carrier_id,
    ) ?? 'unknown',
  bookingId: toStringValue(data.Booking_ID ?? data.bookingId ?? data.booking_id),
  type: normalizeEventType(data.Type ?? data.type ?? data.EventType ?? data.eventType),
  ts: toIsoString(data.Timestamp ?? data.ts ?? data.TS ?? data.createdAt ?? data.CreatedAt) ?? new Date().toISOString(),
});

export type CreateQueueEventPayload = Omit<QueueEvent, 'id' | 'ts'> & { ts?: string };

export type ListQueueEventParams = {
  facilityId?: string;
  stationId?: string;
  carrierId?: string;
  bookingId?: string;
  since?: string;
};

export const fetchQueueEvents = async (params?: ListQueueEventParams) => {
  if (USE_MOCK_DATA) {
    return listMockQueueEvents(params);
  }

  const database = ensureDb();
  const snapshot = await getDocs(collection(database, 'QueueEvent'));
  let events = snapshot.docs.map((docSnap) => mapQueueEvent(docSnap.id, docSnap.data() as Record<string, any>));

  if (params?.facilityId) {
    events = events.filter((event) => event.facilityId === params.facilityId);
  }
  if (params?.stationId) {
    events = events.filter((event) => event.stationId === params.stationId);
  }
  if (params?.carrierId) {
    events = events.filter((event) => event.carrierId === params.carrierId);
  }
  if (params?.bookingId) {
    events = events.filter((event) => event.bookingId === params.bookingId);
  }
  if (params?.since) {
    const sinceMs = new Date(params.since).getTime();
    if (!Number.isNaN(sinceMs)) {
      events = events.filter((event) => {
        const ts = new Date(event.ts).getTime();
        return Number.isFinite(ts) && ts >= sinceMs;
      });
    }
  }

  return events;
};

export const createQueueEvent = async (payload: CreateQueueEventPayload) => {
  if (USE_MOCK_DATA) {
    return createMockQueueEvent(payload);
  }

  const database = ensureDb();
  const ref = doc(collection(database, 'QueueEvent'));
  const ts = payload.ts ? new Date(payload.ts) : null;

  const data = {
    Event_ID: ref.id,
    Facility_ID: payload.facilityId,
    Station_ID: payload.stationId,
    Carrier_ID: payload.carrierId,
    Booking_ID: payload.bookingId ?? null,
    Type: payload.type,
    Timestamp: ts ?? serverTimestamp(),
  };

  await setDoc(ref, data);

  return mapQueueEvent(ref.id, {
    ...data,
    Timestamp: ts ? ts.toISOString() : new Date().toISOString(),
  });
};
