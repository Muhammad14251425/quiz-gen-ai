import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'info' | 'error';
  actionLabel?: string;
  onAction?: () => void;
}

let nextId = 1;
let timer: ReturnType<typeof setTimeout> | undefined;

export const useToast = create<{ toast: Toast | null; hide: () => void }>((set) => ({
  toast: null,
  hide: () => set({ toast: null }),
}));

export function showToast(toast: Omit<Toast, 'id' | 'tone'> & { tone?: Toast['tone'] }, durationMs = 5000) {
  if (timer) clearTimeout(timer);
  useToast.setState({ toast: { tone: 'success', ...toast, id: nextId++ } });
  timer = setTimeout(() => useToast.setState({ toast: null }), durationMs);
}
