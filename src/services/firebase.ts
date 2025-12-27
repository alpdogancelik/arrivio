/*
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { type FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { type Auth, getAuth, initializeAuth } from 'firebase/auth';
import { getReactNativePersistence } from 'firebase/auth/react-native';

import { assertFirebaseConfig } from '@/config';
import { USE_MOCK_DATA } from '@/config/mock';

const loadFirebaseConfig = () => {
  try {
    return assertFirebaseConfig();
  } catch {
    const manifest = Constants.manifest as { extra?: Record<string, any> } | null;
    const fallback = (Constants.expoConfig?.extra ?? manifest?.extra ?? {}) as Record<string, any>;
    return fallback.firebase as ReturnType<typeof assertFirebaseConfig> | undefined;
  }
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

// Firebase init is intentionally disabled while USE_MOCK_DATA=true.
if (!USE_MOCK_DATA) {
  const firebaseConfig = loadFirebaseConfig();
  if (!firebaseConfig?.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
    throw new Error('Firebase config is missing. Check app.config.ts extra.firebase.');
  }

  const firebaseApp: FirebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  app = firebaseApp;

  try {
    auth = initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    auth = getAuth(firebaseApp);
  }
}

export { app, auth };
*/