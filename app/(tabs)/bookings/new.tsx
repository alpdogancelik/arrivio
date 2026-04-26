// app/(tabs)/bookings/new.tsx
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Href, Stack, useRouter } from "expo-router";
import React, { memo, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { fetchBookings } from "@/api/bookings";
import { fetchFacilities } from "@/api/facilities";
import { enterQueue, fetchStationsMM1ForSlotStart } from "@/api/MM1";
import { fetchStations } from "@/api/stations";
import { useAuth } from "@/components/auth-context";
import { queryKeys } from "@/query/keys";

const ROUTES = {
  list: "/(tabs)/bookings" as const,
  detail: (id: string) =>
  ({
    pathname: "/(tabs)/bookings/[id]",
    params: { id },
  } as const),
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
  warning: "#ffd166",
  danger: "#ef4444",
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
  const slots: Date[] = [];

  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += 15) {
      const d = new Date(day);
      d.setHours(h, m, 0, 0);
      slots.push(d);
    }
  }

  const now = new Date();

  if (day.toDateString() === now.toDateString()) {
    return slots.filter((x) => x.getTime() >= now.getTime() + 5 * 60 * 1000);
  }

  return slots;
};

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

const formatTimeLabel = (slot: Date, locale?: string) =>
  slot.toLocaleTimeString(locale || undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const formatDayLabel = (day: Date, locale?: string) =>
  day.toLocaleDateString(locale || undefined, { weekday: "short" });

type StationOption = {
  id: string;
  name: string;
  facilityId: string;
  facilityName: string;
  waitMin: number | null;
  lambda: number;
  mu: number;
  rho: number;
};

type DateStripProps = {
  days: Date[];
  selectedIndex: number;
  locale?: string;
  onSelect: (index: number) => void;
};

type TimeGridProps = {
  slots: Date[];
  selectedSlot: Date | null;
  locale?: string;
  emptyText: string;
  hint: string;
  onSelect: (slot: Date) => void;
};

type RecommendationProps = {
  selectedSlot: Date | null;
  loading: boolean;
  error: unknown;
  stationOptions: StationOption[];
  selectedStationId: string | null;
  bestStationId: string | null;
  recommendedStation: StationOption | null;
  chooseTimeText: string;
  chooseTimeBody: string;
  loadingText: string;
  errorTitle: string;
  errorBody: string;
  noStationsTitle: string;
  noStationsBody: string;
  bestLabel: string;
  stationsLabel: string;
  stationsCaption: string;
  waitUnknownText: string;
  exactEstimateLabel: string;
  formatWaitText: (waitMin: number | null) => string;
  formatWaitShortText: (waitMin: number | null) => string;
  onSelectStation: (id: string) => void;
};

type ConfirmPanelProps = {
  selectedSlot: Date | null;
  selectedStationId: string | null;
  isCalculating: boolean;
  isPending: boolean;
  onConfirm: () => void;
  selectTimeLabel: string;
  calculatingLabel: string;
  selectStationLabel: string;
  confirmLabel: string;
  pendingLabel: string;
};

const Header = memo(function Header(props: { title: string; subtitle: string; onBack: () => void }) {
  const { title, subtitle, onBack } = props;

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

      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle}>{title}</Text>
        <Text style={styles.headerSubtitle}>{subtitle}</Text>
      </View>

      <View style={styles.headerSpacer} />
    </View>
  );
});

const SectionHeader = memo(function SectionHeader(props: { label: string; caption?: string }) {
  const { label, caption } = props;

  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {caption ? <Text style={styles.sectionCaption}>{caption}</Text> : null}
    </View>
  );
});

const IntroCard = memo(function IntroCard(props: { title: string; body: string }) {
  const { title, body } = props;

  return (
    <View style={styles.introCard}>
      <View style={styles.introGlow} />

      <View style={styles.introIcon}>
        <Ionicons name="time-outline" size={20} color={COLORS.blue} />
      </View>

      <View style={styles.introCopy}>
        <Text style={styles.introTitle}>{title}</Text>
        <Text style={styles.introBody}>{body}</Text>
      </View>
    </View>
  );
});

const DateStrip = memo(function DateStrip({ days, selectedIndex, locale, onSelect }: DateStripProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStrip}>
      {days.map((day, index) => {
        const selected = index === selectedIndex;

        return (
          <Pressable
            key={day.toISOString()}
            onPress={() => onSelect(index)}
            accessibilityRole="button"
            accessibilityLabel={formatDayLabel(day, locale)}
            style={({ pressed }) => [
              styles.dayChip,
              selected ? styles.dayChipSelected : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={[styles.dayDow, selected ? styles.dayTextSelected : null]}>
              {formatDayLabel(day, locale)}
            </Text>
            <Text style={[styles.dayNum, selected ? styles.dayTextSelected : null]}>{day.getDate()}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
});

const TimeGrid = memo(function TimeGrid({ slots, selectedSlot, locale, emptyText, hint, onSelect }: TimeGridProps) {
  if (slots.length === 0) {
    return (
      <View style={styles.emptyInline}>
        <Ionicons name="alert-circle-outline" size={18} color={COLORS.muted} />
        <Text style={styles.emptyInlineText}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.timeGrid}>
        {slots.map((slot) => {
          const selected = selectedSlot?.getTime() === slot.getTime();

          return (
            <View key={slot.toISOString()} style={styles.timeCell}>
              <Pressable
                onPress={() => onSelect(slot)}
                accessibilityRole="button"
                accessibilityLabel={formatTimeLabel(slot, locale)}
                style={({ pressed }) => [
                  styles.timeChip,
                  selected ? styles.timeChipSelected : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text style={[styles.timeText, selected ? styles.timeTextSelected : null]}>
                  {formatTimeLabel(slot, locale)}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      <Text style={styles.helperText}>{hint}</Text>
    </>
  );
});

const CompactState = memo(function CompactState(props: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  body?: string;
  loading?: boolean;
  danger?: boolean;
}) {
  const { icon, title, body, loading, danger } = props;

  return (
    <View style={styles.compactState}>
      <View style={[styles.compactStateIcon, danger ? styles.compactStateIconDanger : null]}>
        {loading ? (
          <ActivityIndicator color={COLORS.blue} />
        ) : (
          <Ionicons name={icon} size={20} color={danger ? COLORS.danger : COLORS.blue} />
        )}
      </View>

      <View style={styles.compactStateCopy}>
        <Text style={styles.compactStateTitle}>{title}</Text>
        {body ? <Text style={styles.compactStateBody}>{body}</Text> : null}
      </View>
    </View>
  );
});

const RecommendationSection = memo(function RecommendationSection(props: RecommendationProps) {
  const {
    selectedSlot,
    loading,
    error,
    stationOptions,
    selectedStationId,
    bestStationId,
    recommendedStation,
    chooseTimeText,
    chooseTimeBody,
    loadingText,
    errorTitle,
    errorBody,
    noStationsTitle,
    noStationsBody,
    bestLabel,
    stationsLabel,
    stationsCaption,
    waitUnknownText,
    exactEstimateLabel,
    formatWaitText,
    formatWaitShortText,
    onSelectStation,
  } = props;

  if (!selectedSlot) {
    return (
      <CompactState
        icon="time-outline"
        title={chooseTimeText}
        body={chooseTimeBody}
      />
    );
  }

  if (loading && stationOptions.length === 0) {
    return <CompactState icon="analytics-outline" title={loadingText} loading />;
  }

  if (error) {
    return (
      <CompactState
        icon="warning-outline"
        danger
        title={error instanceof Error ? error.message : errorTitle}
        body={errorBody}
      />
    );
  }

  if (stationOptions.length === 0) {
    return <CompactState icon="close-circle-outline" title={noStationsTitle} body={noStationsBody} />;
  }

  return (
    <>
      <View style={styles.bestCard}>
        <View style={styles.bestIcon}>
          <Ionicons name="sparkles" size={20} color={COLORS.blue} />
        </View>

        <View style={styles.bestCopy}>
          <View style={styles.bestTitleRow}>
            <Text style={styles.bestTitle} numberOfLines={1}>
              {recommendedStation?.name ?? "-"}
            </Text>
            <View style={styles.bestPill}>
              <Text style={styles.bestPillText}>{bestLabel}</Text>
            </View>
          </View>

          <Text style={styles.bestSub}>{formatWaitText(recommendedStation?.waitMin ?? null)}</Text>
        </View>
      </View>

      <SectionHeader label={stationsLabel} caption={stationsCaption} />

      <View style={styles.stationList}>
        {stationOptions.map((station, index) => {
          const picked = selectedStationId === station.id;
          const isBest = station.id === bestStationId;

          return (
            <React.Fragment key={station.id}>
              <Pressable
                onPress={() => onSelectStation(station.id)}
                accessibilityRole="button"
                accessibilityLabel={station.name}
                style={({ pressed }) => [
                  styles.stationRow,
                  picked ? styles.stationRowPicked : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <View style={styles.stationCopy}>
                  <View style={styles.stationTitleRow}>
                    <Text style={styles.stationName} numberOfLines={1}>
                      {station.name}
                    </Text>

                    {isBest ? (
                      <View style={styles.stationBadge}>
                        <Text style={styles.stationBadgeText}>{bestLabel}</Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={styles.stationMeta} numberOfLines={2}>
                    {typeof station.waitMin === "number"
                      ? `${formatWaitShortText(station.waitMin)} • rho=${station.rho.toFixed(2)}`
                      : `${waitUnknownText} • rho=${station.rho.toFixed(2)}`}
                  </Text>

                  {typeof station.waitMin === "number" && station.waitMin > 0 && station.waitMin < 1 ? (
                    <Text style={styles.stationFine}>{exactEstimateLabel.replace("{{count}}", station.waitMin.toFixed(2))}</Text>
                  ) : null}
                </View>

                {picked ? (
                  <View style={styles.checkCircle}>
                    <Ionicons name="checkmark" size={14} color={COLORS.text} />
                  </View>
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
                )}
              </Pressable>

              {index < stationOptions.length - 1 ? <View style={styles.divider} /> : null}
            </React.Fragment>
          );
        })}
      </View>
    </>
  );
});

const ConfirmPanel = memo(function ConfirmPanel(props: ConfirmPanelProps) {
  const {
    selectedSlot,
    selectedStationId,
    isCalculating,
    isPending,
    onConfirm,
    selectTimeLabel,
    calculatingLabel,
    selectStationLabel,
    confirmLabel,
    pendingLabel,
  } = props;

  const disabled = !selectedSlot || !selectedStationId || isCalculating || isPending;
  const label = isPending
    ? pendingLabel
    : !selectedSlot
      ? selectTimeLabel
      : isCalculating
        ? calculatingLabel
        : !selectedStationId
          ? selectStationLabel
          : confirmLabel;

  return (
    <View style={styles.confirmPanel}>
      <Pressable
        onPress={onConfirm}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [
          styles.confirmButton,
          disabled ? styles.confirmButtonDisabled : null,
          pressed && !disabled ? styles.pressed : null,
        ]}
      >
        {isPending ? <ActivityIndicator color={COLORS.text} /> : null}
        <Text style={[styles.confirmButtonText, disabled ? styles.confirmButtonTextDisabled : null]}>{label}</Text>
      </Pressable>
    </View>
  );
});

const BlockedBookingCard = memo(function BlockedBookingCard(props: {
  headerTitle: string;
  headerSubtitle: string;
  title: string;
  body: string;
  actionLabel: string;
  onBack: () => void;
  onManage: () => void;
}) {
  const { headerTitle, headerSubtitle, title, body, actionLabel, onBack, onManage } = props;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <Header title={headerTitle} subtitle={headerSubtitle} onBack={onBack} />

      <View style={styles.blockedWrap}>
        <View style={styles.blockedCard}>
          <View style={styles.blockedIcon}>
            <Ionicons name="lock-closed-outline" size={24} color={COLORS.warning} />
          </View>

          <Text style={styles.blockedTitle}>{title}</Text>
          <Text style={styles.blockedBody}>{body}</Text>

          <Pressable
            onPress={onManage}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            style={({ pressed }) => [styles.confirmButton, pressed ? styles.pressed : null]}
          >
            <Text style={styles.confirmButtonText}>{actionLabel}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
});

export default function NewBookingScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { t, i18n } = useTranslation(["booking", "common", "home"]);
  const { user } = useAuth();

  const { data: facilitiesRaw } = useQuery({
    queryKey: queryKeys.facilities(),
    queryFn: fetchFacilities,
    staleTime: 60_000,
  });

  const { data: existingBookingsRaw } = useQuery({
    queryKey: queryKeys.bookings(),
    queryFn: () => fetchBookings(),
    staleTime: 15_000,
  });

  const { data: stationsRaw } = useQuery({
    queryKey: queryKeys.stations(),
    queryFn: () => fetchStations(),
    staleTime: 60_000,
  });

  const stations = useMemo(() => (Array.isArray(stationsRaw) ? stationsRaw : []), [stationsRaw]);
  const facilities = useMemo(() => (Array.isArray(facilitiesRaw) ? facilitiesRaw : []), [facilitiesRaw]);
  const facility = facilities[0] ?? null;
  const locale = i18n.language || undefined;

  const activeExistingBooking = useMemo(() => {
    const bookings = Array.isArray(existingBookingsRaw) ? existingBookingsRaw : [];

    const active = bookings
      .filter((booking: any) => {
        const status = String(booking?.status ?? "").toLowerCase();
        return status !== "cancelled" && status !== "completed";
      })
      .sort((a: any, b: any) => {
        const ta = a?.arrivalTime ? new Date(a.arrivalTime).getTime() : Number.MAX_SAFE_INTEGER;
        const tb = b?.arrivalTime ? new Date(b.arrivalTime).getTime() : Number.MAX_SAFE_INTEGER;
        return ta - tb;
      })[0];

    return active ?? null;
  }, [existingBookingsRaw]);

  const stationById = useMemo(() => new Map(stations.map((station) => [station.id, station] as const)), [stations]);

  const days = useMemo(() => makeDays(7), []);
  const [dayIdx, setDayIdx] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [userPickedStation, setUserPickedStation] = useState(false);

  const selectedDay = days[dayIdx];
  const slots = useMemo(() => makeSlots(selectedDay), [selectedDay]);

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

  const formatWaitText = (waitMin: number | null) => {
    if (waitMin === null) return t("booking:waitUnknown", { defaultValue: "Waiting time unavailable" });

    if (waitMin > 0 && waitMin < 1) {
      return t("booking:waitUnderOneMinLong", { defaultValue: "Estimated wait under 1 min" });
    }

    return t("booking:waitEstimateLong", {
      count: Number(waitMin.toFixed(2)),
      defaultValue: `${waitMin.toFixed(2)} min estimated wait`,
    });
  };

  const formatWaitShortText = (waitMin: number | null) => {
    if (waitMin === null) return t("booking:waitUnknown", { defaultValue: "Waiting time unavailable" });

    if (waitMin > 0 && waitMin < 1) {
      return t("booking:waitUnderOneMinShort", { defaultValue: "Wait under 1 min" });
    }

    return t("booking:waitEstimateShort", {
      count: Number(waitMin.toFixed(2)),
      defaultValue: `${waitMin.toFixed(2)} min wait`,
    });
  };

  const stationOptions = useMemo<StationOption[]>(() => {
    const rows = mm1Data?.stations ?? [];

    const mapped = rows.map((row) => {
      const station = stationById.get(row.stationId);
      const rawWait = toFiniteNumber(row.approximatedWaitingTime);
      const lambda = toFiniteNumber(row.lambda) ?? 0;
      const mu = toFiniteNumber(row.mu) ?? 0;
      const rho = toFiniteNumber(row.rho) ?? 0;
      const waitMin =
        rawWait !== null
          ? rawWait === 0 && lambda === 0 && rho === 0
            ? null
            : Math.max(0, rawWait)
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
  }, [facility, mm1Data?.stations, stationById]);

  const bestStationId = useMemo(() => {
    const bestByWait = stationOptions.find((s) => s.waitMin !== null)?.id ?? null;
    return mm1Data?.bestStationId ?? bestByWait ?? stationOptions[0]?.id ?? null;
  }, [mm1Data?.bestStationId, stationOptions]);

  const recommendedStation = useMemo(() => {
    if (!bestStationId) return null;
    return stationOptions.find((s) => s.id === bestStationId) ?? null;
  }, [bestStationId, stationOptions]);

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

  const selectDay = (index: number) => {
    setDayIdx(index);
    setSelectedSlot(null);
    setSelectedStationId(null);
    setUserPickedStation(false);
  };

  const onConfirm = async () => {
    if (activeExistingBooking) {
      Alert.alert(
        t("booking:activeBookingExistsTitle", { defaultValue: "Active booking already exists" }),
        t("booking:activeBookingExistsBody", {
          defaultValue: "You already have an active booking. Complete or cancel it before creating a new one.",
        }),
      );
      return;
    }

    if (!user) {
      Alert.alert(
        t("booking:signInRequired", { defaultValue: "Sign-in required" }),
        t("booking:signInRequiredBody", {
          defaultValue: "Please sign in to create a booking.",
        }),
      );
      return;
    }

    if (!selectedSlot) {
      Alert.alert(
        t("booking:selectTime", { defaultValue: "Select a time" }),
        t("booking:selectTimeBody", {
          defaultValue: "Pick an arrival slot to continue.",
        }),
      );
      return;
    }

    const stationId = selectedStationId;

    if (!stationId) {
      Alert.alert(
        t("booking:selectStation", { defaultValue: "Select a station" }),
        t("booking:selectStationBody", {
          defaultValue: "Choose a station to continue.",
        }),
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
        }),
      );

      const bookingId = created?.bookingId ? String(created.bookingId) : null;
      const href: Href = bookingId
        ? (ROUTES.detail(bookingId) as unknown as Href)
        : (ROUTES.list as unknown as Href);

      router.replace(href);
    } catch {
      Alert.alert(t("booking:bookingFailed", { defaultValue: "Booking failed" }));
    }
  };

  if (activeExistingBooking) {
    const bookingId = activeExistingBooking?.id ? String(activeExistingBooking.id) : "";
    const manageHref: Href = bookingId
      ? (ROUTES.detail(bookingId) as unknown as Href)
      : (ROUTES.list as unknown as Href);
    const bookingRef = bookingId ? `#${bookingId.slice(-4).toUpperCase()}` : "-";

    return (
      <BlockedBookingCard
        headerTitle={t("booking:newBookingTitle", { defaultValue: "New booking" })}
        headerSubtitle={t("booking:newBookingSubtitle", { defaultValue: "Plan your arrival window" })}
        title={t("booking:activeBookingExistsTitle", { defaultValue: "Active booking already exists" })}
        body={t("booking:activeBookingScreenBody", {
          ref: bookingRef,
          defaultValue: `You already have an active booking (${bookingRef}). Manage it before creating a new one.`,
        })}
        actionLabel={t("booking:manageBooking", { defaultValue: "Manage booking" })}
        onBack={() => router.back()}
        onManage={() => router.replace(manageHref)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <Header
        title={t("booking:newBookingTitle", { defaultValue: "New booking" })}
        subtitle={t("booking:newBookingSubtitle", { defaultValue: "Plan your arrival window" })}
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <IntroCard
          title={t("booking:pickSlot", { defaultValue: "Pick an arrival slot" })}
          body={t("booking:pickSlotHint", {
            defaultValue: "Select a date and time. We will recommend the lowest-wait station for that window.",
          })}
        />

        <View style={styles.section}>
          <SectionHeader
            label={t("booking:selectDate", { defaultValue: "Date" })}
            caption={t("booking:selectDateHint", { defaultValue: "Choose a day for the arrival window." })}
          />
          <DateStrip days={days} selectedIndex={dayIdx} locale={locale} onSelect={selectDay} />
        </View>

        <View style={styles.section}>
          <SectionHeader
            label={t("booking:availableTimes", { defaultValue: "Available times" })}
            caption={t("booking:availableTimesHint", { defaultValue: "Slots are shown in 15-minute intervals." })}
          />
          <TimeGrid
            slots={slots}
            selectedSlot={selectedSlot}
            locale={locale}
            emptyText={t("booking:noSlots", { defaultValue: "No slots available for today." })}
            hint={t("booking:slotEvery15Min", { defaultValue: "Slots are shown every 15 minutes." })}
            onSelect={pickSlot}
          />
        </View>

        <View style={styles.section}>
          <SectionHeader
            label={t("booking:recommendation", { defaultValue: "Recommendation" })}
            caption={t("booking:recommendationHint", {
              defaultValue: "The system compares stations for your selected slot.",
            })}
          />
          <RecommendationSection
            selectedSlot={selectedSlot}
            loading={mm1Loading}
            error={mm1Error}
            stationOptions={stationOptions}
            selectedStationId={selectedStationId}
            bestStationId={bestStationId}
            recommendedStation={recommendedStation}
            chooseTimeText={t("booking:chooseTimeHint", { defaultValue: "Select a time first" })}
            chooseTimeBody={t("booking:chooseTimeBody", {
              defaultValue: "Station recommendation appears after selecting a slot.",
            })}
            loadingText={t("booking:calculating", { defaultValue: "Calculating best station..." })}
            errorTitle={t("common:unexpectedError", { defaultValue: "Unexpected error" })}
            errorBody={t("booking:recommendationErrorBody", {
              defaultValue: "Try another time slot or refresh the screen.",
            })}
            noStationsTitle={t("booking:noStationsForSlot", { defaultValue: "No station available" })}
            noStationsBody={t("booking:pickAnotherSlot", { defaultValue: "Pick another time slot to continue." })}
            bestLabel={t("booking:best", { defaultValue: "BEST" })}
            stationsLabel={t("booking:stations", { defaultValue: "Stations" })}
            stationsCaption={t("booking:stationsCaption", {
              defaultValue: "You can keep the recommendation or choose another station.",
            })}
            waitUnknownText={t("booking:waitUnknown", { defaultValue: "Waiting time unavailable" })}
            exactEstimateLabel={t("booking:exactEstimate", { defaultValue: "Exact estimate: {{count}} min" })}
            formatWaitText={formatWaitText}
            formatWaitShortText={formatWaitShortText}
            onSelectStation={(id) => {
              setUserPickedStation(true);
              setSelectedStationId(id);
            }}
          />
        </View>

        <ConfirmPanel
          selectedSlot={selectedSlot}
          selectedStationId={selectedStationId}
          isCalculating={mm1Loading && !mm1Data}
          isPending={createMut.isPending}
          onConfirm={onConfirm}
          selectTimeLabel={t("booking:selectTime", { defaultValue: "Select a time first" })}
          calculatingLabel={t("booking:calculating", { defaultValue: "Calculating best station..." })}
          selectStationLabel={t("booking:selectStation", { defaultValue: "Select a station" })}
          confirmLabel={t("booking:confirmBooking", { defaultValue: "Confirm booking" })}
          pendingLabel={t("booking:confirmBookingLoading", { defaultValue: "Creating booking..." })}
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
    paddingTop: 8,
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
  headerCenter: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    paddingHorizontal: 12,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 1,
  },
  headerSpacer: {
    width: 42,
  },

  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 104,
  },

  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },

  introCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.card,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  introGlow: {
    position: "absolute",
    right: -78,
    top: -92,
    width: 184,
    height: 184,
    borderRadius: 999,
    backgroundColor: "#2b8cff18",
  },
  introIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#22324f",
    backgroundColor: COLORS.cardSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  introCopy: {
    flex: 1,
    minWidth: 0,
  },
  introTitle: {
    color: COLORS.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
  },
  introBody: {
    color: COLORS.textSoft,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },

  section: {
    marginTop: 18,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionLabel: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  sectionCaption: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },

  dateStrip: {
    paddingRight: 16,
  },
  dayChip: {
    width: 58,
    height: 70,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.card,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  dayChipSelected: {
    borderColor: COLORS.blue,
    backgroundColor: COLORS.blue,
  },
  dayDow: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  dayNum: {
    color: COLORS.text,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "700",
    marginTop: 2,
  },
  dayTextSelected: {
    color: COLORS.text,
  },

  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  timeCell: {
    width: "25%",
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  timeChip: {
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.card,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  timeChipSelected: {
    borderColor: COLORS.blue,
    backgroundColor: COLORS.blue,
  },
  timeText: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },
  timeTextSelected: {
    color: COLORS.text,
  },
  helperText: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },

  emptyInline: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.card,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  emptyInlineText: {
    flex: 1,
    minWidth: 0,
    color: COLORS.textSoft,
    fontSize: 13,
    lineHeight: 18,
    marginLeft: 9,
  },

  compactState: {
    minHeight: 74,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.card,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  compactStateIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#22324f",
    backgroundColor: COLORS.cardSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  compactStateIconDanger: {
    borderColor: "#ef444440",
    backgroundColor: "#ef444418",
  },
  compactStateCopy: {
    flex: 1,
    minWidth: 0,
  },
  compactStateTitle: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
  compactStateBody: {
    color: COLORS.textSoft,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },

  bestCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2b8cff40",
    backgroundColor: COLORS.cardSoft,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  bestIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#2b8cff40",
    backgroundColor: COLORS.blueSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  bestCopy: {
    flex: 1,
    minWidth: 0,
  },
  bestTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  bestTitle: {
    flex: 1,
    minWidth: 0,
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    paddingRight: 8,
  },
  bestSub: {
    color: COLORS.blueText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    marginTop: 4,
  },
  bestPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#2b8cff44",
    backgroundColor: "#2b8cff20",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  bestPillText: {
    color: COLORS.blueText,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
  },

  stationList: {
    overflow: "hidden",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.card,
  },
  stationRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  stationRowPicked: {
    backgroundColor: "#2b8cff18",
  },
  stationCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  stationTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  stationName: {
    flexShrink: 1,
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
  stationBadge: {
    marginLeft: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#2b8cff44",
    backgroundColor: "#2b8cff20",
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  stationBadgeText: {
    color: COLORS.blueText,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  stationMeta: {
    color: COLORS.textSoft,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  stationFine: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  checkCircle: {
    width: 23,
    height: 23,
    borderRadius: 999,
    backgroundColor: COLORS.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.lineSoft,
  },

  confirmPanel: {
    marginTop: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.card,
    padding: 12,
  },
  confirmButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: COLORS.blue,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  confirmButtonDisabled: {
    backgroundColor: COLORS.cardRaised,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  confirmButtonText: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    textAlign: "center",
    marginLeft: 0,
  },
  confirmButtonTextDisabled: {
    color: COLORS.muted,
  },

  blockedWrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingBottom: 64,
  },
  blockedCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.card,
    padding: 18,
    alignItems: "center",
  },
  blockedIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#ffd16640",
    backgroundColor: "#ffd16618",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  blockedTitle: {
    color: COLORS.text,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "700",
    textAlign: "center",
  },
  blockedBody: {
    color: COLORS.textSoft,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 16,
  },
});
