import {
  AuthTokens,
  Booking,
  BookingStatus,
  Issue,
  IssueStatus,
  QueueEvent,
  QueueEventType,
  RoleSchema,
  StationStats,
  User,
} from '@/types/api';

type LoginPayload = { email: string; password: string };
type RegisterPayload = {
  name?: string;
  surname?: string;
  email: string;
  password: string;
  role?: string;
};

type CreateBookingPayload = {
  facilityId: string;
  stationId?: string;
  arrivalTime: string;
  notes?: string;
};

type UpdateBookingPayload = Partial<Pick<CreateBookingPayload, 'arrivalTime' | 'stationId' | 'notes'>>;

type CreateIssuePayload = {
  category: string;
  description: string;
  photoUrl?: string;
  bookingId?: string;
};

type ListBookingsParams = { status?: BookingStatus | 'all' };
type ListIssuesParams = { status?: IssueStatus; bookingId?: string };

/** -----------------------------
 *  Time helpers (TRNC / Europe-Istanbul)
 *  ----------------------------- */
const nowSeconds = () => Math.floor(Date.now() / 1000);

const isoNow = () => new Date().toISOString();

const minutesFromNow = (minutes: number) =>
  new Date(Date.now() + minutes * 60 * 1000).toISOString();

const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60 * 1000).toISOString();

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const safeTrim = (value?: string) => (typeof value === 'string' ? value.trim() : '');

const normalizeEmail = (email: string) => safeTrim(email).toLowerCase();

/** -----------------------------
 *  KKTC facility / station catalog (single source of truth)
 *  ----------------------------- */
type FacilityMock = {
  id: string;
  code: 'LK' | 'GN' | 'MG' | 'GZ' | 'IS' | 'LE';
  name: string;
  city: string; // ilçe/şehir
  address: string;
  phone: string;
  geo: { lat: number; lng: number };
  operatingHours: { from: string; to: string }; // HH:mm
  gates: number;
  docks: number;
  policy: 'AppointmentOnly' | 'Hybrid';
};

type StationMock = {
  id: string;
  facilityId: string;
  name: string;
  kind: 'Gate' | 'Dock' | 'Inspection' | 'Weighbridge';
  serviceTargetMinutes: number; // “ideal” servis süresi
};

export const FACILITIES: FacilityMock[] = [
  {
    id: 'fac-lk-01',
    code: 'LK',
    name: 'Lefkoşa Sanayi Lojistik Parkı',
    city: 'Lefkoşa',
    address: 'Organize Sanayi Bölgesi, Dr. Fazıl Küçük Bulvarı Yakını',
    phone: '+90 392 222 11 00',
    geo: { lat: 35.1939, lng: 33.3622 },
    operatingHours: { from: '07:00', to: '22:00' },
    gates: 2,
    docks: 6,
    policy: 'Hybrid',
  },
  {
    id: 'fac-mg-01',
    code: 'MG',
    name: 'Gazimağusa Limanı - Ana Giriş',
    city: 'Gazimağusa',
    address: 'Liman Yolu, Gümrük Kapısı Bölgesi',
    phone: '+90 392 366 40 00',
    geo: { lat: 35.1167, lng: 33.9500 },
    operatingHours: { from: '00:00', to: '23:59' },
    gates: 3,
    docks: 4,
    policy: 'AppointmentOnly',
  },
  {
    id: 'fac-gn-01',
    code: 'GN',
    name: 'Girne Serbest Bölge Depo Kompleksi',
    city: 'Girne',
    address: 'Karaoğlanoğlu Çevre Yolu, Depolama Alanı',
    phone: '+90 392 815 88 10',
    geo: { lat: 35.3367, lng: 33.3191 },
    operatingHours: { from: '08:00', to: '20:00' },
    gates: 1,
    docks: 5,
    policy: 'Hybrid',
  },
  {
    id: 'fac-gz-01',
    code: 'GZ',
    name: 'Güzelyurt Narenciye Yükleme Sahası',
    city: 'Güzelyurt',
    address: 'Narenciye Kooperatifi Arkası, Tırlar İçin Ayrılmış Park',
    phone: '+90 392 714 33 21',
    geo: { lat: 35.2025, lng: 32.9939 },
    operatingHours: { from: '06:00', to: '18:00' },
    gates: 1,
    docks: 3,
    policy: 'AppointmentOnly',
  },
  {
    id: 'fac-is-01',
    code: 'IS',
    name: 'İskele Boğaz Transfer Noktası',
    city: 'İskele',
    address: 'Boğaz Yolu, Transfer ve Tartı İstasyonu',
    phone: '+90 392 371 09 09',
    geo: { lat: 35.2833, lng: 33.9500 },
    operatingHours: { from: '07:30', to: '19:30' },
    gates: 1,
    docks: 2,
    policy: 'Hybrid',
  },
];

export const STATIONS: StationMock[] = [
  // Lefkoşa
  { id: 'st-lk-g1', facilityId: 'fac-lk-01', name: 'Kapı A - Evrak Kontrol', kind: 'Gate', serviceTargetMinutes: 8 },
  { id: 'st-lk-g2', facilityId: 'fac-lk-01', name: 'Kapı B - Hızlı Geçiş', kind: 'Gate', serviceTargetMinutes: 5 },
  { id: 'st-lk-w1', facilityId: 'fac-lk-01', name: 'Tartı 1', kind: 'Weighbridge', serviceTargetMinutes: 6 },
  { id: 'st-lk-d1', facilityId: 'fac-lk-01', name: 'Rampa 1 - Paletli Yük', kind: 'Dock', serviceTargetMinutes: 35 },
  { id: 'st-lk-d2', facilityId: 'fac-lk-01', name: 'Rampa 2 - Koli Yük', kind: 'Dock', serviceTargetMinutes: 30 },
  { id: 'st-lk-i1', facilityId: 'fac-lk-01', name: 'İnceleme - Random Check', kind: 'Inspection', serviceTargetMinutes: 18 },

  // Gazimağusa Liman
  { id: 'st-mg-g1', facilityId: 'fac-mg-01', name: 'Gümrük Kapısı 1', kind: 'Gate', serviceTargetMinutes: 12 },
  { id: 'st-mg-g2', facilityId: 'fac-mg-01', name: 'Gümrük Kapısı 2', kind: 'Gate', serviceTargetMinutes: 10 },
  { id: 'st-mg-w1', facilityId: 'fac-mg-01', name: 'Liman Tartı', kind: 'Weighbridge', serviceTargetMinutes: 7 },
  { id: 'st-mg-i1', facilityId: 'fac-mg-01', name: 'Gümrük İnceleme', kind: 'Inspection', serviceTargetMinutes: 25 },
  { id: 'st-mg-d1', facilityId: 'fac-mg-01', name: 'Rıhtım Rampa - Konteyner', kind: 'Dock', serviceTargetMinutes: 45 },

  // Girne
  { id: 'st-gn-g1', facilityId: 'fac-gn-01', name: 'Giriş Kapısı', kind: 'Gate', serviceTargetMinutes: 7 },
  { id: 'st-gn-d1', facilityId: 'fac-gn-01', name: 'Depo Rampa 1', kind: 'Dock', serviceTargetMinutes: 28 },
  { id: 'st-gn-d2', facilityId: 'fac-gn-01', name: 'Depo Rampa 2', kind: 'Dock', serviceTargetMinutes: 32 },

  // Güzelyurt
  { id: 'st-gz-g1', facilityId: 'fac-gz-01', name: 'Koop Kapı', kind: 'Gate', serviceTargetMinutes: 6 },
  { id: 'st-gz-d1', facilityId: 'fac-gz-01', name: 'Soğuk Hava Rampa', kind: 'Dock', serviceTargetMinutes: 40 },

  // İskele
  { id: 'st-is-g1', facilityId: 'fac-is-01', name: 'Transfer Giriş', kind: 'Gate', serviceTargetMinutes: 6 },
  { id: 'st-is-w1', facilityId: 'fac-is-01', name: 'Tartı - Transfer', kind: 'Weighbridge', serviceTargetMinutes: 5 },
];

const facilityById = new Map(FACILITIES.map((f) => [f.id, f]));
const stationById = new Map(STATIONS.map((s) => [s.id, s]));

/** Derived name maps (used by existing screens) */
const facilityNames: Record<string, string> = Object.fromEntries(FACILITIES.map((f) => [f.id, f.name]));
const stationNames: Record<string, string> = Object.fromEntries(STATIONS.map((s) => [s.id, s.name]));

/** -----------------------------
 *  Queue events + station stats (mock)
 *  ----------------------------- */
type CreateQueueEventPayload = Omit<QueueEvent, 'id' | 'ts'> & { ts?: string };

const makeQueueEventId = (n: number) => `qe-${String(n).padStart(4, '0')}`;

const seedQueueEvents: QueueEvent[] = [
  {
    id: makeQueueEventId(1),
    facilityId: 'fac-mg-01',
    stationId: 'st-mg-g1',
    carrierId: 'car-001',
    bookingId: 'b-MG-0001',
    type: 'queue_joined',
    ts: minutesAgo(210),
  },
  {
    id: makeQueueEventId(2),
    facilityId: 'fac-mg-01',
    stationId: 'st-mg-g1',
    carrierId: 'car-001',
    bookingId: 'b-MG-0001',
    type: 'service_start',
    ts: minutesAgo(190),
  },
  {
    id: makeQueueEventId(3),
    facilityId: 'fac-mg-01',
    stationId: 'st-mg-g1',
    carrierId: 'car-001',
    bookingId: 'b-MG-0001',
    type: 'service_end',
    ts: minutesAgo(165),
  },
  {
    id: makeQueueEventId(4),
    facilityId: 'fac-mg-01',
    stationId: 'st-mg-g1',
    carrierId: 'car-002',
    bookingId: 'b-MG-0002',
    type: 'queue_joined',
    ts: minutesAgo(120),
  },
  {
    id: makeQueueEventId(5),
    facilityId: 'fac-mg-01',
    stationId: 'st-mg-g1',
    carrierId: 'car-002',
    bookingId: 'b-MG-0002',
    type: 'service_start',
    ts: minutesAgo(100),
  },
  {
    id: makeQueueEventId(6),
    facilityId: 'fac-mg-01',
    stationId: 'st-mg-g1',
    carrierId: 'car-002',
    bookingId: 'b-MG-0002',
    type: 'service_end',
    ts: minutesAgo(80),
  },
  {
    id: makeQueueEventId(7),
    facilityId: 'fac-mg-01',
    stationId: 'st-mg-g1',
    carrierId: 'car-003',
    bookingId: 'b-MG-0003',
    type: 'queue_joined',
    ts: minutesAgo(30),
  },
  {
    id: makeQueueEventId(8),
    facilityId: 'fac-mg-01',
    stationId: 'st-mg-g1',
    carrierId: 'car-003',
    bookingId: 'b-MG-0003',
    type: 'service_start',
    ts: minutesAgo(20),
  },
  {
    id: makeQueueEventId(9),
    facilityId: 'fac-mg-01',
    stationId: 'st-mg-g1',
    carrierId: 'car-003',
    bookingId: 'b-MG-0003',
    type: 'service_end',
    ts: minutesAgo(8),
  },
  {
    id: makeQueueEventId(10),
    facilityId: 'fac-mg-01',
    stationId: 'st-mg-g1',
    carrierId: 'car-004',
    bookingId: 'b-MG-0004',
    type: 'queue_joined',
    ts: minutesAgo(5),
  },
  {
    id: makeQueueEventId(11),
    facilityId: 'fac-lk-01',
    stationId: 'st-lk-g2',
    carrierId: 'car-010',
    bookingId: 'b-LK-0001',
    type: 'queue_joined',
    ts: minutesAgo(160),
  },
  {
    id: makeQueueEventId(12),
    facilityId: 'fac-lk-01',
    stationId: 'st-lk-g2',
    carrierId: 'car-010',
    bookingId: 'b-LK-0001',
    type: 'service_start',
    ts: minutesAgo(140),
  },
  {
    id: makeQueueEventId(13),
    facilityId: 'fac-lk-01',
    stationId: 'st-lk-g2',
    carrierId: 'car-010',
    bookingId: 'b-LK-0001',
    type: 'service_end',
    ts: minutesAgo(120),
  },
  {
    id: makeQueueEventId(14),
    facilityId: 'fac-lk-01',
    stationId: 'st-lk-g2',
    carrierId: 'car-011',
    bookingId: 'b-LK-0002',
    type: 'queue_joined',
    ts: minutesAgo(70),
  },
  {
    id: makeQueueEventId(15),
    facilityId: 'fac-lk-01',
    stationId: 'st-lk-g2',
    carrierId: 'car-011',
    bookingId: 'b-LK-0002',
    type: 'service_start',
    ts: minutesAgo(55),
  },
  {
    id: makeQueueEventId(16),
    facilityId: 'fac-lk-01',
    stationId: 'st-lk-g2',
    carrierId: 'car-011',
    bookingId: 'b-LK-0002',
    type: 'service_end',
    ts: minutesAgo(40),
  },
  {
    id: makeQueueEventId(17),
    facilityId: 'fac-lk-01',
    stationId: 'st-lk-g2',
    carrierId: 'car-012',
    bookingId: 'b-LK-0003',
    type: 'queue_joined',
    ts: minutesAgo(15),
  },
  {
    id: makeQueueEventId(18),
    facilityId: 'fac-gz-01',
    stationId: 'st-gz-d1',
    carrierId: 'car-020',
    bookingId: 'b-GZ-0001',
    type: 'queue_joined',
    ts: minutesAgo(200),
  },
  {
    id: makeQueueEventId(19),
    facilityId: 'fac-gz-01',
    stationId: 'st-gz-d1',
    carrierId: 'car-020',
    bookingId: 'b-GZ-0001',
    type: 'service_start',
    ts: minutesAgo(175),
  },
  {
    id: makeQueueEventId(20),
    facilityId: 'fac-gz-01',
    stationId: 'st-gz-d1',
    carrierId: 'car-020',
    bookingId: 'b-GZ-0001',
    type: 'service_end',
    ts: minutesAgo(130),
  },
  {
    id: makeQueueEventId(21),
    facilityId: 'fac-gz-01',
    stationId: 'st-gz-d1',
    carrierId: 'car-021',
    bookingId: 'b-GZ-0002',
    type: 'queue_joined',
    ts: minutesAgo(60),
  },
  {
    id: makeQueueEventId(22),
    facilityId: 'fac-gz-01',
    stationId: 'st-gz-d1',
    carrierId: 'car-021',
    bookingId: 'b-GZ-0002',
    type: 'service_start',
    ts: minutesAgo(45),
  },
  {
    id: makeQueueEventId(23),
    facilityId: 'fac-gz-01',
    stationId: 'st-gz-d1',
    carrierId: 'car-021',
    bookingId: 'b-GZ-0002',
    type: 'service_end',
    ts: minutesAgo(10),
  },
];

let queueEvents = [...seedQueueEvents];
let queueEventCounter = seedQueueEvents.length + 1;

export const listMockQueueEvents = (params?: {
  facilityId?: string;
  stationId?: string;
  carrierId?: string;
  bookingId?: string;
  since?: string;
}) => {
  let next = [...queueEvents];

  if (params?.facilityId) next = next.filter((event) => event.facilityId === params.facilityId);
  if (params?.stationId) next = next.filter((event) => event.stationId === params.stationId);
  if (params?.carrierId) next = next.filter((event) => event.carrierId === params.carrierId);
  if (params?.bookingId) next = next.filter((event) => event.bookingId === params.bookingId);
  if (params?.since) {
    const sinceMs = new Date(params.since).getTime();
    if (!Number.isNaN(sinceMs)) {
      next = next.filter((event) => new Date(event.ts).getTime() >= sinceMs);
    }
  }

  return next.map((event) => ({ ...event }));
};

export const createMockQueueEvent = (payload: CreateQueueEventPayload) => {
  const event: QueueEvent = {
    id: makeQueueEventId(queueEventCounter++),
    facilityId: payload.facilityId,
    stationId: payload.stationId,
    carrierId: payload.carrierId,
    bookingId: payload.bookingId ?? undefined,
    type: payload.type as QueueEventType,
    ts: payload.ts ?? isoNow(),
  };

  queueEvents = [event, ...queueEvents];
  return { ...event };
};

let stationStats: StationStats[] = [];

export const listMockStationStats = (windowMinutes?: number) => {
  const next = windowMinutes
    ? stationStats.filter((stat) => stat.windowMinutes === windowMinutes)
    : [...stationStats];
  return next.map((stat) => ({ ...stat }));
};

export const upsertMockStationStats = (stats: StationStats[]) => {
  for (const stat of stats) {
    const idx = stationStats.findIndex(
      (entry) => entry.stationId === stat.stationId && entry.windowMinutes === stat.windowMinutes,
    );
    if (idx >= 0) {
      stationStats[idx] = { ...stationStats[idx], ...stat };
    } else {
      stationStats.push({ ...stat });
    }
  }
};

/** Optional helper exports for UI */
export const listMockFacilities = () => [...FACILITIES];
export const listMockStations = (facilityId?: string) =>
  facilityId ? STATIONS.filter((s) => s.facilityId === facilityId) : [...STATIONS];

/** Station capacity defaults (override per station if needed). */
const DEFAULT_STATION_CAPACITY = 3;
const STATION_CAPACITY_OVERRIDES: Record<string, number> = {};

const getStationCapacity = (stationId: string) =>
  STATION_CAPACITY_OVERRIDES[stationId] ?? DEFAULT_STATION_CAPACITY;

/** -----------------------------
 *  Auth mock (more TRNC-realistic)
 *  ----------------------------- */
const buildMockTokens = (): AuthTokens => {
  const now = nowSeconds();
  return {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    issuedAt: now,
    expiresAt: now + 60 * 60 * 12, // 12h
    provider: 'backend',
  };
};

const seedUsers: Record<'carrier' | 'operator' | 'admin', User> = {
  carrier: {
    id: 'u-ky-0001',
    email: 'carrier@kktc-mock.dev',
    name: 'Mehmet',
    surname: 'Yılmaz',
    phone: '+90 533 742 12 34',
    role: 'carrier',
    company: 'Kıbrıs Lojistik A.Ş.',
    vehiclePlate: 'LK 742',
    capacity: 26,
    available: true,
  },
  operator: {
    id: 'u-ky-0101',
    email: 'operator@kktc-mock.dev',
    name: 'Elif',
    surname: 'Demir',
    phone: '+90 542 110 20 20',
    role: 'operator',
    company: 'Gazimağusa Liman İşletmesi',
    vehiclePlate: 'MG 118',
    capacity: 0,
    available: true,
  },
  admin: {
    id: 'u-ky-9999',
    email: 'admin@kktc-mock.dev',
    name: 'Serkan',
    surname: 'Kaya',
    phone: '+90 533 900 00 01',
    role: 'admin',
    company: 'Arrivio Ops',
    vehiclePlate: 'GN 001',
    capacity: 0,
    available: true,
  },
};

let currentUser: User = { ...seedUsers.carrier };

export const getMockSession = () => ({ user: currentUser, tokens: buildMockTokens() });

export const mockLogin = (payload: LoginPayload) => {
  // Mock: email changes, other fields remain (like “remember me”)
  currentUser = {
    ...currentUser,
    email: normalizeEmail(payload.email) || currentUser.email,
  };
  return { user: currentUser, tokens: buildMockTokens() };
};

export const mockRegister = (payload: RegisterPayload) => {
  const parsedRole = RoleSchema.safeParse(payload.role);
  const nextRole = parsedRole.success ? parsedRole.data : 'carrier';

  currentUser = {
    ...(seedUsers as any)[nextRole] ? { ...(seedUsers as any)[nextRole] } : { ...seedUsers.carrier },
    id: `u-ky-${String(Math.floor(Math.random() * 9000) + 1000)}`,
    email: normalizeEmail(payload.email),
    name: safeTrim(payload.name) || currentUser.name,
    surname: safeTrim(payload.surname) || currentUser.surname,
    role: nextRole,
  };

  return { user: currentUser, tokens: buildMockTokens() };
};

export const mockRefreshTokens = () => buildMockTokens();

export const mockFetchMe = () => currentUser;

/** -----------------------------
 *  Booking + Issue mock (richer scenarios)
 *  ----------------------------- */

/**
 * Booking type’ında notes alanı olmayabilir.
 * O yüzden notları “extras” içinde tutuyoruz (UI isterse buradan okur).
 */
const bookingExtras = new Map<string, { notes?: string }>();

const estimateEtaMinutes = (arrivalIso: string, stationId: string) => {
  const arrival = new Date(arrivalIso);
  const diffMin = Math.round((arrival.getTime() - Date.now()) / 60000);
  const station = stationById.get(stationId);
  const stationPressure = station ? Math.round(station.serviceTargetMinutes / 6) : 4;

  // diffMin gelecekteyse “yaklaşık varışa kalan”, geçmişteyse 0
  const base = diffMin > 0 ? diffMin : 0;

  // “queue realism”: kapıda/rıhtımda 0 bile olsa küçük bir bekleme payı
  const buffer = clamp(stationPressure, 2, 10);

  return clamp(base + buffer, 0, 240);
};

const makeBookingId = (facilityId: string, n: number) => {
  const f = facilityById.get(facilityId);
  const code = f?.code ?? 'KY';
  return `b-${code}-${String(n).padStart(4, '0')}`;
};

const seedBookings: Booking[] = [
  {
    id: makeBookingId('fac-mg-01', 1),
    facilityId: 'fac-mg-01',
    facilityName: facilityNames['fac-mg-01'],
    stationId: 'st-mg-g1',
    stationName: stationNames['st-mg-g1'],
    arrivalTime: minutesFromNow(35),
    etaMinutes: estimateEtaMinutes(minutesFromNow(35), 'st-mg-g1'),
    status: 'confirmed',
    createdAt: minutesFromNow(-180),
    updatedAt: minutesFromNow(-40),
  },
  {
    id: makeBookingId('fac-lk-01', 2),
    facilityId: 'fac-lk-01',
    facilityName: facilityNames['fac-lk-01'],
    stationId: 'st-lk-g2',
    stationName: stationNames['st-lk-g2'],
    arrivalTime: minutesFromNow(85),
    etaMinutes: estimateEtaMinutes(minutesFromNow(85), 'st-lk-g2'),
    status: 'pending',
    createdAt: minutesFromNow(-210),
    updatedAt: minutesFromNow(-120),
  },
  {
    id: makeBookingId('fac-gn-01', 3),
    facilityId: 'fac-gn-01',
    facilityName: facilityNames['fac-gn-01'],
    stationId: 'st-gn-d1',
    stationName: stationNames['st-gn-d1'],
    arrivalTime: minutesFromNow(160),
    etaMinutes: estimateEtaMinutes(minutesFromNow(160), 'st-gn-d1'),
    status: 'confirmed',
    createdAt: minutesFromNow(-520),
    updatedAt: minutesFromNow(-60),
  },
  {
    id: makeBookingId('fac-gz-01', 4),
    facilityId: 'fac-gz-01',
    facilityName: facilityNames['fac-gz-01'],
    stationId: 'st-gz-d1',
    stationName: stationNames['st-gz-d1'],
    arrivalTime: minutesFromNow(25),
    etaMinutes: estimateEtaMinutes(minutesFromNow(25), 'st-gz-d1'),
    status: 'pending',
    createdAt: minutesFromNow(-90),
    updatedAt: minutesFromNow(-30),
  },
  {
    id: makeBookingId('fac-is-01', 5),
    facilityId: 'fac-is-01',
    facilityName: facilityNames['fac-is-01'],
    stationId: 'st-is-w1',
    stationName: stationNames['st-is-w1'],
    arrivalTime: minutesFromNow(55),
    etaMinutes: estimateEtaMinutes(minutesFromNow(55), 'st-is-w1'),
    status: 'confirmed',
    createdAt: minutesFromNow(-130),
    updatedAt: minutesFromNow(-20),
  },
  {
    id: makeBookingId('fac-lk-01', 6),
    facilityId: 'fac-lk-01',
    facilityName: facilityNames['fac-lk-01'],
    stationId: 'st-lk-i1',
    stationName: stationNames['st-lk-i1'],
    arrivalTime: minutesFromNow(-70),
    etaMinutes: 0,
    status: 'cancelled',
    createdAt: minutesFromNow(-600),
    updatedAt: minutesFromNow(-65),
  },
];

bookingExtras.set(seedBookings[0].id, { notes: 'Gümrük evrakı: T1 + fatura çıktısı hazır.' });
bookingExtras.set(seedBookings[1].id, { notes: 'Kapı B hızlı geçiş — palet sayısı: 18.' });
bookingExtras.set(seedBookings[3].id, { notes: 'Soğuk zincir: 4°C, kapı aç-kapa minimum.' });

let bookings = [...seedBookings];
let bookingCounter = seedBookings.length + 1;

const ACTIVE_BOOKING_STATUSES = new Set<BookingStatus>(['pending', 'confirmed', 'arrived']);

const buildActiveStationCounts = () => {
  const counts = new Map<string, number>();
  for (const booking of bookings) {
    if (!ACTIVE_BOOKING_STATUSES.has(booking.status)) continue;
    counts.set(booking.stationId, (counts.get(booking.stationId) ?? 0) + 1);
  }
  return counts;
};

const getStationLoad = (stationId: string, counts: Map<string, number>) => {
  const capacity = getStationCapacity(stationId);
  const occupied = counts.get(stationId) ?? 0;
  const available = Math.max(0, capacity - occupied);
  const utilization = capacity > 0 ? occupied / capacity : 1;
  return { capacity, occupied, available, utilization };
};

const pickBestStationId = (facilityId: string, counts: Map<string, number>) => {
  const scored = STATIONS.flatMap((station, index) => {
    if (station.facilityId !== facilityId) return [];
    const load = getStationLoad(station.id, counts);
    return [{ station, index, ...load }];
  }).filter((entry) => entry.available > 0);

  scored.sort((a, b) => {
    if (b.available !== a.available) return b.available - a.available;
    if (a.utilization !== b.utilization) return a.utilization - b.utilization;
    if (b.capacity !== a.capacity) return b.capacity - a.capacity;
    return a.index - b.index;
  });

  return scored[0]?.station.id ?? null;
};

let issues: Issue[] = [
  {
    id: 'i-KY-0001',
    bookingId: seedBookings[0].id,
    category: 'Document Missing',
    description: 'Gümrük kapısında T1 belgesi eksik görünüyor. Yeniden yükleyin.',
    photoUrl: 'https://picsum.photos/seed/kktc-docs/800/600',
    status: 'open',
    createdAt: minutesFromNow(-25),
  },
  {
    id: 'i-KY-0002',
    bookingId: seedBookings[3].id,
    category: 'Cold Chain Risk',
    description: 'Rampa yoğun. Soğuk zincir gecikme riski: öncelik talebi açıldı.',
    photoUrl: 'https://picsum.photos/seed/kktc-cold/800/600',
    status: 'open',
    createdAt: minutesFromNow(-15),
  },
];

let issueCounter = issues.length + 1;

const resolveBookingStatus = (status?: BookingStatus | 'all') => {
  if (!status || status === 'all') return null;
  return status;
};

export const listMockBookings = (params?: ListBookingsParams) => {
  const status = resolveBookingStatus(params?.status);
  const next = status ? bookings.filter((b) => b.status === status) : [...bookings];
  // return shallow clones so UI can’t mutate source accidentally
  return next.map((b) => ({ ...b }));
};

export const getMockBooking = (id: string) => {
  const booking = bookings.find((b) => b.id === id);
  if (!booking) throw new Error('Mock booking not found');
  return { ...booking };
};

/**
 * Optional: UI notes okumak isterse
 */
export const getMockBookingNotes = (bookingId: string) => bookingExtras.get(bookingId)?.notes;

export const createMockBooking = (payload: CreateBookingPayload) => {
  const facility = facilityById.get(payload.facilityId);
  const counts = buildActiveStationCounts();
  const resolvedStationId = payload.stationId ?? pickBestStationId(payload.facilityId, counts);

  if (!facility) throw new Error(`Mock facility not found: ${payload.facilityId}`);
  if (!resolvedStationId) {
    throw new Error(`No available stations for facility: ${payload.facilityId}`);
  }

  const station = stationById.get(resolvedStationId);
  if (!station) throw new Error(`Mock station not found: ${resolvedStationId}`);
  if (station.facilityId !== payload.facilityId) {
    throw new Error(`Mock station not in facility: ${station.id}`);
  }

  const load = getStationLoad(station.id, counts);
  if (load.available <= 0) throw new Error(`Station is full: ${station.id}`);

  const id = makeBookingId(payload.facilityId, bookingCounter++);
  const etaMinutes = estimateEtaMinutes(payload.arrivalTime, station.id);

  const booking: Booking = {
    id,
    facilityId: payload.facilityId,
    facilityName: facility.name,
    stationId: station.id,
    stationName: station.name,
    arrivalTime: payload.arrivalTime,
    etaMinutes,
    status: 'pending',
    createdAt: isoNow(),
    updatedAt: isoNow(),
  };

  bookings = [booking, ...bookings];

  if (payload.notes) bookingExtras.set(id, { notes: payload.notes });

  return { ...booking };
};

export const updateMockBooking = (id: string, payload: UpdateBookingPayload) => {
  const current = bookings.find((b) => b.id === id);
  if (!current) throw new Error('Mock booking not found');

  const nextStationId = payload.stationId ?? current.stationId;
  const station = stationById.get(nextStationId);
  if (!station) throw new Error(`Mock station not found: ${nextStationId}`);
  if (station.facilityId !== current.facilityId) {
    throw new Error(`Mock station not in facility: ${nextStationId}`);
  }
  if (nextStationId !== current.stationId) {
    const counts = buildActiveStationCounts();
    const load = getStationLoad(nextStationId, counts);
    if (load.available <= 0) throw new Error(`Station is full: ${nextStationId}`);
  }

  const nextArrival = payload.arrivalTime ?? current.arrivalTime;

  const next: Booking = {
    ...current,
    arrivalTime: nextArrival,
    stationId: nextStationId,
    stationName: station.name,
    etaMinutes: estimateEtaMinutes(nextArrival, nextStationId),
    updatedAt: isoNow(),
  };

  bookings = bookings.map((b) => (b.id === id ? next : b));

  // notes -> extras (safe)
  if (typeof payload.notes !== 'undefined') {
    const existing = bookingExtras.get(id) ?? {};
    bookingExtras.set(id, { ...existing, notes: payload.notes });
  }

  return { ...next };
};

export const cancelMockBooking = (id: string) => {
  const current = bookings.find((b) => b.id === id);
  if (!current) throw new Error('Mock booking not found');

  const next: Booking = {
    ...current,
    status: 'cancelled',
    etaMinutes: 0,
    updatedAt: isoNow(),
  };

  bookings = bookings.map((b) => (b.id === id ? next : b));

  return { ...next };
};

export const completeMockBooking = (id: string) => {
  const current = bookings.find((b) => b.id === id);
  if (!current) throw new Error('Mock booking not found');

  const next: Booking = {
    ...current,
    status: 'completed',
    etaMinutes: 0,
    updatedAt: isoNow(),
  };

  bookings = bookings.map((b) => (b.id === id ? next : b));

  return { ...next };
};

export const createMockIssue = (payload: CreateIssuePayload) => {
  const id = `i-KY-${String(issueCounter++).padStart(4, '0')}`;

  const issue: Issue = {
    id,
    bookingId: payload.bookingId,
    category: payload.category,
    description: payload.description,
    photoUrl: payload.photoUrl,
    status: 'open',
    createdAt: isoNow(),
  };

  issues = [issue, ...issues];

  return { ...issue };
};

export const listMockIssues = (params?: ListIssuesParams) => {
  let next = [...issues];

  if (params?.status) next = next.filter((issue) => issue.status === params.status);
  if (params?.bookingId) next = next.filter((issue) => issue.bookingId === params.bookingId);

  return next.map((i) => ({ ...i }));
};

/** -----------------------------
 *  Convenience: “reset” for dev
 *  ----------------------------- */
export const resetMockData = () => {
  currentUser = { ...seedUsers.carrier };
  bookings = [...seedBookings];
  issues = [
    ...issues.slice(0, 2), // keep initial two (or rebuild if you prefer)
  ];
  queueEvents = [...seedQueueEvents];
  queueEventCounter = seedQueueEvents.length + 1;
  stationStats = [];
  bookingExtras.clear();
  bookingExtras.set(seedBookings[0].id, { notes: 'Gümrük evrakı: T1 + fatura çıktısı hazır.' });
  bookingExtras.set(seedBookings[1].id, { notes: 'Kapı B hızlı geçiş — palet sayısı: 18.' });
  bookingExtras.set(seedBookings[3].id, { notes: 'Soğuk zincir: 4°C, kapı aç-kapa minimum.' });
  bookingCounter = seedBookings.length + 1;
  issueCounter = issues.length + 1;
};
