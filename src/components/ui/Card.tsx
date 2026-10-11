import React from "react";
import { Pressable, Text, View } from "react-native";

export function Card({ children, className = "", onPress }: { children: React.ReactNode; className?: string; onPress?: () => void }) {
  const base = `rounded-2xl border border-surface-border bg-surface p-4 ${className}`;
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} className={`${base} active:bg-surface-muted`}>
        {children}
      </Pressable>
    );
  }
  return <View className={base}>{children}</View>;
}

export function SectionTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <Text className={`mb-2 mt-5 text-lg font-bold text-ink ${className}`}>{children}</Text>;
}

export function Paragraph({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <Text className={`text-base leading-6 text-ink-soft ${className}`}>{children}</Text>;
}
