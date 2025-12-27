import 'dotenv/config';

import { ConfigContext, ExpoConfig } from 'expo/config';

const appName = 'Arrivio';
const slug = 'arrivio';
const scheme = 'arrivio';
const version = '1.0.0';

export default ({ config }: ConfigContext): ExpoConfig => {
  const appEnv = process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development';

  return {
    ...config,
    name: appName,
    slug,
    version,
    orientation: 'portrait',
    icon: './assets/images/icon.png',
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
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
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
      firebase: {
        apiKey: process.env.FIREBASE_API_KEY ?? '',
        authDomain: process.env.FIREBASE_AUTH_DOMAIN ?? '',
        projectId: process.env.FIREBASE_PROJECT_ID ?? '',
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? '',
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID ?? '',
        appId: process.env.FIREBASE_APP_ID ?? '',
        measurementId: process.env.FIREBASE_MEASUREMENT_ID ?? '',
      },
      appEnv,
      eas: {
        projectId: process.env.EXPO_PROJECT_ID ?? undefined,
      },
    },
  };
};
