import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { images } from '@/constants/images';

type Availability = 'open' | 'limited' | 'closed';

type FacilityPin = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  availability: Availability;
  queueLength: number;
  etaMin: number | null;
  lastUpdatedMinAgo: number;
};

const facilities: FacilityPin[] = [
  {
    id: 'f1',
    name: 'Ankara Logistics Center',
    latitude: 39.9208,
    longitude: 32.8541,
    availability: 'open',
    queueLength: 12,
    etaMin: 18,
    lastUpdatedMinAgo: 2,
  },
  {
    id: 'f2',
    name: 'Gebze Gate',
    latitude: 40.802,
    longitude: 29.438,
    availability: 'limited',
    queueLength: 25,
    etaMin: 32,
    lastUpdatedMinAgo: 5,
  },
  {
    id: 'f3',
    name: 'Mersin Port Entry',
    latitude: 36.8008,
    longitude: 34.6177,
    availability: 'closed',
    queueLength: 0,
    etaMin: null,
    lastUpdatedMinAgo: 12,
  },
];

const STATUS_COLORS: Record<Availability, string> = {
  open: '#22c55e',
  limited: '#f59e0b',
  closed: '#ef4444',
};

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0b0b0b' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#a3a3a3' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0b0b0b' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#131313' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1f1f1f' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a1620' }] },
];

function openDirections(facility: FacilityPin) {
  const { latitude, longitude, name } = facility;
  const url = Platform.select({
    ios: `http://maps.apple.com/?daddr=${latitude},${longitude}`,
    android: `geo:0,0?q=${latitude},${longitude}(${encodeURIComponent(name)})`,
    default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
  });

  if (!url) return;
  Linking.openURL(url).catch(() => undefined);
}

export default function MapScreen() {
  const { t } = useTranslation(['map', 'common']);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const mapRef = useRef<MapView | null>(null);
  const [selectedId, setSelectedId] = useState(facilities[0]?.id);

  const selected = useMemo(
    () => facilities.find((f) => f.id === selectedId) ?? null,
    [selectedId],
  );

  const statusMeta = useMemo(
    () => ({
      open: { label: t('map:open'), color: STATUS_COLORS.open },
      limited: { label: t('map:limited'), color: STATUS_COLORS.limited },
      closed: { label: t('map:closed'), color: STATUS_COLORS.closed },
    }),
    [t],
  );

  const counts = useMemo(() => {
    return facilities.reduce(
      (acc, f) => {
        acc[f.availability] += 1;
        return acc;
      },
      { open: 0, limited: 0, closed: 0 } as Record<Availability, number>,
    );
  }, []);

  const initialRegion = useMemo(() => {
    const lat = facilities.reduce((sum, f) => sum + f.latitude, 0) / facilities.length;
    const lng = facilities.reduce((sum, f) => sum + f.longitude, 0) / facilities.length;
    return { latitude: lat, longitude: lng, latitudeDelta: 4.2, longitudeDelta: 4.2 };
  }, []);

  const focusFacility = useCallback((facility: FacilityPin) => {
    setSelectedId(facility.id);
    mapRef.current?.animateToRegion(
      {
        latitude: facility.latitude,
        longitude: facility.longitude,
        latitudeDelta: 0.7,
        longitudeDelta: 0.7,
      },
      320,
    );
  }, []);

  const handleBook = useCallback(() => {
    router.push('/bookings/new');
  }, [router]);

  const lastUpdatedLabel = useMemo(() => {
    const minAgo = selected?.lastUpdatedMinAgo ?? 0;
    if (minAgo <= 1) return t('common:updatedJustNow');
    return t('common:updatedMinutesAgo', { count: minAgo });
  }, [selected?.lastUpdatedMinAgo, t]);

  return (
    <View style={styles.container}>
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
          top: insets.top + 160,
          right: 16,
          bottom: insets.bottom + 210,
          left: 16,
        }}
      >
        {facilities.map((facility) => {
          const meta = statusMeta[facility.availability];
          const isSelected = facility.id === selectedId;

          return (
            <Marker
              key={facility.id}
              coordinate={{ latitude: facility.latitude, longitude: facility.longitude }}
              onPress={() => focusFacility(facility)}
              tracksViewChanges={false}
              accessibilityLabel={`Facility pin: ${facility.name}`}
            >
              <View style={styles.markerWrap}>
                <View
                  style={[
                    styles.markerRing,
                    { borderColor: `${meta.color}${isSelected ? 'cc' : '55'}` },
                    isSelected && styles.markerRingSelected,
                  ]}
                />
                <View
                  style={[
                    styles.markerDot,
                    { backgroundColor: meta.color },
                    isSelected && styles.markerDotSelected,
                  ]}
                />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Top overlay */}
      <View
        style={[styles.topOverlay, { paddingTop: insets.top + 10 }]}
        pointerEvents="box-none"
      >
        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <ThemedText type="title" style={styles.title}>
              {t('map:title')}
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              {t('map:subtitle')}
            </ThemedText>

            <View style={styles.liveRow}>
              <View style={styles.liveDot} />
              <ThemedText style={styles.liveText}>{lastUpdatedLabel}</ThemedText>
            </View>
          </View>

          <Image source={images.pin} style={styles.heroImage} contentFit="contain" />
        </View>

        <View style={styles.statusRow}>
          {(Object.keys(statusMeta) as Availability[]).map((key) => {
            const meta = statusMeta[key];
            const count = counts[key];
            return (
              <View key={key} style={styles.statusPill}>
                <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
                <ThemedText style={styles.statusText} numberOfLines={1} ellipsizeMode="tail">
                  {meta.label}
                </ThemedText>
                <View style={styles.statusCount}>
                  <ThemedText style={styles.statusCountText}>{count}</ThemedText>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.quickRow}>
          <Pressable
            style={styles.quickButton}
            onPress={() => mapRef.current?.animateToRegion(initialRegion, 360)}
          >
            <ThemedText style={styles.quickButtonText}>{t('map:reset')}</ThemedText>
          </Pressable>
          <Pressable
            style={styles.quickButton}
            onPress={() => {
              // A real app would refetch facility KPIs here.
              // Keeping UI-only for now.
            }}
          >
            <ThemedText style={styles.quickButtonText}>{t('map:refresh')}</ThemedText>
          </Pressable>
        </View>
      </View>

      {/* Bottom sheet */}
      {selected ? (
        <ThemedView
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 12) + 10,
            },
          ]}
        >
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleWrap}>
              <ThemedText style={styles.sheetTitle}>{selected.name}</ThemedText>
              <View
                style={[
                  styles.availabilityBadge,
                  {
                    backgroundColor: `${statusMeta[selected.availability].color}22`,
                    borderColor: `${statusMeta[selected.availability].color}55`,
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.availabilityBadgeText,
                    { color: statusMeta[selected.availability].color },
                  ]}
                >
                  {statusMeta[selected.availability].label}
                </ThemedText>
              </View>
            </View>

            <Image
              source={images.houseIcon}
              style={styles.sheetImage}
              contentFit="contain"
            />
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <ThemedText style={styles.metricLabel}>
                {t('common:queueLength')}
              </ThemedText>
              <ThemedText style={styles.metricValue}>
                {t('map:trucks', { count: selected.queueLength })}
              </ThemedText>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}>
              <ThemedText style={styles.metricLabel}>
                {t('common:eta')}
              </ThemedText>
              <ThemedText style={styles.metricValue}>
                {selected.etaMin == null
                  ? '—'
                  : t('common:mins', { count: selected.etaMin })}
              </ThemedText>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <Pressable style={styles.primaryButton} onPress={handleBook}>
              <ThemedText style={styles.primaryButtonText}>
                {t('map:bookSlot')}
              </ThemedText>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => openDirections(selected)}>
              <ThemedText style={styles.secondaryButtonText}>{t('map:directions')}</ThemedText>
            </Pressable>
          </View>

          <View style={styles.facilityChipsRow}>
            {facilities.map((facility) => {
              const meta = statusMeta[facility.availability];
              const active = facility.id === selectedId;
              return (
                <Pressable
                  key={facility.id}
                  style={[
                    styles.facilityChip,
                    active && styles.facilityChipActive,
                    { borderColor: active ? `${meta.color}66` : '#1a1a1a' },
                  ]}
                  onPress={() => focusFacility(facility)}
                >
                  <View style={[styles.facilityChipDot, { backgroundColor: meta.color }]} />
                  <ThemedText style={styles.facilityChipText} numberOfLines={1}>
                    {facility.name}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </ThemedView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0b',
  },

  // Marker
  markerWrap: {
    width: 28,
    height: 28,
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

  // Overlays
  topOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    gap: 10,
  },
  heroCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    backgroundColor: '#0f0f0f',
    padding: 16,
    overflow: 'hidden',
  },
  heroLeft: {
    gap: 6,
    maxWidth: '74%',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: '#9aa0a6',
  },
  liveRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#2b8cff',
  },
  liveText: {
    color: '#9bbcff',
    fontSize: 12,
    fontWeight: '700',
  },
  heroImage: {
    position: 'absolute',
    right: -12,
    top: -12,
    width: 130,
    height: 130,
    opacity: 0.22,
  },

  statusRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statusPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    backgroundColor: '#0f0f0f',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  statusText: {
    flex: 1,
    flexShrink: 1,
    color: '#e6e6e6',
    fontWeight: '800',
    fontSize: 12,
  },
  statusCount: {
    minWidth: 26,
    height: 22,
    borderRadius: 999,
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  statusCountText: {
    color: '#cfcfcf',
    fontSize: 12,
    fontWeight: '800',
  },

  quickRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickButton: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    backgroundColor: '#101010',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickButtonText: {
    color: '#e6e6e6',
    fontWeight: '800',
  },

  // Bottom sheet
  sheet: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#222',
    backgroundColor: '#0f0f0f',
    padding: 16,
    gap: 12,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sheetTitleWrap: {
    flex: 1,
    gap: 10,
  },
  sheetTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  availabilityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  availabilityBadgeText: {
    fontWeight: '900',
    fontSize: 12,
  },
  sheetImage: {
    width: 84,
    height: 84,
    opacity: 0.14,
  },

  metricsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: '#1a1a1a',
    backgroundColor: '#0c0c0c',
    borderRadius: 14,
    overflow: 'hidden',
  },
  metric: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 6,
  },
  metricDivider: {
    width: 1,
    backgroundColor: '#1a1a1a',
  },
  metricLabel: {
    color: '#9aa0a6',
    fontSize: 12,
    fontWeight: '700',
  },
  metricValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },

  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#2b8cff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '900',
  },
  secondaryButton: {
    width: 120,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    backgroundColor: '#101010',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#e6e6e6',
    fontWeight: '900',
  },

  facilityChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  facilityChip: {
    flexGrow: 1,
    minWidth: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: '#0c0c0c',
  },
  facilityChipActive: {
    backgroundColor: '#0d121a',
  },
  facilityChipDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  facilityChipText: {
    flex: 1,
    color: '#e6e6e6',
    fontSize: 12,
    fontWeight: '800',
  },
});
