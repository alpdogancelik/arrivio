export const Colors = {
  light: {
    text: '#11181c',
    background: '#ffffff',
    tint: '#2b8cff',
    tabIconDefault: '#8a8a8a',
    tabIconSelected: '#2b8cff',
  },
  dark: {
    text: '#f5f5f5',
    background: '#0b0b0b',
    tint: '#2b8cff',
    tabIconDefault: '#6b7280',
    tabIconSelected: '#2b8cff',
  },
} as const;

export type ColorScheme = keyof typeof Colors;
export type ThemeColorName = keyof typeof Colors.light;
