import type { Metric, MetricKey, VehicleProvider } from '../vehicle/types';
import { METRIC_UNITS } from '../vehicle/types';
import { PIDS, decodeSupportedPids, parseMode01Response } from './pids';
import type { ObdTransport } from './transport';
import { ema, planAcquisition, type AcquisitionMode } from '../vehicle/acquisition';

export interface ObdInitResult {
  protocol: string;
  supportedPids: string[];
  adapterVersion: string;
}

/**
 * Lecture OBD-II standard via adaptateur ELM327 (Bluetooth SPP).
 * Strictement en lecture : seules les commandes Mode 01 des PID supportés sont envoyées.
 * Les métriques non supportées restent N/A ; la suralimentation est dérivée (MAP − baro).
 */
export class OBDVehicleProvider implements VehicleProvider {
  readonly kind = 'obd' as const;
  private running = false;
  private paused = false;
  private cycle = 0;
  private supported = new Set<string>();
  private baro: number | null = null;
  private consecutiveErrors = 0;
  onError?: (message: string, fatal: boolean) => void;
  onFrame?: () => void;
  /** statistiques d'acquisition (cadence obtenue, latence, limitation par l'adaptateur) */
  onStats?: (s: { acquisitionHz: number; latencyMs: number | null; limitedByAdapter: boolean }) => void;
  private latency: number | null = null;
  private errorRate = 0;
  private requests = 1;
  private cycleMs = 200;
  private gapMs = 0;
  private limited = false;

  constructor(private transport: ObdTransport, private mode: AcquisitionMode = 'auto') {}

  setAcquisitionMode(mode: AcquisitionMode) {
    this.mode = mode;
  }

  /** Requête unique (lecture seule, filtrée par la garde) avec mesure de latence et d'erreurs. */
  private async query(cmd: string) {
    if (this.gapMs) await new Promise((r) => setTimeout(r, this.gapMs));
    const t0 = Date.now();
    try {
      const r = await this.transport.send(cmd);
      this.latency = ema(this.latency, Date.now() - t0);
      this.errorRate = ema(this.errorRate, 0, 0.1);
      return r;
    } catch (e) {
      this.errorRate = ema(this.errorRate, 1, 0.1);
      throw e;
    }
  }

  async initialize(): Promise<ObdInitResult> {
    const adapterVersion = (await this.transport.send('ATZ', 3000)).replace(/[\r\n>]/g, ' ').trim();
    for (const c of ['ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATAT1', 'ATSP0']) await this.transport.send(c);
    const supported: string[] = [];
    for (const base of [0x00, 0x20, 0x40]) {
      const pid = base.toString(16).toUpperCase().padStart(2, '0');
      if (base !== 0 && !supported.includes(pid)) break;
      const bytes = parseMode01Response(await this.transport.send('01' + pid, 6000), pid);
      if (!bytes) break;
      supported.push(...decodeSupportedPids(base, bytes));
    }
    this.supported = new Set(supported);
    const protocol = (await this.transport.send('ATDP')).replace(/[\r\n>]/g, ' ').trim();
    if (!supported.length) throw new Error('Aucun PID standard détecté : contact mis ? adaptateur compatible ?');
    return { protocol, supportedPids: supported, adapterVersion };
  }

  async start(onData: (patch: Partial<Record<MetricKey, Metric>>) => void) {
    this.running = true;
    const loop = async () => {
      while (this.running) {
        const t0 = Date.now();
        if (!this.paused) await this.pollOnce(onData);
        const plan = planAcquisition({ mode: this.mode, latencyMs: this.latency, errorRate: this.errorRate, requestsPerCycle: this.requests, prevCycleMs: this.cycleMs });
        this.cycleMs = plan.cycleMs;
        this.gapMs = plan.gapMs;
        this.limited = plan.limitedByAdapter;
        const wait = Math.max(this.paused ? 500 : 0, this.cycleMs - (Date.now() - t0));
        if (!this.paused) this.onStats?.({ acquisitionHz: Math.round((10000 / Math.max(this.cycleMs, Date.now() - t0)) ) / 10, latencyMs: this.latency == null ? null : Math.round(this.latency), limitedByAdapter: this.limited });
        await new Promise((r) => setTimeout(r, wait));
      }
    };
    void loop();
  }

  private async pollOnce(onData: (patch: Partial<Record<MetricKey, Metric>>) => void) {
    this.cycle++;
    const patch: Partial<Record<MetricKey, Metric>> = {};
    let requests = 0;
    for (const def of PIDS) {
      if (!this.supported.has(def.pid) || this.cycle % def.every !== 0) continue;
      try {
        requests++;
        const bytes = parseMode01Response(await this.query('01' + def.pid), def.pid);
        if (!bytes || bytes.length < def.bytes) continue;
        patch[def.key] = { value: def.decode(bytes), source: 'LIVE', unit: METRIC_UNITS[def.key], ts: Date.now() };
        this.consecutiveErrors = 0;
      } catch (e) {
        this.consecutiveErrors++;
        this.onError?.(String((e as Error).message), this.consecutiveErrors > 8);
        if (this.consecutiveErrors > 8) {
          this.running = false;
          return;
        }
      }
    }
    // Batterie : PID 42 si supporté, sinon tension mesurée par l'adaptateur (ATRV).
    if (!this.supported.has('42') && this.cycle % 10 === 0) {
      try {
        requests++;
        const v = parseFloat((await this.query('ATRV')).replace(/[^0-9.]/g, ''));
        if (Number.isFinite(v)) patch.battery = { value: v, source: 'LIVE', unit: 'V', ts: Date.now() };
      } catch {
        /* ignoré : la batterie restera N/A */
      }
    }
    this.requests = ema(this.requests, Math.max(1, requests), 0.3);
    if (patch.baro?.value != null) this.baro = patch.baro.value;
    if (patch.map?.value != null && this.baro != null) {
      patch.boost = { value: (patch.map.value - this.baro) / 100, source: 'LIVE', unit: 'bar', ts: Date.now() };
    }
    if (Object.keys(patch).length) {
      this.onFrame?.();
      onData(patch);
    }
  }

  async stop() {
    this.running = false;
  }
  pause() {
    this.paused = true;
  }
  resume() {
    this.paused = false;
  }
}
