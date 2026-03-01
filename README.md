# Arrivio Carrier App

Arrivio is an Expo Router based carrier application for booking management, facility visibility, queue monitoring, operational reporting, and issue tracking. The app is bilingual (`EN` / `TR`), starts in English for first-time users, and is currently configured to run against Firebase and Firestore by default.

## What is included

- Email/password authentication with Firebase
- Register, sign in, forgot password, and email verification guidance
- Language switching on auth screens and in settings
- Booking list, detail, creation, and cancellation flows
- Queue, station, pulse, issue, and report data access through `src/api/*`
- Native map screen with a web fallback screen
- Firebase Functions and Firestore rules configuration in this repository

## Current app behavior

- Default language for new users is English
- Language preference is stored locally after the first change
- Registration shows a message asking the user to check email verification, including spam folder guidance
- Sign-in shows an English error when email or password is invalid
- `USE_MOCK_DATA` is currently set to `false` in [src/config/mock.ts](/c:/Users/alpdo/Downloads/transportation-management-system-main/transportation-management-system-main/src/config/mock.ts)

## Tech stack

- Expo 54
- React Native 0.81
- Expo Router
- React Query
- Firebase Auth
- Firestore
- Firebase Functions
- i18next + react-i18next
- Zod

## Requirements

- Node.js 18 or newer
- npm
- Expo Go or a simulator/emulator
- Firebase project configured for:
  - Authentication
  - Firestore
  - Functions

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from the example file:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Fill the Firebase values in `.env`.

4. Start the app:

```bash
npm run start
```

If you want a fixed port:

```bash
npm run start -- --port 8082
```

## Environment variables

The template lives in [.env.example](/c:/Users/alpdo/Downloads/transportation-management-system-main/transportation-management-system-main/.env.example).

Important values:

- `API_BASE_URL`
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
- `APP_ENV`

## Firebase notes

- Firebase app initialization lives in [src/services/firebase.ts](/c:/Users/alpdo/Downloads/transportation-management-system-main/transportation-management-system-main/src/services/firebase.ts)
- Expo config wiring lives in [app.config.ts](/c:/Users/alpdo/Downloads/transportation-management-system-main/transportation-management-system-main/app.config.ts)
- Firestore rules are in [firestore.rules](/c:/Users/alpdo/Downloads/transportation-management-system-main/transportation-management-system-main/firestore.rules)
- Firebase deployment config is in [firebase.json](/c:/Users/alpdo/Downloads/transportation-management-system-main/transportation-management-system-main/firebase.json)
- Cloud Functions source is in [functions/src/index.ts](/c:/Users/alpdo/Downloads/transportation-management-system-main/transportation-management-system-main/functions/src/index.ts)

Before testing auth on web, make sure:

- Email/Password auth is enabled in Firebase Authentication
- `localhost` is added to Firebase authorized domains
- Firestore rules are deployed if you rely on live data

## Useful scripts

- `npm run start`
- `npm run android`
- `npm run ios`
- `npm run web`
- `npm run lint`
- `npx tsc --noEmit`

## Project structure

### App routes

- [app/_layout.tsx](/c:/Users/alpdo/Downloads/transportation-management-system-main/transportation-management-system-main/app/_layout.tsx): app shell, providers, auth redirects
- [app/(auth)/login.tsx](/c:/Users/alpdo/Downloads/transportation-management-system-main/transportation-management-system-main/app/(auth)/login.tsx): sign-in screen
- [app/(auth)/register.tsx](/c:/Users/alpdo/Downloads/transportation-management-system-main/transportation-management-system-main/app/(auth)/register.tsx): register screen
- [app/(auth)/forgot-password.tsx](/c:/Users/alpdo/Downloads/transportation-management-system-main/transportation-management-system-main/app/(auth)/forgot-password.tsx): password reset screen
- [app/(tabs)/home/index.tsx](/c:/Users/alpdo/Downloads/transportation-management-system-main/transportation-management-system-main/app/(tabs)/home/index.tsx): dashboard
- [app/(tabs)/bookings/index.tsx](/c:/Users/alpdo/Downloads/transportation-management-system-main/transportation-management-system-main/app/(tabs)/bookings/index.tsx): bookings list
- [app/(tabs)/bookings/new.tsx](/c:/Users/alpdo/Downloads/transportation-management-system-main/transportation-management-system-main/app/(tabs)/bookings/new.tsx): create booking
- [app/(tabs)/bookings/[id].tsx](/c:/Users/alpdo/Downloads/transportation-management-system-main/transportation-management-system-main/app/(tabs)/bookings/[id].tsx): booking detail
- [app/(tabs)/map/index.tsx](/c:/Users/alpdo/Downloads/transportation-management-system-main/transportation-management-system-main/app/(tabs)/map/index.tsx): shared map screen
- [app/(tabs)/map/index.native.tsx](/c:/Users/alpdo/Downloads/transportation-management-system-main/transportation-management-system-main/app/(tabs)/map/index.native.tsx): native map implementation
- [app/(tabs)/map/index.web.tsx](/c:/Users/alpdo/Downloads/transportation-management-system-main/transportation-management-system-main/app/(tabs)/map/index.web.tsx): web fallback
- [app/(tabs)/issues/index.tsx](/c:/Users/alpdo/Downloads/transportation-management-system-main/transportation-management-system-main/app/(tabs)/issues/index.tsx): issues
- [app/(tabs)/pulse/index.tsx](/c:/Users/alpdo/Downloads/transportation-management-system-main/transportation-management-system-main/app/(tabs)/pulse/index.tsx): pulse analytics
- [app/(tabs)/profile/index.tsx](/c:/Users/alpdo/Downloads/transportation-management-system-main/transportation-management-system-main/app/(tabs)/profile/index.tsx): profile
- [app/(tabs)/settings/index.tsx](/c:/Users/alpdo/Downloads/transportation-management-system-main/transportation-management-system-main/app/(tabs)/settings/index.tsx): language and session settings

### Shared code

- [components/auth-context.tsx](/c:/Users/alpdo/Downloads/transportation-management-system-main/transportation-management-system-main/components/auth-context.tsx): auth state and session helpers
- [src/api](/c:/Users/alpdo/Downloads/transportation-management-system-main/transportation-management-system-main/src/api): API layer
- [src/i18n/index.ts](/c:/Users/alpdo/Downloads/transportation-management-system-main/transportation-management-system-main/src/i18n/index.ts): i18n bootstrap
- [src/storage](/c:/Users/alpdo/Downloads/transportation-management-system-main/transportation-management-system-main/src/storage): local persistence
- [src/query/keys.ts](/c:/Users/alpdo/Downloads/transportation-management-system-main/transportation-management-system-main/src/query/keys.ts): React Query cache keys
- [src/utils/recommendation.ts](/c:/Users/alpdo/Downloads/transportation-management-system-main/transportation-management-system-main/src/utils/recommendation.ts): recommendation utilities

## Development notes

- If Metro behaves strangely, restart with cache clear:

```bash
npx expo start -c
```

- Web uses the Expo Router web build and does not render the native map implementation.
- Log files such as `expo-start*.log` are local-only and ignored by Git.

## Quality checks

Use these before committing:

```bash
npm run lint
npx tsc --noEmit
```
