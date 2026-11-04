import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Lance le validateur (comme `npm run model:check`) et renvoie code de sortie + rapport Markdown. */
function validate(glb: string, manifest?: string) {
  const dir = mkdtempSync(join(tmpdir(), 'f21-val-'));
  const report = join(dir, 'rapport.md');
  const args = ['tools/validate-glb.mjs', glb, ...(manifest ? [manifest] : []), '--report', report];
  const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
  return { code: r.status, md: readFileSync(report, 'utf8') };
}

/** GLB minimal : un maillage (positions [+ normales], indices) + JSON supplémentaire. */
function makeGlb(opts: { positions: number[]; indices?: number[]; normals?: number[]; extra?: Record<string, unknown>; image?: Buffer }) {
  const parts: Buffer[] = [];
  const views: { byteOffset: number; byteLength: number }[] = [];
  const push = (b: Buffer) => {
    const off = parts.reduce((n, p) => n + p.length, 0);
    const padded = b.length % 4 ? Buffer.concat([b, Buffer.alloc(4 - (b.length % 4))]) : b;
    views.push({ byteOffset: off, byteLength: b.length });
    parts.push(padded);
    return views.length - 1;
  };
  const f32 = (a: number[]) => Buffer.from(new Float32Array(a).buffer);
  const pv = push(f32(opts.positions));
  const accessors: Record<string, unknown>[] = [{ bufferView: pv, componentType: 5126, count: opts.positions.length / 3, type: 'VEC3' }];
  const attributes: Record<string, number> = { POSITION: 0 };
  if (opts.normals) { accessors.push({ bufferView: push(f32(opts.normals)), componentType: 5126, count: opts.normals.length / 3, type: 'VEC3' }); attributes.NORMAL = accessors.length - 1; }
  let indices: number | undefined;
  if (opts.indices) { accessors.push({ bufferView: push(Buffer.from(new Uint32Array(opts.indices).buffer)), componentType: 5125, count: opts.indices.length, type: 'SCALAR' }); indices = accessors.length - 1; }
  const json: Record<string, unknown> = {
    asset: { version: '2.0', generator: 'test' },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: 'F21_body_shell', mesh: 0 }],
    meshes: [{ primitives: [{ attributes, ...(indices !== undefined ? { indices } : {}) }] }],
    accessors,
    ...opts.extra,
  };
  if (opts.image) {
    const iv = push(opts.image);
    Object.assign(json, { images: [{ bufferView: iv, mimeType: 'image/png', name: 'peinture' }], textures: [{ source: 0 }] });
  }
  const bin = Buffer.concat(parts);
  json.bufferViews = views.map((v) => ({ buffer: 0, ...v }));
  json.buffers = [{ byteLength: bin.length }];
  const j = Buffer.from(JSON.stringify(json));
  const jp = j.length % 4 ? Buffer.concat([j, Buffer.alloc(4 - (j.length % 4), 0x20)]) : j;
  const total = 12 + 8 + jp.length + 8 + bin.length;
  const out = Buffer.alloc(total);
  out.write('glTF', 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(total, 8);
  out.writeUInt32LE(jp.length, 12); out.write('JSON', 16); jp.copy(out, 20);
  out.writeUInt32LE(bin.length, 20 + jp.length); out.write('BIN\0', 24 + jp.length); bin.copy(out, 28 + jp.length);
  const file = join(mkdtempSync(join(tmpdir(), 'f21-glb-')), 'test.glb');
  writeFileSync(file, out);
  return file;
}
const tri = [0, 0, 0, 1, 0, 0, 0, 1, 0];
const n3 = [0, 0, 1, 0, 0, 1, 0, 0, 1];

describe('validateur GLB (tools/validate-glb.mjs)', () => {
  it('refuse la maquette brute : axe Z vers le haut, normales absentes, ouvrants absents', () => {
    const { code, md } = validate('public/models/BMW_116i_F21_2018_maquette_3D.glb');
    expect(code).toBe(1);
    expect(md).toMatch(/❌ \| Axe vertical = Y/);
    expect(md).toMatch(/⚠️ \| Normales présentes \| important \| 123 géométrie/);
    expect(md).toMatch(/Portière conducteur « door_driver » : nœud présent/);
    expect(md).toMatch(/✅ \| Coordonnées finies/);
  });
  it('détecte les coordonnées NaN / Infinity', () => {
    const { code, md } = validate(makeGlb({ positions: [0, 0, 0, NaN, 0, 0, 0, Infinity, 0], indices: [0, 1, 2], normals: n3 }));
    expect(code).toBe(1);
    expect(md).toMatch(/❌ \| Coordonnées finies[^\n]*2 sommet/);
  });
  it('détecte les indices hors limites', () => {
    const { md } = validate(makeGlb({ positions: tri, indices: [0, 1, 7], normals: n3 }));
    expect(md).toMatch(/❌ \| Indices de triangles valides[^\n]*1 indice/);
  });
  it('détecte les triangles dégénérés (bloquant au-delà de 5 %)', () => {
    const { md } = validate(makeGlb({ positions: tri, indices: [0, 1, 2, 0, 0, 1, 1, 2, 2], normals: n3 }));
    expect(md).toMatch(/❌ \| Triangles dégénérés[^\n]*\| bloquant \| 2 sur 3/);
  });
  it('signale les normales manquantes', () => {
    const { md } = validate(makeGlb({ positions: tri, indices: [0, 1, 2] }));
    expect(md).toMatch(/⚠️ \| Normales présentes \| important \| 1 géométrie/);
  });
  it('refuse une compression Draco (pas de décodeur hors ligne)', () => {
    const { code, md } = validate(makeGlb({ positions: tri, indices: [0, 1, 2], normals: n3, extra: { extensionsUsed: ['KHR_draco_mesh_compression'], extensionsRequired: ['KHR_draco_mesh_compression'] } }));
    expect(code).toBe(1);
    expect(md).toMatch(/❌ \| Pas de compression[^\n]*KHR_draco_mesh_compression/);
  });
  it('mesure les textures intégrées (en-tête PNG) pour l’estimation mémoire', () => {
    const png = Buffer.alloc(33);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0);
    png.writeUInt32BE(4096, 16);
    png.writeUInt32BE(4096, 20);
    const { md } = validate(makeGlb({ positions: tri, indices: [0, 1, 2], normals: n3, image: png }));
    expect(md).toMatch(/Taille maximale des textures[^\n]*4096 px/);
    expect(md).toMatch(/1 image\(s\), 85\.3 Mo/);
  });
  it('ne déclare jamais la fidélité ni la licence, même avec un manifeste approuvé', () => {
    const dir = mkdtempSync(join(tmpdir(), 'f21-man-'));
    const man = join(dir, 'm.json');
    const all = { body3DoorF21: true, lciFrontAndRearLights: true, highQualityGeometry: true, blenderCompatibleFormat: true, editableMaterials: true, separableOpeningsAndWheels: true, licenceAllowsAndroidApp: true, comparedToPhotos: true, approved: true, approvedBy: 'test' };
    writeFileSync(man, JSON.stringify({ validation: all }));
    const { md } = validate(makeGlb({ positions: tri, indices: [0, 1, 2], normals: n3 }), man);
    expect(md).toMatch(/Déclaration humaine, non vérifiable par ce validateur/);
    expect(md).toMatch(/ne dit \*\*pas\*\* que le modèle est/);
    expect(md).toMatch(/Collisions \(non simulées par ce validateur\)/);
    const unapproved = validate(makeGlb({ positions: tri, indices: [0, 1, 2], normals: n3 }));
    expect(unapproved.md).toMatch(/Statut : \*\*non approuvé\*\*/);
  });
});
