import { create } from 'zustand';
import type { ConnectionState, Metric, MetricKey, VehicleSnapshot } from './types';
import { emptySnapshot } from './types';
import { VehicleDataValidator } from './VehicleDataValidator';
import { DEFAULT_THRESHOLDS, THRESHOLD_LIMITS, type AlertThresholds } from './alertThresholds';

let thresholds: AlertThresholds = DEFAULT_THRESHOLDS;
/** Seuils configurés par l'utilisateur (Réglages / Engine). */
export const setAlertThresholds = (t: AlertThresholds) => {
  thresholds = t;
};

export const HISTORY_KEYS = ['rpm', 'speed', 'boost', 'coolantTemp', 'throttle'] as const;
export type HistoryKey = (typeof HISTORY_KEYS)[number];
const HISTORY_LEN = 300; // 60 s à 5 Hz

interface RepoState {
  snapshot: VehicleSnapshot;
  connection: ConnectionState;
  history: Record<HistoryKey, number[]>;
  rejected: number;
  ingest: (patch: Partial<Record<MetricKey, Metric>>) => void;
  setConnection: (patch: Partial<ConnectionState>) => void;
  clear: () => void;
}

const emptyHistory = () =>
  Object.fromEntries(HISTORY_KEYS.map((k) => [k, [] as number[]])) as unknown as Record<HistoryKey, number[]>;

let lastHistoryPush = 0;

/** Source unique de vérité des données véhicule consommées par l'interface. */
export const useVehicleRepo = create<RepoState>((set, get) => ({
  snapshot: emptySnapshot(),
  connection: { status: 'demo', supportedPids: [], errorCount: 0 },
  history: emptyHistory(),
  rejected: 0,
  ingest: (patch) => {
    const s = get();
    const metrics = { ...s.snapshot.metrics };
    let rejected = s.rejected;
    for (const [k, m] of Object.entries(patch) as [MetricKey, Metric][]) {
      const clean = VehicleDataValidator.sanitize(k, m);
      if (clean.source === 'NA' && m.source !== 'NA') rejected++;
      metrics[k] = clean;
    }
    const now = Date.now();
    let history = s.history;
    if (now - lastHistoryPush >= 200) {
      lastHistoryPush = now;
      history = { ...history };
      for (const k of HISTORY_KEYS) {
        const v = metrics[k].value;
        const arr = history[k].slice(-HISTORY_LEN + 1);
        arr.push(v ?? NaN);
        history[k] = arr;
      }
    }
    const alerts = deriveAlerts(metrics);
    set({ snapshot: { ...s.snapshot, metrics, alerts, updatedAt: now }, history, rejected });
  },
  setConnection: (patch) => set((s) => ({ connection: { ...s.connection, ...patch } })),
  clear: () => set({ snapshot: emptySnapshot(), history: emptyHistory() }),
}));

/** Alertes informatives de l'application — ne remplacent jamais les alertes du combiné BMW. */
function deriveAlerts(m: Record<MetricKey, Metric>) {
  const alerts: VehicleSnapshot['alerts'] = [];
  // températures : seuils configurables, uniquement si la mesure existe (jamais sur N/A)
  for (const k of ['coolantTemp', 'oilTemp', 'intakeAirTemp'] as const) {
    const x = m[k];
    if (x.value != null && x.source !== 'NA' && x.value >= thresholds[k])
      alerts.push({ id: k, level: THRESHOLD_LIMITS[k].level, message: `${THRESHOLD_LIMITS[k].label} : ${Math.round(x.value)} °C (seuil ${thresholds[k]} °C)`, source: x.source });
  }
  const b = m.battery;
  if (b.value != null && b.value < 11.8)
    alerts.push({ id: 'battery', level: 'warning', message: 'Tension batterie faible', source: b.source });
  const f = m.fuel;
  if (f.value != null && f.value < 12)
    alerts.push({ id: 'fuel', level: 'warning', message: 'Niveau de carburant bas', source: f.source });
  return alerts;
}

/** Accès sans abonnement React (boucle 3D, logique de sécurité). */
export const getMetric = (k: MetricKey) => useVehicleRepo.getState().snapshot.metrics[k];
