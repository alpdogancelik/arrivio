// app/(tabs)/map/index.native.tsx
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
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { appConfig } from '@/config';
import {
  STATUS_COLORS,
  useMapData,
  type Availability,
  type FacilityPin,
} from '@/features/map/map-data';

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

const GOOGLE_STATIONS = [
  { id: 'station-1', name: 'Station 1', shortName: 'Station1', query: '62X8+Q5C Kalkanli' },
  { id: 'station-2', name: 'Station 2', shortName: 'Station2', query: '62X6+6XH Kalkanli' },
  { id: 'station-3', name: 'Station 3', shortName: 'Station3', query: '7226+MC2 Kalkanli' },
] as const;

const availabilityFallbackLabel: Record<Availability, string> = {
  open: 'Open',
  limited: 'Limited',
  closed: 'Closed',
};

function stationQueryForPin(pin?: FacilityPin | null) {
  if (!pin) return GOOGLE_STATIONS[2].query;

  const normalizedShortName = pin.shortName?.toLowerCase();
  const normalizedName = pin.name?.replace(/\s+/g, '').toLowerCase();
  const matched =
    GOOGLE_STATIONS.find((station) => station.shortName.toLowerCase() === normalizedShortName) ??
    GOOGLE_STATIONS.find((station) => station.name.replace(/\s+/g, '').toLowerCase() === normalizedName);

  return matched?.query ?? GOOGLE_STATIONS[2].query;
}

function toDirectionsUrl(selected?: FacilityPin | null) {
  const origin = GOOGLE_STATIONS[0].query;
  const destination = stationQueryForPin(selected);
  const waypoints = GOOGLE_STATIONS.filter((pin) => pin.query !== origin && pin.query !== destination)
    .map((pin) => pin.query)
    .join('|');

  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(
    destination,
  )}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ''}&travelmode=driving`;
}

function toStableEmbedUrl() {
  const origin = GOOGLE_STATIONS[0].query;
  const destination = GOOGLE_STATIONS[2].query;
  const waypoints = GOOGLE_STATIONS[1].query;

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

function toMapHtml() {
  const src = toStableEmbedUrl().replace(/&/g, '&amp;');

  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
    <style>
      html, body, iframe {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        border: 0;
        background: #0b0f16;
        overflow: hidden;
      }
    </style>
  </head>
  <body>
    <iframe
      title="facility-map"
      src="${src}"
      loading="lazy"
      referrerpolicy="no-referrer-when-downgrade"
      allowfullscreen>
    </iframe>
  </body>
</html>`;
}

function openDirections(pin?: FacilityPin | null) {
  if (!pin) return;
  Linking.openURL(toDirectionsUrl(pin)).catch(() => undefined);
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
  const {
    title,
    subtitle,
    updatedLabel,
    loading,
    syncingLabel,
    liveLabel,
    refreshLabel,
    onRefresh,
  } = props;

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

const MapCard = memo(function MapCard(props: {
  title: string;
  loadingLabel: string;
  errorLabel: string;
}) {
  const { title, loadingLabel, errorLabel } = props;

  return (
    <View style={styles.mapCard}>
      <WebView
        source={{ html: toMapHtml(), baseUrl: 'https://maps.google.com' }}
        style={styles.webMap}
        originWhitelist={['https://*']}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        mixedContentMode="always"
        nestedScrollEnabled
        allowsInlineMediaPlayback
        accessibilityLabel={title}
        renderLoading={() => (
          <View style={styles.mapState}>
            <ActivityIndicator color={COLORS.blue} />
            <Text style={styles.mapStateText}>{loadingLabel}</Text>
          </View>
        )}
        renderError={() => (
          <View style={styles.mapState}>
            <Ionicons name="warning-outline" size={20} color={COLORS.blueText} />
            <Text style={styles.mapStateText}>{errorLabel}</Text>
          </View>
        )}
      />
    </View>
  );
});

const SelectedStationCard = memo(function SelectedStationCard(props: {
  selected: FacilityPin;
  statusLabel: string;
  queueLabel: string;
  etaLabel: string;
  trucksLabel: string;
  estimatePromptLabel: string;
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
    estimatePromptLabel,
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
            {selected.facilityName ?? selected.source}
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
          <Text style={styles.metricValue}>{estimatePromptLabel}</Text>
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
  pins: FacilityPin[];
  selectedId?: string;
  title: string;
  getMetaLabel: (pin: FacilityPin) => string;
  onSelectPin: (pin: FacilityPin) => void;
}) {
  const { pins, selectedId, title, getMetaLabel, onSelectPin } = props;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>

      <View style={styles.stationList}>
        {pins.map((pin, index) => {
          const active = pin.id === selectedId;
          const color = STATUS_COLORS[pin.availability];

          return (
            <React.Fragment key={pin.id}>
              <Pressable
                onPress={() => onSelectPin(pin)}
                accessibilityRole="button"
                accessibilityLabel={pin.name}
                style={({ pressed }) => [
                  styles.stationRow,
                  active ? styles.stationRowActive : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <View style={[styles.stationDot, { backgroundColor: color }]} />

                <View style={styles.stationRowCopy}>
                  <Text style={styles.stationName} numberOfLines={1}>
                    {pin.name}
                  </Text>
                  <Text style={styles.stationMeta} numberOfLines={1}>
                    {getMetaLabel(pin)}
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
              </Pressable>

              {index < pins.length - 1 ? <View style={styles.divider} /> : null}
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
  const insets = useSafeAreaInsets();

  const { pins, counts, isLoading, isRefetching, refetchAll } = useMapData();

  const [selectedId, setSelectedId] = useState<string | undefined>(pins[0]?.id);

  React.useEffect(() => {
    if (!pins.length) return;

    if (!selectedId || !pins.some((pin) => pin.id === selectedId)) {
      setSelectedId(pins[0]?.id);
    }
  }, [pins, selectedId]);

  const selected = useMemo(
    () => pins.find((pin) => pin.id === selectedId) ?? pins[0] ?? null,
    [pins, selectedId],
  );

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

  const focusPin = (pin: FacilityPin) => {
    setSelectedId(pin.id);
  };

  const handleBook = () => {
    if (!selected) return;

    router.push({
      pathname: BOOKING_ROUTE,
      params: {
        facilityId: selected.facilityId ?? selected.id,
        stationId: selected.stationId ?? selected.id,
      },
    } as Href);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 14) }]}
        showsVerticalScrollIndicator={false}
      >
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

        <MapCard
          title={t('map:title', { defaultValue: 'Facility map' })}
          loadingLabel={t('map:loadingMap', { defaultValue: 'Loading map' })}
          errorLabel={t('map:mapUnavailable', { defaultValue: 'Map unavailable' })}
        />

        {selected ? (
          <SelectedStationCard
            selected={selected}
            statusLabel={statusLabels[selected.availability]}
            queueLabel={t('common:queueLength', { defaultValue: 'Queue length' })}
            etaLabel={t('common:eta', { defaultValue: 'Estimated time of arrival' })}
            trucksLabel={t('map:trucks', {
              count: selected.queueLength,
              defaultValue: `${selected.queueLength} trucks`,
            })}
            estimatePromptLabel={t('map:selectSlotForEstimate', { defaultValue: 'Select slot for estimate' })}
            bookLabel={t('map:bookSlot', { defaultValue: 'Book a slot' })}
            directionsLabel={t('map:directions', { defaultValue: 'Directions' })}
            onBook={handleBook}
            onDirections={() => openDirections(selected)}
          />
        ) : null}

        <StationList
          pins={pins}
          selectedId={selected?.id}
          title={t('map:stations', { defaultValue: 'Stations' })}
          getMetaLabel={(pin) =>
            t('map:stationMeta', {
              count: pin.queueLength,
              eta: t('map:selectSlotForEstimate', { defaultValue: 'Select slot for estimate' }),
              defaultValue: `${pin.queueLength} trucks - ${
                t('map:selectSlotForEstimate', { defaultValue: 'Select slot for estimate' })
              }`,
            })
          }
          onSelectPin={focusPin}
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

  topOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  headerCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.card,
    padding: 15,
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
  headerActions: {
    position: 'relative',
    zIndex: 2,
    flexDirection: 'row',
    marginHorizontal: -5,
    marginTop: 12,
  },
  headerAction: {
    flex: 1,
    minHeight: 40,
    marginHorizontal: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.cardRaised,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  headerActionText: {
    color: COLORS.blueText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    marginLeft: 6,
  },

  statusStrip: {
    flexDirection: 'row',
    marginHorizontal: -4,
    marginTop: 10,
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
    height: 280,
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.card,
    marginBottom: 14,
  },
  webMap: {
    flex: 1,
    backgroundColor: COLORS.card,
  },
  mapState: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
  },
  mapStateText: {
    color: COLORS.textSoft,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    marginTop: 8,
  },

  markerWrap: {
    width: 92,
    height: 60,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  markerLabel: {
    maxWidth: 86,
    marginBottom: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.card,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  markerLabelSelected: {
    borderColor: '#2b8cff66',
    backgroundColor: '#071326',
  },
  markerLabelText: {
    color: COLORS.text,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  markerPin: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerRing: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 999,
    borderWidth: 2,
  },
  markerRingSelected: {
    width: 30,
    height: 30,
    borderWidth: 3,
  },
  markerDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  markerDotSelected: {
    width: 12,
    height: 12,
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

  bottomWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
  },
  sheet: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.card,
    padding: 15,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#263247',
    marginBottom: 13,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 13,
  },
  sheetTitleWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  sheetTitle: {
    color: COLORS.text,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
  },
  sheetSub: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
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
    marginBottom: 12,
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

  pinList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginBottom: -8,
  },
  pinChip: {
    width: '48%',
    minHeight: 38,
    marginHorizontal: 4,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: '#070b1288',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  pinChipActive: {
    backgroundColor: '#071326',
  },
  pinChipDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginRight: 7,
  },
  pinChipText: {
    flex: 1,
    minWidth: 0,
    color: COLORS.textSoft,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
});
