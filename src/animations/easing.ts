import { MathUtils } from 'three';

export const smoothstep = (a: number, b: number, x: number) => {
  const t = MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Amortissement indépendant du framerate (critique-amorti) pour animations d'ouvrants. */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  MathUtils.damp(current, target, lambda, Math.min(dt, 0.05));

/** Courbe d'ouverture d'un ouvrant : départ doux, fin amortie (évite l'effet "mécanique"). */
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Rythme de clignotant (≈ 1,5 Hz) avec montée/descente progressive (rendu LED/ampoule). */
export const blinkerIntensity = (time: number) => {
  const p = (time * 1.5) % 1;
  if (p < 0.08) return p / 0.08;
  if (p < 0.5) return 1;
  if (p < 0.6) return 1 - (p - 0.5) / 0.1;
  return 0;
};
