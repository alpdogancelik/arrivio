import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { AuthProvider, useAuth } from '@/components/auth-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { appConfig } from '@/config';
import { useColorScheme } from '@/hooks/use-color-scheme';
import i18n from '@/i18n';
import { loadLanguage } from '@/storage/language-store';

export const unstable_settings = {
  anchor: '(tabs)',
};

const AUTH_DISABLED = appConfig.authDisabled;
const PRIMARY_FONT = 'ChairoSans';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function AuthGate() {
  const { status, error } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { t } = useTranslation(['common']);
  const inAuthFlow = segments[0] === '(auth)';

  useEffect(() => {
    if (AUTH_DISABLED) {
      if (inAuthFlow) {
        router.replace('/(tabs)/home');
      }
      return;
    }

    if (status === 'authenticated' && inAuthFlow) {
      router.replace('/(tabs)/home');
      return;
    }

    if (status === 'unauthenticated' && !inAuthFlow) {
      router.replace('/(auth)/login');
    }
  }, [inAuthFlow, router, status]);

  if (AUTH_DISABLED) {
    return (
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: t('common:appName') }} />
      </Stack>
    );
  }

  if (status === 'checking') {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#2b8cff" />
        <ThemedText style={{ marginTop: 10 }}>{t('common:loadingSession')}</ThemedText>
      </ThemedView>
    );
  }

  if (status === 'error') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <ThemedText type="title">{t('common:sessionStartFailed')}</ThemedText>
        {error ? <ThemedText style={{ marginTop: 8, textAlign: 'center' }}>{error}</ThemedText> : null}
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)/register" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: t('common:appName') }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
    [PRIMARY_FONT]: require('../assets/ChairoSansRegular-Regular.ttf'),
  });
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded]);

  useEffect(() => {
    let active = true;
    loadLanguage().then((stored) => {
      if (!active || !stored) return;
      if ((i18n.resolvedLanguage ?? i18n.language) === stored) return;
      void i18n.changeLanguage(stored);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <View style={styles.shell}>
            <View style={styles.frame}>
              <AuthGate />
            </View>
          </View>
        </AuthProvider>
      </QueryClientProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    ...(Platform.OS === 'web'
      ? {
        backgroundColor: '#0b0b0b',
        paddingVertical: 24,
        paddingHorizontal: 16,
        alignItems: 'center',
      }
      : {}),
  },
  frame: {
    flex: 1,
    width: '100%',
    ...(Platform.OS === 'web'
      ? {
        maxWidth: 460,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#1a2233',
        backgroundColor: '#07080a',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
      }
      : {}),
  },
});
