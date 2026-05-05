import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { localizeAuthError } from '@/utils/auth-error';

type Translator = (key: string, options?: Record<string, string>) => string;

type AuthErrorCase = {
  name: string;
  error: unknown;
  expectedKey: string;
  expectedMessage: string;
};

describe('carrier auth error localization', () => {
  /**
   * The real application uses i18next's `t` function.
   * In unit tests, we do not test i18next itself.
   *
   * This mock translator returns the provided defaultValue so the test can focus only on:
   * 1. whether the Firebase/raw error is mapped to the correct translation key
   * 2. whether the fallback message shown to the carrier is safe and understandable
   */
  const t = jest.fn<Translator>((key, options) => options?.defaultValue ?? key);

  beforeEach(() => {
    t.mockClear();
  });

  const authErrorCases: AuthErrorCase[] = [
    {
      name: 'maps invalid email format errors',
      error: { code: 'auth/invalid-email' },
      expectedKey: 'auth:errorInvalidEmail',
      expectedMessage: 'Enter a valid email address.',
    },
    {
      name: 'maps Firebase invalid credential errors',
      error: { code: 'auth/invalid-credential' },
      expectedKey: 'auth:errorInvalidCredentials',
      expectedMessage: 'Email or password is incorrect.',
    },
    {
      name: 'maps older wrong password errors',
      error: { code: 'auth/wrong-password' },
      expectedKey: 'auth:errorInvalidCredentials',
      expectedMessage: 'Email or password is incorrect.',
    },
    {
      name: 'maps message-only invalid credential errors',
      error: new Error('Invalid email or password'),
      expectedKey: 'auth:errorInvalidCredentials',
      expectedMessage: 'Email or password is incorrect.',
    },
    {
      name: 'maps user not found errors',
      error: { code: 'auth/user-not-found' },
      expectedKey: 'auth:errorUserNotFound',
      expectedMessage: 'No account was found for this email.',
    },
    {
      name: 'maps duplicate email registration errors',
      error: { code: 'auth/email-already-in-use' },
      expectedKey: 'auth:errorEmailInUse',
      expectedMessage: 'This email address is already in use.',
    },
    {
      name: 'maps weak password errors',
      error: { code: 'auth/weak-password' },
      expectedKey: 'auth:errorWeakPassword',
      expectedMessage: 'Password must be at least 6 characters.',
    },
    {
      name: 'maps too many request errors',
      error: { code: 'auth/too-many-requests' },
      expectedKey: 'auth:errorTooManyRequests',
      expectedMessage: 'Too many attempts. Try again later.',
    },
    {
      name: 'maps Firebase network request failures',
      error: { code: 'auth/network-request-failed' },
      expectedKey: 'auth:errorNetwork',
      expectedMessage: 'Network error. Check your connection.',
    },
    {
      name: 'maps message-only network errors',
      error: new Error('Network error'),
      expectedKey: 'auth:errorNetwork',
      expectedMessage: 'Network error. Check your connection.',
    },
    {
      name: 'maps Firestore permission errors during registration',
      error: { code: 'permission-denied' },
      expectedKey: 'auth:errorPermissionDenied',
      expectedMessage:
        'Registration could not be completed because the carrier profile could not be saved.',
    },
    {
      name: 'falls back to a generic message for unknown errors',
      error: { code: 'auth/unexpected' },
      expectedKey: 'auth:errorGeneric',
      expectedMessage: 'Something went wrong. Please try again.',
    },
  ];

  it.each(authErrorCases)('$name', ({ error, expectedKey, expectedMessage }) => {
    /**
     * Each case simulates a possible Firebase/Auth failure.
     * The function should never expose raw Firebase error codes directly to the carrier.
     */
    const message = localizeAuthError(error, t);

    /**
     * The returned message is what the carrier would see on the login/register screen.
     * It must be clear, user-facing, and safe for unexpected technical failures.
     */
    expect(message).toBe(expectedMessage);

    /**
     * The translation key is also checked because the UI depends on this key
     * when English/Turkish localization is enabled.
     */
    expect(t).toHaveBeenCalledTimes(1);
    expect(t).toHaveBeenCalledWith(expectedKey, {
      defaultValue: expectedMessage,
    });
  });

  it('handles uppercase error codes and messages safely', () => {
    /**
     * Firebase and custom errors may not always arrive in the exact same casing.
     * This verifies that normalization works before matching the error type.
     */
    const message = localizeAuthError(
      { code: 'AUTH/INVALID-CREDENTIAL', message: 'WRONG-PASSWORD' },
      t,
    );

    expect(message).toBe('Email or password is incorrect.');
    expect(t).toHaveBeenCalledWith('auth:errorInvalidCredentials', {
      defaultValue: 'Email or password is incorrect.',
    });
  });

  it('handles completely empty error objects with the generic fallback', () => {
    /**
     * Defensive test for unexpected runtime cases.
     * Even if the error object is empty, the carrier should still receive a stable message.
     */
    const message = localizeAuthError({}, t);

    expect(message).toBe('Something went wrong. Please try again.');
    expect(t).toHaveBeenCalledWith('auth:errorGeneric', {
      defaultValue: 'Something went wrong. Please try again.',
    });
  });
});
