# Integration Test Flow Map

This repository has two different integration test layers for queue flow:

1. API integration layer (Functions)
- File: `tests/contracts/queue-contract.integration.test.cjs`
- Calls: `enterQueue`, `getStationQueue`, `startService`, `completeService`, `cancelQueueEntry`
- Purpose: verify backend API contract and flow behavior.
- Live flag: `RUN_QUEUE_CONTRACT_LIVE=1`

2. Firestore data-layer integration
- File: `tests/integration/carrierFlow.integration.test.cjs`
- Calls Firestore emulator REST directly.
- Purpose: verify data visibility/search/status persistence from mobile data perspective.
- Live flag: `RUN_FIRESTORE_DATA_LIVE=1`
- Uses auth header token for emulator: `FIRESTORE_EMULATOR_AUTH_TOKEN` (default: `owner`).

## Commands

API contract (schema only by default):

```powershell
npm run test:integration:api
```

API contract + live function flow:

```powershell
$env:RUN_QUEUE_CONTRACT_LIVE="1"
npm run test:integration:api
```

Firestore data-layer live:

```powershell
$env:RUN_FIRESTORE_DATA_LIVE="1"
npm run test:integration:data
```

Run both suites:

```powershell
$env:RUN_QUEUE_CONTRACT_LIVE="1"
$env:RUN_FIRESTORE_DATA_LIVE="1"
npm run test:integration:all
```
