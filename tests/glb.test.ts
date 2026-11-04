import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { bake, roleOf } from '../src/three/glbBake';

const buf = readFileSync('public/models/BMW_116i_F21_2018_maquette_3D.glb');
const load = () =>
  new Promise<THREE.Group>((res, rej) =>
    new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', (g) => res(g.scene), rej),
  );

describe('GLB maquette BMW 116i F21', () => {
  it('se charge et se convertit dans le repère de l’application', async () => {
    const b = bake(await load());
    expect(b.stats.meshes).toBe(123);
    expect(b.stats.triangles).toBe(16196);
    expect(b.stats.drawCalls).toBeLessThan(40);
    const box = new THREE.Box3();
    b.body.forEach(({ geo }) => { geo.computeBoundingBox(); box.union(geo.boundingBox!); });
    expect(box.max.x - box.min.x).toBeGreaterThan(4.2); // longueur ~4,3 m
    expect(box.max.y).toBeGreaterThan(1.35); // Y = hauteur après conversion
    expect(box.max.y).toBeLessThan(1.6);
    expect(box.min.y).toBeGreaterThan(-0.05);
  });
  it('regroupe 4 roues complètes (pneu, voile, branches, centre)', async () => {
    const b = bake(await load());
    expect(b.wheels.map((w) => w.key).sort()).toEqual(['frontL', 'frontR', 'rearL', 'rearR']);
    for (const w of b.wheels) expect(w.parts.map((p) => p.role).sort()).toEqual(['hub', 'rim', 'rimInner', 'tyre']);
  });
  it('place la sortie d’échappement simple à gauche (−Z)', async () => {
    const b = bake(await load());
    const ex = Object.entries(b.boxes).find(([k]) => k.includes('exhaust'))![1];
    expect(ex.getCenter(new THREE.Vector3()).z).toBeLessThan(0);
    expect(roleOf('front windshield')).toBe('glassFront');
    expect(roleOf('rear quarter window 1')).toBe('glassRear');
    expect(roleOf('F21_three-door_body_shell')).toBe('paint');
  });
});
