import assert from 'node:assert/strict';

import type { Station } from '@/types/api';
import {
  DEFAULT_AVG_SERVICE_SEC,
  DEFAULT_SERVERS,
  buildStationRecommendations,
  computePrediction,
} from '@/utils/recommendation';

const now = new Date();

(() => {
  const stations: Station[] = [
    { id: 'st-open', facilityId: 'fac-1', name: 'Open', status: 'open', servers: 1 },
    { id: 'st-closed', facilityId: 'fac-1', name: 'Closed', status: 'closed', servers: 1 },
  ];

  const result = buildStationRecommendations({
    stations,
    slot: '10-11',
  });

  assert.equal(result.stations.length, 1, 'closed stations should be excluded');
  assert.equal(result.stations[0]?.stationId, 'st-open', 'open station should remain');
})();

(() => {
  const prediction = computePrediction({
    arrivalTime: new Date(now.getTime() + 5 * 60000),
    currentQueue: 0,
  });
  const expected = (DEFAULT_SERVERS / DEFAULT_AVG_SERVICE_SEC) * 60;

  assert.ok(
    Math.abs(prediction.effectiveServicePerMin - expected) < 1e-8,
    'missing stats should fall back to defaults',
  );
})();

(() => {
  const prediction = computePrediction({
    arrivalTime: new Date(now.getTime() - 30 * 60000),
    currentQueue: 3,
  });

  assert.equal(prediction.dtMin, 0, 'dtMin should clamp to 0 when arrival is in the past');
})();
