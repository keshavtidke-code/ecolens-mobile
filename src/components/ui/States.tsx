import { Ionicons } from "@expo/vector-icons";
import React, { ComponentProps } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import type { ApiError } from "@/api";
import { colors } from "@/theme/colors";
import { Button } from "./Button";

export function LoadingView({ label = "Loading…" }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 p-8" accessibilityLabel={label}>
      <ActivityIndicator size="large" color={colors.brand} />
      <Text className="text-ink-soft">{label}</Text>
    </View>
  );
}

interface ErrorProps {
  error: ApiError | { message: string; retryable?: boolean };
  onRetry?: () => void;
  compact?: boolean;
}

export function ErrorView({ error, onRetry, compact }: ErrorProps) {
  const offline = "isOffline" in error && error.isOffline;
  return (
    <View className={`items-center justify-center gap-3 ${compact ? "p-4" : "flex-1 p-8"}`}>
      <Ionicons name={offline ? "cloud-offline-outline" : "alert-circle-outline"} size={compact ? 32 : 48} color={colors.danger} />
      <Text className="text-center text-base text-ink">{error.message}</Text>
      {onRetry ? <Button title="Try again" variant="secondary" icon="refresh" onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyState({
  icon = "leaf-outline",
  title,
  message,
  action,
}: {
  icon?: ComponentProps<typeof Ionicons>["name"];
  title: string;
  message?: string;
  action?: { title: string; onPress: () => void };
}) {
  return (
    <View className="items-center justify-center gap-2 p-8">
      <Ionicons name={icon} size={48} color={colors.inkFaint} />
      <Text className="text-lg font-semibold text-ink">{title}</Text>
      {message ? <Text className="text-center text-ink-soft">{message}</Text> : null}
      {action ? <Button className="mt-2" title={action.title} onPress={action.onPress} /> : null}
    </View>
  );
}

export function Banner({
  tone = "info",
  children,
  icon,
}: {
  tone?: "info" | "warning" | "error";
  children: React.ReactNode;
  icon?: ComponentProps<typeof Ionicons>["name"];
}) {
  const style = {
    info: { box: "bg-brand-50 border-brand-200", text: "text-brand-900", icon: colors.brand },
    warning: { box: "bg-amber-50 border-amber-200", text: "text-amber-900", icon: colors.warning },
    error: { box: "bg-red-50 border-red-200", text: "text-red-900", icon: colors.danger },
  }[tone];
  return (
    <View className={`flex-row items-start gap-2 rounded-xl border p-3 ${style.box}`}>
      <Ionicons name={icon ?? "information-circle-outline"} size={20} color={style.icon} />
      <Text className={`flex-1 text-sm leading-5 ${style.text}`}>{children}</Text>
    </View>
  );
}
