import * as SQLite from "expo-sqlite";

const DB_NAME = "ecolens.db";
const SCHEMA_VERSION = 2;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const current = row?.user_version ?? 0;
  if (current >= SCHEMA_VERSION) return;

  if (current < 1) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;

      -- Photos captured but not yet fully processed by the backend (offline-first queue).
      CREATE TABLE IF NOT EXISTS drafts (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        photo_path     TEXT    NOT NULL,
        latitude       REAL    NOT NULL,
        longitude      REAL    NOT NULL,
        accuracy_m     REAL,
        captured_at    TEXT    NOT NULL,
        note           TEXT,
        observation_id INTEGER,                         -- set once the upload succeeded
        stage          TEXT    NOT NULL DEFAULT 'queued', -- queued | uploaded | analyzed
        last_error     TEXT,
        created_at     TEXT    NOT NULL,
        updated_at     TEXT    NOT NULL
      );

      -- The backend has no endpoint to complete a challenge/action, so progress lives on the device.
      CREATE TABLE IF NOT EXISTS challenge_progress (
        observation_id         INTEGER PRIMARY KEY,
        steps_done             TEXT    NOT NULL DEFAULT '[]',  -- JSON array of step indexes
        reflection             TEXT,
        challenge_completed_at TEXT,
        action_completed_at    TEXT
      );

      CREATE TABLE IF NOT EXISTS kv (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }
  if (current < 2) {
    // Location accuracy metadata for drafts (where the fix came from and when it was measured).
    await db.execAsync(`
      ALTER TABLE drafts ADD COLUMN location_source TEXT;
      ALTER TABLE drafts ADD COLUMN fixed_at TEXT;
    `);
  }
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

/** Opens (and migrates) the database once; every caller awaits the same promise. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await migrate(db);
      return db;
    })().catch((error) => {
      dbPromise = null; // allow a retry
      throw error;
    });
  }
  return dbPromise;
}

export const kv = {
  async get(key: string): Promise<string | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM kv WHERE key = ?", key);
    return row?.value ?? null;
  },
  async set(key: string, value: string): Promise<void> {
    const db = await getDb();
    await db.runAsync("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, value);
  },
  async remove(key: string): Promise<void> {
    const db = await getDb();
    await db.runAsync("DELETE FROM kv WHERE key = ?", key);
  },
};

/** Wipes every table (used when the account is deleted or the device identity is reset). */
export async function clearLocalData(): Promise<void> {
  const db = await getDb();
  await db.execAsync("DELETE FROM drafts; DELETE FROM challenge_progress; DELETE FROM kv WHERE key = 'user';");
}
