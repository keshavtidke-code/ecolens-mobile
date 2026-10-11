import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authApi, getApiOrigin, setApiOrigin, toApiError } from "@/api";
import { Button, TextField } from "@/components/ui";
import { kv } from "@/db/database";
import { API_ORIGIN_KEY, useAuth } from "@/store/auth";

const MIN_SPLASH_MS = 900;

/** 1 · Splash: restores or creates the device account, then enters the app. */
export default function SplashScreenRoute() {
  const router = useRouter();
  const { status, error, bootstrap } = useAuth();
  const started = useRef(Date.now());
  const [showServer, setShowServer] = useState(false);
  const [origin, setOrigin] = useState(getApiOrigin());
  const [serverError, setServerError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    started.current = Date.now();
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (status !== "ready") return;
    const wait = Math.max(0, MIN_SPLASH_MS - (Date.now() - started.current));
    const timer = setTimeout(() => router.replace("/home"), wait);
    return () => clearTimeout(timer);
  }, [status, router]);

  const saveServer = async () => {
    setChecking(true);
    setServerError(null);
    try {
      const clean = origin.trim().replace(/\/+$/, "");
      if (!/^https?:\/\//i.test(clean)) throw new Error("Address must start with http:// or https://");
      await authApi.health(clean);
      await kv.set(API_ORIGIN_KEY, clean);
      setApiOrigin(clean);
      setShowServer(false);
      await bootstrap();
    } catch (e) {
      setServerError(toApiError(e).message);
    } finally {
      setChecking(false);
    }
  };

  const failed = status === "error";
  return (
    <SafeAreaView className="flex-1 bg-brand-900">
      <View className="flex-1 items-center justify-center px-8">
        <View className="mb-6 h-24 w-24 items-center justify-center rounded-3xl bg-brand-600">
          <Ionicons name="leaf" size={56} color="#ffffff" />
        </View>
        <Text className="text-4xl font-extrabold text-white">EcoLens</Text>
        <Text className="mt-2 text-center text-base text-brand-200">See the ecosystem around you.</Text>

        {!failed ? (
          <ActivityIndicator className="mt-10" color="#ffffff" />
        ) : (
          <View className="mt-10 w-full gap-3 rounded-2xl bg-white p-4">
            <Text className="text-center text-base text-ink">{error?.message ?? "Couldn't start EcoLens."}</Text>
            <Button title="Try again" icon="refresh" onPress={() => void bootstrap()} />
            <Button
              title={showServer ? "Hide server settings" : "Change server address"}
              variant="ghost"
              onPress={() => setShowServer((v) => !v)}
            />
            {showServer ? (
              <View className="gap-2">
                <TextField
                  label="Server address"
                  value={origin}
                  onChangeText={setOrigin}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  error={serverError}
                  hint="Android emulator: http://10.0.2.2:8000 · Phone: http://<computer-IP>:8000"
                />
                <Button title="Test & save" variant="secondary" loading={checking} onPress={() => void saveServer()} />
              </View>
            ) : null}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
