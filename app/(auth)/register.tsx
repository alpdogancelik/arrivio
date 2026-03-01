import { useAuth } from '@/components/auth-context';
import { GradientButton } from '@/components/gradient-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { images } from '@/constants/images';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Platform, StatusBar, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { saveLanguage } from '@/storage/language-store';

export default function RegisterScreen() {
  //Router is used to navigate between auth screens
  const router = useRouter();

  //Auth context exposes register() for creating a new user
  const { register } = useAuth();

  //i18n translations for the auth namespace
  const { t, i18n } = useTranslation(['auth', 'settings']);

  //Local form state (simple controlled inputs)
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  //Used to disable the button and show a processing label
  const [loading, setLoading] = useState(false);

  //Basic client-side eligibility check
  const canSubmit = useMemo(() => {
    return (
      name.trim().length > 0 &&
      surname.trim().length > 0 &&
      email.trim().length > 0 &&
      password.length > 0 &&
      !loading
    );
  }, [name, surname, email, password, loading]);
  const resolvedLanguage = (i18n.resolvedLanguage ?? i18n.language ?? 'en').toLowerCase();
  const isTurkish = resolvedLanguage.startsWith('tr');

  const onRegister = async () => {
    //Guard against double taps and empty form submits
    if (!canSubmit) return;

    setLoading(true);
    setSuccessMessage('');

    try {
      //Trim email to avoid whitespace bugs from mobile keyboards
      const res = await register({
        name: name.trim(),
        surname: surname.trim(),
        email: email.trim(),
        password,
      });

      //If registration fails, show the message (or fallback)
      if (!res.ok) {
        Alert.alert(t('registrationFailed'), res.message ?? t('invalidCredentials'));
        return;
      }

      setName('');
      setSurname('');
      setEmail('');
      setPassword('');
      setSuccessMessage(t('registrationSuccess'));
    } catch {
      //Safety net if register() throws instead of returning { ok: false }
      Alert.alert(t('registrationFailed'), t('invalidCredentials'));
    } finally {
      //Always release the loading state
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
      <Image source={images.wallet} style={styles.heroImage} contentFit="contain" pointerEvents="none" />

      {/*Header block*/}
      <View style={styles.header}>
        {/* Big icon to visually match logistics theme */}
        <MaterialCommunityIcons name="truck" size={60} color="#4aa8ff" style={styles.truckIcon} />

        {/*Title + subtitle from translations*/}
        <ThemedText type="title" style={styles.title}>
          {t('registerTitle')}
        </ThemedText>
        <ThemedText style={styles.subtitle}>{t('registerSubtitle')}</ThemedText>
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

      {/*Centered card container */}
      <ThemedView style={styles.centerCard}>
        <ThemedView style={styles.card}>
          {/*Decorative image inside the card */}
          <Image source={images.priceTag} style={styles.cardImage} contentFit="contain" pointerEvents="none" />

          {/*First name*/}
          <TextInput
            placeholder={t('firstName')}
            placeholderTextColor="#a9a9a9"
            value={name}
            onChangeText={setName}
            style={styles.input}
            autoCapitalize="words"
            returnKeyType="next"
          />

          {/*Last name*/}
          <TextInput
            placeholder={t('lastName')}
            placeholderTextColor="#a9a9a9"
            value={surname}
            onChangeText={setSurname}
            style={styles.input}
            autoCapitalize="words"
            returnKeyType="next"
          />

          {/*Email*/}
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
            returnKeyType="next"
          />

          {/*Password*/}
          <TextInput
            placeholder={t('password')}
            placeholderTextColor="#a9a9a9"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            textContentType="newPassword"
            returnKeyType="done"
            //Convenience: submit from keyboard
            onSubmitEditing={onRegister}
          />

          {/* Primary CTA */}
          <GradientButton onPress={onRegister} disabled={!canSubmit}>
            {loading ? t('signUpProcessing') : t('signUp')}
          </GradientButton>

          {successMessage ? (
            <View style={styles.successBox}>
              <ThemedText style={styles.successTitle}>{t('emailCheckTitle')}</ThemedText>
              <ThemedText style={styles.successText}>{successMessage}</ThemedText>
            </View>
          ) : null}

          {/* Back to sign in */}
          <ThemedText style={styles.smallText}>{t('haveAccount')}</ThemedText>
          <ThemedText style={styles.registerLink} onPress={() => router.push('/(auth)/login')}>
            {t('signIn')}
          </ThemedText>
        </ThemedView>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    //On Android we offset below the status bar (since it overlays content)
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 40 : 60,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 10,
  },
  truckIcon: {
    marginBottom: 12,
  },
  title: {
    textAlign: 'center',
    marginTop: 8,
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '800',
  },
  subtitle: {
    textAlign: 'center',
    color: '#cfcfcf',
    marginTop: 8,
    marginBottom: 12,
    fontSize: 13,
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
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    overflow: 'hidden',

    //Blue glow-ish shadow (iOS)
    shadowColor: '#2b8cff',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 9,

    //Android elevation shadow
    elevation: 10,
  },
  input: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingHorizontal: 16,
    color: '#fff',
    backgroundColor: '#151515',
    marginBottom: 10,
    fontSize: 15,
    fontFamily: 'ChairoSans',
  },
  smallText: {
    textAlign: 'center',
    color: '#cfcfcf',
    marginTop: 6,
    fontSize: 13,
  },
  registerLink: {
    textAlign: 'center',
    marginTop: 6,
    color: '#2b8cff',
    fontWeight: '700',
    fontSize: 14,
  },
  successBox: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#245c39',
    backgroundColor: '#0f1f16',
    padding: 12,
  },
  successTitle: {
    color: '#8ae6a1',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  successText: {
    color: '#d7f4dd',
    fontSize: 13,
    lineHeight: 18,
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
