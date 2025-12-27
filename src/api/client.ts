import { appConfig, assertConfigValue } from '@/config';
import { ApiError, mapApiError, parseErrorResponse } from './errors';
import { AuthTokens } from '@/types/api';
import { z } from 'zod';

type QueryValue = string | number | boolean | null | undefined;
type RequestOptions<T> = {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, QueryValue>;
  body?: Record<string, any> | FormData | null;
  headers?: Record<string, string>;
  auth?: boolean;
  retries?: number;
  signal?: AbortSignal;
  schema?: z.ZodType<T, z.ZodTypeDef, unknown>;
};

let tokenProvider: (() => AuthTokens | null) | null = null;
let refreshHandler: (() => Promise<AuthTokens | null>) | null = null;
let unauthorizedHandler: (() => void) | null = null;
let refreshPromise: Promise<AuthTokens | null> | null = null;

export const configureClient = (options: {
  getTokens: () => AuthTokens | null;
  refreshTokens?: () => Promise<AuthTokens | null>;
  onUnauthorized?: () => void;
}) => {
  tokenProvider = options.getTokens;
  refreshHandler = options.refreshTokens ?? null;
  unauthorizedHandler = options.onUnauthorized ?? null;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const buildUrl = (path: string, query?: Record<string, QueryValue>) => {
  const base = assertConfigValue('apiBaseUrl');
  const url = new URL(path.replace(/^\//, ''), `${base}/`);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      url.searchParams.append(key, String(value));
    });
  }

  return url.toString();
};

const refreshTokensOnce = async () => {
  if (!refreshHandler) return null;
  if (!refreshPromise) {
    refreshPromise = refreshHandler().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

export async function request<T = unknown>(options: RequestOptions<T>): Promise<T> {
  const { method = 'GET', query, body, headers, auth = true, retries = 1, signal, schema } = options;
  if (!appConfig.apiBaseUrl) {
    throw new ApiError({ message: 'API_BASE_URL is not set. Check your .env' });
  }

  const url = buildUrl(options.path, query);
  const maxAttempts = Math.max(1, retries + 1);
  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      let token = auth ? tokenProvider?.() : null;
      if (auth && token?.expiresAt && refreshHandler) {
        const now = Math.floor(Date.now() / 1000);
        if (token.expiresAt - now <= 60) {
          const refreshed = await refreshTokensOnce();
          token = refreshed ?? token;
        }
      }
      const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

      const response = await fetch(url, {
        method,
        signal,
        headers: {
          Accept: 'application/json',
          ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
          ...(token?.accessToken ? { Authorization: `Bearer ${token.accessToken}` } : {}),
          ...headers,
        },
        body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
      });

      const contentType = response.headers.get('content-type') ?? '';
      const rawBody = contentType.includes('application/json')
        ? await response.json().catch(() => null)
        : await response.text().catch(() => null);
      const data = rawBody && typeof rawBody === 'object' && 'data' in (rawBody as any) ? (rawBody as any).data : rawBody;

      if (response.status === 401 && auth) {
        const refreshed = await refreshTokensOnce();
        if (refreshed) {
          continue; // retry with new token
        }
        unauthorizedHandler?.();
        throw new ApiError({ status: 401, message: 'Unauthorized' });
      }

      if (!response.ok) {
        if (attempt < maxAttempts - 1 && (response.status >= 500 || response.status === 429)) {
          await delay(200 * Math.pow(2, attempt));
          continue;
        }
        throw parseErrorResponse(response.status, data);
      }

      const payload = data ?? (null as T);
      return schema ? schema.parse(payload) : (payload as T);
    } catch (error) {
      const apiErr = mapApiError(error);
      lastError = apiErr;

      if (attempt < maxAttempts - 1 && apiErr.retryable !== false) {
        await delay(200 * Math.pow(2, attempt));
        continue;
      }

      throw apiErr;
    }
  }

  throw lastError ?? new ApiError({ message: 'Unknown error' });
}
