import '@/polyfills/intl-plural-rules';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enAuth from '@/locales/en/auth.json';
import enBooking from '@/locales/en/booking.json';
import enCommon from '@/locales/en/common.json';
import enHome from '@/locales/en/home.json';
import enIssue from '@/locales/en/issue.json';
import enMap from '@/locales/en/map.json';
import enProfile from '@/locales/en/profile.json';
import enPulse from '@/locales/en/pulse.json';
import enSettings from '@/locales/en/settings.json';
import trAuth from '@/locales/tr/auth.json';
import trBooking from '@/locales/tr/booking.json';
import trCommon from '@/locales/tr/common.json';
import trHome from '@/locales/tr/home.json';
import trIssue from '@/locales/tr/issue.json';
import trMap from '@/locales/tr/map.json';
import trProfile from '@/locales/tr/profile.json';
import trPulse from '@/locales/tr/pulse.json';
import trSettings from '@/locales/tr/settings.json';

const resources = {
  en: {
    auth: enAuth,
    booking: enBooking,
    common: enCommon,
    home: enHome,
    issue: enIssue,
    map: enMap,
    profile: enProfile,
    pulse: enPulse,
    settings: enSettings,
  },
  tr: {
    auth: trAuth,
    booking: trBooking,
    common: trCommon,
    home: trHome,
    issue: trIssue,
    map: trMap,
    profile: trProfile,
    pulse: trPulse,
    settings: trSettings,
  },
} as const;

const supported = Object.keys(resources);
const fallbackLng = 'en';

// eslint-disable-next-line import/no-named-as-default-member
void i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  lng: fallbackLng,
  fallbackLng: 'en',
  supportedLngs: supported,
  defaultNS: 'common',
  ns: ['common', 'auth', 'booking', 'home', 'issue', 'map', 'profile', 'pulse', 'settings'],
  resources,
  interpolation: { escapeValue: false },
});

export const supportedLanguages = supported;
export const defaultLanguage = fallbackLng;

export default i18n;
