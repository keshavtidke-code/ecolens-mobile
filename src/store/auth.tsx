
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ApiError,
  authApi,
  setApiOrigin,
  setAuthLostHandler,
  toApiError,
} from "@/api";
import type { User } from "@/api";
import { supabase } from "@/api/supabase";
import { clearLocalData, getDb, kv } from "@/db/database";
import { DEFAULT_API_ORIGIN } from "@/config/env";

export type AuthStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error"
  | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  error: ApiError | null;
  offline: boolean;
  bootstrap: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = "user";
export const API_ORIGIN_KEY = "api_origin";

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
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

      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      let current: User | null = null;

      if (sessionData.session) {
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

          if (err.kind !== "auth") {
            throw err;
          }

          // The backend rejected the session. Start a new anonymous session.
          const { error: signOutError } =
            await supabase.auth.signOut();

          if (signOutError) {
            throw signOutError;
          }
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

  const updateDisplayName = useCallback(
    async (name: string) => {
      const updated = await authApi.updateMe({
        display_name: name.trim() || null,
      });

      setUser(updated);
      await kv.set(USER_KEY, JSON.stringify(updated));
    },
    [],
  );

  const signOut = useCallback(async () => {
    await authApi.signOut();
    await clearLocalData();

    setUser(null);
    setOffline(false);
    setStatusBoth("unauthenticated");
  }, [setStatusBoth]);

  const deleteAccount = useCallback(async () => {
    await authApi.deleteAccount();
    await clearLocalData();

    setUser(null);
    setOffline(false);
    setStatusBoth("unauthenticated");
  }, [setStatusBoth]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      error,
      offline,
      bootstrap,
      updateDisplayName,
      signOut,
      deleteAccount,
    }),
    [
      status,
      user,
      error,
      offline,
      bootstrap,
      updateDisplayName,
      signOut,
      deleteAccount,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }

  return ctx;
}
