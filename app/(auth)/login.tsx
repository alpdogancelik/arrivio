import { useAuth } from '@/components/auth-context';
import { GradientButton } from '@/components/gradient-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { images } from '@/constants/images';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Platform, StatusBar, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { saveLanguage } from '@/storage/language-store';

export default function LoginScreen() {
  //Router is used to redirect after a successful login
  const router = useRouter();

  //Auth context exposes the login() function (likely hits your backend / Firebase)
  const { login } = useAuth();

  //i18n translations for the "auth" namespace
  const { t, i18n } = useTranslation(['auth', 'settings']);

  //Local form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  //Prevent double-submit + show "processing" label
  const [loading, setLoading] = useState(false);

  //Simple client side check so we don’t submit empty credentials
  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.length > 0 && !loading;
  }, [email, password, loading]);
  const resolvedLanguage = (i18n.resolvedLanguage ?? i18n.language ?? 'en').toLowerCase();
  const isTurkish = resolvedLanguage.startsWith('tr');

  const showEnglishLoginError = (message?: string) => {
    Alert.alert('Sign in failed', message ?? 'Invalid email or password.');
  };

  const onLogin = async () => {
    //Extra guard against accidental double taps
    if (!canSubmit) return;

    setLoading(true);

    try {
      //Trim email to avoid whitespace issues (common on mobile keyboards)
      const res = await login(email.trim(), password);

      //If the auth layer reports failure, show an alert and stay on the screen
      if (!res.ok) {
        showEnglishLoginError(res.message);
        return;
      }

      //Success: replace so users can’t go back to login with the back gesture
      router.replace('/(tabs)/home');
    } catch {
      //Safety net: if login() throws instead of returning { ok: false }
      showEnglishLoginError();
    } finally {
      //Always release loading state
      setLoading(false);
    }
  };

  const handleLanguageToggle = async (value: boolean) => {
    const nextLanguage = value ? 'tr' : 'en';
    if (nextLanguage === i18n.language) return;
    await i18n.changeLanguage(nextLanguage);
    await saveLanguage(nextLanguage);
  };

  return (
    <View style={styles.container}>
      {/*Force a dark status bar style (Android also gets a backgroundColor)*/}
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/*Decorative hero image (absolute positioned)*/}
      <Image source={images.key} style={styles.heroImage} contentFit="contain" pointerEvents="none" />

      {/*Header block*/}
      <View style={styles.header}>
        {/*Big icon to set the tone (logistics / trucking)*/}
        <MaterialCommunityIcons name="truck" size={70} color="#4aa8ff" style={styles.truckIcon} />

        {/*Title + subtitle from translations*/}
        <ThemedText type="title" style={styles.title}>
          {t('loginTitle')}
        </ThemedText>
        <ThemedText style={styles.subtitle}>{t('loginSubtitle')}</ThemedText>
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

      {/*Centered card container*/}
      <ThemedView style={styles.centerCard}>
        <ThemedView style={styles.card}>
          {/*Decorative image inside the card*/}
          <Image source={images.pin} style={styles.cardImage} contentFit="contain" pointerEvents="none" />

          {/*Email input*/}
          <TextInput
            placeholder={t('email')}
            placeholderTextColor="#a9a9a9"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            //Helps iOS autofill understand what this field is
            textContentType="emailAddress"
            //Pressing enter should move to password logically (not perfect without refs, but ok)
            returnKeyType="next"
          />

          {/*Password input*/}
          <TextInput
            placeholder={t('password')}
            placeholderTextColor="#a9a9a9"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            textContentType="password"
            returnKeyType="done"
            //Convenient: submit from keyboard "Done"
            onSubmitEditing={onLogin}
          />

          {/*Primary CTA (call to action)*/}
          <GradientButton onPress={onLogin} disabled={!canSubmit}>
            {loading ? t('loginProcessing') : t('loginCta')}
          </GradientButton>

          <ThemedText style={styles.forgotPassword} onPress={() => router.push('/forgot-password')}>
            {t('forgotPassword')}
          </ThemedText>

          {/*Register link*/}
          <ThemedText style={styles.smallText}>{t('noAccount')}</ThemedText>
          <Link href="/register">
            <ThemedText style={styles.registerLink}>{t('register')}</ThemedText>
          </Link>
        </ThemedView>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0b',
    //On Android we offset below the status bar (since it overlays content)
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 60 : 80,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    paddingTop: 20,
  },
  truckIcon: {
    marginBottom: 15,
  },
  title: {
    textAlign: 'center',
    marginTop: 9,
    color: '#ffffff',
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: 1,
  },
  subtitle: {
    textAlign: 'center',
    color: '#cfcfcf',
    marginBottom: 16,
    marginTop: 10,
    fontSize: 14,
  },
  centerCard: {
    alignItems: 'center',
    backgroundColor: 'transparent',
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

    //Light blue glow-ish shadow (iOS)
    shadowColor: '#2b8cff',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 8,

    //Android elevation shadow
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
  smallText: {
    textAlign: 'center',
    color: '#cfcfcf',
    marginTop: 6,
    fontSize: 13,
  },
  forgotPassword: {
    textAlign: 'center',
    marginTop: 12,
    color: '#9bbcff',
    fontWeight: '700',
    fontSize: 13,
  },
  registerLink: {
    textAlign: 'center',
    marginTop: 6,
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
