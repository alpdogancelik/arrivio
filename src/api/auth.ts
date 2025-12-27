import { auth } from '@/services/firebase';
import { USE_MOCK_DATA } from '@/config/mock';
import { mockFetchMe, mockLogin, mockRefreshTokens, mockRegister } from '@/mock/data';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  updateProfile,
  type IdTokenResult,
  type User as FirebaseUser,
} from 'firebase/auth';

import { ApiError } from './errors';
import { AuthTokens, AuthTokensSchema, Role, RoleSchema, User, UserSchema } from '@/types/api';

export type LoginPayload = { email: string; password: string };
export type RegisterPayload = { name?: string; surname?: string; email: string; password: string; role?: string };

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

const ensureAuth = () => {
  if (!auth) {
    throw new ApiError({ status: 500, message: 'Firebase auth is disabled' });
  }
  return auth;
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

const buildUser = (user: FirebaseUser, role: Role, fallback?: { name?: string; surname?: string }): User => {
  if (!user.email) {
    throw new ApiError({ status: 400, message: 'Missing email on user' });
  }
  const { name, surname } = splitDisplayName(user.displayName, fallback);
  return UserSchema.parse({
    id: user.uid,
    email: user.email,
    name,
    surname,
    phone: user.phoneNumber ?? undefined,
    role,
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

export const login = async (payload: LoginPayload) => {
  if (USE_MOCK_DATA) {
    return mockLogin(payload);
  }

  const authClient = ensureAuth();
  const cred = await signInWithEmailAndPassword(authClient, payload.email, payload.password);
  const tokenResult = await cred.user.getIdTokenResult();
  const role = resolveRole(tokenResult.claims?.role);

  return {
    user: buildUser(cred.user, role),
    tokens: buildTokens(cred.user, tokenResult),
  };
};

export const register = async (payload: RegisterPayload) => {
  if (USE_MOCK_DATA) {
    return mockRegister(payload);
  }

  const authClient = ensureAuth();
  const cred = await createUserWithEmailAndPassword(authClient, payload.email, payload.password);
  const displayName = [payload.name, payload.surname].filter(Boolean).join(' ').trim();
  if (displayName) {
    await updateProfile(cred.user, { displayName });
  }

  const tokenResult = await cred.user.getIdTokenResult();
  const fallbackRoleResult = RoleSchema.safeParse(payload.role);
  const fallbackRole = fallbackRoleResult.success ? fallbackRoleResult.data : undefined;
  const role = resolveRole(tokenResult.claims?.role, fallbackRole);

  return {
    user: buildUser(cred.user, role, { name: payload.name, surname: payload.surname }),
    tokens: buildTokens(cred.user, tokenResult),
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
  return buildUser(user, role);
};
