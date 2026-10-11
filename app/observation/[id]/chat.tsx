import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { chatApi, toApiError } from "@/api";
import type { ApiError, ChatMessage } from "@/api";
import { ChatBubble, TypingBubble } from "@/components/domain/ChatBubble";
import { Banner, Chip, EmptyState, ErrorView, LoadingView } from "@/components/ui";
import { CHAT_MAX_CHARS } from "@/config/env";
import { useAsync } from "@/hooks/useAsync";
import { useLearning } from "@/hooks/useLearning";
import { useObservationId } from "@/hooks/useObservationId";
import { useSaveToJournal } from "@/hooks/useSaveToJournal";
import { colors } from "@/theme/colors";

interface LocalMessage extends Pick<ChatMessage, "role" | "content"> {
  key: string;
  pending?: boolean;
  failed?: boolean;
}

const toLocal = (m: ChatMessage): LocalMessage => ({ key: `m${m.id}`, role: m.role, content: m.content });
const hasLetterOrDigit = (s: string) => /[\p{L}\p{N}]/u.test(s);

/** 9 · Ask AI: contextual chat about this observation (backend POST/GET /observations/{id}/chat). */
export default function ChatScreen() {
  const id = useObservationId();
  const history = useAsync(() => chatApi.history(id), [id]);
  const suggestions = useAsync(() => chatApi.suggestions(id), [id]);
  const learning = useLearning(id); // cached after the lesson/challenge screens; only supplies a default journal title
  const { save, saving } = useSaveToJournal(id, learning.data?.lesson.title);

  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<ApiError | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const list = useRef<FlatList<LocalMessage>>(null);
  const loadedFor = useRef<number | null>(null);

  useEffect(() => {
    if (history.data && loadedFor.current !== id) {
      loadedFor.current = id;
      setMessages(history.data.messages.map(toLocal));
    }
  }, [history.data, id]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const send = useCallback(
    async (raw: string, retryKey?: string) => {
      const text = raw.trim();
      if (!text || sending || cooldown > 0) return;
      if (!hasLetterOrDigit(text)) {
        setSendError(toApiError(new Error("Please ask a question using words.")));
        return;
      }
      const key = retryKey ?? `tmp${Date.now()}`;
      setSendError(null);
      setSending(true);
      setDraft("");
      setMessages((prev) => {
        const without = prev.filter((m) => m.key !== key);
        return [...without, { key, role: "user", content: text, pending: true }];
      });
      try {
        const exchange = await chatApi.send(id, text);
        setMessages((prev) => [
          ...prev.filter((m) => m.key !== key),
          toLocal(exchange.user_message),
          toLocal(exchange.assistant_message),
        ]);
        void suggestions.reload(); // the backend skips questions that were already asked
      } catch (e) {
        const apiError = toApiError(e);
        setSendError(apiError);
        if (apiError.kind === "rate_limit" && apiError.retryAfterSeconds) setCooldown(Math.ceil(apiError.retryAfterSeconds));
        setMessages((prev) => prev.map((m) => (m.key === key ? { ...m, pending: false, failed: true } : m)));
      } finally {
        setSending(false);
      }
    },
    [id, sending, cooldown, suggestions],
  );

  if (history.loading && !history.data) return <LoadingView label="Loading conversation…" />;
  if (history.error && !history.data) return <ErrorView error={history.error} onRetry={() => void history.reload()} />;

  const needsAnalysis = sendError?.code === "analysis_required" || suggestions.error?.code === "analysis_required";
  const remaining = CHAT_MAX_CHARS - draft.length;
  const canSend = draft.trim().length > 0 && !sending && cooldown === 0;
  const starter = suggestions.data ?? [];

  return (
    <SafeAreaView edges={["bottom", "left", "right"]} className="flex-1 bg-surface-muted">
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save to journal"
              onPress={() => void save()}
              disabled={saving}
              hitSlop={12}
            >
              <Ionicons name="bookmark-outline" size={24} color={colors.brandDark} />
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <FlatList
          ref={list}
          className="flex-1"
          contentContainerClassName="px-4 pt-4 pb-2"
          data={messages}
          keyExtractor={(m) => m.key}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles-outline"
              title="Ask about this place"
              message="EcoLens answers using your photo, the weather, your lesson and your challenge."
            />
          }
          renderItem={({ item }) => (
            <ChatBubble
              role={item.role}
              content={item.content}
              pending={item.pending}
              failed={item.failed}
              onRetry={() => void send(item.content, item.key)}
            />
          )}
          ListFooterComponent={sending ? <TypingBubble /> : null}
        />

        {sendError ? (
          <View className="px-4 pb-2">
            <Banner tone="error">
              {cooldown > 0 ? `You're sending messages too quickly. Try again in ${cooldown}s.` : sendError.message}
            </Banner>
          </View>
        ) : null}
        {needsAnalysis ? (
          <View className="px-4 pb-2">
            <Banner tone="warning">Analyze this photo first, then you can chat about it.</Banner>
          </View>
        ) : null}

        {starter.length > 0 && !draft && !sending ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="max-h-14 grow-0" contentContainerClassName="gap-2 px-4 py-2">
            {starter.map((question) => (
              <Chip key={question} label={question} onPress={() => void send(question)} />
            ))}
          </ScrollView>
        ) : null}

        <View className="border-t border-surface-border bg-surface px-3 py-2">
          <View className="flex-row items-end gap-2">
            <TextInput
              className="max-h-32 min-h-[44px] flex-1 rounded-2xl border border-surface-border bg-surface-muted px-4 py-3 text-base text-ink"
              placeholder="Ask a question…"
              placeholderTextColor={colors.inkFaint}
              value={draft}
              onChangeText={(t) => setDraft(t.slice(0, CHAT_MAX_CHARS))}
              multiline
              editable={!needsAnalysis}
              accessibilityLabel="Message"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send"
              disabled={!canSend}
              onPress={() => void send(draft)}
              className={`h-11 w-11 items-center justify-center rounded-full bg-brand-600 ${canSend ? "" : "opacity-40"}`}
            >
              <Ionicons name="arrow-up" size={22} color="#ffffff" />
            </Pressable>
          </View>
          {remaining < 100 ? (
            <Text className={`mt-1 text-right text-xs ${remaining < 20 ? "text-red-600" : "text-ink-faint"}`}>{remaining} left</Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
