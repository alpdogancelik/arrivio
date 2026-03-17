import { Issue, IssueStatus } from '@/types/api';
import { USE_MOCK_DATA } from '@/config/mock';
import { createMockIssue, listMockIssues } from '@/mock/data';
import { auth, db } from '@/services/firebase';
import { collection, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';

const PRIMARY_ISSUES_COLLECTION = 'issues';
const LEGACY_ISSUES_COLLECTION = 'Issue';

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

const normalizeIssueStatus = (value: unknown): IssueStatus => {
  const raw = String(value ?? '').toLowerCase();
  if (raw === 'open' || raw === 'in_progress' || raw === 'resolved') {
    return raw as IssueStatus;
  }
  if (raw === 'unsolved' || raw === 'new' || raw === 'pending') return 'open';
  if (raw === 'solved' || raw === 'closed' || raw === 'done') return 'resolved';
  return 'open';
};

const mapIssue = (id: string, data: Record<string, any>): Issue => ({
  id: toStringValue(data.Issue_ID) ?? id,
  bookingId: toStringValue(data.Booking_ID ?? data.bookingId),
  category: toStringValue(data.Category ?? data.Title ?? data.category ?? data.title) ?? 'General',
  description: toStringValue(data.Content ?? data.Description ?? data.description) ?? '',
  photoUrl: toStringValue(data.PhotoUrl ?? data.photoUrl),
  status: normalizeIssueStatus(data.Status ?? data.status ?? data.issueStatus),
  createdAt: toIsoString(data.Timestamp ?? data.CreatedAt ?? data.createdAt ?? data.created_on),
});

export type CreateIssuePayload = {
  category: string;
  description: string;
  photoUrl?: string;
  bookingId?: string;
};

export type ListIssuesParams = {
  status?: IssueStatus;
  bookingId?: string;
};

export const createIssue = async (payload: CreateIssuePayload) => {
  if (USE_MOCK_DATA) return Promise.resolve(createMockIssue(payload));

  const database = ensureDb();
  const user = ensureUser();
  const ref = doc(collection(database, PRIMARY_ISSUES_COLLECTION));
  const data = {
    Issue_ID: ref.id,
    Booking_ID: payload.bookingId ?? null,
    Title: payload.category,
    Description: payload.description,
    Priority: 'Medium',
    Facility: payload.bookingId ?? null,
    Category: payload.category,
    Content: payload.description,
    PhotoUrl: payload.photoUrl ?? null,
    Carrier_ID: user.uid,
    Status: 'Unsolved',
    CreatedAt: serverTimestamp(),
    UpdatedAt: serverTimestamp(),
    Timestamp: serverTimestamp(),
  };

  await setDoc(ref, data);

  return mapIssue(ref.id, {
    ...data,
    Timestamp: new Date().toISOString(),
  });
};

export const fetchIssues = async (params?: ListIssuesParams) => {
  if (USE_MOCK_DATA) return Promise.resolve(listMockIssues(params));

  const database = ensureDb();
  const [primarySnapshot, legacySnapshot] = await Promise.all([
    getDocs(collection(database, PRIMARY_ISSUES_COLLECTION)),
    getDocs(collection(database, LEGACY_ISSUES_COLLECTION)),
  ]);

  const rows = [...primarySnapshot.docs, ...legacySnapshot.docs].map((docSnap) => {
    const raw = docSnap.data() as Record<string, any>;
    return {
      issue: mapIssue(docSnap.id, raw),
      carrierId: toStringValue(
        raw?.Carrier_ID ??
          raw?.carrierId ??
          raw?.CarrierId ??
          raw?.CreatedBy ??
          raw?.createdBy ??
          raw?.User_ID ??
          raw?.userId,
      ),
    };
  });

  const deduped = new Map<string, { issue: Issue; carrierId?: string }>();
  for (const row of rows) {
    if (!deduped.has(row.issue.id)) {
      deduped.set(row.issue.id, row);
    }
  }

  let issues = Array.from(deduped.values());

  const myUid = auth?.currentUser?.uid;
  if (myUid) {
    // Carrier ekranında yalnızca giriş yapan kullanıcının oluşturduğu issue'ları göster.
    issues = issues.filter((row) => row.carrierId === myUid);
  }

  if (params?.status) {
    issues = issues.filter((row) => row.issue.status === params.status);
  }
  if (params?.bookingId) {
    issues = issues.filter((row) => row.issue.bookingId === params.bookingId);
  }

  return issues.map((row) => row.issue);
};
