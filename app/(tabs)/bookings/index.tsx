// app/(tabs)/bookings/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter, type Href } from "expo-router";
import React, { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { fetchBookings } from "@/api/bookings";
import { fetchFacilities } from "@/api/facilities";
import { fetchStations } from "@/api/stations";
import { queryKeys } from "@/query/keys";

type BookingLike = {
  id?: string;
  firestoreId?: string;
  stationName?: string;
  stationId?: string;
  facilityName?: string;
  facilityId?: string;
  arrivalTime?: string;
  status?: string;
  etaMinutes?: number;
};

type SectionProps = {
  title: string;
  caption?: string;
  children: React.ReactNode;
};

const ROUTES = {
  newBooking: "/(tabs)/bookings/new" as const,
  detail: (id: string) =>
    ({
      pathname: "/(tabs)/bookings/[id]",
      params: { id },
    }) as const,
};

const COLORS = {
  bg: "#07080a",
  card: "#0b0f16",
  cardRaised: "#0f141d",
  line: "#1a2435",
  lineSoft: "#121a28",
  text: "#f8fafc",
  textSoft: "#b6bfcc",
  muted: "#7f8795",
  blue: "#2b8cff",
  blueText: "#9bbcff",
  blueSoft: "#2b8cff18",
  green: "#22c55e",
  greenSoft: "#22c55e18",
  yellow: "#ffd166",
  yellowSoft: "#ffd16618",
  red: "#ef4444",
  redSoft: "#ef444418",
};

const statusTone = (status?: string) => {
  switch ((status ?? "").toLowerCase()) {
    case "confirmed":
    case "arrived":
    case "servicing":
      return { fg: COLORS.green, bg: COLORS.greenSoft, bd: "#22c55e40" };
    case "pending":
      return { fg: COLORS.yellow, bg: COLORS.yellowSoft, bd: "#ffd16640" };
    case "cancelled":
      return { fg: COLORS.red, bg: COLORS.redSoft, bd: "#ef444440" };
    case "completed":
      return { fg: COLORS.blueText, bg: COLORS.blueSoft, bd: "#2b8cff40" };
    default:
      return { fg: COLORS.blueText, bg: COLORS.blueSoft, bd: "#2b8cff40" };
  }
};

const normalizeText = (value: unknown, fallback: string) => {
  if (typeof value !== "string") return fallback;

  const trimmed = value.trim();
  if (!trimmed) return fallback;

  const lowered = trimmed.toLowerCase();
  if (lowered === "unknown" || lowered === "undefined" || lowered === "null") {
    return fallback;
  }

  return trimmed;
};

const formatWhen = (iso: string | undefined, locale: string | undefined, fallback: string) => {
  if (!iso) return fallback;

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;

  return d.toLocaleString(locale || undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatBookingId = (id?: string) => {
  const raw = String(id ?? "").trim();
  if (!raw) return "----";

  const digits = raw.replace(/\D/g, "");
  if (digits) return digits.slice(-4).padStart(4, "0");

  const clean = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return clean ? clean.slice(-6) : "----";
};

const isActiveBooking = (booking: BookingLike) => {
  const status = String(booking.status ?? "").toLowerCase();
  return status !== "cancelled" && status !== "completed";
};

const Header = memo(function Header(props: {
  title: string;
  subtitle: string;
  onBack: () => void;
  onCreate: () => void;
}) {
  const { title, subtitle, onBack, onCreate } = props;

  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={22} color={COLORS.text} />
      </Pressable>

      <View style={styles.headerCopy}>
        <Text style={styles.headerTitle}>{title}</Text>
        <Text style={styles.headerSubtitle}>{subtitle}</Text>
      </View>

      <Pressable
        onPress={onCreate}
        style={({ pressed }) => [styles.iconButton, styles.iconButtonPrimary, pressed ? styles.pressed : null]}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Create new booking"
      >
        <Ionicons name="add" size={22} color={COLORS.text} />
      </Pressable>
    </View>
  );
});

const OverviewCard = memo(function OverviewCard(props: {
  total: number;
  active: number;
  cancelled: number;
  loading: boolean;
  title: string;
  badge: string;
  labels: {
    total: string;
    active: string;
    cancelled: string;
  };
}) {
  const { total, active, cancelled, loading, title, badge, labels } = props;

  return (
    <View style={styles.overviewCard}>
      <View style={styles.overviewGlow} />

      <View style={styles.overviewHeader}>
        <Text style={styles.overviewTitle}>{title}</Text>
        <View style={styles.overviewPill}>
          <Text style={styles.overviewPillText}>{badge}</Text>
        </View>
      </View>

      <View style={styles.kpiRow}>
        <View style={styles.kpiItem}>
          <Text style={styles.kpiLabel}>{labels.total}</Text>
          <Text style={styles.kpiValue}>{loading ? "-" : total}</Text>
        </View>

        <View style={styles.kpiDivider} />

        <View style={styles.kpiItem}>
          <Text style={styles.kpiLabel}>{labels.active}</Text>
          <Text style={styles.kpiValue}>{loading ? "-" : active}</Text>
        </View>

        <View style={styles.kpiDivider} />

        <View style={styles.kpiItem}>
          <Text style={styles.kpiLabel}>{labels.cancelled}</Text>
          <Text style={styles.kpiValue}>{loading ? "-" : cancelled}</Text>
        </View>
      </View>
    </View>
  );
});

const Section = memo(function Section({ title, caption, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {caption ? <Text style={styles.sectionCaption}>{caption}</Text> : null}
      </View>

      {children}
    </View>
  );
});

const StatusPill = memo(function StatusPill(props: { status?: string; label: string; muted?: boolean }) {
  const tone = statusTone(props.status);

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: props.muted ? "#111827" : tone.bg,
          borderColor: props.muted ? COLORS.line : tone.bd,
        },
      ]}
    >
      <Text style={[styles.badgeText, { color: props.muted ? COLORS.muted : tone.fg }]} numberOfLines={1}>
        {props.label}
      </Text>
    </View>
  );
});

const BookingCard = memo(function BookingCard(props: {
  booking: BookingLike;
  muted?: boolean;
  onPress: () => void;
  labels: {
    stationFallback: string;
    facilityFallback: string;
    bookingLabel: string;
    notScheduled: string;
    locale?: string;
  };
  statusLabel: string;
}) {
  const { booking, muted, onPress, labels, statusLabel } = props;
  const stationName = normalizeText(booking.stationName ?? booking.stationId, labels.stationFallback);
  const facilityName = normalizeText(booking.facilityName ?? booking.facilityId, labels.facilityFallback);
  const bookingRef = `#${formatBookingId(booking.id)}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${stationName} ${statusLabel}`}
      style={({ pressed }) => [styles.cardPress, pressed ? styles.pressed : null]}
    >
      <View style={[styles.bookingCard, muted ? styles.bookingCardMuted : null]}>
        <View style={styles.cardTop}>
          <View style={[styles.cardIcon, muted ? styles.cardIconMuted : null]}>
            <Ionicons name="location-outline" size={18} color={muted ? COLORS.muted : COLORS.blue} />
          </View>

          <View style={styles.cardCopy}>
            <Text style={[styles.cardTitle, muted ? styles.textMutedStrong : null]} numberOfLines={1}>
              {stationName}
            </Text>
            <Text style={styles.cardSub} numberOfLines={1}>
              {labels.bookingLabel} {bookingRef}
            </Text>
          </View>

          <StatusPill status={booking.status} label={statusLabel} muted={muted} />
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={15} color={COLORS.muted} />
            <Text style={[styles.metaText, muted ? styles.textMuted : null]} numberOfLines={1}>
              {formatWhen(booking.arrivalTime, labels.locale, labels.notScheduled)}
            </Text>
          </View>
        </View>

        <Text style={styles.facilityLine} numberOfLines={1}>
          {facilityName}
        </Text>
      </View>
    </Pressable>
  );
});

const EmptyState = memo(function EmptyState(props: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  const { title, body, actionLabel, onAction } = props;

  return (
    <View style={styles.stateCard}>
      <View style={styles.stateIcon}>
        <Ionicons name="calendar-outline" size={24} color={COLORS.blue} />
      </View>

      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateBody}>{body}</Text>

      <Pressable
        onPress={onAction}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        style={({ pressed }) => [styles.stateButton, styles.stateButtonPrimary, pressed ? styles.pressed : null]}
      >
        <Text style={styles.stateButtonPrimaryText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
});

const ErrorState = memo(function ErrorState(props: {
  title: string;
  body: string;
  retryLabel: string;
  createLabel: string;
  onRetry: () => void;
  onCreate: () => void;
}) {
  const { title, body, retryLabel, createLabel, onRetry, onCreate } = props;

  return (
    <View style={styles.stateCard}>
      <View style={[styles.stateIcon, styles.stateIconDanger]}>
        <Ionicons name="warning-outline" size={24} color={COLORS.red} />
      </View>

      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateBody}>{body}</Text>

      <View style={styles.stateActions}>
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
          style={({ pressed }) => [styles.stateButton, pressed ? styles.pressed : null]}
        >
          <Text style={styles.stateButtonText}>{retryLabel}</Text>
        </Pressable>

        <Pressable
          onPress={onCreate}
          accessibilityRole="button"
          accessibilityLabel={createLabel}
          style={({ pressed }) => [styles.stateButton, styles.stateButtonPrimary, pressed ? styles.pressed : null]}
        >
          <Text style={styles.stateButtonPrimaryText}>{createLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
});

export default function BookingsIndexScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation(["booking", "common"]);
  const locale = i18n.resolvedLanguage || i18n.language || undefined;

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: queryKeys.bookings(),
    queryFn: () => fetchBookings(),
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

  const bookings = useMemo<BookingLike[]>(() => (Array.isArray(data) ? (data as BookingLike[]) : []), [data]);
  const facilities = useMemo(() => (Array.isArray(facilitiesRaw) ? facilitiesRaw : []), [facilitiesRaw]);
  const stations = useMemo(() => (Array.isArray(stationsRaw) ? stationsRaw : []), [stationsRaw]);

  const facilityById = useMemo(() => new Map(facilities.map((facility) => [facility.id, facility])), [facilities]);
  const stationById = useMemo(() => new Map(stations.map((station) => [station.id, station])), [stations]);

  const enriched = useMemo<BookingLike[]>(() => {
    return bookings.map((booking) => {
      const station = stationById.get(booking.stationId ?? "");
      const resolvedFacilityId = booking.facilityId ?? station?.facilityId;

      return {
        ...booking,
        facilityName:
          booking.facilityName ?? facilityById.get(resolvedFacilityId ?? "")?.name ?? station?.facilityId,
        stationName: booking.stationName ?? station?.name,
      };
    });
  }, [bookings, facilityById, stationById]);

  const sorted = useMemo(() => {
    const copy = [...enriched];

    copy.sort((a, b) => {
      const aActive = isActiveBooking(a);
      const bActive = isActiveBooking(b);

      if (aActive !== bActive) return aActive ? -1 : 1;

      const ta = a.arrivalTime ? new Date(a.arrivalTime).getTime() : 0;
      const tb = b.arrivalTime ? new Date(b.arrivalTime).getTime() : 0;

      return tb - ta;
    });

    return copy;
  }, [enriched]);

  const activeBookings = useMemo(() => sorted.filter(isActiveBooking), [sorted]);
  const historyBookings = useMemo(() => sorted.filter((booking) => !isActiveBooking(booking)), [sorted]);

  const stats = useMemo(() => {
    const total = enriched.length;
    const cancelled = enriched.filter((b) => (b.status ?? "").toLowerCase() === "cancelled").length;
    const active = enriched.filter(isActiveBooking).length;
    return { total, active, cancelled };
  }, [enriched]);

  const goNewBooking = () => router.push(ROUTES.newBooking as Href);

  const openBooking = (booking?: BookingLike) => {
    const id = booking?.firestoreId ?? booking?.id;
    if (!id) return;
    router.push(ROUTES.detail(id) as Href);
  };

  const getStatusLabel = (status?: string) => {
    const statusKey = String(status ?? "pending").toLowerCase();

    return t(`booking:status.${statusKey}`, {
      defaultValue: t("booking:status.pending", { defaultValue: "Pending" }),
    });
  };

  const cardLabels = {
    stationFallback: t("booking:stationFallback", { defaultValue: "Station pending" }),
    facilityFallback: t("booking:facilityFallback", { defaultValue: "Facility details pending" }),
    bookingLabel: t("booking:booking", { defaultValue: "Booking" }),
    notScheduled: t("booking:notScheduled", { defaultValue: "Not scheduled" }),
    locale,
  };

  const errorBody = error
    ? error instanceof Error
      ? error.message
      : t("common:unexpectedError", { defaultValue: "Unexpected error" })
    : "";

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />

      <Header
        title={t("booking:myBookings", { defaultValue: "My bookings" })}
        subtitle={t("booking:scheduled", { defaultValue: "Planned arrivals" })}
        onBack={() => router.back()}
        onCreate={goNewBooking}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.blue} />
        }
      >
        <OverviewCard
          title={t("booking:bookingOverview", { defaultValue: "Booking overview" })}
          badge={t("booking:allRecords", { defaultValue: "All records" })}
          loading={isLoading}
          total={stats.total}
          active={stats.active}
          cancelled={stats.cancelled}
          labels={{
            total: t("booking:total", { defaultValue: "Total" }),
            active: t("booking:active", { defaultValue: "Active" }),
            cancelled: t("booking:cancelled", { defaultValue: "Cancelled" }),
          }}
        />

        {error ? (
          <ErrorState
            title={t("booking:bookingsCouldNotLoad", { defaultValue: "Bookings could not load" })}
            body={errorBody}
            retryLabel={t("common:retry", { defaultValue: "Retry" })}
            createLabel={t("booking:createBooking", { defaultValue: "Create booking" })}
            onRetry={refetch}
            onCreate={goNewBooking}
          />
        ) : null}

        {!error && !isLoading && sorted.length === 0 ? (
          <EmptyState
            title={t("booking:noBookings", { defaultValue: "No bookings yet" })}
            body={t("booking:noBookingsBody", {
              defaultValue: "Create your first arrival booking to receive station and queue updates.",
            })}
            actionLabel={t("booking:newBooking", { defaultValue: "New booking" })}
            onAction={goNewBooking}
          />
        ) : null}

        {activeBookings.length > 0 ? (
          <Section
            title={t("booking:activeBookings", { defaultValue: "Active bookings" })}
            caption={t("booking:activeBookingsCaption", {
              defaultValue: "Current and upcoming arrivals appear first.",
            })}
          >
            {activeBookings.map((booking) => (
              <BookingCard
                key={booking.id ?? `${booking.arrivalTime}-${booking.stationId}`}
                booking={booking}
                labels={cardLabels}
                statusLabel={getStatusLabel(booking.status)}
                onPress={() => openBooking(booking)}
              />
            ))}
          </Section>
        ) : null}

        {historyBookings.length > 0 ? (
          <Section
            title={t("booking:historyBookings", { defaultValue: "History" })}
            caption={t("booking:historyBookingsCaption", {
              defaultValue: "Cancelled and completed bookings are shown in a muted list.",
            })}
          >
            {historyBookings.map((booking) => (
              <BookingCard
                key={booking.id ?? `${booking.arrivalTime}-${booking.stationId}`}
                booking={booking}
                muted
                labels={cardLabels}
                statusLabel={getStatusLabel(booking.status)}
                onPress={() => openBooking(booking)}
              />
            ))}
          </Section>
        ) : null}
      </ScrollView>

      {isLoading ? (
        <View style={styles.loadingFloat}>
          <ActivityIndicator color={COLORS.blue} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.card,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonPrimary: {
    borderColor: "#2b8cff40",
    backgroundColor: COLORS.blueSoft,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    paddingHorizontal: 12,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 1,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },

  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 104,
  },

  overviewCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.card,
    padding: 16,
  },
  overviewGlow: {
    position: "absolute",
    right: -82,
    top: -96,
    width: 184,
    height: 184,
    borderRadius: 999,
    backgroundColor: "#2b8cff18",
  },
  overviewHeader: {
    position: "relative",
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  overviewTitle: {
    color: COLORS.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
  },
  overviewPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#2b8cff40",
    backgroundColor: COLORS.blueSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  overviewPillText: {
    color: COLORS.blueText,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  kpiRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  kpiItem: {
    flex: 1,
    alignItems: "center",
    minWidth: 0,
  },
  kpiDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.lineSoft,
  },
  kpiLabel: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  kpiValue: {
    color: COLORS.text,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "700",
    marginTop: 3,
  },

  section: {
    marginTop: 18,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
  },
  sectionCaption: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },

  cardPress: {
    marginTop: 10,
  },
  bookingCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.card,
    padding: 14,
  },
  bookingCardMuted: {
    opacity: 0.82,
    backgroundColor: "#090d13",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#22324f",
    backgroundColor: COLORS.blueSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardIconMuted: {
    borderColor: COLORS.line,
    backgroundColor: COLORS.cardRaised,
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  textMutedStrong: {
    color: COLORS.textSoft,
  },
  cardSub: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
  },
  badge: {
    maxWidth: 118,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "700",
    letterSpacing: 0.7,
  },
  cardDivider: {
    height: 1,
    backgroundColor: COLORS.lineSoft,
    marginVertical: 11,
  },
  metaGrid: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: -4,
  },
  metaItem: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  metaText: {
    flex: 1,
    minWidth: 0,
    color: COLORS.textSoft,
    fontSize: 12,
    lineHeight: 17,
    marginLeft: 6,
  },
  textMuted: {
    color: COLORS.muted,
  },
  facilityLine: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },

  stateCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.card,
    padding: 16,
    alignItems: "center",
    marginTop: 16,
  },
  stateIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2b8cff40",
    backgroundColor: COLORS.blueSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  stateIconDanger: {
    borderColor: "#ef444440",
    backgroundColor: COLORS.redSoft,
  },
  stateTitle: {
    color: COLORS.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  stateBody: {
    color: COLORS.textSoft,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 6,
  },
  stateActions: {
    width: "100%",
    flexDirection: "row",
    marginTop: 16,
  },
  stateButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.cardRaised,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    marginHorizontal: 4,
  },
  stateButtonPrimary: {
    borderColor: COLORS.blue,
    backgroundColor: COLORS.blue,
  },
  stateButtonText: {
    color: COLORS.blueText,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  stateButtonPrimaryText: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    textAlign: "center",
  },

  loadingFloat: {
    position: "absolute",
    top: 14,
    right: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.card,
    padding: 10,
  },
});
