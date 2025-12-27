import React, { memo, useMemo } from "react";
import { Platform, SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { images } from "@/constants/images";

type ForecastPoint = { label: string; valueMin: number };
type StationPerf = { name: string; score: number; trendPct: number; hint?: string };
type TimelineItem = { title: string; body: string };

const UI = {
  bg: "#0b0b0b",
  card: "#0f0f0f",
  border: "#1a1a1a",
  muted: "#9aa0a6",
  text: "#ffffff",
  primary: "#2b8cff",
  track: "#151515",
  radius: 18,
  radiusHero: 20,
  pad: 18,
};

const shadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  android: { elevation: 6 },
  default: {},
});

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

function scoreColor(score: number) {
  if (score >= 85) return "#22c55e";
  if (score >= 70) return "#facc15";
  return "#ef4444";
}

function trendColor(trendPct: number) {
  if (trendPct > 0) return "#22c55e";
  if (trendPct < 0) return "#ef4444";
  return UI.muted;
}

function trendIcon(trendPct: number) {
  if (trendPct > 0) return "trending-up-outline" as const;
  if (trendPct < 0) return "trending-down-outline" as const;
  return "remove-outline" as const;
}

const Card = memo(function Card(props: {
  title: string;
  subtitle?: string;
  art?: any;
  artStyle?: any;
  children: React.ReactNode;
}) {
  return (
    <ThemedView style={styles.card}>
      {props.art ? <Image source={props.art} style={[styles.cardArt, props.artStyle]} contentFit="contain" /> : null}
      <View style={styles.cardHeader}>
        <ThemedText style={styles.cardTitle}>{props.title}</ThemedText>
        {props.subtitle ? <ThemedText style={styles.cardSubtitle}>{props.subtitle}</ThemedText> : null}
      </View>
      {props.children}
    </ThemedView>
  );
});

const ForecastMiniChart = memo(function ForecastMiniChart({
  data,
  formatValue,
}: {
  data: ForecastPoint[];
  formatValue: (valueMin: number) => string;
}) {
  const trackH = 84;
  const maxV = Math.max(1, ...data.map((d) => d.valueMin));

  return (
    <View style={styles.chartRow}>
      {data.map((slot, idx) => {
        const fillH = Math.round((slot.valueMin / maxV) * trackH);
        const safeFill = clamp(fillH, 6, trackH);

        return (
          <View key={`${slot.label}-${idx}`} style={styles.chartItem}>
            <View style={[styles.chartTrack, { height: trackH }]}>
              <View style={[styles.chartFill, { height: safeFill }]} />
            </View>

            <ThemedText style={styles.chartLabel}>{slot.label}</ThemedText>
            <ThemedText style={styles.chartValue}>{formatValue(slot.valueMin)}</ThemedText>
          </View>
        );
      })}
    </View>
  );
});

const StationRow = memo(function StationRow({
  item,
  metaLabel,
}: {
  item: StationPerf;
  metaLabel: string;
}) {
  const sColor = scoreColor(item.score);
  const tColor = trendColor(item.trendPct);
  const tIcon = trendIcon(item.trendPct);

  const trendText =
    item.trendPct === 0 ? "0%" : item.trendPct > 0 ? `+${item.trendPct}%` : `${item.trendPct}%`;

  return (
    <View style={styles.stationRow}>
      <View style={styles.stationLeft}>
        <ThemedText style={styles.stationName}>{item.name}</ThemedText>
        <ThemedText style={styles.stationMeta}>
          {metaLabel}
          {item.hint ? ` • ${item.hint}` : ""}
        </ThemedText>
      </View>

      <View style={styles.stationRight}>
        <ThemedText style={[styles.stationScore, { color: sColor }]}>{item.score}</ThemedText>
        <View style={styles.trendRow}>
          <Ionicons name={tIcon} size={14} color={tColor} />
          <ThemedText style={[styles.stationTrend, { color: tColor }]}>{trendText}</ThemedText>
        </View>
      </View>
    </View>
  );
});

const TimelineBlock = memo(function TimelineBlock({ items }: { items: TimelineItem[] }) {
  return (
    <View>
      {items.map((it, idx) => (
        <View key={`${it.title}-${idx}`} style={[styles.timelineStep, idx !== 0 && { marginTop: 14 }]}>
          <View style={styles.timelineDot} />
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.timelineTitle}>{it.title}</ThemedText>
            <ThemedText style={styles.timelineBody}>{it.body}</ThemedText>
          </View>
        </View>
      ))}
    </View>
  );
});

export default function PredictedScreen() {
  const { t } = useTranslation(["pulse", "common"]);
  const insets = useSafeAreaInsets();

  // Mock "last updated" (KKTC ops style)
  const updatedMinutesAgo = 2;
  const updatedLabel =
    updatedMinutesAgo <= 1
      ? t("common:updatedJustNow", { defaultValue: "Updated just now" })
      : t("common:updatedMinutesAgo", { count: updatedMinutesAgo, defaultValue: `Updated ${updatedMinutesAgo} min ago` });

  // KKTC queue forecast (minutes of expected wait)
  const forecast = useMemo<ForecastPoint[]>(
    () => [
      { label: "08:00", valueMin: 9 },   // early calm
      { label: "10:00", valueMin: 16 },  // trucks arrive
      { label: "12:00", valueMin: 28 },  // customs + dock peak
      { label: "14:00", valueMin: 24 },  // still heavy
      { label: "16:00", valueMin: 14 },  // recovery
    ],
    [],
  );

  // KKTC station performance snapshot
  const stations = useMemo<StationPerf[]>(
    () => [
      { name: "Gazimağusa Port (Customs Gate)", score: 78, trendPct: -3, hint: "Customs checks ↑" },
      { name: "Lefkoşa Logistics Park (Gate B)", score: 90, trendPct: 5, hint: "Fast lane stable" },
      { name: "Girne Free Zone (Dock 1)", score: 83, trendPct: 2, hint: "Dock throughput ↑" },
      { name: "Güzelyurt Citrus Yard (Cold Dock)", score: 71, trendPct: -1, hint: "Cold-chain priority" },
      { name: "İskele Boğaz Transfer (Weighbridge)", score: 88, trendPct: 1, hint: "Scale flow steady" },
    ],
    [],
  );

  // KKTC day timeline (operational narrative)
  const timeline = useMemo<TimelineItem[]>(
    () => [
      {
        title: t("pulse:peakWindowTitle", {
          defaultValue: "Peak window",
        }),
        body: t("pulse:peakWindowBody", {
          defaultValue:
            "11:30–14:00 expected to exceed 20 min at Mağusa Port gates (customs + dock overlap). Consider rescheduling arrivals or routing to Lefkoşa Gate B.",
        }),
      },
      {
        title: t("pulse:recoveryTitle", {
          defaultValue: "Recovery phase",
        }),
        body: t("pulse:recoveryBody", {
          defaultValue:
            "After 15:30, compliance improves and queue drops; weighbridge clears first, then docks normalize.",
        }),
      },
      {
        title: t("pulse:eveningFlowTitle", {
          defaultValue: "Evening flow",
        }),
        body: t("pulse:eveningFlowBody", {
          defaultValue:
            "Until closing, stable 12–14 min expected for Lefkoşa/Girne lines; Mağusa remains sensitive to random inspections.",
        }),
      },
    ],
    [t],
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO */}
        <ThemedView style={styles.hero}>
          <View style={styles.heroLeft}>
            <ThemedText style={styles.heroTitle}>
              {t("pulse:title", { defaultValue: "Facility status" })}
            </ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              {t("pulse:subtitle", { defaultValue: "Queue forecast and flow insights (TRNC)." })}
            </ThemedText>

            <View style={styles.heroBadge}>
              <Ionicons name="time-outline" size={14} color="#9bbcff" />
              <ThemedText style={styles.heroBadgeText}>{updatedLabel}</ThemedText>
            </View>
          </View>

          <Image source={images.performanceGrowth} style={styles.heroArt} contentFit="contain" />
        </ThemedView>

        {/* Forecast */}
        <Card
          title={t("pulse:queueForecast", { defaultValue: "Queue forecast" })}
          subtitle={t("pulse:nextHours", { defaultValue: "Next 8 hours" })}
          art={images.hourglass}
          artStyle={styles.artTopRight}
        >
          <ForecastMiniChart
            data={forecast}
            formatValue={(value) => t("common:mins", { count: value, defaultValue: `${value} min` })}
          />
          <ThemedText style={styles.microHint}>
            {t("pulse:valuesHint", { defaultValue: "Values are estimated waiting minutes (lower is better)." })}
          </ThemedText>
        </Card>

        {/* Station perf */}
        <Card
          title={t("pulse:stationPerformance", { defaultValue: "Station performance" })}
          subtitle={t("pulse:efficiencyScore", { defaultValue: "Efficiency score" })}
          art={images.pieChart}
          artStyle={styles.artBottomRight}
        >
          <View style={styles.list}>
            {stations.map((s) => (
              <StationRow
                key={s.name}
                item={s}
                metaLabel={t("pulse:flowHealthIndex", { defaultValue: "Flow health index" })}
              />
            ))}
          </View>
        </Card>

        {/* Timeline */}
        <Card title={t("pulse:todayTimeline", { defaultValue: "Today’s timeline" })} art={images.clock} artStyle={styles.artTopRight}>
          <TimelineBlock items={timeline} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI.bg },
  content: { padding: 20 },

  hero: {
    padding: UI.pad,
    borderRadius: UI.radiusHero,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.card,
    overflow: "hidden",
    marginBottom: 16,
    ...shadow,
  },
  heroLeft: { maxWidth: "72%" },
  heroTitle: { color: UI.text, fontSize: 28, fontWeight: "800" },
  heroSubtitle: { color: UI.muted, marginTop: 6, lineHeight: 18 },

  heroBadge: {
    marginTop: 10,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#2b8cff20",
    borderWidth: 1,
    borderColor: "#2b8cff40",
    flexDirection: "row",
    alignItems: "center",
  },
  heroBadgeText: { color: "#9bbcff", fontWeight: "700", fontSize: 11, marginLeft: 6 },

  heroArt: {
    position: "absolute",
    right: -10,
    top: -10,
    width: 170,
    height: 170,
    opacity: 0.22,
    pointerEvents: "none" as any,
  },

  card: {
    padding: UI.pad,
    borderRadius: UI.radius,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.card,
    marginBottom: 16,
    overflow: "hidden",
    ...shadow,
  },
  cardHeader: { marginBottom: 12 },
  cardTitle: { color: UI.text, fontWeight: "800", fontSize: 16 },
  cardSubtitle: { color: UI.muted, marginTop: 3, fontSize: 12 },

  cardArt: { position: "absolute", width: 120, height: 120, opacity: 0.16, pointerEvents: "none" as any },
  artTopRight: { right: -10, top: -10 },
  artBottomRight: { right: -10, bottom: -10, opacity: 0.18 },

  chartRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  chartItem: { flex: 1, alignItems: "center" },

  chartTrack: {
    width: 12,
    borderRadius: 999,
    backgroundColor: UI.track,
    overflow: "hidden",
  },
  chartFill: {
    width: "100%",
    backgroundColor: UI.primary,
    borderRadius: 999,
    alignSelf: "flex-end",
  },
  chartLabel: { color: UI.muted, fontSize: 11, marginTop: 8 },
  chartValue: { color: UI.text, fontSize: 11, fontWeight: "800", marginTop: 4 },

  microHint: { color: "#6b6b6b", fontSize: 12, marginTop: 10 },

  list: { marginTop: 2 },
  stationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  stationLeft: { flex: 1, paddingRight: 12 },
  stationName: { color: UI.text, fontWeight: "800" },
  stationMeta: { color: UI.muted, fontSize: 12, marginTop: 3 },

  stationRight: { alignItems: "flex-end" },
  stationScore: { fontWeight: "900", fontSize: 18 },
  trendRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  stationTrend: { fontSize: 11, marginLeft: 6, fontWeight: "700" },

  timelineStep: { flexDirection: "row", alignItems: "flex-start" },
  timelineDot: { width: 10, height: 10, borderRadius: 999, backgroundColor: UI.primary, marginTop: 6 },
  timelineTitle: { color: UI.text, fontWeight: "800", marginLeft: 12 },
  timelineBody: { color: UI.muted, fontSize: 12, marginTop: 3, marginLeft: 12, lineHeight: 16 },
});
