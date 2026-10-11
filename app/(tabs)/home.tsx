import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { observationsApi, toApiError } from "@/api";
import type { ApiError, Observation } from "@/api";
import { DraftCard } from "@/components/domain/DraftCard";
import { ObservationCard } from "@/components/domain/ObservationCard";
import { Banner, EmptyState, ErrorView, Screen } from "@/components/ui";
import { draftsDb } from "@/db/drafts";
import type { Draft } from "@/db/drafts";
import { discardDraft } from "@/services/observationPipeline";
import { useAuth } from "@/store/auth";

/** 2 · Home: start an observation, resume drafts, revisit recent observations. */
export default function HomeScreen() {
  const router = useRouter();
  const { user, offline } = useAuth();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [recent, setRecent] = useState<Observation[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setDrafts(await draftsDb.list());
    try {
      const page = await observationsApi.list({ limit: 6, status: "complete" });
      setRecent(page.items);
      setError(null);
    } catch (e) {
      setError(toApiError(e));
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const confirmDiscard = (draft: Draft) =>
    Alert.alert("Discard draft?", "The photo on this device will be deleted.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: async () => {
          await discardDraft(draft.id);
          await load();
        },
      },
    ]);

  const name = user?.display_name?.trim();

  return (
    <Screen edges={["top", "left", "right"]} refreshing={refreshing} onRefresh={() => void onRefresh()}>
      <Text className="text-3xl font-extrabold text-brand-900">{name ? `Hi, ${name}` : "Welcome"}</Text>
      <Text className="mb-5 mt-1 text-base text-ink-soft">What ecosystem are you looking at today?</Text>

      {offline ? (
        <View className="mb-4">
          <Banner tone="warning" icon="cloud-offline-outline">
            You're offline. You can still take photos — they'll be saved as drafts to analyze later.
          </Banner>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Start a new observation"
        onPress={() => router.push("/camera")}
        className="items-center gap-2 rounded-3xl bg-brand-600 px-6 py-8 active:bg-brand-700"
      >
        <Ionicons name="camera" size={44} color="#ffffff" />
        <Text className="text-xl font-bold text-white">New observation</Text>
        <Text className="text-center text-sm text-brand-100">Photograph a tree, pond, park or street corner.</Text>
      </Pressable>

      {drafts.length > 0 ? (
        <View className="mt-6 gap-3">
          <Text className="text-lg font-bold text-ink">Drafts ({drafts.length})</Text>
          {drafts.map((draft) => (
            <DraftCard
              key={draft.id}
              draft={draft}
              onResume={() => router.push({ pathname: "/analyzing", params: { draftId: String(draft.id) } })}
              onDelete={() => confirmDiscard(draft)}
            />
          ))}
        </View>
      ) : null}

      <Text className="mb-3 mt-6 text-lg font-bold text-ink">Recent observations</Text>
      {error && recent.length === 0 ? (
        <ErrorView compact error={error} onRetry={() => void load()} />
      ) : loaded && recent.length === 0 ? (
        <EmptyState title="Nothing here yet" message="Your analyzed observations will appear here." />
      ) : (
        <View className="gap-3">
          {recent.map((observation) => (
            <ObservationCard
              key={observation.id}
              observation={observation}
              onPress={() => router.push({ pathname: "/observation/[id]/result", params: { id: String(observation.id) } })}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}
