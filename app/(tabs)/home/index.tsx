import React, { memo, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { fetchBookings } from "@/api/bookings";
import { fetchFacilities } from "@/api/facilities";
import { fetchStations } from "@/api/stations";
import { queryKeys } from "@/query/keys";
import { appConfig } from "@/config";
import type { Booking } from "@/types/api";

const ROUTES = {
  map: "../map",
  bookings: "../bookings",
  bookingNew: "../bookings/new",
  issues: "../issues",
} as const;

type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
type StatusTone = "neutral" | "warning" | "success" | "danger";

type DetailItem = {
  id: string;
  label: string;
  value: string;
  helper?: string;
};

type QuickAction = {
  id: string;
  label: string;
  hint: string;
  href: AppRoute;
  icon: keyof typeof Ionicons.glyphMap;
};

const UI = {
  bg: "#08090b",
  card: "#101113",
  cardSoft: "#0b0c0e",
  border: "#20242b",
  borderSoft: "#2b313b",
  text: "#f7f9fc",
  muted: "#9aa3af",
  mutedSoft: "#6f7782",
  primary: "#2b8cff",
  primarySoft: "rgba(43, 140, 255, 0.14)",
  primaryBorder: "rgba(43, 140, 255, 0.35)",
  yellow: "#facc15",
  yellowSoft: "rgba(250, 204, 21, 0.12)",
  yellowBorder: "rgba(250, 204, 21, 0.32)",
  green: "#22c55e",
  greenSoft: "rgba(34, 197, 94, 0.12)",
  greenBorder: "rgba(34, 197, 94, 0.32)",
  red: "#ef4444",
  redSoft: "rgba(239, 68, 68, 0.12)",
  redBorder: "rgba(239, 68, 68, 0.32)",
};

function normalizeText(value?: string | null, fallback = "—") {
  if (typeof value !== "string") return fallback;
  const clean = value.trim();
  return clean.length > 0 ? clean : fallback;
}

function normalizeOptionalText(value?: string | null) {
  if (typeof value !== "string") return null;

  const clean = value.trim();
  if (!clean) return null;

  const lowered = clean.toLowerCase();
  if (lowered === "unknown" || lowered === "undefined" || lowered === "null") {
    return null;
  }

  return clean;
}

function formatArrival(value?: string) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatReference(value?: string) {
  const clean = normalizeText(value, "");
  if (!clean) return "—";
  return clean.startsWith("#") ? clean : `#${clean}`;
}

function getActiveBooking(bookings: Booking[]) {
  if (!Array.isArray(bookings) || bookings.length === 0) return null;

  const visible = bookings.filter((booking: any) => {
    return booking.status !== "cancelled" && booking.status !== "completed";
  });

  return (
    visible.sort((a: any, b: any) => {
      const aTime = a?.arrivalTime ? new Date(a.arrivalTime).getTime() : 0;
      const bTime = b?.arrivalTime ? new Date(b.arrivalTime).getTime() : 0;
      return aTime - bTime;
    })[0] ?? null
  );
}

function resolveQueueEstimate(booking: Booking | null) {
  if (!booking) return null;

  const eta = (booking as any)?.etaMinutes;

  if (typeof eta === "number" && Number.isFinite(eta)) {
    return `${Math.max(0, Math.round(eta))} min`;
  }

  return null;
}

function getStatusMeta(status: string | undefined, t: any) {
  switch (status) {
    case "confirmed":
      return {
        label: t("home:confirmed", { defaultValue: "Confirmed" }),
        tone: "success" as StatusTone,
        title: t("home:heroConfirmedTitle", { defaultValue: "Arrival slot confirmed" }),
        subtitle: t("home:heroConfirmedSubtitle", {
          defaultValue: "Your booking is ready. Check station details before departure.",
        }),
        primaryLabel: t("home:manageBooking", { defaultValue: "Manage booking" }),
        primaryHref: ROUTES.bookings,
      };

    case "arrived":
      return {
        label: t("home:arrived", { defaultValue: "Arrived" }),
        tone: "success" as StatusTone,
        title: t("home:heroArrivedTitle", { defaultValue: "You are checked in" }),
        subtitle: t("home:heroArrivedSubtitle", {
          defaultValue: "Follow station updates and wait for service instructions.",
        }),
        primaryLabel: t("home:openMap", { defaultValue: "Open facility map" }),
        primaryHref: ROUTES.map,
      };

    case "servicing":
      return {
        label: t("home:servicing", { defaultValue: "In service" }),
        tone: "success" as StatusTone,
        title: t("home:heroServicingTitle", { defaultValue: "Service in progress" }),
        subtitle: t("home:heroServicingSubtitle", {
          defaultValue: "The assigned station is processing your visit.",
        }),
        primaryLabel: t("home:openMap", { defaultValue: "Open facility map" }),
        primaryHref: ROUTES.map,
      };

    case "pending":
      return {
        label: t("home:pendingConfirmation", { defaultValue: "Pending confirmation" }),
        tone: "warning" as StatusTone,
        title: t("home:heroPendingTitle", { defaultValue: "Arrival awaiting confirmation" }),
        subtitle: t("home:heroPendingSubtitle", {
          defaultValue: "Assignment is still being confirmed. Check your booking before departure.",
        }),
        primaryLabel: t("home:manageBooking", { defaultValue: "Manage booking" }),
        primaryHref: ROUTES.bookings,
      };

    default:
      return {
        label: t("home:noActiveBooking", { defaultValue: "No active booking" }),
        tone: "neutral" as StatusTone,
        title: t("home:heroEmptyTitle", { defaultValue: "Plan your next arrival" }),
        subtitle: t("home:heroEmptySubtitle", {
          defaultValue: "Create a booking to receive arrival time, station and queue updates.",
        }),
        primaryLabel: t("home:bookSlot", { defaultValue: "Create booking" }),
        primaryHref: ROUTES.bookingNew,
      };
  }
}

function toneStyle(tone: StatusTone) {
  if (tone === "success") {
    return {
      color: UI.green,
      bg: UI.greenSoft,
      border: UI.greenBorder,
      icon: "checkmark-circle-outline" as const,
    };
  }

  if (tone === "warning") {
    return {
      color: UI.yellow,
      bg: UI.yellowSoft,
      border: UI.yellowBorder,
      icon: "time-outline" as const,
    };
  }

  if (tone === "danger") {
    return {
      color: UI.red,
      bg: UI.redSoft,
      border: UI.redBorder,
      icon: "alert-circle-outline" as const,
    };
  }

  return {
    color: UI.primary,
    bg: UI.primarySoft,
    border: UI.primaryBorder,
    icon: "information-circle-outline" as const,
  };
}

const NavButton = memo(function NavButton({
  href,
  style,
  children,
}: {
  href: AppRoute;
  style: any;
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(href as any)}
      style={({ pressed }) => [style, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      {children}
    </Pressable>
  );
});

const StatusPill = memo(function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: StatusTone;
}) {
  const palette = toneStyle(tone);

  return (
    <View style={[styles.statusPill, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Ionicons name={palette.icon} size={12} color={palette.color} />
      <ThemedText style={[styles.statusPillText, { color: palette.color }]} numberOfLines={1}>
        {label}
      </ThemedText>
    </View>
  );
});

const HeroCard = memo(function HeroCard({
  title,
  subtitle,
  statusLabel,
  statusTone,
  reference,
  primaryLabel,
  primaryHref,
  eyebrow,
  referenceLabel,
}: {
  title: string;
  subtitle: string;
  statusLabel: string;
  statusTone: StatusTone;
  reference: string;
  primaryLabel: string;
  primaryHref: AppRoute;
  eyebrow: string;
  referenceLabel: string;
}) {
  return (
    <ThemedView style={styles.heroCard}>
      <View style={styles.heroGlow} />

      <View style={styles.heroTop}>
        <ThemedText style={styles.eyebrow}>{eyebrow}</ThemedText>
        <StatusPill label={statusLabel} tone={statusTone} />
      </View>

      <ThemedText style={styles.heroTitle}>{title}</ThemedText>
      <ThemedText style={styles.heroSubtitle}>{subtitle}</ThemedText>

      <View style={styles.heroReference}>
        <ThemedText style={styles.referenceLabel}>{referenceLabel}</ThemedText>
        <ThemedText style={styles.referenceValue}>{reference}</ThemedText>
      </View>

      <NavButton href={primaryHref} style={styles.primaryButton}>
        <ThemedText style={styles.primaryButtonText}>{primaryLabel}</ThemedText>
      </NavButton>
    </ThemedView>
  );
});

const DetailRow = memo(function DetailRow({ item }: { item: DetailItem }) {
  return (
    <View style={styles.detailRow}>
      <ThemedText style={styles.detailLabel}>{item.label}</ThemedText>
      <ThemedText style={styles.detailValue}>{item.value}</ThemedText>
      {item.helper ? <ThemedText style={styles.detailHelper}>{item.helper}</ThemedText> : null}
    </View>
  );
});

const CurrentArrivalCard = memo(function CurrentArrivalCard({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: DetailItem[];
}) {
  return (
    <ThemedView style={styles.card}>
      <ThemedText style={styles.cardTitle}>{title}</ThemedText>
      <ThemedText style={styles.cardSubtitle}>{subtitle}</ThemedText>

      <View style={styles.detailBox}>
        {items.map((item, index) => (
          <View key={item.id}>
            <DetailRow item={item} />
            {index !== items.length - 1 ? <View style={styles.detailDivider} /> : null}
          </View>
        ))}
      </View>
    </ThemedView>
  );
});

const EmptyArrivalCard = memo(function EmptyArrivalCard({
  title,
  body,
  actionLabel,
}: {
  title: string;
  body: string;
  actionLabel: string;
}) {
  return (
    <ThemedView style={styles.card}>
      <View style={styles.emptyIcon}>
        <Ionicons name="calendar-outline" size={22} color={UI.primary} />
      </View>

      <ThemedText style={styles.emptyTitle}>{title}</ThemedText>
      <ThemedText style={styles.emptyBody}>{body}</ThemedText>

      <NavButton href={ROUTES.bookingNew} style={styles.secondaryButton}>
        <ThemedText style={styles.secondaryButtonText}>{actionLabel}</ThemedText>
      </NavButton>
    </ThemedView>
  );
});

const QuickActionRow = memo(function QuickActionRow({ item }: { item: QuickAction }) {
  return (
    <NavButton href={item.href} style={styles.quickRow}>
      <View style={styles.quickIcon}>
        <Ionicons name={item.icon} size={18} color={UI.primary} />
      </View>

      <View style={styles.quickCopy}>
        <ThemedText style={styles.quickTitle}>{item.label}</ThemedText>
        <ThemedText style={styles.quickHint}>{item.hint}</ThemedText>
      </View>

      <Ionicons name="chevron-forward" size={17} color={UI.mutedSoft} />
    </NavButton>
  );
});

export default function HomeScreen() {
  const { t } = useTranslation(["home", "booking", "common"]);
  const insets = useSafeAreaInsets();

  const {
    data: bookingsRaw,
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useQuery<Booking[], Error>({
    queryKey: queryKeys.bookings(),
    queryFn: async () => {
      const result = await fetchBookings(undefined as any);
      return result as any;
    },
    staleTime: 15_000,
    retry: 1,
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

  const bookings = useMemo(() => (Array.isArray(bookingsRaw) ? bookingsRaw : []), [bookingsRaw]);
  const facilities = useMemo(() => (Array.isArray(facilitiesRaw) ? facilitiesRaw : []), [facilitiesRaw]);
  const stations = useMemo(() => (Array.isArray(stationsRaw) ? stationsRaw : []), [stationsRaw]);

  const facilityById = useMemo(() => {
    return new Map(facilities.map((facility: any) => [facility.id, facility]));
  }, [facilities]);

  const stationById = useMemo(() => {
    return new Map(stations.map((station: any) => [station.id, station]));
  }, [stations]);

  const active = useMemo(() => getActiveBooking(bookings), [bookings]);

  const activeStation = active ? stationById.get((active as any).stationId) : undefined;
  const resolvedFacilityId = (active as any)?.facilityId ?? activeStation?.facilityId;
  const facilityName =
    normalizeOptionalText((active as any)?.facilityName) ??
    normalizeOptionalText(facilityById.get(resolvedFacilityId ?? "")?.name) ??
    normalizeOptionalText(resolvedFacilityId);

  const stationName =
    normalizeOptionalText((active as any)?.stationName) ??
    normalizeOptionalText(activeStation?.name) ??
    normalizeOptionalText((active as any)?.stationId);

  const arrivalTime = active ? formatArrival((active as any).arrivalTime) : "—";
  const queueEstimate = resolveQueueEstimate(active);

  const statusMeta = getStatusMeta((active as any)?.status, t);
  const reference = active
    ? formatReference((active as any)?.reference ?? (active as any)?.bookingNumber ?? (active as any)?.id)
    : "—";

  const quickActions = useMemo<QuickAction[]>(
    () => [
      {
        id: "map",
        label: t("home:quickFacilityMap", { defaultValue: "Facility map" }),
        hint: t("home:quickFacilityMapHint", { defaultValue: "View facility layout" }),
        href: ROUTES.map,
        icon: "map-outline",
      },
      {
        id: "book",
        label: t("home:quickBookSlot", { defaultValue: "Book slot" }),
        hint: t("home:quickBookSlotHint", { defaultValue: "Plan your arrival" }),
        href: ROUTES.bookingNew,
        icon: "calendar-outline",
      },
      {
        id: "bookings",
        label: t("home:quickBookings", { defaultValue: "My bookings" }),
        hint: t("home:quickBookingsHint", { defaultValue: "Manage upcoming visits" }),
        href: ROUTES.bookings,
        icon: "list-outline",
      },
      {
        id: "issues",
        label: t("home:quickIssue", { defaultValue: "Report issue" }),
        hint: t("home:quickIssueHint", { defaultValue: "Report operational problems" }),
        href: ROUTES.issues,
        icon: "warning-outline",
      },
    ],
    [t],
  );

  const detailItems: DetailItem[] = active
    ? [
        ...(facilityName
          ? [
              {
                id: "facility",
                label: t("home:facility", { defaultValue: "Facility" }),
                value: facilityName,
              },
            ]
          : []),
        {
          id: "arrival",
          label: t("home:estimatedArrival", { defaultValue: "Estimated arrival" }),
          value: arrivalTime,
        },
        ...(stationName
          ? [
              {
                id: "station",
                label: t("home:stationGate", { defaultValue: "Station / Gate" }),
                value: stationName,
              },
            ]
          : []),
        ...(queueEstimate
          ? [
              {
                id: "queue",
                label: t("home:queueEstimate", { defaultValue: "Queue estimate" }),
                value: queueEstimate,
              },
            ]
          : []),
        {
          id: "status",
          label: t("home:currentStatus", { defaultValue: "Current status" }),
          value: statusMeta.label,
        },
      ]
    : [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: 112 + insets.bottom }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={UI.primary}
          />
        }
      >
        {isLoading ? (
          <ThemedView style={styles.loadingCard}>
            <ActivityIndicator color={UI.primary} />
            <ThemedText style={styles.loadingText}>
              {t("booking:loadingBookings", { defaultValue: "Loading bookings..." })}
            </ThemedText>
          </ThemedView>
        ) : (
          <>
            <HeroCard
              title={
                error
                  ? t("home:couldNotLoad", { defaultValue: "Could not load your arrival" })
                  : statusMeta.title
              }
              subtitle={
                error
                  ? t("home:checkConnection", {
                      defaultValue: "Check your connection and try again.",
                    })
                  : statusMeta.subtitle
              }
              statusLabel={
                error
                  ? t("common:error", { defaultValue: "Error" })
                  : statusMeta.label
              }
              statusTone={error ? "danger" : statusMeta.tone}
              reference={reference}
              primaryLabel={
                error
                  ? t("common:retry", { defaultValue: "Retry" })
                  : statusMeta.primaryLabel
              }
              primaryHref={statusMeta.primaryHref}
              eyebrow={t("home:nextAction", { defaultValue: "Next action" })}
              referenceLabel={t("home:bookingReference", { defaultValue: "Booking" })}
            />

            {active ? (
              <CurrentArrivalCard
                title={t("home:currentArrival", { defaultValue: "Current arrival" })}
                subtitle={t("home:currentArrivalSubtitle", {
                  defaultValue: "Current booking, assignment and confirmation details.",
                })}
                items={detailItems}
              />
            ) : (
              <EmptyArrivalCard
                title={
                  error
                    ? t("home:bookingsUnavailable", { defaultValue: "Bookings unavailable" })
                    : t("home:noScheduledVisit", { defaultValue: "No scheduled visit" })
                }
                body={
                  error
                    ? t("home:checkConnection", {
                        defaultValue: "Check your connection and pull to refresh.",
                      })
                    : t("home:bookSlotHint", {
                        defaultValue:
                          "Book a slot to receive arrival time, station assignment and queue updates.",
                      })
                }
                actionLabel={t("home:bookSlot", { defaultValue: "Create booking" })}
              />
            )}
          </>
        )}

        <ThemedView style={styles.card}>
          <ThemedText style={styles.cardTitle}>
            {t("home:quickAccess", { defaultValue: "Quick access" })}
          </ThemedText>

          <View style={styles.quickList}>
            {quickActions.map((item, index) => (
              <View key={item.id}>
                <QuickActionRow item={item} />
                {index !== quickActions.length - 1 ? <View style={styles.quickDivider} /> : null}
              </View>
            ))}
          </View>
        </ThemedView>

        <View style={styles.footerContainer}>
          <ThemedText style={styles.footerSmall}>
            v{appConfig.version} · {t("common:appName", { defaultValue: "Arrivio" })}
          </ThemedText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI.bg,
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 16,
  },

  pressed: {
    opacity: 0.72,
  },

  loadingCard: {
    minHeight: 144,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: UI.borderSoft,
    backgroundColor: UI.card,
    marginBottom: 14,
  },

  loadingText: {
    color: UI.muted,
    fontSize: 13,
    marginTop: 10,
  },

  heroCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: UI.borderSoft,
    backgroundColor: UI.card,
    padding: 16,
    marginBottom: 14,
  },

  heroGlow: {
    position: "absolute",
    right: -42,
    top: -58,
    width: 150,
    height: 150,
    borderRadius: 999,
    backgroundColor: "rgba(43, 140, 255, 0.14)",
  },

  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  eyebrow: {
    color: "#8ec2ff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  statusPill: {
    minHeight: 30,
    maxWidth: 160,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
  },

  statusPillText: {
    fontSize: 10,
    fontWeight: "900",
    marginLeft: 5,
  },

  heroTitle: {
    color: UI.text,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "900",
    letterSpacing: -0.4,
  },

  heroSubtitle: {
    color: UI.text,
    opacity: 0.88,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
    maxWidth: 280,
  },

  heroReference: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: UI.primaryBorder,
    backgroundColor: "rgba(43, 140, 255, 0.08)",
    paddingHorizontal: 12,
    marginTop: 16,
  },

  referenceLabel: {
    color: "#9cc7ff",
    fontSize: 11,
    fontWeight: "800",
  },

  referenceValue: {
    color: UI.text,
    fontSize: 12,
    fontWeight: "900",
  },

  primaryButton: {
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: UI.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },

  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },

  secondaryButton: {
    minHeight: 46,
    borderRadius: 15,
    backgroundColor: UI.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },

  secondaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },

  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.card,
    padding: 16,
    marginBottom: 14,
  },

  cardTitle: {
    color: UI.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
  },

  cardSubtitle: {
    color: UI.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 12,
  },

  detailBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.cardSoft,
    overflow: "hidden",
  },

  detailRow: {
    paddingHorizontal: 13,
    paddingVertical: 10,
  },

  detailLabel: {
    color: UI.muted,
    fontSize: 11,
    marginBottom: 4,
  },

  detailValue: {
    color: UI.text,
    fontSize: 13,
    fontWeight: "900",
  },

  detailHelper: {
    color: UI.mutedSoft,
    fontSize: 10,
    marginTop: 3,
  },

  detailDivider: {
    height: 1,
    backgroundColor: UI.border,
  },

  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: UI.primaryBorder,
    backgroundColor: UI.primarySoft,
    marginBottom: 12,
  },

  emptyTitle: {
    color: UI.text,
    fontSize: 16,
    fontWeight: "900",
  },

  emptyBody: {
    color: UI.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },

  quickList: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.cardSoft,
    overflow: "hidden",
    marginTop: 12,
  },

  quickRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
  },

  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: UI.primaryBorder,
    backgroundColor: UI.primarySoft,
    marginRight: 12,
  },

  quickCopy: {
    flex: 1,
    paddingRight: 12,
  },

  quickTitle: {
    color: UI.text,
    fontSize: 13,
    fontWeight: "900",
  },

  quickHint: {
    color: UI.muted,
    fontSize: 11,
    marginTop: 3,
  },

  quickDivider: {
    height: 1,
    backgroundColor: UI.border,
    marginLeft: 61,
  },

  footerContainer: {
    alignItems: "center",
    paddingTop: 4,
  },

  footer: {
    color: UI.mutedSoft,
    fontSize: 11,
  },

  footerSmall: {
    color: UI.mutedSoft,
    fontSize: 10,
    marginTop: 5,
  },
});
