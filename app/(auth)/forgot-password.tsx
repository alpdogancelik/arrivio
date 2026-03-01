import { useAuth } from '@/components/auth-context';
import { GradientButton } from '@/components/gradient-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { images } from '@/constants/images';
import { saveLanguage } from '@/storage/language-store';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Platform, StatusBar, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { requestPasswordReset } = useAuth();
  const { t, i18n } = useTranslation(['auth', 'settings']);

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => email.trim().length > 0 && !loading, [email, loading]);
  const resolvedLanguage = (i18n.resolvedLanguage ?? i18n.language ?? 'en').toLowerCase();
  const isTurkish = resolvedLanguage.startsWith('tr');

  const handleLanguageToggle = async (value: boolean) => {
    const nextLanguage = value ? 'tr' : 'en';
    if (nextLanguage === i18n.language) return;
    await i18n.changeLanguage(nextLanguage);
    await saveLanguage(nextLanguage);
  };

  const onSubmit = async () => {
    if (!canSubmit) return;

    setLoading(true);
    try {
      const res = await requestPasswordReset(email.trim());
      if (!res.ok) {
        Alert.alert(t('resetPasswordTitle'), res.message ?? t('resetPasswordError'));
        return;
      }

      Alert.alert(t('resetPasswordTitle'), res.message ?? t('resetPasswordSuccess'));
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <Image source={images.key} style={styles.heroImage} contentFit="contain" pointerEvents="none" />

      <View style={styles.headerRow}>
        <Ionicons name="chevron-back" size={22} color="#fff" onPress={() => router.back()} />
      </View>

      <View style={styles.header}>
        <MaterialCommunityIcons name="lock-reset" size={62} color="#4aa8ff" style={styles.headerIcon} />
        <ThemedText type="title" style={styles.title}>
          {t('resetPasswordTitle')}
        </ThemedText>
        <ThemedText style={styles.subtitle}>{t('resetPasswordSubtitle')}</ThemedText>
      </View>

      <ThemedView style={styles.languageCard}>
        <ThemedText style={styles.languageTitle}>{t('settings:language')}</ThemedText>
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

      <ThemedView style={styles.card}>
        <Image source={images.pin} style={styles.cardImage} contentFit="contain" pointerEvents="none" />
        <TextInput
          placeholder={t('email')}
          placeholderTextColor="#a9a9a9"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
          returnKeyType="done"
          onSubmitEditing={onSubmit}
        />

        <GradientButton onPress={onSubmit} disabled={!canSubmit}>
          {loading ? t('resetPasswordSending') : t('resetPasswordButton')}
        </GradientButton>

        <ThemedText style={styles.backLink} onPress={() => router.replace('/login')}>
          {t('backToSignIn')}
        </ThemedText>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0b',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 28 : 48,
    paddingHorizontal: 24,
  },
  headerRow: {
    height: 28,
    justifyContent: 'center',
    marginBottom: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerIcon: {
    marginBottom: 14,
  },
  title: {
    textAlign: 'center',
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '800',
  },
  subtitle: {
    textAlign: 'center',
    color: '#cfcfcf',
    marginTop: 10,
    fontSize: 14,
  },
  languageCard: {
    marginBottom: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    backgroundColor: '#0f0f0f',
  },
  languageTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
    marginBottom: 10,
    textAlign: 'center',
  },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  languageOption: {
    color: '#6b6b6b',
    fontWeight: '800',
    fontSize: 12,
  },
  languageOptionActive: {
    color: '#fff',
  },
  card: {
    width: '100%',
    backgroundColor: '#0a0a0a',
    padding: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    overflow: 'hidden',
    shadowColor: '#2b8cff',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  input: {
    height: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingHorizontal: 16,
    color: '#fff',
    backgroundColor: '#151515',
    marginBottom: 12,
    fontSize: 15,
    fontFamily: 'ChairoSans',
  },
  backLink: {
    textAlign: 'center',
    marginTop: 14,
    color: '#2b8cff',
    fontWeight: '700',
    fontSize: 14,
  },
  heroImage: {
    position: 'absolute',
    right: -10,
    top: -10,
    width: 180,
    height: 180,
    opacity: 0.2,
  },
  cardImage: {
    position: 'absolute',
    right: -20,
    top: -20,
    width: 140,
    height: 140,
    opacity: 0.12,
  },
});
