// app/(tabs)/map/index.web.tsx
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter, type Href } from 'expo-router';
import React, { memo, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { appConfig } from '@/config';

import {
  STATUS_COLORS,
  useMapData,
  type Availability,
  type FacilityPin,
} from './map-data';

type WebStation = {
  id: string;
  name: string;
  shortName: string;
  query: string;
  availability: Availability;
  queueLength: number;
  etaMin: number | null;
  lastUpdatedMinAgo: number;
  facilityName: string;
};

const WEB_STATIONS = [
  { id: 'station-1', name: 'Station 1', shortName: 'Station1', query: '62X8+Q5C Kalkanli' },
  { id: 'station-2', name: 'Station 2', shortName: 'Station2', query: '62X6+6XH Kalkanli' },
  { id: 'station-3', name: 'Station 3', shortName: 'Station3', query: '7226+MC2 Kalkanli' },
] as const;

const COLORS = {
  bg: '#07080a',
  card: '#0b0f16',
  cardRaised: '#0f141d',
  line: '#1a2435',
  lineSoft: '#121a28',
  text: '#f8fafc',
  textSoft: '#b6bfcc',
  muted: '#7f8795',
  blue: '#2b8cff',
  blueText: '#9bbcff',
  blueSoft: '#2b8cff18',
};

const BOOKING_ROUTE = '/(tabs)/bookings/new' as const;

const availabilityFallbackLabel: Record<Availability, string> = {
  open: 'Open',
  limited: 'Limited',
  closed: 'Closed',
};

function toDirectionsUrl(selected?: WebStation | null) {
  const origin = WEB_STATIONS[0].query;
  const destination = selected?.query ?? WEB_STATIONS[2].query;
  const waypoints = WEB_STATIONS.filter((pin) => pin.query !== origin && pin.query !== destination)
    .map((pin) => pin.query)
    .join('|');

  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(
    destination,
  )}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ''}&travelmode=driving`;
}

function toStableEmbedUrl() {
  const origin = WEB_STATIONS[0].query;
  const destination = WEB_STATIONS[2].query;
  const waypoints = WEB_STATIONS[1].query;

  if (appConfig.mapsApiKey) {
    return `https://www.google.com/maps/embed/v1/directions?key=${encodeURIComponent(
      appConfig.mapsApiKey,
    )}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(
      waypoints,
    )}&mode=driving`;
  }

  return `https://maps.google.com/maps?f=d&saddr=${encodeURIComponent(origin)}&daddr=${encodeURIComponent(
    destination,
  )}+to:${encodeURIComponent(waypoints)}&output=embed`;
}

function getCounts(stations: WebStation[]) {
  return stations.reduce(
    (acc, station) => {
      acc[station.availability] += 1;
      return acc;
    },
    { open: 0, limited: 0, closed: 0 } as Record<Availability, number>,
  );
}

function metricForStation(metrics: FacilityPin[], index: number) {
  const station = WEB_STATIONS[index];
  const normalizedShortName = station.shortName.toLowerCase();

  return (
    metrics.find((pin) => pin.shortName?.toLowerCase() === normalizedShortName) ??
    metrics.find((pin) => pin.name?.replace(/\s+/g, '').toLowerCase() === normalizedShortName) ??
    metrics[index]
  );
}

function buildStations(metrics: FacilityPin[], t: ReturnType<typeof useTranslation>['t']) {
  return WEB_STATIONS.map((station, index) => {
    const metric = metricForStation(metrics, index);
    const stationName = t(`map:station${index + 1}`, {
      defaultValue: t(
        index === 0 ? 'map:stationOne' : index === 1 ? 'map:stationTwo' : 'map:stationThree',
        { defaultValue: station.name },
      ),
    });

    return {
      ...station,
      name: stationName,
      availability: metric?.availability ?? (index === 1 ? 'limited' : 'open'),
      queueLength: metric?.queueLength ?? 0,
      etaMin: metric?.etaMin ?? null,
      lastUpdatedMinAgo: metric?.lastUpdatedMinAgo ?? 0,
      facilityName: metric?.facilityName ?? t('map:facilityName', { defaultValue: 'Kalkanli facility' }),
    } satisfies WebStation;
  });
}

function openDirections(station?: WebStation | null) {
  Linking.openURL(toDirectionsUrl(station)).catch(() => undefined);
}

const HeaderCard = memo(function HeaderCard(props: {
  title: string;
  subtitle: string;
  updatedLabel: string;
  loading: boolean;
  syncingLabel: string;
  liveLabel: string;
  refreshLabel: string;
  onRefresh: () => void;
}) {
  const { title, subtitle, updatedLabel, loading, syncingLabel, liveLabel, refreshLabel, onRefresh } = props;

  return (
    <View style={styles.headerCard}>
      <View style={styles.headerGlow} />

      <View style={styles.headerTop}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>{loading ? syncingLabel : liveLabel}</Text>
        </View>
      </View>

      <View style={styles.headerBottom}>
        <Text style={styles.updatedText}>{updatedLabel}</Text>

        <Pressable
          onPress={onRefresh}
          accessibilityRole="button"
          accessibilityLabel={refreshLabel}
          style={({ pressed }) => [styles.refreshButton, pressed ? styles.pressed : null]}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.blueText} />
          ) : (
            <Ionicons name="refresh" size={16} color={COLORS.blueText} />
          )}
          <Text style={styles.refreshText}>{refreshLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
});

const StatusStrip = memo(function StatusStrip(props: {
  counts: Record<Availability, number>;
  labels: Record<Availability, string>;
}) {
  const { counts, labels } = props;

  return (
    <View style={styles.statusStrip}>
      {(Object.keys(labels) as Availability[]).map((key) => (
        <View key={key} style={styles.statusChip}>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[key] }]} />
          <Text style={styles.statusLabel} numberOfLines={1}>
            {labels[key]}
          </Text>
          <Text style={styles.statusCount}>{counts[key]}</Text>
        </View>
      ))}
    </View>
  );
});

const MapCard = memo(function MapCard() {
  return (
    <View style={styles.mapCard}>
      {React.createElement('iframe' as any, {
        title: 'facility-map',
        src: toStableEmbedUrl(),
        loading: 'lazy',
        referrerPolicy: 'no-referrer-when-downgrade',
        style: {
          border: 0,
          width: '100%',
          height: '100%',
          display: 'block',
        },
      })}
    </View>
  );
});

const SelectedStationCard = memo(function SelectedStationCard(props: {
  selected: WebStation;
  statusLabel: string;
  queueLabel: string;
  etaLabel: string;
  trucksLabel: string;
  minsLabel: string;
  unavailableLabel: string;
  bookLabel: string;
  directionsLabel: string;
  onBook: () => void;
  onDirections: () => void;
}) {
  const {
    selected,
    statusLabel,
    queueLabel,
    etaLabel,
    trucksLabel,
    minsLabel,
    unavailableLabel,
    bookLabel,
    directionsLabel,
    onBook,
    onDirections,
  } = props;

  const statusColor = STATUS_COLORS[selected.availability];

  return (
    <View style={styles.card}>
      <View style={styles.stationHeader}>
        <View style={styles.stationCopy}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {selected.name}
          </Text>
          <Text style={styles.cardCaption} numberOfLines={1}>
            {selected.facilityName}
          </Text>
        </View>

        <View style={[styles.availabilityBadge, { borderColor: `${statusColor}55`, backgroundColor: `${statusColor}22` }]}>
          <Text style={[styles.availabilityBadgeText, { color: statusColor }]} numberOfLines={1}>
            {statusLabel}
          </Text>
        </View>
      </View>

      <View style={styles.metricsCard}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>{queueLabel}</Text>
          <Text style={styles.metricValue}>{trucksLabel}</Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metric}>
          <Text style={styles.metricLabel}>{etaLabel}</Text>
          <Text style={styles.metricValue}>{selected.etaMin == null ? unavailableLabel : minsLabel}</Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          onPress={onBook}
          accessibilityRole="button"
          accessibilityLabel={bookLabel}
          style={({ pressed }) => [styles.primaryButton, pressed ? styles.pressed : null]}
        >
          <Text style={styles.primaryButtonText}>{bookLabel}</Text>
        </Pressable>

        <Pressable
          onPress={onDirections}
          accessibilityRole="button"
          accessibilityLabel={directionsLabel}
          style={({ pressed }) => [styles.secondaryButton, pressed ? styles.pressed : null]}
        >
          <Text style={styles.secondaryButtonText}>{directionsLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
});

const StationList = memo(function StationList(props: {
  stations: WebStation[];
  selectedId: string;
  title: string;
  getMetaLabel: (station: WebStation) => string;
  onSelect: (station: WebStation) => void;
}) {
  const { stations, selectedId, title, getMetaLabel, onSelect } = props;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>

      <View style={styles.stationList}>
        {stations.map((station, index) => {
          const active = station.id === selectedId;
          const color = STATUS_COLORS[station.availability];

          return (
            <React.Fragment key={station.id}>
              <Pressable
                onPress={() => onSelect(station)}
                accessibilityRole="button"
                accessibilityLabel={station.name}
                style={({ pressed }) => [
                  styles.stationRow,
                  active ? styles.stationRowActive : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <View style={[styles.stationDot, { backgroundColor: color }]} />

                <View style={styles.stationRowCopy}>
                  <Text style={styles.stationName} numberOfLines={1}>
                    {station.name}
                  </Text>
                  <Text style={styles.stationMeta} numberOfLines={1}>
                    {getMetaLabel(station)}
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
              </Pressable>

              {index < stations.length - 1 ? <View style={styles.divider} /> : null}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
});

export default function MapScreen() {
  const { t } = useTranslation(['map', 'common']);
  const router = useRouter();
  const { pins: metricPins, isLoading, isRefetching, refetchAll } = useMapData();

  const [selectedId, setSelectedId] = useState<string>(WEB_STATIONS[0].id);

  const stations = useMemo(() => buildStations(metricPins, t), [metricPins, t]);
  const selected = useMemo(
    () => stations.find((station) => station.id === selectedId) ?? stations[0],
    [selectedId, stations],
  );

  const counts = useMemo(() => getCounts(stations), [stations]);

  const statusLabels = useMemo<Record<Availability, string>>(
    () => ({
      open: t('map:open', { defaultValue: availabilityFallbackLabel.open }),
      limited: t('map:limited', { defaultValue: availabilityFallbackLabel.limited }),
      closed: t('map:closed', { defaultValue: availabilityFallbackLabel.closed }),
    }),
    [t],
  );

  const lastUpdatedLabel = useMemo(() => {
    const minAgo = selected?.lastUpdatedMinAgo ?? 0;
    if (minAgo <= 1) {
      return t('common:updatedJustNow', { defaultValue: 'Updated just now' });
    }

    return t('common:updatedMinutesAgo', {
      count: minAgo,
      defaultValue: `Updated ${minAgo} min ago`,
    });
  }, [selected?.lastUpdatedMinAgo, t]);

  const handleBook = () => {
    router.push({
      pathname: BOOKING_ROUTE,
      params: {
        stationId: selected.id,
      },
    } as Href);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <HeaderCard
          title={t('map:title', { defaultValue: 'Facility map' })}
          subtitle={t('map:subtitle', {
            defaultValue: 'Use the map for route preview. Select a station below to view queue and actions.',
          })}
          updatedLabel={lastUpdatedLabel}
          loading={isLoading || isRefetching}
          syncingLabel={t('map:syncing', { defaultValue: 'Syncing' })}
          liveLabel={t('map:live', { defaultValue: 'Live' })}
          refreshLabel={t('map:refresh', { defaultValue: 'Refresh' })}
          onRefresh={refetchAll}
        />

        <StatusStrip counts={counts} labels={statusLabels} />

        <MapCard />

        <SelectedStationCard
          selected={selected}
          statusLabel={statusLabels[selected.availability]}
          queueLabel={t('common:queueLength', { defaultValue: 'Queue length' })}
          etaLabel={t('common:eta', { defaultValue: 'Estimated time of arrival' })}
          trucksLabel={t('map:trucks', {
            count: selected.queueLength,
            defaultValue: `${selected.queueLength} trucks`,
          })}
          minsLabel={t('common:mins', {
            count: selected.etaMin ?? 0,
            defaultValue: `${selected.etaMin ?? 0} min`,
          })}
          unavailableLabel={t('common:notAvailable', { defaultValue: 'Not available' })}
          bookLabel={t('map:bookSlot', { defaultValue: 'Book a slot' })}
          directionsLabel={t('map:directions', { defaultValue: 'Directions' })}
          onBook={handleBook}
          onDirections={() => openDirections(selected)}
        />

        <StationList
          stations={stations}
          selectedId={selectedId}
          title={t('map:stations', { defaultValue: 'Stations' })}
          getMetaLabel={(station) =>
            t('map:stationMeta', {
              count: station.queueLength,
              eta:
                station.etaMin == null
                  ? t('map:etaUnavailable', { defaultValue: 'ETA unavailable' })
                  : t('common:mins', { count: station.etaMin, defaultValue: `${station.etaMin} min` }),
              defaultValue: `${station.queueLength} trucks - ${
                station.etaMin == null ? 'ETA unavailable' : `${station.etaMin} min`
              }`,
            })
          }
          onSelect={(station) => setSelectedId(station.id)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 156,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },

  headerCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.card,
    padding: 16,
  },
  headerGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 999,
    right: -82,
    top: -96,
    backgroundColor: '#2b8cff18',
  },
  headerTop: {
    position: 'relative',
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  title: {
    color: COLORS.text,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '700',
    letterSpacing: -0.15,
  },
  subtitle: {
    color: COLORS.textSoft,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  liveBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2b8cff40',
    backgroundColor: COLORS.blueSoft,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: COLORS.blue,
    marginRight: 6,
  },
  liveText: {
    color: COLORS.blueText,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  headerBottom: {
    position: 'relative',
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  updatedText: {
    flex: 1,
    minWidth: 0,
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
    paddingRight: 10,
  },
  refreshButton: {
    minHeight: 36,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.cardRaised,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  refreshText: {
    color: COLORS.blueText,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    marginLeft: 6,
  },

  statusStrip: {
    flexDirection: 'row',
    marginHorizontal: -4,
    marginTop: 12,
    marginBottom: 12,
  },
  statusChip: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    marginHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginRight: 7,
  },
  statusLabel: {
    flex: 1,
    minWidth: 0,
    color: COLORS.textSoft,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  statusCount: {
    color: COLORS.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    marginLeft: 6,
  },

  mapCard: {
    height: 340,
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.card,
    marginBottom: 14,
  },

  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.card,
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  cardCaption: {
    color: COLORS.textSoft,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  stationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 13,
  },
  stationCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  availabilityBadge: {
    maxWidth: 110,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  availabilityBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },

  metricsCard: {
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.lineSoft,
    backgroundColor: '#070b1288',
    flexDirection: 'row',
    marginBottom: 12,
  },
  metric: {
    flex: 1,
    minHeight: 58,
    paddingHorizontal: 13,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  metricDivider: {
    width: 1,
    backgroundColor: COLORS.lineSoft,
  },
  metricLabel: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  metricValue: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    marginTop: 3,
  },
  actionsRow: {
    flexDirection: 'row',
    marginHorizontal: -5,
  },
  primaryButton: {
    flex: 1,
    minHeight: 46,
    marginHorizontal: 5,
    borderRadius: 15,
    backgroundColor: COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  primaryButtonText: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 46,
    marginHorizontal: 5,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.cardRaised,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: COLORS.blueText,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },

  stationList: {
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.lineSoft,
    backgroundColor: '#070b1288',
    marginTop: 13,
  },
  stationRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  stationRowActive: {
    backgroundColor: '#071326',
  },
  stationDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    marginRight: 12,
  },
  stationRowCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },
  stationName: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  stationMeta: {
    color: COLORS.textSoft,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.lineSoft,
  },
});
