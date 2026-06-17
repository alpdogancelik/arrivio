// app/(tabs)/bookings/[id].tsx
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import React, { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { cancelBooking, fetchBooking } from "@/api/bookings";
import { mapApiError } from "@/api/errors";
import { fetchFacilities } from "@/api/facilities";
import { fetchIssues } from "@/api/issues";
import { fetchQueueEntries } from "@/api/queue-entries";
import { fetchStationRecommendation } from "@/api/recommendations";
import { fetchStations } from "@/api/stations";
import { queryKeys } from "@/query/keys";

type StatusTone = "neutral" | "warning" | "success" | "danger";

type DetailRowItem = {
  id: string;
  label: string;
  value: string;
  helper?: string;
};

const ROUTES = {
  list: "/(tabs)/bookings" as const,
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
  cardSoft: "#071326",
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

const STATUS_COLORS: Record<StatusTone, { bg: string; border: string; text: string }> = {
  neutral: { bg: COLORS.blueSoft, border: "#2b8cff40", text: COLORS.blueText },
  warning: { bg: COLORS.yellowSoft, border: "#ffd16640", text: COLORS.yellow },
  success: { bg: COLORS.greenSoft, border: "#22c55e40", text: COLORS.green },
  danger: { bg: COLORS.redSoft, border: "#ef444440", text: COLORS.red },
};

const tone = (status?: string): StatusTone => {
  switch ((status ?? "").toLowerCase()) {
    case "confirmed":
    case "arrived":
    case "servicing":
    case "completed":
      return "success";
    case "pending":
      return "warning";
    case "cancelled":
      return "danger";
    default:
      return "neutral";
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

const normalizeOptionalText = (value: unknown) => {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const lowered = trimmed.toLowerCase();
  if (lowered === "unknown" || lowered === "undefined" || lowered === "null") {
    return null;
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

const formatSlot = (slot?: string) => (typeof slot === "string" && slot.trim() ? slot.trim() : null);

const formatBookingId = (id?: string) => {
  const raw = String(id ?? "").trim();
  if (!raw) return "----";

  const digits = raw.replace(/\D/g, "");
  if (digits) return digits.slice(-4).padStart(4, "0");

  const clean = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return clean ? clean.slice(-6) : "----";
};

const statusLabel = (status: unknown) => {
  const raw = String(status ?? "pending").trim();
  return raw ? raw.replace(/_/g, " ").toUpperCase() : "PENDING";
};

const Header = memo(function Header(props: { title: string; onBack: () => void }) {
  const { title, onBack } = props;

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

      <Text style={styles.headerTitle}>{title}</Text>

      <View style={styles.headerSpacer} />
    </View>
  );
});

const StatusPill = memo(function StatusPill(props: { label: string; toneName: StatusTone }) {
  const palette = STATUS_COLORS[props.toneName];

  return (
    <View style={[styles.statusPill, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={[styles.statusPillText, { color: palette.text }]} numberOfLines={1}>
        {props.label}
      </Text>
    </View>
  );
});

const SummaryCard = memo(function SummaryCard(props: {
  station: string;
  facility?: string | null;
  arrival: string;
  bookingId: string;
  status: string;
  statusTone: StatusTone;
  labels: {
    eyebrow: string;
    arrival: string;
    reference: string;
  };
}) {
  const { station, facility, arrival, bookingId, status, statusTone, labels } = props;

  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryGlow} />

      <View style={styles.summaryTop}>
        <View style={styles.summaryTitleWrap}>
          <Text style={styles.summaryEyebrow}>{labels.eyebrow}</Text>
          <Text style={styles.summaryStation} numberOfLines={2}>
            {station}
          </Text>
          {facility ? (
            <Text style={styles.summaryFacility} numberOfLines={1}>
              {facility}
            </Text>
          ) : null}
        </View>

        <StatusPill label={status} toneName={statusTone} />
      </View>

      <View style={styles.summaryMetaGrid}>
        <View style={styles.summaryMetaItem}>
          <Text style={styles.metaLabel}>{labels.arrival}</Text>
          <Text style={styles.metaValue} numberOfLines={2}>
            {arrival}
          </Text>
        </View>

        <View style={styles.summaryMetaItem}>
          <Text style={styles.metaLabel}>{labels.reference}</Text>
          <Text style={styles.metaValue}>#{bookingId}</Text>
        </View>
      </View>
    </View>
  );
});

const DetailListCard = memo(function DetailListCard(props: {
  title: string;
  caption?: string;
  rows: DetailRowItem[];
}) {
  const { title, caption, rows } = props;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {caption ? <Text style={styles.cardCaption}>{caption}</Text> : null}

      <View style={styles.detailList}>
        {rows.map((row, index) => (
          <React.Fragment key={row.id}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{row.label}</Text>
              <Text style={styles.detailValue}>{row.value}</Text>
              {row.helper ? <Text style={styles.detailHelper}>{row.helper}</Text> : null}
            </View>

            {index < rows.length - 1 ? <View style={styles.divider} /> : null}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
});

const ActionsCard = memo(function ActionsCard(props: {
  canManage: boolean;
  bookingStatus: string;
  cancelPending: boolean;
  onCancel: () => void;
  labels: {
    title: string;
    cancel: string;
    cancelling: string;
    cancelled: string;
    completed: string;
  };
}) {
  const { canManage, bookingStatus, cancelPending, onCancel, labels } = props;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{labels.title}</Text>

      {canManage ? (
        <View style={styles.actionStack}>
          <Pressable
            onPress={onCancel}
            disabled={cancelPending}
            accessibilityRole="button"
            accessibilityLabel={labels.cancel}
            style={({ pressed }) => [
              styles.actionButton,
              styles.actionDanger,
              cancelPending ? styles.actionDisabled : null,
              pressed && !cancelPending ? styles.pressed : null,
            ]}
          >
            <Text style={styles.actionDangerText}>{cancelPending ? labels.cancelling : labels.cancel}</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.cardCaption}>
          {bookingStatus === "cancelled" ? labels.cancelled : labels.completed}
        </Text>
      )}
    </View>
  );
});

const StateView = memo(function StateView(props: {
  title: string;
  body: string;
  mode?: "loading" | "error";
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
}) {
  const { title, body, mode = "error", primaryLabel, secondaryLabel, onPrimary, onSecondary } = props;

  return (
    <View style={styles.stateWrap}>
      <View style={styles.stateCard}>
        <View style={[styles.stateIcon, mode === "error" ? styles.stateIconError : null]}>
          {mode === "loading" ? (
            <ActivityIndicator color={COLORS.blue} />
          ) : (
            <Ionicons name="warning-outline" size={24} color={COLORS.red} />
          )}
        </View>

        <Text style={styles.stateTitle}>{title}</Text>
        <Text style={styles.stateBody}>{body}</Text>

        {primaryLabel || secondaryLabel ? (
          <View style={styles.stateActions}>
            {secondaryLabel && onSecondary ? (
              <Pressable
                onPress={onSecondary}
                style={({ pressed }) => [styles.stateButton, pressed ? styles.pressed : null]}
              >
                <Text style={styles.stateButtonText}>{secondaryLabel}</Text>
              </Pressable>
            ) : null}

            {primaryLabel && onPrimary ? (
              <Pressable
                onPress={onPrimary}
                style={({ pressed }) => [styles.stateButton, styles.stateButtonPrimary, pressed ? styles.pressed : null]}
              >
                <Text style={styles.stateButtonPrimaryText}>{primaryLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
});

export default function BookingDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { t, i18n } = useTranslation(["booking", "common", "issue"]);
  const locale = i18n.resolvedLanguage || i18n.language || undefined;
  const notScheduledLabel = t("booking:notScheduled", { defaultValue: "Not scheduled" });

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
      facilityName: data.facilityName ?? facilityById.get(resolvedFacilityId ?? "")?.name ?? station?.facilityId,
      stationName: data.stationName ?? station?.name,
    };
  }, [data, facilityById, stationById]);

  const resolvedFacilityId = booking?.facilityId;
  const arrivalOrSlot = String(booking?.arrivalTime ?? booking?.slot ?? "");

  const cancelMut = useMutation({
    mutationFn: (bid: string) => cancelBooking(bid),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.booking(bookingId) }),
        qc.invalidateQueries({ queryKey: queryKeys.bookings() }),
      ]);

      Alert.alert(
        t("booking:bookingCancelledTitle", { defaultValue: "Booking cancelled" }),
        t("booking:bookingCancelledBody", { defaultValue: "The booking has been cancelled." }),
      );

      router.replace(ROUTES.list as Href);
    },
    onError: (e) => {
      const err = mapApiError(e);
      Alert.alert(t("booking:cancelFailed", { defaultValue: "Cancel failed" }), err.message);
    },
  });

  const confirmCancel = () => {
    const title = t("booking:cancelBooking", { defaultValue: "Cancel booking" });
    const message = t("booking:cancelBookingConfirm", {
      defaultValue: "Are you sure you want to cancel this booking?",
    });

    if (Platform.OS === "web" && typeof window !== "undefined") {
      const confirmed = window.confirm(message);
      const idToCancel = booking?.firestoreId ?? bookingId;
      if (confirmed && idToCancel) cancelMut.mutate(idToCancel);
      return;
    }

    Alert.alert(title, message, [
      { text: t("common:no", { defaultValue: "No" }), style: "cancel" },
      {
        text: t("booking:cancelBookingConfirmCta", { defaultValue: "Cancel booking" }),
        style: "destructive",
        onPress: () => {
          const idToCancel = booking?.firestoreId ?? bookingId;
          if (idToCancel) cancelMut.mutate(idToCancel);
        },
      },
    ]);
  };

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

  const issues = useMemo(() => (Array.isArray(issuesRaw) ? issuesRaw : []), [issuesRaw]);

  const latestQueueEntry = useMemo(
    () =>
      (Array.isArray(queueEntriesRaw) ? queueEntriesRaw : [])
        .slice()
        .sort((a: any, b: any) => {
          const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        })[0],
    [queueEntriesRaw],
  );

  if (!bookingId) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <Header title={t("booking:bookingDetails", { defaultValue: "Booking details" })} onBack={() => router.back()} />

        <StateView
          title={t("booking:missingBookingId", { defaultValue: "Missing booking ID" })}
          body={t("booking:missingBookingIdBody", {
            defaultValue: "This booking could not be opened because the ID is missing.",
          })}
          primaryLabel={t("booking:backToBookings", { defaultValue: "Back to bookings" })}
          onPrimary={() => router.replace(ROUTES.list as Href)}
        />
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <Header title={t("booking:bookingDetails", { defaultValue: "Booking details" })} onBack={() => router.back()} />

        <StateView
          mode="loading"
          title={t("common:loading", { defaultValue: "Loading" })}
          body={t("booking:loadingBooking", { defaultValue: "Loading booking details..." })}
        />
      </SafeAreaView>
    );
  }

  if (error || !booking) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <Header title={t("booking:bookingDetails", { defaultValue: "Booking details" })} onBack={() => router.back()} />

        <StateView
          title={t("booking:unableToLoadBooking", { defaultValue: "Unable to load booking" })}
          body={
            error instanceof Error
              ? error.message
              : t("common:unexpectedError", { defaultValue: "Unexpected error" })
          }
          secondaryLabel={t("common:retry", { defaultValue: "Retry" })}
          onSecondary={() => refetch()}
          primaryLabel={t("booking:backToBookings", { defaultValue: "Back to bookings" })}
          onPrimary={() => router.replace(ROUTES.list as Href)}
        />
      </SafeAreaView>
    );
  }

  const bookingStatus = String(booking.status ?? "pending").toLowerCase();
  const canManageBooking = bookingStatus !== "cancelled" && bookingStatus !== "completed";
  const bookingShortId = formatBookingId(String(booking.id ?? bookingId));
  const badgeTone = tone(booking.status);

  const stationLabel = normalizeText(
    booking.stationName ?? booking.stationId,
    t("booking:stationPending", { defaultValue: "Station pending" }),
  );

  const facilityLabel = normalizeOptionalText(booking.facilityName ?? booking.facilityId);

  const arrivalLabel = formatWhen(booking.arrivalTime, locale, notScheduledLabel);
  const slotLabel = formatSlot(booking.slot ?? undefined);

  const recommendedStationId = String(
    booking.recommendedStationId ?? recoData?.suggestedStationId ?? "",
  ).trim();
  const isClosedBooking = bookingStatus === "cancelled" || bookingStatus === "completed";
  const closedQueueLabel =
    bookingStatus === "cancelled"
      ? t("booking:status.cancelled", { defaultValue: "Cancelled" })
      : t("booking:status.completed", { defaultValue: "Completed" });

  const liveRows: DetailRowItem[] = [
    {
      id: "queue",
      label: t("booking:queueStatus", { defaultValue: "Queue status" }),
      value: isClosedBooking
        ? closedQueueLabel
        : latestQueueEntry
        ? normalizeText(latestQueueEntry.status, t("booking:queueEntryActive", { defaultValue: "Queue entry active" }))
        : t("booking:notJoinedQueue", { defaultValue: "Not joined yet" }),
      helper: isClosedBooking
        ? t("booking:closedQueueState", {
          defaultValue:
            bookingStatus === "cancelled"
              ? "This booking was cancelled."
              : "This booking was completed.",
        })
        : latestQueueEntry?.createdAt
        ? t("booking:queueEntryCreatedAt", {
          time: formatWhen(latestQueueEntry.createdAt, locale, notScheduledLabel),
          defaultValue: `Updated: ${formatWhen(latestQueueEntry.createdAt, locale, notScheduledLabel)}`,
        })
        : t("booking:noQueueEntry", { defaultValue: "No queue entry found for this booking." }),
    },
    ...(recommendedStationId
      ? [
        {
          id: "recommendation",
          label: t("booking:recommendation", { defaultValue: "Recommendation" }),
          value: t("booking:recommendedStation", {
            station: recommendedStationId,
            defaultValue: `Recommended: ${recommendedStationId}`,
          }),
          helper:
            typeof booking.recommendedWaitMin === "number"
              ? t("booking:estWait", {
                count: booking.recommendedWaitMin,
                defaultValue: `Est. wait: ${booking.recommendedWaitMin} min`,
              })
              : undefined,
        },
      ]
      : []),
    ...(issues.length
      ? [
        {
          id: "issues",
          label: t("issue:recentIssues", { defaultValue: "Issues" }),
          value: t("issue:issueCount", {
            count: issues.length,
            defaultValue: `${issues.length} issue${issues.length > 1 ? "s" : ""}`,
          }),
          helper: `${t(`issue:${String(issues[0]?.category ?? "other")}`, {
            defaultValue: String(issues[0]?.category ?? t("issue:title", { defaultValue: "Issue" })),
          })} - ${t(`issue:status.${String(issues[0]?.status ?? "open").toLowerCase()}`, {
            defaultValue: t("issue:status.open", { defaultValue: "Open" }),
          })}`,
        },
      ]
      : []),
  ];

  const detailRows: DetailRowItem[] = [
    {
      id: "arrival",
      label: t("booking:arrivalTime", { defaultValue: "Arrival time" }),
      value: arrivalLabel,
    },
    {
      id: "slot",
      label: t("booking:slot", { defaultValue: "Slot" }),
      value: slotLabel ?? t("booking:slotPending", { defaultValue: "No slot label" }),
    },
    ...(facilityLabel
      ? [
        {
          id: "facility",
          label: t("booking:facility", { defaultValue: "Facility" }),
          value: facilityLabel,
        },
      ]
      : []),
    {
      id: "station",
      label: t("booking:station", { defaultValue: "Station" }),
      value: stationLabel,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <Header title={t("booking:bookingDetails", { defaultValue: "Booking details" })} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <SummaryCard
          station={stationLabel}
          facility={facilityLabel}
          arrival={arrivalLabel}
          bookingId={bookingShortId}
          status={t(`booking:status.${bookingStatus}`, {
            defaultValue: statusLabel(booking.status),
          })}
          statusTone={badgeTone}
          labels={{
            eyebrow: t("booking:summaryEyebrow", { defaultValue: "Booking" }),
            arrival: t("booking:arrival", { defaultValue: "Arrival" }),
            reference: t("booking:reference", { defaultValue: "Reference" }),
          }}
        />

        <DetailListCard
          title={t("booking:details", { defaultValue: "Details" })}
          caption={t("booking:detailsCaption", {
            defaultValue: "Arrival, facility, and station information for this booking.",
          })}
          rows={detailRows}
        />

        <DetailListCard
          title={t("booking:liveStatus", { defaultValue: "Live status" })}
          caption={t("booking:liveStatusCaption", {
            defaultValue: "Queue state for this booking.",
          })}
          rows={liveRows}
        />

        <ActionsCard
          canManage={canManageBooking}
          bookingStatus={bookingStatus}
          cancelPending={cancelMut.isPending}
          onCancel={confirmCancel}
          labels={{
            title: t("common:actions", { defaultValue: "Actions" }),
            cancel: t("booking:cancelBooking", { defaultValue: "Cancel booking" }),
            cancelling: t("booking:cancelBookingLoading", { defaultValue: "Cancelling..." }),
            cancelled: t("booking:bookingAlreadyCancelled", {
              defaultValue: "This booking has already been cancelled.",
            }),
            completed: t("booking:bookingAlreadyCompleted", {
              defaultValue: "This booking is already completed.",
            }),
          }}
        />
      </ScrollView>
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
  headerTitle: {
    flex: 1,
    minWidth: 0,
    color: COLORS.text,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "700",
    textAlign: "center",
    paddingHorizontal: 12,
  },
  headerSpacer: {
    width: 42,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },

  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 104,
  },

  summaryCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.card,
    padding: 16,
  },
  summaryGlow: {
    position: "absolute",
    right: -70,
    top: -96,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "#2b8cff1c",
  },
  summaryTop: {
    position: "relative",
    zIndex: 2,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  summaryTitleWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  summaryEyebrow: {
    color: COLORS.blueText,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    letterSpacing: 0.8,
    marginBottom: 9,
  },
  summaryStation: {
    color: COLORS.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  summaryFacility: {
    color: COLORS.textSoft,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 5,
  },
  statusPill: {
    maxWidth: 152,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  summaryMetaGrid: {
    flexDirection: "row",
    marginHorizontal: -5,
    marginTop: 16,
  },
  summaryMetaItem: {
    flex: 1,
    minHeight: 62,
    marginHorizontal: 5,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.lineSoft,
    backgroundColor: "#070b1288",
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
  },
  metaLabel: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
  metaValue: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "600",
    marginTop: 3,
  },

  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.card,
    padding: 16,
    marginTop: 14,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
    letterSpacing: -0.15,
  },
  cardCaption: {
    color: COLORS.textSoft,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
    marginBottom: 13,
  },
  detailList: {
    overflow: "hidden",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.lineSoft,
    backgroundColor: "#070b1288",
  },
  detailRow: {
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: "center",
  },
  detailLabel: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
  detailValue: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
    marginTop: 3,
  },
  detailHelper: {
    color: COLORS.textSoft,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.lineSoft,
  },

  actionStack: {
    marginTop: 14,
  },
  actionButton: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  actionDanger: {
    borderColor: "#ef444440",
    backgroundColor: "#b91c1c",
  },
  actionDangerText: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
  actionDisabled: {
    opacity: 0.65,
  },

  stateWrap: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
    paddingBottom: 72,
  },
  stateCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.card,
    padding: 18,
    alignItems: "center",
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
    marginBottom: 14,
  },
  stateIconError: {
    borderColor: "#ef444440",
    backgroundColor: COLORS.redSoft,
  },
  stateTitle: {
    color: COLORS.text,
    fontSize: 18,
    lineHeight: 23,
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
});
