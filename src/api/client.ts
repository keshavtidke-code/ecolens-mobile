
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { API_PREFIX, DEFAULT_API_ORIGIN, TIMEOUTS } from "@/config/env";
import { toApiError } from "./errors";
import { supabase } from "./supabase";

let origin = DEFAULT_API_ORIGIN;

export function getApiOrigin(): string {
  return origin;
}

export function setApiOrigin(next: string): void {
  origin = next.trim().replace(/\/+$/, "");
  http.defaults.baseURL = `${origin}${API_PREFIX}`;
}

/** Absolute URL for a backend path. */
export function apiUrl(path: string): string {
  return `${origin}${path.startsWith(API_PREFIX) ? path : API_PREFIX + path}`;
}

let onAuthLost: (() => void) | null = null;

export function setAuthLostHandler(handler: (() => void) | null): void {
  onAuthLost = handler;
}

export const http = axios.create({
  baseURL: `${origin}${API_PREFIX}`,
  timeout: TIMEOUTS.default,
  headers: { Accept: "application/json" },
});

http.interceptors.request.use(async (config) => {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  const accessToken = data.session?.access_token;

  if (accessToken && !config.headers.has("Authorization")) {
    config.headers.set("Authorization", `Bearer ${accessToken}`);
  }

  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & {
  _retried?: boolean;
};

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;

    if (
      error.response?.status === 401 &&
      config &&
      !config._retried
    ) {
      config._retried = true;

      try {
        const { data, error: refreshError } =
          await supabase.auth.refreshSession();

        const accessToken = data.session?.access_token;

        if (!refreshError && accessToken) {
          config.headers.set("Authorization", `Bearer ${accessToken}`);
          return http.request(config);
        }

        if (
          refreshError &&
          !axios.isAxiosError(refreshError)
        ) {
          await supabase.auth.signOut();
        }

        onAuthLost?.();
      } catch (refreshError) {
        return Promise.reject(toApiError(refreshError));
      }
    }

    return Promise.reject(toApiError(error));
  },
);
