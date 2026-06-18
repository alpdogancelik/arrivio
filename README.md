# Arrivio Carrier App

Arrivio is a carrier-facing booking and queue-management application for logistics facilities. It enables a carrier to authenticate, reserve an arrival slot, receive station recommendations based on expected waiting time, track booking and queue status, report operational issues, and manage profile availability from a mobile-first interface.

The application is built with Expo and React Native, supports iOS, Android, and static web deployment, and is localized in English and Turkish. It connects to live Firebase services for authentication, data storage, file uploads, server-side queue processing, and backend notification delivery.

## Key Capabilities

- Carrier authentication with Firebase Email/Password sign-in.
- Booking creation, listing, detail tracking, cancellation, and completion workflows.
- M/M/1-inspired station recommendation and queue estimation logic.
- Live Firestore-backed booking, queue, profile, and issue data.
- Carrier profile management, vehicle metadata, availability state, and blocked-account visibility.
- Issue reporting with Firebase Storage upload support.
- Backend notification delivery infrastructure for booking and status changes.
- Bilingual interface using English and Turkish resource files.
- Static web export for deployment on Vercel or Firebase Hosting.

## Technology Stack

- Expo 54 and React Native 0.81.
- Expo Router for file-based navigation.
- React 19 and React Query for UI state and server-state coordination.
- Firebase Auth, Firestore, Storage, Functions, and Hosting.
- i18next and react-i18next for localization.
- Zod for API and Firestore data validation.
- Jest and jest-expo for unit, integration, and performance tests.
- TypeScript for application and Cloud Functions source code.

## Architecture Overview

The app follows a screen-to-service separation:

- `app/` contains Expo Router screens and navigation structure.
- `src/api/` contains the carrier-facing data-access layer.
- `src/services/firebase.ts` initializes Firebase client services.
- `components/auth-context.tsx` owns session state and carrier profile gating.
- `src/types/api.ts` defines validated domain types used by API modules.
- `src/i18n/` and `locales/` provide English and Turkish translation resources.
- `functions/src/index.ts` contains Firebase Cloud Functions for backend queue, recommendation, booking-status, and notification workflows.

Screens should not call Firebase SDK operations directly. They should use API modules in `src/api/`, which normalize Firestore data and return typed application objects.

## Project Structure

```text
app/                         Expo Router screens and layouts
assets/                      Fonts, icons, and platform image assets
components/                  Shared React Native UI and app providers
constants/                   Theme and static asset references
functions/                   Firebase Cloud Functions source and build output
hooks/                       Shared React hooks
locales/                     English and Turkish translation files
src/api/                     Firebase-backed application API layer
src/config/                  Runtime configuration helpers
src/features/                Feature-specific client logic
src/i18n/                    i18next setup
src/services/                Firebase and notification services
src/storage/                 Local persistence helpers
src/types/                   Shared API/domain types
src/utils/                   Queue and recommendation utilities
tests/                       Unit, integration, performance, and manual test assets
```

## Getting Started

Install dependencies from the app root:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

On PowerShell:

```powershell
Copy-Item .env.example .env
```

Fill `.env` with the Firebase and runtime values required by your environment. The application reads both server-style Firebase keys and `EXPO_PUBLIC_*` equivalents through `app.config.ts`.

Start the Expo development server:

```bash
npm run start
```

Then launch the target platform from the Expo terminal prompt, or use one of the direct scripts:

```bash
npm run android
npm run ios
npm run web
```

## Available Scripts

```bash
npm run start             # Start Expo
npm run android           # Start Expo for Android
npm run ios               # Start Expo for iOS
npm run web               # Start Expo for web
npm run build:web         # Export a static web build to dist/
npm run vercel-build      # Vercel build alias for static export
npm run lint              # Run Expo lint
npm test                  # Run the Jest test suite
npm run test:unit         # Run unit tests
npm run test:integration  # Run integration tests
npm run test:coverage     # Run tests with coverage
```

For a TypeScript-only check:

```bash
npx tsc --noEmit
```

## Environment Configuration

The main configuration file is `app.config.ts`. Important environment values include:

- `FIREBASE_API_KEY` / `EXPO_PUBLIC_FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN` / `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID` / `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET` / `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID` / `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID` / `EXPO_PUBLIC_FIREBASE_APP_ID`
- `FIREBASE_MEASUREMENT_ID` / `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID`
- `GET_RECOMMENDATION_URL` / `EXPO_PUBLIC_GET_RECOMMENDATION_URL`
- `MAPS_API_KEY`
- `APP_ENV`
- `EXPO_PROJECT_ID`

Some Firebase fallback values are currently present in `app.config.ts` and `src/services/firebase.ts` so the development app can boot without a complete `.env`. For production or external delivery, prefer explicit environment configuration.

## Firebase Setup

Before using live data, configure Firebase for the intended project:

1. Enable Email/Password authentication.
2. Add local and deployed web domains to Firebase Auth authorized domains.
3. Deploy Firestore security rules from `firestore.rules`.
4. Deploy Cloud Functions from the `functions/` directory.
5. Configure Firebase Storage rules before enabling issue-photo uploads in production.

`firebase.json` is configured for Firestore rules, Storage rules, Cloud Functions, and Firebase Hosting. It currently expects a `storage.rules` file, so add or verify that file before running a full Firebase deploy.

## Recommendation and Queue Flow

Arrivio uses two recommendation paths:

- Booking creation calls external Cloud Run endpoints configured in `src/api/config.ts` for M/M/1 station selection and queue entry creation.
- Booking detail screens call the in-repo `getRecommendation` Cloud Function and can fall back to client-side calculation in `src/utils/recommendation.ts`.

The core recommendation utilities combine queue state, service-time assumptions, station capacity, and facility/station metadata to produce carrier-facing station suggestions.

## Testing

The test suite is organized by purpose:

- `tests/unit/` validates isolated API, queue, recommendation, and error-handling logic.
- `tests/performance/` measures carrier-side booking, queue, issue, and recommendation operations with deterministic mocked data.
- `tests/performance/manual/` contains manual performance logging guidance for live demonstrations.
- `tests/integration/` is reserved for end-to-end system-flow coverage.

Run focused tests during development and the full suite before final delivery:

```bash
npm run test:unit
npm test
```

## Web Deployment

Build the static web app:

```bash
npm run build:web
```

The generated output is written to `dist/`.

For Vercel:

- Install command: `npm install`
- Build command: `npm run vercel-build`
- Output directory: `dist`

For Firebase Hosting, `firebase.json` serves `dist/` through the configured `arriviocarrier` hosting site.

## Operational Notes

- `node_modules/`, `.expo/`, `.firebase/`, `coverage/`, and `dist/` are generated or local-only artifacts and should not be included in a clean source package.
- `.env` may contain project secrets or environment-specific values and should not be included in public submissions.
- Cloud Functions have their own dependencies and package lock under `functions/`.
- The web map uses a platform shim for `react-native-maps`; do not remove `src/shims/react-native-maps.tsx` without checking the web build.
- Locale files under `locales/en` and `locales/tr` are part of the shipped user experience and should stay in sync when changing visible copy.
