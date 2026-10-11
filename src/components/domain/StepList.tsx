import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { colors } from "@/theme/colors";

export type StepState = "pending" | "active" | "done" | "error";

export function StepList({ steps }: { steps: { label: string; state: StepState }[] }) {
  return (
    <View className="gap-4">
      {steps.map((step) => (
        <View key={step.label} className="flex-row items-center gap-3">
          <View className="h-7 w-7 items-center justify-center">
            {step.state === "active" ? (
              <ActivityIndicator color={colors.brand} />
            ) : step.state === "done" ? (
              <Ionicons name="checkmark-circle" size={26} color={colors.brand} />
            ) : step.state === "error" ? (
              <Ionicons name="close-circle" size={26} color={colors.danger} />
            ) : (
              <Ionicons name="ellipse-outline" size={24} color={colors.inkFaint} />
            )}
          </View>
          <Text className={`text-base ${step.state === "pending" ? "text-ink-faint" : "font-semibold text-ink"}`}>{step.label}</Text>
        </View>
      ))}
    </View>
  );
}
