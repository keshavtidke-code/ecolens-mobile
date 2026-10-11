import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { journalApi, toApiError } from "@/api";
import { Banner, Button, Card, ErrorView, LoadingView, ObservationPhoto, Screen, SectionTitle, TextField } from "@/components/ui";
import { useAsync } from "@/hooks/useAsync";
import { colors } from "@/theme/colors";
import { formatDateTime, formatPlace } from "@/utils/format";

/** 11 · Journal detail: edit title/notes, favourite, delete, jump back into the observation. */
export default function JournalDetailScreen() {
  const router = useRouter();
  const { id, saved } = useLocalSearchParams<{ id: string; saved?: string }>();
  const entryId = Number(id);
  const { data, error, loading, reload, setData } = useAsync(() => journalApi.get(entryId), [entryId]);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(saved === "1" ? "Saved to your journal." : null);

  useEffect(() => {
    if (data) {
      setTitle(data.title);
      setNotes(data.personal_notes ?? "");
    }
  }, [data?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !data) return <LoadingView label="Loading entry…" />;
  if (error && !data) return <ErrorView error={error} onRetry={() => void reload()} />;
  if (!data) return null;

  const dirty = title.trim() !== data.title || (notes.trim() || null) !== (data.personal_notes ?? null);

  const persist = async () => {
    if (!title.trim()) {
      setFormError("Give this entry a title.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const updated = await journalApi.update(entryId, { title: title.trim(), personal_notes: notes.trim() || null });
      setData(updated);
      setFlash("Changes saved.");
    } catch (e) {
      setFormError(toApiError(e).message);
    } finally {
      setSaving(false);
    }
  };

  const toggleFavorite = async () => {
    const next = !data.is_favorite;
    setData({ ...data, is_favorite: next }); // optimistic
    try {
      setData(await journalApi.update(entryId, { is_favorite: next }));
    } catch (e) {
      setData({ ...data, is_favorite: !next });
      Alert.alert("Couldn't update favorite", toApiError(e).message);
    }
  };

  const confirmDelete = () =>
    Alert.alert("Delete this entry?", "The observation and its photo stay available; only the journal entry is removed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await journalApi.remove(entryId);
            router.back();
          } catch (e) {
            Alert.alert("Couldn't delete", toApiError(e).message);
          }
        },
      },
    ]);

  const open = (screen: "result" | "lesson" | "challenge" | "chat") =>
    router.push({ pathname: `/observation/[id]/${screen}`, params: { id: String(data.observation_id) } });

  return (
    <Screen
      footer={
        <Button title="Save changes" icon="checkmark" disabled={!dirty} loading={saving} onPress={() => void persist()} />
      }
    >
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={data.is_favorite ? "Remove from favorites" : "Add to favorites"}
              onPress={() => void toggleFavorite()}
              hitSlop={12}
            >
              <Ionicons name={data.is_favorite ? "heart" : "heart-outline"} size={26} color={data.is_favorite ? colors.danger : colors.brandDark} />
            </Pressable>
          ),
        }}
      />
      <ObservationPhoto photoUrl={data.observation.photo_url} className="h-56 w-full rounded-2xl" />
      <Text className="mt-3 text-sm text-ink-soft">
        {formatPlace(data.observation)} · {formatDateTime(data.observation.captured_at)}
      </Text>

      {flash ? (
        <View className="mt-3">
          <Banner icon="checkmark-circle-outline">{flash}</Banner>
        </View>
      ) : null}

      <View className="mt-4 gap-4">
        <TextField label="Title" value={title} onChangeText={setTitle} maxLength={200} />
        <TextField
          label="My notes"
          placeholder="What did you notice? How did it feel?"
          value={notes}
          onChangeText={setNotes}
          multiline
          maxLength={10000}
        />
        {formError ? <Banner tone="error">{formError}</Banner> : null}
      </View>

      <SectionTitle>Revisit</SectionTitle>
      <Card className="gap-2">
        <Button title="Ecosystem result" variant="secondary" icon="leaf-outline" onPress={() => open("result")} />
        <Button title="Lesson" variant="secondary" icon="school-outline" onPress={() => open("lesson")} />
        <Button title="Challenge" variant="secondary" icon="flag-outline" onPress={() => open("challenge")} />
        <Button title="Ask AI" variant="secondary" icon="chatbubbles-outline" onPress={() => open("chat")} />
      </Card>

      <Button className="mt-6" title="Delete entry" variant="ghost" icon="trash-outline" onPress={confirmDelete} />
    </Screen>
  );
}
