import React from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

interface Props {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  padded?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: React.ReactNode;
  className?: string;
}

/** Standard screen container: safe area, optional scroll + pull-to-refresh, optional pinned footer. */
export function Screen({
  children,
  scroll = true,
  edges = ["bottom", "left", "right"],
  padded = true,
  refreshing,
  onRefresh,
  footer,
  className = "",
}: Props) {
  const pad = padded ? "px-4 pt-4" : "";
  return (
    <SafeAreaView edges={edges} className="flex-1 bg-surface-muted">
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName={`${pad} pb-8 ${className}`}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View className={`flex-1 ${pad} ${className}`}>{children}</View>
      )}
      {footer ? <View className="border-t border-surface-border bg-surface px-4 py-3">{footer}</View> : null}
    </SafeAreaView>
  );
}
