import { create } from 'zustand';

/**
 * Bumped after every write. Screens re-run their queries when it changes, so
 * balances and lists update immediately after saves, edits and deletes.
 */
export const useDataVersion = create<{ version: number; bump: () => void }>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));

export const bumpData = () => useDataVersion.getState().bump();
