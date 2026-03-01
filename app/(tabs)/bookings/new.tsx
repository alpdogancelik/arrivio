import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/components/auth-context";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

import { createBooking } from "@/api/bookings";
import { fetchFacilities } from "@/api/facilities";
import { fetchQueueEntries } from "@/api/queue-entries";
import { fetchStationRecommendation } from "@/api/recommendations";
import { fetchStations } from "@/api/stations";
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

const STATIC_STATIONS: Station[] = [
  // Gazimagusa Limani
  {
    id: "st-mg-g2",
    name: "Gumruk Kapisi 2 (Hizli Evrak)",
    facilityId: "fac-mg-01",
    facilityName: "Gazimagusa Limani - Ana Giris",
    baseLoad: 34,
  },
  {
    id: "st-mg-g1",
    name: "Gumruk Kapisi 1",
    facilityId: "fac-mg-01",
    facilityName: "Gazimagusa Limani - Ana Giris",
    baseLoad: 38,
  },
  {
    id: "st-mg-i1",
    name: "Gumruk Inceleme (Random Check)",
    facilityId: "fac-mg-01",
    facilityName: "Gazimagusa Limani - Ana Giris",
    baseLoad: 44,
  },

  // Lefkosa
  {
    id: "st-lk-g2",
    name: "Kapi B - Hizli Gecis",
    facilityId: "fac-lk-01",
    facilityName: "Lefkosa Sanayi Lojistik Parki",
    baseLoad: 22,
  },
  {
    id: "st-lk-g1",
    name: "Kapi A - Evrak Kontrol",
    facilityId: "fac-lk-01",
    facilityName: "Lefkosa Sanayi Lojistik Parki",
    baseLoad: 26,
  },
  {
    id: "st-lk-w1",
    name: "Tarti 1",
    facilityId: "fac-lk-01",
    facilityName: "Lefkosa Sanayi Lojistik Parki",
    baseLoad: 18,
  },

  // Girne
  {
    id: "st-gn-d1",
    name: "Depo Rampa 1",
    facilityId: "fac-gn-01",
    facilityName: "Girne Serbest B�lge Depo Kompleksi",
    baseLoad: 28,
  },

  // G�zelyurt
  {
    id: "st-gz-d1",
    name: "Soguk Hava Rampa",
    facilityId: "fac-gz-01",
    facilityName: "G�zelyurt Narenciye Y�kleme Sahasi",
    baseLoad: 30,
  },

  // Iskele
  {
    id: "st-is-w1",
    name: "Tarti - Transfer",
    facilityId: "fac-is-01",
    facilityName: "Iskele Bogaz Transfer Noktasi",
    baseLoad: 20,
  },
];

// Typed Routes ile garanti uyumlu path�ler
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

const makeSlots = (day: Date, startHour = 10, endHour = 18) => {
  const out: Date[] = [];
  // We generate *hourly* slots (e.g. "10-11") to match the recommendation model.
  // Using a full Date object keeps the UI flexible, while the backend receives a stable "HH-HH" label.
  for (let h = startHour; h < endHour; h++) {
    const d = new Date(day);
    d.setHours(h, 0, 0, 0);
    out.push(d);
  }

  // Bug�nse ge�mis slotlari ele
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

  // �operasyon ger�egi�: �glen g�mr�k/liman sikisir, 15:30 sonrasi toparlar
  const peak = hour >= 11 && hour <= 14 ? 10 : hour >= 15 && hour <= 17 ? 6 : 2;

  // tesis bazli ekstra baski
  const facilityBias =
    station.facilityId === "fac-mg-01" ? 4 : // Magusa limani daha volatil
      station.facilityId === "fac-gz-01" ? 2 : // soguk zincir rampasi
        0;

  const wobble = (tinyHash(`${station.id}-${slot.toISOString()}`) % 7) - 3; // -3..+3
  const raw = Math.round(station.baseLoad / 2 + peak + facilityBias + wobble);

  return Math.max(3, raw);
};

const toSlotLabel = (slot: Date) => {
  const start = slot.getHours();
  const end = (start + 1) % 24;
  return `${start}-${end}`;
};

export default function NewBookingScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useTranslation(["booking", "common"]);
  const { user } = useAuth();

  const params = useLocalSearchParams<{ facilityId?: string | string[] }>();
  const facilityIdParam = Array.isArray(params.facilityId) ? params.facilityId[0] : params.facilityId;
  const scopedFacilityId = facilityIdParam ? String(facilityIdParam) : undefined;

  const { data: facilitiesRaw } = useQuery({
    queryKey: queryKeys.facilities(),
    queryFn: fetchFacilities,
    staleTime: 60_000,
  });

  const { data: stationsRaw } = useQuery({
    queryKey: queryKeys.stations(scopedFacilityId),
    queryFn: () => fetchStations(scopedFacilityId),
    staleTime: 60_000,
  });

  const { data: queueRaw } = useQuery({
    queryKey: queryKeys.queueEntries(),
    queryFn: () => fetchQueueEntries(),
    staleTime: 30_000,
  });

  const facilities = useMemo(() => (Array.isArray(facilitiesRaw) ? facilitiesRaw : []), [facilitiesRaw]);
  const stationsFromDb = useMemo(() => (Array.isArray(stationsRaw) ? stationsRaw : []), [stationsRaw]);
  const queueEntries = useMemo(() => (Array.isArray(queueRaw) ? queueRaw : []), [queueRaw]);

  const facilityById = useMemo(() => new Map(facilities.map((facility) => [facility.id, facility])), [facilities]);

  const queueCountByStation = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of queueEntries) {
      if (!entry.stationId) continue;
      counts.set(entry.stationId, (counts.get(entry.stationId) ?? 0) + 1);
    }
    return counts;
  }, [queueEntries]);

  const stationCatalog = useMemo(() => {
    const fallback = scopedFacilityId
      ? STATIC_STATIONS.filter((station) => station.facilityId === scopedFacilityId)
      : STATIC_STATIONS;

    if (!stationsFromDb.length) return fallback;

    const defaultFacilityId = facilities.length === 1 ? facilities[0]?.id : undefined;

    return stationsFromDb.map((station) => {
      const resolvedFacilityId =
        station.facilityId && station.facilityId !== "unknown"
          ? station.facilityId
          : scopedFacilityId ?? defaultFacilityId ?? "unknown";
      const facilityName =
        facilityById.get(resolvedFacilityId)?.name ??
        facilityById.get(station.facilityId ?? "")?.name ??
        station.facilityId ??
        "Facility";
      const queueCount = queueCountByStation.get(station.id) ?? 0;
      const baseLoad = Math.max(12, 12 + queueCount * 6);

      return {
        id: station.id,
        name: station.name ?? station.id,
        facilityId: resolvedFacilityId,
        facilityName,
        baseLoad,
      };
    });
  }, [facilities, facilityById, queueCountByStation, scopedFacilityId, stationsFromDb]);

  const days = useMemo(() => makeDays(7), []);
  const [dayIdx, setDayIdx] = useState(0);

  const day = days[dayIdx];
  const slots = useMemo(() => makeSlots(day), [day]);

  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [userPickedStation, setUserPickedStation] = useState(false);

  const resolvedFacilityIdForReco = useMemo(() => {
    if (scopedFacilityId) return scopedFacilityId;
    if (facilities.length === 1) return facilities[0]?.id;
    return undefined;
  }, [facilities, scopedFacilityId]);

  const selectedArrivalIso = selectedSlot?.toISOString() ?? "";

  const { data: recoData, isFetching: isRecoFetching } = useQuery({
    queryKey: queryKeys.stationRecommendation(resolvedFacilityIdForReco, selectedArrivalIso),
    queryFn: () =>
      fetchStationRecommendation({
        facilityId: resolvedFacilityIdForReco,
        arrivalTime: selectedArrivalIso,
        slot: selectedSlot ? toSlotLabel(selectedSlot) : undefined,
      }),
    enabled: Boolean(selectedSlot),
    staleTime: 15_000,
  });

  const stationOptions = useMemo(() => {
    if (!selectedSlot) return [];
    if (recoData?.stations?.length) {
      const byId = new Map(stationCatalog.map((station) => [station.id, station] as const));
      return recoData.stations
        .map((rec) => {
          const station = byId.get(rec.stationId);
          const facilityId =
            station?.facilityId ?? rec.facilityId ?? resolvedFacilityIdForReco ?? "unknown";
          return {
            id: rec.stationId,
            name: station?.name ?? rec.stationName ?? rec.stationId,
            facilityId,
            facilityName: station?.facilityName ?? facilityById.get(facilityId)?.name ?? "Facility",
            baseLoad: station?.baseLoad ?? 0,
            wait: Math.max(0, Math.round(rec.predictedWaitMin)),
            score: rec.score,
            position: rec.predictedPosition,
          };
        })
        .sort((a, b) => a.wait - b.wait);
    }

    return stationCatalog
      .map((s) => ({
        ...s,
        wait: estimateWaitMin(s, selectedSlot),
      }))
      .sort((a, b) => a.wait - b.wait);
  }, [facilityById, recoData?.stations, resolvedFacilityIdForReco, selectedSlot, stationCatalog]);

  const recommended = useMemo(() => {
    if (!stationOptions.length) return null;
    if (recoData?.suggestedStationId) {
      return (
        stationOptions.find((item) => item.id === recoData.suggestedStationId) ?? stationOptions[0]
      );
    }
    return stationOptions[0];
  }, [recoData?.suggestedStationId, stationOptions]);

  const createMut = useMutation({
    mutationFn: createBooking,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.bookings() });
    },
  });

  const pickSlot = (d: Date) => {
    setSelectedSlot(d);
    setUserPickedStation(false);

    // slot se�ilince otomatik en iyi station'i default se�
    const best = stationCatalog
      .map((s) => ({ id: s.id, w: estimateWaitMin(s, d) }))
      .sort((a, b) => a.w - b.w)[0];

    setSelectedStationId(best?.id ?? null);
  };

  useEffect(() => {
    if (!selectedSlot) return;
    if (userPickedStation) return;

    const suggested = recoData?.suggestedStationId ?? null;
    if (!suggested) return;
    if (suggested === selectedStationId) return;

    setSelectedStationId(suggested);
  }, [recoData?.suggestedStationId, selectedSlot, selectedStationId, userPickedStation]);

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

    const station = stationCatalog.find((s) => s.id === stationId);
    const resolvedFacilityId =
      station?.facilityId && station.facilityId !== "unknown"
        ? station.facilityId
        : scopedFacilityId ?? facilities[0]?.id ?? "unknown";
    const facilityName = station?.facilityName ?? facilityById.get(resolvedFacilityId)?.name;

    try {
      const created: Booking = await createMut.mutateAsync({
        facilityId: resolvedFacilityId,
        stationId,
        facilityName,
        stationName: station?.name ?? undefined,
        arrivalTime: selectedSlot.toISOString(),
        slot: toSlotLabel(selectedSlot),
        recommendedStationId: recoData?.suggestedStationId ?? undefined,
        recommendedWaitMin: typeof stationOptions[0]?.wait === "number" ? stationOptions[0].wait : undefined,
        recommendations: recoData?.stations ?? undefined,
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
            {t("booking:newBookingSubtitle", { defaultValue: "Varis penceresini planla" })}
          </ThemedText>
        </View>

        <View style={{ width: 42 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ThemedView style={styles.hero}>
          <Image source={images.clock} style={styles.heroArt} contentFit="contain" />
          <ThemedText style={styles.heroTitle}>{t("booking:pickSlot", { defaultValue: "Saat se�" })}</ThemedText>
          <ThemedText style={styles.heroBody}>
            {t("booking:pickSlotHint", { defaultValue: "Tahmini kuyruga g�re en iyi kapiyi/istasyonu �neriyoruz." })}
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
              ? t("booking:noSlots", { defaultValue: "Bug�n i�in slot yok." })
              : t("booking:showingFirstSlots", { defaultValue: "Ilk 10 slot g�steriliyor." })}
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>
            {t("booking:recommendation", { defaultValue: "�neri" })}
          </ThemedText>

          {!selectedSlot ? (
            <ThemedView style={styles.emptyReco}>
              <Image source={images.hourglass} style={styles.emptyRecoArt} contentFit="contain" />
              <ThemedText style={styles.emptyRecoText}>
                {t("booking:chooseTimeHint", { defaultValue: "�neri g�rmek i�in �nce saat se�." })}
              </ThemedText>
            </ThemedView>
          ) : (
            <>
              <ThemedView style={styles.recoCard}>
                <Image source={images.statistics} style={styles.recoArt} contentFit="contain" />
                <View style={styles.recoLeft}>
                  <ThemedText style={styles.recoTitle}>{recommended?.name ?? "�"}</ThemedText>
                  <ThemedText style={styles.recoMeta}>
                    {recommended?.facilityName ?? "�"}
                  </ThemedText>
                  <ThemedText style={styles.recoSub}>
                    {isRecoFetching && selectedSlot && !recoData
                      ? t("booking:calculating", { defaultValue: "Hesaplanıyor..." })
                      : recommended
                        ? t("booking:estWait", { count: recommended.wait, defaultValue: `Tahmini bekleme: ${recommended.wait} dk` })
                        : "-"}
                  </ThemedText>
                </View>

                <View style={styles.bestPill}>
                  <ThemedText style={styles.bestPillText}>{t("booking:best", { defaultValue: "En iyi" })}</ThemedText>
                </View>
              </ThemedView>

              <ThemedText style={[styles.sectionLabel, { marginTop: 16 }]}>
                {t("booking:stations", { defaultValue: "Istasyonlar" })}
              </ThemedText>

              {stationOptions.map((s) => {
                const picked = selectedStationId === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => {
                      setUserPickedStation(true);
                      setSelectedStationId(s.id);
                    }}
                    style={[styles.stationRow, picked && styles.stationRowPicked]}
                  >
                    <View style={styles.stationLeft}>
                      <ThemedText style={styles.stationName}>{s.name}</ThemedText>
                      <ThemedText style={styles.stationMeta}>
                        {s.facilityName} � {t("booking:minEta", { count: s.wait, defaultValue: `${s.wait} dk tahmini varis zamani` })}
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
                {t("booking:confirmBookingLoading", { defaultValue: "Olusturuluyor..." })}
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
