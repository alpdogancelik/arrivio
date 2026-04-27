import { Issue, IssueStatus } from '@/types/api';
import { ApiError } from '@/api/errors';
import { auth, db, storage } from '@/services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';

const PRIMARY_ISSUES_COLLECTION = 'issues';
const LEGACY_ISSUES_COLLECTION = 'Issue';

const ensureDb = () => {
  if (!db) {
    throw new Error('Firestore is disabled');
  }
  return db;
};

const ensureStorage = () => {
  if (!storage) {
    throw new Error('Firebase Storage is disabled');
  }
  return storage;
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
  if (raw === 'open' || raw === 'in_progress' || raw === 'resolved' || raw === 'cancelled') {
    return raw as IssueStatus;
  }
  if (raw === 'unsolved' || raw === 'new' || raw === 'pending' || raw === 'waiting') return 'open';
  if (raw === 'canceled' || raw === 'cancelled') return 'cancelled';
  if (raw === 'solved' || raw === 'closed' || raw === 'done') return 'resolved';
  return 'open';
};

const mapIssue = (id: string, data: Record<string, any>, sourceCollection?: string): Issue => ({
  id: toStringValue(data.Issue_ID) ?? id,
  firestoreId: id,
  bookingId: toStringValue(data.Booking_ID ?? data.bookingId),
  category: toStringValue(data.Category ?? data.Title ?? data.category ?? data.title) ?? 'General',
  description: toStringValue(data.Content ?? data.Description ?? data.description) ?? '',
  photoUrl: toStringValue(data.PhotoUrl ?? data.photoUrl),
  status: normalizeIssueStatus(data.Status ?? data.status ?? data.issueStatus),
  createdAt: toIsoString(data.Timestamp ?? data.CreatedAt ?? data.createdAt ?? data.created_on),
  sourceCollection,
});

export type CreateIssuePayload = {
  category: string;
  description: string;
  photoUrl?: string;
  bookingId?: string;
  photo?: {
    uri: string;
    fileName?: string | null;
    mimeType?: string | null;
  };
};

export type ListIssuesParams = {
  status?: IssueStatus;
  bookingId?: string;
};

const inferExtension = (fileName?: string | null, mimeType?: string | null) => {
  const normalizedName = String(fileName ?? '').trim();
  const fromName = normalizedName.split('.').pop();
  if (fromName && fromName !== normalizedName) {
    return fromName.toLowerCase();
  }

  const normalizedMime = String(mimeType ?? '').toLowerCase();
  if (normalizedMime === 'image/png') return 'png';
  if (normalizedMime === 'image/webp') return 'webp';
  if (normalizedMime === 'image/heic' || normalizedMime === 'image/heif') return 'heic';
  return 'jpg';
};

const sanitizeFileStem = (value?: string | null) => {
  const stem = String(value ?? '')
    .replace(/\.[^.]+$/, '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return stem || 'photo';
};

const uploadIssuePhoto = async (
  photo: NonNullable<CreateIssuePayload['photo']>,
  userId: string,
) => {
  const storageClient = ensureStorage();
  const response = await fetch(photo.uri);
  const blob = await response.blob();
  const extension = inferExtension(photo.fileName, photo.mimeType);
  const fileStem = sanitizeFileStem(photo.fileName);
  const objectRef = storageRef(
    storageClient,
    `issue-photos/${userId}/${Date.now()}-${fileStem}.${extension}`,
  );

  await uploadBytes(objectRef, blob, {
    contentType: photo.mimeType ?? `image/${extension}`,
  });

  return getDownloadURL(objectRef);
};

const isPermissionError = (error: unknown) => {
  const code = String((error as any)?.code ?? '').toLowerCase();
  const message = String((error as any)?.message ?? '').toLowerCase();
  return (
    code.includes('permission-denied') ||
    message.includes('permission') ||
    message.includes('insufficient permissions') ||
    message.includes('missing or insufficient')
  );
};

const mapCreateIssueError = (error: unknown) => {
  if (isPermissionError(error)) {
    return new ApiError({
      code: 'firestore/permission-denied',
      message:
        'Rapor gönderilemedi. Firestore kurallarında Issue/issues koleksiyonları için staff veya Carrier_ID sahibi kullanıcıya yazma izni açık olmalı.',
      details: error,
    });
  }

  return error;
};

export const createIssue = async (payload: CreateIssuePayload) => {
  const database = ensureDb();
  const user = await ensureUser();
  let resolvedPhotoUrl = payload.photoUrl ?? null;
  if (!resolvedPhotoUrl && payload.photo) {
    try {
      resolvedPhotoUrl = await uploadIssuePhoto(payload.photo, user.uid);
    } catch {
      // Do not block issue creation when image upload fails.
      resolvedPhotoUrl = null;
    }
  }

  const writeToCollection = async (collectionName: string) => {
    const ref = doc(collection(database, collectionName));
    const data = {
      Issue_ID: ref.id,
      Booking_ID: payload.bookingId ?? null,
      Title: payload.category,
      Description: payload.description,
      Priority: 'Medium',
      Facility: payload.bookingId ?? null,
      Category: payload.category,
      Content: payload.description,
      PhotoUrl: resolvedPhotoUrl,
      Carrier_ID: user.uid,
      carrierId: user.uid,
      Status: 'Waiting',
      CreatedAt: serverTimestamp(),
      UpdatedAt: serverTimestamp(),
      Timestamp: serverTimestamp(),
    };

    await setDoc(ref, data);

    return mapIssue(ref.id, {
      ...data,
      Timestamp: new Date().toISOString(),
    }, collectionName);
  };

  try {
    return await writeToCollection(PRIMARY_ISSUES_COLLECTION);
  } catch (primaryError) {
    if (!isPermissionError(primaryError)) {
      throw primaryError;
    }

    try {
      return await writeToCollection(LEGACY_ISSUES_COLLECTION);
    } catch (legacyError) {
      throw mapCreateIssueError(legacyError);
    }
  }
};

export const fetchIssues = async (params?: ListIssuesParams) => {
  const database = ensureDb();
  const user = await ensureUser();
  const readCollectionSafely = async (name: string) => {
    try {
      return await getDocs(query(collection(database, name), where('Carrier_ID', '==', user.uid)));
    } catch (error) {
      if (isPermissionError(error)) {
        return null;
      }
      throw error;
    }
  };

  const [primarySnapshot, legacySnapshot] = await Promise.all([
    readCollectionSafely(PRIMARY_ISSUES_COLLECTION),
    readCollectionSafely(LEGACY_ISSUES_COLLECTION),
  ]);

  const rows = [...(primarySnapshot?.docs ?? []), ...(legacySnapshot?.docs ?? [])].map((docSnap) => {
    const raw = docSnap.data() as Record<string, any>;
    return {
      issue: mapIssue(docSnap.id, raw, docSnap.ref.parent.id),
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
    const key = `${row.issue.sourceCollection ?? PRIMARY_ISSUES_COLLECTION}:${row.issue.firestoreId ?? row.issue.id}`;
    if (!deduped.has(key)) {
      deduped.set(key, row);
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

export const cancelIssue = async (issue: Pick<Issue, 'id' | 'firestoreId' | 'sourceCollection'>) => {
  const database = ensureDb();
  await ensureUser();
  const collectionName = issue.sourceCollection || PRIMARY_ISSUES_COLLECTION;
  const docId = issue.firestoreId || issue.id;

  await updateDoc(doc(database, collectionName, docId), {
    Status: 'Cancelled',
    UpdatedAt: serverTimestamp(),
  });

  return {
    ...issue,
    status: 'cancelled' as IssueStatus,
  };
};
