import { describe, expect, it } from '@jest/globals';

import { ApiError, mapApiError, parseErrorResponse } from '@/api/errors';

/**
 * These tests cover shared API error helpers.
 * They are important because carrier screens depend on stable error objects
 * when Firebase or HTTP operations fail.
 */

describe('api error helpers', () => {
  it('keeps ApiError payload fields on the error instance', () => {
    const error = new ApiError({
      status: 503,
      message: 'Service unavailable',
      code: 'service/unavailable',
      details: { retryAfter: 30 },
      retryable: true,
    });

    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name: 'ApiError',
      message: 'Service unavailable',
      status: 503,
      code: 'service/unavailable',
      details: { retryAfter: 30 },
      retryable: true,
    });
  });

  it('returns existing ApiError instances without wrapping them again', () => {
    const original = new ApiError({
      status: 401,
      message: 'Unauthorized',
      code: 'auth/unauthorized',
    });

    expect(mapApiError(original)).toBe(original);
  });

  it.each([
    ['auth/invalid-email', 'Invalid email address.'],
    ['auth/user-disabled', 'This account has been disabled.'],
    ['auth/user-not-found', 'No account found for this email.'],
    ['auth/wrong-password', 'Incorrect password.'],
    ['auth/invalid-credential', 'Invalid email or password.'],
    ['auth/email-already-in-use', 'Email address is already in use.'],
    ['auth/weak-password', 'Password is too weak.'],
    ['auth/too-many-requests', 'Too many attempts. Try again later.'],
    ['auth/network-request-failed', 'Network error. Check your connection.'],
    ['auth/operation-not-allowed', 'Email/password sign-in is disabled in Firebase Authentication.'],
    ['auth/unauthorized-domain', 'This domain is not authorized in Firebase Authentication.'],
    ['auth/invalid-api-key', 'Firebase API key is invalid.'],
    ['auth/internal-error', 'Firebase returned an internal error. Check your Authentication settings.'],
  ])('maps Firebase error code %s to a safe message', (code, message) => {
    /**
     * Firebase errors often arrive as objects with only a code and message.
     * mapApiError should turn known auth codes into stable user-facing messages.
     */
    const error = mapApiError({ code, message: 'Raw Firebase message' });

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code,
      message,
    });
  });

  it('uses the provided message for unknown coded errors', () => {
    const error = mapApiError({
      code: 'firestore/permission-denied',
      message: 'Missing or insufficient permissions.',
    });

    expect(error).toMatchObject({
      code: 'firestore/permission-denied',
      message: 'Missing or insufficient permissions.',
    });
  });

  it('falls back to Unexpected error when a coded object has no code value', () => {
    const error = mapApiError({ code: undefined });

    expect(error).toMatchObject({
      code: '',
      message: 'Unexpected error',
    });
  });

  it('falls back to Unexpected error for coded objects without a message', () => {
    const error = mapApiError({ code: 'unknown/error' });

    expect(error).toMatchObject({
      code: 'unknown/error',
      message: 'Unexpected error',
    });
  });

  it('wraps plain Error instances with ApiError', () => {
    const error = mapApiError(new Error('Network failed'));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      message: 'Network failed',
    });
  });

  it('uses generic fallback for non-error values', () => {
    const error = mapApiError(null);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe('Unexpected error');
  });

  it('parses object error responses with message, code, details, and retryable status', () => {
    const body = {
      message: 'Server is busy',
      code: 'server/busy',
      extra: 'payload',
    };

    const error = parseErrorResponse(503, body);

    expect(error).toMatchObject({
      status: 503,
      message: 'Server is busy',
      code: 'server/busy',
      details: body,
      retryable: true,
    });
  });

  it('uses error and errorCode fields when message and code are not present', () => {
    const body = {
      error: 'Invalid request',
      errorCode: 'request/invalid',
    };

    const error = parseErrorResponse(400, body);

    expect(error).toMatchObject({
      status: 400,
      message: 'Invalid request',
      code: 'request/invalid',
      details: body,
      retryable: false,
    });
  });

  it('uses status fallback when an object response has no message or error text', () => {
    const body = {
      meta: 'no-message',
    };

    const error = parseErrorResponse(418, body);

    expect(error).toMatchObject({
      status: 418,
      message: 'Request failed with status 418',
      details: body,
      retryable: false,
    });
  });

  it('parses non-object error responses with status fallback and retryable flag', () => {
    const tooManyRequests = parseErrorResponse(429, 'Too many requests');
    const notFound = parseErrorResponse(404, undefined);

    expect(tooManyRequests).toMatchObject({
      status: 429,
      message: 'Request failed with status 429',
      retryable: true,
    });
    expect(notFound).toMatchObject({
      status: 404,
      message: 'Request failed with status 404',
      retryable: false,
    });
  });
});
