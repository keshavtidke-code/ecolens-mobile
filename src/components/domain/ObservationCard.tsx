import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, View } from "react-native";
import type { Observation } from "@/api";
import { Card, ObservationPhoto } from "@/components/ui";
import { colors } from "@/theme/colors";
import { formatDate, formatPlace, humanize } from "@/utils/format";

export function ObservationCard({
  observation,
  title,
  favorite,
  onPress,
}: {
  observation: Observation;
  title?: string;
  favorite?: boolean;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress} className="overflow-hidden p-0">
      <ObservationPhoto photoUrl={observation.photo_url} className="h-36 w-full" />
      <View className="gap-1 p-3">
        <View className="flex-row items-center justify-between">
          <Text className="flex-1 text-base font-bold text-ink" numberOfLines={1}>
            {title ?? formatPlace(observation)}
          </Text>
          {favorite ? <Ionicons name="heart" size={18} color={colors.danger} /> : null}
        </View>
        <Text className="text-sm text-ink-soft" numberOfLines={1}>
          {title ? `${formatPlace(observation)} · ` : ""}
          {formatDate(observation.captured_at)}
        </Text>
        {observation.status !== "complete" ? (
          <Text className="text-xs font-semibold text-amber-700">{humanize(observation.status)}</Text>
        ) : null}
      </View>
    </Card>
  );
}

