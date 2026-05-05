import { beforeEach, describe, expect, it, jest } from '@jest/globals';

/**
 * Firebase services are mocked because these are unit tests.
 * The purpose is not to test Firebase itself, but to verify whether the carrier
 * booking API creates, reads, updates, filters, and normalizes booking data correctly.
 */
const mockDb = { app: 'test-db' };
const mockAuth: { currentUser: { uid: string } | null } = {
  currentUser: { uid: 'carrier-1' },
};

/**
 * Small in-memory Firestore replacement used by the tests below.
 * This makes the tests stronger than returning hardcoded snapshots from getDocs,
 * because Firestore where filters are actually applied.
 */
let bookingRows: Array<{
  id: string;
  data: Record<string, any>;
}> = [];

const mockCollection = jest.fn((database: unknown, name: string) => ({
  __type: 'collection',
  database,
  name,
}));

const mockDoc = jest.fn((target: any, collectionName?: string, id?: string) => {
  /**
   * Handles doc(db, 'Booking', id)
   */
  if (typeof collectionName === 'string') {
    return {
      id: id ?? collectionName,
      collectionName,
      path: `${collectionName}/${id ?? collectionName}`,
    };
  }

  /**
   * Handles doc(collection(db, 'Booking'))
   * This is used when createBooking generates a new Firestore document.
   */
  return {
    id: 'booking-generated',
    collectionName: target.name,
    path: `${target.name}/booking-generated`,
  };
});

const mockGetDoc = jest.fn<(...args: any[]) => Promise<any>>();
const mockGetDocs = jest.fn<(...args: any[]) => Promise<any>>();
const mockLimit = jest.fn((count: number) => ({ __type: 'limit', count }));
const mockQuery = jest.fn((...args: unknown[]) => ({ __type: 'query', args }));
const mockServerTimestamp = jest.fn(() => ({ __type: 'serverTimestamp' }));
const mockSetDoc = jest.fn<(...args: any[]) => Promise<any>>();
const mockUpdateDoc = jest.fn<(...args: any[]) => Promise<any>>();
const mockWhere = jest.fn((field: string, operator: string, value: unknown) => ({
  __type: 'where',
  field,
  operator,
  value,
}));

const mockOnAuthStateChanged = jest.fn(
  (_authClient: unknown, callback: (user: unknown) => void) => {
    /**
     * The booking service waits for Firebase auth state when currentUser is missing.
     * Firebase auth listeners are asynchronous, so the mock keeps that behavior.
     */
    setTimeout(() => callback(mockAuth.currentUser), 0);
    return jest.fn();
  },
);

jest.mock('@/services/firebase', () => ({
  auth: mockAuth,
  db: mockDb,
}));

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: mockOnAuthStateChanged,
}));

jest.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  limit: mockLimit,
  query: mockQuery,
  serverTimestamp: mockServerTimestamp,
  setDoc: mockSetDoc,
  updateDoc: mockUpdateDoc,
  where: mockWhere,
}));

import {
  cancelBooking,
  completeBooking,
  createBooking,
  fetchBooking,
  fetchBookings,
  updateBooking,
} from '@/api/bookings';

const bookingRef = (id: string) => ({
  id,
  collectionName: 'Booking',
  path: `Booking/${id}`,
});

const docSnap = (id: string, data: Record<string, any>) => ({
  id,
  ref: bookingRef(id),
  data: () => data,
  exists: () => true,
});

const missingDocSnap = (id: string) => ({
  id,
  ref: bookingRef(id),
  data: () => ({}),
  exists: () => false,
});

const seedBooking = (id: string, data: Record<string, any>) => {
  bookingRows.push({ id, data: { ...data } });
};

const upsertBooking = (id: string, data: Record<string, any>) => {
  const existing = bookingRows.find((row) => row.id === id);

  if (existing) {
    existing.data = { ...existing.data, ...data };
    return;
  }

  bookingRows.push({ id, data: { ...data } });
};

const resolveDocsFromQuery = (target: any) => {
  const args = target?.__type === 'query' ? target.args : [target];
  const collectionRef = args[0];
  const collectionName = collectionRef?.name ?? collectionRef?.collectionName;

  if (collectionName !== 'Booking') {
    return [];
  }

  const whereClauses = args.filter((arg: any) => arg?.__type === 'where');
  const limitClause = args.find((arg: any) => arg?.__type === 'limit');

  let rows = bookingRows;

  for (const clause of whereClauses) {
    if (clause.operator !== '==') continue;
    rows = rows.filter((row) => row.data[clause.field] === clause.value);
  }

  if (limitClause?.count) {
    rows = rows.slice(0, limitClause.count);
  }

  return rows.map((row) => docSnap(row.id, row.data));
};

describe('carrier bookings api', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockAuth.currentUser = { uid: 'carrier-1' };
    bookingRows = [];

    mockGetDoc.mockImplementation(async (ref: { id: string }) => {
      const row = bookingRows.find((booking) => booking.id === ref.id);
      return row ? docSnap(row.id, row.data) : missingDocSnap(ref.id);
    });

    mockGetDocs.mockImplementation(async (target: any) => ({
      docs: resolveDocsFromQuery(target),
    }));

    mockSetDoc.mockImplementation(async (ref: { id: string }, data: Record<string, any>) => {
      upsertBooking(ref.id, data);
    });

    mockUpdateDoc.mockImplementation(async (ref: { id: string }, updates: Record<string, any>) => {
      upsertBooking(ref.id, updates);
    });
  });

  it('fetches only the current carrier bookings, removes duplicates, and normalizes status values', async () => {
    /**
     * This setup simulates the real Firestore compatibility problem in the project:
     * some booking documents use Carrier_ID, while newer ones may use carrierId.
     * fetchBookings should query all supported carrier id fields and deduplicate the result.
     */
    seedBooking('firestore-a', {
      Booking_ID: 'booking-a',
      Carrier_ID: 'carrier-1',
      carrierId: 'carrier-1',
      Facility_ID: 'facility-1',
      Station_ID: 'station-1',
      ArrivalTime: '2026-05-01T08:00:00.000Z',
      Booking_Status: 'approved',
    });

    seedBooking('firestore-b', {
      Booking_ID: 'booking-b',
      carrierId: 'carrier-1',
      Facility_ID: 'facility-1',
      Station_ID: 'station-2',
      ArrivalTime: '2026-05-01T09:00:00.000Z',
      Booking_Status: 'cancelled',
    });

    seedBooking('firestore-c', {
      Booking_ID: 'booking-c',
      carrierId: 'another-carrier',
      Facility_ID: 'facility-1',
      Station_ID: 'station-3',
      ArrivalTime: '2026-05-01T10:00:00.000Z',
      Booking_Status: 'approved',
    });

    const bookings = await fetchBookings({ status: 'confirmed' });

    /**
     * booking-a is returned once even though it matches multiple carrier id fields.
     * booking-b is removed by status filter.
     * booking-c belongs to another carrier and must not appear.
     */
    expect(bookings).toHaveLength(1);
    expect(bookings[0]).toMatchObject({
      id: 'booking-a',
      firestoreId: 'firestore-a',
      facilityId: 'facility-1',
      stationId: 'station-1',
      status: 'confirmed',
    });

    expect(mockWhere).toHaveBeenCalledWith('Carrier_ID', '==', 'carrier-1');
    expect(mockWhere).toHaveBeenCalledWith('carrierId', '==', 'carrier-1');
    expect(mockWhere).toHaveBeenCalledWith('CarrierId', '==', 'carrier-1');
    expect(mockWhere).toHaveBeenCalledWith('carrierID', '==', 'carrier-1');
    expect(mockWhere).toHaveBeenCalledWith('carrier_id', '==', 'carrier-1');
  });

  it('uses newer booking status fields when the legacy pending field is stale', async () => {
    seedBooking('firestore-in-progress', {
      Booking_ID: 'booking-in-progress',
      carrierId: 'carrier-1',
      Facility_ID: 'facility-1',
      Station_ID: 'station-1',
      ArrivalTime: '2026-05-06T08:00:00.000Z',
      Booking_Status: 'Pending',
      bookingsStatus: 'InProgress',
      queueStatus: 'InProgress',
    });

    const booking = await fetchBooking('firestore-in-progress');

    expect(booking).toMatchObject({
      id: 'booking-in-progress',
      firestoreId: 'firestore-in-progress',
      status: 'servicing',
    });
  });

  it('creates a booking with carrier ownership, station details, and recommendation metadata', async () => {
    const booking = await createBooking({
      facilityId: 'facility-1',
      facilityName: 'Main Facility',
      stationId: 'station-1',
      stationName: 'Station 1',
      arrivalTime: '2026-05-01T08:30:00.000Z',
      slot: '10-11',
      notes: 'Fragile cargo',
      recommendedStationId: 'station-1',
      recommendedWaitMin: 12,
      recommendations: [
        {
          stationId: 'station-1',
          stationName: 'Station 1',
          facilityId: 'facility-1',
          predictedWaitMin: 12,
          predictedPosition: 2,
          predictedQueue: 1,
          score: 12,
        },
      ],
    });

    /**
     * The stored document must contain both legacy and current carrier id fields.
     * This is important because the project already reads bookings using multiple id field variants.
     */
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'booking-generated' }),
      expect.objectContaining({
        Booking_ID: 'booking-generated',
        Booking_Status: 'Pending',
        Carrier_ID: 'carrier-1',
        carrierId: 'carrier-1',
        Facility_ID: 'facility-1',
        Facility_Name: 'Main Facility',
        Station_ID: 'station-1',
        StationId: 'station-1',
        Station_Name: 'Station 1',
        Slot: '10-11',
        Notes: 'Fragile cargo',
        RecommendedStationId: 'station-1',
        RecommendedWaitMin: 12,
      }),
    );

    /**
     * The returned object is what the mobile UI consumes.
     * Therefore Firestore naming is normalized into the app-level Booking shape.
     */
    expect(booking).toMatchObject({
      id: 'booking-generated',
      firestoreId: 'booking-generated',
      facilityId: 'facility-1',
      facilityName: 'Main Facility',
      stationId: 'station-1',
      stationName: 'Station 1',
      slot: '10-11',
      status: 'pending',
      recommendedStationId: 'station-1',
      recommendedWaitMin: 12,
    });
  });

  it('generates a slot from arrival time when the carrier does not provide one explicitly', async () => {
    const booking = await createBooking({
      facilityId: 'facility-1',
      arrivalTime: '2026-05-01T08:30:00',
    });

    /**
     * The source code derives the slot from arrival.getHours().
     * This verifies the carrier can create a booking even if the screen sends only arrivalTime.
     */
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        Slot: '8-9',
      }),
    );

    expect(booking.slot).toBe('8-9');
  });

  it('rejects booking creation when no carrier is authenticated', async () => {
    mockAuth.currentUser = null;

    await expect(
      createBooking({
        facilityId: 'facility-1',
        arrivalTime: '2026-05-01T08:30:00.000Z',
      }),
    ).rejects.toThrow('You must be logged in to perform this action.');

    /**
     * Security-related assertion:
     * a logged-out carrier must not create any Firestore booking document.
     */
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('fetchBooking falls back to Booking_ID when the public booking id is different from the Firestore document id', async () => {
    seedBooking('firestore-row-1', {
      Booking_ID: 'public-booking-id',
      Carrier_ID: 'carrier-1',
      Facility_ID: 'facility-1',
      Station_ID: 'station-1',
      ArrivalTime: '2026-05-01T08:30:00.000Z',
      Booking_Status: 'waiting',
    });

    const booking = await fetchBooking('public-booking-id');

    /**
     * The direct document lookup fails because the Firestore id is firestore-row-1.
     * The service should then query Booking_ID and still return the correct booking.
     */
    expect(mockWhere).toHaveBeenCalledWith('Booking_ID', '==', 'public-booking-id');
    expect(mockLimit).toHaveBeenCalledWith(1);

    expect(booking).toMatchObject({
      id: 'public-booking-id',
      firestoreId: 'firestore-row-1',
      status: 'pending',
    });
  });

  it('throws a clear error when a booking cannot be found', async () => {
    await expect(fetchBooking('missing-booking')).rejects.toThrow('Booking not found');
  });

  it('updateBooking writes only changed fields and returns normalized booking data', async () => {
    seedBooking('booking-a', {
      Booking_ID: 'booking-a',
      Carrier_ID: 'carrier-1',
      Facility_ID: 'facility-1',
      Station_ID: 'station-1',
      ArrivalTime: '2026-05-01T08:30:00.000Z',
      Booking_Status: 'approved',
      Notes: 'Old note',
    });

    const booking = await updateBooking('booking-a', {
      stationId: 'station-2',
      arrivalTime: '2026-05-01T10:15:00',
      notes: 'Updated note',
    });

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'booking-a' }),
      expect.objectContaining({
        Station_ID: 'station-2',
        Notes: 'Updated note',
        UpdatedAt: { __type: 'serverTimestamp' },
      }),
    );

    expect(booking).toMatchObject({
      id: 'booking-a',
      firestoreId: 'booking-a',
      stationId: 'station-2',
      status: 'confirmed',
    });
  });

  it('cancelBooking writes Cancelled status and returns a cancelled booking', async () => {
    seedBooking('booking-a', {
      Booking_ID: 'booking-a',
      Carrier_ID: 'carrier-1',
      Facility_ID: 'facility-1',
      Station_ID: 'station-1',
      ArrivalTime: '2026-05-01T08:30:00.000Z',
      Booking_Status: 'approved',
    });

    const booking = await cancelBooking('booking-a');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'booking-a' }),
      expect.objectContaining({
        Booking_Status: 'Cancelled',
        UpdatedAt: { __type: 'serverTimestamp' },
      }),
    );

    expect(booking.status).toBe('cancelled');
  });

  it('completeBooking updates the real Firestore document even when lookup happens through Booking_ID fallback', async () => {
    seedBooking('firestore-row-1', {
      Booking_ID: 'public-booking-id',
      Carrier_ID: 'carrier-1',
      Facility_ID: 'facility-1',
      Station_ID: 'station-1',
      ArrivalTime: '2026-05-01T08:30:00.000Z',
      Booking_Status: 'servicing',
    });

    const booking = await completeBooking('public-booking-id');

    /**
     * The API receives the public Booking_ID, but Firestore must update the real document ref.
     * This protects the carrier flow when displayed booking ids differ from Firestore doc ids.
     */
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'firestore-row-1' }),
      expect.objectContaining({
        Booking_Status: 'Completed',
        UpdatedAt: { __type: 'serverTimestamp' },
      }),
    );

    expect(booking).toMatchObject({
      id: 'public-booking-id',
      firestoreId: 'firestore-row-1',
      status: 'completed',
    });
  });
});
