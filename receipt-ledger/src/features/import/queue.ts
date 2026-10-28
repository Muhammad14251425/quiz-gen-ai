import * as Crypto from 'expo-crypto';
import { create } from 'zustand';

import type { ParseResult } from '../../parser';
import { runPipeline } from './pipeline';
import { runPresetPipeline } from './presetPipeline';

export type ImportSource = 'share' | 'gallery';

export interface QueueItem {
  id: string;
  sourceUri: string;
  source: ImportSource;
  status: 'pending' | 'processing' | 'ready';
  imageUri?: string;
  parsed?: ParseResult;
  ocrText?: string;
  ocrError?: string;
  /** Debug/demo only: parse this text instead of running OCR. */
  presetText?: string;
}

interface QueueStore {
  items: QueueItem[];
  /** Total receipts in the current batch, for "Receipt 2 of 3". */
  batchSize: number;
  done: number;
  enqueue: (uris: string[], source: ImportSource) => void;
  enqueueItems: (items: Omit<QueueItem, 'id' | 'status'>[]) => void;
  /** Removes the head item after it was saved or skipped. */
  finish: (id: string) => void;
  clear: () => void;
}

let workerRunning = false;

async function runWorker() {
  if (workerRunning) return;
  workerRunning = true;
  try {
    for (;;) {
      const next = useImportQueue.getState().items.find((i) => i.status === 'pending');
      if (!next) break;
      update(next.id, { status: 'processing' });
      const result = next.presetText
        ? await runPresetPipeline(next.sourceUri, next.presetText)
        : await runPipeline(next.sourceUri);
      update(next.id, { status: 'ready', ...result });
    }
  } finally {
    workerRunning = false;
  }
}

function update(id: string, patch: Partial<QueueItem>) {
  useImportQueue.setState((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
}

export const useImportQueue = create<QueueStore>((set, get) => ({
  items: [],
  batchSize: 0,
  done: 0,
  enqueue: (uris, source) => get().enqueueItems(uris.map((sourceUri) => ({ sourceUri, source }))),
  enqueueItems: (newItems) => {
    if (newItems.length === 0) return;
    set((s) => {
      const fresh = s.items.length === 0;
      return {
        items: [...s.items, ...newItems.map((i) => ({ ...i, id: Crypto.randomUUID(), status: 'pending' as const }))],
        batchSize: (fresh ? 0 : s.batchSize) + newItems.length,
        done: fresh ? 0 : s.done,
      };
    });
    void runWorker();
  },
  finish: (id) =>
    set((s) => {
      const items = s.items.filter((i) => i.id !== id);
      return items.length === 0 ? { items, batchSize: 0, done: 0 } : { items, done: s.done + 1 };
    }),
  clear: () => set({ items: [], batchSize: 0, done: 0 }),
}));
