import Constants from 'expo-constants';
import { z } from 'zod';

const stripTrailingSlash = (url: string) => (url.endsWith('/') ? url.slice(0, -1) : url);

const FirebaseSchema = z.object({
  apiKey: z.string().trim().optional().default(''),
  authDomain: z.string().optional().default(''),
  projectId: z.string().trim().optional().default(''),
  storageBucket: z.string().optional().default(''),
  messagingSenderId: z.string().optional().default(''),
  appId: z.string().trim().optional().default(''),
  measurementId: z.string().optional().default(''),
});

const ExtraSchema = z.object({
  apiBaseUrl: z.string().trim().optional().default(''),
  mapsApiKey: z.string().optional().default(''),
  sentryDsn: z.string().optional().default(''),
  analyticsKey: z.string().optional().default(''),
  getRecommendationUrl: z.string().trim().optional().default(''),
  authDisabled: z.boolean().optional().default(false),
  appEnv: z.string().optional().default('development'),
  firebase: FirebaseSchema.optional(),
});

const manifest = Constants.manifest as { extra?: Record<string, unknown> } | null;
const extra = (Constants.expoConfig?.extra ?? manifest?.extra ?? {}) as Record<string, unknown>;
const parsed = ExtraSchema.safeParse(extra);

if (!parsed.success) {
  console.warn('Expo extra config is invalid', parsed.error.flatten().fieldErrors);
}

export const appConfig = {
  apiBaseUrl: parsed.success ? stripTrailingSlash(parsed.data.apiBaseUrl) : '',
  mapsApiKey: parsed.success ? parsed.data.mapsApiKey : '',
  sentryDsn: parsed.success ? parsed.data.sentryDsn : '',
  analyticsKey: parsed.success ? parsed.data.analyticsKey : '',
  getRecommendationUrl: parsed.success ? stripTrailingSlash(parsed.data.getRecommendationUrl) : '',
  authDisabled: parsed.success ? parsed.data.authDisabled : false,
  appEnv: parsed.success ? parsed.data.appEnv : 'development',
  version: Constants.expoConfig?.version ?? '0.0.0',
  firebase: parsed.success ? parsed.data.firebase ?? null : null,
};

export type AppConfig = typeof appConfig;

export function assertConfigValue<K extends keyof AppConfig>(key: K): AppConfig[K] {
  const value = appConfig[key];
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing configuration value for ${key}`);
  }
  return value;
}

export type FirebaseConfig = NonNullable<AppConfig['firebase']>;

export function assertFirebaseConfig(): FirebaseConfig {
  if (!appConfig.firebase) {
    throw new Error('Missing configuration value for firebase');
  }
  if (!appConfig.firebase.apiKey || !appConfig.firebase.projectId || !appConfig.firebase.appId) {
    throw new Error('Firebase config is missing. Check app.config.ts extra.firebase.');
  }
  return appConfig.firebase;
}
