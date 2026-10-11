import React from "react";
import { Text, TextInput, TextInputProps, View } from "react-native";
import { colors } from "@/theme/colors";

interface Props extends TextInputProps {
  label?: string;
  error?: string | null;
  hint?: string;
}

export function TextField({ label, error, hint, className = "", multiline, ...rest }: Props) {
  return (
    <View className="gap-1">
      {label ? <Text className="text-sm font-semibold text-ink">{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.inkFaint}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        className={`rounded-xl border bg-surface px-4 py-3 text-base text-ink ${error ? "border-red-500" : "border-surface-border"} ${multiline ? "min-h-[96px]" : ""} ${className}`}
        {...rest}
      />
      {error ? <Text className="text-sm text-red-600">{error}</Text> : hint ? <Text className="text-sm text-ink-faint">{hint}</Text> : null}
    </View>
  );
}
