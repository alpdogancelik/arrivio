import React, { useMemo } from "react";
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

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

import { fetchBooking, cancelBooking } from "@/api/bookings";
import { fetchFacilities } from "@/api/facilities";
import { fetchStationRecommendation } from "@/api/recommendations";
import { fetchStations } from "@/api/stations";
import { fetchIssues } from "@/api/issues";
import { fetchQueueEntries } from "@/api/queue-entries";
import { mapApiError } from "@/api/errors";
import { queryKeys } from "@/query/keys";
import { images } from "@/constants/images";

const isApiBaseUrlError = (err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return msg.toLowerCase().includes("api_base_url");
};

const tone = (status?: string) => {
  switch ((status ?? "").toLowerCase()) {
    case "confirmed":
    case "arrived":
      return { fg: "#22c55e", bg: "#22c55e22", bd: "#22c55e44" };
    case "pending":
      return { fg: "#facc15", bg: "#facc1522", bd: "#facc1544" };
    case "cancelled":
      return { fg: "#ef4444", bg: "#ef444422", bd: "#ef444444" };
    default:
      return { fg: "#2b8cff", bg: "#2b8cff22", bd: "#2b8cff44" };
  }
};

const formatWhen = (iso?: string) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatSlot = (slot?: string) => (typeof slot === "string" && slot.trim() ? slot.trim() : null);

export default function BookingDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useTranslation(["booking", "common"]);

  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const bookingId = id ? String(id) : "";

  const { data, isLoading, error, refetch } = useQuery({
    enabled: !!bookingId,
    queryKey: queryKeys.booking(bookingId),
    queryFn: () => fetchBooking(bookingId),
  });

  const { data: facilitiesRaw } = useQuery({
    queryKey: queryKeys.facilities(),
    queryFn: fetchFacilities,
    staleTime: 60_000,
  });

  const { data: stationsRaw } = useQuery({
    queryKey: queryKeys.stations(),
    queryFn: () => fetchStations(),
    staleTime: 60_000,
  });

  const cancelMut = useMutation({
    mutationFn: (bid: string) => cancelBooking(bid),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.booking(bookingId) }),
        qc.invalidateQueries({ queryKey: queryKeys.bookings() }),
      ]);
      Alert.alert(t("booking:bookingCancelledTitle"), t("booking:bookingCancelledBody"));
      router.replace("/(tabs)/bookings" as Href);
    },
    onError: (e) => {
      const err = mapApiError(e);
      Alert.alert(t("booking:cancelFailed"), err.message);
    },
  });

  const confirmCancel = () => {
    Alert.alert(t("booking:cancelBooking"), t("booking:cancelBookingConfirm"), [
      { text: t("common:no"), style: "cancel" },
      {
        text: t("booking:cancelBookingConfirmCta"),
        style: "destructive",
        onPress: () => bookingId && cancelMut.mutate(bookingId),
      },
    ]);
  };

  const facilities = useMemo(() => (Array.isArray(facilitiesRaw) ? facilitiesRaw : []), [facilitiesRaw]);
  const stations = useMemo(() => (Array.isArray(stationsRaw) ? stationsRaw : []), [stationsRaw]);
  const facilityById = useMemo(() => new Map(facilities.map((facility) => [facility.id, facility])), [facilities]);
  const stationById = useMemo(() => new Map(stations.map((station) => [station.id, station])), [stations]);

  const booking = useMemo(() => {
    if (!data) return null;
    const station = stationById.get(data.stationId ?? "");
    const resolvedFacilityId = data.facilityId ?? station?.facilityId;

    return {
      ...data,
      facilityId: resolvedFacilityId,
      facilityName:
        data.facilityName ?? facilityById.get(resolvedFacilityId ?? "")?.name ?? station?.facilityId,
      stationName: data.stationName ?? station?.name,
    };
  }, [data, facilityById, stationById]);

  const resolvedFacilityId = booking?.facilityId;
  const badge = tone(booking?.status);
  const bookingShortId = String(booking?.id ?? bookingId).slice(-6).toUpperCase();
  const arrivalOrSlot = String(booking?.arrivalTime ?? booking?.slot ?? "");

  const { data: recoData } = useQuery({
    enabled: Boolean(booking && resolvedFacilityId && arrivalOrSlot),
    queryKey: queryKeys.stationRecommendation(resolvedFacilityId, arrivalOrSlot),
    queryFn: () =>
      fetchStationRecommendation({
        facilityId: resolvedFacilityId,
        arrivalTime: arrivalOrSlot,
      }),
    staleTime: 30_000,
  });

  const { data: issuesRaw } = useQuery({
    enabled: Boolean(booking?.id),
    queryKey: queryKeys.issues({ bookingId: String(booking?.id ?? "") }),
    queryFn: () => fetchIssues({ bookingId: String(booking?.id ?? "") }),
    staleTime: 30_000,
  });

  const { data: queueEntriesRaw } = useQuery({
    enabled: Boolean(booking?.id),
    queryKey: queryKeys.queueEntries({ bookingId: String(booking?.id ?? "") }),
    queryFn: () => fetchQueueEntries({ bookingId: String(booking?.id ?? "") }),
    staleTime: 15_000,
  });

  const issues = Array.isArray(issuesRaw) ? issuesRaw : [];
  const queueEntries = Array.isArray(queueEntriesRaw) ? queueEntriesRaw : [];
  const latestQueueEntry = queueEntries
    .slice()
    .sort((a: any, b: any) => {
      const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    })[0];

  if (!bookingId) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <ThemedText style={styles.headerTitle}>{t("booking:bookingDetails")}</ThemedText>
          <View style={{ width: 42 }} />
        </View>

        <ThemedView style={styles.stateCard}>
          <Image source={images.alarm} style={styles.stateArt} contentFit="contain" />
          <ThemedText style={styles.stateTitle}>{t("booking:missingBookingId")}</ThemedText>
          <ThemedText style={styles.stateBody}>{t("booking:missingBookingIdBody")}</ThemedText>

          <Pressable
            onPress={() => router.replace("/(tabs)/bookings" as Href)}
            style={[styles.stateBtn, styles.stateBtnPrimary]}
          >
            <ThemedText style={styles.stateBtnText}>{t("booking:backToBookings")}</ThemedText>
          </Pressable>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <ThemedText style={styles.headerTitle}>{t("booking:bookingDetails")}</ThemedText>
        <View style={{ width: 42 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#2b8cff" />
          <ThemedText style={styles.muted}>{t("common:loading")}</ThemedText>
        </View>
      ) : error || !booking ? (
        <ThemedView style={styles.stateCard}>
          <Image source={images.alarm} style={styles.stateArt} contentFit="contain" />
          <ThemedText style={styles.stateTitle}>{t("booking:unableToLoadBooking")}</ThemedText>
          <ThemedText style={styles.stateBody}>
            {isApiBaseUrlError(error)
              ? t("common:apiBaseUrlMissing")
              : error instanceof Error
                ? error.message
                : t("common:unexpectedError")}
          </ThemedText>

          <View style={{ flexDirection: "row" }}>
            <Pressable onPress={() => refetch()} style={styles.stateBtn}>
              <ThemedText style={styles.stateBtnText}>{t("common:retry")}</ThemedText>
            </Pressable>
            <View style={{ width: 10 }} />
            <Pressable
              onPress={() => router.replace("/(tabs)/bookings" as Href)}
              style={[styles.stateBtn, styles.stateBtnPrimary]}
            >
              <ThemedText style={styles.stateBtnText}>{t("booking:backToBookings")}</ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.hero}>
            <Image source={images.priceTag} style={styles.heroArt} contentFit="contain" />
            <ThemedText style={styles.heroTitle}>{t("booking:bookingSnapshot")}</ThemedText>
            <ThemedText style={styles.heroBody}>{t("booking:bookingSnapshotBody")}</ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <Image source={images.pin} style={styles.cardArt} contentFit="contain" />

            <View style={styles.rowTop}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <ThemedText style={styles.station}>
                  {booking.stationName ?? booking.stationId ?? t("booking:station")}
                </ThemedText>
                <ThemedText style={styles.facility}>
                  {booking.facilityName ?? booking.facilityId ?? t("booking:facility")}
                </ThemedText>
              </View>

              <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.bd }]}>
                <ThemedText style={[styles.badgeText, { color: badge.fg }]}>
                  {t(`booking:status.${String(booking.status ?? "pending").toLowerCase()}`, {
                    defaultValue: String(booking.status ?? "pending").toUpperCase(),
                  })}
                </ThemedText>
              </View>
            </View>

            <View style={styles.hr} />

            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={18} color="#8b8b8b" />
              <ThemedText style={styles.infoText}>{formatWhen(booking.arrivalTime)}</ThemedText>
            </View>

            {formatSlot(booking.slot) ? (
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={18} color="#8b8b8b" />
                <ThemedText style={styles.infoText}>{String(formatSlot(booking.slot))}</ThemedText>
              </View>
            ) : null}

            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={18} color="#8b8b8b" />
              <ThemedText style={styles.infoText}>
                {typeof booking.etaMinutes === "number"
                  ? t("booking:etaValue", { count: booking.etaMinutes })
                  : t("booking:etaUnknown")}
              </ThemedText>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="information-circle-outline" size={18} color="#8b8b8b" />
              <ThemedText style={styles.infoText}>
                {t("common:bookingId", { id: bookingShortId })}
              </ThemedText>
            </View>
          </ThemedView>

          <ThemedView style={styles.card}>
            <Image source={images.statistics} style={styles.cardArt} contentFit="contain" />
            <ThemedText style={styles.timelineTitle}>
              {t("booking:recommendation", { defaultValue: "Recommendation" })}
            </ThemedText>

            <View style={styles.hr} />

            <ThemedText style={styles.stepText}>
              {booking?.recommendedStationId
                ? t("booking:recommendedStation", {
                    defaultValue: `Recommended: ${booking.recommendedStationId}`,
                  })
                : recoData?.suggestedStationId
                  ? t("booking:recommendedStation", {
                      defaultValue: `Recommended: ${recoData.suggestedStationId}`,
                    })
                  : t("booking:etaUnknown", { defaultValue: "No recommendation yet." })}
            </ThemedText>

            {typeof booking?.recommendedWaitMin === "number" ? (
              <ThemedText style={[styles.stepText, { marginTop: 8 }]}>
                {t("booking:estWait", {
                  count: booking.recommendedWaitMin,
                  defaultValue: `Est. wait: ${booking.recommendedWaitMin} min`,
                })}
              </ThemedText>
            ) : null}
          </ThemedView>

          <ThemedView style={styles.card}>
            <Image source={images.clock} style={styles.cardArt} contentFit="contain" />
            <ThemedText style={styles.timelineTitle}>
              {t("booking:queueStatus", { defaultValue: "Queue status" })}
            </ThemedText>

            <View style={styles.hr} />

            {latestQueueEntry ? (
              <>
                <ThemedText style={styles.stepText}>
                  {t("booking:queueEntryStatus", {
                    defaultValue: `Status: ${String(latestQueueEntry.status ?? "-")}`,
                  })}
                </ThemedText>
                <ThemedText style={[styles.stepText, { marginTop: 8 }]}>
                  {t("booking:queueEntryCreatedAt", {
                    defaultValue: `Updated: ${formatWhen(latestQueueEntry.createdAt)}`,
                  })}
                </ThemedText>
              </>
            ) : (
              <ThemedText style={styles.stepText}>
                {t("booking:noQueueEntry", { defaultValue: "No queue entry found for this booking." })}
              </ThemedText>
            )}
          </ThemedView>

          <ThemedView style={styles.card}>
            <Image source={images.alarm} style={styles.cardArt} contentFit="contain" />
            <ThemedText style={styles.timelineTitle}>
              {t("issue:recentIssues", { defaultValue: "Issues" })}
            </ThemedText>

            <View style={styles.hr} />

            {issues.length ? (
              issues
                .slice(0, 3)
                .map((issue: any) => (
                  <View key={String(issue.id)} style={{ marginTop: 10 }}>
                    <ThemedText style={styles.stepText}>
                      {String(issue.category ?? "Issue")} • {String(issue.status ?? "").toUpperCase()}
                    </ThemedText>
                    <ThemedText style={[styles.stepText, { color: "#9aa0a6", marginTop: 4 }]}>
                      {String(issue.description ?? "")}
                    </ThemedText>
                  </View>
                ))
            ) : (
              <ThemedText style={styles.stepText}>
                {t("issue:noIssues", { defaultValue: "No issues yet." })}
              </ThemedText>
            )}
          </ThemedView>

          <ThemedView style={styles.timeline}>
            <Image source={images.clock} style={styles.timelineArt} contentFit="contain" />
            <ThemedText style={styles.timelineTitle}>{t("booking:arrivalTimeline")}</ThemedText>

            <View style={styles.step}>
              <View style={styles.dot} />
              <ThemedText style={styles.stepText}>{t("booking:timelineStep1")}</ThemedText>
            </View>
            <View style={styles.step}>
              <View style={styles.dot} />
              <ThemedText style={styles.stepText}>{t("booking:timelineStep2")}</ThemedText>
            </View>
            <View style={styles.step}>
              <View style={styles.dot} />
              <ThemedText style={styles.stepText}>{t("booking:timelineStep3")}</ThemedText>
            </View>
          </ThemedView>

          <ThemedView style={styles.actions}>
            <ThemedText style={styles.actionsTitle}>{t("common:actions")}</ThemedText>

            <Pressable
              onPress={() => router.push("/(tabs)/bookings/new" as Href)}
              style={[styles.actionBtn, styles.actionSecondary]}
            >
              <ThemedText style={styles.actionText}>{t("booking:reschedule")}</ThemedText>
            </Pressable>

            <Pressable
              onPress={confirmCancel}
              disabled={cancelMut.isPending}
              style={[
                styles.actionBtn,
                styles.actionDanger,
                cancelMut.isPending && { opacity: 0.7 },
              ]}
            >
              <ThemedText style={styles.actionText}>
                {cancelMut.isPending ? t("booking:cancelBookingLoading") : t("booking:cancelBooking")}
              </ThemedText>
            </Pressable>
          </ThemedView>

          <View style={{ height: 24 }} />
        </ScrollView>
      )}
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
  headerTitle: { flex: 1, textAlign: "center", color: "#fff", fontSize: 18, fontWeight: "900" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  muted: { color: "#9aa0a6", marginTop: 10, fontWeight: "700" },

  scroll: { paddingHorizontal: 18, paddingBottom: 24 },

  hero: {
    marginTop: 8,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#1a1a1a",
    backgroundColor: "#0f0f0f",
    overflow: "hidden",
  },
  heroArt: { position: "absolute", right: -12, top: -12, width: 160, height: 160, opacity: 0.14 },
  heroTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  heroBody: { color: "#9aa0a6", marginTop: 8, fontSize: 13, maxWidth: "82%" },

  card: {
    marginTop: 12,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#1a1a1a",
    backgroundColor: "#0f0f0f",
    overflow: "hidden",
  },
  cardArt: { position: "absolute", right: -12, top: -12, width: 150, height: 150, opacity: 0.10 },

  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  station: { color: "#fff", fontSize: 18, fontWeight: "900" },
  facility: { color: "#9aa0a6", marginTop: 6, fontWeight: "700" },

  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: "900", letterSpacing: 1 },

  hr: { height: 1, backgroundColor: "#1a1a1a", marginVertical: 12 },

  infoRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  infoText: { color: "#cfcfcf", fontWeight: "700", marginLeft: 10 },

  timeline: {
    marginTop: 12,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#1a1a1a",
    backgroundColor: "#0f0f0f",
    overflow: "hidden",
  },
  timelineArt: { position: "absolute", right: -12, top: -12, width: 150, height: 150, opacity: 0.10 },
  timelineTitle: { color: "#fff", fontWeight: "900", marginBottom: 10 },
  step: { flexDirection: "row", alignItems: "flex-start", marginTop: 8 },
  dot: { width: 8, height: 8, borderRadius: 999, backgroundColor: "#2b8cff", marginTop: 6, marginRight: 10 },
  stepText: { color: "#cfcfcf", flex: 1, fontSize: 13, fontWeight: "600" },

  actions: {
    marginTop: 12,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#1a1a1a",
    backgroundColor: "#0f0f0f",
  },
  actionsTitle: { color: "#fff", fontWeight: "900", marginBottom: 10 },

  actionBtn: {
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  actionText: { color: "#fff", fontWeight: "900" },
  actionSecondary: { backgroundColor: "#2b8cff22", borderColor: "#2b8cff44" },
  actionDanger: { marginTop: 10, backgroundColor: "#b91c1c", borderColor: "#ef444422" },

  stateCard: {
    margin: 18,
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#1a1a1a",
    backgroundColor: "#0f0f0f",
    alignItems: "center",
  },
  stateArt: { width: 86, height: 86, opacity: 0.35, marginBottom: 10 },
  stateTitle: { color: "#fff", fontSize: 16, fontWeight: "900", textAlign: "center" },
  stateBody: { color: "#9aa0a6", textAlign: "center", lineHeight: 18, marginTop: 8, marginBottom: 12 },
  stateBtn: {
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2b8cff44",
    backgroundColor: "#2b8cff22",
    alignItems: "center",
    justifyContent: "center",
  },
  stateBtnPrimary: { backgroundColor: "#2b8cff", borderColor: "#2b8cff" },
  stateBtnText: { color: "#fff", fontWeight: "900" },
});
