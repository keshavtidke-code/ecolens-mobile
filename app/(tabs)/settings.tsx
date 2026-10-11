import Constants from "expo-constants";
import React, { useCallback, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { authApi, getApiOrigin, setApiOrigin, toApiError } from "@/api";
import { Banner, Button, Card, Screen, SectionTitle, TextField } from "@/components/ui";
import { kv } from "@/db/database";
import { draftsDb } from "@/db/drafts";
import { clearLearningCache } from "@/hooks/useLearning";
import { discardDraft } from "@/services/observationPipeline";
import { API_ORIGIN_KEY, useAuth } from "@/store/auth";
import { formatDate } from "@/utils/format";

/** 12 · Settings: profile, server address, offline drafts, account. */
export default function SettingsScreen() {
  const { user, offline, updateDisplayName, signOut, deleteAccount } = useAuth();
  const [name, setName] = useState(user?.display_name ?? "");
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingName, setSavingName] = useState(false);

  const [origin, setOrigin] = useState(getApiOrigin());
  const [serverMsg, setServerMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const [draftCount, setDraftCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void draftsDb.count().then(setDraftCount);
    }, []),
  );

  const saveName = async () => {
    setSavingName(true);
    setNameMsg(null);
    try {
      await updateDisplayName(name);
      setNameMsg({ ok: true, text: "Saved." });
    } catch (e) {
      setNameMsg({ ok: false, text: toApiError(e).message });
    } finally {
      setSavingName(false);
    }
  };

  const saveServer = async () => {
    setTesting(true);
    setServerMsg(null);
    try {
      const clean = origin.trim().replace(/\/+$/, "");
      if (!/^https?:\/\//i.test(clean)) throw new Error("Address must start with http:// or https://");
      const health = await authApi.health(clean);
      await kv.set(API_ORIGIN_KEY, clean);
      setApiOrigin(clean);
      setServerMsg({ ok: true, text: `Connected · server v${health.version} (${health.environment}). Restart the app if you switched servers.` });
    } catch (e) {
      setServerMsg({ ok: false, text: toApiError(e).message });
    } finally {
      setTesting(false);
    }
  };

  const discardAllDrafts = () =>
    Alert.alert("Discard all drafts?", "Photos waiting to be analyzed will be deleted from this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Discard all",
        style: "destructive",
        onPress: async () => {
          for (const draft of await draftsDb.list()) await discardDraft(draft.id);
          setDraftCount(0);
        },
      },
    ]);

  const confirmSignOut = () =>
    Alert.alert(
      "Sign out of this device?",
      user?.is_anonymous
        ? "This device uses an anonymous account. Signing out means you can't get back to your observations and journal."
        : "You'll need your email and password to come back.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            clearLearningCache();
            await signOut();
          },
        },
      ],
    );

  const confirmDelete = () =>
    Alert.alert("Delete account and all data?", "Your observations, photos, lessons, chats and journal will be permanently deleted. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete everything",
        style: "destructive",
        onPress: async () => {
          try {
            clearLearningCache();
            await deleteAccount();
          } catch (e) {
            Alert.alert("Couldn't delete account", toApiError(e).message);
          }
        },
      },
    ]);

  return (
    <Screen>
      {offline ? (
        <View className="mb-4">
          <Banner tone="warning" icon="cloud-offline-outline">
            Offline mode: showing your saved account details.
          </Banner>
        </View>
      ) : null}

      <SectionTitle className="mt-0">Profile</SectionTitle>
      <Card className="gap-3">
        <Text className="text-sm text-ink-soft">
          {user?.is_anonymous ? "Anonymous device account" : (user?.email ?? "Account")}
          {user ? ` · since ${formatDate(user.created_at)}` : ""}
        </Text>
        <TextField label="Display name" value={name} onChangeText={setName} maxLength={100} placeholder="What should we call you?" />
        {nameMsg ? <Banner tone={nameMsg.ok ? "info" : "error"}>{nameMsg.text}</Banner> : null}
        <Button title="Save name" variant="secondary" loading={savingName} onPress={() => void saveName()} />
      </Card>

      <SectionTitle>Server</SectionTitle>
      <Card className="gap-3">
        <TextField
          label="API address"
          value={origin}
          onChangeText={setOrigin}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          hint="Android emulator: http://10.0.2.2:8000 · Phone: http://<computer-IP>:8000"
        />
        {serverMsg ? <Banner tone={serverMsg.ok ? "info" : "error"}>{serverMsg.text}</Banner> : null}
        <Button title="Test & save" variant="secondary" loading={testing} onPress={() => void saveServer()} />
      </Card>

      <SectionTitle>Offline drafts</SectionTitle>
      <Card className="gap-3">
        <Text className="text-base text-ink-soft">
          {draftCount === 0 ? "No drafts waiting." : `${draftCount} photo${draftCount === 1 ? "" : "s"} waiting to be analyzed. Resume them from Home.`}
        </Text>
        {draftCount > 0 ? <Button title="Discard all drafts" variant="ghost" onPress={discardAllDrafts} /> : null}
      </Card>

      <SectionTitle>Account</SectionTitle>
      <Card className="gap-2">
        <Button title="Sign out of this device" variant="secondary" icon="log-out-outline" onPress={confirmSignOut} />
        <Button title="Delete account & data" variant="danger" icon="trash-outline" onPress={confirmDelete} />
      </Card>

      <Text className="mt-8 text-center text-xs text-ink-faint">
        EcoLens {Constants.expoConfig?.version ?? ""} · {getApiOrigin()}
      </Text>
    </Screen>
  );
}
