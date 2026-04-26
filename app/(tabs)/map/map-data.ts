// app/(tabs)/map/map-data.ts
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchBookings } from '@/api/bookings';
import { fetchFacilities } from '@/api/facilities';
import { fetchStations } from '@/api/stations';
import { queryKeys } from '@/query/keys';

export type Availability = 'open' | 'limited' | 'closed';

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type FacilityPin = {
  id: string;
  source: 'station' | 'facility' | 'static';
  name: string;
  shortName: string;
  facilityId?: string;
  facilityName?: string;
  stationId?: string;
  stationName?: string;
  latitude: number;
  longitude: number;
  availability: Availability;
  queueLength: number;
  etaMin: number | null;
  lastUpdatedMinAgo: number;
};

type FacilityLike = {
  id?: string;
  name?: string;
  status?: string;
  latitude?: number;
  longitude?: number;
};

type StationLike = {
  id?: string;
  name?: string;
  status?: string;
  facilityId?: string;
  latitude?: number;
  longitude?: number;
};

type BookingLike = {
  id?: string;
  status?: string;
  facilityId?: string;
  stationId?: string;
  arrivalTime?: string;
  etaMinutes?: number;
  updatedAt?: string;
  createdAt?: string;
};

export const STATUS_COLORS: Record<Availability, string> = {
  open: '#22c55e',
  limited: '#f59e0b',
  closed: '#ef4444',
};

export const DEFAULT_REGION: MapRegion = {
  latitude: 35.1859,
  longitude: 33.3619,
  latitudeDelta: 1.2,
  longitudeDelta: 1.2,
};

export const STATIC_FACILITIES: FacilityPin[] = [
  {
    id: 'station-static-1',
    source: 'static',
    name: 'Station 1',
    shortName: 'Station1',
    latitude: 35.1859,
    longitude: 33.3619,
    availability: 'open',
    queueLength: 0,
    etaMin: null,
    lastUpdatedMinAgo: 0,
  },
  {
    id: 'station-static-2',
    source: 'static',
    name: 'Station 2',
    shortName: 'Station2',
    latitude: 35.19,
    longitude: 33.38,
    availability: 'limited',
    queueLength: 0,
    etaMin: null,
    lastUpdatedMinAgo: 0,
  },
  {
    id: 'station-static-3',
    source: 'static',
    name: 'Station 3',
    shortName: 'Station3',
    latitude: 35.17,
    longitude: 33.34,
    availability: 'open',
    queueLength: 0,
    etaMin: null,
    lastUpdatedMinAgo: 0,
  },
];

export function normalizeAvailability(value?: string): Availability {
  const raw = String(value ?? '').toLowerCase();

  if (raw.includes('close') || raw.includes('inactive') || raw.includes('blocked')) {
    return 'closed';
  }

  if (raw.includes('limit') || raw.includes('busy') || raw.includes('partial')) {
    return 'limited';
  }

  return 'open';
}

export function normalizeText(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;

  const trimmed = value.trim();
  if (!trimmed) return fallback;

  const lowered = trimmed.toLowerCase();
  if (lowered === 'unknown' || lowered === 'undefined' || lowered === 'null') {
    return fallback;
  }

  return trimmed;
}

export function getEtaMinutes(arrivalTime?: string) {
  if (!arrivalTime) return undefined;

  const arrival = new Date(arrivalTime);
  if (Number.isNaN(arrival.getTime())) return undefined;

  const diff = Math.round((arrival.getTime() - Date.now()) / 60000);
  return diff > 0 ? diff : 0;
}

export function getUpdatedMinutesAgo(value?: string) {
  if (!value) return 0;

  const time = new Date(value).getTime();
  if (!Number.isFinite(time) || time <= 0) return 0;

  return Math.max(1, Math.round((Date.now() - time) / 60000));
}

export function getAvailabilityCounts(pins: FacilityPin[]) {
  return pins.reduce(
    (acc, pin) => {
      acc[pin.availability] += 1;
      return acc;
    },
    { open: 0, limited: 0, closed: 0 } as Record<Availability, number>,
  );
}

export function getInitialRegion(pins: FacilityPin[]): MapRegion {
  if (!pins.length) return DEFAULT_REGION;

  const latitude = pins.reduce((sum, pin) => sum + pin.latitude, 0) / pins.length;
  const longitude = pins.reduce((sum, pin) => sum + pin.longitude, 0) / pins.length;

  return {
    latitude,
    longitude,
    latitudeDelta: pins.length > 1 ? 1.2 : 0.55,
    longitudeDelta: pins.length > 1 ? 1.2 : 0.55,
  };
}

export function getFocusedRegion(pin: FacilityPin): MapRegion {
  return {
    latitude: pin.latitude,
    longitude: pin.longitude,
    latitudeDelta: 0.45,
    longitudeDelta: 0.45,
  };
}

export function buildDirectionsUrl(pin: FacilityPin) {
  return `https://www.google.com/maps/dir/?api=1&destination=${pin.latitude},${pin.longitude}&travelmode=driving`;
}

function isActiveBooking(booking: BookingLike) {
  const status = String(booking.status ?? '').toLowerCase();
  return status !== 'cancelled' && status !== 'completed';
}

function avgEta(bookings: BookingLike[]) {
  const values = bookings
    .map((booking) => booking.etaMinutes ?? getEtaMinutes(booking.arrivalTime))
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  if (!values.length) return null;

  return Math.max(0, Math.round(values.reduce((sum, value) => sum + value, 0) / values.length));
}

function latestUpdatedMinutesAgo(bookings: BookingLike[]) {
  const latest = bookings
    .map((booking) => booking.updatedAt ?? booking.createdAt ?? booking.arrivalTime)
    .map((value) => (value ? new Date(value).getTime() : 0))
    .reduce((max, value) => Math.max(max, Number.isFinite(value) ? value : 0), 0);

  if (!latest) return 0;

  return Math.max(1, Math.round((Date.now() - latest) / 60000));
}

function groupBy<T>(items: T[], getKey: (item: T) => string | undefined) {
  const grouped = new Map<string, T[]>();

  for (const item of items) {
    const key = getKey(item);
    if (!key) continue;

    const current = grouped.get(key) ?? [];
    current.push(item);
    grouped.set(key, current);
  }

  return grouped;
}

function asArray<T>(value: unknown) {
  return Array.isArray(value) ? (value as T[]) : [];
}

function makeShortName(sourceName: string | undefined, index: number) {
  const normalized = normalizeText(sourceName, '');
  if (/^station\s*\d+$/i.test(normalized) || /^station\d+$/i.test(normalized)) {
    return normalized.replace(/\s+/g, '');
  }

  return `Station${index + 1}`;
}

function buildStationPins(
  stations: StationLike[],
  facilitiesById: Map<string, FacilityLike>,
  bookingsByStation: Map<string, BookingLike[]>,
): FacilityPin[] {
  return stations
    .map((station, index) => {
      if (!station.id || typeof station.latitude !== 'number' || typeof station.longitude !== 'number') {
        return null;
      }

      const facility = station.facilityId ? facilitiesById.get(station.facilityId) : undefined;
      const stationBookings = bookingsByStation.get(station.id) ?? [];
      const stationName = normalizeText(station.name ?? station.id, `Station ${index + 1}`);
      const facilityName = normalizeText(facility?.name ?? station.facilityId, 'Facility');

      return {
        id: station.id,
        source: 'station',
        name: stationName,
        shortName: makeShortName(stationName, index),
        facilityId: station.facilityId,
        facilityName,
        stationId: station.id,
        stationName,
        latitude: station.latitude,
        longitude: station.longitude,
        availability: normalizeAvailability(station.status ?? facility?.status),
        queueLength: stationBookings.length,
        etaMin: avgEta(stationBookings),
        lastUpdatedMinAgo: latestUpdatedMinutesAgo(stationBookings),
      } satisfies FacilityPin;
    })
    .filter(Boolean) as FacilityPin[];
}

function buildFacilityPins(
  facilities: FacilityLike[],
  stations: StationLike[],
  bookingsByFacility: Map<string, BookingLike[]>,
): FacilityPin[] {
  const firstStationCoordByFacility = new Map<string, { latitude: number; longitude: number }>();

  for (const station of stations) {
    if (!station.facilityId || typeof station.latitude !== 'number' || typeof station.longitude !== 'number') {
      continue;
    }

    if (!firstStationCoordByFacility.has(station.facilityId)) {
      firstStationCoordByFacility.set(station.facilityId, {
        latitude: station.latitude,
        longitude: station.longitude,
      });
    }
  }

  return facilities
    .map((facility, index) => {
      if (!facility.id) return null;

      const fallbackCoords = firstStationCoordByFacility.get(facility.id);
      const latitude = typeof facility.latitude === 'number' ? facility.latitude : fallbackCoords?.latitude;
      const longitude = typeof facility.longitude === 'number' ? facility.longitude : fallbackCoords?.longitude;

      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return null;
      }

      const facilityBookings = bookingsByFacility.get(facility.id) ?? [];
      const facilityName = normalizeText(facility.name ?? facility.id, `Facility ${index + 1}`);

      return {
        id: facility.id,
        source: 'facility',
        name: facilityName,
        shortName: makeShortName(facilityName, index),
        facilityId: facility.id,
        facilityName,
        latitude,
        longitude,
        availability: normalizeAvailability(facility.status),
        queueLength: facilityBookings.length,
        etaMin: avgEta(facilityBookings),
        lastUpdatedMinAgo: latestUpdatedMinutesAgo(facilityBookings),
      } satisfies FacilityPin;
    })
    .filter(Boolean) as FacilityPin[];
}

export function useMapData() {
  const facilitiesQuery = useQuery({
    queryKey: queryKeys.facilities(),
    queryFn: fetchFacilities,
    staleTime: 60_000,
  });

  const stationsQuery = useQuery({
    queryKey: queryKeys.stations(),
    queryFn: () => fetchStations(),
    staleTime: 60_000,
  });

  const bookingsQuery = useQuery({
    queryKey: queryKeys.bookings(),
    queryFn: () => fetchBookings(),
    staleTime: 30_000,
  });

  const facilities = useMemo(() => asArray<FacilityLike>(facilitiesQuery.data), [facilitiesQuery.data]);
  const stations = useMemo(() => asArray<StationLike>(stationsQuery.data), [stationsQuery.data]);
  const bookings = useMemo(() => asArray<BookingLike>(bookingsQuery.data), [bookingsQuery.data]);

  const activeBookings = useMemo(() => bookings.filter(isActiveBooking), [bookings]);

  const pins = useMemo(() => {
    const facilitiesById = new Map(facilities.map((facility) => [String(facility.id), facility]));
    const bookingsByStation = groupBy(activeBookings, (booking) => booking.stationId);
    const bookingsByFacility = groupBy(activeBookings, (booking) => booking.facilityId);

    const stationPins = buildStationPins(stations, facilitiesById, bookingsByStation);
    if (stationPins.length) return stationPins;

    const facilityPins = buildFacilityPins(facilities, stations, bookingsByFacility);
    if (facilityPins.length) return facilityPins;

    return STATIC_FACILITIES;
  }, [activeBookings, facilities, stations]);

  const counts = useMemo(() => getAvailabilityCounts(pins), [pins]);
  const initialRegion = useMemo(() => getInitialRegion(pins), [pins]);

  const refetchAll = async () => {
    await Promise.all([
      facilitiesQuery.refetch(),
      stationsQuery.refetch(),
      bookingsQuery.refetch(),
    ]);
  };

  return {
    pins,
    counts,
    initialRegion,
    facilities,
    stations,
    bookings,
    isLoading: facilitiesQuery.isLoading || stationsQuery.isLoading || bookingsQuery.isLoading,
    isRefetching: facilitiesQuery.isRefetching || stationsQuery.isRefetching || bookingsQuery.isRefetching,
    error: facilitiesQuery.error ?? stationsQuery.error ?? bookingsQuery.error ?? null,
    refetchAll,
  };
}
