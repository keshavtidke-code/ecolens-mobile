import { getDb } from "./database";

export type DraftStage = "queued" | "uploaded" | "analyzed";

export interface Draft {
  id: number;
  photo_path: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  /** "current" | "last_known": where the coordinates came from (accuracy metadata, kept on-device). */
  location_source: string | null;
  /** When the OS measured the position (ISO 8601). */
  fixed_at: string | null;
  captured_at: string;
  note: string | null;
  observation_id: number | null;
  stage: DraftStage;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export type NewDraft = Pick<Draft, "photo_path" | "latitude" | "longitude" | "captured_at"> & {
  accuracy_m?: number | null;
  location_source?: string | null;
  fixed_at?: string | null;
  note?: string | null;
};

export const draftsDb = {
  async create(input: NewDraft): Promise<Draft> {
    const db = await getDb();
    const now = new Date().toISOString();
    const result = await db.runAsync(
      `INSERT INTO drafts (photo_path, latitude, longitude, accuracy_m, location_source, fixed_at, captured_at, note, stage, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)`,
      input.photo_path, input.latitude, input.longitude, input.accuracy_m ?? null,
      input.location_source ?? null, input.fixed_at ?? null,
      input.captured_at, input.note?.trim() || null, now, now,
    );
    const draft = await draftsDb.get(result.lastInsertRowId);
    if (!draft) throw new Error("Could not save the draft.");
    return draft;
  },

  async get(id: number): Promise<Draft | null> {
    const db = await getDb();
    return db.getFirstAsync<Draft>("SELECT * FROM drafts WHERE id = ?", id);
  },

  async list(): Promise<Draft[]> {
    const db = await getDb();
    return db.getAllAsync<Draft>("SELECT * FROM drafts ORDER BY id DESC");
  },

  async count(): Promise<number> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM drafts");
    return row?.n ?? 0;
  },

  async update(id: number, changes: Partial<Pick<Draft, "observation_id" | "stage" | "last_error" | "note" | "photo_path">>): Promise<void> {
    const db = await getDb();
    const entries = Object.entries(changes);
    if (entries.length === 0) return;
    const sets = entries.map(([column]) => `${column} = ?`).join(", ");
    await db.runAsync(
      `UPDATE drafts SET ${sets}, updated_at = ? WHERE id = ?`,
      ...entries.map(([, value]) => (value === undefined ? null : (value as string | number | null))),
      new Date().toISOString(),
      id,
    );
  },

  async remove(id: number): Promise<void> {
    const db = await getDb();
    await db.runAsync("DELETE FROM drafts WHERE id = ?", id);
  },
};
