<h1 align="center">Arrivio Carrier App (Expo)</h1>

Arrivio is an Expo Router based carrier app for bookings, map visibility, operational pulse, and issue reporting.
It uses React Query for data fetching and i18n (EN/TR). By default it runs with mock data.

## Quick overview
- Auth flow with Firebase (or mock), role check for "carrier"
- Bookings: create, list, detail, cancel
- Map: live facility pins on native, placeholder on web
- Pulse: operational KPIs and forecasts
- Issues: submit incident tickets
- Profile + Settings: user info, language toggle, logout

## Tech stack
- Expo + React Native + Expo Router
- React Query (@tanstack/react-query)
- i18next + react-i18next
- Firebase Auth (optional, disabled by default)
- Zod for runtime validation
- AsyncStorage + SecureStore for tokens
- react-native-maps (native) + web shim

## Run in VS Code
### Requirements
- Node.js 18+ and npm
- Expo CLI (use `npx expo`)
- Android Studio for Android emulator, Xcode for iOS (macOS)
- VS Code extension: `expo.vscode-expo-tools` (recommended)

### Install
1) Open the folder that contains `package.json` (this repo root) in VS Code.
2) Install dependencies:
   `npm install`
3) Create env file:
   - PowerShell: `Copy-Item .env.example .env`
   - macOS/Linux: `cp .env.example .env`

### Start
- `npx expo start` (or `npm run start`)
- In the Expo terminal:
  - press `a` for Android emulator
  - press `i` for iOS simulator (macOS)
  - press `w` for web
- Or use scripts:
  - `npm run android`
  - `npm run ios`
  - `npm run web`

### Notes on mock vs real services
- Default: `src/config/mock.ts` sets `USE_MOCK_DATA = true`. This lets the app run without a backend.
- To use real APIs:
  - set `USE_MOCK_DATA = false`
  - set `API_BASE_URL` in `.env`
  - ensure your backend matches the expected endpoints in `src/api/*`
- Auth uses Firebase in `src/api/auth.ts` when mocks are disabled.
  - `src/services/firebase.ts` is currently commented out. Uncomment and configure it when enabling Firebase.
  - fill Firebase keys in `.env` (see `.env.example`).

## Environment variables
See `.env.example`:
- `API_BASE_URL`: backend base URL (no trailing slash)
- `MAPS_API_KEY`: Google Maps key for geocoding and maps
- `SENTRY_DSN`, `ANALYTICS_KEY`: optional
- `FIREBASE_*`: Firebase config
- `APP_ENV`: storage key suffix (dev|staging|prod)

## Project structure
### Root config
- `package.json`: scripts and dependencies
- `app.config.ts`: dynamic Expo config + env extras
- `app.json`: static Expo config snapshot
- `metro.config.js`: web extensions + react-native-maps shim
- `tsconfig.json`: strict TS + `@/*` path alias
- `eslint.config.js`: Expo lint config
- `.env.example`: env template
- `expo-env.d.ts`: Expo types
- `scripts/reset-project.js`: reset template script
- `expo-start.log`, `expo-start.err.log`: local run logs
- `.vscode/`: workspace settings + recommended extension

### Routing (Expo Router) - `app/`
- `app/_layout.tsx`: App shell, ThemeProvider, QueryClient, AuthGate, fonts, i18n hydration
- `app/index.tsx`: redirect to home
- `app/modal.tsx`: modal screen sample
- `app/(auth)/login.tsx`: login UI with `useAuth.login`
- `app/(auth)/register.tsx`: registration UI with `useAuth.register`
- `app/(tabs)/_layout.tsx`: bottom tab navigation with haptics
- `app/(tabs)/home/index.tsx`: dashboard, booking summary, quick links
- `app/(tabs)/bookings/index.tsx`: list + stats + empty/error states
- `app/(tabs)/bookings/new.tsx`: create booking with slots/stations
- `app/(tabs)/bookings/[id].tsx`: booking detail + cancel
- `app/(tabs)/map/index.native.tsx`: native map with pins
- `app/(tabs)/map/index.tsx`: shared map (same as native)
- `app/(tabs)/map/index.web.tsx`: web placeholder
- `app/(tabs)/pulse/index.tsx`: ops pulse (forecast + station performance)
- `app/(tabs)/issues/index.tsx`: issue creation
- `app/(tabs)/profile/index.tsx`: profile view/edit (local update)
- `app/(tabs)/settings/index.tsx`: language toggle + logout

### Components
- `components/auth-context.tsx`: auth state, token refresh, role check, API client setup
- `components/gradient-button.tsx`: gradient button (uses `expo-linear-gradient` if installed)
- `components/haptic-tab.tsx`: haptic feedback on tab press
- `components/parallax-scroll-view.tsx`: parallax header helper
- `components/themed-text.tsx`: typography + tone system
- `components/themed-view.tsx`: themed container variants
- `components/ui/icon-symbol.tsx`: SF Symbols -> Material mapping
- `components/ui/icon-symbol.ios.tsx`: native SF Symbols on iOS
- `components/ui/collapsible.tsx`: collapsible section

### Constants and hooks
- `constants/theme.ts`: light/dark palette, font fallbacks
- `constants/images.ts`: image registry for assets (includes PDFs)
- `hooks/use-color-scheme.ts`: native color scheme
- `hooks/use-color-scheme.web.ts`: web hydration-safe scheme
- `hooks/use-theme-color.ts`: theme color resolver

### Data layer (`src/`)
- `src/api/client.ts`: request wrapper, token refresh, retries
- `src/api/auth.ts`: Firebase auth (or mock)
- `src/api/bookings.ts`: booking endpoints (or mock)
- `src/api/issues.ts`: issue endpoints (or mock)
- `src/api/errors.ts`: error mapping + Firebase error messages
- `src/config/index.ts`: appConfig from Expo `extra` with zod validation
- `src/config/mock.ts`: mock toggle
- `src/i18n/index.ts`: i18n setup (EN/TR)
- `src/mock/data.ts`: realistic mock facilities, bookings, issues, users
- `src/query/keys.ts`: React Query cache keys
- `src/services/geocoding.ts`: Google Geocoding helper
- `src/services/firebase.ts`: Firebase init (commented out by default)
- `src/storage/token-store.ts`: token persistence (SecureStore/AsyncStorage)
- `src/storage/language-store.ts`: language persistence
- `src/types/api.ts`: zod schemas and TypeScript types
- `src/shims/react-native-maps.tsx`: web shim for react-native-maps

### Assets and locales
- `assets/ChairoSansRegular-Regular.ttf`: primary font
- `assets/images/`: UI images, app icons, PDFs
- `locales/en/*.json`, `locales/tr/*.json`: translations

## Development tips
- If maps are needed on web, use the native apps instead; web map is a placeholder.
- When you switch env values, restart Metro with cache clear: `npx expo start -c`.
- For linting: `npm run lint` (tests are not configured).
