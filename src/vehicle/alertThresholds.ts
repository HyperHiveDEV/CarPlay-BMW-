import type { MetricKey } from './types';

/** Seuils d'alerte configurables (°C) — uniquement pour les températures réellement mesurables. */
export interface AlertThresholds {
  coolantTemp: number;
  oilTemp: number;
  intakeAirTemp: number;
}

export const DEFAULT_THRESHOLDS: AlertThresholds = { coolantTemp: 110, oilTemp: 130, intakeAirTemp: 60 };

export const THRESHOLD_LIMITS: Record<keyof AlertThresholds, { min: number; max: number; label: string; level: 'critical' | 'warning' }> = {
  coolantTemp: { min: 90, max: 125, label: 'Liquide de refroidissement', level: 'critical' },
  oilTemp: { min: 100, max: 150, label: 'Huile moteur', level: 'critical' },
  intakeAirTemp: { min: 35, max: 85, label: "Air d'admission", level: 'warning' },
};

export type ThresholdState = 'na' | 'ok' | 'near' | 'over';

/** État d'une température face à son seuil : « near » à moins de 5 °C du seuil. */
export function thresholdState(value: number | null, source: string, threshold: number): ThresholdState {
  if (value == null || source === 'NA') return 'na';
  if (value >= threshold) return 'over';
  if (value >= threshold - 5) return 'near';
  return 'ok';
}

export const THRESHOLD_KEYS = Object.keys(DEFAULT_THRESHOLDS) as (keyof AlertThresholds & MetricKey)[];

export function sanitizeThresholds(t: Partial<AlertThresholds> | undefined): AlertThresholds {
  const out = { ...DEFAULT_THRESHOLDS };
  for (const k of THRESHOLD_KEYS) {
    const v = t?.[k];
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.min(THRESHOLD_LIMITS[k].max, Math.max(THRESHOLD_LIMITS[k].min, Math.round(v)));
  }
  return out;
}
