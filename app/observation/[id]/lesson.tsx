import { useRouter } from "expo-router";
import React from "react";
import { Text, View } from "react-native";
import { FlowNav } from "@/components/domain/FlowNav";
import { Banner, Card, ChipRow, ErrorView, LoadingView, Paragraph, Screen, SectionTitle } from "@/components/ui";
import { useLearning } from "@/hooks/useLearning";
import { useObservationId } from "@/hooks/useObservationId";

/** 7 · Lesson */
export default function LessonScreen() {
  const router = useRouter();
  const id = useObservationId();
  const { data, error, loading, reload } = useLearning(id);

  if (loading && !data) return <LoadingView label="Preparing your lesson…" />;
  if (error && !data) return <ErrorView error={error} onRetry={() => void reload()} />;
  if (!data) return null;
  const { lesson, meta } = data;

  return (
    <Screen
      footer={
        <FlowNav
          primary={{
            title: "Take the challenge",
            icon: "flag-outline",
            onPress: () => router.push({ pathname: "/observation/[id]/challenge", params: { id: String(id) } }),
          }}
        />
      }
    >
      <Text className="text-3xl font-extrabold text-brand-900">{lesson.title}</Text>
      {lesson.knowledge_level ? <Text className="mt-1 text-sm capitalize text-ink-faint">{lesson.knowledge_level} level</Text> : null}

      {meta.cautious_mode ? (
        <View className="mt-3">
          <Banner tone="warning" icon="help-circle-outline">
            The photo analysis was uncertain, so this lesson is written cautiously.
          </Banner>
        </View>
      ) : null}
      {!meta.weather_available ? (
        <View className="mt-3">
          <Banner icon="cloud-offline-outline">Weather wasn't available, so the lesson doesn't mention it.</Banner>
        </View>
      ) : null}

      <Paragraph className="mt-4 text-lg">{lesson.ecosystem_summary}</Paragraph>

      <SectionTitle>What you're seeing</SectionTitle>
      <Paragraph>{lesson.what_you_are_seeing}</Paragraph>

      <SectionTitle>Why it matters</SectionTitle>
      <Paragraph>{lesson.why_it_matters}</Paragraph>

      <SectionTitle>Weather connection</SectionTitle>
      <Paragraph>{lesson.weather_connection}</Paragraph>

      <SectionTitle>Did you know?</SectionTitle>
      <Card className="bg-brand-50">
        <Paragraph className="text-brand-900">{lesson.interesting_fact}</Paragraph>
      </Card>

      {lesson.key_concepts.length > 0 ? (
        <>
          <SectionTitle>Key concepts</SectionTitle>
          <ChipRow items={lesson.key_concepts} />
        </>
      ) : null}
    </Screen>
  );
}
