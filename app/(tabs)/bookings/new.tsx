import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Href, Stack, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { fetchFacilities } from "@/api/facilities";
import { enterQueue, fetchStationsMM1ForSlotStart } from "@/api/MM1";
import { fetchStations } from "@/api/stations";
import { useAuth } from "@/components/auth-context";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { images } from "@/constants/images";
import { queryKeys } from "@/query/keys";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
// booking oluşturulduktan sonra gidecegi route
const ROUTES = {
  list: "/(tabs)/bookings" as const,
  detail: (id: string) =>
  ({
    pathname: "/(tabs)/bookings/[id]",
    params: { id },
  } as const),
};

const makeDays = (count = 7) => {
  const out: Date[] = [];
  const d0 = new Date();
  d0.setHours(0, 0, 0, 0); // Gün başlangıcına çekiyoruz ki karşılaştırmalar düzgün olsun.

  for (let i = 0; i < count; i++) {
    const d = new Date(d0);
    d.setDate(d0.getDate() + i);
    out.push(d);
  }

  return out;
};
// Seçilen gün için 15 dakikalık slotlar üretir
const makeSlots = (day: Date, startHour = 10, endHour = 18) => {
  const slots: Date[] = [];

  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += 15) {
      const d = new Date(day);
      d.setHours(h, m, 0, 0);
      slots.push(d);
    }
  }
  const now = new Date();
  // Eğer seçilen gün bugünse, geçmiş saatleri göstermiyoruz.
  if (day.toDateString() === now.toDateString()) {
    return slots.filter((x) => x.getTime() >= now.getTime() + 5 * 60 * 1000);
  }

  return slots;
};
//Slotu ekranda ve booking kaydında kullanmak için kısa etiketlere çevrildi
const toSlotLabel = (slot: Date) => {
  const hh = String(slot.getHours()).padStart(2, "0");
  const mm = String(slot.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const normalized = value.trim().replace(",", ".");
    const direct = Number(normalized);
    if (Number.isFinite(direct)) return direct;
    const matched = normalized.match(/-?\d+(\.\d+)?/);
    const parsed = matched ? Number(matched[0]) : Number.NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const formatWaitText = (waitMin: number | null) => {
  if (waitMin === null) return "Bekleme hesaplanamıyor";
  if (waitMin > 0 && waitMin < 1) return "1 dk'den az tahmini bekleme";
  return `${String(waitMin)} dk tahmini bekleme`;
};

const formatWaitShortText = (waitMin: number | null) => {
  if (waitMin === null) return "Bekleme hesaplanamıyor";
  if (waitMin > 0 && waitMin < 1) return "1 dk'den az bekleme";
  return `${String(waitMin)} dk bekleme`;
};

export default function NewBookingScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useTranslation(["booking", "common"]);
  const { user } = useAuth()
  const { data: facilitiesRaw } = useQuery({
    queryKey: queryKeys.facilities(),
    queryFn: fetchFacilities,
    staleTime: 60_000,
  });
  // Tum stationlar çekiliyor
  const { data: stationsRaw } = useQuery({
    queryKey: queryKeys.stations(),
    queryFn: () => fetchStations(),
    staleTime: 60_000,
  });
  const stations = useMemo(() => (Array.isArray(stationsRaw) ? stationsRaw : []), [stationsRaw]);
  const facilities = useMemo(() => (Array.isArray(facilitiesRaw) ? facilitiesRaw : []), [facilitiesRaw]);
  // tek facility olduğu için ilkini aldım (Bu kısım incelenebilir emin değilim)
  const facility = facilities[0] ?? null;
  // id->station map'i yapıyor
  const stationById = useMemo(
    () => new Map(stations.map((station) => [station.id, station] as const)),
    [stations]
  );
  // kullanıcıya gösterilecek 7 günlük liste
  const days = useMemo(() => makeDays(7), []);
  // hangi gün seçili
  const [dayIdx, setDayIdx] = useState(0);
  // seçilen slot
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [userPickedStation, setUserPickedStation] = useState(false);
  const selectedDay = days[dayIdx];
  const slots = useMemo(() => makeSlots(selectedDay), [selectedDay]);
  //cloud function'a gönderilecek başlangıç zamanı
  const slotStartIso = selectedSlot?.toISOString() ?? "";
  const slotKey = selectedSlot ? toSlotLabel(selectedSlot) : "";
  const slotEndIso = useMemo(() => {
    if (!selectedSlot) return "";
    const d = new Date(selectedSlot);
    d.setMinutes(d.getMinutes() + 15);
    return d.toISOString();
  }, [selectedSlot]);

  const {
    data: mm1Data,
    isFetching: mm1Loading,
    error: mm1Error,
  } = useQuery({
    enabled: Boolean(selectedSlot),
    queryKey: ["mm1StationsForSlot", slotStartIso, slotEndIso, slotKey],
    queryFn: () => fetchStationsMM1ForSlotStart({ slotStartIso, slotEndIso, slotKey }),
    staleTime: 60_000,
  });

  const stationOptions = useMemo(() => {
    const rows = mm1Data?.stations ?? [];

    const mapped = rows.map((row) => {
      const station = stationById.get(row.stationId);
      const rawWait = toFiniteNumber(row.approximatedWaitingTime);
      const lambda = toFiniteNumber(row.lambda) ?? 0;
      const mu = toFiniteNumber(row.mu) ?? 0;
      const rho = toFiniteNumber(row.rho) ?? 0;
      const waitMin =
        rawWait !== null
          ? Math.max(0, rawWait)
          : lambda <= 0
            ? 0
            : null;
      return {
        id: row.stationId,
        name: station?.name ?? row.stationId,
        facilityId: facility?.id ?? station?.facilityId ?? "unknown",
        facilityName: facility?.name ?? "Facility",
        waitMin,
        lambda,
        mu,
        rho,
      };
    });
    mapped.sort((a, b) => {
      const wa = a.waitMin ?? Number.POSITIVE_INFINITY;
      const wb = b.waitMin ?? Number.POSITIVE_INFINITY;
      return wa - wb;
    });
    return mapped;
  }, [mm1Data?.stations, facility, stationById]);

  const bestStationId = useMemo(() => {
    // Prefer the station with the lowest computed wait time (including 0 min).
    const bestByWait = stationOptions.find((s) => s.waitMin !== null)?.id ?? null;
    return bestByWait ?? mm1Data?.bestStationId ?? stationOptions[0]?.id ?? null;
  }, [mm1Data?.bestStationId, stationOptions]);
  // kullanıcıya önerilicek olan station
  const recommendedStation = useMemo(() => {
    if (!bestStationId) return null;
    return stationOptions.find((s) => s.id === bestStationId) ?? null;
  }, [bestStationId, stationOptions]);
  // backedn'in önerdiği en iyi station'ın otomatik olarak seçilmesi
  useEffect(() => {
    if (!selectedSlot) return;
    if (userPickedStation) return;
    if (!bestStationId) return;
    if (selectedStationId === bestStationId) return;

    setSelectedStationId(bestStationId);
  }, [bestStationId, selectedSlot, selectedStationId, userPickedStation]);

  const createMut = useMutation({
    mutationFn: enterQueue,
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.bookings() }),
        qc.invalidateQueries({ queryKey: queryKeys.queueEntries() }),
      ]);
    },
  });

  const pickSlot = (slot: Date) => {
    setSelectedSlot(slot);
    setSelectedStationId(null);
    setUserPickedStation(false);
  };

  const onConfirm = async () => {
    if (!user) {
      Alert.alert(
        t("booking:signInRequired", { defaultValue: "Sign-in required" }),
        t("booking:signInRequiredBody", {
          defaultValue: "Please sign in to create a booking.",
        })
      );
      return;
    }
    if (!selectedSlot) {
      Alert.alert(
        t("booking:selectTime", { defaultValue: "Select a time" }),
        t("booking:selectTimeBody", {
          defaultValue: "Pick an arrival slot to continue.",
        })
      );
      return;
    }
    const stationId = selectedStationId;
    if (!stationId) {
      Alert.alert(
        t("booking:selectStation", { defaultValue: "Select a station" }),
        t("booking:selectStationBody", {
          defaultValue: "Choose a station to continue.",
        })
      );
      return;
    }
    const slotStart = selectedSlot.toISOString();
    const slotEndDate = new Date(selectedSlot);
    slotEndDate.setMinutes(slotEndDate.getMinutes() + 15);
    const slotEnd = slotEndDate.toISOString();
    try {
      const created = await createMut.mutateAsync({
        carrierId: user.id,
        stationId,
        slotStart,
        slotEnd,
        slotKey,
      });
      Alert.alert(
        t("booking:bookingCreatedTitle", { defaultValue: "Booking created" }),
        t("booking:bookingCreatedBody", {
          defaultValue: "Booking and queue entry have been created.",
        })
      );
      const bookingId = created?.bookingId ? String(created.bookingId) : null;
      const href: Href = bookingId
        ? (ROUTES.detail(bookingId) as unknown as Href)
        : (ROUTES.list as unknown as Href);

      router.replace(href);

    } catch (err) {
      Alert.alert(
        t("booking:bookingFailed", { defaultValue: "Booking failed" })
      );
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
            {t("booking:newBookingSubtitle", {
              defaultValue: "Varış zamanını planla",
            })}
          </ThemedText>
        </View>

        <View style={{ width: 42 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ThemedView style={styles.hero}>
          <Image source={images.clock} style={styles.heroArt} contentFit="contain" />
          <ThemedText style={styles.heroTitle}>
            {t("booking:pickSlot", { defaultValue: "Saat seç" })}
          </ThemedText>
          <ThemedText style={styles.heroBody}>
            {t("booking:pickSlotHint", {
              defaultValue:
                "Seçtiğin 15 dakikalık slota göre stationları bekleme süresine göre sıralıyoruz.",
            })}
          </ThemedText>
        </ThemedView>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>
            {t("booking:selectDate", { defaultValue: "Tarih" })}
          </ThemedText>

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
                    setUserPickedStation(false);
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
            {slots.map((d) => {
              const selected = selectedSlot?.getTime() === d.getTime();

              const label = d.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              });

              return (
                <Pressable
                  key={d.toISOString()}
                  onPress={() => pickSlot(d)}
                  style={[styles.timeChip, selected && styles.timeChipSelected]}
                >
                  <ThemedText style={[styles.timeText, selected && styles.timeTextSelected]}>
                    {label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <ThemedText style={styles.hint}>
            {slots.length === 0
              ? t("booking:noSlots", { defaultValue: "Bugün için uygun slot kalmadı." })
              : t("booking:slotEvery15Min", {
                defaultValue: "Slotlar 15 dakika aralıklarla gösteriliyor.",
              })}
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
                {t("booking:chooseTimeHint", {
                  defaultValue: "Öneri görmek için önce bir saat seç.",
                })}
              </ThemedText>
            </ThemedView>
          ) : mm1Loading && !mm1Data ? (
            <ThemedView style={styles.emptyReco}>
              <ActivityIndicator color="#2b8cff" />
              <ThemedText style={[styles.emptyRecoText, { marginTop: 10 }]}>
                {t("booking:calculating", { defaultValue: "Hesaplanıyor..." })}
              </ThemedText>
            </ThemedView>
          ) : mm1Error ? (
            <ThemedView style={styles.emptyReco}>
              <Image source={images.alarm} style={styles.emptyRecoArt} contentFit="contain" />
              <ThemedText style={styles.emptyRecoText}>
                {mm1Error instanceof Error
                  ? mm1Error.message
                  : t("common:unexpectedError", { defaultValue: "Beklenmeyen hata" })}
              </ThemedText>
            </ThemedView>
          ) : (
            <>
              <ThemedView style={styles.recoCard}>
                <Image source={images.statistics} style={styles.recoArt} contentFit="contain" />
                <View style={styles.recoLeft}>
                  <ThemedText style={styles.recoTitle}>
                    {recommendedStation?.name ?? "-"}
                  </ThemedText>

                  <ThemedText style={styles.recoSub}>
                    {formatWaitText(recommendedStation?.waitMin ?? null)}
                  </ThemedText>
                </View>

                <View style={styles.bestPill}>
                  <ThemedText style={styles.bestPillText}>
                    {t("booking:best", { defaultValue: "BEST" })}
                  </ThemedText>
                </View>
              </ThemedView>

              <ThemedText style={[styles.sectionLabel, { marginTop: 16 }]}>
                {t("booking:stations", { defaultValue: "İstasyonlar" })}
              </ThemedText>

              {stationOptions.map((s) => {
                const picked = selectedStationId === s.id;
                const isBest = s.id === bestStationId;

                return (
                  <Pressable
                    key={s.id}
                    onPress={() => {
                      setUserPickedStation(true);
                      setSelectedStationId(s.id);
                    }}
                    style={[
                      styles.stationRow,
                      picked && styles.stationRowPicked,
                      isBest && styles.stationRowBest,
                    ]}
                  >
                    <View style={styles.stationLeft}>
                      <View style={styles.stationTitleRow}>
                        <ThemedText style={styles.stationName}>{s.name}</ThemedText>

                        {isBest ? (
                          <View style={styles.bestBadge}>
                            <ThemedText style={styles.bestBadgeText}>BEST</ThemedText>
                          </View>
                        ) : null}
                      </View>

                      <ThemedText style={styles.stationMeta}>
                        {typeof s.waitMin === "number"
                          ? `${formatWaitShortText(s.waitMin)} • ρ=${s.rho.toFixed(2)}`
                          : `Bekleme hesaplanamıyor • ρ=${s.rho.toFixed(2)}`}
                      </ThemedText>
                      {typeof s.waitMin === "number" && s.waitMin > 0 && s.waitMin < 1 ? (
                        <ThemedText style={styles.stationMetaFine}>
                          {`Tahmini: ${s.waitMin.toFixed(2)} dk`}
                        </ThemedText>
                      ) : null}
                    </View>

                    {picked ? (
                      <View style={styles.check}>
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      </View>
                    ) : isBest ? (
                      <Ionicons name="sparkles" size={18} color="#2b8cff" />
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
          disabled={!selectedSlot || !selectedStationId || createMut.isPending}
          style={[
            styles.confirmBtn,
            (!selectedSlot || !selectedStationId || createMut.isPending) &&
            styles.confirmBtnDisabled,
          ]}
        >
          {createMut.isPending ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#fff" />
              <ThemedText style={styles.confirmText}>
                {t("booking:confirmBookingLoading", {
                  defaultValue: "Oluşturuluyor...",
                })}
              </ThemedText>
            </View>
          ) : (
            <ThemedText style={styles.confirmText}>
              {t("booking:confirmBooking", {
                defaultValue: "Rezervasyonu onayla",
              })}
            </ThemedText>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050505" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
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
  heroArt: {
    position: "absolute",
    right: -12,
    top: -12,
    width: 160,
    height: 160,
    opacity: 0.16,
  },
  heroTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  heroBody: { color: "#9aa0a6", marginTop: 8, fontSize: 13, maxWidth: "82%" },

  section: { marginTop: 18 },
  sectionLabel: {
    color: "#6b6b6b",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 10,
  },

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
  recoArt: {
    position: "absolute",
    right: -14,
    top: -14,
    width: 160,
    height: 160,
    opacity: 0.12,
  },
  recoLeft: { flex: 1 },
  recoTitle: { color: "#fff", fontSize: 16, fontWeight: "900" },
  recoSub: { color: "#2b8cff", marginTop: 8, fontWeight: "900" },
  bestPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#2b8cff22",
    borderWidth: 1,
    borderColor: "#2b8cff44",
  },
  bestPillText: {
    color: "#2b8cff",
    fontWeight: "900",
    letterSpacing: 1,
    fontSize: 10,
  },

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
  stationRowPicked: {
    borderColor: "#2b8cff",
    backgroundColor: "#2b8cff22",
  },
  stationRowBest: {
    borderColor: "#2b8cff",
    backgroundColor: "#2b8cff14",
  },
  stationLeft: { flex: 1, paddingRight: 12 },
  stationTitleRow: { flexDirection: "row", alignItems: "center" },
  stationName: { color: "#fff", fontWeight: "900" },
  stationMeta: { color: "#9aa0a6", marginTop: 6, fontWeight: "700" },
  stationMetaFine: { color: "#6f7680", marginTop: 4, fontSize: 12, fontWeight: "600" },
  bestBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#2b8cff22",
    borderWidth: 1,
    borderColor: "#2b8cff44",
  },
  bestBadgeText: {
    color: "#2b8cff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: "#2b8cff",
    alignItems: "center",
    justifyContent: "center",
  },

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
  confirmBtn: {
    height: 58,
    borderRadius: 18,
    backgroundColor: "#2b8cff",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnDisabled: { backgroundColor: "#1a1a1a" },
  confirmText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
    marginLeft: 10,
  },
  loadingRow: { flexDirection: "row", alignItems: "center" },
});
