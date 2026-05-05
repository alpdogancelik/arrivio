import type { Booking, BookingStatus } from '@/types/api';
import { auth, db } from '@/services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

const ensureDb = () => {
  if (!db) {
    throw new Error('Firestore is disabled');
  }
  return db;
};

const waitForUser = (timeoutMs = 5000) =>
  new Promise<NonNullable<typeof auth>['currentUser']>((resolve) => {
    const authClient = auth;
    if (!authClient) {
      resolve(null);
      return;
    }

    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = onAuthStateChanged(authClient, (user) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      unsubscribe();
      resolve(user);
    });

    timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe();
      resolve(authClient.currentUser);
    }, timeoutMs);
  });

const ensureUser = async () => {
  const user = auth?.currentUser ?? (await waitForUser());
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
  const raw = String(value ?? '').trim().toLowerCase();
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
  if (raw === 'active' || raw === 'waiting' || raw === 'queued') return 'pending';
  if (raw === 'approved' || raw === 'accepted') return 'confirmed';
  if (
    raw === 'serving' ||
    raw === 'serviced' ||
    raw === 'inservice' ||
    raw === 'in_service' ||
    raw === 'in service' ||
    raw === 'inprogress' ||
    raw === 'in_progress' ||
    raw === 'in progress' ||
    raw === 'started' ||
    raw === 'processing'
  ) {
    return 'servicing';
  }
  if (raw === 'canceled') return 'cancelled';
  if (raw === 'complete' || raw === 'done' || raw === 'solved') return 'completed';
  return 'pending';
};

const resolveBookingStatus = (data: Record<string, any>): BookingStatus => {
  const candidates = [
    data.bookingStatus,
    data.bookingsStatus,
    data.Booking_Status,
    data.status,
    data.queueStatus,
  ];
  const normalized = candidates
    .filter((value) => typeof value !== 'undefined' && value !== null)
    .map(normalizeBookingStatus);

  if (normalized.includes('cancelled')) return 'cancelled';
  if (normalized.includes('completed')) return 'completed';

  return normalized.find((status) => status !== 'pending') ?? normalized[0] ?? 'pending';
};

const mapBooking = (id: string, data: Record<string, any>): Booking => {
  const arrivalTime =
    toIsoString(data.ArrivalTime ?? data.arrivalTime ?? data.queuedAt ?? data.slotStartAt) ??
    new Date().toISOString();
  const slot = toStringValue(data.Slot ?? data.slot ?? data.slotKey ?? data.slotId);
  return {
    id: toStringValue(data.Booking_ID) ?? id,
    firestoreId: id,
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
    status: resolveBookingStatus(data),
    recommendedStationId: toStringValue(
      data.RecommendedStationId ?? data.recommendedStationId ?? data.RecommendedStation_ID,
    ),
    recommendedWaitMin: toNumberValue(data.RecommendedWaitMin ?? data.recommendedWaitMin),
    recommendations: Array.isArray(data.Recommendations ?? data.recommendations)
      ? (data.Recommendations ?? data.recommendations)
      : undefined,
    serviceStartTime: toIsoString(data.ServiceStartTime ?? data.serviceStartTime ?? data.startedAt),
    serviceEndTime: toIsoString(data.ServiceEndTime ?? data.serviceEndTime ?? data.completedAt),
    createdAt: toIsoString(data.CreatedAt ?? data.createdAt ?? data.queuedAt),
    updatedAt: toIsoString(data.UpdatedAt ?? data.updatedAt ?? data.completedAt ?? data.startedAt),
  };
};

const getBookingSnapById = async (id: string) => {
  const database = ensureDb();
  const directRef = doc(database, 'Booking', id);
  const directSnap = await getDoc(directRef);

  if (directSnap.exists()) {
    return { ref: directRef, snap: directSnap };
  }

  const bookingCollection = collection(database, 'Booking');
  const byBookingId = await getDocs(query(bookingCollection, where('Booking_ID', '==', id), limit(1)));
  const matchedSnap = byBookingId.docs[0];

  if (matchedSnap) {
    return { ref: matchedSnap.ref, snap: matchedSnap };
  }

  return { ref: directRef, snap: directSnap };
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
  const database = ensureDb();
  const user = auth?.currentUser ?? (await waitForUser());
  const myUid = user?.uid;
  if (!myUid) {
    throw new Error('You must be logged in to view bookings.');
  }

  const bookingCollection = collection(database, 'Booking');
  const carrierIdFields = ['Carrier_ID', 'carrierId', 'CarrierId', 'carrierID', 'carrier_id'] as const;
  const snapshots = await Promise.all(
    carrierIdFields.map((field) => getDocs(query(bookingCollection, where(field, '==', myUid)))),
  );

  const deduped = new Map<string, Booking>();
  for (const snap of snapshots) {
    for (const docSnap of snap.docs) {
      deduped.set(docSnap.id, mapBooking(docSnap.id, docSnap.data() as Record<string, any>));
    }
  }

  let bookings = Array.from(deduped.values());

  const status = params?.status;
  if (status && status !== 'all') {
    bookings = bookings.filter((booking) => booking.status === status);
  }

  return bookings;
};

export const fetchBooking = async (id: string) => {
  const { snap } = await getBookingSnapById(id);
  if (!snap.exists()) {
    throw new Error('Booking not found');
  }

  return mapBooking(snap.id, snap.data() as Record<string, any>);
};

export const createBooking = async (payload: CreateBookingPayload) => {
  const database = ensureDb();
  const user = await ensureUser();
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
  await ensureUser();
  const { ref } = await getBookingSnapById(id);
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

  await updateDoc(ref, updates);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error('Booking not found');
  }

  return mapBooking(snap.id, snap.data() as Record<string, any>);
};

export const cancelBooking = async (id: string, _reason?: string) => {
  await ensureUser();
  const { ref } = await getBookingSnapById(id);
  await updateDoc(ref, {
    Booking_Status: 'Cancelled',
    UpdatedAt: serverTimestamp(),
  });

  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error('Booking not found');
  }
  return mapBooking(snap.id, snap.data() as Record<string, any>);
};

export const completeBooking = async (id: string) => {
  await ensureUser();
  const { ref } = await getBookingSnapById(id);
  await updateDoc(ref, {
    Booking_Status: 'Completed',
    UpdatedAt: serverTimestamp(),
  });
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error('Booking not found');
  }
  return mapBooking(snap.id, snap.data() as Record<string, any>);
};
