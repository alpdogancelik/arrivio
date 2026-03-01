// app/(tabs)/home/index.tsx
import React, { memo, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Link } from 'expo-router';
import { Image, type ImageSource } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/components/auth-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';

import { fetchBookings } from '@/api/bookings';
import { fetchFacilities } from '@/api/facilities';
import { fetchStations } from '@/api/stations';
import type { Booking } from '@/types/api';
import { queryKeys } from '@/query/keys';
import { appConfig } from '@/config';
import { images } from '@/constants/images';

type StatusTone = 'default' | 'warning' | 'success';

type QuickLink = {
  id: string;
  href: AppRoute;
  label: string;
  hint: string;
  icon: React.ComponentProps<typeof IconSymbol>['name'];
  art: ImageSource;
};

type PulseMetric = {
  id: string;
  label: string;
  value: string;
  delta: string;
  progress: number;
};

/**
 * ✅ ROUTING (IMPORTANT)
 * expo-router route group "(tabs)" URL’nin parçası DEĞİL.
 * Typed Href’le kavga etmemek için relative path kullanıyoruz.
 */
const ROUTES = {
  map: '../map',
  pulse: '../pulse',
  bookings: '../bookings',
  bookingNew: '../bookings/new',
  issues: '../issues',
  profile: '../profile',
} as const;

type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

const STATUS_PALETTE: Record<StatusTone, { bg: string; fg: string }> = {
  default: { bg: '#2b8cff20', fg: '#2b8cff' },
  warning: { bg: '#ffd16620', fg: '#ffd166' },
  success: { bg: '#22c55e20', fg: '#22c55e' },
};

function clampPercent(n: number) {
  return Math.max(0, Math.min(100, n));
}

function formatArrival(value?: string) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getActiveBooking(bookings: Booking[]) {
  if (!Array.isArray(bookings) || bookings.length === 0) return null;
  const sorted = [...bookings].sort(
    (a, b) => new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime(),
  );
  return sorted.find((b) => b.status !== 'cancelled') ?? null;
}

/**
 * Link + Pressable birleşimi:
 * - iOS/Android/Web tutarlı button görünümü
 * - Href typing kavgalarını relative route ile çözüyoruz
 */
const LinkButton = memo(function LinkButton(props: {
  href: AppRoute;
  style: StyleProp<ViewStyle>;
  children: React.ReactNode;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const { href, style, children, disabled, accessibilityLabel } = props;

  return (
    <Link href={href} asChild>
      <Pressable
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        android_ripple={{ color: '#2b8cff22' }}
        style={({ pressed }) => [style, pressed && !disabled ? styles.pressed : null]}
      >
        {children}
      </Pressable>
    </Link>
  );
});

const StatusPill = memo(function StatusPill(props: { label: string; tone?: StatusTone }) {
  const { label, tone = 'default' } = props;
  const p = STATUS_PALETTE[tone];
  return (
    <View style={[styles.pill, { backgroundColor: p.bg }]}>
      <ThemedText style={[styles.pillText, { color: p.fg }]}>{label}</ThemedText>
    </View>
  );
});

const Kpi = memo(function Kpi(props: { label: string; value: string }) {
  const { label, value } = props;
  return (
    <View style={styles.kpi}>
      <ThemedText style={styles.kpiLabel}>{label}</ThemedText>
      <ThemedText style={styles.kpiValue}>{value}</ThemedText>
    </View>
  );
});

const InfoRow = memo(function InfoRow(props: { label: string; value: string }) {
  const { label, value } = props;
  return (
    <View style={styles.row}>
      <ThemedText style={styles.rowLabel}>{label}</ThemedText>
      <ThemedText type="defaultSemiBold" style={styles.rowValue}>
        {value}
      </ThemedText>
    </View>
  );
});

export default function Dashboard() {
  const { t } = useTranslation(['home', 'booking', 'common']);
  const { user } = useAuth();

  // ✅ React Query overload fix:
  // fetchBookings(params?) gibi signature varsa, direkt vermek yerine wrapper kullan.
  const {
    data: bookingsRaw,
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useQuery<Booking[], Error>({
    queryKey: queryKeys.bookings(),
    queryFn: async () => {
      // params istemiyorsa sorun yok; istiyorsa undefined göndermek daha güvenli.
      const res = await fetchBookings(undefined as any);
      // Eğer backend farklı format döndürüyorsa burada normalize edersin.
      return (res as any) as Booking[];
    },
    staleTime: 15_000,
    retry: 1,
  });

  const { data: facilitiesRaw } = useQuery({
    queryKey: queryKeys.facilities(),
    queryFn: fetchFacilities,
    staleTime: 60_000,
  });

  const { data: stationsRaw } = useQuery({
    queryKey: queryKeys.stations(),
    queryFn: () => fetchStations(),
    staleTime: 60_000,
  });

  const bookings = useMemo(() => (Array.isArray(bookingsRaw) ? bookingsRaw : []), [bookingsRaw]);
  const facilities = useMemo(() => (Array.isArray(facilitiesRaw) ? facilitiesRaw : []), [facilitiesRaw]);
  const stations = useMemo(() => (Array.isArray(stationsRaw) ? stationsRaw : []), [stationsRaw]);
  const facilityById = useMemo(() => new Map(facilities.map((facility) => [facility.id, facility])), [facilities]);
  const stationById = useMemo(() => new Map(stations.map((station) => [station.id, station])), [stations]);
  const active = useMemo(() => getActiveBooking(bookings), [bookings]);
  const isErrored = !!error;

  // Ops placeholders (sonra API’dan bağlarsın)
  const GATE_UTILIZATION = 78;
  const GATE_DELTA = '+6%';
  const INBOUND_FLOW_VALUE = '1.3k';
  const INBOUND_FLOW_UNIT = t('home:trucksPerDay', { defaultValue: 'trucks/day' });
  const AVG_DWELL_DELTA = `-${t('common:mins', { count: 3 })}`;

  const name = user?.name ?? t('home:guest', { defaultValue: 'Carrier' });
  const activeStation = active?.stationId ? stationById.get(active.stationId) : undefined;
  const resolvedFacilityId = active?.facilityId ?? activeStation?.facilityId;
  const facilityName =
    active?.facilityName ??
    facilityById.get(resolvedFacilityId ?? '')?.name ??
    activeStation?.facilityId ??
    t('home:facilityFallback', { defaultValue: 'Facility' });

  const queueEst = active?.etaMinutes ? `${active.etaMinutes} min` : active ? '18 min' : 'TBD';
  const arrivalTime = active ? formatArrival(active.arrivalTime) : '—';

  const pulse = useMemo<PulseMetric[]>(
    () => [
      {
        id: 'gate',
        label: t('home:gateUtilization'),
        value: `${GATE_UTILIZATION}%`,
        delta: GATE_DELTA,
        progress: GATE_UTILIZATION,
      },
      {
        id: 'inbound',
        label: t('home:inboundFlow'),
        value: INBOUND_FLOW_VALUE,
        delta: INBOUND_FLOW_UNIT,
        progress: 64,
      },
      { id: 'dwell', label: t('home:avgDwell'), value: queueEst, delta: AVG_DWELL_DELTA, progress: 52 },
    ],
    [queueEst, t, INBOUND_FLOW_UNIT, AVG_DWELL_DELTA],
  );

  const quickLinks = useMemo<QuickLink[]>(
    () => [
      {
        id: 'map',
        href: ROUTES.map,
        label: t('home:quickFacilityMap'),
        hint: t('home:quickFacilityMapHint'),
        icon: 'map.fill',
        art: images.pin,
      },
      {
        id: 'book',
        href: ROUTES.bookingNew,
        label: t('home:quickBookSlot'),
        hint: t('home:quickBookSlotHint'),
        icon: 'calendar',
        art: images.clock,
      },
      {
        id: 'pulse',
        href: ROUTES.pulse,
        label: t('home:quickPulse'),
        hint: t('home:quickPulseHint'),
        icon: 'chart.bar.fill',
        art: images.performanceGrowth,
      },
      {
        id: 'bookings',
        href: ROUTES.bookings,
        label: t('home:quickBookings'),
        hint: t('home:quickBookingsHint'),
        icon: 'list.bullet.rectangle',
        art: images.priceTag,
      },
      {
        id: 'issues',
        href: ROUTES.issues,
        label: t('home:quickIssue'),
        hint: t('home:quickIssueHint'),
        icon: 'exclamationmark.triangle',
        art: images.alarm,
      },
      {
        id: 'profile',
        href: ROUTES.profile,
        label: t('home:quickProfile'),
        hint: t('home:quickProfileHint'),
        icon: 'person.crop.circle',
        art: images.key,
      },
    ],
    [t],
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2b8cff" />
        }
      >
        {/* HERO */}
        <View style={styles.hero}>
          <View style={styles.heroGlowA} />
          <View style={styles.heroGlowB} />

          <View style={styles.heroTopRow}>
            <View style={styles.heroLeft}>
              <ThemedText style={styles.heroTitle}>
                {t('home:heroTitle', { name })}
              </ThemedText>

              <View style={styles.heroMetaRow}>
                <StatusPill label={t('home:live')} tone="success" />
                <View style={styles.facilityPill}>
                  <ThemedText style={styles.facilityPillText} numberOfLines={1}>
                    {facilityName}
                  </ThemedText>
                </View>
              </View>

              <ThemedText style={styles.heroSubtitle}>{t('home:heroSubtitle')}</ThemedText>
            </View>

            <Image
              source={images.performanceGrowth}
              style={styles.heroArt}
              contentFit="contain"
              cachePolicy="memory-disk"
              transition={120}
            />
          </View>

          <View style={styles.kpiRow}>
            <Kpi label={t('home:kpiNextQueue')} value={active ? queueEst : '-'} />
            <Kpi label={t('home:kpiArrival')} value={active ? arrivalTime : '-'} />
            <Kpi label={t('home:kpiGate')} value={`${GATE_UTILIZATION}%`} />
          </View>

          <View style={styles.ctaRow}>
            {active ? (
              <>
                <View style={styles.ctaCol}>
                  <LinkButton
                    href={ROUTES.pulse}
                    style={styles.ctaPrimary}
                    accessibilityLabel={t('home:openPulse')}
                  >
                    <ThemedText style={styles.ctaPrimaryText}>{t('home:openPulse')}</ThemedText>
                  </LinkButton>
                </View>

                <View style={styles.ctaCol}>
                  <LinkButton
                    href={ROUTES.map}
                    style={styles.ctaSecondary}
                    accessibilityLabel={t('home:openMap')}
                  >
                    <IconSymbol name="map.fill" size={18} color="#9bbcff" />
                    <ThemedText style={styles.ctaSecondaryText}>{t('home:openMap')}</ThemedText>
                  </LinkButton>
                </View>
              </>
            ) : (
              <>
                <View style={styles.ctaCol}>
                  <LinkButton
                    href={ROUTES.bookingNew}
                    style={styles.ctaPrimary}
                    accessibilityLabel={t('home:bookSlot')}
                  >
                    <ThemedText style={styles.ctaPrimaryText}>{t('home:bookSlot')}</ThemedText>
                  </LinkButton>
                </View>

                <View style={styles.ctaCol}>
                  <LinkButton
                    href={ROUTES.bookings}
                    style={styles.ctaSecondary}
                    accessibilityLabel={t('home:myBookings')}
                  >
                    <IconSymbol name="list.bullet.rectangle" size={18} color="#9bbcff" />
                    <ThemedText style={styles.ctaSecondaryText}>{t('home:myBookings')}</ThemedText>
                  </LinkButton>
                </View>
              </>
            )}
          </View>
        </View>

        {/* ACTIVE / ERROR CARD */}
        <ThemedView style={styles.card}>
          <Image
            source={images.pin}
            style={styles.cardGhostArt}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={120}
            pointerEvents="none"
          />

          {isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color="#2b8cff" />
              <ThemedText style={styles.loadingText}>{t('booking:loadingBookings')}</ThemedText>
            </View>
          ) : (
            <>
              <View style={styles.cardHeader}>
                <ThemedText type="subtitle" style={styles.cardTitle}>
                  {active
                    ? t('home:upcomingBooking')
                    : isErrored
                      ? t('home:couldNotLoad')
                      : t('home:noActiveBooking')}
                </ThemedText>

                {active ? (
                  <StatusPill label={t('home:confirmed')} tone="success" />
                ) : (
                  <StatusPill label={t('home:actionNeeded')} tone="warning" />
                )}
              </View>

              {active ? (
                <>
                  <InfoRow label={t('home:facility')} value={active.facilityName ?? facilityName} />
                  <View style={styles.divider} />
                  <InfoRow
                    label={t('home:station')}
                    value={active.stationName ?? activeStation?.name ?? active.stationId ?? '-'}
                  />
                  <View style={styles.divider} />
                  <InfoRow label={t('home:arrival')} value={arrivalTime} />
                  <View style={styles.divider} />
                  <InfoRow label={t('home:queueEstimate')} value={queueEst} />

                  <View style={styles.actionsRow}>
                    <LinkButton
                      href={ROUTES.pulse}
                      style={styles.smallAction}
                      accessibilityLabel={t('home:pulse')}
                    >
                      <ThemedText style={styles.smallActionText}>{t('home:pulse')}</ThemedText>
                    </LinkButton>

                    <LinkButton
                      href={ROUTES.map}
                      style={styles.smallAction}
                      accessibilityLabel={t('home:openMap')}
                    >
                      <ThemedText style={styles.smallActionText}>{t('home:openMap')}</ThemedText>
                    </LinkButton>

                    <LinkButton
                      href={ROUTES.bookings}
                      style={styles.smallAction}
                      accessibilityLabel={t('home:bookings')}
                    >
                      <ThemedText style={styles.smallActionText}>{t('home:bookings')}</ThemedText>
                    </LinkButton>
                  </View>
                </>
              ) : (
                <>
                  <ThemedText style={styles.emptyTitle}>
                    {isErrored ? t('home:bookingsUnavailable') : t('home:noScheduledVisit')}
                  </ThemedText>

                  <ThemedText style={styles.emptyHint}>
                    {isErrored ? t('home:checkConnection') : t('home:bookSlotHint')}
                  </ThemedText>

                  <View style={styles.emptyActionsRow}>
                    <Pressable
                      onPress={() => refetch()}
                      android_ripple={{ color: '#2b8cff22' }}
                      style={({ pressed }) => [styles.ctaSecondarySmall, pressed ? styles.pressed : null]}
                      accessibilityRole="button"
                      accessibilityLabel={t('common:retry')}
                    >
                      <IconSymbol name="arrow.clockwise" size={18} color="#9bbcff" />
                      <ThemedText style={styles.ctaSecondaryText}>{t('common:retry')}</ThemedText>
                    </Pressable>

                    <LinkButton
                      href={ROUTES.bookingNew}
                      style={styles.ctaPrimarySmall}
                      accessibilityLabel={t('common:bookSlot')}
                    >
                      <ThemedText style={styles.ctaPrimaryText}>{t('common:bookSlot')}</ThemedText>
                    </LinkButton>
                  </View>
                </>
              )}
            </>
          )}
        </ThemedView>

        {/* PULSE */}
        <ThemedView style={styles.card}>
          <Image
            source={images.pieChart}
            style={styles.pulseGhostArt}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={120}
            pointerEvents="none"
          />

          <View style={styles.pulseHeader}>
            <ThemedText type="subtitle" style={styles.pulseTitle}>
              {t('home:operationsPulse')}
            </ThemedText>

            <View style={styles.pulseBadge}>
              <ThemedText style={styles.pulseBadgeText}>{t('home:live')}</ThemedText>
            </View>
          </View>

          <ThemedText style={styles.pulseSubtitle}>
            {t('home:operationsPulseSubtitle')}
          </ThemedText>

          <View style={styles.pulseMetrics}>
            {pulse.map((m) => (
              <View key={m.id} style={styles.pulseRow}>
                <View style={styles.pulseRowHeader}>
                  <ThemedText style={styles.pulseLabel} numberOfLines={1}>
                    {m.label}
                  </ThemedText>
                  <View style={styles.pulseValues}>
                    <ThemedText style={styles.pulseValue}>{m.value}</ThemedText>
                    <ThemedText style={styles.pulseDelta}>{m.delta}</ThemedText>
                  </View>
                </View>

                <View style={styles.pulseBarTrack}>
                  <View style={[styles.pulseBarFill, { width: `${clampPercent(m.progress)}%` }]} />
                </View>
              </View>
            ))}
          </View>
        </ThemedView>

        {/* QUICK ACCESS GRID (2 columns, stable on RN Web) */}
        <ThemedText style={styles.sectionTitle}>{t('home:quickAccess')}</ThemedText>

        <View style={styles.gridRow}>
          {quickLinks.map((item) => (
            <View key={item.id} style={styles.gridCol}>
              <Link href={item.href} asChild>
                <Pressable
                  android_ripple={{ color: '#2b8cff22' }}
                  style={({ pressed }) => [styles.tile, pressed ? styles.pressed : null]}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                >
                  <Image
                    source={item.art}
                    style={styles.tileArt}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    transition={120}
                    pointerEvents="none"
                  />

                  <View style={styles.tileIcon}>
                    <IconSymbol name={item.icon} size={20} color="#2b8cff" />
                  </View>

                  {/* minWidth:0 => flex içinde text overflow/ellipsis düzgün çalışır */}
                  <View style={styles.tileTextWrap}>
                    <ThemedText style={styles.tileTitle} numberOfLines={1}>
                      {item.label}
                    </ThemedText>
                    <ThemedText style={styles.tileHint} numberOfLines={1}>
                      {item.hint}
                    </ThemedText>
                  </View>
                </Pressable>
              </Link>
            </View>
          ))}
        </View>

        {/* FOOTER */}
        <View style={styles.footerContainer}>
          <ThemedText style={styles.footer}>
            {t('common:lastUpdated', { time: t('common:mins', { count: 5 }) })}
          </ThemedText>
          <ThemedText style={styles.footerSmall}>
            v{appConfig.version} - {t('common:appName')}
          </ThemedText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07080a' },

  // ✅ Web’de mobil gibi dursun: içerik maxWidth ile toparlanır
  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },

  pressed: { transform: [{ scale: 0.99 }], opacity: 0.96 },

  hero: {
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1a2233',
    backgroundColor: '#0b0f16',
    overflow: 'hidden',
    marginBottom: 14,
  },
  heroGlowA: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: '#2b8cff22',
    top: -120,
    right: -90,
  },
  heroGlowB: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 999,
    backgroundColor: '#22c55e12',
    bottom: -120,
    left: -90,
  },

  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  heroLeft: { flex: 1, minWidth: 0 },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '900' },
  heroSubtitle: { color: '#9aa0a6', fontSize: 13, marginTop: 8, maxWidth: '92%' },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  facilityPill: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#0a1426',
    borderWidth: 1,
    borderColor: '#22324f',
    maxWidth: 220,
  },
  facilityPillText: { color: '#9bbcff', fontSize: 12, fontWeight: '800' },
  heroArt: { width: 120, height: 120, opacity: 0.9, marginLeft: 12, marginTop: -6 },

  kpiRow: { flexDirection: 'row', marginTop: 14 },
  kpi: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#070b12',
    borderWidth: 1,
    borderColor: '#152038',
  },
  kpiLabel: {
    color: '#8a8a8a',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  kpiValue: { color: '#fff', fontSize: 14, fontWeight: '900', marginTop: 6 },

  // KPI spacing without gap
  // We'll space with margins on the middle items
  // (RN Web + gap bazen tutarsız)
  // So: 1st no margin, middle marginHorizontal, last no margin
  // We'll apply via wrapper by using separate views? Instead keep simple: apply in render? Not needed; ok look is fine even without.
  // If you want perfect spacing: wrap each KPI in a <View style={{flex:1, marginRight:10}} />

  ctaRow: { flexDirection: 'row', marginTop: 12 },
  ctaCol: { flex: 1 },
  ctaPrimary: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: '#2b8cff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginRight: 10,
  },
  ctaPrimaryText: { color: '#fff', fontWeight: '900', fontSize: 14 },

  ctaSecondary: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: '#070b12',
    borderWidth: 1,
    borderColor: '#1a2233',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: 12,
  },
  ctaSecondaryText: { color: '#9bbcff', fontWeight: '900', fontSize: 13, marginLeft: 8 },

  card: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1a2233',
    backgroundColor: '#0b0f16',
    marginBottom: 14,
    overflow: 'hidden',
  },
  cardGhostArt: { position: 'absolute', right: -10, top: -8, width: 150, height: 150, opacity: 0.08 },

  loadingBox: { alignItems: 'center', paddingVertical: 12 },
  loadingText: { color: '#cfcfcf', marginTop: 8 },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle: { color: '#fff' },

  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  rowLabel: { color: '#8a8a8a', fontSize: 13 },
  rowValue: { color: '#fff', fontWeight: '800' },
  divider: { height: 1, backgroundColor: '#10182a', marginVertical: 2 },

  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 },
  smallAction: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#070b12',
    borderWidth: 1,
    borderColor: '#1a2233',
    marginRight: 10,
    marginBottom: 10,
  },
  smallActionText: { color: '#9bbcff', fontWeight: '900', fontSize: 13 },

  emptyTitle: { color: '#fff', fontSize: 15, fontWeight: '900', marginTop: 4 },
  emptyHint: { color: '#9aa0a6', fontSize: 13, marginTop: 6, lineHeight: 18 },

  emptyActionsRow: { flexDirection: 'row', marginTop: 12 },
  ctaPrimarySmall: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: '#2b8cff',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  ctaSecondarySmall: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: '#070b12',
    borderWidth: 1,
    borderColor: '#1a2233',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: 12,
  },

  // Pulse card
  pulseGhostArt: { position: 'absolute', right: -20, top: 10, width: 150, height: 150, opacity: 0.10 },
  pulseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pulseTitle: { color: '#fff' },
  pulseBadge: {
    backgroundColor: '#0a1426',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2b8cff40',
  },
  pulseBadgeText: { color: '#9bbcff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  pulseSubtitle: { color: '#9aa0a6', marginTop: 6, marginBottom: 12, maxWidth: '86%' },

  pulseMetrics: {},
  pulseRow: { marginBottom: 12 },
  pulseRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pulseLabel: { color: '#cfcfcf', fontSize: 13, fontWeight: '700', maxWidth: '60%' },
  pulseValues: { flexDirection: 'row', alignItems: 'baseline' },
  pulseValue: { color: '#fff', fontWeight: '900' },
  pulseDelta: { color: '#2b8cff', fontSize: 12, fontWeight: '800', marginLeft: 8 },
  pulseBarTrack: { height: 6, backgroundColor: '#0a0d14', borderRadius: 999, overflow: 'hidden', marginTop: 6 },
  pulseBarFill: { height: '100%', backgroundColor: '#2b8cff', borderRadius: 999 },

  sectionTitle: { color: '#cfcfcf', fontWeight: '900', marginTop: 2, marginBottom: 10, fontSize: 15 },

  // ✅ Grid: wrapper padding approach => RN Web’de “gap” sorun çıkarmasın
  gridRow: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  gridCol: { width: '50%', paddingHorizontal: 6, paddingBottom: 12 },

  tile: {
    minHeight: 96,
    borderRadius: 16,
    backgroundColor: '#0b0f16',
    borderWidth: 1,
    borderColor: '#1a2233',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  tileArt: {
    position: 'absolute',
    right: -24,
    top: -18,
    width: 120,
    height: 120,
    opacity: 0.06,
    transform: [{ rotate: '12deg' }],
  },
  tileIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#0a1426',
    borderWidth: 1,
    borderColor: '#22324f',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  tileTextWrap: { flex: 1, minWidth: 0 },
  tileTitle: { color: '#fff', fontWeight: '900', fontSize: 13 },
  tileHint: { color: '#9aa0a6', fontSize: 12, marginTop: 2 },

  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  pillText: { fontSize: 12, fontWeight: '900' },

  footerContainer: { marginTop: 14, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#0f1626' },
  footer: { textAlign: 'center', color: '#7a7a7a', marginTop: 8, fontSize: 13 },
  footerSmall: { textAlign: 'center', color: '#5a5a5a', marginTop: 4, fontSize: 12 },
});
