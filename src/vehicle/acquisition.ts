/**
 * Fréquence d'acquisition OBD adaptée aux capacités de l'adaptateur.
 *
 * Un ELM327 interroge les PID un par un : la cadence réelle est limitée par le temps de réponse
 * de l'adaptateur (souvent 40 à 200 ms par requête, davantage sur les copies bon marché).
 * Le mode « auto » mesure la latence et le taux d'erreurs et ajuste le cycle pour ne jamais
 * saturer l'adaptateur ; les modes fixes sont plafonnés par ce que l'adaptateur peut fournir.
 */
export type AcquisitionMode = 'auto' | '2' | '5' | '10';

export interface AcquisitionInput {
  mode: AcquisitionMode;
  /** latence moyenne d'une requête (ms), null tant qu'aucune mesure */
  latencyMs: number | null;
  /** part des requêtes en échec (0–1), moyenne glissante */
  errorRate: number;
  /** nombre moyen de requêtes par cycle */
  requestsPerCycle: number;
  /** cycle précédent (ms) */
  prevCycleMs: number;
}

export interface AcquisitionPlan {
  cycleMs: number;
  /** pause imposée entre deux requêtes (adaptateurs fragiles) */
  gapMs: number;
  /** vrai si la fréquence demandée dépasse ce que l'adaptateur peut fournir */
  limitedByAdapter: boolean;
}

export const MIN_CYCLE_MS = 100; // 10 Hz maximum
export const MAX_CYCLE_MS = 1000; // 1 Hz minimum

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function planAcquisition(i: AcquisitionInput): AcquisitionPlan {
  const gapMs = i.errorRate > 0.05 ? 25 : 0;
  // temps incompressible d'un cycle complet avec cet adaptateur (+15 % de marge)
  const floor = i.latencyMs == null ? MIN_CYCLE_MS : (i.latencyMs + gapMs) * Math.max(1, i.requestsPerCycle) * 1.15;
  if (i.mode !== 'auto') {
    const wanted = 1000 / Number(i.mode);
    const cycleMs = clamp(Math.max(wanted, floor), MIN_CYCLE_MS, MAX_CYCLE_MS);
    return { cycleMs, gapMs, limitedByAdapter: floor > wanted + 1 };
  }
  let cycleMs = i.latencyMs == null ? 200 : clamp(floor, MIN_CYCLE_MS, MAX_CYCLE_MS);
  // erreurs ou délais dépassés : on ralentit franchement (×1,5), puis on réaccélère doucement
  if (i.errorRate > 0.1) cycleMs = clamp(Math.max(cycleMs, i.prevCycleMs * 1.5), MIN_CYCLE_MS, MAX_CYCLE_MS);
  else if (cycleMs < i.prevCycleMs) cycleMs = Math.max(cycleMs, i.prevCycleMs * 0.9);
  return { cycleMs: Math.round(cycleMs), gapMs, limitedByAdapter: false };
}

/** Moyenne glissante exponentielle. */
export const ema = (prev: number | null, value: number, alpha = 0.2) => (prev == null ? value : prev + alpha * (value - prev));
