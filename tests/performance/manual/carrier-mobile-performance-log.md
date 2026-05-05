# Carrier Mobile Performance Log

## Purpose

This manual performance log records the observed performance of the Arrivio carrier mobile application during important user-facing actions. Automated Jest performance tests were used for carrier-side logic, while this manual log was used to observe real mobile interface responsiveness, screen loading behavior, and visible user experience.

The measurements were taken in the development environment by running the React Native Expo application and interacting with the carrier mobile screens manually.

## Test Environment

| Item | Value |
|---|---|
| Application | Arrivio Carrier Mobile App |
| Framework | React Native / Expo |
| Test Type | Manual mobile performance observation |
| Environment | Development / Staging |
| Device / Emulator | Android Emulator or physical mobile device |
| Network | Stable Wi-Fi |
| Backend | Firebase / Firestore development data |
| Measurement Method | Stopwatch, Expo console logs, visible screen response, Firestore observation |
| Pass Threshold | Key carrier actions should complete within 2–3 seconds under normal conditions |

## Manual Test Cases

| Test ID | Carrier Action | Measurement Method | Expected Result | Observed Result | Status |
|---|---|---|---|---|---|
| MP-CAR-01 | Open the carrier login screen | Stopwatch / visible screen load | Login screen should load without noticeable delay |  |  |
| MP-CAR-02 | Login with a valid carrier account | Stopwatch / Expo logs | User should be redirected to carrier home within 3 seconds |  |  |
| MP-CAR-03 | Open carrier home screen after login | Stopwatch / visible screen response | Active booking and quick actions should be displayed within 3 seconds |  |  |
| MP-CAR-04 | Select an arrival time slot and request station recommendations | Stopwatch / Expo logs | Recommendation results should be displayed within 3 seconds |  |  |
| MP-CAR-05 | Create a queue request / booking from the selected recommendation | Stopwatch / Firestore check | Booking should be created and visible within 3 seconds |  |  |
| MP-CAR-06 | Open My Booking / queue status screen | Stopwatch / visible screen response | Booking and queue information should load within 3 seconds |  |  |
| MP-CAR-07 | Refresh or revisit queue status after an operator-side update | Stopwatch / visual observation | Updated queue state should be reflected without visible delay |  |  |
| MP-CAR-08 | Open the facility map screen | Stopwatch / visible screen response | Map and station markers should become usable within 3 seconds |  |  |
| MP-CAR-09 | Submit a carrier issue report | Stopwatch / Firestore check | Issue should be submitted and stored within 3 seconds |  |  |
| MP-CAR-10 | Navigate between carrier screens repeatedly | Visual observation | No freeze, crash, or navigation delay should occur |  |  |

## Filled Example Format

| Test ID | Carrier Action | Measurement Method | Expected Result | Observed Result | Status |
|---|---|---|---|---|---|
| MP-CAR-04 | Select an arrival time slot and request station recommendations | Stopwatch / Expo logs | Recommendation results should be displayed within 3 seconds | Recommendation list displayed in 1.7 seconds | Passed |

## Notes During Testing

- No production data was modified during the manual performance observation.
- The tests focused on user-visible carrier mobile behavior rather than internal Firebase infrastructure.
- Screens were considered passed when the user could continue the flow without visible freezing, crashing, or excessive loading delay.
- The observed values should be copied into the Test Results report under the Performance Testing test log section.

## Summary

Manual carrier mobile performance testing was used to support the automated performance tests. The main purpose was to verify that important user-facing carrier actions, such as login, recommendation retrieval, booking creation, queue status viewing, map loading, and issue reporting, remained responsive under normal development/staging conditions.

Overall result: To be completed after manual execution.