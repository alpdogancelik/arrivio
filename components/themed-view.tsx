import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;

  // New: semantic container variants
  variant?: 'default' | 'screen' | 'card' | 'inset' | 'chip';
};

export function ThemedView({
  style,
  lightColor,
  darkColor,
  variant = 'default',
  ...otherProps
}: ThemedViewProps) {
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');

  return (
    <View
      style={[
        // Backward compatible
        { backgroundColor: variant === 'default' ? backgroundColor : undefined },

        // New variants (dark-ui friendly defaults)
        variant === 'screen' ? styles.screen : undefined,
        variant === 'card' ? styles.card : undefined,
        variant === 'inset' ? styles.inset : undefined,
        variant === 'chip' ? styles.chip : undefined,

        style,
      ]}
      {...otherProps}
    />
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#0b0b0b' },

  card: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#1a1a1a',
    borderRadius: 16,
  },

  inset: {
    backgroundColor: '#0d0d0d',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 14,
  },

  chip: {
    backgroundColor: '#0d0d0d',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 12,
  },
});
