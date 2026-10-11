import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Banner, Button, Card, Chip, ErrorView, LoadingView, Paragraph, Screen, SectionTitle, TextField } from "@/components/ui";
import { FlowNav } from "@/components/domain/FlowNav";
import { progressDb } from "@/db/progress";
import type { Progress } from "@/db/progress";
import { useLearning } from "@/hooks/useLearning";
import { useObservationId } from "@/hooks/useObservationId";
import { useSaveToJournal } from "@/hooks/useSaveToJournal";
import { colors } from "@/theme/colors";
import { humanize } from "@/utils/format";

/** 8 · Challenge + recommended action. Progress is stored on the device (the API has no completion endpoint). */
export default function ChallengeScreen() {
  const router = useRouter();
  const id = useObservationId();
  const { data, error, loading, reload } = useLearning(id);
  const [progress, setProgress] = useState<Progress | null>(null);
  const { save, saving } = useSaveToJournal(id, data?.lesson.title);

  useEffect(() => {
    void progressDb.get(id).then(setProgress);
  }, [id]);

  if ((loading && !data) || !progress) return <LoadingView label="Loading challenge…" />;
  if (error && !data) return <ErrorView error={error} onRetry={() => void reload()} />;
  if (!data) return null;
  const { challenge, recommended_action: action } = data;

  const update = (changes: Partial<Progress>) => {
    const next = { ...progress, ...changes };
    setProgress(next);
    void progressDb.save(next);
  };

  const toggleStep = (index: number) =>
    update({
      steps_done: progress.steps_done.includes(index)
        ? progress.steps_done.filter((i) => i !== index)
        : [...progress.steps_done, index],
    });

  const allDone = challenge.instructions.length > 0 && progress.steps_done.length === challenge.instructions.length;
  const completed = !!progress.challenge_completed_at;

  return (
    <Screen
      footer={
        <FlowNav
          primary={{
            title: "Ask AI a question",
            icon: "chatbubbles-outline",
            onPress: () => router.push({ pathname: "/observation/[id]/chat", params: { id: String(id) } }),
          }}
          secondary={{ title: saving ? "Saving…" : "Save to journal", icon: "bookmark-outline", onPress: () => void save() }}
        />
      }
    >
      <View className="flex-row items-center gap-2">
        <Chip label="Observation challenge" />
        {challenge.estimated_minutes ? <Chip tone="gray" label={`~${challenge.estimated_minutes} min`} /> : null}
      </View>
      <Text className="mt-3 text-3xl font-extrabold text-brand-900">{challenge.title}</Text>
      {challenge.description ? <Paragraph className="mt-2">{challenge.description}</Paragraph> : null}

      <SectionTitle>Steps</SectionTitle>
      <Card className="gap-1 p-2">
        {challenge.instructions.map((step, index) => {
          const done = progress.steps_done.includes(index);
          return (
            <Pressable
              key={index}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: done }}
              onPress={() => toggleStep(index)}
              className="flex-row items-start gap-3 rounded-xl p-2 active:bg-surface-muted"
            >
              <Ionicons name={done ? "checkbox" : "square-outline"} size={24} color={done ? colors.brand : colors.inkFaint} />
              <Text className={`flex-1 text-base leading-6 ${done ? "text-ink-faint line-through" : "text-ink"}`}>{step}</Text>
            </Pressable>
          );
        })}
      </Card>

      {challenge.success_question ? (
        <>
          <SectionTitle>Reflect</SectionTitle>
          <Paragraph className="mb-2">{challenge.success_question}</Paragraph>
          <TextField
            placeholder="Write what you noticed…"
            value={progress.reflection ?? ""}
            onChangeText={(text) => update({ reflection: text })}
            multiline
            maxLength={2000}
          />
        </>
      ) : null}

      <View className="mt-4">
        {completed ? (
          <Banner icon="checkmark-circle-outline">Challenge completed. Nice observing!</Banner>
        ) : (
          <Button
            title="Mark challenge complete"
            icon="checkmark-circle-outline"
            variant={allDone ? "primary" : "secondary"}
            onPress={() => update({ challenge_completed_at: new Date().toISOString() })}
          />
        )}
      </View>

      <SectionTitle className="mt-8">Something you can do</SectionTitle>
      <Card className="gap-2">
        <View className="flex-row flex-wrap gap-2">
          {action.category ? <Chip label={humanize(action.category)} /> : null}
          {action.impact_level ? <Chip tone="amber" label={`${humanize(action.impact_level)} impact`} /> : null}
        </View>
        <Text className="text-lg font-bold text-ink">{action.title}</Text>
        {action.description ? <Paragraph>{action.description}</Paragraph> : null}
        {progress.action_completed_at ? (
          <Banner icon="leaf-outline">Marked as done. Thank you!</Banner>
        ) : (
          <Button
            title="I did this"
            variant="secondary"
            icon="leaf-outline"
            onPress={() => update({ action_completed_at: new Date().toISOString() })}
          />
        )}
      </Card>
    </Screen>
  );
}
