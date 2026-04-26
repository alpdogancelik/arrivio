# Arrivio Carrier App

Arrivio is an Expo Router carrier app for booking management, facility visibility, queue monitoring, issue reporting, profile management, and bilingual operation in English and Turkish.

## Stack

- Expo 54 and React Native 0.81
- Expo Router
- React Query
- Firebase Auth, Firestore, and Firebase Storage
- Firebase Functions
- i18next and react-i18next
- Zod

## Current Behavior

- The app uses live Firebase services only. Mock data files and mock mode have been removed.
- Email/password auth is handled by Firebase Auth.
- Carrier profile data is read from Firestore.
- Bookings, facilities, stations, queue entries, queue events, reports, and issues are read from Firestore.
- Issue photos are uploaded to Firebase Storage.
- Station recommendations can use the configured Firebase Function URL, with client-side fallback logic where supported.

## Setup

Install dependencies:

```bash
npm install
```

Create `.env`:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

Fill the Firebase values in `.env`, then start Expo:

```bash
npm run start
```

Useful commands:

```bash
npm run android
npm run ios
npm run web
npm run lint
npx tsc --noEmit
```

## Environment

The template lives in `.env.example`.

Important values:

- `MAPS_API_KEY`
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `FIREBASE_MEASUREMENT_ID`
- `EXPO_PUBLIC_FIREBASE_*`
- `EXPO_PUBLIC_GET_RECOMMENDATION_URL`
- `EXPO_PUBLIC_GET_STATIONS_MM1_FOR_SLOT_START_URL`
- `EXPO_PUBLIC_ENTER_QUEUE_URL`
- `APP_ENV`

## Firebase

Before running against live data:

- Enable Email/Password auth in Firebase Authentication.
- Add local and deployed web domains to Firebase Authentication authorized domains.
- Deploy Firestore rules from `firestore.rules`.
- Deploy Storage rules from `storage.rules`.
- Deploy Functions from `functions/src/index.ts` when using the recommendation endpoints.

## Web Deployment

The web build is exported as static files:

```bash
npm run build:web
```

Vercel can use:

- Install Command: `npm install`
- Build Command: `npm run vercel-build`
- Output Directory: `dist`

## Main Paths

- `app/(auth)`: login, register, forgot password
- `app/(tabs)/home`: dashboard
- `app/(tabs)/bookings`: booking list, detail, and creation
- `app/(tabs)/map`: native and web map views
- `app/(tabs)/issues`: issue reporting and recent issues
- `app/(tabs)/profile`: carrier profile
- `app/(tabs)/settings`: language and session settings
- `src/api`: Firebase and function API layer
- `src/services/firebase.ts`: Firebase initialization
- `src/i18n/index.ts`: localization bootstrap
- `src/query/keys.ts`: React Query keys
- `src/utils/recommendation.ts`: recommendation utilities
- `functions/src/index.ts`: Firebase Functions source

## Quality Checks

Run these before committing:

```bash
npm run lint
npx tsc --noEmit
```
