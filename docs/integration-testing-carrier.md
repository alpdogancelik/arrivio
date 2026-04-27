# Integration Testing (Carrier Side)

## 5.2 Integration Testing

Integration testing is performed after unit testing to verify that all system components work correctly together. In this phase, system parts are combined step by step and communication, data flow, and synchronization are validated with realistic scenarios.

In this project, an incremental integration approach is used.

## Test Style Alignment

This plan is aligned with your operator/admin integration style:

- Test IDs in `TC-...` format
- Direction-based flow naming (`Carrier -> Backend -> Operator`, `Operator -> Backend -> Carrier`)
- Firestore-backed verification for each transition

## Environment

- Firebase Emulator Suite (Firestore on `127.0.0.1:8080`) or test Firebase project
- Carrier mobile app
- Operator panel
- Seeded test users:
- `carrier-test-*`
- `operator-test-*`

## Flow A: Carrier -> Backend -> Operator

### TC-CAR-01 Carrier -> Backend -> Operator | valid booking is stored with carrier, station and timestamps

1. Carrier creates booking with valid station/facility/slot data.
2. Verify `Booking` document is written.
3. Verify operator queue/booking list displays same booking.

Expected:
- Booking exists in Firestore with non-empty `Booking_ID`, `Carrier_ID`, `Facility_ID`, `Station_ID`.
- Timestamps (`CreatedAt`, `UpdatedAt`) are set.
- Operator list includes this booking id.

### TC-CAR-02 Backend -> Operator Panel | queue entry is visible and searchable

1. Create or trigger queue entry for the same booking.
2. Verify `QueueEntry` record.
3. Search on operator side by booking id / station id / carrier id.

Expected:
- Queue entry is listed and searchable by key fields.
- Entry status is normalized (`Queued`/`InProgress`/`Completed`/`Cancelled`).
- No duplicate row for the same queue id.

### TC-CAR-03 Carrier invalid booking submission is rejected and no record is created

1. Submit booking with missing required fields (for example empty `facilityId` or invalid arrival time).
2. Capture validation/backend response.
3. Compare booking count before/after.

Expected:
- Validation error is returned.
- No new invalid booking/queue document is created.
- Carrier app shows actionable error text.

## Flow B: Operator -> Backend -> Carrier

### TC-CAR-04 Operator -> Backend -> Carrier | start service updates carrier-visible state

1. Operator marks queue item as `InProgress`.
2. Verify `QueueEntry`/`Booking` update in Firestore.
3. Open carrier booking detail and refresh.

Expected:
- Carrier sees in-progress state.
- Backend and UI status values match.
- `UpdatedAt` changes after transition.

### TC-CAR-05 Operator -> Backend -> Carrier | no-show handling is reflected and restricted

1. Operator marks carrier booking as no-show (or equivalent cancellation rule).
2. Verify backend status fields and audit timestamp.
3. Verify carrier UI blocks invalid next actions.

Expected:
- Carrier sees final no-show/cancelled outcome.
- Invalid follow-up transitions are prevented in UI/API.

### TC-CAR-06 Operator -> Backend -> Carrier | complete service finalizes state

1. Operator completes service.
2. Verify completion fields in Firestore (`Booking_Status`/queue status and completion timestamp).
3. Refresh carrier app.

Expected:
- Carrier sees completed state.
- Re-complete / cancel actions are blocked.
- State remains consistent across backend and UI.

### TC-CAR-07 Invalid operator state transitions are rejected

1. Attempt invalid transition order (for example `Completed` before `InProgress`).
2. Observe API response and Firestore document.
3. Verify carrier UI still shows last valid state.

Expected:
- Backend rejects transition.
- No invalid write occurs.
- Carrier side remains synchronized with valid backend state.

## Pass / Fail

- Pass: all `TC-CAR-*` expected outcomes are met with consistent data in Firestore, operator panel, and carrier app.
- Fail: any state mismatch, missing audit field, invalid transition acceptance, or UI/backend inconsistency.

## Evidence

- Firestore snapshots before/after each test
- Operator panel screenshot
- Carrier app screenshot
- Test log with test ID and timestamp

## Contract Tests (Queue)

- Contract files:
- `contracts/queue/enterQueue.request.json`
- `contracts/queue/enterQueue.response.json`
- `contracts/queue/getStationQueue.response.json`

- Test file:
- `tests/contracts/queue-contract.integration.test.cjs`

- Run schema-only checks:
```bash
npm run test:contracts:queue
```

- Run live emulator integration checks too:
```bash
$env:RUN_QUEUE_CONTRACT_LIVE="1"
npm run test:contracts:queue
```

Optional env overrides:
- `FIREBASE_PROJECT_ID` (default: `arrivio-271aa`)
- `FIREBASE_FUNCTIONS_REGION` (default: `europe-west3`)
- `QUEUE_FUNCTIONS_BASE_URL` (full override)

## Data-Layer Tests (Firestore Direct)

- Test file:
- `tests/integration/carrierFlow.integration.test.cjs`

- Run:
```bash
npm run test:integration:data
```

Note:
- These tests validate Firestore document behavior directly.
- They are not a replacement for API contract/integration tests that call backend endpoints.
