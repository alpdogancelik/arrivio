import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { appConfig } from '@/config';
import { AuthTokens, AuthTokensSchema } from '@/types/api';

const STORAGE_KEY = `carrier.auth.tokens.${appConfig.appEnv}`;

const readSecureStore = async () => {
  try {
    const available = await SecureStore.isAvailableAsync();
    if (!available) return null;
    return SecureStore.getItemAsync(STORAGE_KEY);
  } catch {
    return null;
  }
};

const writeSecureStore = async (value: string) => {
  try {
    const available = await SecureStore.isAvailableAsync();
    if (!available) return false;
    await SecureStore.setItemAsync(STORAGE_KEY, value);
    return true;
  } catch {
    return false;
  }
};

export const saveTokens = async (tokens: AuthTokens | null) => {
  if (!tokens) {
    await clearTokens();
    return;
  }

  const serialized = JSON.stringify(tokens);
  const savedToSecure = await writeSecureStore(serialized);
  if (!savedToSecure) {
    await AsyncStorage.setItem(STORAGE_KEY, serialized);
  }
};

export const loadTokens = async (): Promise<AuthTokens | null> => {
  const raw = (await readSecureStore()) ?? (await AsyncStorage.getItem(STORAGE_KEY));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return AuthTokensSchema.parse(parsed);
  } catch {
    await clearTokens();
    return null;
  }
};

export const clearTokens = async () => {
  try {
    const available = await SecureStore.isAvailableAsync();
    if (available) {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
    }
  } catch {
    // Ignore secure store failures to avoid blocking logout.
  }
  await AsyncStorage.removeItem(STORAGE_KEY);
};
