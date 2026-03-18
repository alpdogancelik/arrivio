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

export const Ui = {
  color: {
    bg: '#07090d',
    surface: '#0f131a',
    surfaceAlt: '#0b1017',
    surfaceInset: '#121821',
    border: '#1c2430',
    borderStrong: '#273345',
    text: '#f5f7fb',
    textMuted: '#98a2b3',
    textSoft: '#cfd7e3',
    primary: '#2b8cff',
    primaryStrong: '#4aa8ff',
    primarySoft: '#10233f',
    primaryBorder: '#2b8cff4d',
    warning: '#f59e0b',
    warningSoft: '#3a2810',
    warningBorder: '#f59e0b4d',
    danger: '#ef4444',
    dangerSoft: '#3a1719',
    dangerBorder: '#ef44444d',
    success: '#22c55e',
    successSoft: '#11281b',
    successBorder: '#22c55e4d',
  },
  radius: {
    sm: 14,
    md: 18,
    lg: 24,
    pill: 999,
  },
  space: {
    1: 8,
    2: 16,
    3: 24,
    4: 32,
  },
  layout: {
    tabBarOffset: 96,
  },
} as const;

export type ColorScheme = keyof typeof Colors;
export type ThemeColorName = keyof typeof Colors.light;
