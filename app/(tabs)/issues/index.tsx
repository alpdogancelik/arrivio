import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { createIssue, fetchIssues } from "@/api/issues";
import { mapApiError } from "@/api/errors";
import { images } from "@/constants/images";
import { queryKeys } from "@/query/keys";

import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQuery } from "@tanstack/react-query";
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

type SelectedPhoto = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

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

  return {
    label: t("issue:status.open", { defaultValue: "Open" }),
    color: UI.red,
    icon: "alert-circle-outline" as const,
  };
};

export default function IssueScreen() {
  const { t } = useTranslation(["issue", "common"]);
  const insets = useSafeAreaInsets();

  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState<IssueCategory>("delayed");
  const [selectedPhoto, setSelectedPhoto] = useState<SelectedPhoto | null>(null);

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
      setSelectedPhoto(null);
      refetchIssues();
      Alert.alert(t("issue:title", { defaultValue: "Report an issue" }), t("issue:submitted"));
    },
    onError: (error) => {
      const err = mapApiError(error);
      Alert.alert(t("issue:failed", { defaultValue: "Submission failed" }), err.message);
    },
  });

  const pickPhoto = async () => {
    try {
      if (Platform.OS !== "web") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
          Alert.alert(t("issue:attach", { defaultValue: "Attach photo" }), t("issue:photoPermission"));
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];

      setSelectedPhoto({
        uri: asset.uri,
        fileName: asset.fileName ?? null,
        mimeType: asset.mimeType ?? null,
      });
    } catch (error) {
      const err = mapApiError(error);
      Alert.alert(
        t("issue:attach", { defaultValue: "Attach photo" }),
        err.message || t("issue:attachFailed", { defaultValue: "Could not attach photo." }),
      );
    }
  };

  const submit = () => {
    const clean = desc.trim();

    if (!clean) {
      Alert.alert(t("issue:required", { defaultValue: "Please describe the issue." }));
      return;
    }

    mutation.mutate({
      description: clean,
      category,
      photo: selectedPhoto ?? undefined,
    });
  };

  const canSubmit = desc.trim().length > 0 && !mutation.isPending;

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
            onPress={pickPhoto}
            style={({ pressed }) => [styles.attachCard, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <View style={styles.attachIconWrap}>
              <Ionicons name={selectedPhoto ? "image-outline" : "camera-outline"} size={18} color={UI.primary} />
            </View>

            <View style={styles.attachCopy}>
              <ThemedText style={styles.attachTitle}>
                {selectedPhoto
                  ? t("issue:changePhoto", { defaultValue: "Change photo" })
                  : t("issue:attach", { defaultValue: "Add photo" })}
              </ThemedText>

              <ThemedText style={styles.attachSubtitle}>
                {selectedPhoto
                  ? selectedPhoto.fileName || t("issue:selectedPhoto", { defaultValue: "Selected photo" })
                  : t("issue:attachHint", {
                      defaultValue: "Optional, helps facility ops understand faster.",
                    })}
              </ThemedText>
            </View>
          </Pressable>

          {selectedPhoto ? (
            <View style={styles.photoPreview}>
              <Image source={{ uri: selectedPhoto.uri }} style={styles.photoPreviewImage} contentFit="cover" />

              <View style={styles.photoPreviewContent}>
                <ThemedText style={styles.photoPreviewTitle}>
                  {t("issue:photoAttached", { defaultValue: "Photo attached" })}
                </ThemedText>

                <ThemedText style={styles.photoPreviewMeta} numberOfLines={1}>
                  {selectedPhoto.fileName || t("issue:selectedPhoto", { defaultValue: "Selected photo" })}
                </ThemedText>
              </View>

              <Pressable onPress={() => setSelectedPhoto(null)} style={styles.removePhotoButton}>
                <Ionicons name="close-outline" size={18} color={UI.muted} />
              </Pressable>
            </View>
          ) : null}

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
                const categoryLabel = t(`issue:${String(issue?.category ?? "other")}`, {
                  defaultValue: String(issue?.category ?? t("issue:other", { defaultValue: "Other" })),
                });

                return (
                  <View
                    key={issue?.id ?? `${issue?.createdAt}-${index}`}
                    style={[styles.issueRow, index !== recentIssues.length - 1 && styles.issueRowDivider]}
                  >
                    <View style={styles.issueRowLeft}>
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

  attachCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.cardSoft,
    padding: 13,
    marginTop: 12,
  },

  attachIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.primarySoft,
    borderWidth: 1,
    borderColor: UI.primaryBorder,
    marginRight: 12,
  },

  attachCopy: {
    flex: 1,
  },

  attachTitle: {
    color: UI.text,
    fontSize: 13,
    fontWeight: "900",
  },

  attachSubtitle: {
    color: UI.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },

  photoPreview: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.cardSoft,
    padding: 10,
    marginTop: 12,
  },

  photoPreviewImage: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: "#050506",
  },

  photoPreviewContent: {
    flex: 1,
    paddingHorizontal: 12,
  },

  photoPreviewTitle: {
    color: UI.text,
    fontSize: 13,
    fontWeight: "900",
  },

  photoPreviewMeta: {
    color: UI.muted,
    fontSize: 12,
    marginTop: 4,
  },

  removePhotoButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: "#090a0c",
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

  issueStatusText: {
    fontSize: 10,
    fontWeight: "900",
    marginLeft: 4,
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
