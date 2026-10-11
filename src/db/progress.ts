import { getDb } from "./database";

export interface Progress {
  observation_id: number;
  steps_done: number[];
  reflection: string | null;
  challenge_completed_at: string | null;
  action_completed_at: string | null;
}

interface Row {
  observation_id: number;
  steps_done: string;
  reflection: string | null;
  challenge_completed_at: string | null;
  action_completed_at: string | null;
}

const empty = (observationId: number): Progress => ({
  observation_id: observationId,
  steps_done: [],
  reflection: null,
  challenge_completed_at: null,
  action_completed_at: null,
});

export const progressDb = {
  async get(observationId: number): Promise<Progress> {
    const db = await getDb();
    const row = await db.getFirstAsync<Row>("SELECT * FROM challenge_progress WHERE observation_id = ?", observationId);
    if (!row) return empty(observationId);
    let steps: number[] = [];
    try {
      steps = JSON.parse(row.steps_done) as number[];
    } catch {
      steps = [];
    }
    return { ...row, steps_done: steps };
  },

  async save(progress: Progress): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO challenge_progress (observation_id, steps_done, reflection, challenge_completed_at, action_completed_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(observation_id) DO UPDATE SET
         steps_done = excluded.steps_done,
         reflection = excluded.reflection,
         challenge_completed_at = excluded.challenge_completed_at,
         action_completed_at = excluded.action_completed_at`,
      progress.observation_id,
      JSON.stringify(progress.steps_done),
      progress.reflection,
      progress.challenge_completed_at,
      progress.action_completed_at,
    );
  },
};
