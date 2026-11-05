import { describe, expect, it } from 'vitest';
import { InputManager } from '../src/input/InputManager';
import { densityFor } from '../src/components/layout';
import { applyReading, initialFiltered, tick, SimulatedBodyStatusProvider, NoBodyStatusProvider, type BodyReading } from '../src/vehicle/bodyStatus';
import * as body from '../src/vehicle/bodyStatus';

const key = (k: string, shift = false) => ({ key: k, shiftKey: shift, ctrlKey: false, altKey: false, metaKey: false });

describe('InputManager', () => {
  it('traduit le clavier en actions logiques (molette, BACK, MENU, OPTION, zoom)', () => {
    const im = new InputManager();
    expect(im.actionForKey(key('ArrowLeft'))).toBe('left');
    expect(im.actionForKey(key('Enter'))).toBe('select');
    expect(im.actionForKey(key('Escape'))).toBe('back');
    expect(im.actionForKey(key('m'))).toBe('home');
    expect(im.actionForKey(key('o'))).toBe('option');
    expect(im.actionForKey(key(']'))).toBe('next');
    expect(im.actionForKey(key('Tab', true))).toBe('prev');
    expect(im.actionForKey(key('+'))).toBe('zoomIn');
    expect(im.actionForKey({ ...key('a'), ctrlKey: true })).toBeNull();
  });
  it('accepte des touches configurées sans perdre les touches par défaut', () => {
    const im = new InputManager();
    im.setKeymap({ F2: 'option', w: 'up' });
    expect(im.actionForKey(key('F2'))).toBe('option');
    expect(im.actionForKey(key('w'))).toBe('up');
    expect(im.actionForKey(key('ArrowUp'))).toBe('up');
  });
  it('distribue au dernier abonné d’abord ; une action consommée s’arrête', () => {
    const im = new InputManager();
    const seen: string[] = [];
    im.subscribe((a) => { seen.push(`A:${a}`); });
    const off = im.subscribe((a) => { seen.push(`B:${a}`); return a === 'back'; });
    expect(im.dispatch('back', 'idrive')).toBe(true);
    expect(im.dispatch('next', 'remote')).toBe(false);
    expect(seen).toEqual(['B:back', 'B:next', 'A:next']);
    expect(im.lastSource).toBe('remote');
    off();
    im.dispatch('select', 'android');
    expect(seen[seen.length - 1]).toBe('A:select');
    expect(im.dispatch('inconnue' as never, 'test')).toBe(false);
  });
});

describe('densité d’affichage (profils écran embarqué)', () => {
  it('classe les résolutions de test', () => {
    expect(densityFor(800, 480)).toBe('tiny');
    expect(densityFor(1280, 480)).toBe('tiny');
    expect(densityFor(1024, 600)).toBe('compact');
    expect(densityFor(1280, 720)).toBe('compact');
    expect(densityFor(1920, 720)).toBe('compact');
    expect(densityFor(1920, 1080)).toBe('normal');
  });
});

describe('BodyStatusProvider (états des ouvrants)', () => {
  const r = (state: 'open' | 'closed', ts: number): BodyReading => ({ key: 'driverDoor', state, ts });
  it('démarre « inconnu » et filtre les changements parasites (anti-rebond)', () => {
    let f = initialFiltered();
    expect(f.state).toBe('unknown');
    f = applyReading(f, r('open', 0), 300);
    expect(f.state).toBe('unknown');
    f = applyReading(f, r('closed', 100), 300); // rebond
    f = applyReading(f, r('closed', 200), 300);
    expect(f.state).toBe('unknown');
    f = applyReading(f, r('closed', 450), 300);
    expect(f.state).toBe('closed');
    expect(f.changedAt).toBe(450);
  });
  it('confirme un changement stable au fil du temps et repasse « inconnu » à la perte de signal', () => {
    let f = applyReading(initialFiltered(), r('open', 1000), 300);
    f = tick(f, 1200, 300, 5000);
    expect(f.state).toBe('unknown');
    f = tick(f, 1350, 300, 5000);
    expect(f.state).toBe('open');
    f = tick(f, 7000, 300, 5000);
    expect(f.state).toBe('unknown');
  });
  it('n’expose aucune commande vers le véhicule et aucune source réelle n’est simulée', () => {
    const exported = Object.keys(body).join(' ');
    expect(exported).not.toMatch(/lock|unlock|verrou|command|open[A-Z]/);
    expect(new NoBodyStatusProvider().source).toBe('NA');
    const sim = new SimulatedBodyStatusProvider();
    expect(sim.source).toBe('DEMO');
    const got: BodyReading[] = [];
    sim.start((x) => got.push(x));
    sim.simulate('tailgate', 'open', 5);
    expect(got).toEqual([{ key: 'tailgate', state: 'open', ts: 5 }]);
  });
});
