import { useVehicleRepo } from './VehicleDataRepository';

export const MOVING_THRESHOLD_KMH = 3;

export type MotionState = 'stationary' | 'moving' | 'unknown';

/**
 * Vitesse inconnue => on NE suppose PAS l'arrêt : état 'unknown', traité comme en mouvement.
 * En mode démo, la vitesse simulée est utilisée (pour tester le verrouillage).
 */
export function computeMotion(speed: number | null, source: string): MotionState {
  if (speed == null || source === 'NA') return 'unknown';
  return speed > MOVING_THRESHOLD_KMH ? 'moving' : 'stationary';
}

export function useMotionState(): MotionState {
  return useVehicleRepo((s) => {
    const m = s.snapshot.metrics.speed;
    return computeMotion(m.value, m.source);
  });
}

/** Interactions complexes (3D, formulaires) autorisées seulement à l'arrêt confirmé. */
export const useInteractionLocked = () => useMotionState() !== 'stationary';
