import React, { memo, useMemo } from 'react';
import {
  ActivityIndicator,
  Platform,
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

type DetailItem = {
  id: string;
  label: string;
  value: string;
  secondaryValue?: string;
};

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

function pickCopy(language: string | undefined, en: string, tr: string) {
  return language?.toLowerCase().startsWith('tr') ? tr : en;
}

function getSortTime(value?: string) {
  const ms = new Date(value ?? '').getTime();
  return Number.isFinite(ms) ? ms : Number.MAX_SAFE_INTEGER;
}

function normalizeDisplayText(value?: string | null) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.toLowerCase();
  if (['unknown', 'n/a', 'na', 'null', 'undefined', '-', '--'].includes(normalized)) {
    return undefined;
  }
  return trimmed;
}

function formatArrival(value?: string, fallback = 'Pending confirmation') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function resolveQueueEstimate(params: {
  etaMinutes?: number;
  assignmentPending: boolean;
  copy: (en: string, tr: string) => string;
}) {
  if (typeof params.etaMinutes === 'number' && Number.isFinite(params.etaMinutes)) {
    if (params.etaMinutes <= 0) return params.copy('Now', 'Simdi');
    return `${Math.round(params.etaMinutes)} ${params.copy('min', 'dk')}`;
  }
  if (params.assignmentPending) {
    return params.copy('After gate confirmation', 'Kapi onayindan sonra');
  }
  return params.copy('Unavailable', 'Kullanilamiyor');
}

function formatStationGateDetails(params: {
  stationName?: string;
  gate?: string;
  notAssignedLabel: string;
  waitingLabel: string;
  gatePrefix: string;
}) {
  const stationName = normalizeDisplayText(params.stationName);
  const gate = normalizeDisplayText(params.gate);

  if (gate && stationName) {
    return { primary: `${params.gatePrefix} ${gate}`, secondary: stationName, isAssigned: true };
  }
  if (gate) return { primary: `${params.gatePrefix} ${gate}`, secondary: undefined, isAssigned: true };
  if (stationName) return { primary: stationName, secondary: undefined, isAssigned: true };
  return { primary: params.notAssignedLabel, secondary: params.waitingLabel, isAssigned: false };
}

function formatBookingReference(id: string | undefined, fallback: string) {
  const raw = String(id ?? '').trim();
  if (!raw) return fallback;

  const digits = raw.replace(/\D/g, '');
  if (digits) {
    return `#${digits.slice(-4).padStart(4, '0')}`;
  }

  const clean = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (!clean) return fallback;
  return `#${clean.slice(-6)}`;
}

function getActiveBooking(bookings: Booking[]) {
  if (!Array.isArray(bookings) || bookings.length === 0) return null;
  return [...bookings]
    .filter((booking) => booking.status !== 'cancelled' && booking.status !== 'completed')
    .sort((a, b) => getSortTime(a.arrivalTime) - getSortTime(b.arrivalTime))[0] ?? null;
}

function getStatusMeta(
  status: Booking['status'] | undefined,
  t: ReturnType<typeof useTranslation>['t'],
  copy: (en: string, tr: string) => string,
) {
  switch (status) {
    case 'confirmed':
      return {
        label: t('home:statusConfirmed', { defaultValue: copy('Confirmed', 'Onaylandi') }),
        tone: 'success' as const,
      };
    case 'arrived':
      return {
        label: t('home:statusArrived', { defaultValue: copy('On site', 'Tesiste') }),
        tone: 'default' as const,
      };
    case 'servicing':
      return {
        label: t('home:statusServicing', { defaultValue: copy('In service', 'Islemde') }),
        tone: 'default' as const,
      };
    case 'pending':
      return {
        label: t('home:statusPending', { defaultValue: copy('Pending confirmation', 'Onay bekleniyor') }),
        tone: 'warning' as const,
      };
    default:
      return {
        label: t('home:statusScheduled', { defaultValue: copy('Scheduled', 'Planlandi') }),
        tone: 'default' as const,
      };
  }
}

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
  const palette = STATUS_PALETTE[tone];
  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }]}>
      <ThemedText style={[styles.pillText, { color: palette.fg }]}>{label}</ThemedText>
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

const InfoRow = memo(function InfoRow(props: { label: string; value: string; secondaryValue?: string }) {
  const { label, value, secondaryValue } = props;
  return (
    <View style={styles.row}>
      <ThemedText style={styles.rowLabel}>{label}</ThemedText>
      <View style={styles.rowValueWrap}>
        <ThemedText type="defaultSemiBold" style={styles.rowValue}>
          {value}
        </ThemedText>
        {secondaryValue ? <ThemedText style={styles.rowSubValue}>{secondaryValue}</ThemedText> : null}
      </View>
    </View>
  );
});

export default function HomeScreen() {
  const { t, i18n } = useTranslation(['home', 'booking', 'common']);
  const { user } = useAuth();
  const copy = (en: string, tr: string) => pickCopy(i18n.resolvedLanguage ?? i18n.language, en, tr);

  const {
    data: bookingsRaw,
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useQuery<Booking[], Error>({
    queryKey: queryKeys.bookings(),
    queryFn: async () => {
      const response = await fetchBookings(undefined as never);
      return response as unknown as Booking[];
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
  const isInitialLoading = isLoading && bookings.length === 0;

  const gateUtilization = 78;
  const inboundFlowValue = '1.3k';
  const inboundFlowUnit = t('home:trucksPerDay', { defaultValue: copy('trucks/day', 'arac/gun') });
  const name = normalizeDisplayText(user?.name) ?? t('home:guest', { defaultValue: copy('Carrier', 'Tasiyici') });
  const gatePrefix = t('home:gateLabelShort', { defaultValue: copy('Gate', 'Kapi') });
  const notAssignedYetText = t('home:notAssignedYet', { defaultValue: copy('Not assigned yet', 'Henuz atanmadi') });
  const waitingGateText = t('home:waitingGateConfirm', {
    defaultValue: copy('Waiting for gate confirmation', 'Kapi onayi bekleniyor'),
  });
  const referenceUnavailableText = t('home:referenceUnavailable', {
    defaultValue: copy('Reference unavailable', 'Referans kullanilamiyor'),
  });
  const estimatedArrivalLabel = t('home:estimatedArrivalLabel', {
    defaultValue: copy('Estimated time arrival', 'Tahmini varis zamani'),
  });

  const activeStation = active?.stationId ? stationById.get(active.stationId) : undefined;
  const resolvedFacilityId = active?.facilityId ?? activeStation?.facilityId;
  const resolvedFacilityName =
    normalizeDisplayText(active?.facilityName) ?? normalizeDisplayText(facilityById.get(resolvedFacilityId ?? '')?.name);
  const facilityDisplay =
    resolvedFacilityName ??
    t('home:facilityPendingLabel', { defaultValue: copy('Facility confirmation pending', 'Tesis onayi bekleniyor') });

  const stationGate = formatStationGateDetails({
    stationName: active?.stationName ?? activeStation?.name,
    gate: activeStation?.gate,
    notAssignedLabel: notAssignedYetText,
    waitingLabel: waitingGateText,
    gatePrefix,
  });

  const isStatusPending = active?.status === 'pending';
  const isAssignmentPending = Boolean(active) && (isStatusPending || !stationGate.isAssigned || !resolvedFacilityName);
  const isRouteReady = Boolean(active) && !isAssignmentPending;
  const isActiveLoaded = Boolean(active);

  const arrivalDisplay = active
    ? formatArrival(active.arrivalTime, t('home:arrivalPendingLabel', { defaultValue: copy('Arrival awaiting confirmation', 'Varis onay bekliyor') }))
    : t('home:arrivalPendingLabel', { defaultValue: copy('Arrival awaiting confirmation', 'Varis onay bekliyor') });

  const queueEstimateDisplay = active
    ? resolveQueueEstimate({
        etaMinutes: active.etaMinutes,
        assignmentPending: isAssignmentPending,
        copy,
      })
    : t('home:queueEstimateAfterConfirm', {
        defaultValue: copy('Estimate available after confirmation', 'Tahmin onaydan sonra gorunur'),
      });

  const bookingReference = formatBookingReference(active?.id, referenceUnavailableText);
  const statusMeta = useMemo(() => getStatusMeta(active?.status, t, copy), [active?.status, copy, t]);

  const heroTitle = !active
    ? isInitialLoading
      ? t('home:heroLoadingTitle', { defaultValue: copy('Checking next arrival', 'Sonraki varis kontrol ediliyor') })
      : t('home:heroNoPlanTitle', { defaultValue: copy('No planned arrival', 'Planli varis yok') })
    : isRouteReady
      ? t('home:heroRouteReadyTitle', { defaultValue: copy('Route ready', 'Rota hazir') })
      : isStatusPending
        ? t('home:heroArrivalPendingTitle', { defaultValue: copy('Arrival awaiting confirmation', 'Varis onay bekliyor') })
        : t('home:heroGatePendingTitle', { defaultValue: copy('Gate assignment pending', 'Kapi atamasi bekleniyor') });

  const heroSubtitle = !active
    ? t('home:heroNoPlanSubtitle', {
        defaultValue: copy(
          'Book a slot before departure to lock your next stop.',
          'Yola cikmadan once bir slot alarak sonraki duragini netlestir.',
        ),
      })
    : isRouteReady
      ? t('home:heroReadySubtitle', {
          defaultValue: copy(
            'Next stop at {{facility}}. Open route and move to your assigned gate.',
            'Sonraki durak {{facility}}. Rotayi ac ve atanan kapina ilerle.',
          ),
          facility: facilityDisplay,
        })
      : t('home:heroPendingSubtitle', {
          defaultValue: copy(
            'Assignment is still being confirmed. Review live status before departure.',
            'Atama halen onaylaniyor. Yola cikmadan once canli durumu kontrol et.',
          ),
        });

  const heroSummary = useMemo<DetailItem[]>(() => {
    if (!active) return [];
    return [
      {
        id: 'arrival',
        label: estimatedArrivalLabel,
        value: arrivalDisplay,
      },
      {
        id: 'location',
        label: t('home:stationGateLabel', { defaultValue: copy('Station / Gate', 'Istasyon / Kapi') }),
        value: stationGate.primary,
        secondaryValue: stationGate.secondary,
      },
      {
        id: 'queue',
        label: t('home:queueEstimateLabel', { defaultValue: copy('Queue estimate', 'Kuyruk tahmini') }),
        value: queueEstimateDisplay,
      },
    ];
  }, [active, arrivalDisplay, copy, estimatedArrivalLabel, queueEstimateDisplay, stationGate.primary, stationGate.secondary, t]);

  const arrivalBriefRows = useMemo<DetailItem[]>(() => {
    if (!active) return [];
    return [
      {
        id: 'reference',
        label: t('home:bookingReferenceLabel', { defaultValue: copy('Booking reference', 'Rezervasyon referansi') }),
        value: bookingReference,
      },
      {
        id: 'facility',
        label: t('home:facility', { defaultValue: copy('Facility', 'Tesis') }),
        value: facilityDisplay,
      },
      {
        id: 'location',
        label: t('home:stationGateLabel', { defaultValue: copy('Station / Gate', 'Istasyon / Kapi') }),
        value: stationGate.primary,
        secondaryValue: stationGate.secondary,
      },
      {
        id: 'arrival',
        label: estimatedArrivalLabel,
        value: arrivalDisplay,
      },
      {
        id: 'queue',
        label: t('home:queueEstimateLabel', { defaultValue: copy('Queue estimate', 'Kuyruk tahmini') }),
        value: queueEstimateDisplay,
      },
      {
        id: 'status',
        label: t('home:currentStatusLabel', { defaultValue: copy('Current status', 'Guncel durum') }),
        value: statusMeta.label,
      },
    ];
  }, [active, arrivalDisplay, bookingReference, copy, estimatedArrivalLabel, facilityDisplay, queueEstimateDisplay, stationGate.primary, stationGate.secondary, statusMeta.label, t]);

  const pulseGuidance = gateUtilization >= 85
    ? t('home:pulseGuidanceHigh', { defaultValue: copy('Delay risk moderate. Re-check before departure.', 'Gecikme riski orta. Cikistan once yeniden kontrol et.') })
    : gateUtilization >= 65
      ? t('home:pulseGuidanceStable', { defaultValue: copy('Gate load stable. Best to check before departure.', 'Kapi yogunlugu stabil. Cikistan once kontrol etmen iyi olur.') })
      : t('home:pulseGuidanceLow', { defaultValue: copy('No major congestion detected.', 'Buyuk bir yogunluk gorulmuyor.') });

  const pulseMetrics = useMemo<PulseMetric[]>(
    () => [
      {
        id: 'gate-load',
        label: t('home:pulseGateLoadLabel', { defaultValue: copy('Gate load now', 'Anlik kapi yogunlugu') }),
        value: `${gateUtilization}%`,
        delta: gateUtilization >= 80 ? copy('Busy now', 'Yogun') : copy('Stable', 'Stabil'),
        progress: gateUtilization,
      },
      {
        id: 'inbound',
        label: t('home:pulseInboundLabel', { defaultValue: copy('Inbound arrivals', 'Yaklasan araclar') }),
        value: inboundFlowValue,
        delta: inboundFlowUnit,
        progress: 62,
      },
      {
        id: 'eta',
        label: estimatedArrivalLabel,
        value: queueEstimateDisplay,
        delta: t('home:pulseEtaDelta', { defaultValue: copy('Live update', 'Canli guncelleme') }),
        progress: isAssignmentPending ? 38 : 58,
      },
    ],
    [copy, estimatedArrivalLabel, gateUtilization, inboundFlowUnit, inboundFlowValue, isAssignmentPending, queueEstimateDisplay, t],
  );

  const quickLinks = useMemo<QuickLink[]>(
    () => [
      {
        id: 'map',
        href: ROUTES.map,
        label: t('home:quickMapLabel', { defaultValue: copy('Live map', 'Canli harita') }),
        hint: t('home:quickMapHint', { defaultValue: copy('Route, gate, directions', 'Rota, kapi, yonlendirme') }),
        icon: 'map.fill',
        art: images.pin,
      },
      {
        id: 'book',
        href: ROUTES.bookingNew,
        label: t('home:quickBookLabel', { defaultValue: copy('Book slot', 'Slot al') }),
        hint: t('home:quickBookHint', { defaultValue: copy('Plan next arrival', 'Sonraki varisi planla') }),
        icon: 'calendar',
        art: images.clock,
      },
      {
        id: 'bookings',
        href: ROUTES.bookings,
        label: t('home:quickBookingsLabel', { defaultValue: copy('Bookings', 'Rezervasyonlar') }),
        hint: t('home:quickBookingsHintShort', { defaultValue: copy('Change or review slots', 'Slotlarini yonet') }),
        icon: 'list.bullet.rectangle',
        art: images.priceTag,
      },
      {
        id: 'issues',
        href: ROUTES.issues,
        label: t('home:quickIssuesLabel', { defaultValue: copy('Report issue', 'Sorun bildir') }),
        hint: t('home:quickIssuesHint', { defaultValue: copy('Delay, access, documents', 'Gecikme, erisim, evrak') }),
        icon: 'exclamationmark.triangle',
        art: images.alarm,
      },
    ],
    [copy, t],
  );

  const secondaryQuickLinks = useMemo(
    () => [
      {
        id: 'pulse',
        href: ROUTES.pulse as AppRoute,
        label: t('home:secondaryLiveStatus', { defaultValue: copy('Live status', 'Canli durum') }),
      },
      {
        id: 'profile',
        href: ROUTES.profile as AppRoute,
        label: t('home:secondaryProfile', { defaultValue: copy('Driver profile', 'Surucu profili') }),
      },
    ],
    [copy, t],
  );

  const heroArt = active ? images.pin : images.clock;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2b8cff" />
        }
      >
        <View style={styles.hero}>
          <View style={styles.heroGlowA} />
          <View style={styles.heroGlowB} />

          <View style={styles.heroTopRow}>
            <View style={styles.heroLeft}>
              <View style={styles.heroEyebrowRow}>
                <ThemedText style={styles.heroEyebrow}>
                  {t('home:heroEyebrow', { defaultValue: copy('Next action', 'Siradaki aksiyon') })}
                </ThemedText>
                <StatusPill
                  label={
                    isActiveLoaded
                      ? statusMeta.label
                      : isInitialLoading
                        ? t('home:heroSyncingBadge', { defaultValue: copy('Syncing', 'Esitleniyor') })
                        : t('home:heroBookingNeededBadge', { defaultValue: copy('Booking needed', 'Rezervasyon gerekli') })
                  }
                  tone={isActiveLoaded ? statusMeta.tone : isInitialLoading ? 'default' : 'warning'}
                />
              </View>

              <ThemedText style={styles.heroGreeting}>
                {t('home:heroGreeting', { defaultValue: copy('Hello, {{name}}', 'Merhaba, {{name}}'), name })}
              </ThemedText>
              <ThemedText style={styles.heroTitle}>{heroTitle}</ThemedText>
              <ThemedText style={styles.heroSubtitle}>{heroSubtitle}</ThemedText>

              {isActiveLoaded ? (
                <View style={styles.heroSupportRow}>
                  <ThemedText style={styles.heroSupportText} numberOfLines={1}>
                    {facilityDisplay}
                  </ThemedText>
                  <ThemedText style={styles.heroRefText}>
                    {t('home:heroRefLabel', {
                      defaultValue: copy('Ref {{reference}}', 'Ref {{reference}}'),
                      reference: bookingReference,
                    })}
                  </ThemedText>
                </View>
              ) : null}
            </View>

            <Image
              source={heroArt}
              style={styles.heroArt}
              contentFit="contain"
              cachePolicy="memory-disk"
              transition={120}
            />
          </View>

          {isActiveLoaded ? (
            <View style={styles.kpiRow}>
              {heroSummary.map((item) => (
                <View key={item.id} style={styles.kpiCol}>
                  <Kpi label={item.label} value={item.value} />
                </View>
              ))}
            </View>
          ) : isInitialLoading ? (
            <View style={styles.heroLoadingRow}>
              <ActivityIndicator color="#2b8cff" />
              <ThemedText style={styles.heroLoadingText}>
                {t('home:heroLoadingHint', {
                  defaultValue: copy('Loading your next booking and queue estimate.', 'Sonraki rezervasyonun ve kuyruk tahminin yukleniyor.'),
                })}
              </ThemedText>
            </View>
          ) : null}

          {isActiveLoaded ? (
            <View style={styles.heroActionStack}>
              <LinkButton
                href={isRouteReady ? ROUTES.map : ROUTES.pulse}
                style={styles.heroPrimaryAction}
                accessibilityLabel={
                  isRouteReady
                    ? t('home:startRouteAction', { defaultValue: copy('Start route', 'Rotayi baslat') })
                    : t('home:viewLiveStatusAction', { defaultValue: copy('View live status', 'Canli durumu gor') })
                }
              >
                <View style={styles.heroPrimaryActionInner}>
                  <View style={styles.heroPrimaryActionIcon}>
                    <IconSymbol name={isRouteReady ? 'map.fill' : 'chart.bar.fill'} size={18} color="#ffffff" />
                  </View>
                  <View style={styles.heroPrimaryActionCopy}>
                    <ThemedText style={styles.heroPrimaryActionTitle}>
                      {isRouteReady
                        ? t('home:startRouteAction', { defaultValue: copy('Start route', 'Rotayi baslat') })
                        : t('home:viewLiveStatusAction', { defaultValue: copy('View live status', 'Canli durumu gor') })}
                    </ThemedText>
                    <ThemedText style={styles.heroPrimaryActionHint}>
                      {isRouteReady
                        ? t('home:startRouteHint', {
                            defaultValue: copy(
                              'Open route and proceed to your assigned gate.',
                              'Rotayi acip atanan kapina ilerle.',
                            ),
                          })
                        : t('home:pendingPrimaryHint', {
                            defaultValue: copy(
                              'Follow live updates before committing to departure.',
                              'Yola cikmadan once canli guncellemeleri takip et.',
                            ),
                          })}
                    </ThemedText>
                  </View>
                </View>
              </LinkButton>

              <View style={styles.heroSecondaryRow}>
                <View style={styles.heroSecondaryCol}>
                  <LinkButton
                    href={ROUTES.bookings}
                    style={styles.ctaSecondary}
                    accessibilityLabel={t('home:viewLiveStatusAction', {
                      defaultValue: copy('Manage booking', 'Rezervasyonu yonet'),
                    })}
                  >
                    <IconSymbol name="list.bullet.rectangle" size={18} color="#9bbcff" />
                    <ThemedText style={styles.ctaSecondaryText}>
                      {t('home:manageBookingAction', { defaultValue: copy('Manage booking', 'Rezervasyonu yonet') })}
                    </ThemedText>
                  </LinkButton>
                </View>

                <View style={styles.heroSecondaryCol}>
                  <LinkButton
                    href={isRouteReady ? ROUTES.pulse : ROUTES.map}
                    style={styles.ctaSecondary}
                    accessibilityLabel={t('home:manageBookingAction', {
                      defaultValue: isRouteReady
                        ? copy('View live status', 'Canli durumu gor')
                        : copy('Open map', 'Haritayi ac'),
                    })}
                  >
                    <IconSymbol name={isRouteReady ? 'chart.bar.fill' : 'map.fill'} size={18} color="#9bbcff" />
                    <ThemedText style={styles.ctaSecondaryText}>
                      {isRouteReady
                        ? t('home:viewLiveStatusAction', { defaultValue: copy('View live status', 'Canli durumu gor') })
                        : t('home:openMapAction', { defaultValue: copy('Open map', 'Haritayi ac') })}
                    </ThemedText>
                  </LinkButton>
                </View>
              </View>
            </View>
          ) : !isInitialLoading ? (
            <View style={styles.heroSecondaryRow}>
              <View style={styles.heroSecondaryCol}>
                <LinkButton
                  href={ROUTES.bookingNew}
                  style={styles.ctaPrimary}
                  accessibilityLabel={t('home:bookSlotAction', { defaultValue: copy('Book slot', 'Slot al') })}
                >
                  <ThemedText style={styles.ctaPrimaryText}>
                    {t('home:bookSlotAction', { defaultValue: copy('Book slot', 'Slot al') })}
                  </ThemedText>
                </LinkButton>
              </View>

              <View style={styles.heroSecondaryCol}>
                <LinkButton
                  href={ROUTES.bookings}
                  style={styles.ctaSecondary}
                  accessibilityLabel={t('home:viewBookingsAction', { defaultValue: copy('View bookings', 'Rezervasyonlari gor') })}
                >
                  <IconSymbol name="list.bullet.rectangle" size={18} color="#9bbcff" />
                  <ThemedText style={styles.ctaSecondaryText}>
                    {t('home:viewBookingsAction', { defaultValue: copy('View bookings', 'Rezervasyonlari gor') })}
                  </ThemedText>
                </LinkButton>
              </View>
            </View>
          ) : null}
        </View>

        <ThemedView style={styles.card}>
          <Image
            source={images.pin}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={120}
            style={[styles.cardGhostArt, Platform.OS === 'web' ? ({ pointerEvents: 'none' } as any) : null]}
          />

          {isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color="#2b8cff" />
              <ThemedText style={styles.loadingText}>{t('booking:loadingBookings')}</ThemedText>
            </View>
          ) : active ? (
            <>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderCopy}>
                  <ThemedText type="subtitle" style={styles.cardTitle}>
                    {t('home:arrivalBriefTitle', { defaultValue: copy('Arrival brief', 'Varis ozeti') })}
                  </ThemedText>
                  <ThemedText style={styles.cardSubtitle}>
                    {t('home:arrivalBriefSubtitle', {
                      defaultValue: copy(
                        'Check-in summary with booking reference, assignment, and confirmation status.',
                        'Rezervasyon referansi, atama ve onay durumunu iceren check-in ozeti.',
                      ),
                    })}
                  </ThemedText>
                </View>
              </View>

              {arrivalBriefRows.map((item, index) => (
                <View key={item.id}>
                  {index > 0 ? <View style={styles.divider} /> : null}
                  <InfoRow label={item.label} value={item.value} secondaryValue={item.secondaryValue} />
                </View>
              ))}

              {isAssignmentPending ? (
                <ThemedText style={styles.cardHelper}>
                  {t('home:stationPendingHelper', {
                    defaultValue: copy(
                      'Waiting for gate confirmation. Estimate updates after confirmation.',
                      'Kapi onayi bekleniyor. Tahmin onaydan sonra guncellenir.',
                    ),
                  })}
                </ThemedText>
              ) : null}
            </>
          ) : isErrored ? (
            <>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderCopy}>
                  <ThemedText type="subtitle" style={styles.cardTitle}>
                    {t('home:errorStateTitle', { defaultValue: copy('Live schedule unavailable', 'Canli plan kullanilamiyor') })}
                  </ThemedText>
                  <ThemedText style={styles.cardSubtitle}>
                    {t('home:errorStateSubtitle', {
                      defaultValue: copy(
                        'We could not refresh your bookings right now. Retry to sync your next stop.',
                        'Rezervasyonlarin su anda yenilenemedi. Sonraki duragini esitlemek icin tekrar dene.',
                      ),
                    })}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.emptyActionsRow}>
                <View style={styles.heroSecondaryCol}>
                  <Pressable
                    onPress={() => refetch()}
                    android_ripple={{ color: '#2b8cff22' }}
                    style={({ pressed }) => [styles.ctaSecondarySmall, pressed ? styles.pressed : null]}
                    accessibilityRole="button"
                    accessibilityLabel={t('common:retry', { defaultValue: copy('Retry', 'Tekrar dene') })}
                  >
                    <IconSymbol name="arrow.clockwise" size={18} color="#9bbcff" />
                    <ThemedText style={styles.ctaSecondaryText}>
                      {t('common:retry', { defaultValue: copy('Retry', 'Tekrar dene') })}
                    </ThemedText>
                  </Pressable>
                </View>

                <View style={styles.heroSecondaryCol}>
                  <LinkButton
                    href={ROUTES.bookingNew}
                    style={styles.ctaPrimarySmall}
                    accessibilityLabel={t('home:bookSlotAction', { defaultValue: copy('Book slot', 'Slot al') })}
                  >
                    <ThemedText style={styles.ctaPrimaryText}>
                      {t('home:bookSlotAction', { defaultValue: copy('Book slot', 'Slot al') })}
                    </ThemedText>
                  </LinkButton>
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderCopy}>
                  <ThemedText type="subtitle" style={styles.cardTitle}>
                    {t('home:emptyStateTitle', { defaultValue: copy('No planned arrival', 'Planli varis yok') })}
                  </ThemedText>
                  <ThemedText style={styles.cardSubtitle}>
                    {t('home:emptyStateSubtitle', {
                      defaultValue: copy(
                        'Book your next facility slot to keep the route moving and reduce gate delays.',
                        'Rotani akista tutmak ve kapi gecikmelerini azaltmak icin sonraki tesis slotunu al.',
                      ),
                    })}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.emptyActionsRow}>
                <View style={styles.heroSecondaryCol}>
                  <LinkButton
                    href={ROUTES.bookings}
                    style={styles.ctaSecondarySmall}
                    accessibilityLabel={t('home:viewBookingsAction', { defaultValue: copy('View bookings', 'Rezervasyonlari gor') })}
                  >
                    <IconSymbol name="list.bullet.rectangle" size={18} color="#9bbcff" />
                    <ThemedText style={styles.ctaSecondaryText}>
                      {t('home:viewBookingsAction', { defaultValue: copy('View bookings', 'Rezervasyonlari gor') })}
                    </ThemedText>
                  </LinkButton>
                </View>

                <View style={styles.heroSecondaryCol}>
                  <LinkButton
                    href={ROUTES.bookingNew}
                    style={styles.ctaPrimarySmall}
                    accessibilityLabel={t('home:bookSlotAction', { defaultValue: copy('Book slot', 'Slot al') })}
                  >
                    <ThemedText style={styles.ctaPrimaryText}>
                      {t('home:bookSlotAction', { defaultValue: copy('Book slot', 'Slot al') })}
                    </ThemedText>
                  </LinkButton>
                </View>
              </View>
            </>
          )}
        </ThemedView>

        <ThemedView style={styles.card}>
          <Image
            source={images.pieChart}
            style={[styles.pulseGhostArt, Platform.OS === 'web' ? ({ pointerEvents: 'none' } as any) : null]}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={120}
          />

          <View style={styles.pulseHeader}>
            <View style={styles.cardHeaderCopy}>
              <ThemedText type="subtitle" style={styles.pulseTitle}>
                {t('home:operationsPulseTitle', { defaultValue: copy('Operational pulse', 'Operasyon nabzi') })}
              </ThemedText>
              <ThemedText style={styles.pulseSubtitle}>
                {t('home:pulseDecisionSubtitle', {
                  defaultValue: copy(
                    'Decision support before departure and slot changes.',
                    'Cikis ve slot degisikligi oncesi karar destegi.',
                  ),
                })}
              </ThemedText>
              <View style={styles.pulseGuidanceRow}>
                <IconSymbol name="checkmark.seal.fill" size={16} color="#2b8cff" />
                <ThemedText style={styles.pulseGuidanceText}>{pulseGuidance}</ThemedText>
              </View>
            </View>

            <View style={styles.pulseBadge}>
              <ThemedText style={styles.pulseBadgeText}>{t('home:live', { defaultValue: copy('LIVE', 'CANLI') })}</ThemedText>
            </View>
          </View>

          <View style={styles.pulseMetrics}>
            {pulseMetrics.map((metric) => (
              <View key={metric.id} style={styles.pulseRow}>
                <View style={styles.pulseRowHeader}>
                  <ThemedText style={styles.pulseLabel} numberOfLines={1}>
                    {metric.label}
                  </ThemedText>
                  <View style={styles.pulseValues}>
                    <ThemedText style={styles.pulseValue}>{metric.value}</ThemedText>
                    <ThemedText style={styles.pulseDelta}>{metric.delta}</ThemedText>
                  </View>
                </View>

                <View style={styles.pulseBarTrack}>
                  <View style={[styles.pulseBarFill, { width: `${clampPercent(metric.progress)}%` }]} />
                </View>
              </View>
            ))}
          </View>
        </ThemedView>

        <ThemedText style={styles.sectionTitle}>
          {t('home:quickAccessTitle', { defaultValue: copy('Quick tools', 'Hizli araclar') })}
        </ThemedText>

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
                    style={[styles.tileArt, Platform.OS === 'web' ? ({ pointerEvents: 'none' } as any) : null]}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    transition={120}
                  />

                  <View style={styles.tileIcon}>
                    <IconSymbol name={item.icon} size={20} color="#2b8cff" />
                  </View>

                  <View style={styles.tileTextWrap}>
                    <ThemedText style={styles.tileTitle} numberOfLines={1}>
                      {item.label}
                    </ThemedText>
                    <ThemedText style={styles.tileHint} numberOfLines={2}>
                      {item.hint}
                    </ThemedText>
                  </View>
                </Pressable>
              </Link>
            </View>
          ))}
        </View>

        <View style={styles.secondaryToolsRow}>
          {secondaryQuickLinks.map((item) => (
            <Link key={item.id} href={item.href} asChild>
              <Pressable
                android_ripple={{ color: '#2b8cff22' }}
                style={({ pressed }) => [styles.secondaryToolChip, pressed ? styles.pressed : null]}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <ThemedText style={styles.secondaryToolText}>{item.label}</ThemedText>
              </Pressable>
            </Link>
          ))}
        </View>

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
  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 56,
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
  heroEyebrowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroEyebrow: {
    color: '#8faed8',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroGreeting: { color: '#9aa0a6', fontSize: 13, marginBottom: 6 },
  heroTitle: { color: '#fff', fontSize: 27, fontWeight: '900', lineHeight: 32 },
  heroSubtitle: { color: '#9aa0a6', fontSize: 13, marginTop: 8, maxWidth: '94%', lineHeight: 19 },
  heroSupportRow: { marginTop: 10 },
  heroSupportText: { color: '#9bbcff', fontSize: 12, fontWeight: '800' },
  heroRefText: { color: '#87a9db', fontSize: 12, marginTop: 4 },
  heroArt: { width: 116, height: 116, opacity: 0.88, marginLeft: 12, marginTop: -6 },
  kpiRow: { flexDirection: 'row', marginTop: 16, marginHorizontal: -5 },
  kpiCol: { flex: 1, paddingHorizontal: 5 },
  kpi: {
    minHeight: 78,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#070b12',
    borderWidth: 1,
    borderColor: '#152038',
  },
  kpiLabel: {
    color: '#7d8696',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  kpiValue: { color: '#fff', fontSize: 14, fontWeight: '900', marginTop: 8, lineHeight: 18 },
  heroLoadingRow: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#152038',
    backgroundColor: '#070b12',
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroLoadingText: { color: '#c9d0db', fontSize: 13, marginLeft: 10, flex: 1 },
  heroActionStack: { marginTop: 14 },
  heroPrimaryAction: {
    borderRadius: 16,
    backgroundColor: '#2b8cff',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  heroPrimaryActionInner: { flexDirection: 'row', alignItems: 'center' },
  heroPrimaryActionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#1a6dd2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  heroPrimaryActionCopy: { flex: 1 },
  heroPrimaryActionTitle: { color: '#fff', fontWeight: '900', fontSize: 15 },
  heroPrimaryActionHint: { color: '#dbe8ff', fontSize: 12, marginTop: 4, lineHeight: 17 },
  heroSecondaryRow: { flexDirection: 'row', marginTop: 10, marginHorizontal: -5 },
  heroSecondaryCol: { flex: 1, paddingHorizontal: 5 },
  ctaPrimary: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: '#2b8cff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  ctaPrimaryText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  ctaSecondary: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: '#070b12',
    borderWidth: 1,
    borderColor: '#1a2233',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: 12,
  },
  ctaSecondaryText: { color: '#9bbcff', fontWeight: '900', fontSize: 13, marginLeft: 8, flexShrink: 1 },

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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardHeaderCopy: { flex: 1, paddingRight: 12 },
  cardTitle: { color: '#fff' },
  cardSubtitle: { color: '#9aa0a6', fontSize: 13, marginTop: 6, lineHeight: 18 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 10 },
  rowLabel: { color: '#8a8a8a', fontSize: 13, paddingRight: 12, flex: 0.9 },
  rowValueWrap: { flex: 1.1, alignItems: 'flex-end' },
  rowValue: { color: '#fff', fontWeight: '800', textAlign: 'right' },
  rowSubValue: { color: '#9aa0a6', fontSize: 12, marginTop: 2, textAlign: 'right' },
  divider: { height: 1, backgroundColor: '#10182a' },
  cardHelper: { color: '#8faed8', fontSize: 12, marginTop: 12, lineHeight: 18 },
  emptyActionsRow: { flexDirection: 'row', marginHorizontal: -5, marginTop: 4 },
  ctaPrimarySmall: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: '#2b8cff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  ctaSecondarySmall: {
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

  pulseGhostArt: { position: 'absolute', right: -20, top: 10, width: 150, height: 150, opacity: 0.1 },
  pulseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
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
  pulseSubtitle: { color: '#9aa0a6', marginTop: 6, maxWidth: '92%', lineHeight: 18 },
  pulseGuidanceRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center' },
  pulseGuidanceText: { color: '#b8cff2', fontSize: 12, marginLeft: 8, flex: 1, lineHeight: 17 },
  pulseMetrics: {},
  pulseRow: { marginBottom: 12 },
  pulseRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pulseLabel: { color: '#cfcfcf', fontSize: 13, fontWeight: '700', maxWidth: '48%', paddingRight: 10 },
  pulseValues: { flexDirection: 'row', alignItems: 'baseline', flexShrink: 1 },
  pulseValue: { color: '#fff', fontWeight: '900' },
  pulseDelta: { color: '#2b8cff', fontSize: 12, fontWeight: '800', marginLeft: 8 },
  pulseBarTrack: { height: 6, backgroundColor: '#0a0d14', borderRadius: 999, overflow: 'hidden', marginTop: 6 },
  pulseBarFill: { height: '100%', backgroundColor: '#2b8cff', borderRadius: 999 },

  sectionTitle: { color: '#cfcfcf', fontWeight: '900', marginTop: 4, marginBottom: 10, fontSize: 14 },
  gridRow: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  gridCol: { width: '50%', paddingHorizontal: 6, paddingBottom: 12 },
  tile: {
    minHeight: 94,
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
  tileHint: { color: '#9aa0a6', fontSize: 12, marginTop: 2, lineHeight: 16 },
  secondaryToolsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: -2, marginBottom: 6 },
  secondaryToolChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#0a1426',
    borderWidth: 1,
    borderColor: '#22324f',
    marginRight: 8,
    marginBottom: 8,
  },
  secondaryToolText: { color: '#9bbcff', fontSize: 12, fontWeight: '800' },

  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  pillText: { fontSize: 12, fontWeight: '900' },

  footerContainer: { marginTop: 18, paddingTop: 18, paddingBottom: 20, borderTopWidth: 1, borderTopColor: '#0f1626' },
  footer: { textAlign: 'center', color: '#7a7a7a', marginTop: 8, fontSize: 13 },
  footerSmall: { textAlign: 'center', color: '#5a5a5a', marginTop: 4, fontSize: 12 },
});
