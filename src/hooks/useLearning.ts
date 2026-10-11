import { observationsApi } from "@/api";
import type { LearningExperience } from "@/api";
import { useAsync } from "./useAsync";

const cache = new Map<number, LearningExperience>();

/** Lesson + challenge + action for one observation. The endpoint is idempotent, so this is cheap after the first call. */
export function useLearning(observationId: number) {
  return useAsync<LearningExperience>(async () => {
    const hit = cache.get(observationId);
    if (hit) return hit;
    const result = await observationsApi.learningExperience(observationId);
    cache.set(observationId, result);
    return result;
  }, [observationId]);
}

export function clearLearningCache(): void {
  cache.clear();
}
