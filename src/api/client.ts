import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { API_PREFIX, DEFAULT_API_ORIGIN, TIMEOUTS } from "@/config/env";
import { toApiError } from "./errors";
import { tokenStore } from "./tokenStore";
import type { TokenPair } from "./types";

let origin = DEFAULT_API_ORIGIN;

export function getApiOrigin(): string {
  return origin;
}
export function setApiOrigin(next: string): void {
  origin = next.trim().replace(/\/+$/, "");
  http.defaults.baseURL = `${origin}${API_PREFIX}`;
}
/** Absolute URL for a backend path (accepts both "/observations/1/photo" and "/api/v1/observations/1/photo"). */
export function apiUrl(path: string): string {
  return `${origin}${path.startsWith(API_PREFIX) ? path : API_PREFIX + path}`;
}

/** Called when the refresh token is rejected, so the auth layer can send the user back to the splash screen. */
let onAuthLost: (() => void) | null = null;
export function setAuthLostHandler(handler: (() => void) | null): void {
  onAuthLost = handler;
}

export const http = axios.create({
  baseURL: `${origin}${API_PREFIX}`,
  timeout: TIMEOUTS.default,
  headers: { Accept: "application/json" },
});

http.interceptors.request.use((config) => {
  const tokens = tokenStore.get();
  if (tokens && !config.headers.has("Authorization")) {
    config.headers.set("Authorization", `Bearer ${tokens.access_token}`);
  }
  return config;
});

// ---- single-flight token refresh ----
let refreshing: Promise<TokenPair | null> | null = null;

async function refreshTokens(): Promise<TokenPair | null> {
  const current = tokenStore.get();
  if (!current) return null;
  try {
    // Plain axios: must not go through our own interceptors (no recursion).
    const { data } = await axios.post<TokenPair>(
      `${origin}${API_PREFIX}/auth/refresh`,
      { refresh_token: current.refresh_token },
      { timeout: TIMEOUTS.default },
    );
    await tokenStore.save(data);
    return data;
  } catch (error) {
    const status = (error as AxiosError).response?.status;
    if (status === 401 || status === 400 || status === 403) {
      await tokenStore.clear();
      return null;
    }
    throw error; // offline etc.: keep the tokens, let the caller see a network error
  }
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const url = config?.url ?? "";
    const isAuthCall = url.startsWith("/auth/") && !url.startsWith("/auth/me");
    if (error.response?.status === 401 && config && !config._retried && !isAuthCall && tokenStore.get()) {
      config._retried = true;
      try {
        refreshing = refreshing ?? refreshTokens().finally(() => (refreshing = null));
        const tokens = await refreshing;
        if (tokens) {
          config.headers.set("Authorization", `Bearer ${tokens.access_token}`);
          return http.request(config);
        }
        onAuthLost?.();
      } catch (refreshError) {
        return Promise.reject(toApiError(refreshError));
      }
    }
    return Promise.reject(toApiError(error));
  },
);
