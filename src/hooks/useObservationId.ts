import { useLocalSearchParams } from "expo-router";

export function useObservationId(): number {
  const { id } = useLocalSearchParams<{ id: string }>();
  return Number(id);
}
