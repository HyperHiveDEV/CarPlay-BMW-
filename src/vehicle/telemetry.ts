import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { DataSource, MetricKey } from './types';
import { useVehicleRepo } from './VehicleDataRepository';

/**
 * Sessions de télémétrie : enregistrement à 2 Hz des métriques moteur (avec leur provenance
 * LIVE / DEMO / N/A), conservation locale hors ligne, export CSV.
 * Les métriques indisponibles sont enregistrées vides (aucune valeur inventée).
 */

export const SESSION_KEYS = ['rpm', 'speed', 'coolantTemp', 'oilTemp', 'intakeAirTemp', 'map', 'boost', 'throttle', 'load', 'battery'] as const satisfies readonly MetricKey[];
export type SessionKey = (typeof SESSION_KEYS)[number];

export const SESSION_COLUMNS: Record<SessionKey, { csv: string; label: string; unit: string; digits: number }> = {
  rpm: { csv: 'regime_tr_min', label: 'Régime', unit: 'tr/min', digits: 0 },
  speed: { csv: 'vitesse_km_h', label: 'Vitesse', unit: 'km/h', digits: 0 },
  coolantTemp: { csv: 'liquide_refroidissement_c', label: 'Liquide refr.', unit: '°C', digits: 0 },
  oilTemp: { csv: 'huile_c', label: 'Huile', unit: '°C', digits: 0 },
  intakeAirTemp: { csv: 'air_admission_c', label: 'Air admission', unit: '°C', digits: 0 },
  map: { csv: 'pression_admission_kpa', label: 'Pression admission', unit: 'kPa', digits: 0 },
  boost: { csv: 'suralimentation_bar', label: 'Suralimentation', unit: 'bar', digits: 2 },
  throttle: { csv: 'accelerateur_pct', label: 'Accélérateur', unit: '%', digits: 0 },
  load: { csv: 'charge_moteur_pct', label: 'Charge moteur', unit: '%', digits: 0 },
  battery: { csv: 'batterie_v', label: 'Batterie', unit: 'V', digits: 2 },
};

/** Échantillon compact : t (ms depuis le début), valeurs (null = N/A), sources ('L' | 'D' | 'N'). */
export interface Sample {
  t: number;
  v: (number | null)[];
  s: string;
}

export interface TelemetrySession {
  id: string;
  startedAt: number;
  endedAt: number;
  /** provenance dominante : LIVE, DEMO, ou MIXTE si les deux */
  source: 'LIVE' | 'DEMO' | 'MIXTE' | 'NA';
  samples: Sample[];
  /** arrêt automatique (durée max ou mémoire) */
  truncated?: string;
}

export const SAMPLE_PERIOD_MS = 500; // 2 Hz stockés
export const MAX_SESSION_MS = 30 * 60 * 1000; // 30 min par session
export const MAX_SESSIONS = 10;

const code = (s: DataSource) => (s === 'LIVE' ? 'L' : s === 'DEMO' ? 'D' : 'N');

/** Échantillon à partir des métriques courantes (fonction pure, testée). */
export function makeSample(t: number, metrics: Record<MetricKey, { value: number | null; source: DataSource }>): Sample {
  return {
    t,
    v: SESSION_KEYS.map((k) => (metrics[k].source === 'NA' || metrics[k].value == null ? null : Math.round(metrics[k].value! * 100) / 100)),
    s: SESSION_KEYS.map((k) => code(metrics[k].value == null ? 'NA' : metrics[k].source)).join(''),
  };
}

export function sessionSource(samples: Sample[]): TelemetrySession['source'] {
  let live = false, demo = false;
  for (const x of samples) { if (x.s.includes('L')) live = true; if (x.s.includes('D')) demo = true; }
  return live && demo ? 'MIXTE' : live ? 'LIVE' : demo ? 'DEMO' : 'NA';
}

export interface SessionStats {
  durationS: number;
  samples: number;
  max: Partial<Record<SessionKey, number>>;
  avg: Partial<Record<SessionKey, number>>;
}

export function sessionStats(s: TelemetrySession): SessionStats {
  const max: SessionStats['max'] = {};
  const sum: Partial<Record<SessionKey, number>> = {};
  const n: Partial<Record<SessionKey, number>> = {};
  for (const x of s.samples)
    SESSION_KEYS.forEach((k, i) => {
      const v = x.v[i];
      if (v == null) return;
      max[k] = Math.max(max[k] ?? -Infinity, v);
      sum[k] = (sum[k] ?? 0) + v;
      n[k] = (n[k] ?? 0) + 1;
    });
  const avg: SessionStats['avg'] = {};
  for (const k of SESSION_KEYS) if (n[k]) avg[k] = sum[k]! / n[k]!;
  return { durationS: Math.round((s.endedAt - s.startedAt) / 1000), samples: s.samples.length, max, avg };
}

/**
 * Export CSV compatible Excel (France) : séparateur « ; », décimales « , », UTF-8 avec BOM.
 * Chaque mesure est suivie de sa provenance (LIVE / DEMO / N/A) ; une valeur indisponible reste vide.
 */
export function sessionToCsv(s: TelemetrySession): string {
  const head = ['horodatage', 'temps_s', ...SESSION_KEYS.flatMap((k) => [SESSION_COLUMNS[k].csv, `${SESSION_COLUMNS[k].csv}_source`])];
  const src = (c: string) => (c === 'L' ? 'LIVE' : c === 'D' ? 'DEMO' : 'N/A');
  const num = (v: number | null, d: number) => (v == null ? '' : v.toFixed(d).replace('.', ','));
  const rows = s.samples.map((x) => [
    new Date(s.startedAt + x.t).toISOString(),
    (x.t / 1000).toFixed(1).replace('.', ','),
    ...SESSION_KEYS.flatMap((k, i) => [num(x.v[i], SESSION_COLUMNS[k].digits), src(x.s[i] ?? 'N')]),
  ]);
  return '﻿' + [head, ...rows].map((r) => r.join(';')).join('\r\n') + '\r\n';
}

export const sessionFileName = (s: TelemetrySession) =>
  `f21-telemetrie-${new Date(s.startedAt).toISOString().slice(0, 16).replace(/[:T]/g, '-')}-${s.source.toLowerCase()}.csv`;

// ------------------------------------------------------------------ store persistant + enregistreur
interface TelemetryState {
  sessions: TelemetrySession[];
  recording: TelemetrySession | null;
  lastError: string | null;
  start: () => void;
  stop: (reason?: string) => void;
  remove: (id: string) => void;
}

let timer: ReturnType<typeof setInterval> | null = null;

export const useTelemetry = create<TelemetryState>()(
  persist(
    (set, get) => ({
      sessions: [],
      recording: null,
      lastError: null,
      start: () => {
        if (get().recording) return;
        const now = Date.now();
        set({ recording: { id: now.toString(36), startedAt: now, endedAt: now, source: 'NA', samples: [] }, lastError: null });
        timer = setInterval(() => {
          const rec = get().recording;
          if (!rec) return;
          const t = Date.now() - rec.startedAt;
          if (t > MAX_SESSION_MS) return get().stop('durée maximale de 30 min atteinte');
          const sample = makeSample(t, useVehicleRepo.getState().snapshot.metrics);
          set({ recording: { ...rec, endedAt: Date.now(), samples: [...rec.samples, sample] } });
        }, SAMPLE_PERIOD_MS);
      },
      stop: (reason) => {
        if (timer) clearInterval(timer);
        timer = null;
        const rec = get().recording;
        if (!rec) return;
        const done: TelemetrySession = { ...rec, endedAt: Date.now(), source: sessionSource(rec.samples), ...(reason ? { truncated: reason } : {}) };
        const sessions = rec.samples.length ? [done, ...get().sessions].slice(0, MAX_SESSIONS) : get().sessions;
        try {
          set({ recording: null, sessions });
        } catch {
          // quota de stockage dépassé : on garde moins de sessions
          set({ recording: null, sessions: sessions.slice(0, 3), lastError: 'Stockage local plein : seules les 3 dernières sessions sont conservées.' });
        }
      },
      remove: (id) => set({ sessions: get().sessions.filter((s) => s.id !== id) }),
    }),
    {
      name: 'f21.telemetry.v1',
      storage: createJSONStorage(() => localStorage),
      // la session en cours n'est pas persistée : elle se termine si l'application est fermée
      partialize: (s) => ({ sessions: s.sessions }),
    },
  ),
);

/** Téléchargement du CSV (PC) ; partage natif si disponible (Android, à valider sur l'appareil). */
export async function exportSessionCsv(s: TelemetrySession): Promise<'download' | 'share'> {
  const csv = sessionToCsv(s);
  const name = sessionFileName(s);
  const file = typeof File !== 'undefined' ? new File([csv], name, { type: 'text/csv' }) : null;
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
  if (file && nav.canShare?.({ files: [file] }) && /android/i.test(navigator.userAgent)) {
    await navigator.share({ files: [file], title: name });
    return 'share';
  }
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'download';
}
