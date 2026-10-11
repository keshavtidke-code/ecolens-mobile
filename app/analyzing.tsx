import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ApiError } from "@/api";
import { StepList } from "@/components/domain/StepList";
import type { StepState } from "@/components/domain/StepList";
import { Banner, Button } from "@/components/ui";
import { isCancelledError } from "@/services/jobRegistry";
import { cancelPipeline, discardDraft, isPipelineRunning, runPipeline } from "@/services/observationPipeline";
import type { PipelineStep } from "@/services/observationPipeline";

const ORDER: PipelineStep[] = ["upload", "analyze", "lesson", "done"];
const LABELS: Record<Exclude<PipelineStep, "done">, string> = {
  upload: "Uploading your photo",
  analyze: "Reading the ecosystem (this takes ~10–30 s)",
  lesson: "Preparing your lesson",
};

/**
 * 5 · Analyzing: upload → analyze → lesson for a local draft. Resumable after any failure.
 *
 * Navigation safety: leaving this screen while the pipeline runs asks for confirmation, and confirming (or the
 * screen unmounting any other way) cancels the in-flight requests. A late result can never navigate the user
 * away from wherever they are now. The pipeline itself is single-flight per draft, so double taps and remounts
 * can't start a second, billed run.
 */
export default function AnalyzingScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const id = Number(draftId);
  const [step, setStep] = useState<PipelineStep>("upload");
  const [error, setError] = useState<ApiError | null>(null);

  const mounted = useRef(true);
  const runToken = useRef(0);
  const cancelRequested = useRef(false);
  const allowLeave = useRef(false);

  const start = useCallback(async () => {
    const token = ++runToken.current;
    const isCurrent = () => mounted.current && runToken.current === token;
    cancelRequested.current = false;
    setError(null);
    setStep("upload");
    try {
      const observationId = await runPipeline(id, (s) => {
        if (isCurrent()) setStep(s);
      });
      // The work may finish just as the user asked to stop: keep the result, but never navigate on it.
      if (!isCurrent() || cancelRequested.current) return;
      allowLeave.current = true;
      router.replace({ pathname: "/observation/[id]/result", params: { id: String(observationId) } });
    } catch (e) {
      if (isCancelledError(e) || !isCurrent()) return;
      setError(e as ApiError);
    }
  }, [id, router]);

  // Keyed on the draft id only: a changed callback identity must never cancel a running upload.
  const startRef = useRef(start);
  startRef.current = start;
  useEffect(() => {
    mounted.current = true;
    void startRef.current();
    return () => {
      mounted.current = false;
      cancelPipeline(id); // no-op if it already finished
    };
  }, [id]);

  const stopAndLeave = useCallback(
    (leave: () => void) => {
      cancelRequested.current = true;
      allowLeave.current = true;
      cancelPipeline(id);
      leave();
    },
    [id],
  );

  const confirmStop = useCallback(
    (leave: () => void) =>
      Alert.alert("Stop analyzing?", "Your photo stays saved as a draft, and you can finish it later from Home.", [
        { text: "Keep waiting", style: "cancel" },
        { text: "Stop", style: "destructive", onPress: () => stopAndLeave(leave) },
      ]),
    [stopAndLeave],
  );

  // Android back button / any navigation away while the pipeline is running.
  useEffect(
    () =>
      navigation.addListener("beforeRemove", (event) => {
        if (allowLeave.current || !isPipelineRunning(id)) return;
        event.preventDefault();
        confirmStop(() => navigation.dispatch(event.data.action));
      }),
    [navigation, id, confirmStop],
  );

  const stateOf = (target: Exclude<PipelineStep, "done">): StepState => {
    const current = ORDER.indexOf(step);
    const mine = ORDER.indexOf(target);
    if (error) return mine < current ? "done" : mine === current ? "error" : "pending";
    return mine < current ? "done" : mine === current ? "active" : "pending";
  };

  const discard = () =>
    Alert.alert("Discard this photo?", "It will be deleted from this device and won't be analyzed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: async () => {
          allowLeave.current = true;
          await discardDraft(id);
          router.replace("/home");
        },
      },
    ]);

  const canRetry = error ? error.retryable || error.code === "analysis_failed" : false;

  return (
    <SafeAreaView className="flex-1 bg-surface-muted px-6">
      <View className="flex-1 justify-center gap-8">
        <View className="gap-1">
          <Text className="text-3xl font-extrabold text-brand-900">{error ? "Something interrupted us" : "Analyzing…"}</Text>
          <Text className="text-base text-ink-soft">
            {error ? "Your photo is safe on this device." : "Hang tight — we're looking at your photo, place and weather."}
          </Text>
        </View>

        <StepList
          steps={(Object.keys(LABELS) as (keyof typeof LABELS)[]).map((key) => ({ label: LABELS[key], state: stateOf(key) }))}
        />

        {error ? (
          <View className="gap-3">
            <Banner tone={error.isOffline ? "warning" : "error"} icon={error.isOffline ? "cloud-offline-outline" : "alert-circle-outline"}>
              {error.message}
            </Banner>
            {canRetry ? <Button title="Try again" icon="refresh" onPress={() => void start()} /> : null}
            <Button title="Finish later" variant="secondary" onPress={() => router.replace("/home")} />
            <Button title="Discard photo" variant="ghost" onPress={discard} />
          </View>
        ) : (
          <Button title="Stop and finish later" variant="ghost" onPress={() => confirmStop(() => router.replace("/home"))} />
        )}
      </View>
    </SafeAreaView>
  );
}
