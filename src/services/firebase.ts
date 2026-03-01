import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { type FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { type Auth, getAuth, initializeAuth } from 'firebase/auth';
import { type Firestore, getFirestore } from 'firebase/firestore';

import { assertFirebaseConfig } from '@/config';
import { USE_MOCK_DATA } from '@/config/mock';

const loadFirebaseConfig = () => {
  try {
    return assertFirebaseConfig();
  } catch {
    const manifest = Constants.manifest as { extra?: Record<string, any> } | null;
    const fallback = (Constants.expoConfig?.extra ?? manifest?.extra ?? {}) as Record<string, any>;
    const fallbackConfig = fallback.firebase as ReturnType<typeof assertFirebaseConfig> | undefined;
    if (fallbackConfig?.apiKey && fallbackConfig.projectId && fallbackConfig.appId) {
      return fallbackConfig;
    }

    const envConfig = {
      apiKey:
        process.env.EXPO_PUBLIC_FIREBASE_API_KEY ??
        process.env.FIREBASE_API_KEY ??
        'AIzaSyAkGusTXxtMF0aVkvvswhw0oUaBMDg4zRs',
      authDomain:
        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ??
        process.env.FIREBASE_AUTH_DOMAIN ??
        'arrivio-271aa.firebaseapp.com',
      projectId:
        process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID ?? 'arrivio-271aa',
      storageBucket:
        process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ??
        process.env.FIREBASE_STORAGE_BUCKET ??
        'arrivio-271aa.firebasestorage.app',
      messagingSenderId:
        process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ??
        process.env.FIREBASE_MESSAGING_SENDER_ID ??
        '262026810996',
      appId:
        process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? process.env.FIREBASE_APP_ID ?? '1:262026810996:web:3f558583945403d4a0a321',
      measurementId:
        process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID ?? process.env.FIREBASE_MEASUREMENT_ID ?? 'G-XG5Q7LSSPH',
    };

    if (envConfig.apiKey && envConfig.projectId && envConfig.appId) {
      return envConfig as ReturnType<typeof assertFirebaseConfig>;
    }

    return fallbackConfig;
  }
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

// Firebase init is intentionally disabled while USE_MOCK_DATA=true.
if (!USE_MOCK_DATA) {
  const firebaseConfig = loadFirebaseConfig();
  if (!firebaseConfig?.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
    throw new Error('Firebase config is missing. Check app.config.ts extra.firebase.');
  }

  const firebaseApp: FirebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  app = firebaseApp;
  db = getFirestore(firebaseApp);

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getReactNativePersistence } = require('firebase/auth/react-native') as {
      getReactNativePersistence: (storage: typeof AsyncStorage) => unknown;
    };

    auth = initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage) as any,
    });
  } catch {
    auth = getAuth(firebaseApp);
  }
}

export { app, auth, db };
