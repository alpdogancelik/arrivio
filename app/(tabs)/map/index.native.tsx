// app/(tabs)/map/index.native.tsx
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter, type Href } from 'expo-router';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import {
  buildDirectionsUrl,
  FacilityPin,
  getFocusedRegion,
  STATUS_COLORS,
  useMapData,
  type Availability,
} from './map-data';

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

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0b0b0b' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#a3a3a3' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0b0b0b' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#131313' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1f1f1f' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a1620' }] },
];

const availabilityFallbackLabel: Record<Availability, string> = {
  open: 'Open',
  limited: 'Limited',
  closed: 'Closed',
};

function openDirections(pin: FacilityPin) {
  Linking.openURL(buildDirectionsUrl(pin)).catch(() => undefined);
}

const HeaderOverlay = memo(function HeaderOverlay(props: {
  title: string;
  subtitle: string;
  updatedLabel: string;
  loading: boolean;
  syncingLabel: string;
  liveLabel: string;
  resetLabel: string;
  refreshLabel: string;
  onReset: () => void;
  onRefresh: () => void;
}) {
  const {
    title,
    subtitle,
    updatedLabel,
    loading,
    syncingLabel,
    liveLabel,
    resetLabel,
    refreshLabel,
    onReset,
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

      <Text style={styles.updatedText}>{updatedLabel}</Text>

      <View style={styles.headerActions}>
        <Pressable
          onPress={onReset}
          accessibilityRole="button"
          accessibilityLabel={resetLabel}
          style={({ pressed }) => [styles.headerAction, pressed ? styles.pressed : null]}
        >
          <Ionicons name="locate-outline" size={17} color={COLORS.blueText} />
          <Text style={styles.headerActionText}>{resetLabel}</Text>
        </Pressable>

        <Pressable
          onPress={onRefresh}
          accessibilityRole="button"
          accessibilityLabel={refreshLabel}
          style={({ pressed }) => [styles.headerAction, pressed ? styles.pressed : null]}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.blueText} />
          ) : (
            <Ionicons name="refresh" size={17} color={COLORS.blueText} />
          )}
          <Text style={styles.headerActionText}>{refreshLabel}</Text>
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

const MapMarker = memo(function MapMarker(props: {
  pin: FacilityPin;
  selected: boolean;
  onPress: () => void;
}) {
  const { pin, selected, onPress } = props;
  const color = STATUS_COLORS[pin.availability];

  return (
    <Marker
      coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
      onPress={onPress}
      tracksViewChanges={false}
      accessibilityLabel={`Station pin: ${pin.shortName}`}
    >
      <View style={styles.markerWrap}>
        <View style={[styles.markerLabel, selected ? styles.markerLabelSelected : null]}>
          <Text style={styles.markerLabelText} numberOfLines={1}>
            {pin.shortName}
          </Text>
        </View>

        <View style={styles.markerPin}>
          <View
            style={[
              styles.markerRing,
              { borderColor: `${color}${selected ? 'dd' : '66'}` },
              selected ? styles.markerRingSelected : null,
            ]}
          />
          <View
            style={[
              styles.markerDot,
              { backgroundColor: color },
              selected ? styles.markerDotSelected : null,
            ]}
          />
        </View>
      </View>
    </Marker>
  );
});

const BottomSheet = memo(function BottomSheet(props: {
  selected: FacilityPin;
  pins: FacilityPin[];
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
  onSelectPin: (pin: FacilityPin) => void;
}) {
  const {
    selected,
    pins,
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
    onSelectPin,
  } = props;

  const statusColor = STATUS_COLORS[selected.availability];

  return (
    <View style={styles.sheet}>
      <View style={styles.sheetHandle} />

      <View style={styles.sheetHeader}>
        <View style={styles.sheetTitleWrap}>
          <Text style={styles.sheetTitle} numberOfLines={1}>
            {selected.name}
          </Text>
          <Text style={styles.sheetSub} numberOfLines={1}>
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
          <Text style={styles.metricValue}>
            {selected.etaMin == null ? unavailableLabel : minsLabel}
          </Text>
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

      <View style={styles.pinList}>
        {pins.map((pin) => {
          const active = pin.id === selected.id;
          const color = STATUS_COLORS[pin.availability];

          return (
            <Pressable
              key={pin.id}
              onPress={() => onSelectPin(pin)}
              accessibilityRole="button"
              accessibilityLabel={pin.shortName}
              style={({ pressed }) => [
                styles.pinChip,
                active ? styles.pinChipActive : null,
                { borderColor: active ? `${color}66` : COLORS.line },
                pressed ? styles.pressed : null,
              ]}
            >
              <View style={[styles.pinChipDot, { backgroundColor: color }]} />
              <Text style={styles.pinChipText} numberOfLines={1}>
                {pin.shortName}
              </Text>
            </Pressable>
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
  const mapRef = useRef<MapView | null>(null);

  const { pins, counts, initialRegion, isLoading, isRefetching, refetchAll } = useMapData();

  const [selectedId, setSelectedId] = useState<string | undefined>(pins[0]?.id);

  useEffect(() => {
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

  const focusPin = useCallback((pin: FacilityPin) => {
    setSelectedId(pin.id);
    mapRef.current?.animateToRegion(getFocusedRegion(pin), 320);
  }, []);

  const resetMap = useCallback(() => {
    mapRef.current?.animateToRegion(initialRegion, 360);
  }, [initialRegion]);

  const handleBook = useCallback(() => {
    if (!selected) return;

    router.push({
      pathname: BOOKING_ROUTE,
      params: {
        facilityId: selected.facilityId ?? selected.id,
        stationId: selected.stationId ?? selected.id,
      },
    } as Href);
  }, [router, selected]);

  const handleDirections = useCallback(() => {
    if (!selected) return;
    openDirections(selected);
  }, [selected]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <MapView
        ref={(ref) => {
          mapRef.current = ref;
        }}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        customMapStyle={darkMapStyle as any}
        showsUserLocation
        showsCompass
        rotateEnabled={false}
        mapPadding={{
          top: insets.top + 166,
          right: 16,
          bottom: insets.bottom + 294,
          left: 16,
        }}
      >
        {pins.map((pin) => (
          <MapMarker
            key={pin.id}
            pin={pin}
            selected={pin.id === selected?.id}
            onPress={() => focusPin(pin)}
          />
        ))}
      </MapView>

      <View style={[styles.topOverlay, { paddingTop: insets.top + 10 }]} pointerEvents="box-none">
        <HeaderOverlay
          title={t('map:title', { defaultValue: 'Facility map' })}
          subtitle={t('map:subtitle', {
            defaultValue: 'Tap a station to see queue length, ETA, and actions.',
          })}
          updatedLabel={lastUpdatedLabel}
          loading={isLoading || isRefetching}
          syncingLabel={t('map:syncing', { defaultValue: 'Syncing' })}
          liveLabel={t('map:live', { defaultValue: 'Live' })}
          resetLabel={t('map:reset', { defaultValue: 'Reset' })}
          refreshLabel={t('map:refresh', { defaultValue: 'Refresh' })}
          onReset={resetMap}
          onRefresh={refetchAll}
        />

        <StatusStrip counts={counts} labels={statusLabels} />
      </View>

      {selected ? (
        <View style={[styles.bottomWrap, { paddingBottom: Math.max(insets.bottom, 10) + 74 }]}>
          <BottomSheet
            selected={selected}
            pins={pins}
            statusLabel={statusLabels[selected.availability]}
            queueLabel={t('common:queueLength', { defaultValue: 'Queue length' })}
            etaLabel={t('common:eta', { defaultValue: 'ETA' })}
            trucksLabel={t('map:trucks', {
              count: selected.queueLength,
              defaultValue: `${selected.queueLength} trucks`,
            })}
            minsLabel={t('common:mins', {
              count: selected.etaMin ?? 0,
              defaultValue: `${selected.etaMin ?? 0} min`,
            })}
            unavailableLabel={t('common:notAvailable', { defaultValue: 'Not available' })}
            bookLabel={t('map:bookSlot', { defaultValue: 'Book slot' })}
            directionsLabel={t('map:directions', { defaultValue: 'Directions' })}
            onBook={handleBook}
            onDirections={handleDirections}
            onSelectPin={focusPin}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
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
  updatedText: {
    position: 'relative',
    zIndex: 2,
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
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
