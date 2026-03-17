import { ThemedText } from '@/components/themed-text';
import { appConfig } from '@/config';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

type PresetPin = {
  id: string;
  name: string;
  query: string;
};

type ResolvedPin = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

declare global {
  interface Window {
    google?: any;
    __arrivioGoogleMapsPromise?: Promise<void>;
  }
}

const PRESET_PINS: PresetPin[] = [
  { id: 'station-1', name: 'Station1', query: '62X8+Q5C Kalkanli' },
  { id: 'station-2', name: 'Station2', query: '62X6+6XH Kalkanli' },
  { id: 'station-3', name: 'Station3', query: '7226+MC2 Kalkanli' },
];

const toDirectionsUrl = () => {
  const origin = PRESET_PINS[0].query;
  const destination = PRESET_PINS[2].query;
  const waypoints = PRESET_PINS[1].query;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints)}`;
};

const toFallbackEmbedUrl = () => {
  const origin = PRESET_PINS[0].query;
  const destination = PRESET_PINS[2].query;
  const waypoints = PRESET_PINS[1].query;
  if (appConfig.mapsApiKey) {
    return `https://www.google.com/maps/embed/v1/directions?key=${encodeURIComponent(appConfig.mapsApiKey)}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints)}&mode=driving`;
  }
  return `https://maps.google.com/maps?f=d&saddr=${encodeURIComponent(origin)}&daddr=${encodeURIComponent(destination)}+to:${encodeURIComponent(waypoints)}&output=embed`;
};

const loadGoogleMapsScript = async () => {
  if (window.google?.maps) return;
  if (window.__arrivioGoogleMapsPromise) return window.__arrivioGoogleMapsPromise;

  const key = appConfig.mapsApiKey;
  window.__arrivioGoogleMapsPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps script load error'));
    document.head.appendChild(script);
  });

  return window.__arrivioGoogleMapsPromise;
};

const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
  if (!window.google?.maps) return null;
  const geocoder = new window.google.maps.Geocoder();
  return new Promise((resolve) => {
    geocoder.geocode({ address }, (results: any, status: string) => {
      if (status !== 'OK' || !results?.length) return resolve(null);
      const loc = results[0]?.geometry?.location;
      if (!loc) return resolve(null);
      resolve({ lat: loc.lat(), lng: loc.lng() });
    });
  });
};

export default function MapScreen() {
  const { t } = useTranslation(['map']);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const [resolvedPins, setResolvedPins] = useState<ResolvedPin[]>([]);

  useEffect(() => {
    let disposed = false;
    const setup = async () => {
      try {
        if (!appConfig.mapsApiKey) throw new Error('no-key');
        await loadGoogleMapsScript();
        if (disposed) return;

        const geocoded = await Promise.all(
          PRESET_PINS.map(async (pin) => {
            const loc = await geocodeAddress(pin.query);
            if (!loc) return null;
            return { id: pin.id, name: pin.name, lat: loc.lat, lng: loc.lng } as ResolvedPin;
          }),
        );
        if (disposed) return;

        const validPins = geocoded.filter(Boolean) as ResolvedPin[];
        if (!validPins.length) throw new Error('no-geocode');
        setResolvedPins(validPins);

        if (!mapRef.current || !window.google?.maps) throw new Error('no-map');

        const map = new window.google.maps.Map(mapRef.current, {
          center: { lat: validPins[0].lat, lng: validPins[0].lng },
          zoom: 16,
          mapTypeControl: false,
          streetViewControl: false,
        });

        const bounds = new window.google.maps.LatLngBounds();
        validPins.forEach((pin) => {
          const marker = new window.google.maps.Marker({
            map,
            position: { lat: pin.lat, lng: pin.lng },
            title: pin.name,
            label: {
              text: pin.name,
              color: '#111827',
              fontWeight: '700',
              fontSize: '12px',
            },
          });

          const info = new window.google.maps.InfoWindow({
            content: `<div style="font-weight:700;font-size:12px;">${pin.name}</div>`,
            disableAutoPan: true,
          });

          info.open({ anchor: marker, map });
          marker.addListener('click', () => {
            info.open({ anchor: marker, map });
          });
          bounds.extend(marker.getPosition());
        });

        if (validPins.length > 1) {
          map.fitBounds(bounds, 80);
        }

        setUseFallback(false);
      } catch {
        if (!disposed) setUseFallback(true);
      }
    };

    setup();
    return () => {
      disposed = true;
    };
  }, []);

  const hasPins = useMemo(() => resolvedPins.length > 0, [resolvedPins.length]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          {t('map:title')}
        </ThemedText>
        <ThemedText style={styles.subtitle}>{t('map:subtitle')}</ThemedText>
      </View>

      <View style={styles.mapCard}>
        {useFallback ? (
          <iframe
            title="facility-map-fallback"
            src={toFallbackEmbedUrl()}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            style={{ border: 0, width: '100%', height: '100%', minHeight: 460 } as React.CSSProperties}
          />
        ) : (
          <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: 460 }} />
        )}
      </View>

      <View style={styles.actionsRow}>
        <Pressable style={styles.primaryButton} onPress={() => Linking.openURL(toDirectionsUrl())}>
          <ThemedText style={styles.primaryButtonText}>{t('map:directions')}</ThemedText>
        </Pressable>
      </View>

      <View style={styles.chipsRow}>
        {(hasPins ? resolvedPins.map((p) => ({ id: p.id, name: p.name })) : PRESET_PINS).map((pin) => (
          <View key={pin.id} style={styles.chip}>
            <ThemedText numberOfLines={1} style={styles.chipText}>
              {pin.name}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0b',
    padding: 16,
    gap: 12,
  },
  header: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    backgroundColor: '#0f0f0f',
    padding: 14,
    gap: 6,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: '#9aa0a6',
  },
  mapCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    backgroundColor: '#0f0f0f',
    overflow: 'hidden',
    minHeight: 460,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#2b8cff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    minWidth: '48%',
    flexGrow: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    backgroundColor: '#101010',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chipText: {
    color: '#cfcfcf',
    fontWeight: '700',
    fontSize: 12,
  },
});
