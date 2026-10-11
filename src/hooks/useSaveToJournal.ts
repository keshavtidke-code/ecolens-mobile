import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { journalApi, toApiError } from "@/api";

/** "Save to journal" for the end of the flow. Creates the entry (or finds the existing one) and opens it. */
export function useSaveToJournal(observationId: number, defaultTitle: string | null | undefined) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const save = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const title = (defaultTitle?.trim() || "My observation").slice(0, 200);
      const { entry, created } = await journalApi.saveObservation({ observation_id: observationId, title });
      router.push({ pathname: "/entry/[id]", params: { id: String(entry.id), saved: created ? "1" : "0" } });
    } catch (e) {
      Alert.alert("Couldn't save to journal", toApiError(e).message);
    } finally {
      setSaving(false);
    }
  }, [saving, defaultTitle, observationId, router]);

  return { save, saving };
}
