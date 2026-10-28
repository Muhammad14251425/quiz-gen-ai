import { useCallback, useEffect, useState } from 'react';

import { useDb } from '../db/client';
import type { Db } from '../db/driver';
import { useDataVersion } from '../store/data';

export interface QueryState<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

const sameKey = (a: readonly unknown[] | undefined, b: readonly unknown[]) =>
  !!a && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

/**
 * Runs `fn` against the DB and re-runs it when `deps` change or any data is
 * written (see store/data). Previous data stays visible while reloading.
 */
export function useDbQuery<T>(fn: (db: Db) => Promise<T>, deps: readonly unknown[]): QueryState<T> {
  const db = useDb();
  const version = useDataVersion((s) => s.version);
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<{ data: T | undefined; error: Error | null; settledFor?: readonly unknown[] }>({
    data: undefined,
    error: null,
  });
  const key = [db, version, tick, ...deps];

  useEffect(() => {
    let cancelled = false;
    fn(db).then(
      (data) => !cancelled && setState({ data, error: null, settledFor: key }),
      (e: unknown) =>
        !cancelled &&
        setState((s) => ({ ...s, error: e instanceof Error ? e : new Error(String(e)), settledFor: key })),
    );
    return () => {
      cancelled = true;
    };
    // The caller declares what `fn` depends on via `deps`, like useEffect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, key);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data: state.data, error: state.error, loading: !sameKey(state.settledFor, key), reload };
}
