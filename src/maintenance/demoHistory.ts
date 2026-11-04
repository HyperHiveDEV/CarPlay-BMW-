import type { MaintenanceEntry } from './types';

/** HISTORIQUE FICTIF de démonstration (isDemo: true). Ne décrit pas l'entretien réel du véhicule. */
export const DEMO_HISTORY: MaintenanceEntry[] = [
  { id: 'demo-1', category: 'oil', title: 'Vidange 0W-30 LL-04', date: '2026-03-12', mileageKm: 78200, note: 'Exemple DEMO', nextDueDate: null, nextDueKm: null, isDemo: true },
  { id: 'demo-2', category: 'oilFilter', title: 'Filtre à huile', date: '2026-03-12', mileageKm: 78200, note: 'Exemple DEMO', nextDueDate: null, nextDueKm: null, isDemo: true },
  { id: 'demo-3', category: 'sparkPlugs', title: 'Bougies (préparation Stage 1)', date: '2025-09-02', mileageKm: 71500, note: 'Exemple DEMO', nextDueDate: null, nextDueKm: 101500, isDemo: true },
  { id: 'demo-4', category: 'brakesFront', title: 'Plaquettes avant', date: '2025-06-20', mileageKm: 68900, note: 'Exemple DEMO', nextDueDate: null, nextDueKm: 98900, isDemo: true },
  { id: 'demo-5', category: 'inspection', title: 'Contrôle technique', date: '2024-11-28', mileageKm: 61000, note: 'Exemple DEMO', nextDueDate: '2026-11-28', nextDueKm: null, isDemo: true },
  { id: 'demo-6', category: 'tyres', title: 'Pneus été 225/40 R18 — 245/35 R18', date: '2025-04-10', mileageKm: 66000, note: 'Exemple DEMO', nextDueDate: null, nextDueKm: null, isDemo: true },
];

/** Kilométrage fictif cohérent avec l'historique démo (utilisé seulement en mode démo sans km saisi). */
export const DEMO_MILEAGE_KM = 84350;
