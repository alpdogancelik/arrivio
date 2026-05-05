import { useAuth } from "@/components/auth-context";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ProfileForm = {
  firstName: string;
  lastName: string;
  phone: string;
  company: string;
  vehiclePlate: string;
  capacity: string;
  available: boolean;
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
  green: "#22c55e",
  red: "#ef4444",
};

function getInitials(firstName?: string | null, lastName?: string | null) {
  const first = firstName?.trim()?.[0] ?? "";
  const last = lastName?.trim()?.[0] ?? "";
  const initials = `${first}${last}`.toUpperCase();

  return initials || "DR";
}

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

function formatBlockUntil(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "phone-pad" | "numeric";
}) {
  return (
    <View style={styles.fieldWrap}>
      <ThemedText style={styles.fieldLabel}>{label}</ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#737b86"
        style={styles.input}
        keyboardType={keyboardType ?? "default"}
      />
    </View>
  );
}

function SettingRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <ThemedText style={styles.settingLabel}>{label}</ThemedText>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#555b64", true: "rgba(43, 140, 255, 0.45)" }}
        thumbColor={value ? "#10b4a7" : "#f2f2f2"}
      />
    </View>
  );
}

export default function ProfileScreen() {
  const { user, updateUser } = useAuth();
  const { t } = useTranslation(["profile", "common"]);
  const insets = useSafeAreaInsets();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [pushEnabled, setPushEnabled] = useState(true);

  const initialForm: ProfileForm = useMemo(
    () => ({
      firstName: user?.name ?? "",
      lastName: (user as any)?.surname ?? "",
      phone: (user as any)?.phone ?? "",
      company: (user as any)?.company ?? "",
      vehiclePlate: (user as any)?.vehiclePlate ?? "",
      capacity: String((user as any)?.capacity ?? ""),
      available: (user as any)?.available ?? true,
    }),
    [user],
  );

  const [form, setForm] = useState<ProfileForm>(initialForm);

  useEffect(() => {
    setForm(initialForm);
  }, [initialForm]);

  const displayName = `${user?.name ?? t("profile:guest", { defaultValue: "Driver" })}${
    (user as any)?.surname ? ` ${(user as any).surname}` : ""
  }`.trim();

  const initials = getInitials(user?.name, (user as any)?.surname);

  const roleKey = String((user as any)?.role ?? "carrier");
  const roleLabel = t(`common:roles.${roleKey}`, { defaultValue: roleKey });
  const carrierId = String((user as any)?.carrierId ?? (user as any)?.Carrier_ID ?? user?.id ?? "").trim();
  const carrierStatus = String((user as any)?.carrierStatus ?? "").trim();
  const isBlocked = carrierStatus.toLowerCase() === "blocked";
  const blockReason = String((user as any)?.blockReason ?? "").trim();
  const blockMessage = String((user as any)?.blockMessage ?? "").trim();
  const blockUntil = formatBlockUntil((user as any)?.blockUntil);
  const availabilityLabel = form.available
    ? t("profile:available", { defaultValue: "Available" })
    : t("profile:unavailable", { defaultValue: "Unavailable" });

  const cancel = () => {
    setForm(initialForm);
    setEditing(false);
  };

  const save = async () => {
    if (saving) return;

    const capacityNum = Number(form.capacity);

    const payload: any = {
      name: form.firstName.trim(),
      surname: form.lastName.trim(),
      phone: form.phone.trim(),
      company: form.company.trim(),
      vehiclePlate: form.vehiclePlate.trim(),
      capacity: Number.isFinite(capacityNum) && form.capacity.trim() !== "" ? capacityNum : undefined,
      available: form.available,
    };

    try {
      setSaving(true);
      await updateUser(payload);
      setEditing(false);
      Alert.alert(
        t("profile:savedTitle", { defaultValue: "Profile updated" }),
        t("profile:savedBody", { defaultValue: "Your profile information has been saved." }),
      );
    } catch (error: any) {
      Alert.alert(
        t("profile:updateFailedTitle", { defaultValue: "Update failed" }),
        error?.message ?? t("profile:updateFailedBody", { defaultValue: "Please try again." }),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 118 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedView style={styles.profileCard}>
          <View style={styles.avatar}>
            <ThemedText style={styles.avatarText}>{initials}</ThemedText>
          </View>

          <View style={styles.profileMain}>
            <ThemedText style={styles.profileName}>
              {t("profile:title", { name: displayName, defaultValue: `Hi, ${displayName}` })}
            </ThemedText>

            <ThemedText style={styles.profileEmail} numberOfLines={1}>
              {user?.email ?? "—"}
            </ThemedText>

            {carrierId ? (
              <ThemedText style={styles.profileCarrierId} numberOfLines={1}>
                {t("profile:carrierIdValue", { id: carrierId, defaultValue: `Carrier ID: ${carrierId}` })}
              </ThemedText>
            ) : null}

            <View style={styles.badgeRow}>
              <View style={styles.badgePrimary}>
                <ThemedText style={styles.badgePrimaryText}>
                  {t("profile:verified", { defaultValue: "Verified" })}
                </ThemedText>
              </View>

              <View style={styles.badgeMuted}>
                <ThemedText style={styles.badgeMutedText}>
                  {t("profile:roleLabel", {
                    role: roleLabel,
                    defaultValue: `Role: ${roleLabel}`,
                  })}
                </ThemedText>
              </View>
            </View>
          </View>

          {!editing && !isBlocked ? (
            <Pressable onPress={() => setEditing(true)} style={styles.editButton} hitSlop={10}>
              <ThemedText style={styles.editButtonText}>
                {t("profile:edit", { defaultValue: "Edit" })}
              </ThemedText>
            </Pressable>
          ) : null}
        </ThemedView>

        {isBlocked ? (
          <ThemedView style={styles.blockCard}>
            <View style={styles.blockHeader}>
              <View style={styles.blockIcon}>
                <ThemedText style={styles.blockIconText}>!</ThemedText>
              </View>
              <View style={styles.blockCopy}>
                <ThemedText style={styles.blockTitle}>
                  {t("profile:blockedTitle", { defaultValue: "Account blocked" })}
                </ThemedText>
                <ThemedText style={styles.blockBody}>
                  {blockMessage ||
                    t("profile:blockedBody", {
                      defaultValue: "An admin has blocked this carrier account. Booking actions are disabled until unblock.",
                    })}
                </ThemedText>
              </View>
            </View>

            <View style={styles.infoBlock}>
              <InfoRow label={t("profile:blockStatus", { defaultValue: "Block status" })} value={carrierStatus} />
              <InfoRow
                label={t("profile:blockReason", { defaultValue: "Block reason" })}
                value={blockReason || "-"}
              />
              <InfoRow
                label={t("profile:blockUntil", { defaultValue: "Blocked until" })}
                value={blockUntil || t("profile:blockUntilManual", { defaultValue: "Until admin unblocks" })}
              />
            </View>
          </ThemedView>
        ) : carrierStatus ? (
          <ThemedView style={styles.unblockCard}>
            <InfoRow label={t("profile:blockStatus", { defaultValue: "Block status" })} value={carrierStatus} />
          </ThemedView>
        ) : null}

        {editing ? (
          <View style={styles.editActions}>
            <Pressable onPress={cancel} style={styles.cancelButton}>
              <ThemedText style={styles.cancelButtonText}>
                {t("profile:cancel", { defaultValue: "Cancel" })}
              </ThemedText>
            </Pressable>

            <Pressable onPress={save} disabled={saving} style={[styles.saveButton, saving && styles.disabled]}>
              <ThemedText style={styles.saveButtonText}>
                {saving
                  ? t("profile:saving", { defaultValue: "Saving..." })
                  : t("profile:save", { defaultValue: "Save" })}
              </ThemedText>
            </Pressable>
          </View>
        ) : null}

        <ThemedView style={styles.card}>
          <ThemedText style={styles.sectionTitle}>
            {t("profile:accountDetails", { defaultValue: "Account Details" })}
          </ThemedText>

          {!editing ? (
            <View style={styles.infoBlock}>
              <InfoRow
                label={t("profile:carrierId", { defaultValue: "Carrier ID" })}
                value={carrierId || "-"}
              />
              <InfoRow label={t("profile:firstName", { defaultValue: "First Name" })} value={user?.name ?? "-"} />
              <InfoRow
                label={t("profile:lastName", { defaultValue: "Last Name" })}
                value={(user as any)?.surname ?? "-"}
              />
              <InfoRow label={t("profile:phone", { defaultValue: "Phone" })} value={(user as any)?.phone ?? "-"} />
              <InfoRow
                label={t("profile:company", { defaultValue: "Company" })}
                value={(user as any)?.company ?? "-"}
              />
            </View>
          ) : (
            <View style={styles.formBlock}>
              <Field
                label={t("profile:firstName", { defaultValue: "First Name" })}
                value={form.firstName}
                onChangeText={(value) => setForm((state) => ({ ...state, firstName: value }))}
                placeholder={t("profile:firstNamePlaceholder", { defaultValue: "First name" })}
              />

              <Field
                label={t("profile:lastName", { defaultValue: "Last Name" })}
                value={form.lastName}
                onChangeText={(value) => setForm((state) => ({ ...state, lastName: value }))}
                placeholder={t("profile:lastNamePlaceholder", { defaultValue: "Last name" })}
              />

              <Field
                label={t("profile:phone", { defaultValue: "Phone" })}
                value={form.phone}
                onChangeText={(value) => setForm((state) => ({ ...state, phone: value }))}
                placeholder={t("profile:phonePlaceholder", { defaultValue: "Phone number" })}
                keyboardType="phone-pad"
              />

              <Field
                label={t("profile:company", { defaultValue: "Company" })}
                value={form.company}
                onChangeText={(value) => setForm((state) => ({ ...state, company: value }))}
                placeholder={t("profile:companyPlaceholder", { defaultValue: "Company" })}
              />
            </View>
          )}
        </ThemedView>

        <ThemedView style={styles.card}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>
              {t("profile:vehicle", { defaultValue: "Vehicle" })}
            </ThemedText>

            <View
              style={[
                styles.statusPill,
                form.available ? styles.statusPillAvailable : styles.statusPillUnavailable,
              ]}
            >
              <ThemedText
                style={[
                  styles.statusPillText,
                  form.available ? styles.statusTextAvailable : styles.statusTextUnavailable,
                ]}
              >
                {availabilityLabel}
              </ThemedText>
            </View>
          </View>

          {!editing ? (
            <View style={styles.infoBlock}>
              <InfoRow
                label={t("profile:plate", { defaultValue: "Plate" })}
                value={(user as any)?.vehiclePlate ?? "-"}
              />
              <InfoRow
                label={t("profile:capacity", { defaultValue: "Capacity" })}
                value={String((user as any)?.capacity ?? "-")}
              />
              <InfoRow
                label={t("profile:availability", { defaultValue: "Availability" })}
                value={(user as any)?.available ? t("profile:available", { defaultValue: "Available" }) : t("profile:unavailable", { defaultValue: "Unavailable" })}
              />
            </View>
          ) : (
            <View style={styles.formBlock}>
              <Field
                label={t("profile:plate", { defaultValue: "Plate" })}
                value={form.vehiclePlate}
                onChangeText={(value) => setForm((state) => ({ ...state, vehiclePlate: value }))}
                placeholder={t("profile:vehiclePlatePlaceholder", { defaultValue: "Vehicle plate" })}
              />

              <Field
                label={t("profile:capacity", { defaultValue: "Capacity" })}
                value={form.capacity}
                onChangeText={(value) => setForm((state) => ({ ...state, capacity: value }))}
                placeholder={t("profile:capacityPlaceholder", { defaultValue: "Capacity" })}
                keyboardType="numeric"
              />

              <SettingRow
                label={t("profile:availability", { defaultValue: "Availability" })}
                value={form.available}
                onValueChange={(value) => {
                  if (isBlocked) return;
                  setForm((state) => ({ ...state, available: value }));
                }}
              />
            </View>
          )}
        </ThemedView>

        <ThemedView style={styles.card}>
          <ThemedText style={styles.sectionTitle}>
            {t("profile:appSettings", { defaultValue: "App Settings" })}
          </ThemedText>

          <View style={styles.settingsBlock}>
            <SettingRow
              label={t("profile:pushNotifications", { defaultValue: "Push Notifications" })}
              value={pushEnabled}
              onValueChange={setPushEnabled}
            />
          </View>
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

  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: UI.borderSoft,
    backgroundColor: UI.card,
    padding: 16,
    marginBottom: 12,
  },

  avatar: {
    width: 68,
    height: 68,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.primarySoft,
    borderWidth: 1,
    borderColor: UI.primaryBorder,
    marginRight: 14,
  },

  avatarText: {
    color: UI.primary,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  profileMain: {
    flex: 1,
    minWidth: 0,
  },

  profileName: {
    color: UI.text,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900",
  },

  profileEmail: {
    color: UI.muted,
    fontSize: 13,
    marginTop: 4,
  },

  profileCarrierId: {
    color: UI.mutedSoft,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 4,
  },

  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },

  badgePrimary: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: UI.primaryBorder,
    backgroundColor: UI.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  badgePrimaryText: {
    color: "#88bdff",
    fontSize: 11,
    fontWeight: "900",
  },

  badgeMuted: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: UI.borderSoft,
    backgroundColor: UI.cardSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  badgeMutedText: {
    color: UI.muted,
    fontSize: 11,
    fontWeight: "800",
  },

  editButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: UI.primaryBorder,
    backgroundColor: UI.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 8,
  },

  editButtonText: {
    color: "#8ec2ff",
    fontSize: 12,
    fontWeight: "900",
  },

  editActions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },

  cancelButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: UI.borderSoft,
    backgroundColor: UI.card,
    alignItems: "center",
    justifyContent: "center",
  },

  cancelButtonText: {
    color: UI.text,
    fontSize: 13,
    fontWeight: "900",
  },

  saveButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: UI.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  saveButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },

  disabled: {
    opacity: 0.55,
  },

  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.card,
    padding: 16,
    marginBottom: 12,
  },

  blockCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    padding: 16,
    marginBottom: 12,
  },

  unblockCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.28)",
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    padding: 16,
    marginBottom: 12,
  },

  blockHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },

  blockIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 68, 68, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.32)",
    marginRight: 12,
  },

  blockIconText: {
    color: UI.red,
    fontSize: 18,
    fontWeight: "900",
  },

  blockCopy: {
    flex: 1,
    minWidth: 0,
  },

  blockTitle: {
    color: UI.text,
    fontSize: 16,
    fontWeight: "900",
  },

  blockBody: {
    color: UI.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },

  sectionTitle: {
    color: UI.text,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 14,
  },

  infoBlock: {
    gap: 2,
  },

  infoRow: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
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
  },

  formBlock: {
    gap: 12,
  },

  fieldWrap: {
    gap: 7,
  },

  fieldLabel: {
    color: UI.muted,
    fontSize: 12,
    fontWeight: "800",
  },

  input: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.cardSoft,
    paddingHorizontal: 13,
    color: UI.text,
    fontSize: 14,
  },

  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  statusPillAvailable: {
    borderColor: "rgba(34, 197, 94, 0.28)",
    backgroundColor: "rgba(34, 197, 94, 0.12)",
  },

  statusPillUnavailable: {
    borderColor: "rgba(239, 68, 68, 0.28)",
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },

  statusPillText: {
    fontSize: 11,
    fontWeight: "900",
  },

  statusTextAvailable: {
    color: UI.green,
  },

  statusTextUnavailable: {
    color: UI.red,
  },

  settingsBlock: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.cardSoft,
    overflow: "hidden",
  },

  settingRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 13,
  },

  settingLabel: {
    color: UI.muted,
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
    paddingRight: 12,
  },

  settingDivider: {
    height: 1,
    backgroundColor: UI.border,
    marginLeft: 13,
  },
});
