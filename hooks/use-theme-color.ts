import { Colors, type ThemeColorName } from '@/constants/theme';

import { useColorScheme } from './use-color-scheme';

type ThemeProps = {
  light?: string;
  dark?: string;
};

export function useThemeColor(props: ThemeProps, colorName: ThemeColorName) {
  const theme = useColorScheme() ?? 'light';
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  }

  return Colors[theme][colorName];
}
