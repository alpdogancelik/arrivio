import { db } from '@/services/firebase';
import { USE_MOCK_DATA } from '@/config/mock';
import type { StationStats } from '@/types/api';
import { listMockStationStats, upsertMockStationStats } from '@/mock/data';
import { fetchQueueEvents } from '@/api/queue-events';
import { fetchStations } from '@/api/stations';
import { DEFAULT_WINDOW_MINUTES, calculateStationStats } from '@/utils/recommendation';
import { collection, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

const ensureDb = () => {
  if (!db) {
    throw new Error('Firestore is disabled');
  }
  return db;
};

const toStringValue = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

const toNumberValue = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const toIsoString = (value: any) => {
  if (!value) return undefined;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }
  if (value?.toDate) {
    try {
      return value.toDate().toISOString();
    } catch {
      return undefined;
    }
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return undefined;
};

const makeStatsDocId = (stationId: string, windowMinutes: number) => `${stationId}_${windowMinutes}`;

const mapStationStats = (id: string, data: Record<string, any>): StationStats => ({
  stationId: toStringValue(data.Station_ID ?? data.StationId ?? data.stationId ?? data.station_id) ?? id,
  windowMinutes:
    toNumberValue(data.WindowMinutes ?? data.windowMinutes ?? data.Window_Minutes) ?? DEFAULT_WINDOW_MINUTES,
  avgServiceSec: toNumberValue(data.AvgServiceSec ?? data.avgServiceSec ?? data.Avg_Service_Sec) ?? 0,
  avgWaitSec: toNumberValue(data.AvgWaitSec ?? data.avgWaitSec ?? data.Avg_Wait_Sec) ?? 0,
  lambdaPerMin: toNumberValue(data.LambdaPerMin ?? data.lambdaPerMin ?? data.lambda_per_min) ?? 0,
  updatedAt: toIsoString(data.UpdatedAt ?? data.updatedAt),
});

export const fetchStationStats = async (stationIds: string[], windowMinutes = DEFAULT_WINDOW_MINUTES) => {
  if (!stationIds.length) return [] as StationStats[];

  if (USE_MOCK_DATA) {
    const stats = listMockStationStats(windowMinutes);
    return stats.filter((stat) => stationIds.includes(stat.stationId));
  }

  const database = ensureDb();
  const stats = await Promise.all(
    stationIds.map(async (stationId) => {
      const snap = await getDoc(doc(collection(database, 'StationStat'), makeStatsDocId(stationId, windowMinutes)));
      if (!snap.exists()) return null;
      return mapStationStats(snap.id, snap.data() as Record<string, any>);
    }),
  );

  return stats.filter(Boolean) as StationStats[];
};

export const upsertStationStats = async (stats: StationStats[]) => {
  if (USE_MOCK_DATA) {
    upsertMockStationStats(stats);
    return;
  }

  const database = ensureDb();
  await Promise.all(
    stats.map((stat) => {
      const docId = makeStatsDocId(stat.stationId, stat.windowMinutes);
      return setDoc(
        doc(collection(database, 'StationStat'), docId),
        {
          Station_ID: stat.stationId,
          WindowMinutes: stat.windowMinutes,
          AvgServiceSec: stat.avgServiceSec,
          AvgWaitSec: stat.avgWaitSec,
          LambdaPerMin: stat.lambdaPerMin,
          UpdatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    }),
  );
};

export type StationStatsAggregationOptions = {
  windowMinutes?: number;
  now?: Date;
};

export const runStationStatsAggregation = async (options?: StationStatsAggregationOptions) => {
  const windowMinutes = options?.windowMinutes ?? DEFAULT_WINDOW_MINUTES;
  const now = options?.now ?? new Date();
  const windowStartIso = new Date(now.getTime() - windowMinutes * 60000).toISOString();

  const [stations, events] = await Promise.all([
    fetchStations(),
    fetchQueueEvents({ since: windowStartIso }),
  ]);

  const statsByStation = calculateStationStats(events, windowMinutes, now);
  const updatedAt = now.toISOString();

  const results = stations.map((station) => {
    const stats = statsByStation.get(station.id);
    return (
      stats ?? {
        stationId: station.id,
        windowMinutes,
        avgServiceSec: 0,
        avgWaitSec: 0,
        lambdaPerMin: 0,
        updatedAt,
      }
    );
  });

  await upsertStationStats(results);
  return results;
};
