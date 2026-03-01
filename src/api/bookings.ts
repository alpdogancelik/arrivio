import { USE_MOCK_DATA } from '@/config/mock';
import type { Booking, BookingPredictedStatus, BookingStatus } from '@/types/api';
import {
  cancelMockBooking,
  completeMockBooking,
  createMockBooking,
  getMockBooking,
  listMockBookings,
  updateMockBooking,
} from '@/mock/data';
import { fetchQueueEvents } from '@/api/queue-events';
import { fetchStationStats } from '@/api/station-stats';
import { fetchStations } from '@/api/stations';
import { auth, db } from '@/services/firebase';
import { DEFAULT_ACTIVE_QUEUE_LOOKBACK_MINUTES, computePrediction, countActiveQueueByStation } from '@/utils/recommendation';
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

const ensureDb = () => {
  if (!db) {
    throw new Error('Firestore is disabled');
  }
  return db;
};

const ensureUser = () => {
  const user = auth?.currentUser;
  if (!user?.uid) {
    throw new Error('You must be logged in to perform this action.');
  }
  return user;
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

const normalizeBookingStatus = (value: unknown): BookingStatus => {
  const raw = String(value ?? '').toLowerCase();
  if (
    raw === 'pending' ||
    raw === 'confirmed' ||
    raw === 'arrived' ||
    raw === 'servicing' ||
    raw === 'completed' ||
    raw === 'cancelled'
  ) {
    return raw as BookingStatus;
  }
  if (raw === 'active') return 'confirmed';
  if (raw === 'serving' || raw === 'inservice' || raw === 'in_service') return 'servicing';
  if (raw === 'canceled') return 'cancelled';
  if (raw === 'complete') return 'completed';
  return 'pending';
};

const mapBooking = (id: string, data: Record<string, any>): Booking => {
  const arrivalTime = toIsoString(data.ArrivalTime ?? data.arrivalTime) ?? new Date().toISOString();
  const slot = toStringValue(data.Slot ?? data.slot);
  return {
    id: toStringValue(data.Booking_ID) ?? id,
    facilityId:
      toStringValue(
        data.Facility_ID ??
          data.FacilityId ??
          data.FacilityID ??
          data.facilityId ??
          data.facilityID ??
          data.facility_id ??
          data.Facility,
      ) ?? 'unknown',
    facilityName: toStringValue(
      data.Facility_Name ?? data.FacilityName ?? data.facilityName ?? data.facility_name,
    ),
    stationId:
      toStringValue(
        data.Station_ID ??
          data.StationId ??
          data.StationID ??
          data.stationId ??
          data.stationID ??
          data.station_id ??
          data.Sation_ID ??
          data.SationId ??
          data.SationID,
      ) ?? 'unknown',
    stationName: toStringValue(
      data.Station_Name ?? data.StationName ?? data.stationName ?? data.station_name,
    ),
    arrivalTime,
    slot: slot ?? undefined,
    etaMinutes: toNumberValue(data.EtaMinutes ?? data.etaMinutes),
    status: normalizeBookingStatus(data.Booking_Status ?? data.status),
    recommendedStationId: toStringValue(
      data.RecommendedStationId ?? data.recommendedStationId ?? data.RecommendedStation_ID,
    ),
    recommendedWaitMin: toNumberValue(data.RecommendedWaitMin ?? data.recommendedWaitMin),
    recommendations: Array.isArray(data.Recommendations ?? data.recommendations)
      ? (data.Recommendations ?? data.recommendations)
      : undefined,
    serviceStartTime: toIsoString(data.ServiceStartTime ?? data.serviceStartTime),
    serviceEndTime: toIsoString(data.ServiceEndTime ?? data.serviceEndTime),
    createdAt: toIsoString(data.CreatedAt ?? data.createdAt),
    updatedAt: toIsoString(data.UpdatedAt ?? data.updatedAt),
  };
};

export type ListBookingsParams = { status?: BookingStatus | 'all' };
export type CreateBookingPayload = {
  facilityId: string;
  stationId?: string;
  arrivalTime: string; // ISO string
  slot?: string;
  notes?: string;
  facilityName?: string;
  stationName?: string;
  recommendedStationId?: string;
  recommendedWaitMin?: number;
  recommendations?: Booking['recommendations'];
};

export type UpdateBookingPayload = Partial<Pick<CreateBookingPayload, 'arrivalTime' | 'stationId' | 'notes'>>;

export const fetchBookings = async (params?: ListBookingsParams) => {
  if (USE_MOCK_DATA) return Promise.resolve(listMockBookings(params));

  const database = ensureDb();
  const snapshot = await getDocs(collection(database, 'Booking'));
  let bookings = snapshot.docs.map((docSnap) => mapBooking(docSnap.id, docSnap.data() as Record<string, any>));

  const myUid = auth?.currentUser?.uid;
  if (myUid) {
    bookings = bookings.filter((booking, idx) => {
      const raw = snapshot.docs[idx]?.data?.() as Record<string, any> | undefined;
      const carrierId =
        toStringValue(raw?.Carrier_ID ?? raw?.carrierId ?? raw?.CarrierId ?? raw?.carrierID) ?? undefined;
      return carrierId ? carrierId === myUid : true;
    });
  }

  const status = params?.status;
  if (status && status !== 'all') {
    bookings = bookings.filter((booking) => booking.status === status);
  }

  return bookings;
};

export const fetchBooking = async (id: string) => {
  if (USE_MOCK_DATA) return Promise.resolve(getMockBooking(id));

  const database = ensureDb();
  const snap = await getDoc(doc(database, 'Booking', id));
  if (!snap.exists()) {
    throw new Error('Booking not found');
  }

  return mapBooking(snap.id, snap.data() as Record<string, any>);
};

export const createBooking = async (payload: CreateBookingPayload) => {
  if (USE_MOCK_DATA) return Promise.resolve(createMockBooking(payload));

  const database = ensureDb();
  const user = ensureUser();
  const ref = doc(collection(database, 'Booking'));
  const arrivalDate = new Date(payload.arrivalTime);
  const arrival = Number.isNaN(arrivalDate.getTime()) ? new Date() : arrivalDate;

  // Slot is stored as an hour range string (e.g. "10-11"). This allows the backend
  // to compute historical arrival rates per-slot without relying on timezone parsing.
  const derivedSlot = `${arrival.getHours()}-${(arrival.getHours() + 1) % 24}`;
  const slot = payload.slot ?? derivedSlot;

  const data = {
    Booking_ID: ref.id,
    Booking_Status: 'Pending',
    ArrivalTime: arrival,
    Slot: slot,
    Facility_ID: payload.facilityId,
    Facility_Name: payload.facilityName ?? null,
    Station_ID: payload.stationId ?? null,
    StationId: payload.stationId ?? null,
    Station_Name: payload.stationName ?? null,
    Carrier_ID: user.uid,
    carrierId: user.uid,
    Notes: payload.notes ?? null,
    RecommendedStationId: payload.recommendedStationId ?? null,
    RecommendedWaitMin: payload.recommendedWaitMin ?? null,
    Recommendations: payload.recommendations ?? null,
    CreatedAt: serverTimestamp(),
    UpdatedAt: serverTimestamp(),
  };

  await setDoc(ref, data);

  return mapBooking(ref.id, {
    ...data,
    ArrivalTime: arrival.toISOString(),
    Booking_Status: data.Booking_Status,
    Slot: slot,
  });
};

export const updateBooking = async (id: string, payload: UpdateBookingPayload) => {
  if (USE_MOCK_DATA) return Promise.resolve(updateMockBooking(id, payload));

  const database = ensureDb();
  ensureUser();
  const updates: Record<string, any> = { UpdatedAt: serverTimestamp() };

  if (payload.arrivalTime) {
    const arrival = new Date(payload.arrivalTime);
    updates.ArrivalTime = Number.isNaN(arrival.getTime()) ? new Date() : arrival;
  }
  if (payload.stationId) {
    updates.Station_ID = payload.stationId;
  }
  if (typeof payload.notes !== 'undefined') {
    updates.Notes = payload.notes;
  }

  await updateDoc(doc(database, 'Booking', id), updates);
  const snap = await getDoc(doc(database, 'Booking', id));
  if (!snap.exists()) {
    throw new Error('Booking not found');
  }

  return mapBooking(snap.id, snap.data() as Record<string, any>);
};

export const cancelBooking = async (id: string, _reason?: string) => {
  if (USE_MOCK_DATA) return Promise.resolve(cancelMockBooking(id));

  const database = ensureDb();
  ensureUser();
  await updateDoc(doc(database, 'Booking', id), {
    Booking_Status: 'Cancelled',
    UpdatedAt: serverTimestamp(),
  });
  const snap = await getDoc(doc(database, 'Booking', id));
  if (!snap.exists()) {
    throw new Error('Booking not found');
  }
  return mapBooking(snap.id, snap.data() as Record<string, any>);
};

export const completeBooking = async (id: string) => {
  if (USE_MOCK_DATA) return Promise.resolve(completeMockBooking(id));

  const database = ensureDb();
  await updateDoc(doc(database, 'Booking', id), {
    Booking_Status: 'Completed',
    UpdatedAt: serverTimestamp(),
  });
  const snap = await getDoc(doc(database, 'Booking', id));
  if (!snap.exists()) {
    throw new Error('Booking not found');
  }
  return mapBooking(snap.id, snap.data() as Record<string, any>);
};

export const fetchBookingPredictedStatus = async (id: string): Promise<BookingPredictedStatus> => {
  const booking = await fetchBooking(id);
  const now = new Date();
  const lookbackMinutes = DEFAULT_ACTIVE_QUEUE_LOOKBACK_MINUTES;
  const sinceIso = new Date(now.getTime() - lookbackMinutes * 60000).toISOString();

  const [stations, stats, events] = await Promise.all([
    fetchStations(booking.facilityId),
    fetchStationStats([booking.stationId]),
    fetchQueueEvents({ facilityId: booking.facilityId, stationId: booking.stationId, since: sinceIso }),
  ]);

  const station = stations.find((item) => item.id === booking.stationId);
  const currentQueue =
    countActiveQueueByStation(events, { now, lookbackMinutes }).get(booking.stationId) ?? 0;
  const stat = stats[0];

  const prediction = computePrediction({
    arrivalTime: booking.arrivalTime,
    now,
    currentQueue,
    avgServiceSec: stat?.avgServiceSec,
    lambdaPerMin: stat?.lambdaPerMin,
    servers: station?.servers,
  });

  const arrivalMs = new Date(booking.arrivalTime).getTime();
  const arrivalTime = Number.isFinite(arrivalMs) ? arrivalMs : now.getTime();
  const serviceStartEta = new Date(arrivalTime + prediction.predictedWaitMin * 60000).toISOString();

  return {
    bookingId: booking.id,
    stationId: booking.stationId,
    predictedWaitMin: prediction.predictedWaitMin,
    predictedPosition: prediction.predictedPosition,
    predictedQueue: prediction.predictedQueue,
    serviceStartEta,
    updatedAt: now.toISOString(),
  };
};
