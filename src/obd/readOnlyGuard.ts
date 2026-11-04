/**
 * GARDE LECTURE SEULE — toute commande envoyée à l'adaptateur passe par ici.
 * Liste blanche stricte : uniquement configuration de l'adaptateur ELM327 (AT…)
 * et lectures OBD Mode 01 (données courantes) / Mode 09 PID 02 (VIN, lecture).
 *
 * Refusé par construction : Mode 04 (effacement défauts), Mode 08 (contrôle actionneurs),
 * services UDS 0x10/0x11/0x14/0x27/0x2E/0x2F/0x31/0x34/0x36/0x3B (session, reset, effacement,
 * sécurité, écriture, contrôle I/O, routines, téléchargement), codage, reprogrammation.
 * La même liste blanche est réimplémentée côté Kotlin (défense en profondeur).
 */
const ALLOWED_AT = new Set([
  'ATZ', 'ATWS', 'ATD', 'ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATH1', 'ATSP0', 'ATDP', 'ATDPN',
  'ATRV', 'ATI', 'AT@1', 'ATAT1', 'ATAT2', 'ATST32', 'ATST64', 'ATST96', 'ATSTFF',
]);

export class ForbiddenCommandError extends Error {
  constructor(cmd: string) {
    super(`Commande refusée par la garde lecture seule : "${cmd}"`);
  }
}

export function normalizeCommand(cmd: string): string {
  return cmd.replace(/\s+/g, '').toUpperCase();
}

export function isAllowedCommand(cmd: string): boolean {
  const c = normalizeCommand(cmd);
  if (ALLOWED_AT.has(c)) return true;
  if (/^01[0-9A-F]{2}$/.test(c)) return true; // Mode 01 : données courantes
  if (c === '0902') return true; // Mode 09 : lecture VIN
  return false;
}

export function assertAllowed(cmd: string): string {
  if (!isAllowedCommand(cmd)) throw new ForbiddenCommandError(cmd);
  return normalizeCommand(cmd);
}
