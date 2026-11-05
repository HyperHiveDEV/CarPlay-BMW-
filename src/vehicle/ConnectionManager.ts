import { OBDVehicleProvider } from '../obd/OBDVehicleProvider';
import { createTransport, type BtDevice, type ObdTransport } from '../obd/transport';
import { SimulatedVehicleProvider, type DemoScenario } from './SimulatedVehicleProvider';
import type { VehicleProvider } from './types';
import { useVehicleRepo } from './VehicleDataRepository';
import type { AcquisitionMode } from './acquisition';

/**
 * Orchestration des sources : démarre le fournisseur simulé ou OBD, surveille la connexion
 * (watchdog), gère pause/reprise de l'application. Une seule source active à la fois.
 */
class ConnectionManagerImpl {
  readonly transport: ObdTransport = createTransport();
  readonly simulator = new SimulatedVehicleProvider('idle');
  private active: VehicleProvider | null = null;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private repo = useVehicleRepo;
  private obd: OBDVehicleProvider | null = null;
  private acquisition: AcquisitionMode = 'auto';

  /** Fréquence d'acquisition OBD (Réglages › Source de données). */
  setAcquisitionMode(mode: AcquisitionMode) {
    this.acquisition = mode;
    this.obd?.setAcquisitionMode(mode);
  }

  async startDemo(scenario?: DemoScenario) {
    await this.stopActive();
    if (scenario) this.simulator.setScenario(scenario);
    this.repo.getState().clear();
    this.repo.getState().setConnection({ status: 'demo', message: 'Données simulées', supportedPids: [], deviceName: undefined, acquisitionHz: 10, latencyMs: undefined, limitedByAdapter: false });
    this.active = this.simulator;
    await this.simulator.start((p) => this.repo.getState().ingest(p));
  }

  setDemoScenario(s: DemoScenario) {
    this.simulator.setScenario(s);
  }

  async scan(discover = true): Promise<BtDevice[]> {
    const set = this.repo.getState().setConnection;
    const avail = await this.transport.isAvailable();
    if (!avail.available) {
      set({ status: 'disconnected', message: avail.reason ?? 'Bluetooth indisponible' });
      throw new Error(avail.reason ?? 'Bluetooth indisponible sur cet appareil');
    }
    if (!avail.enabled) throw new Error('Activez le Bluetooth de l’appareil.');
    if (!(await this.transport.requestPermissions())) throw new Error('Autorisation Bluetooth refusée.');
    set({ status: 'scanning', message: 'Recherche des adaptateurs…' });
    try {
      return await this.transport.listDevices(discover);
    } finally {
      set({ status: 'disconnected', message: undefined });
    }
  }

  async connectObd(device: { address: string; name?: string }) {
    await this.stopActive();
    const repo = this.repo.getState();
    repo.clear();
    repo.setConnection({ status: 'connecting', deviceAddress: device.address, deviceName: device.name, message: 'Connexion…', errorCount: 0 });
    try {
      const name = await this.transport.connect(device.address);
      repo.setConnection({ status: 'initializing', deviceName: name ?? device.name, message: 'Initialisation ELM327 et détection des PID…' });
      const obd = new OBDVehicleProvider(this.transport, this.acquisition);
      this.obd = obd;
      obd.onStats = (st) => this.repo.getState().setConnection(st as never);
      const info = await obd.initialize();
      obd.onFrame = () => this.repo.getState().setConnection({ lastFrameAt: Date.now() });
      obd.onError = (msg, fatal) => {
        const c = this.repo.getState().connection;
        this.repo.getState().setConnection({ errorCount: c.errorCount + 1, message: msg, ...(fatal ? { status: 'error' } : {}) });
      };
      repo.setConnection({ status: 'connected', protocol: info.protocol, supportedPids: info.supportedPids, message: info.adapterVersion, lastFrameAt: Date.now() });
      this.active = obd;
      await obd.start((p) => this.repo.getState().ingest(p));
      this.startWatchdog();
    } catch (e) {
      repo.setConnection({ status: 'error', message: (e as Error).message });
      await this.transport.disconnect().catch(() => {});
      throw e;
    }
  }

  async disconnect() {
    await this.stopActive();
    this.repo.getState().clear();
    this.repo.getState().setConnection({ status: 'disconnected', message: 'Déconnecté', supportedPids: [] });
  }

  private startWatchdog() {
    this.stopWatchdog();
    this.watchdog = setInterval(() => {
      const c = this.repo.getState().connection;
      if (c.status === 'connected' && c.lastFrameAt && Date.now() - c.lastFrameAt > 6000) {
        this.repo.getState().setConnection({ status: 'error', message: 'Plus de réponse de l’adaptateur (délai dépassé)' });
      }
    }, 2000);
  }
  private stopWatchdog() {
    if (this.watchdog) clearInterval(this.watchdog);
    this.watchdog = null;
  }

  private async stopActive() {
    this.stopWatchdog();
    if (this.active) await this.active.stop();
    this.obd = null;
    if (this.active?.kind === 'obd') await this.transport.disconnect().catch(() => {});
    this.active = null;
  }

  pause() {
    this.active?.pause();
  }
  resume() {
    this.active?.resume();
  }
}

export const ConnectionManager = new ConnectionManagerImpl();
