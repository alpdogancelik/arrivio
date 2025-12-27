import React from 'react';
import { Platform, StyleSheet, Text, type TextProps } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;

  // Backward compatible: existing values still valid
  type?:
  | 'default'
  | 'title'
  | 'defaultSemiBold'
  | 'subtitle'
  | 'link'
  // New variants
  | 'headline'
  | 'body'
  | 'caption'
  | 'label'
  | 'mono';

  // New: semantic color intent
  tone?: 'default' | 'muted' | 'primary' | 'danger' | 'success' | 'warning';
};

const PALETTE = {
  primary: '#2b8cff',
  danger: '#b91c1c',
  success: '#22c55e',
  warning: '#f59e0b',
  muted: '#9aa0a6',
};

function isHexColor(v: string) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);
}

function hexToRgba(hex: string, alpha: number) {
  if (!isHexColor(hex)) return undefined;

  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');

  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  tone = 'default',
  ...rest
}: ThemedTextProps) {
  const baseText = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  const resolvedColor =
    tone === 'default'
      ? baseText
      : tone === 'muted'
        ? hexToRgba(baseText, 0.72) ?? PALETTE.muted
        : PALETTE[tone];

  return (
    <Text
      style={[
        { color: resolvedColor },
        styles.base,
        type === 'default' ? styles.default : undefined,
        type === 'body' ? styles.body : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'label' ? styles.label : undefined,
        type === 'caption' ? styles.caption : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'headline' ? styles.headline : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'link' ? styles.link : undefined,
        type === 'mono' ? styles.mono : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: 'ChairoSans',
  },

  // defaults
  default: { fontSize: 15, lineHeight: 22 },
  body: { fontSize: 15, lineHeight: 22 },

  defaultSemiBold: { fontSize: 15, lineHeight: 22, fontWeight: '700' },

  label: { fontSize: 13, lineHeight: 18, fontWeight: '800' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '600' },

  subtitle: { fontSize: 16, lineHeight: 22, fontWeight: '800' },
  headline: { fontSize: 20, lineHeight: 26, fontWeight: '900' },

  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    ...(Platform.OS === 'ios' ? { letterSpacing: -0.2 } : null),
  },

  link: { fontSize: 15, lineHeight: 22, fontWeight: '800', textDecorationLine: 'underline' },

  mono: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
});
