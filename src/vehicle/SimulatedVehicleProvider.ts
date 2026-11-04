import type { Metric, MetricKey, VehicleProvider } from './types';
import { METRIC_UNITS } from './types';

export type DemoScenario = 'parked' | 'idle' | 'driving';

/**
 * Données moteur FICTIVES, marquées DEMO. Aucune valeur ici ne provient du véhicule.
 * Scénarios : 'parked' (moteur arrêté, vitesse 0), 'idle' (ralenti), 'driving' (roulage simulé).
 */
export class SimulatedVehicleProvider implements VehicleProvider {
  readonly kind = 'simulated' as const;
  private timer: ReturnType<typeof setInterval> | null = null;
  private paused = false;
  private t = 0;
  private coolant = 38;
  private oil = 32;
  private rpmSmooth = 0;
  private speedSmooth = 0;
  constructor(public scenario: DemoScenario = 'idle', private intervalMs = 100) {}

  setScenario(s: DemoScenario) {
    this.scenario = s;
  }

  async start(onData: (patch: Partial<Record<MetricKey, Metric>>) => void) {
    await this.stop();
    this.timer = setInterval(() => {
      if (this.paused) return;
      this.t += this.intervalMs / 1000;
      onData(this.sample());
    }, this.intervalMs);
  }

  async stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
  pause() {
    this.paused = true;
  }
  resume() {
    this.paused = false;
  }

  private sample(): Partial<Record<MetricKey, Metric>> {
    const t = this.t;
    const running = this.scenario !== 'parked';
    let rpmTarget = 0;
    let speedTarget = 0;
    let throttle = 0;
    if (this.scenario === 'idle') {
      rpmTarget = 780 + Math.sin(t * 2.1) * 25 + (this.coolant < 60 ? 250 : 0);
      throttle = 0;
    } else if (this.scenario === 'driving') {
      // cycle de 20 s : accélérations / passages de rapports / décélération
      const phase = (t % 20) / 20;
      const accel = phase < 0.55;
      throttle = accel ? 35 + 45 * Math.abs(Math.sin(t * 0.9)) : 3;
      speedTarget = accel ? 30 + phase * 120 : 95 - (phase - 0.55) * 150;
      const gearRatio = [0, 120, 70, 48, 37, 30, 26][Math.min(6, Math.max(1, Math.ceil(speedTarget / 28)))];
      rpmTarget = Math.max(1100, Math.min(6200, speedTarget * gearRatio));
    }
    this.rpmSmooth += (rpmTarget - this.rpmSmooth) * 0.25;
    this.speedSmooth += (speedTarget - this.speedSmooth) * 0.15;
    if (running) {
      this.coolant += (92 - this.coolant) * 0.004;
      this.oil += (98 - this.oil) * 0.0025;
    } else {
      this.coolant += (20 - this.coolant) * 0.0005;
      this.oil += (20 - this.oil) * 0.0004;
    }
    const baro = 101.3;
    const map = running ? 30 + throttle * 1.6 + Math.sin(t * 5) * 1.5 : baro;
    const now = Date.now();
    const m = (k: MetricKey, v: number | null): Metric => ({
      value: v === null ? null : Math.round(v * 100) / 100,
      source: 'DEMO',
      unit: METRIC_UNITS[k],
      ts: now,
    });
    return {
      rpm: m('rpm', Math.max(0, this.rpmSmooth)),
      speed: m('speed', Math.max(0, this.speedSmooth)),
      coolantTemp: m('coolantTemp', this.coolant),
      oilTemp: m('oilTemp', this.oil),
      intakeAirTemp: m('intakeAirTemp', 24 + throttle * 0.08),
      map: m('map', map),
      baro: m('baro', baro),
      boost: m('boost', Math.max(-0.75, (map - baro) / 100)),
      throttle: m('throttle', throttle),
      load: m('load', running ? 18 + throttle * 0.75 : 0),
      battery: m('battery', running ? 14.1 + Math.sin(t * 0.3) * 0.08 : 12.6),
      fuel: m('fuel', 62),
    };
  }
}
