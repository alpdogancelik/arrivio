import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Ui } from "@/constants/theme";

type ScreenStateMode = "loading" | "empty" | "error";

type ScreenStateProps = {
  mode: ScreenStateMode;
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  art?: any;
  compact?: boolean;
  footer?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function ScreenState({
  mode,
  title,
  message,
  actionLabel,
  onAction,
  art,
  compact = false,
  footer,
  style,
}: ScreenStateProps) {
  return (
    <ThemedView style={[styles.card, compact ? styles.cardCompact : null, style]}>
      {art ? <Image source={art} style={[styles.art, compact ? styles.artCompact : null]} contentFit="contain" /> : null}

      {mode === "loading" ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Ui.color.primary} />
          {title ? <ThemedText style={styles.title}>{title}</ThemedText> : null}
        </View>
      ) : title ? (
        <ThemedText style={styles.title}>{title}</ThemedText>
      ) : null}

      {message ? <ThemedText style={styles.body}>{message}</ThemedText> : null}

      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={styles.action} accessibilityRole="button">
          <ThemedText style={styles.actionText}>{actionLabel}</ThemedText>
        </Pressable>
      ) : null}

      {footer}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Ui.space?.[2] ?? 16,
    borderRadius: Ui.radius?.md ?? 18,
    borderWidth: 1,
    borderColor: Ui.color.border,
    backgroundColor: Ui.color.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  cardCompact: {
    paddingVertical: Ui.space?.[2] ?? 16,
  },
  art: {
    width: 80,
    height: 80,
    opacity: 0.22,
    marginBottom: 10,
  },
  artCompact: {
    width: 64,
    height: 64,
  },
  loadingWrap: {
    alignItems: "center",
    gap: 10,
  },
  title: {
    color: Ui.color.text,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  body: {
    marginTop: 8,
    color: Ui.color.textMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  action: {
    marginTop: 12,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: Ui.radius?.sm ?? 14,
    borderWidth: 1,
    borderColor: Ui.color.primaryBorder,
    backgroundColor: Ui.color.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    color: Ui.color.primaryStrong,
    fontWeight: "900",
  },
});
