import React, { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { fetchBookings } from "@/api/bookings";
import { queryKeys } from "@/query/keys";
import { images } from "@/constants/images";

type BookingLike = {
  id?: string;
  stationName?: string;
  facilityName?: string;
  arrivalTime?: string;
  status?: string;
  etaMinutes?: number;
};

const isApiBaseUrlError = (err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return msg.toLowerCase().includes("api_base_url");
};

const statusTone = (status?: string) => {
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
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function BookingsIndexScreen() {
  const router = useRouter();
  const { t } = useTranslation(["booking", "common"]);

  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    error,
  } = useQuery({
    queryKey: queryKeys.bookings(),
    queryFn: () => fetchBookings(),
  });

  const bookings: BookingLike[] = Array.isArray(data) ? (data as BookingLike[]) : [];

  const sorted = useMemo(() => {
    const copy = [...bookings];
    copy.sort((a, b) => {
      const ta = a.arrivalTime ? new Date(a.arrivalTime).getTime() : 0;
      const tb = b.arrivalTime ? new Date(b.arrivalTime).getTime() : 0;
      return tb - ta;
    });
    return copy;
  }, [bookings]);

  const stats = useMemo(() => {
    const total = bookings.length;
    const cancelled = bookings.filter((b) => (b.status ?? "").toLowerCase() === "cancelled").length;
    const active = total - cancelled;
    return { total, active, cancelled };
  }, [bookings]);

  const Header = (
    <ThemedView style={styles.headerWrap}>
      <Image source={images.wallet} style={styles.headerArt} contentFit="contain" />
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>

        <View style={styles.headerTitles}>
          <ThemedText style={styles.h1}>
            {t("myBookings", { defaultValue: "My bookings" })}
          </ThemedText>
          <ThemedText style={styles.h2}>
            {t("scheduled", { defaultValue: "Planned arrivals" })}
          </ThemedText>
        </View>

        <Pressable
          onPress={() => router.push("/bookings/new")}
          style={[styles.iconBtn, styles.primaryIconBtn]}
          hitSlop={10}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      <ThemedView style={styles.overviewCard}>
        <Image source={images.statistics} style={styles.overviewArt} contentFit="contain" />
        <View style={styles.overviewHead}>
          <ThemedText style={styles.overviewTitle}>{t('booking:bookingOverview')}</ThemedText>
          <View style={styles.pill}>
            <ThemedText style={styles.pillText}>{t('booking:today')}</ThemedText>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <ThemedText style={styles.kpiLabel}>{t('booking:total')}</ThemedText>
            <ThemedText style={styles.kpiValue}>{isLoading ? "-" : stats.total}</ThemedText>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpi}>
            <ThemedText style={styles.kpiLabel}>{t('booking:active')}</ThemedText>
            <ThemedText style={styles.kpiValue}>{isLoading ? "-" : stats.active}</ThemedText>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpi}>
            <ThemedText style={styles.kpiLabel}>{t('booking:cancelled')}</ThemedText>
            <ThemedText style={styles.kpiValue}>{isLoading ? "-" : stats.cancelled}</ThemedText>
          </View>
        </View>
      </ThemedView>

      <View style={styles.sectionHead}>
        <ThemedText style={styles.sectionTitle}>{t('booking:upcoming')}</ThemedText>
        <Pressable onPress={() => router.push("/bookings/new")} style={styles.linkBtn}>
          <ThemedText style={styles.linkBtnText}>{t('booking:newBooking')}</ThemedText>
          <Ionicons name="arrow-forward" size={14} color="#2b8cff" />
        </Pressable>
      </View>
    </ThemedView>
  );

  const renderItem = ({ item }: { item: BookingLike }) => {
    const id = item.id ?? "";
    const badge = statusTone(item.status);
    const statusKey = (item.status ?? "pending").toLowerCase();
    const statusLabel = t(`booking:status.${statusKey}`, {
      defaultValue: statusKey.toUpperCase(),
    });
    const shortId = id ? id.slice(-6).toUpperCase() : "-";

    return (
      <Pressable
        onPress={() => id && router.push(`/bookings/${id}`)}
        style={styles.cardPress}
      >
        <ThemedView style={styles.card}>
          <Image source={images.pin} style={styles.cardArt} contentFit="contain" />

          <View style={styles.cardTop}>
            <View style={styles.cardIcon}>
              <Ionicons name="location-outline" size={18} color="#2b8cff" />
            </View>

            <View style={{ flex: 1 }}>
              <ThemedText style={styles.cardTitle}>
                {item.stationName ?? t("booking:stationFallback")}
              </ThemedText>
              <ThemedText style={styles.cardSub}>
                {item.facilityName ?? t("booking:bookingIdFallback", { id: shortId })}
              </ThemedText>
            </View>

            <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.bd }]}>
              <ThemedText style={[styles.badgeText, { color: badge.fg }]}>
                {statusLabel}
              </ThemedText>
            </View>
          </View>

          <View style={styles.hr} />

          <View style={styles.cardBottom}>
            <View style={styles.meta}>
              <Ionicons name="calendar-outline" size={16} color="#8b8b8b" />
              <ThemedText style={styles.metaText}>{formatWhen(item.arrivalTime)}</ThemedText>
            </View>

            <View style={styles.meta}>
              <Ionicons name="time-outline" size={16} color="#8b8b8b" />
              <ThemedText style={styles.metaText}>
                {typeof item.etaMinutes === "number" ? t("booking:etaValue", { count: item.etaMinutes }) : t("booking:etaUnknown")}
              </ThemedText>
            </View>
          </View>
        </ThemedView>
      </Pressable>
    );
  };

  const ErrorState = error ? (
    <ThemedView style={styles.stateCard}>
      <Image source={images.alarm} style={styles.stateArt} contentFit="contain" />
      <ThemedText style={styles.stateTitle}>{t("booking:bookingsCouldNotLoad")}</ThemedText>

      <ThemedText style={styles.stateBody}>
        {isApiBaseUrlError(error)
          ? t("common:apiBaseUrlMissing")
          : error instanceof Error
            ? error.message
            : t("common:unexpectedError")}
      </ThemedText>

      <View style={styles.stateActions}>
        <Pressable onPress={() => refetch()} style={styles.stateBtn}>
          <ThemedText style={styles.stateBtnText}>{t("common:retry", { defaultValue: "Retry" })}</ThemedText>
        </Pressable>
        <Pressable onPress={() => router.push("/bookings/new")} style={[styles.stateBtn, styles.stateBtnPrimary]}>
          <ThemedText style={styles.stateBtnText}>{t("booking:createBooking")}</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  ) : null;

  const EmptyState = (
    <ThemedView style={styles.stateCard}>
      <Image source={images.hourglass} style={styles.stateArt} contentFit="contain" />
      <ThemedText style={styles.stateTitle}>{t("booking:noBookings")}</ThemedText>
      <ThemedText style={styles.stateBody}>
        {t("booking:noBookingsBody")}
      </ThemedText>
      <Pressable onPress={() => router.push("/bookings/new")} style={[styles.stateBtn, styles.stateBtnPrimary, { alignSelf: "stretch" }]}>
        <ThemedText style={styles.stateBtnText}>{t("booking:newBooking")}</ThemedText>
      </Pressable>
    </ThemedView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />

      <FlatList
        data={sorted}
        keyExtractor={(item, idx) => item.id ?? String(idx)}
        renderItem={renderItem}
        ListHeaderComponent={Header}
        ListEmptyComponent={!isLoading && !error ? EmptyState : null}
        ListFooterComponent={ErrorState}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#2b8cff"
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {isLoading ? (
        <View style={styles.loadingFloat}>
          <ActivityIndicator color="#2b8cff" />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050505" },
  list: { paddingBottom: 28 },

  headerWrap: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 8, backgroundColor: "transparent" },
  headerArt: { position: "absolute", right: -10, top: -10, width: 160, height: 160, opacity: 0.08 },

  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  headerTitles: { flex: 1, alignItems: "center" },
  h1: { color: "#fff", fontSize: 20, fontWeight: "900" },
  h2: { color: "#6b6b6b", fontSize: 12, marginTop: 2 },

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
  primaryIconBtn: {
    backgroundColor: "#2b8cff22",
    borderColor: "#2b8cff44",
  },

  overviewCard: {
    marginTop: 14,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1a1a1a",
    backgroundColor: "#0f0f0f",
    overflow: "hidden",
  },
  overviewArt: { position: "absolute", right: -12, top: -12, width: 160, height: 160, opacity: 0.12 },
  overviewHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  overviewTitle: { color: "#fff", fontSize: 16, fontWeight: "900" },

  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: "#2b8cff22", borderWidth: 1, borderColor: "#2b8cff44" },
  pillText: { color: "#2b8cff", fontSize: 10, fontWeight: "900", letterSpacing: 1 },

  kpiRow: { flexDirection: "row", alignItems: "center" },
  kpi: { flex: 1, alignItems: "center" },
  kpiDivider: { width: 1, height: 42, backgroundColor: "#1a1a1a" },
  kpiLabel: { color: "#9aa0a6", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 },
  kpiValue: { color: "#fff", fontSize: 18, fontWeight: "900", marginTop: 4 },

  sectionHead: { marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: "#8b8b8b", fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 },
  linkBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 10 },
  linkBtnText: { color: "#2b8cff", fontWeight: "800" },

  cardPress: { paddingHorizontal: 18, paddingTop: 12 },
  card: {
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#1a1a1a",
    backgroundColor: "#0f0f0f",
    overflow: "hidden",
  },
  cardArt: { position: "absolute", right: -10, top: -12, width: 140, height: 140, opacity: 0.10 },

  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#121212",
    borderWidth: 1,
    borderColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "900" },
  cardSub: { color: "#5f5f5f", marginTop: 4, fontSize: 12 },

  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },

  hr: { height: 1, backgroundColor: "#1a1a1a", marginVertical: 12 },

  cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  meta: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaText: { color: "#bdbdbd", fontSize: 13, fontWeight: "600" },

  stateCard: {
    marginHorizontal: 18,
    marginTop: 16,
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#1a1a1a",
    backgroundColor: "#0f0f0f",
    alignItems: "center",
    gap: 10,
    overflow: "hidden",
  },
  stateArt: { width: 86, height: 86, opacity: 0.35 },
  stateTitle: { color: "#fff", fontSize: 16, fontWeight: "900", textAlign: "center" },
  stateBody: { color: "#9aa0a6", textAlign: "center", lineHeight: 18 },

  stateActions: { flexDirection: "row", gap: 10, marginTop: 2 },
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
  stateBtnText: { color: "#fff", fontWeight: "800" },

  loadingFloat: { position: "absolute", top: 14, right: 14, backgroundColor: "#0f0f0f", borderRadius: 999, padding: 10, borderWidth: 1, borderColor: "#1a1a1a" },
});
