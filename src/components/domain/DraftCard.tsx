import React from "react";
import { Text, View } from "react-native";
import { Button, Card, ObservationPhoto } from "@/components/ui";
import type { Draft } from "@/db/drafts";
import { formatDateTime } from "@/utils/format";

const STAGE_LABEL: Record<Draft["stage"], string> = {
  queued: "Waiting to upload",
  uploaded: "Uploaded · analysis pending",
  analyzed: "Analyzed · finishing up",
};

export function DraftCard({ draft, onResume, onDelete }: { draft: Draft; onResume: () => void; onDelete: () => void }) {
  return (
    <Card className="gap-3">
      <View className="flex-row gap-3">
        <ObservationPhoto photoUrl={null} localUri={draft.photo_path} className="h-20 w-20 rounded-xl" />
        <View className="flex-1 justify-center">
          <Text className="text-base font-semibold text-ink">{STAGE_LABEL[draft.stage]}</Text>
          <Text className="text-sm text-ink-soft">{formatDateTime(draft.captured_at)}</Text>
          {draft.last_error ? (
            <Text className="mt-1 text-xs text-red-600" numberOfLines={2}>
              {draft.last_error}
            </Text>
          ) : null}
        </View>
      </View>
      <View className="flex-row gap-2">
        <Button className="flex-1" title="Resume" icon="cloud-upload-outline" onPress={onResume} />
        <Button className="flex-1" title="Discard" variant="ghost" onPress={onDelete} />
      </View>
    </Card>
  );
}
