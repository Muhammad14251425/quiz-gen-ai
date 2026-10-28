export type SqlValue = string | number | null;

export interface RunResult {
  lastInsertRowId: number;
  changes: number;
}

/**
 * Minimal async SQL interface. The app uses an expo-sqlite implementation;
 * tests use better-sqlite3 so migrations and queries run against real SQLite.
 */
export interface Db {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<RunResult>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  get<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  /** Runs `fn` inside BEGIN/COMMIT, rolling back on error. */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}

/** Shared transaction helper for drivers that only expose exec(). */
export async function runInTransaction<T>(db: Pick<Db, 'exec'>, fn: () => Promise<T>): Promise<T> {
  await db.exec('BEGIN');
  try {
    const result = await fn();
    await db.exec('COMMIT');
    return result;
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
}
