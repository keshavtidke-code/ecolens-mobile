import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "@/api";
import { Button } from "@/components/ui";
import { persistDraftPhoto } from "@/services/draftFiles";
import { prepareUploadPhoto } from "@/services/imageProcessing";
import { setPendingPhotoUri } from "@/services/pendingPhoto";

/** Camera: capture a photo, persist it to permanent storage, then hand it to the review screen. */
export default function CameraScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [flash, setFlash] = useState<"off" | "on">("off");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-surface-muted px-8">
        <Ionicons name="camera-outline" size={56} color="#16a34a" />
        <Text className="text-center text-xl font-bold text-ink">Camera access needed</Text>
        <Text className="text-center text-base text-ink-soft">
          EcoLens photographs the ecosystem around you so it can explain what you're seeing.
        </Text>
        {permission.canAskAgain ? (
          <Button title="Allow camera" onPress={() => void requestPermission()} />
        ) : (
          <Button title="Open settings" onPress={() => void Linking.openSettings()} />
        )}
        <Button title="Not now" variant="ghost" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const capture = async () => {
    if (!camera.current || busy || !ready) return;
    setBusy(true);
    setError(null);
    try {
      const capturedAt = new Date().toISOString();
      const photo = await camera.current.takePictureAsync({ quality: 1, skipProcessing: true });

      // Validate / resize the photo. We pass photo.uri (original camera file) to persist
      // because the ImageManipulator output URI is a temp file deleted almost immediately.
      await prepareUploadPhoto(photo.uri, { width: photo.width, height: photo.height });

      // Copy the ORIGINAL camera photo to permanent app storage.
      // We use photo.uri (more stable) instead of prepared.uri (deleted within seconds).
      const permanentUri = await persistDraftPhoto(photo.uri);
      console.log("[camera] photo persisted to:", permanentUri);

      // Pass the URI via in-memory module, NOT via router params.
      // expo-router decodes URL params once, which corrupts the double-encoded
      // Expo Go file:// path (e.g. %2540 â†’ %40), causing ENOENT on Android.
      setPendingPhotoUri(permanentUri);
      router.replace({ pathname: "/review", params: { capturedAt } });
    } catch (e) {
      console.error("[camera] capture failed:", e);
      setError(e instanceof ApiError ? e.message : "Couldn't take the photo. Please try again.");
      setBusy(false);
    }
  };

  return (
    <View className="flex-1 bg-black">
      <CameraView
        ref={camera}
        style={{ flex: 1 }}
        facing={facing}
        flash={flash}
        mode="picture"
        onCameraReady={() => setReady(true)}
      />
      <SafeAreaView edges={["top", "bottom"]} className="absolute inset-0 justify-between" pointerEvents="box-none">
        <View className="flex-row items-center justify-between px-4 pt-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close camera"
            onPress={() => router.back()}
            className="h-11 w-11 items-center justify-center rounded-full bg-black/50"
          >
            <Ionicons name="close" size={26} color="#ffffff" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={flash === "on" ? "Turn flash off" : "Turn flash on"}
            onPress={() => setFlash((f) => (f === "on" ? "off" : "on"))}
            className="h-11 w-11 items-center justify-center rounded-full bg-black/50"
          >
            <Ionicons name={flash === "on" ? "flash" : "flash-off"} size={22} color="#ffffff" />
          </Pressable>
        </View>

        <View className="items-center gap-4 pb-6">
          {error ? <Text className="rounded-lg bg-black/60 px-3 py-2 text-white">{error}</Text> : null}
          <View className="w-full flex-row items-center justify-around">
            <View className="h-12 w-12" />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Take photo"
              onPress={() => void capture()}
              disabled={busy || !ready}
              className={`h-20 w-20 items-center justify-center rounded-full border-4 border-white ${busy || !ready ? "opacity-50" : ""}`}
            >
              {busy ? <ActivityIndicator color="#ffffff" /> : <View className="h-14 w-14 rounded-full bg-white" />}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Switch camera"
              onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))}
              className="h-12 w-12 items-center justify-center rounded-full bg-black/50"
            >
              <Ionicons name="camera-reverse-outline" size={26} color="#ffffff" />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
