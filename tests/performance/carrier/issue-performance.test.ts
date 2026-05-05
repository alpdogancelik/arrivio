import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

/**
 * Carrier issue performance tests.
 *
 * These tests measure whether carrier issue reporting operations can be
 * created, fetched, filtered, cancelled, and normalized within the response
 * time threshold defined in the Test Plan.
 *
 * Firebase, Firestore, Firebase Auth, and Firebase Storage are mocked.
 * The purpose is not to measure Firebase infrastructure performance,
 * but to verify that carrier-side issue processing remains stable and
 * responsive under repeated and larger issue datasets.
 */

const mockDb = { app: 'performance-test-db' };
const mockStorage = { bucket: 'performance-test-storage' };

const mockAuth: { currentUser: { uid: string } | null } = {
  currentUser: { uid: 'carrier-1' },
};

type IssueRow = {
  id: string;
  data: Record<string, any>;
};

type IssueCollectionName = 'issues' | 'Issue';

type PerformanceResult = {
  testName: string;
  iterations: number;
  durationMs: number;
  averageMs: number;
  maxAllowedMs: number;
  passed: boolean;
};

let issueRows: Record<IssueCollectionName, IssueRow[]> = {
  issues: [],
  Issue: [],
};

let generatedIssueCounter = 0;

const performanceResults: PerformanceResult[] = [];

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

  generatedIssueCounter += 1;

  return {
    id: `${target.name}-generated-${generatedIssueCounter}`,
    collectionName: target.name,
    path: `${target.name}/${target.name}-generated-${generatedIssueCounter}`,
  };
});

const mockGetDocs = jest.fn<(...args: any[]) => Promise<any>>();
const mockQuery = jest.fn((...args: unknown[]) => ({ __type: 'query', args }));
const mockServerTimestamp = jest.fn(() => new Date('2026-05-01T08:00:00.000Z'));
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

const issueDocSnap = (collectionName: IssueCollectionName, id: string, data: Record<string, any>) => ({
  id,
  ref: {
    id,
    parent: {
      id: collectionName,
    },
  },
  data: () => data,
});

const seedIssue = (collectionName: IssueCollectionName, id: string, data: Record<string, any>) => {
  issueRows[collectionName].push({
    id,
    data: { ...data },
  });
};

const upsertIssue = (collectionName: string, id: string, data: Record<string, any>) => {
  const safeCollectionName = collectionName as IssueCollectionName;
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

  const whereClauses = args.filter((arg: any) => arg?.__type === 'where');

  let rows = issueRows[collectionName as IssueCollectionName];

  for (const clause of whereClauses) {
    if (clause.operator !== '==') {
      continue;
    }

    rows = rows.filter((row) => row.data[clause.field] === clause.value);
  }

  return rows.map((row) => issueDocSnap(collectionName as IssueCollectionName, row.id, row.data));
};

const seedLargeIssueDataset = (count: number) => {
  const baseTime = new Date('2026-05-01T08:00:00.000Z').getTime();

  for (let index = 0; index < count; index += 1) {
    const collectionName: IssueCollectionName = index % 2 === 0 ? 'issues' : 'Issue';
    const carrierId = index % 3 === 0 ? 'carrier-2' : 'carrier-1';
    const bookingNumber = (index % 50) + 1;
    const stationNumber = (index % 10) + 1;

    const status =
      index % 4 === 0
        ? 'Waiting'
        : index % 4 === 1
          ? 'In Progress'
          : index % 4 === 2
            ? 'Solved'
            : 'Cancelled';

    seedIssue(collectionName, `${collectionName}-issue-${index + 1}`, {
      Issue_ID: `public-issue-${index + 1}`,
      Booking_ID: `booking-${bookingNumber}`,
      Facility_ID: 'facility-1',
      Station_ID: `station-${stationNumber}`,
      Title: index % 2 === 0 ? 'Delay' : 'Facility',
      Category: index % 2 === 0 ? 'Delay' : 'Facility',
      Description: `Mock issue description ${index + 1}`,
      Content: `Mock issue description ${index + 1}`,
      Priority: index % 5 === 0 ? 'High' : 'Medium',
      Carrier_ID: carrierId,
      carrierId,
      Status: status,
      PhotoUrl: index % 6 === 0 ? `https://cdn.test/issue-${index + 1}.jpg` : null,
      CreatedAt: new Date(baseTime + index * 60_000).toISOString(),
      UpdatedAt: new Date(baseTime + index * 60_000).toISOString(),
      Timestamp: new Date(baseTime + index * 60_000).toISOString(),
    });
  }
};

const measureAsyncPerformance = async (
  testName: string,
  iterations: number,
  maxAllowedMs: number,
  callback: () => Promise<void>,
) => {
  const start = Date.now();

  for (let index = 0; index < iterations; index += 1) {
    await callback();
  }

  const durationMs = Date.now() - start;
  const averageMs = durationMs / iterations;
  const passed = durationMs <= maxAllowedMs;

  performanceResults.push({
    testName,
    iterations,
    durationMs,
    averageMs: Number(averageMs.toFixed(3)),
    maxAllowedMs,
    passed,
  });

  return {
    durationMs,
    averageMs,
    passed,
  };
};

describe('carrier issue performance tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockAuth.currentUser = { uid: 'carrier-1' };
    generatedIssueCounter = 0;

    issueRows = {
      issues: [],
      Issue: [],
    };

    mockGetDocs.mockImplementation(async (target: any) => ({
      docs: resolveDocsFromQuery(target),
    }));

    mockSetDoc.mockImplementation(async (ref: { id: string; collectionName: string }, data: Record<string, any>) => {
      upsertIssue(ref.collectionName, ref.id, {
        ...data,
        CreatedAt: data.CreatedAt instanceof Date ? data.CreatedAt.toISOString() : data.CreatedAt,
        UpdatedAt: data.UpdatedAt instanceof Date ? data.UpdatedAt.toISOString() : data.UpdatedAt,
        Timestamp: data.Timestamp instanceof Date ? data.Timestamp.toISOString() : data.Timestamp,
      });
    });

    mockUpdateDoc.mockImplementation(async (ref: { id: string; collectionName: string }, updates: Record<string, any>) => {
      upsertIssue(ref.collectionName, ref.id, {
        ...updates,
        UpdatedAt: updates.UpdatedAt instanceof Date ? updates.UpdatedAt.toISOString() : updates.UpdatedAt,
      });
    });

    mockUploadBytes.mockResolvedValue({});
    mockGetDownloadURL.mockImplementation(async (ref: { path: string }) => `https://storage.test/${ref.path}`);
  });

  it('creates carrier issues repeatedly within the acceptable time limit', async () => {
    const result = await measureAsyncPerformance(
      'Create carrier issues repeatedly',
      50,
      3000,
      async () => {
        const issue = await createIssue({
          category: 'Delay',
          description: 'The station queue is not moving.',
          bookingId: 'booking-1',
          photoUrl: 'https://cdn.test/photo.jpg',
        });

        expect(issue.id).toBeDefined();
        expect(issue.category).toBe('Delay');
        expect(issue.status).toBe('open');
      },
    );

    expect(result.durationMs).toBeLessThanOrEqual(3000);
  });

  it('fetches and normalizes a large carrier issue list within the acceptable time limit', async () => {
    seedLargeIssueDataset(1000);

    const result = await measureAsyncPerformance(
      'Fetch and normalize large carrier issue list',
      50,
      3000,
      async () => {
        const issues = await fetchIssues();

        expect(issues.length).toBeGreaterThan(0);
        expect(issues.every((issue) => issue.id)).toBe(true);
        expect(issues.every((issue) => issue.status)).toBe(true);
      },
    );

    expect(result.durationMs).toBeLessThanOrEqual(3000);
  });

  it('filters fetched carrier issues by status and booking id within the acceptable time limit', async () => {
    seedLargeIssueDataset(1000);

    const result = await measureAsyncPerformance(
      'Filter carrier issues by status and booking id',
      50,
      3000,
      async () => {
        const issues = await fetchIssues({
          status: 'resolved',
          bookingId: 'booking-2',
        });

        for (const issue of issues) {
          expect(issue.status).toBe('resolved');
          expect(issue.bookingId).toBe('booking-2');
        }
      },
    );

    expect(result.durationMs).toBeLessThanOrEqual(3000);
  });

  it('cancels carrier issues repeatedly within the acceptable time limit', async () => {
    seedIssue('issues', 'primary-firestore-id', {
      Issue_ID: 'public-primary-issue',
      Booking_ID: 'booking-1',
      Category: 'Delay',
      Content: 'Issue that will be cancelled.',
      Carrier_ID: 'carrier-1',
      Status: 'Waiting',
      Timestamp: '2026-05-01T08:00:00.000Z',
    });

    const result = await measureAsyncPerformance(
      'Cancel carrier issues repeatedly',
      50,
      3000,
      async () => {
        const issue = await cancelIssue({
          id: 'public-primary-issue',
          firestoreId: 'primary-firestore-id',
          sourceCollection: 'issues',
        });

        expect(issue.id).toBe('public-primary-issue');
        expect(issue.status).toBe('cancelled');
      },
    );

    expect(result.durationMs).toBeLessThanOrEqual(3000);
  });

  it('handles 50 concurrent issue creation operations without failure', async () => {
    const start = Date.now();

    const operations = Array.from({ length: 50 }, (_item, index) =>
      createIssue({
        category: index % 2 === 0 ? 'Delay' : 'Facility',
        description: `Concurrent issue performance test ${index + 1}`,
        bookingId: `booking-${(index % 10) + 1}`,
        photoUrl: index % 3 === 0 ? `https://cdn.test/concurrent-${index + 1}.jpg` : undefined,
      }),
    );

    const settledResults = await Promise.allSettled(operations);
    const durationMs = Date.now() - start;

    const successfulOperationCount = settledResults.filter(
      (item) => item.status === 'fulfilled',
    ).length;

    performanceResults.push({
      testName: '50 concurrent issue creation operations',
      iterations: 50,
      durationMs,
      averageMs: Number((durationMs / 50).toFixed(3)),
      maxAllowedMs: 3000,
      passed: durationMs <= 3000 && successfulOperationCount === 50,
    });

    expect(successfulOperationCount).toBe(50);
    expect(durationMs).toBeLessThanOrEqual(3000);
  });
});

afterAll(() => {
  console.log('\nCarrier Issue Performance Test Summary');
  console.table(performanceResults);
});