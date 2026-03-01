import { auth, db } from '@/services/firebase';
import { USE_MOCK_DATA } from '@/config/mock';
import { mockFetchMe, mockLogin, mockRefreshTokens, mockRegister } from '@/mock/data';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type IdTokenResult,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { ApiError } from './errors';
import { AuthTokens, AuthTokensSchema, Role, RoleSchema, User, UserSchema } from '@/types/api';

export type LoginPayload = { email: string; password: string };
export type RegisterPayload = { name?: string; surname?: string; email: string; password: string; role?: string };
export type LoginResult = { user: User; tokens: AuthTokens };
export type RegisterResult = { user: User; tokens: AuthTokens | null; message?: string };
export type PasswordResetResult = { message: string };

const DEFAULT_ROLE: Role = 'carrier';

const toEpochSeconds = (value?: string | null) => {
  if (!value) return undefined;
  const time = Math.floor(new Date(value).getTime() / 1000);
  return Number.isNaN(time) ? undefined : time;
};

const splitDisplayName = (displayName?: string | null, fallback?: { name?: string; surname?: string }) => {
  if (!displayName) {
    return { name: fallback?.name ?? undefined, surname: fallback?.surname ?? undefined };
  }
  const parts = displayName.trim().split(/\s+/);
  if (!parts.length) return { name: fallback?.name ?? undefined, surname: fallback?.surname ?? undefined };
  return { name: parts[0], surname: parts.slice(1).join(' ') || undefined };
};

const resolveRole = (rawRole: unknown, fallback?: Role) => {
  const parsed = RoleSchema.safeParse(rawRole);
  if (parsed.success) return parsed.data;
  return fallback ?? DEFAULT_ROLE;
};

const toStringValue = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

const toNumberValue = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

const toBooleanValue = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const raw = String(value ?? '').toLowerCase();
  if (!raw) return undefined;
  if (raw === 'true' || raw === 'yes' || raw === 'active' || raw === 'available') return true;
  if (raw === 'false' || raw === 'no' || raw === 'inactive' || raw === 'blocked' || raw === 'unavailable') return false;
  return undefined;
};

const ensureAuth = () => {
  if (!auth) {
    throw new ApiError({ status: 500, message: 'Firebase auth is disabled' });
  }
  return auth;
};

const ensureDb = () => {
  if (!db) {
    throw new ApiError({ status: 500, message: 'Firestore is disabled' });
  }
  return db;
};

const ensureCarrierProfile = async (
  user: FirebaseUser,
  fallback?: { name?: string; surname?: string; email?: string },
) => {
  const database = ensureDb();
  const ref = doc(database, 'Carrier', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  const { name, surname } = splitDisplayName(user.displayName, fallback);
  await setDoc(
    ref,
    {
      Carrier_ID: user.uid,
      'E-mail': user.email ?? fallback?.email ?? '',
      Name: name ?? '',
      Surname: surname ?? '',
      Company_Name: '',
      Vehicle_Plate: '',
      Status: 'Active',
      BlockReason: '',
      BlockUntil: '',
      UpdatedAt: serverTimestamp(),
      UpdatedByUid: user.uid,
    },
    { merge: true },
  );
};

const mapCarrierProfile = (data: Record<string, any>) => ({
  name: toStringValue(data.Name ?? data.name),
  surname: toStringValue(data.Surname ?? data.surname),
  phone: toStringValue(data.Contact_Number ?? data.Phone ?? data.phone),
  company: toStringValue(data.Company_Name ?? data.company),
  vehiclePlate: toStringValue(data.Vehicle_Plate ?? data.vehiclePlate),
  capacity: toNumberValue(data.Capacity ?? data.capacity),
  available: toBooleanValue(data.Available ?? data.available ?? data.Status ?? data.status),
});

const fetchCarrierProfile = async (user: FirebaseUser) => {
  const database = ensureDb();
  const ref = doc(database, 'Carrier', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return mapCarrierProfile(snap.data() as Record<string, any>);
};

const waitForUser = (timeoutMs = 5000) =>
  new Promise<FirebaseUser | null>((resolve) => {
    const authClient = ensureAuth();
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

const requireUser = async () => {
  const authClient = ensureAuth();
  const user = authClient.currentUser ?? (await waitForUser());
  if (!user) {
    throw new ApiError({ status: 401, message: 'Unauthorized' });
  }
  return user;
};

const buildUser = (
  user: FirebaseUser,
  role: Role,
  fallback?: { name?: string; surname?: string },
  carrierProfile?: ReturnType<typeof mapCarrierProfile> | null,
): User => {
  if (!user.email) {
    throw new ApiError({ status: 400, message: 'Missing email on user' });
  }
  const { name, surname } = splitDisplayName(user.displayName, fallback);
  return UserSchema.parse({
    id: user.uid,
    email: user.email,
    name: carrierProfile?.name ?? name,
    surname: carrierProfile?.surname ?? surname,
    phone: carrierProfile?.phone ?? user.phoneNumber ?? undefined,
    role,
    company: carrierProfile?.company,
    vehiclePlate: carrierProfile?.vehiclePlate,
    capacity: carrierProfile?.capacity,
    available: carrierProfile?.available,
  });
};

const buildTokens = (user: FirebaseUser, tokenResult: IdTokenResult): AuthTokens =>
  AuthTokensSchema.parse({
    accessToken: tokenResult.token,
    refreshToken: user.refreshToken,
    expiresAt: toEpochSeconds(tokenResult.expirationTime),
    issuedAt: toEpochSeconds(tokenResult.issuedAtTime),
    provider: 'firebase',
  });

export const login = async (payload: LoginPayload): Promise<LoginResult> => {
  if (USE_MOCK_DATA) {
    return mockLogin(payload);
  }

  const authClient = ensureAuth();
  const cred = await signInWithEmailAndPassword(authClient, payload.email, payload.password);
  await ensureCarrierProfile(cred.user, { email: payload.email });
  const carrierProfile = await fetchCarrierProfile(cred.user);
  const tokenResult = await cred.user.getIdTokenResult();
  const role = resolveRole(tokenResult.claims?.role);

  return {
    user: buildUser(cred.user, role, undefined, carrierProfile),
    tokens: buildTokens(cred.user, tokenResult),
  };
};

export const register = async (payload: RegisterPayload): Promise<RegisterResult> => {
  if (USE_MOCK_DATA) {
    return mockRegister(payload);
  }

  const authClient = ensureAuth();
  const cred = await createUserWithEmailAndPassword(authClient, payload.email, payload.password);
  const displayName = [payload.name, payload.surname].filter(Boolean).join(' ').trim();
  if (displayName) {
    await updateProfile(cred.user, { displayName });
  }

  await ensureCarrierProfile(cred.user, {
    name: payload.name,
    surname: payload.surname,
    email: payload.email,
  });

  await sendEmailVerification(cred.user);

  const tokenResult = await cred.user.getIdTokenResult();
  const fallbackRoleResult = RoleSchema.safeParse(payload.role);
  const fallbackRole = fallbackRoleResult.success ? fallbackRoleResult.data : undefined;
  const role = resolveRole(tokenResult.claims?.role, fallbackRole);
  const carrierProfile = await fetchCarrierProfile(cred.user);
  const user = buildUser(cred.user, role, { name: payload.name, surname: payload.surname }, carrierProfile);

  await signOut(authClient);

  return {
    user,
    tokens: null,
    message:
      'Please check the email address you entered to verify your account. It may have landed in your spam folder, so please check there as well.',
  };
};

export const requestPasswordReset = async (email: string): Promise<PasswordResetResult> => {
  const normalizedEmail = email.trim();

  if (!normalizedEmail) {
    throw new ApiError({ status: 400, message: 'Enter your email address first.' });
  }

  if (USE_MOCK_DATA) {
    return {
      message: 'Password reset email sent. Check your inbox and spam folder.',
    };
  }

  const authClient = ensureAuth();
  await sendPasswordResetEmail(authClient, normalizedEmail);

  return {
    message: 'Password reset email sent. Check your inbox and spam folder.',
  };
};

export const refreshSession = async (_refreshToken: string) => {
  if (USE_MOCK_DATA) {
    return mockRefreshTokens();
  }

  const user = await requireUser();
  const tokenResult = await user.getIdTokenResult(true);
  return buildTokens(user, tokenResult);
};

export const fetchMe = async () => {
  if (USE_MOCK_DATA) {
    return mockFetchMe();
  }

  const user = await requireUser();
  const tokenResult = await user.getIdTokenResult();
  const role = resolveRole(tokenResult.claims?.role);
  const carrierProfile = await fetchCarrierProfile(user);
  return buildUser(user, role, undefined, carrierProfile);
};

export const updateCarrierProfile = async (changes: Partial<User>) => {
  if (USE_MOCK_DATA) {
    return mockFetchMe();
  }

  const user = await requireUser();
  const database = ensureDb();
  const ref = doc(database, 'Carrier', user.uid);

  const updates: Record<string, any> = {
    UpdatedAt: serverTimestamp(),
    UpdatedByUid: user.uid,
  };

  if (typeof changes.name === 'string') updates.Name = changes.name;
  if (typeof changes.surname === 'string') updates.Surname = changes.surname;
  if (typeof changes.phone === 'string') updates.Contact_Number = changes.phone;
  if (typeof changes.company === 'string') updates.Company_Name = changes.company;
  if (typeof changes.vehiclePlate === 'string') updates.Vehicle_Plate = changes.vehiclePlate;
  if (typeof changes.capacity !== 'undefined') updates.Capacity = changes.capacity;
  if (typeof changes.available !== 'undefined') {
    updates.Available = changes.available;
    updates.Status = changes.available ? 'Active' : 'Inactive';
  }

  const displayName = [changes.name, changes.surname].filter(Boolean).join(' ').trim();
  if (displayName) {
    await updateProfile(user, { displayName });
  }

  await setDoc(ref, updates, { merge: true });
  const snap = await getDoc(ref);
  const carrierProfile = snap.exists() ? mapCarrierProfile(snap.data() as Record<string, any>) : null;

  const tokenResult = await user.getIdTokenResult();
  const role = resolveRole(tokenResult.claims?.role);

  return buildUser(user, role, undefined, carrierProfile);
};
