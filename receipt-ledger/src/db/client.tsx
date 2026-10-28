import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import type { Db } from './driver';
import { openExpoDb } from './expoDriver';
import { migrate } from './migrations';

let dbPromise: Promise<Db> | null = null;

/** Opens the database once and runs pending migrations. */
export function getDb(): Promise<Db> {
  dbPromise ??= openExpoDb().then(async (db) => {
    await migrate(db);
    return db;
  });
  return dbPromise;
}

const DbContext = createContext<Db | null>(null);

export function DbProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [db, setDb] = useState<Db | null>(null);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    getDb().then(setDb, (e: unknown) => setError(e instanceof Error ? e : new Error(String(e))));
  }, []);
  if (error) throw error;
  if (!db) return <>{fallback}</>;
  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}

export function useDb(): Db {
  const db = useContext(DbContext);
  if (!db) throw new Error('useDb must be used inside <DbProvider>');
  return db;
}
