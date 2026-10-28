import Database from 'better-sqlite3';

import { runInTransaction, type Db, type SqlValue } from '../driver';

/** better-sqlite3 backed Db for tests: same SQLite engine, synchronous under the hood. */
export function createTestDb(): Db & { raw: Database.Database } {
  const raw = new Database(':memory:');
  raw.pragma('foreign_keys = ON');
  const db = {
    raw,
    exec: async (sql: string) => {
      raw.exec(sql);
    },
    run: async (sql: string, params: SqlValue[] = []) => {
      const r = raw.prepare(sql).run(...params);
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: r.changes };
    },
    all: async <T>(sql: string, params: SqlValue[] = []) => raw.prepare(sql).all(...params) as T[],
    get: async <T>(sql: string, params: SqlValue[] = []) => {
      const stmt = raw.prepare(sql);
      return ((stmt.reader ? stmt.get(...params) : undefined) ?? null) as T | null;
    },
    transaction: <T>(fn: () => Promise<T>) => runInTransaction(db, fn),
  };
  return db;
}
