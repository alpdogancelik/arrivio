# Last Changes - Alp

Date: 2026-04-26
Branch: dev

## Summary

This update cleans the carrier mobile app around the current Firebase-backed flow, removes unused mock/dead code, trims unused assets, aligns localization keys, and keeps the existing MM1 queue integration intact.

## Important MM1 Note

The MM1 system remains on the existing group implementation.

- `src/api/MM1.ts` uses `endPoints` from `src/api/config.ts`.
- `src/api/config.ts` keeps the existing Cloud Run URLs:
  - `getStationsMM1ForSlotStart`
  - `enterQueue`
- No new `EXPO_PUBLIC_GET_STATIONS_MM1_FOR_SLOT_START_URL` or `EXPO_PUBLIC_ENTER_QUEUE_URL` requirement is used by the app.
- The booking creation screen still calls:
  - `fetchStationsMM1ForSlotStart` when a slot is selected
  - `enterQueue` when the booking is confirmed

## App Flow Updates

- Updated auth screens for a more polished and consistent login/register/forgot-password experience.
- Updated tab screens and shared layouts for the current carrier app structure.
- Removed the old pulse tab and pulse locale files.
- Kept booking list, booking detail, and booking creation aligned with the live Firebase/MM1 flow.
- Updated map screens and moved map data into `app/(tabs)/map/map-data.ts`.
- Improved profile, settings, home, issues, bookings, and map screen consistency.

## Firebase And API Cleanup

- Removed mock mode and mock data usage from the app.
- Deleted `src/mock/data.ts`.
- Deleted `src/config/mock.ts`.
- Removed mock branches from API modules.
- Removed the unused generic API client.
- Removed unused report and geocoding API/service files.
- Kept Firebase initialization as the live data path.
- Kept the existing MM1 endpoint configuration file because it is still used by booking creation.

## Deleted Unused Code

- `components/gradient-button.tsx`
- `components/screen-state.tsx`
- `components/ui/icon-symbol.tsx`
- `src/api/client.ts`
- `src/api/reports.ts`
- `src/services/geocoding.ts`
- `src/mock/data.ts`
- `src/config/mock.ts`
- Pulse route and pulse locale files

## Asset Cleanup

Unused large image assets were removed from `assets/images`.

Kept assets still used by the app:

- `Alarm.png`
- `House Icon.png`
- `Pin.png`
- app icon folders under `assets/images/android`
- iOS icon folder under `assets/images/ios`
- `ChairoSansRegular-Regular.ttf`

## Localization

- Updated English and Turkish locale files.
- Added missing booking, map, issue, profile, home, settings, and common keys.
- Removed unused pulse locale files.
- Checked locale key alignment after updates.

## Type And Query Cleanup

- Removed unused API schemas and query keys.
- Simplified booking and queue-entry related types around the current screens.
- Removed unused report-related types and query keys.
- Kept MM1 response typing compatible with the existing Cloud Run response.

## Documentation

- Rewrote `README.md` to reflect the current Firebase-backed carrier app.
- Documented setup, environment values, Firebase notes, project structure, and quality checks.

## Verification

The following checks passed after the changes:

```bash
npx tsc --noEmit
npm run lint
npm --prefix functions run build
```

