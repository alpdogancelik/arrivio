import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDb = { app: 'integration-test-db' };
const mockStorage = { bucket: 'integration-test-storage' };
const mockAuth: { currentUser: { uid: string; email?: string; displayName?: string | null; phoneNumber?: string | null; refreshToken?: string; getIdTokenResult?: () => Promise<any> } | null } = {
  currentUser: {
    uid: 'carrier-1',
    email: 'carrier@example.com',
    displayName: 'Test Carrier',
    phoneNumber: null,
    refreshToken: 'refresh-token',
    getIdTokenResult: async () => ({
      token: 'access-token',
      claims: { role: 'carrier' },
      expirationTime: '2026-05-01T12:00:00.000Z',
      issuedAtTime: '2026-05-01T11:00:00.000Z',
    }),
  },
};

type StoredDoc = {
  id: string;
  data: Record<string, any>;
};

const mockStore: Record<string, Map<string, StoredDoc>> = {};
const mockGeneratedIds: Record<string, number> = {};

const resetStore = () => {
  for (const key of Object.keys(mockStore)) {
    delete mockStore[key];
  }
  for (const key of Object.keys(mockGeneratedIds)) {
    delete mockGeneratedIds[key];
  }
};

const getCollectionStore = (collectionName: string) => {
  mockStore[collectionName] ??= new Map<string, StoredDoc>();
  return mockStore[collectionName];
};

const mockCollection = jest.fn((database: unknown, name: string) => ({
  __type: 'collection',
  database,
  name,
}));

const mockDoc = jest.fn((target: any, collectionName?: string, id?: string) => {
  if (typeof collectionName === 'string') {
    return {
      id: id ?? collectionName,
      collectionName,
      path: `${collectionName}/${id ?? collectionName}`,
    };
  }

  const generated = `${target.name}-${(mockGeneratedIds[target.name] ?? 0) + 1}`;
  mockGeneratedIds[target.name] = (mockGeneratedIds[target.name] ?? 0) + 1;
  return {
    id: generated,
    collectionName: target.name,
    path: `${target.name}/${generated}`,
  };
});

const mockWhere = jest.fn((field: string, operator: string, value: unknown) => ({
  __type: 'where',
  field,
  operator,
  value,
}));

const mockLimit = jest.fn((count: number) => ({
  __type: 'limit',
  count,
}));

const mockQuery = jest.fn((...args: unknown[]) => ({
  __type: 'query',
  args,
}));

const mockServerTimestamp = jest.fn(() => new Date('2026-05-01T10:00:00.000Z'));

const makeDocSnap = (collectionName: string, row: StoredDoc) => ({
  id: row.id,
  ref: {
    id: row.id,
    collectionName,
    path: `${collectionName}/${row.id}`,
    parent: {
      id: collectionName,
    },
  },
  data: () => row.data,
  exists: () => true,
});

const missingDocSnap = (collectionName: string, id: string) => ({
  id,
  ref: {
    id,
    collectionName,
    path: `${collectionName}/${id}`,
    parent: {
      id: collectionName,
    },
  },
  data: () => ({}),
  exists: () => false,
});

const matchesWhere = (data: Record<string, any>, clause: any) => {
  if (clause.operator === '==') return data[clause.field] === clause.value;
  if (clause.operator === 'in' && Array.isArray(clause.value)) {
    return clause.value.includes(data[clause.field]);
  }
  return true;
};

const resolveDocsFromTarget = (target: any) => {
  const args = target?.__type === 'query' ? target.args : [target];
  const collectionRef = args[0];
  const collectionName = collectionRef?.name ?? collectionRef?.collectionName;
  if (!collectionName) return [];

  const whereClauses = args.filter((arg: any) => arg?.__type === 'where');
  const limitClause = args.find((arg: any) => arg?.__type === 'limit');

  let rows = Array.from(getCollectionStore(collectionName).values());
  for (const clause of whereClauses) {
    rows = rows.filter((row) => matchesWhere(row.data, clause));
  }
  if (limitClause?.count) {
    rows = rows.slice(0, limitClause.count);
  }

  return rows.map((row) => makeDocSnap(collectionName, row));
};

const mockGetDoc = jest.fn(async (ref: { id: string; collectionName: string }) => {
  const row = getCollectionStore(ref.collectionName).get(ref.id);
  return row ? makeDocSnap(ref.collectionName, row) : missingDocSnap(ref.collectionName, ref.id);
});

const mockGetDocs = jest.fn(async (target: any) => ({
  docs: resolveDocsFromTarget(target),
}));

const mockSetDoc = jest.fn(async (ref: { id: string; collectionName: string }, data: Record<string, any>, options?: { merge?: boolean }) => {
  const collectionStore = getCollectionStore(ref.collectionName);
  const previous = collectionStore.get(ref.id)?.data ?? {};
  collectionStore.set(ref.id, {
    id: ref.id,
    data: options?.merge ? { ...previous, ...data } : { ...data },
  });
});

const mockUpdateDoc = jest.fn(async (ref: { id: string; collectionName: string }, updates: Record<string, any>) => {
  const collectionStore = getCollectionStore(ref.collectionName);
  const previous = collectionStore.get(ref.id)?.data ?? {};
  collectionStore.set(ref.id, {
    id: ref.id,
    data: { ...previous, ...updates },
  });
});

const mockOnAuthStateChanged = jest.fn((_authClient: unknown, callback: (user: unknown) => void) => {
  setTimeout(() => callback(mockAuth.currentUser), 0);
  return jest.fn();
});

jest.mock('@/services/firebase', () => ({
  auth: mockAuth,
  db: mockDb,
  storage: mockStorage,
}));

jest.mock('@/config', () => ({
  appConfig: {
    getRecommendationUrl: '',
  },
}));

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: mockOnAuthStateChanged,
  updateProfile: jest.fn(async () => undefined),
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

jest.mock('firebase/storage', () => ({
  getDownloadURL: jest.fn(async (ref: { path: string }) => `https://storage.test/${ref.path}`),
  ref: jest.fn((_storage: unknown, path: string) => ({ path })),
  uploadBytes: jest.fn(async () => undefined),
}));

import { createBooking, fetchBooking, fetchBookings } from '@/api/bookings';
import { cancelIssue, createIssue, fetchIssues } from '@/api/issues';
import { fetchQueueEntries } from '@/api/queue-entries';
import { fetchStationRecommendation } from '@/api/recommendations';
import { fetchStations } from '@/api/stations';
import { updateCarrierProfile } from '@/api/auth';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

const seedDoc = async (collectionName: string, id: string, data: Record<string, any>) => {
  await setDoc(doc(mockDb as any, collectionName, id), data);
};

describe('system integration flows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    mockAuth.currentUser = {
      uid: 'carrier-1',
      email: 'carrier@example.com',
      displayName: 'Test Carrier',
      phoneNumber: null,
      refreshToken: 'refresh-token',
      getIdTokenResult: async () => ({
        token: 'access-token',
        claims: { role: 'carrier' },
        expirationTime: '2026-05-01T12:00:00.000Z',
        issuedAtTime: '2026-05-01T11:00:00.000Z',
      }),
    };
  });

  it('connects carrier booking creation, Firestore persistence, queue visibility, and station recommendation', async () => {
    await seedDoc('Station', 'station-a', {
      Station_ID: 'station-a',
      Facility_ID: 'facility-1',
      Name: 'Busy Station',
      Status: 'Active',
      avgServiceTimeMin: 20,
    });
    await seedDoc('Station', 'station-b', {
      Station_ID: 'station-b',
      Facility_ID: 'facility-1',
      Name: 'Fast Station',
      Status: 'Active',
      avgServiceTimeMin: 5,
    });

    await seedDoc('QueueEntry', 'queue-existing', {
      Queue_ID: 'queue-existing',
      carrierId: 'carrier-1',
      Facility_ID: 'facility-1',
      Station_ID: 'station-a',
      Booking_ID: 'existing-booking',
      Status: 'Waiting',
      CreatedAt: '2026-05-01T08:00:00.000Z',
    });

    const recommendation = await fetchStationRecommendation({
      facilityId: 'facility-1',
      arrivalTime: '2026-05-01T10:15:00.000Z',
      slot: '10-11',
    });

    const booking = await createBooking({
      facilityId: 'facility-1',
      facilityName: 'Main Facility',
      stationId: recommendation.suggestedStationId ?? undefined,
      stationName: 'Fast Station',
      arrivalTime: '2026-05-01T10:15:00.000Z',
      slot: '10-11',
      recommendedStationId: recommendation.suggestedStationId ?? undefined,
      recommendedWaitMin: recommendation.stations[0]?.predictedWaitMin,
      recommendations: recommendation.stations,
    });

    const carrierBookings = await fetchBookings({ status: 'pending' });
    const queueEntries = await fetchQueueEntries({ stationId: 'station-a' });

    expect(recommendation.suggestedStationId).toBe('station-b');
    expect(booking).toMatchObject({
      facilityId: 'facility-1',
      stationId: 'station-b',
      status: 'pending',
      recommendedStationId: 'station-b',
    });
    expect(carrierBookings).toHaveLength(1);
    expect(carrierBookings[0]).toMatchObject({
      id: booking.id,
      stationId: 'station-b',
      recommendedStationId: 'station-b',
    });
    expect(queueEntries).toHaveLength(1);
    expect(queueEntries[0]).toMatchObject({
      id: 'queue-existing',
      bookingId: 'existing-booking',
      status: 'Waiting',
    });
  });

  it('reflects operator-side state changes back into carrier booking and queue reads', async () => {
    const booking = await createBooking({
      facilityId: 'facility-1',
      stationId: 'station-a',
      arrivalTime: '2026-05-01T09:00:00.000Z',
      slot: '9-10',
    });

    await seedDoc('QueueEntry', 'queue-for-booking', {
      Queue_ID: 'queue-for-booking',
      carrierId: 'carrier-1',
      Facility_ID: 'facility-1',
      Station_ID: 'station-a',
      Booking_ID: booking.id,
      Status: 'Waiting',
      EntryTime: '2026-05-01T09:00:00.000Z',
    });

    await updateDoc(doc(mockDb as any, 'Booking', booking.firestoreId ?? booking.id), {
      Booking_Status: 'Servicing',
      ServiceStartTime: '2026-05-01T09:20:00.000Z',
    });
    await updateDoc(doc(mockDb as any, 'QueueEntry', 'queue-for-booking'), {
      Status: 'Servicing',
      ServiceTime: '2026-05-01T09:20:00.000Z',
    });

    const updatedBooking = await fetchBooking(booking.id);
    const queue = await fetchQueueEntries({ bookingId: booking.id });

    expect(updatedBooking).toMatchObject({
      id: booking.id,
      status: 'servicing',
      serviceStartTime: '2026-05-01T09:20:00.000Z',
    });
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      bookingId: booking.id,
      status: 'Servicing',
      waitingMinutes: 20,
    });
  });

  it('connects admin-style station/profile updates to user-facing reads and blocks unauthenticated writes', async () => {
    await seedDoc('Carrier', 'carrier-1', {
      Carrier_ID: 'carrier-1',
      'E-mail': 'carrier@example.com',
      Name: 'Old',
      Surname: 'Name',
      Status: 'Active',
    });
    await seedDoc('Station', 'station-a', {
      Station_ID: 'station-a',
      Facility_ID: 'facility-1',
      Name: 'Original Station',
      Status: 'Active',
    });

    const updatedUser = await updateCarrierProfile({
      name: 'Updated',
      surname: 'Carrier',
      company: 'Arrivio Logistics',
      available: false,
    });

    await updateDoc(doc(mockDb as any, 'Station', 'station-a'), {
      Name: 'Updated Station',
      Status: 'Limited',
    });

    const stations = await fetchStations('facility-1');

    mockAuth.currentUser = null;
    await expect(
      createIssue({
        category: 'Unauthorized',
        description: 'This issue must not be stored.',
      }),
    ).rejects.toThrow('You must be logged in to perform this action.');

    expect(updatedUser).toMatchObject({
      id: 'carrier-1',
      name: 'Updated',
      surname: 'Carrier',
      company: 'Arrivio Logistics',
      available: false,
    });
    expect(stations).toHaveLength(1);
    expect(stations[0]).toMatchObject({
      id: 'station-a',
      name: 'Updated Station',
      status: 'limited',
    });
    expect(getCollectionStore('issues').size).toBe(0);
  });

  it('stores carrier issue reports, exposes them to management reads, and propagates cancellation', async () => {
    const booking = await createBooking({
      facilityId: 'facility-1',
      stationId: 'station-a',
      arrivalTime: '2026-05-01T11:00:00.000Z',
    });

    const issue = await createIssue({
      category: 'Delay',
      description: 'The queue is not moving.',
      bookingId: booking.id,
      photoUrl: 'https://cdn.test/queue-delay.jpg',
    });

    const issuesBeforeCancel = await fetchIssues({ bookingId: booking.id });
    const cancelled = await cancelIssue(issue);
    const issuesAfterCancel = await fetchIssues({ bookingId: booking.id, status: 'cancelled' });

    expect(issue).toMatchObject({
      bookingId: booking.id,
      category: 'Delay',
      description: 'The queue is not moving.',
      photoUrl: 'https://cdn.test/queue-delay.jpg',
      status: 'open',
      sourceCollection: 'issues',
    });
    expect(issuesBeforeCancel).toHaveLength(1);
    expect(cancelled).toMatchObject({
      id: issue.id,
      status: 'cancelled',
    });
    expect(issuesAfterCancel).toHaveLength(1);
    expect(issuesAfterCancel[0]).toMatchObject({
      id: issue.id,
      status: 'cancelled',
    });
  });
});
