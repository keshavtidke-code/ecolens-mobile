import React from "react";
import { Pressable, Text, View } from "react-native";

export function Chip({ label, onPress, tone = "green" }: { label: string; onPress?: () => void; tone?: "green" | "gray" | "amber" }) {
  const tones = {
    green: "bg-brand-100 text-brand-800",
    gray: "bg-surface-muted text-ink-soft",
    amber: "bg-amber-100 text-amber-800",
  }[tone];
  const [bg, fg] = tones.split(" ");
  const content = <Text className={`text-sm font-medium ${fg}`}>{label}</Text>;
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} className={`rounded-full px-3 py-2 ${bg} active:opacity-70`}>
        {content}
      </Pressable>
    );
  }
  return <View className={`rounded-full px-3 py-1.5 ${bg}`}>{content}</View>;
}

export function ChipRow({ items, tone }: { items: string[]; tone?: "green" | "gray" | "amber" }) {
  if (items.length === 0) return null;
  return (
    <View className="flex-row flex-wrap gap-2">
      {items.map((item, i) => (
        <Chip key={`${item}-${i}`} label={item} tone={tone} />
      ))}
    </View>
  );
}
