export type MaintenanceCategory =
  | 'oil'
  | 'oilFilter'
  | 'airFilter'
  | 'sparkPlugs'
  | 'brakesFront'
  | 'brakesRear'
  | 'tyres'
  | 'coolant'
  | 'battery'
  | 'inspection'
  | 'other';

export interface MaintenanceEntry {
  id: string;
  category: MaintenanceCategory;
  title: string;
  date: string; // ISO yyyy-mm-dd, saisie utilisateur
  mileageKm: number | null;
  note: string;
  /** Prochaine échéance définie par l'utilisateur (prioritaire sur l'intervalle). */
  nextDueDate: string | null;
  nextDueKm: number | null;
  isDemo?: boolean;
}

export interface CategoryDef {
  id: MaintenanceCategory;
  label: string;
  /** Intervalles indicatifs MODIFIABLES — pas des préconisations constructeur, pas le CBS BMW. */
  defaultIntervalKm: number | null;
  defaultIntervalMonths: number | null;
}

export const CATEGORIES: CategoryDef[] = [
  { id: 'oil', label: 'Vidange moteur', defaultIntervalKm: 10000, defaultIntervalMonths: 12 },
  { id: 'oilFilter', label: 'Filtre à huile', defaultIntervalKm: 10000, defaultIntervalMonths: 12 },
  { id: 'airFilter', label: 'Filtre à air', defaultIntervalKm: 30000, defaultIntervalMonths: 24 },
  { id: 'sparkPlugs', label: 'Bougies', defaultIntervalKm: 40000, defaultIntervalMonths: 48 },
  { id: 'brakesFront', label: 'Freins avant', defaultIntervalKm: null, defaultIntervalMonths: null },
  { id: 'brakesRear', label: 'Freins arrière', defaultIntervalKm: null, defaultIntervalMonths: null },
  { id: 'tyres', label: 'Pneumatiques', defaultIntervalKm: null, defaultIntervalMonths: null },
  { id: 'coolant', label: 'Liquide de refroidissement', defaultIntervalKm: null, defaultIntervalMonths: 48 },
  { id: 'battery', label: 'Batterie', defaultIntervalKm: null, defaultIntervalMonths: null },
  { id: 'inspection', label: 'Contrôle technique', defaultIntervalKm: null, defaultIntervalMonths: 24 },
  { id: 'other', label: 'Autre intervention', defaultIntervalKm: null, defaultIntervalMonths: null },
];

export const categoryLabel = (c: MaintenanceCategory) => CATEGORIES.find((x) => x.id === c)?.label ?? c;
