// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolViewProps, SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type SymbolName = SymbolViewProps['name'];
type IconName = ComponentProps<typeof MaterialIcons>['name'];
type IconMapping = Record<SymbolName, IconName>;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING: Partial<IconMapping> = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'calendar': 'calendar-today',
  'map.fill': 'map',
  'chart.bar.fill': 'insert-chart',
  'person.crop.circle': 'person',
  'exclamationmark.triangle': 'warning',
  'list.bullet.rectangle': 'list',
  'power': 'power-settings-new',
  'gearshape': 'settings',
};

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: SymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  // If the provided name isn't in MAPPING, fall back to a default icon
  const mapped: IconName = MAPPING[name] ?? 'help-outline';
  return <MaterialIcons color={color} size={size} name={mapped} style={style} />;
}
