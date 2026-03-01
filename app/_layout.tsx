import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { AuthProvider, useAuth } from '@/components/auth-context';
import { ThemedText } from '@/components/themed-text';
import { appConfig } from '@/config';
import { useColorScheme } from '@/hooks/use-color-scheme';
import i18n from '@/i18n';
import { loadLanguage } from '@/storage/language-store';

export const unstable_settings = {
  anchor: '(tabs)',
};

const AUTH_DISABLED = appConfig.authDisabled;
const PRIMARY_FONT = 'ChairoSans';

// On web, `expo-font` uses `fontfaceobserver` with a hard-coded 6000ms timeout.
// When running through an Expo tunnel (exp.direct), assets/fonts may take longer to load,
// which can cause repeated red-screen reload loops. We patch the observer to wait longer.
const WEB_FONTFACEOBSERVER_TIMEOUT_MS = 6 * 60 * 1000; // 6 minutes

const patchWebFontFaceObserverTimeout = () => {
  if (Platform.OS !== 'web') return;

  const globalAny = globalThis as unknown as { __arrivioPatchedFontTimeout?: boolean };
  if (globalAny.__arrivioPatchedFontTimeout) return;
  globalAny.__arrivioPatchedFontTimeout = true;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const FontFaceObserver = require('fontfaceobserver');
    if (!FontFaceObserver?.prototype?.load) return;

    const originalLoad = FontFaceObserver.prototype.load;
    FontFaceObserver.prototype.load = function patchedLoad(text: unknown, timeout?: unknown) {
      const requested =
        typeof timeout === 'number' && Number.isFinite(timeout) ? timeout : 0;
      return originalLoad.call(
        this,
        text,
        Math.max(requested, WEB_FONTFACEOBSERVER_TIMEOUT_MS),
      );
    };
  } catch (err) {
    // If patching fails, we keep the default behavior (still better than crashing the app here).
    console.warn('Failed to patch fontfaceobserver timeout', err);
  }
};

SplashScreen.preventAutoHideAsync().catch(() => undefined);
patchWebFontFaceObserverTimeout();

function AuthGate() {
  const { status, error } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation(['common']);
  const inAuthFlow = pathname === '/login' || pathname === '/register' || pathname === '/forgot-password';
  const splashReleasedRef = useRef(false);

  useEffect(() => {
    if (splashReleasedRef.current) return;
    if (AUTH_DISABLED || status !== 'checking') {
      splashReleasedRef.current = true;
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [status]);

  useEffect(() => {
    const redirectTo = (targetPath: '/home' | '/login') => {
      if (pathname === targetPath) return;
      router.replace(targetPath);
    };

    if (AUTH_DISABLED) {
      if (inAuthFlow) {
        redirectTo('/home');
      }
      return;
    }

    if (status === 'authenticated' && inAuthFlow) {
      redirectTo('/home');
      return;
    }

    if (status === 'unauthenticated' && !inAuthFlow) {
      redirectTo('/login');
    }
  }, [inAuthFlow, pathname, router, status]);

  if (AUTH_DISABLED) {
    return (
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: t('common:appName') }} />
      </Stack>
    );
  }

  if (status === 'checking' && !splashReleasedRef.current) {
    return null;
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
      <Stack.Screen name="(auth)/forgot-password" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: t('common:appName') }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
    ...MaterialIcons.font,
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

  // Keep the splash screen until fonts are ready. If a font fails to load (timeout/offline),
  // we still render the app to avoid an infinite boot loop on web/tunnel.
  if (!fontsLoaded && !fontError) {
    return null;
  }
  if (fontError) {
    console.warn('Font loading failed, continuing without all custom fonts', fontError);
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
