import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Image, View } from "react-native";
import { observationsApi } from "@/api";
import { colors } from "@/theme/colors";

interface Props {
  photoUrl: string | null | undefined;
  /** Local file/URI (drafts, unsent photos). Takes precedence over photoUrl. */
  localUri?: string | null;
  className?: string;
}

/** Shows a server photo (needs the bearer header) or a local file, with a placeholder on failure. */
export function ObservationPhoto({ photoUrl, localUri, className = "h-56 w-full" }: Props) {
  const [failed, setFailed] = useState(false);
  const source = useMemo(
    () => (localUri ? { uri: localUri } : observationsApi.photoSource(photoUrl)),
    [localUri, photoUrl],
  );
  if (!source || failed) {
    return (
      <View className={`items-center justify-center bg-brand-50 ${className}`}>
        <Ionicons name="image-outline" size={36} color={colors.inkFaint} />
      </View>
    );
  }
  return <Image source={source} className={className} resizeMode="cover" onError={() => setFailed(true)} accessibilityIgnoresInvertColors />;
}
