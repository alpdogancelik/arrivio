type Translator = (key: string, options?: Record<string, string>) => string;

export const localizeAuthError = (error: unknown, t: Translator) => {
  const code = String((error as any)?.code ?? '').toLowerCase();
  const message = String((error as any)?.message ?? error ?? '').toLowerCase();
  const raw = `${code} ${message}`;

  if (raw.includes('invalid-email')) {
    return t('auth:errorInvalidEmail', { defaultValue: 'Enter a valid email address.' });
  }

  if (raw.includes('invalid-credential') || raw.includes('wrong-password') || raw.includes('invalid email or password')) {
    return t('auth:errorInvalidCredentials', { defaultValue: 'Email or password is incorrect.' });
  }

  if (raw.includes('user-not-found') || raw.includes('no account found')) {
    return t('auth:errorUserNotFound', { defaultValue: 'No account was found for this email.' });
  }

  if (raw.includes('email-already-in-use') || raw.includes('already in use')) {
    return t('auth:errorEmailInUse', { defaultValue: 'This email address is already in use.' });
  }

  if (raw.includes('weak-password') || raw.includes('password is too weak')) {
    return t('auth:errorWeakPassword', { defaultValue: 'Password must be at least 6 characters.' });
  }

  if (raw.includes('too-many-requests') || raw.includes('too many attempts')) {
    return t('auth:errorTooManyRequests', { defaultValue: 'Too many attempts. Try again later.' });
  }

  if (raw.includes('network-request-failed') || raw.includes('network error')) {
    return t('auth:errorNetwork', { defaultValue: 'Network error. Check your connection.' });
  }

  if (raw.includes('permission-denied') || raw.includes('missing or insufficient permissions')) {
    return t('auth:errorPermissionDenied', {
      defaultValue: 'Registration could not be completed because the carrier profile could not be saved.',
    });
  }

  return t('auth:errorGeneric', { defaultValue: 'Something went wrong. Please try again.' });
};
