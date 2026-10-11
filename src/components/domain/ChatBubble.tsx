import React from "react";
import { Pressable, Text, View } from "react-native";
import type { ChatRole } from "@/api";

export interface BubbleProps {
  role: ChatRole;
  content: string;
  pending?: boolean;
  failed?: boolean;
  onRetry?: () => void;
}

export function ChatBubble({ role, content, pending, failed, onRetry }: BubbleProps) {
  const mine = role === "user";
  return (
    <View className={`mb-3 max-w-[85%] ${mine ? "self-end" : "self-start"}`}>
      <View
        className={`rounded-2xl px-4 py-3 ${mine ? "rounded-br-sm bg-brand-600" : "rounded-bl-sm border border-surface-border bg-surface"} ${pending ? "opacity-70" : ""}`}
      >
        <Text selectable className={`text-base leading-6 ${mine ? "text-white" : "text-ink"}`}>
          {content}
        </Text>
      </View>
      {failed ? (
        <Pressable onPress={onRetry} accessibilityRole="button" className="mt-1 self-end">
          <Text className="text-sm font-semibold text-red-600">Not sent · Tap to retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function TypingBubble() {
  return (
    <View className="mb-3 self-start rounded-2xl rounded-bl-sm border border-surface-border bg-surface px-4 py-3">
      <Text className="text-base text-ink-faint">EcoLens is thinking…</Text>
    </View>
  );
}
