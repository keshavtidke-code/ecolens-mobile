import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, authApi, setApiOrigin, setAuthLostHandler, tokenStore, toApiError } from "@/api";
import type { User } from "@/api";
import { clearLocalData, getDb, kv } from "@/db/database";
import { DEFAULT_API_ORIGIN } from "@/config/env";

export type AuthStatus = "idle" | "loading" | "ready" | "error" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  error: ApiError | null;
  /** True when the app started without reaching the server (cached account, drafts still work). */
  offline: boolean;
  bootstrap: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  /** Forget this device's account. For anonymous accounts this makes the data unreachable. */
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = "user";
export const API_ORIGIN_KEY = "api_origin";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [offline, setOffline] = useState(false);
  const statusRef = useRef<AuthStatus>("idle");
  const setStatusBoth = useCallback((next: AuthStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const bootstrap = useCallback(async () => {
    setStatusBoth("loading");
    setError(null);
    setOffline(false);
    try {
      await getDb();
      const savedOrigin = await kv.get(API_ORIGIN_KEY);
      setApiOrigin(savedOrigin || DEFAULT_API_ORIGIN);
      await tokenStore.load();

      let current: User | null = null;
      if (tokenStore.get()) {
        try {
          current = await authApi.me();
        } catch (e) {
          const err = toApiError(e);
          if (err.isOffline || err.kind === "timeout") {
            const cached = await kv.get(USER_KEY);
            if (cached) {
              setUser(JSON.parse(cached) as User);
              setOffline(true);
              setStatusBoth("ready");
              return;
            }
            throw err;
          }
          if (err.kind !== "auth") throw err;
          await tokenStore.clear(); // tokens rejected: fall through to a fresh anonymous account
        }
      }
      if (!current) {
        current = (await authApi.anonymous()).user;
      }
      await kv.set(USER_KEY, JSON.stringify(current));
      setUser(current);
      setStatusBoth("ready");
    } catch (e) {
      setError(toApiError(e));
      setStatusBoth("error");
    }
  }, [setStatusBoth]);

  useEffect(() => {
    setAuthLostHandler(() => {
      if (statusRef.current === "ready") {
        setUser(null);
        setStatusBoth("unauthenticated");
      }
    });
    return () => setAuthLostHandler(null);
  }, [setStatusBoth]);

  const updateDisplayName = useCallback(async (name: string) => {
    const updated = await authApi.updateMe({ display_name: name.trim() || null });
    setUser(updated);
    await kv.set(USER_KEY, JSON.stringify(updated));
  }, []);

  const signOut = useCallback(async () => {
    await authApi.signOut();
    await clearLocalData();
    setUser(null);
    setStatusBoth("unauthenticated");
  }, [setStatusBoth]);

  const deleteAccount = useCallback(async () => {
    await authApi.deleteAccount();
    await clearLocalData();
    setUser(null);
    setStatusBoth("unauthenticated");
  }, [setStatusBoth]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, error, offline, bootstrap, updateDisplayName, signOut, deleteAccount }),
    [status, user, error, offline, bootstrap, updateDisplayName, signOut, deleteAccount],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
