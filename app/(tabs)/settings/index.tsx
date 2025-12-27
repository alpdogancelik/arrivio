import { useAuth } from '@/components/auth-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { appConfig } from '@/config';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { images } from '@/constants/images';
import { useTranslation } from 'react-i18next';
import { saveLanguage } from '@/storage/language-store';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { t, i18n } = useTranslation(['settings', 'common']);
  const [isBusy, setIsBusy] = useState(false);

  const roleKey = String((user as any)?.role ?? 'carrier');
  const roleLabel = useMemo(
    () => t(`common:roles.${roleKey}`, { defaultValue: roleKey }),
    [roleKey, t],
  );
  const versionLabel = useMemo(() => `v${appConfig.version}`, []);
  const resolvedLanguage = (i18n.resolvedLanguage ?? i18n.language ?? 'en').toLowerCase();
  const isTurkish = resolvedLanguage.startsWith('tr');

  const handleLogout = async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await logout();
      router.replace('/(auth)/login');
    } catch (e: any) {
      Alert.alert(t('common:signOutFailed'), e?.message ?? t('common:unexpectedError'));
    } finally {
      setIsBusy(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert(t('common:signOutTitle'), t('common:signOutConfirm'), [
      { text: t('common:cancel'), style: 'cancel' },
      { text: t('common:signOut'), style: 'destructive', onPress: handleLogout },
    ]);
  };

  const handleLanguageToggle = async (value: boolean) => {
    const nextLanguage = value ? 'tr' : 'en';
    if (nextLanguage === i18n.language) return;
    await i18n.changeLanguage(nextLanguage);
    await saveLanguage(nextLanguage);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* HERO */}
        <View style={styles.hero}>
          <Image source={images.key} style={styles.heroImage} contentFit="contain" />
          <View style={styles.heroContent}>
            <ThemedText type="title" style={styles.title}>
              {t('settings:title')}
            </ThemedText>
            <ThemedText style={styles.subtitle}>{t('settings:subtitle')}</ThemedText>
          </View>
        </View>

        {/* ACCOUNT */}
        <ThemedView style={styles.card}>
          <Image source={images.wallet} style={styles.cardImage} contentFit="contain" />
          <ThemedText style={styles.cardTitle}>{t('settings:account')}</ThemedText>

          <View style={styles.row}>
            <ThemedText style={styles.label}>{t('settings:role')}</ThemedText>
            <ThemedText style={styles.value}>{roleLabel}</ThemedText>
          </View>

          <View style={styles.row}>
            <ThemedText style={styles.label}>{t('settings:version')}</ThemedText>
            <ThemedText style={styles.value}>{versionLabel}</ThemedText>
          </View>
        </ThemedView>

        {/* LANGUAGE */}
        <ThemedView style={styles.card}>
          <Image source={images.globe} style={styles.cardImageAlt} contentFit="contain" />
          <ThemedText style={styles.cardTitle}>{t('settings:language')}</ThemedText>
          <ThemedText style={styles.cardSubtitle}>{t('settings:languageHint')}</ThemedText>

          <View style={styles.languageRow}>
            <ThemedText style={[styles.languageOption, !isTurkish && styles.languageOptionActive]}>
              {t('settings:languageEnglish')}
            </ThemedText>
            <Switch value={isTurkish} onValueChange={handleLanguageToggle} />
            <ThemedText style={[styles.languageOption, isTurkish && styles.languageOptionActive]}>
              {t('settings:languageTurkish')}
            </ThemedText>
          </View>
        </ThemedView>

        {/* SESSION */}
        <ThemedView style={styles.card}>
          <Image source={images.alarm} style={styles.cardImageAlt} contentFit="contain" />
          <ThemedText style={styles.cardTitle}>{t('settings:session')}</ThemedText>
          <ThemedText style={styles.cardSubtitle}>{t('settings:sessionHint')}</ThemedText>

          <Pressable
            onPress={confirmLogout}
            style={({ pressed }) => [
              styles.logoutButton,
              (pressed || isBusy) && styles.logoutButtonPressed,
              isBusy && styles.disabledButton,
            ]}
            disabled={isBusy}
            accessibilityRole="button"
          >
            {isBusy ? (
              <View style={styles.logoutRow}>
                <ActivityIndicator />
                <ThemedText style={styles.logoutText}>{t('common:signingOut')}</ThemedText>
              </View>
            ) : (
              <ThemedText style={styles.logoutText}>{t('common:signOut')}</ThemedText>
            )}
          </Pressable>

          <ThemedText style={styles.dangerHint}>{t('common:sessionCleared')}</ThemedText>
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0b0b' },
  content: { padding: 20, paddingBottom: 36 },

  hero: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    backgroundColor: '#0f0f0f',
    overflow: 'hidden',
    marginBottom: 12,
  },
  heroImage: { position: 'absolute', right: -10, top: -10, width: 140, height: 140, opacity: 0.2 },
  heroContent: { gap: 6, maxWidth: '75%' },
  title: { color: '#fff', fontSize: 24, fontWeight: '900' },
  subtitle: { color: '#9aa0a6' },

  card: {
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    backgroundColor: '#0f0f0f',
    overflow: 'hidden',
  },
  cardImage: { position: 'absolute', right: -10, top: -10, width: 120, height: 120, opacity: 0.12 },
  cardImageAlt: { position: 'absolute', right: -10, bottom: -10, width: 120, height: 120, opacity: 0.12 },

  cardTitle: { color: '#fff', fontWeight: '900', fontSize: 16, marginBottom: 10 },
  cardSubtitle: { color: '#9aa0a6', fontSize: 12, lineHeight: 16, marginBottom: 12 },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  label: { color: '#9aa0a6' },
  value: { color: '#fff', fontWeight: '800', textTransform: 'capitalize' },

  languageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  languageOption: { color: '#6b6b6b', fontWeight: '800', fontSize: 12 },
  languageOptionActive: { color: '#fff' },

  logoutButton: {
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#b91c1c',
  },
  logoutButtonPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  disabledButton: { opacity: 0.6 },

  logoutRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoutText: { color: '#fff', fontWeight: '900' },

  dangerHint: { marginTop: 10, color: '#9aa0a6', fontSize: 12 },
});

