import * as SQLite from 'expo-sqlite';

import { runInTransaction, type Db, type RunResult, type SqlValue } from './driver';

/** Serializes transactions so two BEGINs never overlap on the single connection. */
function createMutex() {
  let last: Promise<unknown> = Promise.resolve();
  return <T>(fn: () => Promise<T>): Promise<T> => {
    const next = last.then(fn, fn);
    last = next.catch(() => undefined);
    return next;
  };
}

export function createExpoDb(native: SQLite.SQLiteDatabase): Db {
  const lock = createMutex();
  const db: Db = {
    exec: (sql) => native.execAsync(sql),
    run: async (sql, params: SqlValue[] = []): Promise<RunResult> => {
      const r = await native.runAsync(sql, params);
      return { lastInsertRowId: r.lastInsertRowId, changes: r.changes };
    },
    all: (sql, params: SqlValue[] = []) => native.getAllAsync(sql, params),
    get: (sql, params: SqlValue[] = []) => native.getFirstAsync(sql, params),
    transaction: (fn) => lock(() => runInTransaction(db, fn)),
  };
  return db;
}

export const DATABASE_NAME = 'ledger.db';

export async function openExpoDb(): Promise<Db> {
  const native = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await native.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  return createExpoDb(native);
}
