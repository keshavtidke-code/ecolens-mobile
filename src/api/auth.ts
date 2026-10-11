import axios from "axios";
import { getApiOrigin, http } from "./client";
import { toApiError } from "./errors";
import { tokenStore } from "./tokenStore";
import type { AuthResponse, Health, LoginRequest, RegisterRequest, User } from "./types";

async function persist(response: AuthResponse): Promise<AuthResponse> {
  await tokenStore.save(response.tokens);
  return response;
}

export const authApi = {
  /** Device-only account (no email/password). */
  async anonymous(): Promise<AuthResponse> {
    const { data } = await http.post<AuthResponse>("/auth/anonymous");
    return persist(data);
  },
  async register(body: RegisterRequest): Promise<AuthResponse> {
    const { data } = await http.post<AuthResponse>("/auth/register", body);
    return persist(data);
  },
  async login(body: LoginRequest): Promise<AuthResponse> {
    const { data } = await http.post<AuthResponse>("/auth/login", body);
    return persist(data);
  },
  async me(): Promise<User> {
    const { data } = await http.get<User>("/auth/me");
    return data;
  },
  async updateMe(body: { display_name: string | null }): Promise<User> {
    const { data } = await http.patch<User>("/auth/me", body);
    return data;
  },
  /** Permanently deletes the account, its data and stored photos. */
  async deleteAccount(): Promise<void> {
    await http.delete("/auth/me");
    await tokenStore.clear();
  },
  async signOut(): Promise<void> {
    await tokenStore.clear();
  },
  /** Unauthenticated liveness probe (GET /health lives outside /api/v1). */
  async health(origin: string = getApiOrigin()): Promise<Health> {
    try {
      const { data } = await axios.get<Health>(`${origin}/health`, { timeout: 8000 });
      return data;
    } catch (error) {
      throw toApiError(error);
    }
  },
};
