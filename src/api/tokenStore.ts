import * as SecureStore from "expo-secure-store";
import type { TokenPair } from "./types";

const KEY = "ecolens.tokens";

let memory: TokenPair | null = null;

export const tokenStore = {
  get(): TokenPair | null {
    return memory;
  },
  async load(): Promise<TokenPair | null> {
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      memory = raw ? (JSON.parse(raw) as TokenPair) : null;
    } catch {
      memory = null;
    }
    return memory;
  },
  async save(tokens: TokenPair): Promise<void> {
    memory = tokens;
    await SecureStore.setItemAsync(KEY, JSON.stringify(tokens));
  },
  async clear(): Promise<void> {
    memory = null;
    try {
      await SecureStore.deleteItemAsync(KEY);
    } catch {
      /* nothing to delete */
    }
  },
};
