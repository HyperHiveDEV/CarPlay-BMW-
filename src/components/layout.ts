import { useEffect, useState } from 'react';

/**
 * Densité d'affichage selon l'écran (profils testés : 800×480, 1024×600, 1280×480, 1280×720, 1920×720).
 * Toute l'interface est dimensionnée en rem : la taille de police racine fait l'échelle.
 *  - tiny    : hauteur ≤ 520 px (800×480, 1280×480)
 *  - compact : hauteur ≤ 760 px ou largeur ≤ 1100 px (1024×600, 1280×720, 1920×720)
 *  - normal  : écrans plus grands (PC)
 */
export type Density = 'tiny' | 'compact' | 'normal';

export const ROOT_PX: Record<Density, number> = { tiny: 13, compact: 15, normal: 16 };
/** largeurs en rem — barre latérale et colonne de droite */
export const SIDEBAR_REM = 4.75;
export const ASIDE_REM = 18.5;

export function densityFor(w: number, h: number): Density {
  if (h <= 520) return 'tiny';
  if (h <= 760 || w <= 1100) return 'compact';
  return 'normal';
}

export function useLayout() {
  const read = () => ({ w: window.innerWidth, h: window.innerHeight });
  const [size, setSize] = useState(read);
  useEffect(() => {
    const on = () => setSize(read());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const density = densityFor(size.w, size.h);
  const px = ROOT_PX[density];
  useEffect(() => {
    document.documentElement.dataset.density = density;
    document.documentElement.style.fontSize = `${px}px`;
  }, [density, px]);
  return { ...size, density, px, sidebarPx: SIDEBAR_REM * px, asidePx: ASIDE_REM * px };
}
