export type ApiErrorShape = {
  status?: number;
  message: string;
  code?: string;
  details?: unknown;
  retryable?: boolean;
};

export class ApiError extends Error {
  status?: number;
  code?: string;
  details?: unknown;
  retryable?: boolean;

  constructor(payload: ApiErrorShape) {
    super(payload.message);
    this.name = 'ApiError';
    this.status = payload.status;
    this.code = payload.code;
    this.details = payload.details;
    this.retryable = payload.retryable;
  }
}

const firebaseAuthMessages: Record<string, string> = {
  'auth/invalid-email': 'Invalid email address.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/user-not-found': 'No account found for this email.',
  'auth/wrong-password': 'Incorrect password.',
  'auth/email-already-in-use': 'Email address is already in use.',
  'auth/weak-password': 'Password is too weak.',
  'auth/too-many-requests': 'Too many attempts. Try again later.',
  'auth/network-request-failed': 'Network error. Check your connection.',
};

export const mapApiError = (error: unknown): ApiError => {
  if (error instanceof ApiError) return error;
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code?: string }).code ?? '');
    const message =
      (code.startsWith('auth/') && firebaseAuthMessages[code]) ||
      (error as { message?: string }).message ||
      'Unexpected error';
    return new ApiError({ message, code });
  }
  if (error instanceof Error) return new ApiError({ message: error.message });
  return new ApiError({ message: 'Unexpected error' });
};

export const parseErrorResponse = (status: number, body: unknown): ApiError => {
  if (body && typeof body === 'object') {
    const data = body as Record<string, any>;
    const message = data.message || data.error || `Request failed with status ${status}`;
    return new ApiError({
      status,
      message,
      code: data.code ?? data.errorCode,
      details: data,
      retryable: status >= 500 || status === 429,
    });
  }

  return new ApiError({
    status,
    message: `Request failed with status ${status}`,
    retryable: status >= 500 || status === 429,
  });
};
