import { describe, expect, it } from 'vitest';
import { planAcquisition } from '../src/vehicle/acquisition';
import { sanitizeThresholds, thresholdState } from '../src/vehicle/alertThresholds';
import { makeSample, sessionSource, sessionStats, sessionToCsv, type TelemetrySession } from '../src/vehicle/telemetry';
import { emptySnapshot } from '../src/vehicle/types';
import { isAllowedCommand } from '../src/obd/readOnlyGuard';

describe('acquisition OBD adaptative', () => {
  it('plafonne une fréquence fixe aux capacités de l’adaptateur', () => {
    // 8 requêtes de 60 ms : un cycle ne peut pas descendre sous ~550 ms → 10 Hz impossible
    const p = planAcquisition({ mode: '10', latencyMs: 60, errorRate: 0, requestsPerCycle: 8, prevCycleMs: 200 });
    expect(p.limitedByAdapter).toBe(true);
    expect(p.cycleMs).toBeGreaterThan(500);
  });
  it('respecte la fréquence demandée quand l’adaptateur suit', () => {
    const p = planAcquisition({ mode: '2', latencyMs: 20, errorRate: 0, requestsPerCycle: 4, prevCycleMs: 200 });
    expect(p.cycleMs).toBe(500);
    expect(p.limitedByAdapter).toBe(false);
  });
  it('ralentit en mode auto quand les erreurs augmentent', () => {
    const p = planAcquisition({ mode: 'auto', latencyMs: 30, errorRate: 0.3, requestsPerCycle: 3, prevCycleMs: 200 });
    expect(p.cycleMs).toBeGreaterThanOrEqual(300);
    expect(p.gapMs).toBeGreaterThan(0);
  });
  it('reste dans les bornes 1–10 Hz', () => {
    const fast = planAcquisition({ mode: 'auto', latencyMs: 1, errorRate: 0, requestsPerCycle: 1, prevCycleMs: 100 });
    const slow = planAcquisition({ mode: 'auto', latencyMs: 900, errorRate: 0, requestsPerCycle: 9, prevCycleMs: 1000 });
    expect(fast.cycleMs).toBeGreaterThanOrEqual(100);
    expect(slow.cycleMs).toBeLessThanOrEqual(1000);
  });
  it('l’OBD reste en lecture seule', () => {
    expect(isAllowedCommand('010C')).toBe(true);
    for (const c of ['04', '2EF190', '3101', '08']) expect(isAllowedCommand(c)).toBe(false);
  });
});

describe('seuils d’alerte', () => {
  it('ignore une mesure N/A', () => {
    expect(thresholdState(null, 'NA', 110)).toBe('na');
    expect(thresholdState(120, 'NA', 110)).toBe('na');
  });
  it('distingue ok / proche / dépassé', () => {
    expect(thresholdState(90, 'LIVE', 110)).toBe('ok');
    expect(thresholdState(106, 'LIVE', 110)).toBe('near');
    expect(thresholdState(110, 'DEMO', 110)).toBe('over');
  });
  it('borne les seuils saisis', () => {
    expect(sanitizeThresholds({ coolantTemp: 300, oilTemp: Number.NaN }).coolantTemp).toBe(125);
    expect(sanitizeThresholds({ oilTemp: Number.NaN }).oilTemp).toBe(130);
  });
});

describe('sessions de télémétrie', () => {
  const metrics = () => emptySnapshot().metrics;
  it('enregistre la provenance et laisse N/A vide', () => {
    const m = metrics();
    m.rpm = { value: 2500.456, source: 'LIVE', unit: 'tr/min', ts: 1 };
    m.coolantTemp = { value: 88, source: 'DEMO', unit: '°C', ts: 1 };
    const s = makeSample(500, m);
    expect(s.v[0]).toBe(2500.46);
    expect(s.v[2]).toBe(88);
    expect(s.v[3]).toBeNull(); // huile N/A
    expect(s.s.slice(0, 4)).toBe('LNDN');
  });
  it('calcule source, durée, max et moyenne', () => {
    const m = metrics();
    m.rpm = { value: 1000, source: 'DEMO', unit: '', ts: 1 };
    const a = makeSample(0, m);
    m.rpm = { value: 3000, source: 'LIVE', unit: '', ts: 1 };
    const b = makeSample(500, m);
    const sess: TelemetrySession = { id: 'x', startedAt: Date.UTC(2026, 10, 4, 18, 0), endedAt: Date.UTC(2026, 10, 4, 18, 0, 10), source: sessionSource([a, b]), samples: [a, b] };
    expect(sess.source).toBe('MIXTE');
    const st = sessionStats(sess);
    expect(st.durationS).toBe(10);
    expect(st.max.rpm).toBe(3000);
    expect(st.avg.rpm).toBe(2000);
    expect(st.max.oilTemp).toBeUndefined();
  });
  it('exporte un CSV compatible Excel (« ; », décimales « , », BOM, provenance)', () => {
    const m = metrics();
    m.battery = { value: 14.13, source: 'LIVE', unit: 'V', ts: 1 };
    const sess: TelemetrySession = { id: 'x', startedAt: Date.UTC(2026, 10, 4, 18, 0), endedAt: Date.UTC(2026, 10, 4, 18, 0, 1), source: 'LIVE', samples: [makeSample(500, m)] };
    const csv = sessionToCsv(sess);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const [head, row] = csv.slice(1).trim().split('\r\n');
    expect(head.split(';')[0]).toBe('horodatage');
    expect(head).toContain('batterie_v;batterie_v_source');
    expect(row).toContain('14,13;LIVE');
    expect(row).toContain('2026-11-04T18:00:00.500Z;0,5');
    expect(row).toContain(';;N/A'); // régime N/A : valeur vide
  });
});
