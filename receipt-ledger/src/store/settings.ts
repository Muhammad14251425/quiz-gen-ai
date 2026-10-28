import { create } from 'zustand';

import type { Db } from '../db/driver';
import { getSetting, setSetting } from '../db/repositories';

export type ThemePref = 'system' | 'light' | 'dark';
export type DateFormat = 'DD MMM YYYY' | 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';

export interface Settings {
  theme: ThemePref;
  currency: string;
  dateFormat: DateFormat;
  appLock: boolean;
  /** Opt-in: store the GPS position with new transactions. */
  saveLocation: boolean;
  /** Opt-in: download OpenStreetMap street tiles under the spending map. */
  onlineMap: boolean;
  onboarded: boolean;
  /** Last account used per detected bank profile id, for preselection on import. */
  lastAccountByBank: Record<string, number>;
  lastAccountId: number | null;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  currency: 'PKR',
  dateFormat: 'DD MMM YYYY',
  appLock: false,
  saveLocation: false,
  onlineMap: false,
  onboarded: false,
  lastAccountByBank: {},
  lastAccountId: null,
};

interface SettingsStore extends Settings {
  loaded: boolean;
  load: (db: Db) => Promise<void>;
  update: (db: Db, patch: Partial<Settings>) => Promise<void>;
}

const KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];

export const useSettings = create<SettingsStore>((set) => ({
  ...DEFAULT_SETTINGS,
  loaded: false,
  load: async (db) => {
    const entries = await Promise.all(KEYS.map(async (k) => [k, await getSetting(db, k, DEFAULT_SETTINGS[k])]));
    set({ ...(Object.fromEntries(entries) as Partial<Settings>), loaded: true });
  },
  update: async (db, patch) => {
    set(patch);
    await Promise.all(Object.entries(patch).map(([k, v]) => setSetting(db, k, v)));
  },
}));
