import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { createIssue } from '@/api/issues';
import { mapApiError } from '@/api/errors';
import { useMutation } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { images } from '@/constants/images';

type IssueCategory = 'delayed' | 'equipment' | 'safety' | 'other';

export default function IssueScreen() {
  const { t } = useTranslation(['issue', 'common']);

  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState<IssueCategory>('delayed');

  const categories = useMemo(
    () => [
      { id: 'delayed' as const, label: t('issue:delayed') },
      { id: 'equipment' as const, label: t('issue:equipment') },
      { id: 'safety' as const, label: t('issue:safety') },
      { id: 'other' as const, label: t('issue:other') },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  );

  const mutation = useMutation({
    mutationFn: createIssue,
    onSuccess: () => {
      setDesc('');
      Alert.alert(t('issue:title'), t('issue:submitted'));
    },
    onError: (error) => {
      const err = mapApiError(error);
      Alert.alert(t('issue:failed'), err.message);
    },
  });

  const submit = () => {
    const clean = desc.trim();
    if (!clean) {
      Alert.alert(t('issue:required'));
      return;
    }
    mutation.mutate({ description: clean, category });
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
          <View style={styles.heroContent}>
            <ThemedText type="title" style={styles.title}>
              {t('issue:title')}
            </ThemedText>

            <ThemedText style={styles.subtitle}>
              {t('issue:subtitle')}
            </ThemedText>

            <View style={styles.heroBadge}>
              <Image source={images.arrow} style={styles.heroBadgeIcon} contentFit="contain" />
              <ThemedText style={styles.heroBadgeText}>
                {t('issue:priority')}
              </ThemedText>
            </View>
          </View>

          <Image source={images.alarm} style={styles.heroImage} contentFit="contain" />
        </View>

        {/* FORM */}
        <ThemedView style={styles.card}>
          <ThemedText style={styles.label}>{t('issue:category')}</ThemedText>

          <View style={styles.chipRow}>
            {categories.map((c) => {
              const isActive = c.id === category;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCategory(c.id)}
                  style={({ pressed }) => [
                    styles.chip,
                    isActive && styles.chipActive,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                >
                  <ThemedText style={[styles.chipText, isActive && styles.chipTextActive]}>
                    {c.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <ThemedText style={styles.label}>{t('issue:description')}</ThemedText>

          <TextInput
            placeholder={t('issue:descriptionPlaceholder')}
            placeholderTextColor="#7f7f7f"
            value={desc}
            onChangeText={setDesc}
            style={styles.textArea}
            multiline
            textAlignVertical="top"
            autoCorrect
          />

          <Pressable
            onPress={() => Alert.alert(t('issue:attach'), t('issue:attachUnavailable'))}
            style={({ pressed }) => [styles.attach, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Image source={images.camera} style={styles.attachIcon} contentFit="contain" />
            <ThemedText style={styles.attachText}>{t('issue:attach')}</ThemedText>
          </Pressable>

          <Pressable
            onPress={submit}
            disabled={mutation.isPending}
            style={({ pressed }) => [
              styles.button,
              mutation.isPending && styles.buttonDisabled,
              pressed && !mutation.isPending && styles.buttonPressed,
            ]}
            accessibilityRole="button"
          >
            {mutation.isPending ? (
              <View style={styles.buttonRow}>
                <ActivityIndicator />
                <ThemedText style={styles.buttonText}>{t('issue:submitting')}</ThemedText>
              </View>
            ) : (
              <ThemedText style={styles.buttonText}>{t('issue:submit')}</ThemedText>
            )}
          </Pressable>
        </ThemedView>

        {/* NEXT STEPS */}
        <ThemedView style={styles.infoCard}>
          <Image source={images.key} style={styles.infoImage} contentFit="contain" />
          <View style={styles.infoContent}>
            <ThemedText style={styles.infoTitle}>{t('issue:nextTitle')}</ThemedText>
            <ThemedText style={styles.infoBody}>{t('issue:nextBody')}</ThemedText>
          </View>
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0b0b' },
  content: { padding: 24, paddingBottom: 40 },

  hero: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    backgroundColor: '#0f0f0f',
    overflow: 'hidden',
    marginBottom: 16,
  },
  heroContent: { maxWidth: '72%' },
  title: { color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 6 },
  subtitle: { textAlign: 'left', color: '#cfcfcf' },

  heroBadge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#2b8cff20',
    borderWidth: 1,
    borderColor: '#2b8cff40',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroBadgeIcon: { width: 14, height: 14, opacity: 0.9 },
  heroBadgeText: { color: '#9bbcff', fontSize: 11, fontWeight: '700' },

  heroImage: { position: 'absolute', right: -10, top: -10, width: 160, height: 160, opacity: 0.22 },

  card: {
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222',
    backgroundColor: '#0f0f0f',
  },

  label: { color: '#cfcfcf', marginBottom: 8, fontWeight: '700' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
    backgroundColor: '#0d0d0d',
  },
  chipActive: { borderColor: '#2b8cff', backgroundColor: '#2b8cff20' },
  chipText: { color: '#cfcfcf', fontWeight: '600' },
  chipTextActive: { color: '#2b8cff', fontWeight: '800' },

  textArea: {
    minHeight: 120,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#222',
    color: '#fff',
    backgroundColor: '#0d0d0d',
    fontFamily: 'ChairoSans',
  },

  attach: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#222',
    backgroundColor: '#0f0f0f',
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  attachIcon: { width: 22, height: 22, opacity: 0.75 },
  attachText: { color: '#2b8cff', fontWeight: '800' },

  button: {
    marginTop: 12,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#2b8cff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonPressed: { transform: [{ scale: 0.99 }], opacity: 0.95 },
  buttonDisabled: { backgroundColor: '#1a1a1a' },
  buttonText: { color: '#fff', fontWeight: '900' },
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  infoCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    backgroundColor: '#0f0f0f',
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    overflow: 'hidden',
  },
  infoImage: { width: 62, height: 62, opacity: 0.35 },
  infoContent: { flex: 1 },
  infoTitle: { color: '#fff', fontWeight: '900', marginBottom: 6 },
  infoBody: { color: '#9aa0a6', fontSize: 13, lineHeight: 18 },

  pressed: { opacity: 0.9 },
});
