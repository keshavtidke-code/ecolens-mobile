import Constants from "expo-constants";
import { Platform } from "react-native";

const DEFAULT_ANDROID = "http://10.0.2.2:8000"; // Android emulator -> host machine
const DEFAULT_OTHER = "http://localhost:8000";

/** Server origin without the /api/v1 suffix. Can be overridden at runtime from Settings. */
export const DEFAULT_API_ORIGIN: string = (
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ||
  (Platform.OS === "android" ? DEFAULT_ANDROID : DEFAULT_OTHER)
).replace(/\/+$/, "");

export const API_PREFIX = "/api/v1";

export const TIMEOUTS = {
  default: 20_000,
  upload: 60_000,
  analyze: 90_000, // backend: synchronous Gemini vision, ~5-30 s
  learning: 90_000,
  chat: 60_000, // backend deadline is 50 s
} as const;

/** Backend LOW_CONFIDENCE_THRESHOLD default; used only to label results in the UI. */
export const LOW_CONFIDENCE_THRESHOLD = 0.5;

export const CHAT_MAX_CHARS = 1000; // backend validation limit
