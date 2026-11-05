import { Capacitor, registerPlugin } from '@capacitor/core';
import { assertAllowed } from './readOnlyGuard';

export interface BtDevice {
  name: string;
  address: string;
  bonded: boolean;
}

/** Pont vers le plugin natif Kotlin (android/app/src/main/java/.../ObdBluetoothPlugin.kt). */
interface ObdBluetoothNative {
  isAvailable(): Promise<{ available: boolean; enabled: boolean }>;
  /** nommée ainsi côté Kotlin pour ne pas masquer Plugin.requestPermissions de Capacitor */
  requestBluetoothPermissions(): Promise<{ granted: boolean }>;
  listDevices(opts: { discover: boolean }): Promise<{ devices: BtDevice[] }>;
  connect(opts: { address: string }): Promise<{ connected: boolean; name?: string }>;
  disconnect(): Promise<void>;
  send(opts: { command: string; timeoutMs: number }): Promise<{ response: string }>;
}

const Native = registerPlugin<ObdBluetoothNative>('ObdBluetooth');

export interface ObdTransport {
  readonly nativeAvailable: boolean;
  isAvailable(): Promise<{ available: boolean; enabled: boolean; reason?: string }>;
  requestPermissions(): Promise<boolean>;
  listDevices(discover: boolean): Promise<BtDevice[]>;
  connect(address: string): Promise<string | undefined>;
  disconnect(): Promise<void>;
  /** Envoie une commande (filtrée par la garde lecture seule) et renvoie la réponse brute. */
  send(command: string, timeoutMs?: number): Promise<string>;
}

class CapacitorBluetoothTransport implements ObdTransport {
  readonly nativeAvailable = true;
  async isAvailable() {
    return Native.isAvailable();
  }
  async requestPermissions() {
    return (await Native.requestBluetoothPermissions()).granted;
  }
  async listDevices(discover: boolean) {
    return (await Native.listDevices({ discover })).devices;
  }
  async connect(address: string) {
    const r = await Native.connect({ address });
    if (!r.connected) throw new Error('Connexion refusée par l’adaptateur');
    return r.name;
  }
  async disconnect() {
    await Native.disconnect();
  }
  async send(command: string, timeoutMs = 1500) {
    const safe = assertAllowed(command);
    return (await Native.send({ command: safe, timeoutMs })).response;
  }
}

/** Sur PC / navigateur : aucun accès Bluetooth série. Les appels échouent avec un message explicite. */
class UnavailableTransport implements ObdTransport {
  readonly nativeAvailable = false;
  private err() {
    return new Error('Bluetooth OBD disponible uniquement dans l’application Android.');
  }
  async isAvailable() {
    return { available: false, enabled: false, reason: 'Navigateur : utilisez l’APK Android pour l’OBD.' };
  }
  async requestPermissions() {
    return false;
  }
  async listDevices(): Promise<BtDevice[]> {
    throw this.err();
  }
  async connect(): Promise<string | undefined> {
    throw this.err();
  }
  async disconnect() {}
  async send(): Promise<string> {
    throw this.err();
  }
}

export const isNativeAndroid = () => Capacitor.getPlatform() === 'android';

export function createTransport(): ObdTransport {
  return isNativeAndroid() ? new CapacitorBluetoothTransport() : new UnavailableTransport();
}
