import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Text, View } from "react-native";
import { observationsApi, toApiError } from "@/api";
import type { ApiError, Perception } from "@/api";
import { FlowNav } from "@/components/domain/FlowNav";
import { WeatherCard } from "@/components/domain/WeatherCard";
import { Banner, Card, ChipRow, ErrorView, LoadingView, ObservationPhoto, Paragraph, Screen, SectionTitle } from "@/components/ui";
import { LOW_CONFIDENCE_THRESHOLD } from "@/config/env";
import { useAsync } from "@/hooks/useAsync";
import { useObservationId } from "@/hooks/useObservationId";
import { formatDateTime, formatPlace, humanize, percent } from "@/utils/format";

function Facts({ perception }: { perception: Perception }) {
  const rows: [string, string][] = [
    ["Water", humanize(perception.water_presence)],
    ["Soil", humanize(perception.soil_condition)],
    ["Vegetation", humanize(perception.vegetation_density)],
  ];
  return (
    <Card className="gap-2">
      {rows.map(([label, value]) => (
        <View key={label} className="flex-row justify-between">
          <Text className="text-base text-ink-soft">{label}</Text>
          <Text className="text-base font-semibold text-ink">{value}</Text>
        </View>
      ))}
    </Card>
  );
}

function List({ title, items, tone }: { title: string; items: string[]; tone?: "green" | "gray" | "amber" }) {
  if (items.length === 0) return null;
  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      <ChipRow items={items} tone={tone} />
    </>
  );
}

/** 6 · Ecosystem result */
export default function EcosystemResultScreen() {
  const router = useRouter();
  const id = useObservationId();
  const { data, error, loading, reload } = useAsync(() => observationsApi.get(id), [id]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<ApiError | null>(null);

  if (loading && !data) return <LoadingView label="Loading observation…" />;
  if (error && !data) return <ErrorView error={error} onRetry={() => void reload()} />;
  if (!data) return null;

  const perception = data.analysis?.perception_json ?? null;
  const lowConfidence = perception
    ? perception.ecosystem_type === "unclear" || perception.confidence < LOW_CONFIDENCE_THRESHOLD
    : false;

  const analyzeNow = async () => {
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      await observationsApi.analyze(id);
      await reload();
    } catch (e) {
      const apiError = toApiError(e);
      setAnalyzeError(apiError);
    } finally {
      setAnalyzing(false);
    }
  };

  if (!perception) {
    return (
      <Screen>
        <ObservationPhoto photoUrl={data.photo_url} className="h-56 w-full rounded-2xl" />
        <View className="mt-4 gap-3">
          <Banner tone="warning">
            {data.status === "analyzing" ? "This photo is still being analyzed." : "This photo hasn't been analyzed yet."}
          </Banner>
          {analyzeError ? <Banner tone="error">{analyzeError.message}</Banner> : null}
          <FlowNav primary={{ title: "Analyze now", icon: "sparkles-outline", loading: analyzing, onPress: () => void analyzeNow() }} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <FlowNav
          primary={{
            title: "Start lesson",
            icon: "school-outline",
            onPress: () => router.push({ pathname: "/observation/[id]/lesson", params: { id: String(id) } }),
          }}
          secondary={{
            title: "Ask AI about this",
            icon: "chatbubbles-outline",
            onPress: () => router.push({ pathname: "/observation/[id]/chat", params: { id: String(id) } }),
          }}
        />
      }
    >
      <ObservationPhoto photoUrl={data.photo_url} className="h-56 w-full rounded-2xl" />

      <Text className="mt-4 text-3xl font-extrabold text-brand-900">{humanize(perception.ecosystem_type)}</Text>
      <Text className="mt-1 text-base text-ink-soft">
        {formatPlace(data)} · {formatDateTime(data.captured_at)}
      </Text>
      <Text className="mt-1 text-sm text-ink-faint">
        Confidence {percent(perception.ecosystem_confidence)}
        {data.analysis?.season_context ? ` · ${humanize(data.analysis.season_context)}` : ""}
      </Text>

      {lowConfidence ? (
        <View className="mt-3">
          <Banner tone="warning" icon="help-circle-outline">
            The AI isn't very sure about this one. Treat the details as a best guess, or try a closer, well-lit photo.
          </Banner>
        </View>
      ) : null}

      {data.analysis?.summary ? <Paragraph className="mt-4">{data.analysis.summary}</Paragraph> : null}

      {data.weather_snapshot ? (
        <View className="mt-4">
          <WeatherCard weather={data.weather_snapshot} title="Weather when you took the photo" />
        </View>
      ) : (
        <View className="mt-4">
          <Banner icon="cloud-offline-outline">Weather wasn't available for this observation.</Banner>
        </View>
      )}

      <SectionTitle>At a glance</SectionTitle>
      <Facts perception={perception} />

      <List title="What's visible" items={perception.visible_elements} tone="gray" />
      <List title="Plants" items={perception.flora} />
      <List title="Animals" items={perception.fauna} />
      <List title="Human impact" items={perception.human_impact} tone="amber" />
      <List title="Pressures on this place" items={perception.environmental_pressures} tone="amber" />

      {perception.interesting_observations.length > 0 ? (
        <>
          <SectionTitle>Look closer</SectionTitle>
          <Card className="gap-2">
            {perception.interesting_observations.map((item, i) => (
              <Text key={i} className="text-base leading-6 text-ink-soft">
                • {item}
              </Text>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
