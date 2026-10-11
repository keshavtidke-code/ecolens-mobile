import { Ionicons } from "@expo/vector-icons";
import React, { ComponentProps } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";
import { colors } from "@/theme/colors";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  icon?: ComponentProps<typeof Ionicons>["name"];
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

const container: Record<Variant, string> = {
  primary: "bg-brand-600 active:bg-brand-700",
  secondary: "bg-brand-100 active:bg-brand-200",
  ghost: "bg-transparent active:bg-surface-muted",
  danger: "bg-red-600 active:bg-red-700",
};
const label: Record<Variant, string> = {
  primary: "text-white",
  secondary: "text-brand-800",
  ghost: "text-brand-700",
  danger: "text-white",
};
const iconColor: Record<Variant, string> = {
  primary: colors.white,
  secondary: "#166534",
  ghost: "#15803d",
  danger: colors.white,
};

export function Button({ title, onPress, variant = "primary", icon, loading, disabled, className = "" }: Props) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={onPress}
      disabled={inactive}
      className={`min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl px-5 ${container[variant]} ${inactive ? "opacity-50" : ""} ${className}`}
    >
      {loading ? (
        <ActivityIndicator color={iconColor[variant]} />
      ) : icon ? (
        <Ionicons name={icon} size={20} color={iconColor[variant]} />
      ) : null}
      <Text className={`text-base font-semibold ${label[variant]}`}>{title}</Text>
    </Pressable>
  );
}
