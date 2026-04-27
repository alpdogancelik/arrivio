import { beforeEach, describe, expect, it, jest } from '@jest/globals';

/**
 * Firebase services are mocked because these are unit tests.
 * The goal is to test the carrier issue API behavior without touching real Firebase,
 * Firestore, or Storage resources.
 */
const mockDb = { app: 'test-db' };
const mockStorage = { bucket: 'test-storage' };
const mockAuth: { currentUser: { uid: string } | null } = {
  currentUser: { uid: 'carrier-1' },
};

type IssueRow = {
  id: string;
  data: Record<string, any>;
};

let issueRows: Record<string, IssueRow[]> = {
  issues: [],
  Issue: [],
};

let collectionsWithWriteFailure = new Set<string>();
let collectionsWithReadFailure = new Set<string>();

const mockCollection = jest.fn((database: unknown, name: string) => ({
  __type: 'collection',
  database,
  name,
}));

const mockDoc = jest.fn((target: any, collectionName?: string, id?: string) => {
  /**
   * Handles doc(db, 'issues', issueId) and doc(db, 'Issue', issueId).
   * This path is used by cancelIssue.
   */
  if (typeof collectionName === 'string') {
    return {
      id: id ?? collectionName,
      collectionName,
      path: `${collectionName}/${id ?? collectionName}`,
    };
  }

  /**
   * Handles doc(collection(db, 'issues')).
   * This path is used by createIssue when Firestore generates a new id.
   */
  return {
    id: `${target.name}-generated`,
    collectionName: target.name,
    path: `${target.name}/${target.name}-generated`,
  };
});

const mockGetDocs = jest.fn<(...args: any[]) => Promise<any>>();
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

const mockStorageRef = jest.fn((_storage: unknown, path: string) => ({
  path,
}));

const mockUploadBytes = jest.fn<(...args: any[]) => Promise<any>>();
const mockGetDownloadURL = jest.fn<(...args: any[]) => Promise<string>>();

const mockOnAuthStateChanged = jest.fn(
  (_authClient: unknown, callback: (user: unknown) => void) => {
    /**
     * The API waits for Firebase auth state if currentUser is not immediately available.
     * Firebase auth listeners are asynchronous, so the mock keeps that behavior.
     */
    setTimeout(() => callback(mockAuth.currentUser), 0);
    return jest.fn();
  },
);

jest.mock('@/services/firebase', () => ({
  auth: mockAuth,
  db: mockDb,
  storage: mockStorage,
}));

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: mockOnAuthStateChanged,
}));

jest.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  getDocs: mockGetDocs,
  query: mockQuery,
  serverTimestamp: mockServerTimestamp,
  setDoc: mockSetDoc,
  updateDoc: mockUpdateDoc,
  where: mockWhere,
}));

jest.mock('firebase/storage', () => ({
  getDownloadURL: mockGetDownloadURL,
  ref: mockStorageRef,
  uploadBytes: mockUploadBytes,
}));

import { cancelIssue, createIssue, fetchIssues } from '@/api/issues';

const permissionDeniedError = {
  code: 'permission-denied',
  message: 'Missing or insufficient permissions.',
};

const issueDocSnap = (collectionName: string, id: string, data: Record<string, any>) => ({
  id,
  ref: {
    id,
    parent: {
      id: collectionName,
    },
  },
  data: () => data,
});

const seedIssue = (collectionName: 'issues' | 'Issue', id: string, data: Record<string, any>) => {
  issueRows[collectionName].push({
    id,
    data: { ...data },
  });
};

const upsertIssue = (collectionName: string, id: string, data: Record<string, any>) => {
  const safeCollectionName = collectionName as 'issues' | 'Issue';
  const existing = issueRows[safeCollectionName].find((row) => row.id === id);

  if (existing) {
    existing.data = { ...existing.data, ...data };
    return;
  }

  issueRows[safeCollectionName].push({
    id,
    data: { ...data },
  });
};

const resolveDocsFromQuery = (target: any) => {
  const args = target?.__type === 'query' ? target.args : [target];
  const collectionRef = args[0];
  const collectionName = collectionRef?.name ?? collectionRef?.collectionName;

  if (collectionName !== 'issues' && collectionName !== 'Issue') {
    return [];
  }

  if (collectionsWithReadFailure.has(collectionName)) {
    throw permissionDeniedError;
  }

  const whereClauses = args.filter((arg: any) => arg?.__type === 'where');

  let rows = issueRows[collectionName];

  for (const clause of whereClauses) {
    if (clause.operator !== '==') continue;
    rows = rows.filter((row) => row.data[clause.field] === clause.value);
  }

  return rows.map((row) => issueDocSnap(collectionName, row.id, row.data));
};

describe('carrier issues api', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockAuth.currentUser = { uid: 'carrier-1' };

    issueRows = {
      issues: [],
      Issue: [],
    };

    collectionsWithWriteFailure = new Set<string>();
    collectionsWithReadFailure = new Set<string>();

    mockGetDocs.mockImplementation(async (target: any) => ({
      docs: resolveDocsFromQuery(target),
    }));

    mockSetDoc.mockImplementation(async (ref: { id: string; collectionName: string }, data: Record<string, any>) => {
      if (collectionsWithWriteFailure.has(ref.collectionName)) {
        throw permissionDeniedError;
      }

      upsertIssue(ref.collectionName, ref.id, data);
    });

    mockUpdateDoc.mockImplementation(async (ref: { id: string; collectionName: string }, updates: Record<string, any>) => {
      upsertIssue(ref.collectionName, ref.id, updates);
    });

    mockUploadBytes.mockResolvedValue({});
    mockGetDownloadURL.mockImplementation(async (ref: { path: string }) => `https://storage.test/${ref.path}`);
  });

  it('creates a carrier issue in the primary issues collection', async () => {
    const issue = await createIssue({
      category: 'Delay',
      description: 'The station queue is not moving.',
      bookingId: 'booking-1',
      photoUrl: 'https://cdn.test/photo.jpg',
    });

    /**
     * The write payload is checked because this is the exact data that Firestore receives.
     * It must preserve carrier ownership, booking relation, issue text, and status.
     */
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'issues-generated',
        collectionName: 'issues',
      }),
      expect.objectContaining({
        Issue_ID: 'issues-generated',
        Booking_ID: 'booking-1',
        Title: 'Delay',
        Description: 'The station queue is not moving.',
        Priority: 'Medium',
        Category: 'Delay',
        Content: 'The station queue is not moving.',
        PhotoUrl: 'https://cdn.test/photo.jpg',
        Carrier_ID: 'carrier-1',
        carrierId: 'carrier-1',
        Status: 'Waiting',
        CreatedAt: { __type: 'serverTimestamp' },
        UpdatedAt: { __type: 'serverTimestamp' },
        Timestamp: { __type: 'serverTimestamp' },
      }),
    );

    /**
     * The returned object is what the carrier UI consumes.
     * "Waiting" is normalized to "open" so the UI does not depend on Firestore wording.
     */
    expect(issue).toMatchObject({
      id: 'issues-generated',
      firestoreId: 'issues-generated',
      bookingId: 'booking-1',
      category: 'Delay',
      description: 'The station queue is not moving.',
      photoUrl: 'https://cdn.test/photo.jpg',
      status: 'open',
      sourceCollection: 'issues',
    });
  });

  it('falls back to the legacy Issue collection when the primary collection is blocked by Firestore rules', async () => {
    /**
     * This simulates a realistic deployment problem:
     * the new "issues" collection may be blocked by Firestore rules while the legacy
     * "Issue" collection is still writable.
     */
    collectionsWithWriteFailure.add('issues');

    const issue = await createIssue({
      category: 'Facility',
      description: 'Gate entrance is blocked.',
      bookingId: 'booking-2',
    });

    expect(mockSetDoc).toHaveBeenCalledTimes(2);

    expect(mockSetDoc).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        collectionName: 'issues',
      }),
      expect.any(Object),
    );

    expect(mockSetDoc).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        id: 'Issue-generated',
        collectionName: 'Issue',
      }),
      expect.objectContaining({
        Issue_ID: 'Issue-generated',
        Carrier_ID: 'carrier-1',
        Status: 'Waiting',
      }),
    );

    expect(issue).toMatchObject({
      id: 'Issue-generated',
      firestoreId: 'Issue-generated',
      status: 'open',
      sourceCollection: 'Issue',
    });
  });

  it('returns a clear permission error when both primary and legacy writes are denied', async () => {
    collectionsWithWriteFailure.add('issues');
    collectionsWithWriteFailure.add('Issue');

    await expect(
      createIssue({
        category: 'Delay',
        description: 'Cannot submit issue.',
      }),
    ).rejects.toThrow(
      'Rapor gönderilemedi. Firestore kurallarında Issue/issues koleksiyonları için staff veya Carrier_ID sahibi kullanıcıya yazma izni açık olmalı.',
    );
  });

  it('rejects issue creation when no carrier is authenticated', async () => {
    mockAuth.currentUser = null;

    await expect(
      createIssue({
        category: 'Delay',
        description: 'This should not be written.',
      }),
    ).rejects.toThrow('You must be logged in to perform this action.');

    /**
     * Security-related assertion:
     * logged-out users must not create issue documents.
     */
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('uploads a photo when photo object is provided and stores the resolved download URL', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);

    Object.defineProperty(globalThis, 'fetch', {
      writable: true,
      value: jest.fn(async () => ({
        blob: async () => ({ size: 100, type: 'image/png' }),
      })),
    });

    const issue = await createIssue({
      category: 'Equipment',
      description: 'Station screen is broken.',
      photo: {
        uri: 'file://local-photo',
        fileName: 'broken screen.png',
        mimeType: 'image/png',
      },
    });

    /**
     * File names are sanitized before upload.
     * This keeps Firebase Storage paths stable and safe.
     */
    expect(mockStorageRef).toHaveBeenCalledWith(
      mockStorage,
      'issue-photos/carrier-1/1700000000000-broken-screen.png',
    );

    expect(mockUploadBytes).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'issue-photos/carrier-1/1700000000000-broken-screen.png',
      }),
      expect.objectContaining({
        size: 100,
        type: 'image/png',
      }),
      {
        contentType: 'image/png',
      },
    );

    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        PhotoUrl: 'https://storage.test/issue-photos/carrier-1/1700000000000-broken-screen.png',
      }),
    );

    expect(issue.photoUrl).toBe(
      'https://storage.test/issue-photos/carrier-1/1700000000000-broken-screen.png',
    );

    nowSpy.mockRestore();
  });

  it('still creates the issue when photo upload fails', async () => {
    Object.defineProperty(globalThis, 'fetch', {
      writable: true,
      value: jest.fn(async () => {
        throw new Error('Local file cannot be read');
      }),
    });

    const issue = await createIssue({
      category: 'Equipment',
      description: 'Photo upload should not block issue creation.',
      photo: {
        uri: 'file://broken-photo',
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
      },
    });

    /**
     * The API intentionally does not block issue creation when image upload fails.
     * This is important for carrier usability: reporting the problem is more important
     * than attaching the image successfully.
     */
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        PhotoUrl: null,
        Content: 'Photo upload should not block issue creation.',
      }),
    );

    expect(issue).toMatchObject({
      description: 'Photo upload should not block issue creation.',
      photoUrl: undefined,
      status: 'open',
    });
  });

  it('fetches only the current carrier issues from both primary and legacy collections', async () => {
    seedIssue('issues', 'primary-1', {
      Issue_ID: 'issue-primary-1',
      Booking_ID: 'booking-1',
      Category: 'Delay',
      Content: 'Primary issue',
      Carrier_ID: 'carrier-1',
      Status: 'Waiting',
      Timestamp: '2026-05-01T08:00:00.000Z',
    });

    /**
     * Duplicate row with the same Firestore id.
     * The service should deduplicate by collection + firestore id.
     */
    seedIssue('issues', 'primary-1', {
      Issue_ID: 'issue-primary-1',
      Booking_ID: 'booking-1',
      Category: 'Delay',
      Content: 'Primary issue duplicate',
      Carrier_ID: 'carrier-1',
      Status: 'Waiting',
      Timestamp: '2026-05-01T08:00:00.000Z',
    });

    seedIssue('Issue', 'legacy-1', {
      Issue_ID: 'issue-legacy-1',
      Booking_ID: 'booking-2',
      Title: 'Facility',
      Description: 'Legacy issue',
      Carrier_ID: 'carrier-1',
      Status: 'Solved',
      Timestamp: '2026-05-01T09:00:00.000Z',
    });

    seedIssue('issues', 'other-carrier-issue', {
      Issue_ID: 'issue-other',
      Booking_ID: 'booking-3',
      Category: 'Delay',
      Content: 'Other carrier issue',
      Carrier_ID: 'carrier-2',
      Status: 'Waiting',
    });

    const issues = await fetchIssues();

    /**
     * The current carrier should see:
     * 1 primary issue + 1 legacy issue.
     * Duplicate primary row and another carrier's issue must not appear.
     */
    expect(issues).toHaveLength(2);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'issue-primary-1',
          firestoreId: 'primary-1',
          bookingId: 'booking-1',
          category: 'Delay',
          description: 'Primary issue',
          status: 'open',
          sourceCollection: 'issues',
        }),
        expect.objectContaining({
          id: 'issue-legacy-1',
          firestoreId: 'legacy-1',
          bookingId: 'booking-2',
          category: 'Facility',
          description: 'Legacy issue',
          status: 'resolved',
          sourceCollection: 'Issue',
        }),
      ]),
    );

    expect(mockWhere).toHaveBeenCalledWith('Carrier_ID', '==', 'carrier-1');
  });

  it('filters fetched issues by status and booking id', async () => {
    seedIssue('issues', 'primary-1', {
      Issue_ID: 'issue-primary-1',
      Booking_ID: 'booking-1',
      Category: 'Delay',
      Content: 'Open issue',
      Carrier_ID: 'carrier-1',
      Status: 'Waiting',
    });

    seedIssue('Issue', 'legacy-1', {
      Issue_ID: 'issue-legacy-1',
      Booking_ID: 'booking-2',
      Title: 'Facility',
      Description: 'Resolved issue',
      Carrier_ID: 'carrier-1',
      Status: 'Solved',
    });

    const resolvedIssues = await fetchIssues({
      status: 'resolved',
      bookingId: 'booking-2',
    });

    expect(resolvedIssues).toHaveLength(1);
    expect(resolvedIssues[0]).toMatchObject({
      id: 'issue-legacy-1',
      bookingId: 'booking-2',
      status: 'resolved',
      sourceCollection: 'Issue',
    });
  });

  it('continues reading legacy issues when the primary issues collection is not readable', async () => {
    collectionsWithReadFailure.add('issues');

    seedIssue('Issue', 'legacy-1', {
      Issue_ID: 'issue-legacy-1',
      Booking_ID: 'booking-2',
      Title: 'Facility',
      Description: 'Legacy issue still readable',
      Carrier_ID: 'carrier-1',
      Status: 'Waiting',
    });

    const issues = await fetchIssues();

    /**
     * Permission errors from one collection should not break the whole carrier issue list
     * as long as the fallback collection can still be read.
     */
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      id: 'issue-legacy-1',
      sourceCollection: 'Issue',
      status: 'open',
    });
  });

  it('rejects fetchIssues when no carrier is authenticated', async () => {
    mockAuth.currentUser = null;

    await expect(fetchIssues()).rejects.toThrow('You must be logged in to perform this action.');

    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('cancelIssue updates the correct Firestore document and returns cancelled status', async () => {
    const result = await cancelIssue({
      id: 'public-issue-id',
      firestoreId: 'legacy-firestore-id',
      sourceCollection: 'Issue',
    });

    /**
     * The API may receive a public Issue_ID from the UI,
     * but Firestore must update the real firestoreId in its original collection.
     */
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'legacy-firestore-id',
        collectionName: 'Issue',
      }),
      expect.objectContaining({
        Status: 'Cancelled',
        UpdatedAt: { __type: 'serverTimestamp' },
      }),
    );

    expect(result).toMatchObject({
      id: 'public-issue-id',
      firestoreId: 'legacy-firestore-id',
      sourceCollection: 'Issue',
      status: 'cancelled',
    });
  });

  it('cancelIssue uses the primary issues collection when sourceCollection is missing', async () => {
    await cancelIssue({
      id: 'primary-issue-id',
      firestoreId: 'primary-firestore-id',
    });

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'primary-firestore-id',
        collectionName: 'issues',
      }),
      expect.objectContaining({
        Status: 'Cancelled',
      }),
    );
  });
});
