import { useAuth } from "@/components/auth-context";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { saveLanguage } from "@/storage/language-store";
import { localizeAuthError } from "@/utils/auth-error";

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

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
};

function LanguageMiniOption({
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
        styles.langMiniOption,
        active && styles.langMiniOptionActive,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <ThemedText style={[styles.langMiniText, active && styles.langMiniTextActive]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { requestPasswordReset } = useAuth();
  const { t, i18n } = useTranslation(["auth", "settings", "common"]);

  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [resetLinkSent, setResetLinkSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [languageBusy, setLanguageBusy] = useState(false);

  const cleanEmail = email.trim();

  const canSubmit = useMemo(() => {
    return cleanEmail.length > 0 && !loading;
  }, [cleanEmail, loading]);

  const resolvedLanguage = (i18n.resolvedLanguage ?? i18n.language ?? "en").toLowerCase();
  const isTurkish = resolvedLanguage.startsWith("tr");

  const handleLanguageChange = async (nextLanguage: "en" | "tr") => {
    if (languageBusy) return;

    const current = isTurkish ? "tr" : "en";
    if (nextLanguage === current) return;

    try {
      setLanguageBusy(true);
      await i18n.changeLanguage(nextLanguage);
      await saveLanguage(nextLanguage);
    } catch (error: any) {
      Alert.alert(
        t("settings:language", { defaultValue: "Language" }),
        error?.message ?? t("common:unexpectedError", { defaultValue: "Unexpected error" }),
      );
    } finally {
      setLanguageBusy(false);
    }
  };

  const onSubmit = async () => {
    if (!canSubmit) return;

    setLoading(true);
    setErrorMessage("");
    setResetLinkSent(false);

    try {
      const res = await requestPasswordReset(cleanEmail);

      if (!res.ok) {
        setErrorMessage(localizeAuthError(res.message, t));
        return;
      }

      setResetLinkSent(true);
    } catch (error: any) {
      setErrorMessage(localizeAuthError(error, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={UI.bg} />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <ThemedView style={styles.authCard}>
            <View style={styles.topRow}>
              <Pressable
                onPress={() => router.back()}
                style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Ionicons name="chevron-back" size={20} color={UI.text} />
              </Pressable>

              <View style={styles.languageMini}>
                {languageBusy ? (
                  <ActivityIndicator size="small" color={UI.primary} />
                ) : (
                  <>
                    <LanguageMiniOption
                      label="EN"
                      active={!isTurkish}
                      onPress={() => handleLanguageChange("en")}
                    />

                    <LanguageMiniOption
                      label="TR"
                      active={isTurkish}
                      onPress={() => handleLanguageChange("tr")}
                    />
                  </>
                )}
              </View>
            </View>

            <View style={styles.brandMark}>
              <Ionicons name="key-outline" size={24} color={UI.primary} />
            </View>

            <View style={styles.header}>
              <ThemedText style={styles.title}>
                {t("auth:resetPasswordTitle", { defaultValue: "Reset password" })}
              </ThemedText>

              <ThemedText style={styles.subtitle}>
                {t("auth:resetPasswordSubtitle", {
                  defaultValue: "Enter your email and we will send you reset instructions.",
                })}
              </ThemedText>
            </View>

            <View style={styles.form}>
              {errorMessage ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={18} color="#ff8a8a" />
                  <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
                </View>
              ) : null}

              {resetLinkSent ? (
                <View style={styles.successBox}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#5ee0a0" />
                  <ThemedText style={styles.successText}>
                    {t("auth:resetPasswordSuccess", {
                      defaultValue: "Password reset link sent. Check your email.",
                    })}
                  </ThemedText>
                </View>
              ) : null}

              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color={UI.muted} style={styles.inputIcon} />

                <TextInput
                  placeholder={t("auth:email", { defaultValue: "Email" })}
                  placeholderTextColor="#747d89"
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    if (errorMessage) setErrorMessage("");
                    if (resetLinkSent) setResetLinkSent(false);
                  }}
                  style={styles.input}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                  returnKeyType="done"
                  onSubmitEditing={onSubmit}
                />
              </View>

              <Pressable
                onPress={onSubmit}
                disabled={!canSubmit}
                style={({ pressed }) => [
                  styles.submitButton,
                  !canSubmit && styles.submitButtonDisabled,
                  pressed && canSubmit && styles.submitButtonPressed,
                ]}
                accessibilityRole="button"
              >
                {loading ? (
                  <View style={styles.submitRow}>
                    <ActivityIndicator color="#ffffff" />
                    <ThemedText style={styles.submitText}>
                      {t("auth:resetPasswordSending", { defaultValue: "Sending..." })}
                    </ThemedText>
                  </View>
                ) : (
                  <ThemedText style={styles.submitText}>
                    {t("auth:resetPasswordButton", { defaultValue: "Send reset link" })}
                  </ThemedText>
                )}
              </Pressable>

              <Pressable
                onPress={() => router.replace("/login")}
                style={({ pressed }) => [styles.backToLoginButton, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Ionicons name="arrow-back-outline" size={15} color={UI.primary} />
                <ThemedText style={styles.backToLoginText}>
                  {t("auth:backToSignIn", { defaultValue: "Back to sign in" })}
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>

          <View style={styles.footerNote}>
            <Ionicons name="shield-checkmark-outline" size={15} color={UI.mutedSoft} />
            <ThemedText style={styles.footerNoteText}>
              {t("auth:resetPasswordSecurityNote", {
                defaultValue: "For security, reset links may expire after a short time.",
              })}
            </ThemedText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: UI.bg,
  },

  keyboard: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 24 : 16,
    paddingBottom: 34,
  },

  authCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: UI.borderSoft,
    backgroundColor: UI.card,
    padding: 18,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  backButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.cardSoft,
  },

  languageMini: {
    minWidth: 92,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.cardSoft,
    padding: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  langMiniOption: {
    flex: 1,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },

  langMiniOptionActive: {
    backgroundColor: UI.primary,
  },

  langMiniText: {
    color: UI.muted,
    fontSize: 12,
    fontWeight: "900",
  },

  langMiniTextActive: {
    color: "#ffffff",
  },

  brandMark: {
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.primarySoft,
    borderWidth: 1,
    borderColor: UI.primaryBorder,
    marginBottom: 18,
  },

  header: {
    marginBottom: 24,
  },

  title: {
    color: UI.text,
    fontSize: 34,
    lineHeight: 39,
    fontFamily: Platform.select({ web: "system-ui, -apple-system, Segoe UI, sans-serif", default: "ChairoSans" }),
    fontWeight: "800",
    letterSpacing: 0,
  },

  subtitle: {
    color: UI.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 310,
  },

  form: {
    gap: 12,
  },

  errorBox: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.36)",
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 11,
  },

  errorText: {
    flex: 1,
    color: "#ffb4b4",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    marginLeft: 8,
  },

  successBox: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.36)",
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 11,
  },

  successText: {
    flex: 1,
    color: "#9af2bf",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    marginLeft: 8,
  },

  inputWrap: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.cardSoft,
  },

  inputIcon: {
    marginLeft: 14,
    marginRight: 10,
  },

  input: {
    flex: 1,
    color: UI.text,
    fontSize: 15,
    minHeight: 54,
    paddingRight: 14,
  },

  submitButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: UI.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },

  submitButtonDisabled: {
    opacity: 0.55,
  },

  submitButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },

  submitRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  submitText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    marginLeft: 8,
  },

  backToLoginButton: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  backToLoginText: {
    color: UI.primary,
    fontSize: 13,
    fontWeight: "900",
    marginLeft: 6,
  },

  footerNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    paddingHorizontal: 12,
  },

  footerNoteText: {
    color: UI.mutedSoft,
    fontSize: 11,
    lineHeight: 17,
    marginLeft: 7,
    textAlign: "center",
    flexShrink: 1,
  },

  pressed: {
    opacity: 0.72,
  },
});
