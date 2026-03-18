import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export const PROVIDER_GOOGLE = 'google';

export type MarkerProps = {
  coordinate?: { latitude: number; longitude: number };
  children?: React.ReactNode;
};

export function Marker({ coordinate, children }: MarkerProps) {
  return (
    <View style={styles.markerItem}>
      {children ?? <Text style={styles.markerLabel}>Marker</Text>}
      {coordinate ? (
        <Text style={styles.markerCoords}>
          {coordinate.latitude.toFixed(4)}, {coordinate.longitude.toFixed(4)}
        </Text>
      ) : null}
    </View>
  );
}

export type MapViewProps = {
  style?: any;
  children?: React.ReactNode;
};

export default function MapView({ style, children }: MapViewProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>Map is not available on web.</Text>
      <Text style={styles.subtitle}>Open this screen on Android or iOS for live map data.</Text>
      <View style={styles.markerList}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222',
    backgroundColor: '#0f0f0f',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  title: { color: '#fff', fontWeight: '700', marginBottom: 6, fontFamily: 'ChairoSans' },
  subtitle: { color: '#9aa0a6', textAlign: 'center', fontSize: 12, fontFamily: 'ChairoSans' },
  markerList: {
    width: '100%',
    marginTop: 12,
    gap: 8,
  },
  markerItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    backgroundColor: '#0b0b0b',
    padding: 10,
  },
  markerLabel: { color: '#e6e6e6', fontWeight: '700', fontFamily: 'ChairoSans' },
  markerCoords: { color: '#9aa0a6', marginTop: 4, fontSize: 11, fontFamily: 'ChairoSans' },
});
