import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { images } from '@/constants/images';

export default function MapScreen() {
  const { t } = useTranslation(['map', 'common']);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.heroContent}>
          <ThemedText type="title" style={styles.title}>
            {t('map:title')}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {t('map:mobileOnlyHint')}
          </ThemedText>

          <View style={styles.badge}>
            <ThemedText style={styles.badgeText}>{t('map:mobileOnlyBadge')}</ThemedText>
          </View>
        </View>

        <Image source={images.cellphone} style={styles.heroImage} contentFit="contain" />
      </View>

      <View style={styles.placeholder}>
        <Image source={images.pin} style={styles.placeholderImage} contentFit="contain" />

        <ThemedText style={styles.placeholderTitle}>{t('map:mobileOnlyTitle')}</ThemedText>

        <ThemedText style={styles.placeholderText}>{t('map:mobileOnlyBody')}</ThemedText>

        <View style={styles.steps}>
          <View style={styles.stepRow}>
            <View style={styles.stepIndex}>
              <ThemedText style={styles.stepIndexText}>1</ThemedText>
            </View>
            <ThemedText style={styles.stepText}>{t('map:step1')}</ThemedText>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepIndex}>
              <ThemedText style={styles.stepIndexText}>2</ThemedText>
            </View>
            <ThemedText style={styles.stepText}>{t('map:step2')}</ThemedText>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepIndex}>
              <ThemedText style={styles.stepIndexText}>3</ThemedText>
            </View>
            <ThemedText style={styles.stepText}>{t('map:step3')}</ThemedText>
          </View>
        </View>

        <View style={styles.tipRow}>
          <Image source={images.key} style={styles.tipIcon} contentFit="contain" />
          <ThemedText style={styles.tipText}>{t('map:tip')}</ThemedText>
        </View>

        <Pressable style={styles.secondaryButton} onPress={() => { }}>
          <ThemedText style={styles.secondaryButtonText}>{t('map:gotIt')}</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0b0b', paddingTop: 10 },
  hero: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    backgroundColor: '#0f0f0f',
    overflow: 'hidden',
  },
  heroContent: { gap: 6, maxWidth: '74%' },
  title: { color: '#fff', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#9aa0a6' },
  badge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#2b8cff22',
    borderWidth: 1,
    borderColor: '#2b8cff40',
  },
  badgeText: { color: '#9bbcff', fontWeight: '800', fontSize: 11 },
  heroImage: { position: 'absolute', right: -10, top: -10, width: 140, height: 140, opacity: 0.25 },

  placeholder: {
    marginTop: 16,
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222',
    backgroundColor: '#0f0f0f',
    gap: 12,
  },
  placeholderImage: { width: 90, height: 90, opacity: 0.35 },
  placeholderTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  placeholderText: { color: '#9aa0a6' },

  steps: {
    marginTop: 4,
    gap: 10,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    backgroundColor: '#0c0c0c',
    borderRadius: 14,
    padding: 12,
  },
  stepRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepIndex: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    backgroundColor: '#101010',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepIndexText: { color: '#cfcfcf', fontWeight: '900', fontSize: 12 },
  stepText: { color: '#cfcfcf', flex: 1, fontSize: 13 },

  tipRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 2 },
  tipIcon: { width: 34, height: 34, opacity: 0.35 },
  tipText: { color: '#9aa0a6', flex: 1, fontSize: 13 },

  secondaryButton: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    backgroundColor: '#101010',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  secondaryButtonText: { color: '#e6e6e6', fontWeight: '900' },
});
