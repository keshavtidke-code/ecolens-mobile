
import axios from "axios";
import { getApiOrigin, http } from "./client";
import { toApiError } from "./errors";
import { supabase } from "./supabase";
import type {
  AuthResponse,
  Health,
  LoginRequest,
  RegisterRequest,
  User,
} from "./types";

async function getProfile(): Promise<User> {
  const { data } = await http.get<User>("/auth/me");
  return data;
}

function toAuthResponse(user: User): AuthResponse {
  return {
    user,
    tokens: {
      access_token: "",
      refresh_token: "",
      token_type: "bearer",
      expires_in: 0,
    },
  };
}

export const authApi = {
  async anonymous(): Promise<AuthResponse> {
    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
    }

    return toAuthResponse(await getProfile());
  },

  async register(body: RegisterRequest): Promise<AuthResponse> {
    const { data, error } = await supabase.auth.signUp({
      email: body.email,
      password: body.password,
      options: { data: { display_name: body.display_name ?? null } },
    });

    if (error) throw error;
    if (!data.session) {
      throw new Error(
        "Account created. Check your email to complete sign-up, then sign in.",
      );
    }

    return toAuthResponse(await getProfile());
  },

  async login(body: LoginRequest): Promise<AuthResponse> {
    const { error } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

    if (error) throw error;
    return toAuthResponse(await getProfile());
  },

  async me(): Promise<User> {
    return getProfile();
  },

  async updateMe(body: { display_name: string | null }): Promise<User> {
    const { data } = await http.patch<User>("/auth/me", body);
    return data;
  },

  async deleteAccount(): Promise<void> {
    await http.delete("/auth/me");
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async health(origin: string = getApiOrigin()): Promise<Health> {
    try {
      const { data } = await axios.get<Health>(`${origin}/health`, {
        timeout: 8000,
      });
      return data;
    } catch (error) {
      throw toApiError(error);
    }
  },
};
