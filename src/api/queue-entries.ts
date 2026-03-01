import { db } from '@/services/firebase';
import { USE_MOCK_DATA } from '@/config/mock';
import type { QueueEntry } from '@/types/api';
import { collection, getDocs } from 'firebase/firestore';

const ensureDb = () => {
  if (!db) {
    throw new Error('Firestore is disabled');
  }
  return db;
};

const toStringValue = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

const toNumberValue = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const normalizeQueueEntryStatus = (value: unknown) => {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return undefined;
  if (raw === 'waiting') return 'Waiting';
  if (raw === 'servicing' || raw === 'serving' || raw === 'inservice' || raw === 'in_service') return 'Servicing';
  if (raw === 'completed' || raw === 'done') return 'Completed';
  return undefined;
};

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

const diffMinutes = (start?: any, end?: any) => {
  const startIso = toIsoString(start);
  const endIso = toIsoString(end);
  if (!startIso || !endIso) return undefined;
  const delta = (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000;
  return Number.isFinite(delta) ? Math.max(0, Math.round(delta)) : undefined;
};

const mapQueueEntry = (id: string, data: Record<string, any>): QueueEntry => {
  const entryTime = toIsoString(data.EntryTime ?? data.entryTime ?? data.Entry_Time);
  const exitTime = toIsoString(data.ExitTime ?? data.exitTime ?? data.Exit_Time);
  const serviceTime = data.ServiceTime ?? data.serviceTime ?? data.Service_Time;
  const waitingTime = data.WaitingTime ?? data.waitingTime ?? data.Waiting_Time;

  const waitingMinutes =
    toNumberValue(waitingTime) ??
    toNumberValue(data.WaitingMinutes ?? data.waitingMinutes) ??
    diffMinutes(entryTime, waitingTime) ??
    diffMinutes(entryTime, serviceTime) ??
    diffMinutes(entryTime, exitTime);

  const serviceMinutes =
    toNumberValue(serviceTime) ??
    toNumberValue(data.ServiceMinutes ?? data.serviceMinutes) ??
    diffMinutes(waitingTime, exitTime) ??
    diffMinutes(serviceTime, exitTime);

  return {
    id: toStringValue(data.Queue_ID ?? data.QueueId ?? data.id) ?? id,
    carrierId: toStringValue(data.Carrier_ID ?? data.carrierId ?? data.CarrierId),
    facilityId:
      toStringValue(
        data.facilityId ??
          data.Facility_ID ??
          data.FacilityId ??
          data.facility_id ??
          data.Facility,
      ) ?? null,
    stationId: toStringValue(
      data.Station_ID ?? data.stationId ?? data.StationId ?? data.Sation_ID ?? data.SationId,
    ),
    bookingId: toStringValue(data.Booking_ID ?? data.bookingId ?? data.booking_id) ?? null,
    status: normalizeQueueEntryStatus(data.Status ?? data.status),
    entryTime,
    exitTime,
    waitingMinutes,
    serviceMinutes,
    createdAt: toIsoString(data.CreatedAt ?? data.createdAt ?? data.Timestamp),
    updatedAt: toIsoString(data.UpdatedAt ?? data.updatedAt),
  };
};

export type ListQueueEntryParams = {
  stationId?: string;
  carrierId?: string;
  bookingId?: string;
};

export const fetchQueueEntries = async (params?: ListQueueEntryParams) => {
  if (USE_MOCK_DATA) {
    return [] as QueueEntry[];
  }

  const database = ensureDb();
  const snapshot = await getDocs(collection(database, 'QueueEntry'));
  let entries = snapshot.docs.map((docSnap) => mapQueueEntry(docSnap.id, docSnap.data() as Record<string, any>));

  if (params?.stationId) {
    entries = entries.filter((entry) => entry.stationId === params.stationId);
  }
  if (params?.carrierId) {
    entries = entries.filter((entry) => entry.carrierId === params.carrierId);
  }
  if (params?.bookingId) {
    entries = entries.filter((entry) => entry.bookingId === params.bookingId);
  }

  return entries;
};
