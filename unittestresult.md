# Unit Test Result

Command:

```bash
npm test -- --runInBand --verbose
```

Output:

```text

> arrivio@1.0.0 test
> jest --runInBand --verbose --no-color

PASS tests/unit/carrier/bookings.test.ts
  carrier bookings api
    √ fetches only the current carrier bookings, removes duplicates, and normalizes status values (20 ms)
    √ creates a booking with carrier ownership, station details, and recommendation metadata (3 ms)
    √ generates a slot from arrival time when the carrier does not provide one explicitly (2 ms)
    √ rejects booking creation when no carrier is authenticated (32 ms)
    √ fetchBooking falls back to Booking_ID when the public booking id is different from the Firestore document id (1 ms)
    √ throws a clear error when a booking cannot be found (1 ms)
    √ updateBooking writes only changed fields and returns normalized booking data (2 ms)
    √ cancelBooking writes Cancelled status and returns a cancelled booking (2 ms)
    √ completeBooking updates the real Firestore document even when lookup happens through Booking_ID fallback (1 ms)
PASS tests/unit/carrier/recommendation.test.ts
  carrier recommendation calculations
    computePrediction
      √ predicts future queue size, waiting time, and position from arrival/service rates (2 ms)
      √ does not produce negative queue values when service capacity is higher than demand (6 ms)
      √ treats past arrival times as immediate arrivals (1 ms)
      √ uses safe defaults when invalid service rate inputs are provided (2 ms)
    computeTravelPenaltyMin and computeStationScore
      √ returns zero travel penalty when station or carrier coordinates are missing (1 ms)
      √ calculates a positive travel penalty when the carrier is far from the station (1 ms)
      √ adds limited station penalty to the station score (1 ms)
    countActiveQueueByStation
      √ counts joined carriers as active until their service starts (1 ms)
      √ removes a carrier from active queue after service_start
      √ uses the latest queue_joined event if the same booking joins again after service_start
      √ ignores queue events outside the active lookback window (1 ms)
    calculateStationStats
      √ calculates average wait time, service time, and arrival rate per station (1 ms)
      √ ignores malformed or out-of-window events when calculating statistics (1 ms)
    buildStationRecommendations
      √ excludes closed stations from carrier recommendations (1 ms)
      √ ranks stations by lowest predicted waiting time (1 ms)
      √ uses computed average service time when avgServiceTimeMin is missing
      √ uses default 15 minute service time when no station service data exists
      √ adds M/M/1 theoretical waiting time from historical completed bookings (1 ms)
      √ caps theoretical waiting time when the M/M/1 system is unstable (1 ms)
      √ returns null suggestedStationId when there are no available stations (1 ms)
PASS tests/unit/carrier/issues.test.ts
  carrier issues api
    √ creates a carrier issue in the primary issues collection (3 ms)
    √ falls back to the legacy Issue collection when the primary collection is blocked by Firestore rules (2 ms)
    √ returns a clear permission error when both primary and legacy writes are denied (20 ms)
    √ rejects issue creation when no carrier is authenticated (1 ms)
    √ uploads a photo when photo object is provided and stores the resolved download URL (3 ms)
    √ still creates the issue when photo upload fails (1 ms)
    √ fetches only the current carrier issues from both primary and legacy collections (2 ms)
    √ filters fetched issues by status and booking id (1 ms)
    √ continues reading legacy issues when the primary issues collection is not readable
    √ rejects fetchIssues when no carrier is authenticated (10 ms)
    √ cancelIssue updates the correct Firestore document and returns cancelled status (1 ms)
    √ cancelIssue uses the primary issues collection when sourceCollection is missing
PASS tests/unit/carrier/queue-entries.test.ts
  carrier queue entries api
    √ fetches queue entries for the current authenticated carrier by default (4 ms)
    √ uses the explicit carrierId parameter instead of the authenticated user when provided
    √ fetches all queue entries when there is no authenticated carrier and no carrierId parameter (1 ms)
    √ normalizes queue status variants into Waiting, Servicing, and Completed (1 ms)
    √ maps legacy Firestore field names into the app-level queue entry shape
    √ calculates waiting minutes from entry time to service start time when explicit waiting value is missing (1 ms)
    √ uses explicit waitingMinutes and serviceMinutes values when they are already stored
    √ calculates service minutes from service start to exit time when explicit service value is missing (1 ms)
    √ filters mapped entries by stationId and bookingId after Firestore results are loaded (1 ms)
    √ returns undefined for invalid dates and unknown statuses instead of crashing
    √ supports legacy Carrier_ID-only records by querying legacy carrier id fields too (1 ms)
PASS tests/unit/carrier/errors.test.ts
  api error helpers
    √ keeps ApiError payload fields on the error instance (1 ms)
    √ returns existing ApiError instances without wrapping them again
    √ maps Firebase error code auth/invalid-email to a safe message
    √ maps Firebase error code auth/user-disabled to a safe message (1 ms)
    √ maps Firebase error code auth/user-not-found to a safe message
    √ maps Firebase error code auth/wrong-password to a safe message
    √ maps Firebase error code auth/invalid-credential to a safe message (1 ms)
    √ maps Firebase error code auth/email-already-in-use to a safe message
    √ maps Firebase error code auth/weak-password to a safe message
    √ maps Firebase error code auth/too-many-requests to a safe message (1 ms)
    √ maps Firebase error code auth/network-request-failed to a safe message
    √ maps Firebase error code auth/operation-not-allowed to a safe message
    √ maps Firebase error code auth/unauthorized-domain to a safe message (5 ms)
    √ maps Firebase error code auth/invalid-api-key to a safe message
    √ maps Firebase error code auth/internal-error to a safe message (1 ms)
    √ uses the provided message for unknown coded errors
    √ falls back to Unexpected error when a coded object has no code value
    √ falls back to Unexpected error for coded objects without a message (1 ms)
    √ wraps plain Error instances with ApiError
    √ uses generic fallback for non-error values (1 ms)
    √ parses object error responses with message, code, details, and retryable status (1 ms)
    √ uses error and errorCode fields when message and code are not present
    √ uses status fallback when an object response has no message or error text (1 ms)
    √ parses non-object error responses with status fallback and retryable flag
PASS tests/unit/carrier/auth-error.test.ts
  carrier auth error localization
    √ maps invalid email format errors (2 ms)
    √ maps Firebase invalid credential errors (1 ms)
    √ maps older wrong password errors
    √ maps message-only invalid credential errors (1 ms)
    √ maps user not found errors (1 ms)
    √ maps duplicate email registration errors
    √ maps weak password errors (1 ms)
    √ maps too many request errors (1 ms)
    √ maps Firebase network request failures
    √ maps message-only network errors
    √ falls back to a generic message for unknown errors (1 ms)
    √ handles uppercase error codes and messages safely (1 ms)
    √ handles completely empty error objects with the generic fallback
Test Suites: 6 passed, 6 total
Tests:       89 passed, 89 total
Snapshots:   0 total
Time:        5.787 s, estimated 6 s
Ran all test suites.
```
