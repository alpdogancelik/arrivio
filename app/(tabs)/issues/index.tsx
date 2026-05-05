import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { cancelIssue, createIssue, fetchIssues } from "@/api/issues";
import { mapApiError } from "@/api/errors";
import { images } from "@/constants/images";
import { queryKeys } from "@/query/keys";

import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IssueCategory = "delayed" | "equipment" | "safety" | "other";

const UI = {
  bg: "#08090b",
  card: "#101113",
  cardSoft: "#0b0c0e",
  border: "#20242b",
  borderSoft: "#2c323b",
  text: "#f7f9fc",
  muted: "#9aa3af",
  mutedSoft: "#6f7782",
  primary: "#2b8cff",
  primarySoft: "rgba(43, 140, 255, 0.14)",
  primaryBorder: "rgba(43, 140, 255, 0.35)",
  green: "#22c55e",
  yellow: "#facc15",
  red: "#ef4444",
};

const formatIssueDate = (value?: string) => {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getIssueStatus = (status: string | undefined, t: (key: string, options?: Record<string, string>) => string) => {
  const raw = String(status ?? "").toLowerCase();

  if (raw === "resolved") {
    return {
      label: t("issue:status.resolved", { defaultValue: "Resolved" }),
      color: UI.green,
      icon: "checkmark-circle-outline" as const,
    };
  }

  if (raw === "in_progress") {
    return {
      label: t("issue:status.in_progress", { defaultValue: "In progress" }),
      color: UI.yellow,
      icon: "time-outline" as const,
    };
  }

  if (raw === "cancelled") {
    return {
      label: t("issue:status.cancelled", { defaultValue: "Cancelled" }),
      color: UI.muted,
      icon: "close-circle-outline" as const,
    };
  }

  return {
    label: t("issue:status.open", { defaultValue: "Open" }),
    color: UI.red,
    icon: "alert-circle-outline" as const,
  };
};

export default function IssueScreen() {
  const { t } = useTranslation(["issue", "common"]);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState<IssueCategory>("delayed");

  const {
    data: issuesRaw,
    isLoading: issuesLoading,
    isFetching: issuesFetching,
    refetch: refetchIssues,
  } = useQuery({
    queryKey: queryKeys.issues(),
    queryFn: () => fetchIssues(),
    staleTime: 30_000,
  });

  const issues = useMemo(() => (Array.isArray(issuesRaw) ? issuesRaw : []), [issuesRaw]);

  const recentIssues = useMemo(() => {
    return [...issues]
      .sort((a: any, b: any) => {
        const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 4);
  }, [issues]);

  const categories = useMemo(
    () => [
      { id: "delayed" as const, label: t("issue:delayed", { defaultValue: "Late check-in" }) },
      { id: "equipment" as const, label: t("issue:equipment", { defaultValue: "Equipment" }) },
      { id: "safety" as const, label: t("issue:safety", { defaultValue: "Safety" }) },
      { id: "other" as const, label: t("issue:other", { defaultValue: "Other" }) },
    ],
    [t],
  );

  const mutation = useMutation({
    mutationFn: createIssue,
    onSuccess: () => {
      setDesc("");
      refetchIssues();
      Alert.alert(t("issue:title", { defaultValue: "Report an issue" }), t("issue:submitted"));
    },
    onError: (error) => {
      const err = mapApiError(error);
      Alert.alert(t("issue:failed", { defaultValue: "Submission failed" }), err.message);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelIssue,
    onMutate: async (issue: any) => {
      const key = queryKeys.issues();
      await queryClient.cancelQueries({ queryKey: key });
      const previousIssues = queryClient.getQueryData<any[]>(key);

      queryClient.setQueryData<any[]>(key, (current = []) =>
        current.map((item) => {
          const sameDoc =
            (issue?.firestoreId && item?.firestoreId === issue.firestoreId) ||
            item?.id === issue?.id;

          return sameDoc ? { ...item, status: "cancelled" } : item;
        }),
      );

      return { previousIssues };
    },
    onSuccess: async () => {
      await refetchIssues();
    },
    onError: (error, _issue, context) => {
      const err = mapApiError(error);
      queryClient.setQueryData(queryKeys.issues(), context?.previousIssues);
      Alert.alert(t("issue:cancelFailed", { defaultValue: "Cancel failed" }), err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues() });
    },
  });

  const submit = () => {
    const clean = desc.trim();

    if (!clean) {
      Alert.alert(t("issue:required", { defaultValue: "Please describe the issue." }));
      return;
    }

    mutation.mutate({
      description: clean,
      category,
    });
  };

  const canSubmit = desc.trim().length > 0 && !mutation.isPending;

  const confirmCancelIssue = (issue: any) => {
    if (!issue?.id || issue?.status === "cancelled" || issue?.status === "resolved" || cancelMutation.isPending) {
      return;
    }

    const title = t("issue:cancelTitle", { defaultValue: "Cancel report" });
    const message = t("issue:cancelConfirm", { defaultValue: "Do you want to cancel this report?" });

    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (window.confirm(message)) {
        cancelMutation.mutate(issue);
      }
      return;
    }

    Alert.alert(
      title,
      message,
      [
        { text: t("common:no", { defaultValue: "No" }), style: "cancel" },
        {
          text: t("issue:cancelAction", { defaultValue: "Cancel report" }),
          style: "destructive",
          onPress: () => cancelMutation.mutate(issue),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedView style={styles.hero}>
          <Image
            source={images.alarm}
            style={[styles.heroImage, Platform.OS === "web" ? ({ pointerEvents: "none" } as any) : null]}
            contentFit="contain"
          />

          <View style={styles.heroContent}>
            <ThemedText style={styles.title}>
              {t("issue:title", { defaultValue: "Report an issue" })}
            </ThemedText>

            <ThemedText style={styles.subtitle}>
              {t("issue:subtitle", {
                defaultValue: "Tell us what is blocking your check-in so we can route it fast.",
              })}
            </ThemedText>

            <View style={styles.heroBadge}>
              <Ionicons name="git-branch-outline" size={14} color="#9cc7ff" />
              <ThemedText style={styles.heroBadgeText}>
                {t("issue:priority", { defaultValue: "Priority routing" })}
              </ThemedText>
            </View>
          </View>
        </ThemedView>

        <ThemedView style={styles.card}>
          <ThemedText style={styles.sectionLabel}>
            {t("issue:category", { defaultValue: "Issue type" })}
          </ThemedText>

          <View style={styles.chipGrid}>
            {categories.map((item) => {
              const isActive = item.id === category;

              return (
                <Pressable
                  key={item.id}
                  onPress={() => setCategory(item.id)}
                  style={({ pressed }) => [
                    styles.chip,
                    isActive && styles.chipActive,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                >
                  <ThemedText style={[styles.chipText, isActive && styles.chipTextActive]}>
                    {item.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <ThemedText style={[styles.sectionLabel, styles.descriptionLabel]}>
            {t("issue:description", { defaultValue: "Description" })}
          </ThemedText>

          <TextInput
            placeholder={t("issue:descriptionPlaceholder", {
              defaultValue: "Tell us what happened. Include gate, time or station if possible.",
            })}
            placeholderTextColor="#777f89"
            value={desc}
            onChangeText={setDesc}
            style={styles.textArea}
            multiline
            textAlignVertical="top"
            autoCorrect
          />

          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.button,
              !canSubmit && styles.buttonDisabled,
              pressed && canSubmit && styles.buttonPressed,
            ]}
            accessibilityRole="button"
          >
            {mutation.isPending ? (
              <View style={styles.buttonRow}>
                <ActivityIndicator color="#ffffff" />
                <ThemedText style={[styles.buttonText, styles.buttonTextWithIcon]}>
                  {t("issue:submitting", { defaultValue: "Sending..." })}
                </ThemedText>
              </View>
            ) : (
              <ThemedText style={styles.buttonText}>
                {t("issue:submit", { defaultValue: "Send report" })}
              </ThemedText>
            )}
          </Pressable>
        </ThemedView>

        <ThemedView style={styles.infoCard}>
          <View style={styles.infoIcon}>
            <Ionicons name="trail-sign-outline" size={20} color="#9cc7ff" />
          </View>

          <View style={styles.infoContent}>
            <ThemedText style={styles.infoTitle}>
              {t("issue:nextTitle", { defaultValue: "What happens next?" })}
            </ThemedText>

            <ThemedText style={styles.infoBody}>
              {t("issue:nextBody", {
                defaultValue:
                  "Your report is routed to facility operations. Expect a response and live updates in the Status tab.",
              })}
            </ThemedText>
          </View>
        </ThemedView>

        <ThemedView style={styles.recentCard}>
          <View style={styles.recentHeader}>
            <ThemedText style={styles.recentTitle}>
              {t("issue:recentTitle", { defaultValue: "Recent issues" })}
            </ThemedText>

            <Pressable
              onPress={() => refetchIssues()}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              {issuesFetching ? (
                <ActivityIndicator size="small" color={UI.primary} />
              ) : (
                <>
                  <Ionicons name="refresh-outline" size={14} color={UI.primary} />
                  <ThemedText style={styles.retryText}>
                    {t("common:retry", { defaultValue: "Retry" })}
                  </ThemedText>
                </>
              )}
            </Pressable>
          </View>

          {issuesLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={UI.primary} />
            </View>
          ) : recentIssues.length ? (
            <View style={styles.issueList}>
              {recentIssues.map((issue: any, index) => {
                const status = getIssueStatus(issue?.status, t);
                const issueDisplayId = String(issue?.firestoreId ?? issue?.id ?? "").trim();
                const categoryLabel = t(`issue:${String(issue?.category ?? "other")}`, {
                  defaultValue: String(issue?.category ?? t("issue:other", { defaultValue: "Other" })),
                });

                return (
                  <View
                    key={issueDisplayId || `${issue?.createdAt}-${index}`}
                    style={[styles.issueRow, index !== recentIssues.length - 1 && styles.issueRowDivider]}
                  >
                    <View style={styles.issueRowLeft}>
                      {issueDisplayId ? (
                        <ThemedText style={styles.issueId} numberOfLines={1}>
                          #{issueDisplayId}
                        </ThemedText>
                      ) : null}

                      <ThemedText style={styles.issueCategory} numberOfLines={1}>
                        {categoryLabel}
                      </ThemedText>

                      <ThemedText style={styles.issueDescription} numberOfLines={2}>
                        {issue?.description ?? "-"}
                      </ThemedText>

                      <ThemedText style={styles.issueDate}>
                        {formatIssueDate(issue?.createdAt)}
                      </ThemedText>
                    </View>

                    <View style={styles.issueActions}>
                      <View
                        style={[
                          styles.issueStatus,
                          {
                            borderColor: `${status.color}44`,
                            backgroundColor: `${status.color}16`,
                          },
                        ]}
                      >
                        <Ionicons name={status.icon} size={13} color={status.color} />
                        <ThemedText style={[styles.issueStatusText, { color: status.color }]}>
                          {status.label}
                        </ThemedText>
                      </View>

                      {issue?.status !== "cancelled" && issue?.status !== "resolved" ? (
                        <Pressable
                          onPress={() => confirmCancelIssue(issue)}
                          disabled={cancelMutation.isPending}
                          style={({ pressed }) => [
                            styles.cancelIssueButton,
                            pressed && !cancelMutation.isPending && styles.pressed,
                            cancelMutation.isPending && styles.cancelIssueButtonDisabled,
                          ]}
                          accessibilityRole="button"
                        >
                          <Ionicons name="close-outline" size={13} color={UI.red} />
                          <ThemedText style={styles.cancelIssueText}>
                            {t("issue:cancelActionShort", { defaultValue: "Cancel" })}
                          </ThemedText>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyRecent}>
              <View style={styles.emptyRecentIcon}>
                <Ionicons name="document-text-outline" size={20} color={UI.primary} />
              </View>

              <ThemedText style={styles.emptyRecentTitle}>
                {t("issue:noIssues", { defaultValue: "No issues yet" })}
              </ThemedText>

              <ThemedText style={styles.emptyRecentBody}>
                {t("issue:noIssuesBody", {
                  defaultValue: "Submitted reports will appear here with their latest status.",
                })}
              </ThemedText>
            </View>
          )}
        </ThemedView>
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

  hero: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: UI.borderSoft,
    backgroundColor: UI.card,
    padding: 18,
    marginBottom: 14,
  },

  heroImage: {
    position: "absolute",
    right: -10,
    top: -12,
    width: 150,
    height: 150,
    opacity: 0.22,
  },

  heroContent: {
    maxWidth: "72%",
  },

  title: {
    color: UI.text,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "900",
    letterSpacing: -0.6,
  },

  subtitle: {
    color: UI.text,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 7,
    opacity: 0.9,
  },

  heroBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: UI.primaryBorder,
    backgroundColor: UI.primarySoft,
    paddingHorizontal: 11,
    paddingVertical: 8,
    marginTop: 14,
  },

  heroBadgeText: {
    color: "#9cc7ff",
    fontSize: 12,
    fontWeight: "800",
    marginLeft: 7,
  },

  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.card,
    padding: 16,
    marginBottom: 14,
  },

  sectionLabel: {
    color: UI.text,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 10,
  },

  descriptionLabel: {
    marginTop: 16,
  },

  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
    marginTop: -4,
  },

  chip: {
    minHeight: 42,
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.cardSoft,
    paddingHorizontal: 13,
    marginHorizontal: 4,
    marginTop: 8,
  },

  chipActive: {
    borderColor: UI.primary,
    backgroundColor: UI.primarySoft,
  },

  chipText: {
    color: UI.text,
    fontSize: 13,
    fontWeight: "800",
  },

  chipTextActive: {
    color: "#79b7ff",
  },

  pressed: {
    opacity: 0.72,
  },

  textArea: {
    minHeight: 116,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.cardSoft,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: UI.text,
    fontSize: 14,
    lineHeight: 20,
  },

  button: {
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: UI.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },

  buttonDisabled: {
    opacity: 0.55,
  },

  buttonPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.9,
  },

  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  buttonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },

  buttonTextWithIcon: {
    marginLeft: 8,
  },

  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.card,
    padding: 16,
    marginBottom: 14,
  },

  infoIcon: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.primarySoft,
    borderWidth: 1,
    borderColor: UI.primaryBorder,
    marginRight: 13,
  },

  infoContent: {
    flex: 1,
  },

  infoTitle: {
    color: UI.text,
    fontSize: 15,
    fontWeight: "900",
  },

  infoBody: {
    color: UI.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },

  recentCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.card,
    padding: 16,
    marginBottom: 14,
  },

  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  recentTitle: {
    color: UI.text,
    fontSize: 15,
    fontWeight: "900",
  },

  retryButton: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: UI.primaryBorder,
    backgroundColor: UI.primarySoft,
    paddingHorizontal: 10,
  },

  retryText: {
    color: "#8ec2ff",
    fontSize: 12,
    fontWeight: "900",
    marginLeft: 5,
  },

  loadingWrap: {
    minHeight: 90,
    alignItems: "center",
    justifyContent: "center",
  },

  issueList: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.cardSoft,
    overflow: "hidden",
  },

  issueRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 13,
  },

  issueRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: UI.border,
  },

  issueRowLeft: {
    flex: 1,
    paddingRight: 10,
  },

  issueId: {
    color: UI.primary,
    fontSize: 10,
    fontWeight: "900",
    marginBottom: 4,
  },

  issueCategory: {
    color: UI.text,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "capitalize",
  },

  issueDescription: {
    color: UI.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },

  issueDate: {
    color: UI.mutedSoft,
    fontSize: 11,
    marginTop: 6,
  },

  issueStatus: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },

  issueActions: {
    alignItems: "flex-end",
    gap: 8,
  },

  issueStatusText: {
    fontSize: 10,
    fontWeight: "900",
    marginLeft: 4,
  },

  cancelIssueButton: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#ef444440",
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    paddingHorizontal: 9,
  },

  cancelIssueButtonDisabled: {
    opacity: 0.55,
  },

  cancelIssueText: {
    color: UI.red,
    fontSize: 10,
    fontWeight: "900",
    marginLeft: 3,
  },

  emptyRecent: {
    minHeight: 126,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.cardSoft,
    padding: 16,
  },

  emptyRecentIcon: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.primarySoft,
    borderWidth: 1,
    borderColor: UI.primaryBorder,
    marginBottom: 10,
  },

  emptyRecentTitle: {
    color: UI.text,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
  },

  emptyRecentBody: {
    color: UI.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 5,
  },
});
