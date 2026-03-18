import AsyncStorage from '@react-native-async-storage/async-storage';

import { appConfig } from '@/config';
import { supportedLanguages } from '@/i18n';

const STORAGE_KEY = `carrier.language.${appConfig.appEnv}`;

export const saveLanguage = async (language: string) => {
  if (!language) return;
  await AsyncStorage.setItem(STORAGE_KEY, language);
};

export const loadLanguage = async () => {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (stored && supportedLanguages.includes(stored)) {
    return stored;
  }
  return null;
};
