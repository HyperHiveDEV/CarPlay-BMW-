import { create } from 'zustand';
import type { OpeningKey, OpeningState } from './types';

/**
 * États des ouvrants (portières, hayon, capot) — architecture préparée pour une future source réelle.
 *
 * AUCUNE source réelle n'est disponible aujourd'hui : les PID OBD-II standard ne contiennent pas l'état
 * des ouvrants, et une lecture BMW (bus carrosserie / CAN, via une passerelle strictement en lecture
 * seule) reste à identifier et valider. Cette interface ne comporte et ne comportera AUCUNE commande
 * d'ouverture, de fermeture ou de verrouillage.
 */

export type BodySource = 'LIVE' | 'DEMO' | 'NA';

export interface BodyReading {
  key: OpeningKey;
  state: Exclude<OpeningState, 'unknown'>;
  /** horodatage de la mesure (ms) */
  ts: number;
}

export interface BodyStatusProvider {
  readonly kind: 'none' | 'simulated' | 'gateway';
  readonly source: BodySource;
  /** Démarre la réception ; `emit` reçoit chaque lecture brute (non filtrée). */
  start(emit: (r: BodyReading) => void): void;
  stop(): void;
}

/** Aucune source : tous les états restent « inconnu ». */
export class NoBodyStatusProvider implements BodyStatusProvider {
  readonly kind = 'none' as const;
  readonly source = 'NA' as const;
  start() {}
  stop() {}
}

/** Simulation (mode démonstration) : lectures déclenchées à la main, jamais aléatoires. */
export class SimulatedBodyStatusProvider implements BodyStatusProvider {
  readonly kind = 'simulated' as const;
  readonly source = 'DEMO' as const;
  private emit: ((r: BodyReading) => void) | null = null;
  start(emit: (r: BodyReading) => void) {
    this.emit = emit;
  }
  stop() {
    this.emit = null;
  }
  /** Simule un signal (bouton de l'écran Diagnostic). */
  simulate(key: OpeningKey, state: 'open' | 'closed', ts = Date.now()) {
    this.emit?.({ key, state, ts });
  }
}

/**
 * Filtrage : un changement n'est retenu qu'après `stableMs` de lectures identiques (anti-rebond) ;
 * sans lecture depuis `staleMs`, l'état redevient « inconnu » (perte de signal).
 */
export interface FilteredState {
  state: OpeningState;
  /** horodatage de la dernière lecture reçue */
  lastReadingAt: number | null;
  /** horodatage du dernier changement d'état retenu */
  changedAt: number | null;
  pending: { state: 'open' | 'closed'; since: number } | null;
}

export const initialFiltered = (): FilteredState => ({ state: 'unknown', lastReadingAt: null, changedAt: null, pending: null });

export function applyReading(f: FilteredState, r: BodyReading, stableMs: number): FilteredState {
  const out: FilteredState = { ...f, lastReadingAt: r.ts };
  if (r.state === f.state) return { ...out, pending: null };
  const pending = f.pending && f.pending.state === r.state ? f.pending : { state: r.state, since: r.ts };
  if (r.ts - pending.since >= stableMs) return { ...out, state: r.state, changedAt: r.ts, pending: null };
  return { ...out, pending };
}

/** À appeler périodiquement : confirme un changement stable et détecte la perte de signal. */
export function tick(f: FilteredState, now: number, stableMs: number, staleMs: number): FilteredState {
  if (f.lastReadingAt != null && now - f.lastReadingAt > staleMs) return { ...f, state: 'unknown', pending: null };
  if (f.pending && now - f.pending.since >= stableMs && f.lastReadingAt != null && f.lastReadingAt >= f.pending.since)
    return { ...f, state: f.pending.state, changedAt: now, pending: null };
  return f;
}

export const BODY_KEYS: OpeningKey[] = ['driverDoor', 'passengerDoor', 'tailgate', 'hood'];
export const STABLE_MS = 300;
export const STALE_MS = 5000;

interface BodyStore {
  source: BodySource;
  kind: BodyStatusProvider['kind'];
  states: Record<OpeningKey, FilteredState>;
  /** animer le modèle 3D d'après les états (option de l'utilisateur) */
  sync: boolean;
  set: (p: Partial<BodyStore>) => void;
}

export const useBodyStatus = create<BodyStore>((set) => ({
  source: 'NA',
  kind: 'none',
  states: Object.fromEntries(BODY_KEYS.map((k) => [k, initialFiltered()])) as Record<OpeningKey, FilteredState>,
  sync: true,
  set: (p) => set(p),
}));

let active: BodyStatusProvider = new NoBodyStatusProvider();
let timer: ReturnType<typeof setInterval> | null = null;
export const simulatedBody = new SimulatedBodyStatusProvider();

/** Branche une source d'états d'ouvrants (simulation aujourd'hui ; passerelle validée demain). */
export function setBodyProvider(p: BodyStatusProvider) {
  active.stop();
  if (timer) clearInterval(timer);
  active = p;
  const reset = Object.fromEntries(BODY_KEYS.map((k) => [k, initialFiltered()])) as Record<OpeningKey, FilteredState>;
  useBodyStatus.getState().set({ source: p.source, kind: p.kind, states: reset });
  p.start((r) => {
    const s = useBodyStatus.getState();
    s.set({ states: { ...s.states, [r.key]: applyReading(s.states[r.key], r, STABLE_MS) } });
  });
  timer = setInterval(() => {
    const s = useBodyStatus.getState();
    const now = Date.now();
    let changed = false;
    const next = { ...s.states };
    for (const k of BODY_KEYS) {
      const t = tick(next[k], now, STABLE_MS, p.kind === 'simulated' ? Infinity : STALE_MS);
      if (t !== next[k]) { next[k] = t; changed = true; }
    }
    if (changed) s.set({ states: next });
  }, 100);
}
