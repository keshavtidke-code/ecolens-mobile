import { http } from "./client";
import { ApiError } from "./errors";
import type { JournalCreate, JournalEntry, JournalUpdate, Page } from "./types";

export const journalApi = {
  async list(params: { limit?: number; cursor?: number | null; isFavorite?: boolean } = {}): Promise<Page<JournalEntry>> {
    const { data } = await http.get<Page<JournalEntry>>("/journal", {
      params: { limit: params.limit ?? 20, cursor: params.cursor ?? undefined, is_favorite: params.isFavorite },
    });
    return data;
  },
  async get(id: number): Promise<JournalEntry> {
    const { data } = await http.get<JournalEntry>(`/journal/${id}`);
    return data;
  },
  async create(body: JournalCreate): Promise<JournalEntry> {
    const { data } = await http.post<JournalEntry>("/journal", body);
    return data;
  },
  async update(id: number, body: JournalUpdate): Promise<JournalEntry> {
    const { data } = await http.patch<JournalEntry>(`/journal/${id}`, body);
    return data;
  },
  async remove(id: number): Promise<void> {
    await http.delete(`/journal/${id}`);
  },

  /**
   * Save an observation to the journal. If the backend says the entry already exists
   * (409 journal_entry_exists) the existing entry is located and returned instead.
   */
  async saveObservation(body: JournalCreate): Promise<{ entry: JournalEntry; created: boolean }> {
    try {
      return { entry: await journalApi.create(body), created: true };
    } catch (error) {
      if (error instanceof ApiError && error.code === "journal_entry_exists") {
        const existing = await journalApi.findByObservation(body.observation_id);
        if (existing) return { entry: existing, created: false };
      }
      throw error;
    }
  },

  /** The API has no filter by observation, so page through the (small) list. */
  async findByObservation(observationId: number, maxPages = 10): Promise<JournalEntry | null> {
    let cursor: number | null = null;
    for (let i = 0; i < maxPages; i++) {
      const page: Page<JournalEntry> = await journalApi.list({ limit: 100, cursor });
      const hit = page.items.find((e) => e.observation_id === observationId);
      if (hit) return hit;
      if (page.next_cursor == null) return null;
      cursor = page.next_cursor;
    }
    return null;
  },
};
