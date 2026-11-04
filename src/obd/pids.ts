import type { MetricKey } from '../vehicle/types';

/**
 * PID OBD-II standard SAE J1979, Mode 01 (lecture des données courantes).
 * Seuls les PID déclarés supportés par le calculateur (bitmask 0100/0120/0140) sont interrogés.
 * Aucune donnée propriétaire BMW (DME/BDC via UDS) n'est supposée accessible.
 */
export interface PidDef {
  pid: string; // hex 2 caractères
  key: MetricKey;
  bytes: number;
  decode: (b: number[]) => number;
  /** fréquence relative : 1 = à chaque cycle, 5 = un cycle sur cinq */
  every: number;
}

export const PIDS: PidDef[] = [
  { pid: '0C', key: 'rpm', bytes: 2, decode: ([a, b]) => (256 * a + b) / 4, every: 1 },
  { pid: '0D', key: 'speed', bytes: 1, decode: ([a]) => a, every: 1 },
  { pid: '11', key: 'throttle', bytes: 1, decode: ([a]) => (100 * a) / 255, every: 1 },
  { pid: '04', key: 'load', bytes: 1, decode: ([a]) => (100 * a) / 255, every: 2 },
  { pid: '0B', key: 'map', bytes: 1, decode: ([a]) => a, every: 1 },
  { pid: '05', key: 'coolantTemp', bytes: 1, decode: ([a]) => a - 40, every: 10 },
  { pid: '5C', key: 'oilTemp', bytes: 1, decode: ([a]) => a - 40, every: 10 },
  { pid: '0F', key: 'intakeAirTemp', bytes: 1, decode: ([a]) => a - 40, every: 10 },
  { pid: '33', key: 'baro', bytes: 1, decode: ([a]) => a, every: 50 },
  { pid: '42', key: 'battery', bytes: 2, decode: ([a, b]) => (256 * a + b) / 1000, every: 10 },
  { pid: '2F', key: 'fuel', bytes: 1, decode: ([a]) => (100 * a) / 255, every: 50 },
];

/** Décode la réponse aux PID 00/20/40/60 (bitmask des PID supportés). */
export function decodeSupportedPids(basePid: number, bytes: number[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < 32; i++) {
    const byte = bytes[Math.floor(i / 8)] ?? 0;
    if (byte & (0x80 >> i % 8)) out.push((basePid + i + 1).toString(16).toUpperCase().padStart(2, '0'));
  }
  return out;
}

/**
 * Extrait les octets de données d'une réponse ELM327 en mode texte (ATS0/ATH0),
 * ex. "410C1AF8" -> [0x1A, 0xF8]. Retourne null pour NO DATA / erreurs.
 */
export function parseMode01Response(raw: string, pid: string): number[] | null {
  const clean = raw.replace(/\s|>|SEARCHING\.\.\./g, '').toUpperCase();
  if (!clean || /NODATA|ERROR|UNABLE|STOPPED|BUSINIT|\?/.test(clean)) return null;
  const marker = '41' + pid.toUpperCase();
  const idx = clean.indexOf(marker);
  if (idx < 0) return null;
  const hex = clean.slice(idx + marker.length);
  const bytes: number[] = [];
  for (let i = 0; i + 1 < hex.length && bytes.length < 8; i += 2) {
    const v = parseInt(hex.slice(i, i + 2), 16);
    if (Number.isNaN(v)) break;
    bytes.push(v);
  }
  return bytes.length ? bytes : null;
}
