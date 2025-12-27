import { useAuth } from '@/components/auth-context';
import { GradientButton } from '@/components/gradient-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { images } from '@/constants/images';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, StatusBar, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const { t } = useTranslation(['auth']);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    setLoading(true);
    const res = await login(email.trim(), password);
    setLoading(false);
    if (!res.ok) {
      Alert.alert(t('loginFailed'), res.message ?? t('invalidCredentials'));
      return;
    }
    router.replace('/(tabs)/home');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <Image source={images.key} style={styles.heroImage} contentFit="contain" pointerEvents="none" />
      <View style={styles.header}>
        <MaterialCommunityIcons name="truck" size={70} color="#4aa8ff" style={styles.truckIcon} />
        <ThemedText type="title" style={styles.title}>
          {t('loginTitle')}
        </ThemedText>
        <ThemedText style={styles.subtitle}>{t('loginSubtitle')}</ThemedText>
      </View>

      <ThemedView style={styles.centerCard}>
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
          />
          <TextInput
            placeholder={t('password')}
            placeholderTextColor="#a9a9a9"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={styles.input}
          />

          <GradientButton onPress={onLogin} disabled={loading}>
            {loading ? t('loginProcessing') : t('loginCta')}
          </GradientButton>

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
    elevation: 10
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
