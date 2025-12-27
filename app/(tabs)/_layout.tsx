import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];
  const { t } = useTranslation(['common']);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.tabIconSelected,
        tabBarInactiveTintColor: palette.tabIconDefault,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarShowLabel: false,
        tabBarStyle: { backgroundColor: '#070707', borderTopColor: '#1a1a1a', height: 72, paddingBottom: 8 },
        tabBarItemStyle: { paddingTop: 6 },
      }}>
      <Tabs.Screen
        name="home/index"
        options={{
          title: t('common:tabs.home'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons size={22} name={focused ? 'home' : 'home-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings/new"
        options={{
          title: t('common:tabs.book'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons size={22} name={focused ? 'calendar' : 'calendar-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings/index"
        options={{
          title: t('common:tabs.bookings'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons size={22} name={focused ? 'list' : 'list-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="map/index"
        options={{
          title: t('common:tabs.map'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons size={22} name={focused ? 'map' : 'map-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="pulse/index"
        options={{
          title: t('common:tabs.pulse'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons size={22} name={focused ? 'stats-chart' : 'stats-chart-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="issues/index"
        options={{
          title: t('common:tabs.issues'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons size={22} name={focused ? 'alert-circle' : 'alert-circle-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: t('common:tabs.profile'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons size={22} name={focused ? 'person' : 'person-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings/index"
        options={{
          title: t('common:tabs.settings'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons size={22} name={focused ? 'settings' : 'settings-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="bookings/[id]" options={{ href: null }} />
    </Tabs>
  );
}
