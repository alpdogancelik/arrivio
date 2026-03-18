import { db } from '@/services/firebase';
import { USE_MOCK_DATA } from '@/config/mock';
import { listMockStations } from '@/mock/data';
import type { Station } from '@/types/api';
import { collection, getDocs } from 'firebase/firestore';

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

const normalizeStatus = (value: unknown): Station['status'] => {
  const raw = String(value ?? '').toLowerCase();
  if (raw === 'open' || raw === 'closed' || raw === 'limited') return raw as Station['status'];
  if (raw === 'active') return 'open';
  if (raw === 'inactive' || raw === 'disabled') return 'closed';
  return undefined;
};

const resolveStationId = (id: string, data: Record<string, any>) =>
  toStringValue(
    data.Station_ID ??
      data.stationId ??
      data.StationId ??
      data.stationID ??
      data.StationID ??
      data.station_id,
  ) ?? id;

const resolveFacilityId = (data: Record<string, any>) =>
  toStringValue(
    data.Facility_ID ??
      data.facilityId ??
      data.FacilityId ??
      data.facilityID ??
      data.FacilityID ??
      data.facility_id,
  );

const resolveStationName = (data: Record<string, any>, stationId: string) => {
  const direct = toStringValue(data.Name ?? data.Station_Name ?? data.stationName ?? data.name);
  if (direct) return direct;
  const type = toStringValue(data.Type ?? data.type);
  if (stationId && type) return `${stationId} - ${type}`;
  return stationId;
};

const mapStation = (id: string, data: Record<string, any>): Station => {
  const stationId = resolveStationId(id, data);
  const facilityId = resolveFacilityId(data);
  const type = toStringValue(data.Type ?? data.type);
  return {
    id: stationId,
    facilityId: facilityId ?? 'unknown',
    name: resolveStationName(data, stationId),
    gate: toStringValue(data.Gate ?? data.gate ?? type),
    servers: toNumberValue(data.Servers ?? data.servers ?? data.ServerCount ?? data.serverCount ?? data.c),
    latitude: toNumberValue(data.Latitude ?? data.latitude ?? data.lat),
    longitude: toNumberValue(data.Longitude ?? data.longitude ?? data.lng),
    status: normalizeStatus(data.Status ?? data.status),
    contactName: toStringValue(data.ContactName ?? data.contactName),
    phone: toStringValue(data.Phone ?? data.phone),
    type,
    avgServiceTimeMin: toNumberValue(data.avgServiceTimeMin ?? data.AvgServiceTimeMin),
    totalServiceTimeMin: toNumberValue(data.totalServiceTimeMin ?? data.TotalServiceTimeMin),
    completedJobsCount: toNumberValue(data.completedJobsCount ?? data.CompletedJobsCount),
  };
};

const mapMockStation = (item: any): Station => ({
  id: String(item.id ?? ''),
  facilityId: String(item.facilityId ?? ''),
  name: String(item.name ?? ''),
  gate: item.kind,
  servers: toNumberValue(item.servers),
  status: undefined,
  latitude: undefined,
  longitude: undefined,
  type: item.kind,
});

export const fetchStations = async (facilityId?: string) => {
  if (USE_MOCK_DATA) {
    return listMockStations(facilityId).map(mapMockStation);
  }

  const database = ensureDb();
  const snapshot = await getDocs(collection(database, 'Station'));
  let stations = snapshot.docs.map((docSnap) => mapStation(docSnap.id, docSnap.data() as Record<string, any>));

  if (facilityId) {
    stations = stations.map((station) =>
      station.facilityId === 'unknown' ? { ...station, facilityId } : station,
    );
    stations = stations.filter((station) => station.facilityId === facilityId);
  }

  return stations;
};
