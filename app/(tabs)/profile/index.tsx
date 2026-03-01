// app/(tabs)/profile/index.tsx

import { useAuth } from '@/components/auth-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { images } from '@/constants/images';

type ProfileForm = {
  firstName: string;
  lastName: string;
  phone: string;
  company: string;
  vehiclePlate: string;
  capacity: string;
  available: boolean;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText style={styles.rowLabel}>{label}</ThemedText>
      <ThemedText style={styles.rowValue} numberOfLines={1}>
        {value || '—'}
      </ThemedText>
    </View>
  );
}

export default function ProfileScreen() {
  const { user, updateUser } = useAuth();
  const { t } = useTranslation(['profile', 'common']);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // local-only toggles (wire to backend later if you want)
  const [pushEnabled, setPushEnabled] = useState(true);
  const [autoAccept, setAutoAccept] = useState(false);

  const initialForm: ProfileForm = useMemo(
    () => ({
      firstName: user?.name ?? '',
      lastName: (user as any)?.surname ?? '',
      phone: (user as any)?.phone ?? '',
      company: (user as any)?.company ?? '',
      vehiclePlate: (user as any)?.vehiclePlate ?? '',
      capacity: String((user as any)?.capacity ?? ''),
      available: (user as any)?.available ?? true,
    }),
    [user],
  );

  const [form, setForm] = useState<ProfileForm>(initialForm);

  useEffect(() => {
    setForm(initialForm);
  }, [initialForm]);

  const displayName =
    `${user?.name ?? t('profile:guest', { defaultValue: 'Driver' })}${(user as any)?.surname ? ` ${(user as any).surname}` : ''}`.trim();

  const roleLabel = String((user as any)?.role ?? 'carrier');
  const availabilityLabel = form.available ? t('profile:available') : t('profile:unavailable');

  const cancel = () => {
    setForm(initialForm);
    setEditing(false);
  };

  const save = async () => {
    if (saving) return;

    const capacityNum = Number(form.capacity);
    const payload: any = {
      name: form.firstName.trim(),
      surname: form.lastName.trim(),
      phone: form.phone.trim(),
      company: form.company.trim(),
      vehiclePlate: form.vehiclePlate.trim(),
      capacity: Number.isFinite(capacityNum) && form.capacity.trim() !== '' ? capacityNum : undefined,
      available: form.available,
    };

    try {
      setSaving(true);
      await updateUser(payload);
      setEditing(false);
      Alert.alert(t('profile:savedTitle'), t('profile:savedBody'));
    } catch (e: any) {
      Alert.alert(t('profile:updateFailedTitle'), e?.message ?? t('profile:updateFailedBody'));
    } finally {
      setSaving(false);
    }
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
          <Image source={images.cellphone} style={styles.heroImage} contentFit="contain" />

          <View style={styles.heroHeader}>
            <View style={styles.avatarWrap}>
              <IconSymbol name="person.crop.circle" size={64} color="#2b8cff" />
            </View>

            <View style={styles.headerText}>
              <ThemedText type="title" style={styles.title}>
                {t('profile:title', { name: displayName })}
              </ThemedText>
              <ThemedText style={styles.email}>{user?.email ?? '—'}</ThemedText>

              <View style={styles.heroBadges}>
                <View style={styles.badge}>
                  <ThemedText style={styles.badgeText}>{t('profile:verified')}</ThemedText>
                </View>
                <View style={styles.badgeMuted}>
                  <ThemedText style={styles.badgeMutedText}>
                    {t('profile:roleLabel', { role: roleLabel })}
                  </ThemedText>
                </View>
              </View>
            </View>

            {!editing ? (
              <Pressable onPress={() => setEditing(true)} style={styles.editBtn} hitSlop={10}>
                <ThemedText style={styles.editBtnText}>{t('profile:edit')}</ThemedText>
              </Pressable>
            ) : (
              <View style={styles.heroActions}>
                <Pressable onPress={cancel} style={styles.heroActionGhost} hitSlop={8}>
                  <ThemedText style={styles.heroActionGhostText}>{t('profile:cancel')}</ThemedText>
                </Pressable>
                <Pressable
                  onPress={save}
                  disabled={saving}
                  style={[styles.heroActionPrimary, saving && styles.disabled]}
                  hitSlop={8}
                >
                  <ThemedText style={styles.heroActionPrimaryText}>
                    {saving ? t('profile:saving') : t('profile:save')}
                  </ThemedText>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* ACCOUNT DETAILS */}
        <ThemedView style={styles.card}>
          <Image source={images.wallet} style={styles.cardImage} contentFit="contain" />
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            {t('profile:accountDetails')}
          </ThemedText>

          {!editing ? (
            <View style={styles.rowBlock}>
              <Row label={t('profile:firstName')} value={user?.name ?? '-'} />
              <Row label={t('profile:lastName')} value={(user as any)?.surname ?? '-'} />
              <Row label={t('profile:phone')} value={(user as any)?.phone ?? '-'} />
              <Row label={t('profile:company')} value={(user as any)?.company ?? '-'} />
            </View>
          ) : (
            <View style={styles.formBlock}>
              <TextInput
                value={form.firstName}
                onChangeText={(v) => setForm((s) => ({ ...s, firstName: v }))}
                placeholder={t('profile:firstNamePlaceholder')}
                placeholderTextColor="#8b8b8b"
                style={styles.input}
                autoCapitalize="words"
              />
              <TextInput
                value={form.lastName}
                onChangeText={(v) => setForm((s) => ({ ...s, lastName: v }))}
                placeholder={t('profile:lastNamePlaceholder')}
                placeholderTextColor="#8b8b8b"
                style={styles.input}
                autoCapitalize="words"
              />
              <TextInput
                value={form.phone}
                onChangeText={(v) => setForm((s) => ({ ...s, phone: v }))}
                placeholder={t('profile:phonePlaceholder')}
                placeholderTextColor="#8b8b8b"
                style={styles.input}
                keyboardType="phone-pad"
              />
              <TextInput
                value={form.company}
                onChangeText={(v) => setForm((s) => ({ ...s, company: v }))}
                placeholder={t('profile:companyPlaceholder')}
                placeholderTextColor="#8b8b8b"
                style={styles.input}
              />
            </View>
          )}
        </ThemedView>

        {/* VEHICLE */}
        <ThemedView style={styles.card}>
          <Image source={images.houseIcon} style={styles.cardImageAlt} contentFit="contain" />
          <View style={styles.sectionHeaderRow}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              {t('profile:vehicle')}
            </ThemedText>

            {!editing ? (
              <View
                style={[
                  styles.statusPill,
                  form.available ? styles.statusPillOk : styles.statusPillBad,
                ]}
              >
                <ThemedText
                  style={[
                    styles.statusPillText,
                    form.available ? styles.statusTextOk : styles.statusTextBad,
                  ]}
                >
                  {availabilityLabel}
                </ThemedText>
              </View>
            ) : null}
          </View>

          {!editing ? (
            <View style={styles.rowBlock}>
              <Row label={t('profile:plate')} value={(user as any)?.vehiclePlate ?? '-'} />
              <Row label={t('profile:capacity')} value={String((user as any)?.capacity ?? '-')} />
              <Row
                label={t('profile:availability')}
                value={(user as any)?.available ? t('profile:available') : t('profile:unavailable')}
              />
            </View>
          ) : (
            <View style={styles.formBlock}>
              <TextInput
                value={form.vehiclePlate}
                onChangeText={(v) => setForm((s) => ({ ...s, vehiclePlate: v }))}
                placeholder={t('profile:vehiclePlatePlaceholder')}
                placeholderTextColor="#8b8b8b"
                style={styles.input}
                autoCapitalize="characters"
              />
              <TextInput
                value={form.capacity}
                onChangeText={(v) => setForm((s) => ({ ...s, capacity: v }))}
                placeholder={t('profile:capacityPlaceholder')}
                placeholderTextColor="#8b8b8b"
                style={styles.input}
                keyboardType="numeric"
              />

              <View style={styles.switchRow}>
                <ThemedText style={styles.switchLabel}>{t('profile:availableLabel')}</ThemedText>
                <Switch
                  value={form.available}
                  onValueChange={(v) => setForm((s) => ({ ...s, available: v }))}
                />
              </View>
            </View>
          )}
        </ThemedView>

        {/* SETTINGS */}
        <ThemedView style={styles.card}>
          <Image source={images.key} style={styles.cardImageAlt} contentFit="contain" />
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            {t('profile:appSettings')}
          </ThemedText>

          <View style={styles.row}>
            <ThemedText style={styles.rowLabel}>{t('profile:pushNotifications')}</ThemedText>
            <Switch value={pushEnabled} onValueChange={setPushEnabled} />
          </View>

          <View style={styles.row}>
            <ThemedText style={styles.rowLabel}>{t('profile:autoAccept')}</ThemedText>
            <Switch value={autoAccept} onValueChange={setAutoAccept} />
          </View>
        </ThemedView>

        {/* FOOTER ACTIONS (mobile-friendly) */}
        {editing ? (
          <View style={styles.footerActions}>
            <Pressable onPress={cancel} style={[styles.footerBtn, styles.footerBtnGhost]}>
              <ThemedText style={styles.footerBtnGhostText}>{t('profile:cancel')}</ThemedText>
            </Pressable>

            <Pressable
              onPress={save}
              disabled={saving}
              style={[styles.footerBtn, styles.footerBtnPrimary, saving && styles.disabled]}
            >
              <ThemedText style={styles.footerBtnPrimaryText}>
                {saving ? t('profile:saving') : t('profile:saveChanges')}
              </ThemedText>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0b0b' },
  content: { padding: 18, paddingBottom: 36 },

  hero: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    backgroundColor: '#0f0f0f',
    padding: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  heroImage: { position: 'absolute', right: -10, top: -10, width: 160, height: 160, opacity: 0.2 },

  heroHeader: { flexDirection: 'row', alignItems: 'center' },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#071025',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  headerText: { flex: 1 },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  email: { color: '#9aa0a6', marginTop: 4 },

  heroBadges: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#2b8cff20',
    borderWidth: 1,
    borderColor: '#2b8cff40',
    marginRight: 8,
    marginBottom: 6,
  },
  badgeText: { color: '#2b8cff', fontWeight: '800', fontSize: 11 },

  badgeMuted: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    marginBottom: 6,
  },
  badgeMutedText: { color: '#9aa0a6', fontWeight: '800', fontSize: 11 },

  editBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  editBtnText: { color: '#2b8cff', fontWeight: '800' },

  heroActions: { flexDirection: 'row', alignItems: 'center' },
  heroActionGhost: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#222',
    backgroundColor: '#0b0b0b',
    marginRight: 8,
  },
  heroActionGhostText: { color: '#cfcfcf', fontWeight: '800' },
  heroActionPrimary: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: '#2b8cff' },
  heroActionPrimaryText: { color: '#fff', fontWeight: '900' },

  card: {
    marginTop: 8,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222',
    backgroundColor: '#0f0f0f',
    overflow: 'hidden',
  },
  cardImage: { position: 'absolute', right: -10, top: -10, width: 120, height: 120, opacity: 0.12 },
  cardImageAlt: { position: 'absolute', right: -10, bottom: -10, width: 120, height: 120, opacity: 0.1 },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#cfcfcf', marginBottom: 8, fontWeight: '800' },

  rowBlock: { marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9 },
  rowLabel: { color: '#9aa0a6' },
  rowValue: { color: '#fff', fontWeight: '800', maxWidth: '55%', textAlign: 'right' },

  formBlock: { marginTop: 2 },
  input: {
    marginTop: 10,
    backgroundColor: '#0b0b0b',
    borderColor: '#222',
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    color: '#fff',
    fontFamily: 'ChairoSans',
  },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  switchLabel: { color: '#cfcfcf', fontWeight: '700' },

  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  statusPillOk: { backgroundColor: '#2b8cff20', borderColor: '#2b8cff40' },
  statusPillBad: { backgroundColor: '#ffffff10', borderColor: '#2a2a2a' },
  statusPillText: { fontSize: 11, fontWeight: '900' },
  statusTextOk: { color: '#9bbcff' },
  statusTextBad: { color: '#cfcfcf' },

  footerActions: { marginTop: 14, flexDirection: 'row' },
  footerBtn: { flex: 1, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  footerBtnGhost: { borderWidth: 1, borderColor: '#222', backgroundColor: '#0f0f0f', marginRight: 10 },
  footerBtnGhostText: { color: '#cfcfcf', fontWeight: '900' },
  footerBtnPrimary: { backgroundColor: '#2b8cff' },
  footerBtnPrimaryText: { color: '#fff', fontWeight: '900' },

  disabled: { opacity: 0.6 },
});
