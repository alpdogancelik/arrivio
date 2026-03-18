import 'dotenv/config';

import { ConfigContext, ExpoConfig } from 'expo/config';

const appName = 'Arrivio';
const slug = 'arrivio';
const scheme = 'arrivio';
const version = '1.0.0';

export default ({ config }: ConfigContext): ExpoConfig => {
  const appEnv = process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development';
  const getRecommendationUrl =
    process.env.GET_RECOMMENDATION_URL ?? process.env.EXPO_PUBLIC_GET_RECOMMENDATION_URL ?? '';
  const firebaseApiKey =
    process.env.FIREBASE_API_KEY ?? process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? 'AIzaSyAkGusTXxtMF0aVkvvswhw0oUaBMDg4zRs';
  const firebaseAuthDomain =
    process.env.FIREBASE_AUTH_DOMAIN ?? process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'arrivio-271aa.firebaseapp.com';
  const firebaseProjectId =
    process.env.FIREBASE_PROJECT_ID ?? process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'arrivio-271aa';
  const firebaseStorageBucket =
    process.env.FIREBASE_STORAGE_BUCKET ??
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    'arrivio-271aa.firebasestorage.app';
  const firebaseMessagingSenderId =
    process.env.FIREBASE_MESSAGING_SENDER_ID ?? process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '262026810996';
  const firebaseAppId =
    process.env.FIREBASE_APP_ID ?? process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '1:262026810996:web:3f558583945403d4a0a321';
  const firebaseMeasurementId =
    process.env.FIREBASE_MEASUREMENT_ID ?? process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID ?? 'G-XG5Q7LSSPH';

  return {
    ...config,
    name: appName,
    slug,
    version,
    orientation: 'portrait',
    icon: './assets/images/android/playstore-icon.png',
    scheme,
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      icon: './assets/images/ios/iTunesArtwork@2x.png',
    },
    android: {
      icon: './assets/images/android/playstore-icon.png',
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android/mipmap-xxxhdpi/ic_launcher_foreground.png',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: 'static',
      favicon: './assets/images/android/ic_launcher-web.png',
    },
    plugins: [
      'expo-router',
      'expo-font',
      [
        'expo-splash-screen',
        {
          image: './assets/images/android/ic_launcher-web.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
          dark: { backgroundColor: '#000000' },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      apiBaseUrl: process.env.API_BASE_URL ?? '',
      mapsApiKey: process.env.MAPS_API_KEY ?? '',
      sentryDsn: process.env.SENTRY_DSN ?? '',
      analyticsKey: process.env.ANALYTICS_KEY ?? '',
      getRecommendationUrl,
      firebase: {
        apiKey: firebaseApiKey,
        authDomain: firebaseAuthDomain,
        projectId: firebaseProjectId,
        storageBucket: firebaseStorageBucket,
        messagingSenderId: firebaseMessagingSenderId,
        appId: firebaseAppId,
        measurementId: firebaseMeasurementId,
      },
      appEnv,
      eas: {
        projectId: process.env.EXPO_PROJECT_ID ?? undefined,
      },
    },
  };
};
