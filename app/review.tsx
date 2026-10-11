import * as LegacyFS from "expo-file-system/legacy";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Linking, StyleSheet, Text, View } from "react-native";
import { toApiError, weatherApi } from "@/api";
import type { ApiError, WeatherPreview } from "@/api";
import { WeatherCard } from "@/components/domain/WeatherCard";
import { Banner, Button, Card, Screen, TextField } from "@/components/ui";
import { draftsDb } from "@/db/drafts";
import type { GpsFix } from "@/services/location";
import { getCurrentFix, LocationError } from "@/services/location";
import { isFixStillFresh } from "@/services/locationPolicy";
import { clearPendingPhotoUri, getPendingPhotoUri } from "@/services/pendingPhoto";
import { formatPlace, isoNow } from "@/utils/format";
import MapTilerMap from "@/components/domain/MapTilerMap";

/**
 * Image review: confirm the photo (already in permanent storage), get GPS,
 * preview place + weather on a MapTiler map, then analyze or save as a draft.
 */
export default function ReviewScreen() {
  const router = useRouter();
  const { capturedAt } = useLocalSearchParams<{ capturedAt?: string }>();

  // Read URI from in-memory store. Falls back to route param for hot-reload resilience.
  const photoUriRef = useRef<string>(getPendingPhotoUri() ?? "");
  const photoUri = photoUriRef.current;
  useEffect(() => () => clearPendingPhotoUri(), []);

  console.log("[ReviewScreen] photoUri:", photoUri);

  // Convert the file to a base64 data URI so React Native Image can display it
  // regardless of how Android handles the double-encoded file:// path.
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imgLoadError, setImgLoadError] = useState(false);

  useEffect(() => {
    if (!photoUri) { setImgLoadError(true); return; }
    LegacyFS.readAsStringAsync(photoUri, { encoding: LegacyFS.EncodingType.Base64 })
      .then((b64) => setImageSrc(`data:image/jpeg;base64,${b64}`))
      .catch((e) => {
        console.error("[ReviewScreen] Failed to read photo as base64:", e);
        setImgLoadError(true);
      });
  }, [photoUri]);

  const [fix, setFix] = useState<GpsFix | null>(null);
  const [locationError, setLocationError] = useState<LocationError | null>(null);
  const [locating, setLocating] = useState(true);

  const [preview, setPreview] = useState<WeatherPreview | null>(null);
  const [previewError, setPreviewError] = useState<ApiError | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const [note, setNote] = useState("");
  const [saving, setSaving] = useState<"analyze" | "draft" | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const captured = capturedAt ?? isoNow();

  const locate = useCallback(async () => {
    setLocating(true);
    setLocationError(null);
    try {
      setFix(await getCurrentFix());
    } catch (e) {
      setLocationError(
        e instanceof LocationError
          ? e
          : new LocationError("unavailable", "Couldn't determine your location."),
      );
    } finally {
      setLocating(false);
    }
  }, []);

  const loadPreview = useCallback(
    async (position: GpsFix) => {
      setPreviewing(true);
      setPreviewError(null);
      try {
        setPreview(await weatherApi.preview(position.latitude, position.longitude, captured));
      } catch (e) {
        setPreviewError(toApiError(e));
      } finally {
        setPreviewing(false);
      }
    },
    [captured],
  );

  useEffect(() => { void locate(); }, [locate]);
  useEffect(() => { if (fix) void loadPreview(fix); }, [fix, loadPreview]);

  if (!photoUri) {
    return (
      <Screen>
        <Banner tone="error">No photo was provided. Go back and take a new one.</Banner>
        <Button className="mt-4" title="Open camera" onPress={() => router.replace("/camera")} />
      </Screen>
    );
  }

  const saveDraft = async (): Promise<number | null> => {
    if (!fix) return null;
    if (!isFixStillFresh(fix)) {
      setFix(null);
      setPreview(null);
      setSaveError("Your location was out of date — refreshing it. Tap again in a moment.");
      void locate();
      return null;
    }
    try {
      const draft = await draftsDb.create({
        photo_path: photoUri,
        latitude: fix.latitude,
        longitude: fix.longitude,
        accuracy_m: fix.accuracyM,
        location_source: fix.source,
        fixed_at: fix.fixedAt,
        captured_at: captured,
        note,
      });
      return draft.id;
    } catch (e) {
      console.error("[ReviewScreen] draftsDb.create failed:", e);
      setSaveError(
        e instanceof Error && e.message.length < 300
          ? e.message
          : "Couldn't save the draft. Please try again.",
      );
      return null;
    }
  };

  const analyzeNow = async () => {
    setSaving("analyze");
    setSaveError(null);
    const id = await saveDraft();
    setSaving(null);
    if (id != null) router.replace({ pathname: "/analyzing", params: { draftId: String(id) } });
  };

  const saveForLater = async () => {
    setSaving("draft");
    setSaveError(null);
    const id = await saveDraft();
    setSaving(null);
    if (id != null) router.replace("/home");
  };

  return (
    <Screen
      footer={
        <View className="gap-2">
          <Button
            title="Analyze ecosystem"
            icon="sparkles-outline"
            disabled={!fix || saving !== null}
            loading={saving === "analyze"}
            onPress={() => void analyzeNow()}
          />
          <View className="flex-row gap-2">
            <Button
              className="flex-1"
              title="Retake"
              variant="ghost"
              icon="camera-outline"
              onPress={() => router.replace("/camera")}
            />
            <Button
              className="flex-1"
              title="Save draft"
              variant="secondary"
              icon="download-outline"
              disabled={!fix || saving !== null}
              loading={saving === "draft"}
              onPress={() => void saveForLater()}
            />
          </View>
        </View>
      }
    >
      {/* Photo */}
      {imgLoadError ? (
        <View style={styles.imgPlaceholder}>
          <Text style={styles.imgErrText}>Photo couldn{"'"}t load. Please retake.</Text>
        </View>
      ) : imageSrc ? (
        <Image source={{ uri: imageSrc }} style={styles.img} resizeMode="cover" />
      ) : (
        <View style={[styles.img, styles.imgLoading]}>
          <ActivityIndicator color="#16a34a" />
          <Text style={styles.imgLoadText}>Loading photo…</Text>
        </View>
      )}

      <View className="mt-4 gap-3">
        {/* Location */}
        {locating ? (
          <Card className="flex-row items-center gap-3">
            <ActivityIndicator />
            <Text className="text-base text-ink-soft">Getting your location…</Text>
          </Card>
        ) : locationError ? (
          <View className="gap-2">
            <Banner tone="error" icon="location-outline">{locationError.message}</Banner>
            <View className="flex-row gap-2">
              <Button className="flex-1" title="Try again" variant="secondary" onPress={() => void locate()} />
              {locationError.code === "permission_denied" && !locationError.canAskAgain ? (
                <Button className="flex-1" title="Open settings" variant="ghost" onPress={() => void Linking.openSettings()} />
              ) : null}
            </View>
          </View>
        ) : fix ? (
          <View className="gap-2">
            {/* MapTiler real-time map */}
            <MapTilerMap latitude={fix.latitude} longitude={fix.longitude} height={220} />

            <Card>
              <Text className="text-xs uppercase text-ink-faint">Location</Text>
              <Text className="text-base font-semibold text-ink">
                {preview ? formatPlace(preview.location) : `${fix.latitude.toFixed(4)}°N, ${fix.longitude.toFixed(4)}°E`}
              </Text>
              {fix.accuracyM != null ? (
                <Text className="text-sm text-ink-soft">{`GPS ±${Math.round(fix.accuracyM)} m`}</Text>
              ) : null}
            </Card>

            {fix.warning ? <Banner tone="warning" icon="location-outline">{fix.warning}</Banner> : null}
          </View>
        ) : null}

        {/* Weather */}
        {previewing ? (
          <Card className="flex-row items-center gap-3">
            <ActivityIndicator />
            <Text className="text-base text-ink-soft">Loading weather…</Text>
          </Card>
        ) : preview ? (
          <WeatherCard weather={preview.weather} title="Weather right now" />
        ) : previewError && fix ? (
          <View className="gap-2">
            <Banner tone="warning" icon="cloud-offline-outline">
              {previewError.isOffline
                ? "You're offline — no weather preview. You can still analyze."
                : "Weather preview unavailable. You can continue without it."}
            </Banner>
            <Button title="Retry weather" variant="ghost" onPress={() => void loadPreview(fix)} />
          </View>
        ) : null}

        <TextField
          label="Note (optional)"
          placeholder="e.g. after the rain, near the pond"
          value={note}
          onChangeText={setNote}
          maxLength={500}
          multiline
        />
        {saveError ? <Banner tone="error">{saveError}</Banner> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  img: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 16,
    backgroundColor: "#e2e8f0",
  },
  imgLoading: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  imgLoadText: {
    color: "#64748b",
    fontSize: 13,
  },
  imgPlaceholder: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 16,
    backgroundColor: "#fee2e2",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  imgErrText: {
    color: "#b91c1c",
    fontSize: 13,
    textAlign: "center",
  },
});
