import { useAuth } from "@/components/auth-context";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { saveLanguage } from "@/storage/language-store";

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
  success: "#22c55e",
  successSoft: "rgba(34, 197, 94, 0.12)",
  successBorder: "rgba(34, 197, 94, 0.32)",
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

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const { t, i18n } = useTranslation(["auth", "settings", "common"]);

  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [passwordVisible, setPasswordVisible] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const [loading, setLoading] = useState(false);
  const [languageBusy, setLanguageBusy] = useState(false);

  const cleanName = name.trim();
  const cleanSurname = surname.trim();
  const cleanEmail = email.trim();

  const canSubmit = useMemo(() => {
    return (
      cleanName.length > 0 &&
      cleanSurname.length > 0 &&
      cleanEmail.length > 0 &&
      password.length > 0 &&
      !loading
    );
  }, [cleanName, cleanSurname, cleanEmail, password, loading]);

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

  const showRegisterError = (message?: string) => {
    Alert.alert(
      t("auth:registrationFailed", { defaultValue: "Registration failed" }),
      message ?? t("auth:invalidCredentials", { defaultValue: "Please check your information and try again." }),
    );
  };

  const onRegister = async () => {
    if (!canSubmit) return;

    setLoading(true);
    setSuccessMessage("");

    try {
      const res = await register({
        name: cleanName,
        surname: cleanSurname,
        email: cleanEmail,
        password,
      });

      if (!res.ok) {
        showRegisterError(res.message);
        return;
      }

      setName("");
      setSurname("");
      setEmail("");
      setPassword("");

      setSuccessMessage(
        t("auth:registrationSuccess", {
          defaultValue: "Your account was created successfully. You can now sign in.",
        }),
      );
    } catch (error: any) {
      showRegisterError(error?.message);
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
              <View style={styles.brandMark}>
                <Ionicons name="person-add-outline" size={22} color={UI.primary} />
              </View>

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

            <View style={styles.header}>
              <ThemedText style={styles.title}>
                {t("auth:registerTitle", { defaultValue: "Create account" })}
              </ThemedText>

              <ThemedText style={styles.subtitle}>
                {t("auth:registerSubtitle", {
                  defaultValue: "Create your carrier account to book slots and reduce gate wait times.",
                })}
              </ThemedText>
            </View>

            {successMessage ? (
              <View style={styles.successBox}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={UI.success} />
                </View>

                <View style={styles.successCopy}>
                  <ThemedText style={styles.successTitle}>
                    {t("auth:emailCheckTitle", { defaultValue: "Account ready" })}
                  </ThemedText>

                  <ThemedText style={styles.successText}>{successMessage}</ThemedText>
                </View>
              </View>
            ) : null}

            <View style={styles.form}>
              <View style={styles.nameRow}>
                <View style={[styles.inputWrap, styles.nameInput]}>
                  <Ionicons name="person-outline" size={18} color={UI.muted} style={styles.inputIcon} />

                  <TextInput
                    placeholder={t("auth:firstName", { defaultValue: "First name" })}
                    placeholderTextColor="#747d89"
                    value={name}
                    onChangeText={setName}
                    style={styles.input}
                    autoCapitalize="words"
                    returnKeyType="next"
                    textContentType="givenName"
                  />
                </View>

                <View style={[styles.inputWrap, styles.nameInput]}>
                  <TextInput
                    placeholder={t("auth:lastName", { defaultValue: "Last name" })}
                    placeholderTextColor="#747d89"
                    value={surname}
                    onChangeText={setSurname}
                    style={[styles.input, styles.inputNoIcon]}
                    autoCapitalize="words"
                    returnKeyType="next"
                    textContentType="familyName"
                  />
                </View>
              </View>

              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color={UI.muted} style={styles.inputIcon} />

                <TextInput
                  placeholder={t("auth:email", { defaultValue: "Email" })}
                  placeholderTextColor="#747d89"
                  value={email}
                  onChangeText={setEmail}
                  style={styles.input}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={UI.muted} style={styles.inputIcon} />

                <TextInput
                  placeholder={t("auth:password", { defaultValue: "Password" })}
                  placeholderTextColor="#747d89"
                  secureTextEntry={!passwordVisible}
                  value={password}
                  onChangeText={setPassword}
                  style={styles.input}
                  textContentType="newPassword"
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={onRegister}
                />

                <Pressable
                  onPress={() => setPasswordVisible((value) => !value)}
                  style={({ pressed }) => [styles.eyeButton, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name={passwordVisible ? "eye-off-outline" : "eye-outline"}
                    size={19}
                    color={UI.muted}
                  />
                </Pressable>
              </View>

              <Pressable
                onPress={onRegister}
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
                      {t("auth:signUpProcessing", { defaultValue: "Creating..." })}
                    </ThemedText>
                  </View>
                ) : (
                  <ThemedText style={styles.submitText}>
                    {t("auth:signUp", { defaultValue: "Create account" })}
                  </ThemedText>
                )}
              </Pressable>
            </View>

            <View style={styles.divider} />

            <View style={styles.signInRow}>
              <ThemedText style={styles.signInHint}>
                {t("auth:haveAccount", { defaultValue: "Already have an account?" })}
              </ThemedText>

              <Pressable
                onPress={() => router.push("/(auth)/login")}
                style={({ pressed }) => [styles.signInButton, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <ThemedText style={styles.signInText}>
                  {t("auth:signIn", { defaultValue: "Sign in" })}
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>

          <View style={styles.footerNote}>
            <Ionicons name="shield-checkmark-outline" size={15} color={UI.mutedSoft} />
            <ThemedText style={styles.footerNoteText}>
              {t("auth:registerSecurityNote", {
                defaultValue: "Secure carrier registration for Arrivio queue operations.",
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
    marginBottom: 22,
  },

  brandMark: {
    width: 46,
    height: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.primarySoft,
    borderWidth: 1,
    borderColor: UI.primaryBorder,
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

  header: {
    marginBottom: 22,
  },

  title: {
    color: UI.text,
    fontSize: 32,
    lineHeight: 37,
    fontFamily: Platform.select({ web: "system-ui, -apple-system, Segoe UI, sans-serif", default: "ChairoSans" }),
    fontWeight: "800",
    letterSpacing: 0,
  },

  subtitle: {
    color: UI.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 320,
  },

  successBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: UI.successBorder,
    backgroundColor: UI.successSoft,
    padding: 13,
    marginBottom: 14,
  },

  successIcon: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    borderWidth: 1,
    borderColor: UI.successBorder,
    marginRight: 11,
  },

  successCopy: {
    flex: 1,
  },

  successTitle: {
    color: UI.success,
    fontSize: 13,
    fontWeight: "900",
  },

  successText: {
    color: "#bff3cd",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  form: {
    gap: 12,
  },

  nameRow: {
    flexDirection: "row",
    gap: 10,
  },

  nameInput: {
    flex: 1,
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
    paddingRight: 12,
  },

  inputNoIcon: {
    paddingLeft: 14,
  },

  eyeButton: {
    width: 44,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
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

  divider: {
    height: 1,
    backgroundColor: UI.border,
    marginVertical: 16,
  },

  signInRow: {
    alignItems: "center",
  },

  signInHint: {
    color: UI.muted,
    fontSize: 13,
    marginBottom: 8,
  },

  signInButton: {
    minHeight: 34,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  signInText: {
    color: UI.primary,
    fontSize: 13,
    fontWeight: "900",
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
