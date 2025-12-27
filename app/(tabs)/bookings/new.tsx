import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Stack, useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/components/auth-context";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

import { createBooking } from "@/api/bookings";
import type { Booking } from "@/types/api";
import { mapApiError } from "@/api/errors";
import { queryKeys } from "@/query/keys";
import { images } from "@/constants/images";

type Station = {
  id: string;
  name: string;
  facilityId: string;
  facilityName: string;
  baseLoad: number;
};

const STATIONS: Station[] = [
  // Gazimağusa Limanı
  {
    id: "st-mg-g2",
    name: "Gümrük Kapısı 2 (Hızlı Evrak)",
    facilityId: "fac-mg-01",
    facilityName: "Gazimağusa Limanı - Ana Giriş",
    baseLoad: 34,
  },
  {
    id: "st-mg-g1",
    name: "Gümrük Kapısı 1",
    facilityId: "fac-mg-01",
    facilityName: "Gazimağusa Limanı - Ana Giriş",
    baseLoad: 38,
  },
  {
    id: "st-mg-i1",
    name: "Gümrük İnceleme (Random Check)",
    facilityId: "fac-mg-01",
    facilityName: "Gazimağusa Limanı - Ana Giriş",
    baseLoad: 44,
  },

  // Lefkoşa
  {
    id: "st-lk-g2",
    name: "Kapı B - Hızlı Geçiş",
    facilityId: "fac-lk-01",
    facilityName: "Lefkoşa Sanayi Lojistik Parkı",
    baseLoad: 22,
  },
  {
    id: "st-lk-g1",
    name: "Kapı A - Evrak Kontrol",
    facilityId: "fac-lk-01",
    facilityName: "Lefkoşa Sanayi Lojistik Parkı",
    baseLoad: 26,
  },
  {
    id: "st-lk-w1",
    name: "Tartı 1",
    facilityId: "fac-lk-01",
    facilityName: "Lefkoşa Sanayi Lojistik Parkı",
    baseLoad: 18,
  },

  // Girne
  {
    id: "st-gn-d1",
    name: "Depo Rampa 1",
    facilityId: "fac-gn-01",
    facilityName: "Girne Serbest Bölge Depo Kompleksi",
    baseLoad: 28,
  },

  // Güzelyurt
  {
    id: "st-gz-d1",
    name: "Soğuk Hava Rampa",
    facilityId: "fac-gz-01",
    facilityName: "Güzelyurt Narenciye Yükleme Sahası",
    baseLoad: 30,
  },

  // İskele
  {
    id: "st-is-w1",
    name: "Tartı - Transfer",
    facilityId: "fac-is-01",
    facilityName: "İskele Boğaz Transfer Noktası",
    baseLoad: 20,
  },
];

// Typed Routes ile garanti uyumlu path’ler
const ROUTES = {
  list: "/(tabs)/bookings" as const,
  new: "/(tabs)/bookings/new" as const,
  detail: (id: string) =>
  ({
    pathname: "/(tabs)/bookings/[id]",
    params: { id },
  } as const),
};

const makeDays = (count = 7) => {
  const out: Date[] = [];
  const d0 = new Date();
  d0.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(d0);
    d.setDate(d0.getDate() + i);
    out.push(d);
  }
  return out;
};

const makeSlots = (day: Date, startHour = 10, endHour = 18, stepMin = 30) => {
  const out: Date[] = [];
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += stepMin) {
      if (h === endHour && m > 0) continue;
      const d = new Date(day);
      d.setHours(h, m, 0, 0);
      out.push(d);
    }
  }

  // Bugünse geçmiş slotları ele
  const now = new Date();
  if (day.toDateString() === now.toDateString()) {
    return out.filter((x) => x.getTime() >= now.getTime() + 5 * 60 * 1000);
  }
  return out;
};

const tinyHash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

const estimateWaitMin = (station: Station, slot: Date) => {
  const hour = slot.getHours();

  // “operasyon gerçeği”: öğlen gümrük/liman sıkışır, 15:30 sonrası toparlar
  const peak = hour >= 11 && hour <= 14 ? 10 : hour >= 15 && hour <= 17 ? 6 : 2;

  // tesis bazlı ekstra baskı
  const facilityBias =
    station.facilityId === "fac-mg-01" ? 4 : // Mağusa limanı daha volatil
      station.facilityId === "fac-gz-01" ? 2 : // soğuk zincir rampası
        0;

  const wobble = (tinyHash(`${station.id}-${slot.toISOString()}`) % 7) - 3; // -3..+3
  const raw = Math.round(station.baseLoad / 2 + peak + facilityBias + wobble);

  return Math.max(3, raw);
};

export default function NewBookingScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useTranslation(["booking", "common"]);
  const { user } = useAuth();

  const days = useMemo(() => makeDays(7), []);
  const [dayIdx, setDayIdx] = useState(0);

  const day = days[dayIdx];
  const slots = useMemo(() => makeSlots(day), [day]);

  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);

  const stationOptions = useMemo(() => {
    if (!selectedSlot) return [];
    return STATIONS.map((s) => ({
      ...s,
      wait: estimateWaitMin(s, selectedSlot),
    })).sort((a, b) => a.wait - b.wait);
  }, [selectedSlot]);

  const recommended = stationOptions[0] ?? null;

  const createMut = useMutation({
    mutationFn: createBooking,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.bookings() });
    },
  });

  const pickSlot = (d: Date) => {
    setSelectedSlot(d);

    // slot seçilince otomatik en iyi station'ı default seç
    const best = STATIONS
      .map((s) => ({ id: s.id, w: estimateWaitMin(s, d) }))
      .sort((a, b) => a.w - b.w)[0];

    setSelectedStationId(best?.id ?? null);
  };

  const onConfirm = async () => {
    if (!user) {
      Alert.alert(
        t("booking:signInRequired", { defaultValue: "Sign-in required" }),
        t("booking:signInRequiredBody", { defaultValue: "Please sign in to create a booking." }),
      );
      return;
    }
    if (!selectedSlot) {
      Alert.alert(
        t("booking:selectTime", { defaultValue: "Select a time" }),
        t("booking:selectTimeBody", { defaultValue: "Pick an arrival slot to continue." }),
      );
      return;
    }

    const stationId = selectedStationId ?? recommended?.id;
    if (!stationId) {
      Alert.alert(
        t("booking:selectStation", { defaultValue: "Select a station" }),
        t("booking:selectStationBody", { defaultValue: "Choose a station to continue." }),
      );
      return;
    }

    const station = STATIONS.find((s) => s.id === stationId);
    const facilityId = station?.facilityId ?? "fac-lk-01";

    try {
      const created: Booking = await createMut.mutateAsync({
        facilityId,
        stationId,
        arrivalTime: selectedSlot.toISOString(),
        notes: undefined,
      });

      const newId = (created as any)?.id ? String((created as any).id) : null;

      Alert.alert(
        t("booking:bookingCreatedTitle", { defaultValue: "Booking created" }),
        t("booking:bookingCreatedBody", { defaultValue: "Your booking has been saved." }),
      );

      const href: Href = newId
        ? (ROUTES.detail(newId) as unknown as Href)
        : (ROUTES.list as unknown as Href);

      router.replace(href);
    } catch (e) {
      const err = mapApiError(e);
      Alert.alert(t("booking:bookingFailed", { defaultValue: "Booking failed" }), err.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>

        <View style={styles.headerCenter}>
          <ThemedText style={styles.headerTitle}>
            {t("booking:newBookingTitle", { defaultValue: "Yeni rezervasyon" })}
          </ThemedText>
          <ThemedText style={styles.headerSub}>
            {t("booking:newBookingSubtitle", { defaultValue: "Varış penceresini planla" })}
          </ThemedText>
        </View>

        <View style={{ width: 42 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ThemedView style={styles.hero}>
          <Image source={images.clock} style={styles.heroArt} contentFit="contain" />
          <ThemedText style={styles.heroTitle}>{t("booking:pickSlot", { defaultValue: "Saat seç" })}</ThemedText>
          <ThemedText style={styles.heroBody}>
            {t("booking:pickSlotHint", { defaultValue: "Tahmini kuyruğa göre en iyi kapıyı/istasyonu öneriyoruz." })}
          </ThemedText>
        </ThemedView>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>{t("booking:selectDate", { defaultValue: "Tarih" })}</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {days.map((d, idx) => {
              const selected = idx === dayIdx;
              return (
                <Pressable
                  key={d.toISOString()}
                  onPress={() => {
                    setDayIdx(idx);
                    setSelectedSlot(null);
                    setSelectedStationId(null);
                  }}
                  style={[styles.dayChip, selected && styles.dayChipSelected]}
                >
                  <ThemedText style={[styles.dayDow, selected && styles.dayTextSelected]}>
                    {d.toLocaleDateString(undefined, { weekday: "short" })}
                  </ThemedText>
                  <ThemedText style={[styles.dayNum, selected && styles.dayTextSelected]}>
                    {d.getDate()}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>
            {t("booking:availableTimes", { defaultValue: "Uygun saatler" })}
          </ThemedText>

          <View style={styles.grid}>
            {slots.slice(0, 10).map((d) => {
              const selected = selectedSlot?.getTime() === d.getTime();
              const label = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
              return (
                <Pressable
                  key={d.toISOString()}
                  onPress={() => pickSlot(d)}
                  style={[styles.timeChip, selected && styles.timeChipSelected]}
                >
                  <ThemedText style={[styles.timeText, selected && styles.timeTextSelected]}>{label}</ThemedText>
                </Pressable>
              );
            })}
          </View>

          <ThemedText style={styles.hint}>
            {slots.length === 0
              ? t("booking:noSlots", { defaultValue: "Bugün için slot yok." })
              : t("booking:showingFirstSlots", { defaultValue: "İlk 10 slot gösteriliyor." })}
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>
            {t("booking:recommendation", { defaultValue: "Öneri" })}
          </ThemedText>

          {!selectedSlot ? (
            <ThemedView style={styles.emptyReco}>
              <Image source={images.hourglass} style={styles.emptyRecoArt} contentFit="contain" />
              <ThemedText style={styles.emptyRecoText}>
                {t("booking:chooseTimeHint", { defaultValue: "Öneri görmek için önce saat seç." })}
              </ThemedText>
            </ThemedView>
          ) : (
            <>
              <ThemedView style={styles.recoCard}>
                <Image source={images.statistics} style={styles.recoArt} contentFit="contain" />
                <View style={styles.recoLeft}>
                  <ThemedText style={styles.recoTitle}>{recommended?.name ?? "—"}</ThemedText>
                  <ThemedText style={styles.recoMeta}>
                    {recommended?.facilityName ?? "—"}
                  </ThemedText>
                  <ThemedText style={styles.recoSub}>
                    {recommended
                      ? t("booking:estWait", { count: recommended.wait, defaultValue: `Tahmini bekleme: ${recommended.wait} dk` })
                      : "-"}
                  </ThemedText>
                </View>

                <View style={styles.bestPill}>
                  <ThemedText style={styles.bestPillText}>{t("booking:best", { defaultValue: "En iyi" })}</ThemedText>
                </View>
              </ThemedView>

              <ThemedText style={[styles.sectionLabel, { marginTop: 16 }]}>
                {t("booking:stations", { defaultValue: "İstasyonlar" })}
              </ThemedText>

              {stationOptions.map((s) => {
                const picked = selectedStationId === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => setSelectedStationId(s.id)}
                    style={[styles.stationRow, picked && styles.stationRowPicked]}
                  >
                    <View style={styles.stationLeft}>
                      <ThemedText style={styles.stationName}>{s.name}</ThemedText>
                      <ThemedText style={styles.stationMeta}>
                        {s.facilityName} • {t("booking:minEta", { count: s.wait, defaultValue: `${s.wait} dk tahmini varış zamanı` })}
                      </ThemedText>
                    </View>

                    {picked ? (
                      <View style={styles.check}>
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      </View>
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color="#555" />
                    )}
                  </Pressable>
                );
              })}
            </>
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={onConfirm}
          disabled={!selectedSlot || createMut.isPending}
          style={[styles.confirmBtn, (!selectedSlot || createMut.isPending) && styles.confirmBtnDisabled]}
        >
          {createMut.isPending ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#fff" />
              <ThemedText style={styles.confirmText}>
                {t("booking:confirmBookingLoading", { defaultValue: "Oluşturuluyor..." })}
              </ThemedText>
            </View>
          ) : (
            <ThemedText style={styles.confirmText}>
              {t("booking:confirmBooking", { defaultValue: "Rezervasyonu onayla" })}
            </ThemedText>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050505" },

  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  headerSub: { color: "#666", fontSize: 12, marginTop: 2 },

  scroll: { paddingHorizontal: 18, paddingBottom: 20 },

  hero: {
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#1a1a1a",
    backgroundColor: "#0f0f0f",
    overflow: "hidden",
  },
  heroArt: { position: "absolute", right: -12, top: -12, width: 160, height: 160, opacity: 0.16 },
  heroTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  heroBody: { color: "#9aa0a6", marginTop: 8, fontSize: 13, maxWidth: "82%" },

  section: { marginTop: 18 },
  sectionLabel: { color: "#6b6b6b", fontSize: 12, fontWeight: "900", letterSpacing: 1, marginBottom: 10 },

  dayChip: {
    width: 66,
    height: 82,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
  },
  dayChipSelected: { backgroundColor: "#2b8cff", borderColor: "#2b8cff" },
  dayDow: { color: "#6b6b6b", fontWeight: "800" },
  dayNum: { color: "#fff", fontSize: 20, fontWeight: "900", marginTop: 4 },
  dayTextSelected: { color: "#fff" },

  grid: { flexDirection: "row", flexWrap: "wrap" },
  timeChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#1a1a1a",
    marginRight: 10,
    marginBottom: 10,
  },
  timeChipSelected: { backgroundColor: "#2b8cff", borderColor: "#2b8cff" },
  timeText: { color: "#fff", fontWeight: "800" },
  timeTextSelected: { color: "#fff" },
  hint: { color: "#404040", marginTop: 2, fontSize: 12 },

  emptyReco: {
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#242424",
    backgroundColor: "#0f0f0f",
    alignItems: "center",
  },
  emptyRecoArt: { width: 84, height: 84, opacity: 0.35, marginBottom: 10 },
  emptyRecoText: { color: "#777", textAlign: "center", fontWeight: "700" },

  recoCard: {
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#1a1a1a",
    backgroundColor: "#0f0f0f",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
  },
  recoArt: { position: "absolute", right: -14, top: -14, width: 160, height: 160, opacity: 0.12 },
  recoLeft: { flex: 1 },
  recoTitle: { color: "#fff", fontSize: 16, fontWeight: "900" },
  recoMeta: { color: "#9aa0a6", marginTop: 6, fontWeight: "700" },
  recoSub: { color: "#2b8cff", marginTop: 8, fontWeight: "900" },
  bestPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: "#2b8cff22", borderWidth: 1, borderColor: "#2b8cff44" },
  bestPillText: { color: "#2b8cff", fontWeight: "900", letterSpacing: 1, fontSize: 10 },

  stationRow: {
    marginTop: 10,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#1a1a1a",
    backgroundColor: "#111",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stationRowPicked: { borderColor: "#2b8cff", backgroundColor: "#2b8cff22" },
  stationLeft: { flex: 1, paddingRight: 12 },
  stationName: { color: "#fff", fontWeight: "900" },
  stationMeta: { color: "#9aa0a6", marginTop: 6, fontWeight: "700" },
  check: { width: 22, height: 22, borderRadius: 999, backgroundColor: "#2b8cff", alignItems: "center", justifyContent: "center" },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingBottom: 24,
    paddingTop: 12,
    backgroundColor: "rgba(5,5,5,0.96)",
  },
  confirmBtn: { height: 58, borderRadius: 18, backgroundColor: "#2b8cff", alignItems: "center", justifyContent: "center" },
  confirmBtnDisabled: { backgroundColor: "#1a1a1a" },
  confirmText: { color: "#fff", fontWeight: "900", fontSize: 16, marginLeft: 10 },
  loadingRow: { flexDirection: "row", alignItems: "center" },
});
