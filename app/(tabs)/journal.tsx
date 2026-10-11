import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, FlatList, View } from "react-native";
import { journalApi, toApiError } from "@/api";
import type { ApiError, JournalEntry } from "@/api";
import { ObservationCard } from "@/components/domain/ObservationCard";
import { Chip, EmptyState, ErrorView, LoadingView } from "@/components/ui";

const PAGE = 20;

/** 10 · Journal: saved observations, newest first, with a favourites filter and infinite scroll. */
export default function JournalScreen() {
  const router = useRouter();
  const [items, setItems] = useState<JournalEntry[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const request = useRef(0);

  const load = useCallback(
    async (favorites: boolean, mode: "initial" | "refresh" = "initial") => {
      const id = ++request.current;
      if (mode === "initial") setLoading(true);
      setError(null);
      try {
        const page = await journalApi.list({ limit: PAGE, isFavorite: favorites ? true : undefined });
        if (id !== request.current) return;
        setItems(page.items);
        setCursor(page.next_cursor);
      } catch (e) {
        if (id === request.current) setError(toApiError(e));
      } finally {
        if (id === request.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      void load(favoritesOnly, items.length ? "refresh" : "initial");
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, favoritesOnly]),
  );

  const loadMore = async () => {
    if (cursor == null || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await journalApi.list({ limit: PAGE, cursor, isFavorite: favoritesOnly ? true : undefined });
      setItems((prev) => [...prev, ...page.items.filter((e) => !prev.some((p) => p.id === e.id))]);
      setCursor(page.next_cursor);
    } catch (e) {
      setError(toApiError(e));
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleFilter = (favorites: boolean) => {
    if (favorites === favoritesOnly) return;
    setFavoritesOnly(favorites);
    setItems([]);
  };

  return (
    <View className="flex-1 bg-surface-muted">
      <View className="flex-row gap-2 px-4 pb-1 pt-3">
        <Chip label="All" tone={favoritesOnly ? "gray" : "green"} onPress={() => toggleFilter(false)} />
        <Chip label="Favorites" tone={favoritesOnly ? "green" : "gray"} onPress={() => toggleFilter(true)} />
      </View>

      {loading && items.length === 0 ? (
        <LoadingView label="Loading your journal…" />
      ) : error && items.length === 0 ? (
        <ErrorView error={error} onRetry={() => void load(favoritesOnly)} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(e) => String(e.id)}
          contentContainerClassName="gap-3 p-4"
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load(favoritesOnly, "refresh");
          }}
          onEndReachedThreshold={0.4}
          onEndReached={() => void loadMore()}
          ListEmptyComponent={
            <EmptyState
              icon="book-outline"
              title={favoritesOnly ? "No favorites yet" : "Your journal is empty"}
              message={favoritesOnly ? "Tap the heart on an entry to see it here." : "Finish an observation and save it to start your journal."}
              action={favoritesOnly ? undefined : { title: "New observation", onPress: () => router.push("/camera") }}
            />
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator className="my-4" /> : null}
          renderItem={({ item }) => (
            <ObservationCard
              observation={item.observation}
              title={item.title}
              favorite={item.is_favorite}
              onPress={() => router.push({ pathname: "/entry/[id]", params: { id: String(item.id) } })}
            />
          )}
        />
      )}
    </View>
  );
}
