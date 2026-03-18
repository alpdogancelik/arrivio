import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';

let LinearGradient: any = null;
try {
  // load dynamically so app doesn't crash if dependency isn't installed
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  LinearGradient = require('expo-linear-gradient').LinearGradient;
} catch {
  LinearGradient = null;
}

const gradientShadow = Platform.select({
  ios: {
    shadowColor: '#1f6fe6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  android: {
    elevation: 6,
  },
  default: {
    boxShadow: '0px 6px 16px rgba(31, 111, 230, 0.2)',
  } as any,
});

export function GradientButton({ children, style, ...rest }: PressableProps & { children: React.ReactNode; style?: any }) {
  return (
    <Pressable {...rest} style={[styles.wrapper, style] as any}>
      {LinearGradient ? (
        <LinearGradient colors={["#2b8cff", "#4aa8ff"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradient}>
          <Text style={styles.text as any}>{children}</Text>
        </LinearGradient>
      ) : (
        <View style={[styles.gradient, { backgroundColor: '#2b8cff' }]}>
          <Text style={styles.text as any}>{children}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  gradient: {
    height: 60,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...gradientShadow,
  },
  text: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
    fontFamily: 'ChairoSans',
  },
});
