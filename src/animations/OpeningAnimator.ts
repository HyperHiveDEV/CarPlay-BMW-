import { easeInOutCubic } from './easing';

/**
 * Animation temporelle d'un ouvrant : progression 0 → 1 sur une durée fixe,
 * avec courbe ease-in-out. Réversible à tout moment sans à-coup.
 */
export class OpeningAnimator {
  progress = 0;
  constructor(private durationS: number) {}
  update(open: boolean, dt: number) {
    const dir = open ? 1 : -1;
    this.progress = Math.min(1, Math.max(0, this.progress + (dir * Math.min(dt, 0.05)) / this.durationS));
    return easeInOutCubic(this.progress);
  }
}
