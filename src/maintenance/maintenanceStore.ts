import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { MaintenanceEntry } from './types';
import { DEMO_HISTORY } from './demoHistory';

interface MaintenanceState {
  entries: MaintenanceEntry[];
  /** Historique fictif affiché uniquement si activé ; jamais mélangé aux saisies réelles. */
  showDemo: boolean;
  add: (e: Omit<MaintenanceEntry, 'id'>) => void;
  update: (id: string, patch: Partial<MaintenanceEntry>) => void;
  remove: (id: string) => void;
  setShowDemo: (v: boolean) => void;
  importJson: (json: string) => number;
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const useMaintenance = create<MaintenanceState>()(
  persist(
    (set) => ({
      entries: [],
      showDemo: true,
      add: (e) => set((s) => ({ entries: [...s.entries, { ...e, id: uid(), isDemo: false }] })),
      update: (id, patch) => set((s) => ({ entries: s.entries.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      remove: (id) => set((s) => ({ entries: s.entries.filter((x) => x.id !== id) })),
      setShowDemo: (v) => set({ showDemo: v }),
      importJson: (json) => {
        const arr = JSON.parse(json) as MaintenanceEntry[];
        if (!Array.isArray(arr)) throw new Error('Format invalide');
        const clean = arr.filter((e) => e && e.category && e.date).map((e) => ({ ...e, id: uid(), isDemo: false }));
        set((s) => ({ entries: [...s.entries, ...clean] }));
        return clean.length;
      },
    }),
    { name: 'f21.maintenance.v1', storage: createJSONStorage(() => localStorage) },
  ),
);

/** Entrées visibles : réelles, plus démo si (et seulement si) aucune saisie réelle et option active. */
export function visibleEntries(s: Pick<MaintenanceState, 'entries' | 'showDemo'>) {
  if (s.entries.length === 0 && s.showDemo) return DEMO_HISTORY;
  return s.entries;
}
