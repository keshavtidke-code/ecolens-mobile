import React from "react";
import { View } from "react-native";
import { Button } from "@/components/ui";

/** Pinned footer used by the Result → Lesson → Challenge → Ask AI flow. */
export function FlowNav({
  primary,
  secondary,
}: {
  primary: { title: string; onPress: () => void; icon?: React.ComponentProps<typeof Button>["icon"]; loading?: boolean };
  secondary?: { title: string; onPress: () => void; icon?: React.ComponentProps<typeof Button>["icon"] };
}) {
  return (
    <View className="gap-2">
      <Button {...primary} />
      {secondary ? <Button variant="ghost" {...secondary} /> : null}
    </View>
  );
}
