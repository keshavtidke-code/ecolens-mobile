import { TIMEOUTS } from "@/config/env";
import { http } from "./client";
import type { ChatExchange, ChatHistory } from "./types";

export const chatApi = {
  async history(observationId: number): Promise<ChatHistory> {
    const { data } = await http.get<ChatHistory>(`/observations/${observationId}/chat`);
    return data;
  },
  /** Backend validation: 1-1000 chars, must contain a letter or number. */
  async send(observationId: number, message: string): Promise<ChatExchange> {
    const { data } = await http.post<ChatExchange>(
      `/observations/${observationId}/chat`,
      { message },
      { timeout: TIMEOUTS.chat },
    );
    return data;
  },
  /** Bare JSON array of up to 4 starter questions. */
  async suggestions(observationId: number): Promise<string[]> {
    const { data } = await http.get<string[]>(`/observations/${observationId}/chat/suggestions`);
    return data;
  },
};
