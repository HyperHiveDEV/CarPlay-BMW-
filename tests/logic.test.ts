import { describe, expect, it } from 'vitest';
import { computeStatus } from '../src/maintenance/maintenanceLogic';
import { CATEGORIES } from '../src/maintenance/types';
import { VehicleDataValidator } from '../src/vehicle/VehicleDataValidator';
import { computeMotion } from '../src/vehicle/drivingSafety';

const oil = CATEGORIES.find((c) => c.id === 'oil')!;
const now = new Date('2026-11-04T12:00:00').getTime();

describe('entretien', () => {
  it("n'invente aucune échéance sans intervention", () => {
    const s = computeStatus([], oil, 90000, now);
    expect(s.status).toBe('unknown');
    expect(s.dueDate).toBeNull();
    expect(s.dueKm).toBeNull();
  });
  it('priorise l’échéance saisie et signale le dépassement', () => {
    const e = { id: '1', category: 'oil' as const, title: '', date: '2026-01-10', mileageKm: 70000, note: '', nextDueDate: null, nextDueKm: 80000 };
    const s = computeStatus([e], oil, 80500, now);
    expect(s.dueKm).toBe(80000);
    expect(s.status).toBe('overdue');
    expect(s.fromInterval).toBe(true); // la date vient de l'intervalle indicatif
  });
});

describe('validateur', () => {
  it('rejette les valeurs implausibles', () => {
    expect(VehicleDataValidator.sanitize('rpm', { value: 12000, source: 'LIVE', unit: '', ts: 0 }).source).toBe('NA');
    expect(VehicleDataValidator.sanitize('coolantTemp', { value: 90, source: 'LIVE', unit: '', ts: 0 }).value).toBe(90);
  });
});

describe('sécurité conduite', () => {
  it('vitesse inconnue ≠ arrêt', () => {
    expect(computeMotion(null, 'NA')).toBe('unknown');
    expect(computeMotion(0, 'LIVE')).toBe('stationary');
    expect(computeMotion(40, 'DEMO')).toBe('moving');
  });
});
