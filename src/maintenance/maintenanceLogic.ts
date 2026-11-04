import type { CategoryDef, MaintenanceCategory, MaintenanceEntry } from './types';
import { CATEGORIES } from './types';

export type DueStatus = 'ok' | 'soon' | 'overdue' | 'unknown';

export interface CategoryStatus {
  category: CategoryDef;
  last: MaintenanceEntry | null;
  dueDate: string | null;
  dueKm: number | null;
  remainingKm: number | null;
  remainingDays: number | null;
  status: DueStatus;
  /** vrai si l'échéance vient d'un intervalle indicatif plutôt que d'une saisie */
  fromInterval: boolean;
}

const addMonths = (iso: string, months: number) => {
  const d = new Date(iso + 'T00:00:00');
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (fromMs: number, iso: string) => Math.round((new Date(iso + 'T00:00:00').getTime() - fromMs) / 86400000);

export function latestByCategory(entries: MaintenanceEntry[], c: MaintenanceCategory) {
  return (
    entries
      .filter((e) => e.category === c)
      .sort((a, b) => b.date.localeCompare(a.date) || (b.mileageKm ?? 0) - (a.mileageKm ?? 0))[0] ?? null
  );
}

/**
 * Calcule l'échéance d'une catégorie. Sans intervention enregistrée ni échéance saisie,
 * le statut reste 'unknown' : aucune date n'est inventée.
 */
export function computeStatus(
  entries: MaintenanceEntry[],
  def: CategoryDef,
  currentKm: number | null,
  now = Date.now(),
  intervals?: { km: number | null; months: number | null },
): CategoryStatus {
  const last = latestByCategory(entries, def.id);
  const iKm = intervals?.km ?? def.defaultIntervalKm;
  const iMonths = intervals?.months ?? def.defaultIntervalMonths;
  let dueDate: string | null = null;
  let dueKm: number | null = null;
  let fromInterval = false;
  if (last) {
    dueDate = last.nextDueDate;
    dueKm = last.nextDueKm;
    if (!dueDate && iMonths && last.date) {
      dueDate = addMonths(last.date, iMonths);
      fromInterval = true;
    }
    if (dueKm == null && iKm && last.mileageKm != null) {
      dueKm = last.mileageKm + iKm;
      fromInterval = true;
    }
  }
  const remainingKm = dueKm != null && currentKm != null ? dueKm - currentKm : null;
  const remainingDays = dueDate ? daysBetween(now, dueDate) : null;
  let status: DueStatus = 'unknown';
  if (remainingKm != null || remainingDays != null) {
    const overdue = (remainingKm != null && remainingKm < 0) || (remainingDays != null && remainingDays < 0);
    const soon = (remainingKm != null && remainingKm < 1500) || (remainingDays != null && remainingDays < 30);
    status = overdue ? 'overdue' : soon ? 'soon' : 'ok';
  }
  return { category: def, last, dueDate, dueKm, remainingKm, remainingDays, status, fromInterval };
}

export function computeAll(entries: MaintenanceEntry[], currentKm: number | null, now = Date.now()) {
  return CATEGORIES.filter((c) => c.id !== 'other').map((c) => computeStatus(entries, c, currentKm, now));
}
