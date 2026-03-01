import { type BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Platform, Pressable } from 'react-native';

export function HapticTab({ onPressIn, ...props }: BottomTabBarButtonProps) {
  const { ref: _ref, ...rest } = props as BottomTabBarButtonProps & { ref?: unknown };
  return (
    <Pressable
      {...rest}
      onPressIn={(event) => {
        if (Platform.OS !== 'web') {
          void Haptics.selectionAsync();
        }
        onPressIn?.(event);
      }}
    />
  );
}
