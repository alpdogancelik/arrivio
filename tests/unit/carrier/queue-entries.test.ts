import { beforeEach, describe, expect, it, jest } from '@jest/globals';

/**
 * Firebase is mocked because this is a unit test.
 * We only want to test how fetchQueueEntries reads, filters, and normalizes queue data.
 */
const mockDb = { app: 'test-db' };

const mockAuth: { currentUser: { uid: string } | null } = {
  currentUser: { uid: 'carrier-1' },
};

type QueueEntryRow = {
  id: string;
  data: Record<string, any>;
};

/**
 * In-memory Firestore replacement.
 * This makes the test stronger because where(...) filters are actually applied.
 */
let queueRows: QueueEntryRow[] = [];

const mockCollection = jest.fn((database: unknown, name: string) => ({
  __type: 'collection',
  database,
  name,
}));

const mockWhere = jest.fn((field: string, operator: string, value: unknown) => ({
  __type: 'where',
  field,
  operator,
  value,
}));

const mockQuery = jest.fn((...args: unknown[]) => ({
  __type: 'query',
  args,
}));

const mockGetDocs = jest.fn<(...args: any[]) => Promise<any>>();

jest.mock('@/services/firebase', () => ({
  auth: mockAuth,
  db: mockDb,
}));

jest.mock('firebase/firestore', () => ({
  collection: mockCollection,
  getDocs: mockGetDocs,
  query: mockQuery,
  where: mockWhere,
}));

import { fetchQueueEntries } from '@/api/queue-entries';

const queueDocSnap = (id: string, data: Record<string, any>) => ({
  id,
  data: () => data,
});

const seedQueueEntry = (id: string, data: Record<string, any>) => {
  queueRows.push({
    id,
    data: { ...data },
  });
};

const resolveDocsFromQuery = (target: any) => {
  const args = target?.__type === 'query' ? target.args : [target];
  const collectionRef = args[0];
  const collectionName = collectionRef?.name;

  if (collectionName !== 'QueueEntry') {
    return [];
  }

  const whereClauses = args.filter((arg: any) => arg?.__type === 'where');

  let rows = queueRows;

  for (const clause of whereClauses) {
    if (clause.operator !== '==') continue;

    /**
     * This mimics real Firestore behavior:
     * if the query asks for "carrierId", documents containing only "Carrier_ID"
     * will NOT match automatically.
     */
    rows = rows.filter((row) => row.data[clause.field] === clause.value);
  }

  return rows.map((row) => queueDocSnap(row.id, row.data));
};

describe('carrier queue entries api', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockAuth.currentUser = { uid: 'carrier-1' };
    queueRows = [];

    mockGetDocs.mockImplementation(async (target: any) => ({
      docs: resolveDocsFromQuery(target),
    }));
  });

  it('fetches queue entries for the current authenticated carrier by default', async () => {
    seedQueueEntry('queue-1', {
      Queue_ID: 'queue-public-1',
      carrierId: 'carrier-1',
      Facility_ID: 'facility-1',
      Station_ID: 'station-1',
      Booking_ID: 'booking-1',
      Status: 'Waiting',
      EntryTime: '2026-05-01T08:00:00.000Z',
    });

    seedQueueEntry('queue-2', {
      Queue_ID: 'queue-public-2',
      carrierId: 'carrier-2',
      Facility_ID: 'facility-1',
      Station_ID: 'station-2',
      Booking_ID: 'booking-2',
      Status: 'Waiting',
      EntryTime: '2026-05-01T08:10:00.000Z',
    });

    const entries = await fetchQueueEntries();

    /**
     * The carrier screen must only display queue entries belonging to the current carrier.
     */
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 'queue-public-1',
      carrierId: 'carrier-1',
      facilityId: 'facility-1',
      stationId: 'station-1',
      bookingId: 'booking-1',
      status: 'Waiting',
      entryTime: '2026-05-01T08:00:00.000Z',
    });

    expect(mockCollection).toHaveBeenCalledWith(mockDb, 'QueueEntry');
    expect(mockWhere).toHaveBeenCalledWith('carrierId', '==', 'carrier-1');
  });

  it('uses the explicit carrierId parameter instead of the authenticated user when provided', async () => {
    seedQueueEntry('queue-1', {
      carrierId: 'carrier-1',
      Station_ID: 'station-1',
      Status: 'Waiting',
    });

    seedQueueEntry('queue-2', {
      carrierId: 'carrier-2',
      Station_ID: 'station-2',
      Status: 'Waiting',
    });

    const entries = await fetchQueueEntries({
      carrierId: 'carrier-2',
    });

    /**
     * This supports screens or tests that need to inspect a specific carrier explicitly.
     */
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      carrierId: 'carrier-2',
      stationId: 'station-2',
    });

    expect(mockWhere).toHaveBeenCalledWith('carrierId', '==', 'carrier-2');
  });

  it('fetches all queue entries when there is no authenticated carrier and no carrierId parameter', async () => {
    mockAuth.currentUser = null;

    seedQueueEntry('queue-1', {
      carrierId: 'carrier-1',
      Station_ID: 'station-1',
      Status: 'Waiting',
    });

    seedQueueEntry('queue-2', {
      carrierId: 'carrier-2',
      Station_ID: 'station-2',
      Status: 'Servicing',
    });

    const entries = await fetchQueueEntries();

    /**
     * When there is no carrier context, the function falls back to reading the collection.
     * This is useful for recommendation calculations that need global queue state.
     */
    expect(entries).toHaveLength(2);
    expect(mockGetDocs).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'QueueEntry',
      }),
    );
  });

  it('normalizes queue status variants into Waiting, Servicing, and Completed', async () => {
    seedQueueEntry('queue-waiting', {
      carrierId: 'carrier-1',
      status: 'queued',
    });

    seedQueueEntry('queue-servicing', {
      carrierId: 'carrier-1',
      queueStatus: 'in_service',
    });

    seedQueueEntry('queue-completed', {
      carrierId: 'carrier-1',
      Status: 'done',
    });

    const entries = await fetchQueueEntries();

    /**
     * Firestore data may use different words depending on which screen wrote the record.
     * The app-level QueueEntry object should expose consistent status values.
     */
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'queue-waiting',
          status: 'Waiting',
        }),
        expect.objectContaining({
          id: 'queue-servicing',
          status: 'Servicing',
        }),
        expect.objectContaining({
          id: 'queue-completed',
          status: 'Completed',
        }),
      ]),
    );
  });

  it('maps legacy Firestore field names into the app-level queue entry shape', async () => {
    seedQueueEntry('firestore-queue-1', {
      Queue_ID: 'public-queue-id',
      carrierId: 'carrier-1',
      Carrier_ID: 'carrier-1',
      Facility_ID: 'facility-1',
      Station_ID: 'station-1',
      Booking_ID: 'booking-1',
      Status: 'Waiting',
      EntryTime: '2026-05-01T08:00:00.000Z',
      ExitTime: '2026-05-01T09:00:00.000Z',
      CreatedAt: '2026-05-01T07:55:00.000Z',
      UpdatedAt: '2026-05-01T09:05:00.000Z',
    });

    const entries = await fetchQueueEntries();

    /**
     * This protects the mobile UI from Firestore naming differences.
     */
    expect(entries[0]).toMatchObject({
      id: 'public-queue-id',
      carrierId: 'carrier-1',
      facilityId: 'facility-1',
      stationId: 'station-1',
      bookingId: 'booking-1',
      status: 'Waiting',
      entryTime: '2026-05-01T08:00:00.000Z',
      exitTime: '2026-05-01T09:00:00.000Z',
      createdAt: '2026-05-01T07:55:00.000Z',
      updatedAt: '2026-05-01T09:05:00.000Z',
    });
  });

  it('calculates waiting minutes from entry time to service start time when explicit waiting value is missing', async () => {
    seedQueueEntry('queue-1', {
      carrierId: 'carrier-1',
      Station_ID: 'station-1',
      Status: 'Servicing',
      EntryTime: '2026-05-01T08:00:00.000Z',
      ServiceTime: '2026-05-01T08:25:00.000Z',
    });

    const entries = await fetchQueueEntries();

    /**
     * If Firestore does not store WaitingMinutes directly,
     * the app derives it from EntryTime -> ServiceTime.
     */
    expect(entries[0]).toMatchObject({
      waitingMinutes: 25,
    });
  });

  it('uses explicit waitingMinutes and serviceMinutes values when they are already stored', async () => {
    seedQueueEntry('queue-1', {
      carrierId: 'carrier-1',
      Station_ID: 'station-1',
      Status: 'Completed',
      WaitingMinutes: '18',
      ServiceMinutes: 42,
    });

    const entries = await fetchQueueEntries();

    /**
     * Stored numeric values should take priority over derived values.
     */
    expect(entries[0]).toMatchObject({
      waitingMinutes: 18,
      serviceMinutes: 42,
    });
  });

  it('calculates service minutes from service start to exit time when explicit service value is missing', async () => {
    seedQueueEntry('queue-1', {
      carrierId: 'carrier-1',
      Station_ID: 'station-1',
      Status: 'Completed',
      ServiceTime: '2026-05-01T08:30:00.000Z',
      ExitTime: '2026-05-01T09:10:00.000Z',
    });

    const entries = await fetchQueueEntries();

    /**
     * This verifies service duration calculation for completed queue entries.
     */
    expect(entries[0]).toMatchObject({
      serviceMinutes: 40,
    });
  });

  it('filters mapped entries by stationId and bookingId after Firestore results are loaded', async () => {
    seedQueueEntry('queue-1', {
      carrierId: 'carrier-1',
      Station_ID: 'station-1',
      Booking_ID: 'booking-1',
      Status: 'Waiting',
    });

    seedQueueEntry('queue-2', {
      carrierId: 'carrier-1',
      Station_ID: 'station-2',
      Booking_ID: 'booking-2',
      Status: 'Waiting',
    });

    const entries = await fetchQueueEntries({
      stationId: 'station-1',
      bookingId: 'booking-1',
    });

    /**
     * Firestore filters only by carrierId.
     * stationId and bookingId are applied locally after mapping.
     */
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 'queue-1',
      stationId: 'station-1',
      bookingId: 'booking-1',
    });
  });

  it('returns undefined for invalid dates and unknown statuses instead of crashing', async () => {
    seedQueueEntry('queue-1', {
      carrierId: 'carrier-1',
      Station_ID: 'station-1',
      Status: 'unexpected-status',
      EntryTime: 'not-a-date',
      ExitTime: 'also-not-a-date',
    });

    const entries = await fetchQueueEntries();

    /**
     * Defensive behavior:
     * malformed Firestore data should not crash the carrier screen.
     */
    expect(entries[0]).toMatchObject({
      status: undefined,
      entryTime: undefined,
      exitTime: undefined,
      waitingMinutes: undefined,
      serviceMinutes: undefined,
    });
  });

  it('supports legacy Carrier_ID-only records by querying legacy carrier id fields too', async () => {
    seedQueueEntry('legacy-queue-1', {
      Queue_ID: 'legacy-public-id',
      Carrier_ID: 'carrier-1',
      Station_ID: 'station-1',
      Status: 'Waiting',
    });

    const entries = await fetchQueueEntries();

    /**
     * Bug regression check:
     * mapQueueEntry already supports Carrier_ID, so fetchQueueEntries must also query it.
     * Otherwise real Firestore would skip legacy queue documents before mapping starts.
     */
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 'legacy-public-id',
      carrierId: 'carrier-1',
      stationId: 'station-1',
      status: 'Waiting',
    });
    expect(mockWhere).toHaveBeenCalledWith('Carrier_ID', '==', 'carrier-1');
  });
});
