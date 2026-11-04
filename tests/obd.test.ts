import { describe, expect, it } from 'vitest';
import { isAllowedCommand } from '../src/obd/readOnlyGuard';
import { decodeSupportedPids, parseMode01Response, PIDS } from '../src/obd/pids';

describe('garde lecture seule', () => {
  it('autorise la configuration ELM327 et les lectures Mode 01', () => {
    for (const c of ['ATZ', 'ATE0', 'atsp0', '010C', '01 0D', '0100', 'ATRV', '0902']) expect(isAllowedCommand(c)).toBe(true);
  });
  it('bloque effacement défauts, contrôle actionneurs, UDS écriture/codage/routines', () => {
    for (const c of ['04', '0400', '08', '0801', '1003', '1101', '14FFFFFF', '2701', '2EF190', '2F', '3101', '3401', '36', '3E00', 'ATMA', 'ATSH7E0', 'ATPP0CSV', '010C;04', '']) {
      expect(isAllowedCommand(c)).toBe(false);
    }
  });
});

describe('décodage PID', () => {
  it('décode le régime', () => {
    const bytes = parseMode01Response('41 0C 1A F8\r\r>', '0C')!;
    expect(PIDS.find((p) => p.pid === '0C')!.decode(bytes)).toBe(1726);
  });
  it('gère NO DATA', () => {
    expect(parseMode01Response('NO DATA', '5C')).toBeNull();
    expect(parseMode01Response('SEARCHING...\rUNABLE TO CONNECT', '0C')).toBeNull();
  });
  it('décode le bitmask des PID supportés', () => {
    // BE 1F A8 13 : exemple classique
    const s = decodeSupportedPids(0, [0xbe, 0x1f, 0xa8, 0x13]);
    expect(s).toContain('01');
    expect(s).toContain('0C');
    expect(s).toContain('0D');
    expect(s).toContain('20');
    expect(s).not.toContain('02');
  });
  it('température : A − 40', () => {
    expect(PIDS.find((p) => p.pid === '05')!.decode([130])).toBe(90);
  });
});
