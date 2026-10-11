import "../global.css";

import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { AuthProvider, useAuth } from "@/store/auth";
import { colors } from "@/theme/colors";

void SplashScreen.preventAutoHideAsync();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  // The refresh token was rejected (or the device was signed out): go back to the splash, which re-bootstraps.
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/");
  }, [status, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGate>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerTintColor: colors.brandDark,
            headerTitleStyle: { fontWeight: "700" },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="camera" options={{ headerShown: false, presentation: "fullScreenModal", animation: "fade" }} />
          <Stack.Screen name="review" options={{ title: "Review photo" }} />
          <Stack.Screen name="analyzing" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="observation/[id]/result" options={{ title: "Ecosystem" }} />
          <Stack.Screen name="observation/[id]/lesson" options={{ title: "Lesson" }} />
          <Stack.Screen name="observation/[id]/challenge" options={{ title: "Challenge" }} />
          <Stack.Screen name="observation/[id]/chat" options={{ title: "Ask AI" }} />
          <Stack.Screen name="entry/[id]" options={{ title: "Journal entry" }} />
        </Stack>
      </AuthGate>
    </AuthProvider>
  );
}
