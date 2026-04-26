import { useAuth } from "@/components/auth-context";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { appConfig } from "@/config";
import { saveLanguage } from "@/storage/language-store";

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  danger: "#cf2027",
  dangerSoft: "rgba(207, 32, 39, 0.12)",
  dangerBorder: "rgba(207, 32, 39, 0.32)",
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <ThemedText style={styles.infoLabel}>{label}</ThemedText>
      <ThemedText style={styles.infoValue} numberOfLines={1}>
        {value || "—"}
      </ThemedText>
    </View>
  );
}

function LanguageOption({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.languageOption,
        active && styles.languageOptionActive,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <ThemedText style={[styles.languageOptionText, active && styles.languageOptionTextActive]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation(["settings", "common"]);

  const [isBusy, setIsBusy] = useState(false);
  const [languageBusy, setLanguageBusy] = useState(false);

  const roleKey = String((user as any)?.role ?? "carrier");

  const roleLabel = useMemo(
    () =>
      t(`common:roles.${roleKey}`, {
        defaultValue: roleKey,
      }),
    [roleKey, t],
  );

  const versionLabel = useMemo(() => `v${appConfig.version}`, []);

  const resolvedLanguage = (i18n.resolvedLanguage ?? i18n.language ?? "en").toLowerCase();
  const isTurkish = resolvedLanguage.startsWith("tr");

  const handleLogout = async () => {
    if (isBusy) return;

    setIsBusy(true);

    try {
      await logout();
      router.replace("/(auth)/login");
    } catch (e: any) {
      Alert.alert(
        t("common:signOutFailed", { defaultValue: "Sign out failed" }),
        e?.message ?? t("common:unexpectedError", { defaultValue: "Unexpected error" }),
      );
    } finally {
      setIsBusy(false);
    }
  };

  const confirmLogout = () => {
    const title = t("common:signOutTitle", { defaultValue: "Sign out" });
    const message = t("common:signOutConfirm", {
      defaultValue: "Are you sure you want to sign out?",
    });

    if (Platform.OS === "web") {
      if (window.confirm(`${title}\n\n${message}`)) {
        void handleLogout();
      }
      return;
    }

    Alert.alert(
      title,
      message,
      [
        {
          text: t("common:cancel", { defaultValue: "Cancel" }),
          style: "cancel",
        },
        {
          text: t("common:signOut", { defaultValue: "Sign out" }),
          style: "destructive",
          onPress: handleLogout,
        },
      ],
    );
  };

  const handleLanguageChange = async (nextLanguage: "en" | "tr") => {
    if (languageBusy) return;

    const current = isTurkish ? "tr" : "en";
    if (nextLanguage === current) return;

    try {
      setLanguageBusy(true);
      await i18n.changeLanguage(nextLanguage);
      await saveLanguage(nextLanguage);
    } catch (e: any) {
      Alert.alert(
        t("settings:language", { defaultValue: "Language" }),
        e?.message ?? t("common:unexpectedError", { defaultValue: "Unexpected error" }),
      );
    } finally {
      setLanguageBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 118 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedView style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="settings-outline" size={22} color={UI.primary} />
          </View>

          <View style={styles.heroCopy}>
            <ThemedText style={styles.title}>
              {t("settings:title", { defaultValue: "Settings" })}
            </ThemedText>

            <ThemedText style={styles.subtitle}>
              {t("settings:subtitle", {
                defaultValue: "Manage your account, language and session preferences.",
              })}
            </ThemedText>
          </View>
        </ThemedView>

        <ThemedView style={styles.card}>
          <ThemedText style={styles.cardTitle}>
            {t("settings:account", { defaultValue: "Account" })}
          </ThemedText>

          <View style={styles.infoBlock}>
            <InfoRow label={t("settings:role", { defaultValue: "Role" })} value={roleLabel} />
            <InfoRow label={t("settings:version", { defaultValue: "Version" })} value={versionLabel} />
          </View>
        </ThemedView>

        <ThemedView style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderCopy}>
              <ThemedText style={styles.cardTitle}>
                {t("settings:language", { defaultValue: "Language" })}
              </ThemedText>

              <ThemedText style={styles.cardSubtitle}>
                {t("settings:languageHint", {
                  defaultValue: "Choose the app language you want to use.",
                })}
              </ThemedText>
            </View>

            {languageBusy ? <ActivityIndicator size="small" color={UI.primary} /> : null}
          </View>

          <View style={styles.languageSegment}>
            <LanguageOption
              label={t("settings:languageEnglish", { defaultValue: "English" })}
              active={!isTurkish}
              onPress={() => handleLanguageChange("en")}
            />

            <LanguageOption
              label={t("settings:languageTurkish", { defaultValue: "Türkçe" })}
              active={isTurkish}
              onPress={() => handleLanguageChange("tr")}
            />
          </View>
        </ThemedView>

        <ThemedView style={styles.sessionCard}>
          <View style={styles.sessionHeader}>
            <View style={styles.sessionIcon}>
              <Ionicons name="log-out-outline" size={20} color={UI.danger} />
            </View>

            <View style={styles.sessionCopy}>
              <ThemedText style={styles.cardTitle}>
                {t("settings:session", { defaultValue: "Session" })}
              </ThemedText>

              <ThemedText style={styles.cardSubtitle}>
                {t("settings:sessionHint", {
                  defaultValue: "Signing out will return you to the login screen.",
                })}
              </ThemedText>
            </View>
          </View>

          <Pressable
            onPress={confirmLogout}
            disabled={isBusy}
            style={({ pressed }) => [
              styles.logoutButton,
              pressed && styles.logoutButtonPressed,
              isBusy && styles.disabledButton,
            ]}
            accessibilityRole="button"
          >
            {isBusy ? (
              <View style={styles.logoutRow}>
                <ActivityIndicator color="#ffffff" />
                <ThemedText style={styles.logoutText}>
                  {t("common:signingOut", { defaultValue: "Signing out..." })}
                </ThemedText>
              </View>
            ) : (
              <ThemedText style={styles.logoutText}>
                {t("common:signOut", { defaultValue: "Sign out" })}
              </ThemedText>
            )}
          </Pressable>

          <ThemedText style={styles.dangerHint}>
            {t("common:sessionCleared", {
              defaultValue: "This will only clear your session on this device.",
            })}
          </ThemedText>
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
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: UI.borderSoft,
    backgroundColor: UI.card,
    padding: 16,
    marginBottom: 12,
  },

  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.primarySoft,
    borderWidth: 1,
    borderColor: UI.primaryBorder,
    marginRight: 14,
  },

  heroCopy: {
    flex: 1,
  },

  title: {
    color: UI.text,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "900",
    letterSpacing: -0.4,
  },

  subtitle: {
    color: UI.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },

  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.card,
    padding: 16,
    marginBottom: 12,
  },

  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  cardHeaderCopy: {
    flex: 1,
    paddingRight: 12,
  },

  cardTitle: {
    color: UI.text,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 6,
  },

  cardSubtitle: {
    color: UI.muted,
    fontSize: 12,
    lineHeight: 18,
  },

  infoBlock: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.cardSoft,
    overflow: "hidden",
  },

  infoRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 13,
    borderBottomWidth: 1,
    borderBottomColor: UI.border,
  },

  infoLabel: {
    color: UI.muted,
    fontSize: 14,
  },

  infoValue: {
    flex: 1,
    color: UI.text,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "right",
    textTransform: "capitalize",
    paddingLeft: 16,
  },

  languageSegment: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.cardSoft,
    padding: 4,
  },

  languageOption: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  languageOptionActive: {
    backgroundColor: UI.primary,
  },

  languageOptionText: {
    color: UI.muted,
    fontSize: 13,
    fontWeight: "900",
  },

  languageOptionTextActive: {
    color: "#ffffff",
  },

  pressed: {
    opacity: 0.72,
  },

  sessionCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: UI.dangerBorder,
    backgroundColor: UI.card,
    padding: 16,
    marginBottom: 12,
  },

  sessionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },

  sessionIcon: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.dangerSoft,
    borderWidth: 1,
    borderColor: UI.dangerBorder,
    marginRight: 12,
  },

  sessionCopy: {
    flex: 1,
  },

  logoutButton: {
    minHeight: 50,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.danger,
  },

  logoutButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },

  disabledButton: {
    opacity: 0.6,
  },

  logoutRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  logoutText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    marginLeft: 8,
  },

  dangerHint: {
    color: UI.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
});
