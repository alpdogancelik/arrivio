import { appConfig } from '@/config';

const FALLBACK_ENDPOINTS = {
  getStationsMM1ForSlotStart: 'https://getstationsmm1forslotstart-7xyjjmcxha-ey.a.run.app',
  enterQueue: 'https://enterqueue-7xyjjmcxha-ey.a.run.app',
} as const;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const resolveFunctionsBaseUrl = () => {
  const fromEnv = String(process.env.EXPO_PUBLIC_QUEUE_FUNCTIONS_BASE_URL ?? '').trim();
  if (fromEnv) return trimTrailingSlash(fromEnv);

  const fromConfig = String(appConfig.apiBaseUrl ?? '').trim();
  if (fromConfig) return trimTrailingSlash(fromConfig);

  return '';
};

const functionsBaseUrl = resolveFunctionsBaseUrl();

const withBase = (functionName: string, fallbackUrl: string) => {
  if (!functionsBaseUrl) return fallbackUrl;
  return `${functionsBaseUrl}/${functionName}`;
};

export const endPoints = {
  getStationsMM1ForSlotStart: withBase('getStationsMM1ForSlotStart', FALLBACK_ENDPOINTS.getStationsMM1ForSlotStart),
  enterQueue: withBase('enterQueue', FALLBACK_ENDPOINTS.enterQueue),
};
