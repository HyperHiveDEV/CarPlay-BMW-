import type { Metric, MetricKey } from './types';

/** Plages physiquement plausibles pour une B38 de série / Stage 1. Hors plage => valeur rejetée. */
const RANGES: Record<MetricKey, [number, number]> = {
  rpm: [0, 8000],
  speed: [0, 260],
  coolantTemp: [-40, 140],
  oilTemp: [-40, 160],
  intakeAirTemp: [-40, 100],
  map: [10, 300],
  baro: [60, 110],
  boost: [-1, 2.2],
  throttle: [0, 100],
  load: [0, 100],
  battery: [8, 16.5],
  fuel: [0, 100],
};

/** Délai au-delà duquel une donnée LIVE est considérée périmée (N/A). */
export const STALE_AFTER_MS = 5000;

export const VehicleDataValidator = {
  isPlausible(key: MetricKey, value: number | null): boolean {
    if (value === null || !Number.isFinite(value)) return false;
    const [min, max] = RANGES[key];
    return value >= min && value <= max;
  },

  /** Retourne la métrique validée ; une valeur implausible devient N/A au lieu d'être affichée. */
  sanitize(key: MetricKey, m: Metric): Metric {
    if (m.source === 'NA') return { ...m, value: null };
    if (!this.isPlausible(key, m.value)) return { ...m, value: null, source: 'NA' };
    return m;
  },

  isStale(m: Metric, now = Date.now()): boolean {
    return m.source === 'LIVE' && now - m.ts > STALE_AFTER_MS;
  },
};
