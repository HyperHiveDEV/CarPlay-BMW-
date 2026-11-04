#!/usr/bin/env node
/**
 * Validateur de modèle GLB pour F21 Digital.
 *   node tools/validate-glb.mjs <fichier.glb> [manifest.json] [--report rapport.md]
 *
 * Contrôles automatiques (techniques) — ils ne remplacent pas la validation visuelle
 * (comparaison aux photos) ni la vérification de la licence, consignées dans le manifeste
 * (champ "validation", voir docs/IMPORT_MODELE_3D.md).
 * Code de sortie : 0 = aucun bloquant, 1 = au moins un contrôle bloquant en échec.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const args = process.argv.slice(2);
const reportIdx = args.indexOf('--report');
const reportPath = reportIdx >= 0 ? args[reportIdx + 1] : null;
const pos = args.filter((a, i) => !a.startsWith('--') && (reportIdx < 0 || i !== reportIdx + 1));
const [glbPath, manifestPath] = pos;
if (!glbPath) {
  console.error('Usage : node tools/validate-glb.mjs <fichier.glb> [manifest.json] [--report rapport.md]');
  process.exit(2);
}

const DEFAULT = {
  openings: {
    driverDoor: { node: 'door_driver' }, passengerDoor: { node: 'door_passenger' },
    hood: { node: 'hood' }, tailgate: { node: 'tailgate' },
  },
  wheels: { fl: 'wheel_fl', fr: 'wheel_fr', rl: 'wheel_rl', rr: 'wheel_rr', steerFl: 'steer_fl', steerFr: 'steer_fr' },
  lights: { headlights: ['light_head_l', 'light_head_r'], tail: ['light_tail_l', 'light_tail_r'] },
  materials: { Paint: 'paint', Glass: 'glass', BlackGloss: 'gloss', Rim: 'rim', Tyre: 'tyre' },
};
const manifest = manifestPath ? { ...DEFAULT, ...JSON.parse(readFileSync(manifestPath, 'utf8')) } : DEFAULT;

// F21 : 4 324 × 1 765 × ~1 420 mm, empattement 2 690 mm
const F21 = { L: 4.324, W: 1.765, H: 1.42, wheelbase: 2.69 };
const results = [];
const check = (level, name, ok, detail) => results.push({ level, name, ok: !!ok, detail });

const buf = readFileSync(glbPath);
const gltf = await new Promise((res, rej) =>
  new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej),
).catch((e) => {
  console.error('GLB illisible :', e?.message ?? e);
  process.exit(1);
});
const scene = gltf.scene;
scene.updateMatrixWorld(true);
const json = gltf.parser.json;

// ---------------------------------------------------------------- inventaire
let tris = 0, meshes = 0, withNormals = 0;
const matNames = new Set();
scene.traverse((o) => {
  if (!o.isMesh) return;
  meshes++;
  const g = o.geometry;
  tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
  if (g.attributes.normal) withNormals++;
  (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m?.name && matNames.add(m.name));
});
const box = new THREE.Box3().setFromObject(scene);
const size = box.getSize(new THREE.Vector3());
const byName = (n) => scene.getObjectByName(n) ?? scene.getObjectByName(n.replace(/ /g, '_'));
const boxOf = (o) => new THREE.Box3().setFromObject(o);

check('bloquant', 'Fichier glTF 2.0 lisible', true, `générateur : ${json.asset?.generator ?? '?'}`);
check('bloquant', 'Axe vertical = Y (glTF)', size.y < size.x && size.y < size.z + 0.5, `dimensions X ${size.x.toFixed(3)} · Y ${size.y.toFixed(3)} · Z ${size.z.toFixed(3)} m`);
check('bloquant', 'Longueur ≈ 4,324 m (±4 %)', Math.abs(size.x - F21.L) / F21.L < 0.04, `${size.x.toFixed(3)} m — l'avant doit être vers +X`);
check('important', 'Largeur hors rétros ≈ 1,765 m', size.z > 1.70 && size.z < 2.10, `${size.z.toFixed(3)} m (rétroviseurs inclus)`);
check('important', 'Hauteur ≈ 1,42 m', Math.abs(size.y - F21.H) < 0.12, `${size.y.toFixed(3)} m`);
check('important', 'Roues posées au sol (Y min ≈ 0)', Math.abs(box.min.y) < 0.03, `Y min = ${box.min.y.toFixed(3)} m`);
check('important', 'Géométrie haute qualité (≥ 100 000 triangles)', tris >= 100000, `${Math.round(tris).toLocaleString('fr-FR')} triangles, ${meshes} maillages`);
check('important', 'Budget autoradio (≤ 600 000 triangles)', tris <= 600000, 'au-delà : décimer (prepare_f21_model.py, triangle_budget)');
check('important', 'Normales exportées', withNormals === meshes, `${withNormals}/${meshes} maillages`);
check('info', 'Textures', true, `${json.textures?.length ?? 0} texture(s), ${json.images?.length ?? 0} image(s)`);
check('info', 'Appels de rendu estimés', meshes <= 250, `${meshes} maillages (fusionner par matériau au-delà de ~250)`);

// ---------------------------------------------------------------- ouvrants et pivots
for (const [key, spec] of Object.entries(manifest.openings)) {
  const o = byName(spec.node);
  if (!o) { check('bloquant', `Ouvrant « ${spec.node} »`, false, 'nœud absent'); continue; }
  const b = boxOf(o);
  const p = o.getWorldPosition(new THREE.Vector3());
  let pivotOk = false, how = '';
  if (key === 'driverDoor' || key === 'passengerDoor') {
    const side = key === 'driverDoor' ? -1 : 1;
    const outer = side < 0 ? b.min.z : b.max.z;
    pivotOk = Math.abs(p.x - b.max.x) < 0.15 && Math.abs(p.z - outer) < 0.2 && Math.sign((b.min.z + b.max.z) / 2) === side;
    how = `pivot (${p.x.toFixed(2)}, ${p.z.toFixed(2)}) attendu au bord avant extérieur (${b.max.x.toFixed(2)}, ${outer.toFixed(2)}) ; côté ${side < 0 ? 'gauche −Z' : 'droit +Z'}`;
  } else if (key === 'hood') {
    pivotOk = Math.abs(p.x - b.min.x) < 0.15 && p.y > b.max.y - 0.25;
    how = `pivot x ${p.x.toFixed(2)} attendu près du bord arrière ${b.min.x.toFixed(2)}, en haut`;
  } else {
    pivotOk = Math.abs(p.x - b.max.x) < 0.2 && p.y > b.max.y - 0.2;
    how = `pivot x ${p.x.toFixed(2)} attendu près du bord avant ${b.max.x.toFixed(2)}, en haut`;
  }
  let n = 0; o.traverse((c) => c.isMesh && n++);
  check('bloquant', `Ouvrant « ${spec.node} » séparé`, n > 0, `${n} maillage(s)`);
  check('bloquant', `Charnière « ${spec.node} »`, pivotOk, how);
}

// ---------------------------------------------------------------- roues
const W = manifest.wheels;
const wheels = ['fl', 'fr', 'rl', 'rr'].map((k) => [k, byName(W[k])]);
for (const [k, o] of wheels) {
  if (!o) { check('bloquant', `Roue « ${W[k]} »`, false, 'nœud absent'); continue; }
  const c = o.getWorldPosition(new THREE.Vector3());
  const b = boxOf(o);
  const r = (b.max.y - b.min.y) / 2;
  const centered = Math.abs(c.y - (b.min.y + b.max.y) / 2) < 0.03 && Math.abs(c.x - (b.min.x + b.max.x) / 2) < 0.03;
  check('bloquant', `Roue « ${W[k]} » : pivot au moyeu`, centered, `centre (${c.x.toFixed(2)}, ${c.y.toFixed(2)}, ${c.z.toFixed(2)}), rayon ${r.toFixed(3)} m`);
}
const fl = byName(W.fl), rl = byName(W.rl);
if (fl && rl) {
  const wb = fl.getWorldPosition(new THREE.Vector3()).x - rl.getWorldPosition(new THREE.Vector3()).x;
  check('important', 'Empattement ≈ 2,69 m', Math.abs(wb - F21.wheelbase) < 0.05, `${wb.toFixed(3)} m`);
}
for (const k of ['steerFl', 'steerFr']) check('important', `Pivot de braquage « ${W[k]} »`, !!byName(W[k]), byName(W[k]) ? 'présent' : 'absent');

// ---------------------------------------------------------------- feux et matériaux
for (const n of [...(manifest.lights.headlights ?? []), ...(manifest.lights.tail ?? [])])
  check('important', `Pièce lumineuse « ${n} »`, !!byName(n), byName(n) ? 'présente' : 'absente (éclairage simulé indisponible)');
for (const m of Object.keys(manifest.materials))
  check('important', `Matériau « ${m} »`, matNames.has(m), matNames.has(m) ? 'présent' : `absent (matériaux du fichier : ${[...matNames].slice(0, 8).join(', ') || 'aucun'})`);

// ---------------------------------------------------------------- rapport
const blockers = results.filter((r) => r.level === 'bloquant' && !r.ok);
const warnings = results.filter((r) => r.level === 'important' && !r.ok);
const icon = (r) => (r.ok ? '✅' : r.level === 'bloquant' ? '❌' : r.level === 'important' ? '⚠️' : 'ℹ️');
const md = [
  `# Validation technique — ${glbPath.split('/').pop()}`,
  '',
  `Résultat : **${blockers.length ? 'REFUSÉ' : 'ACCEPTÉ techniquement'}** — ${blockers.length} bloquant(s), ${warnings.length} avertissement(s).`,
  '',
  '| | Contrôle | Niveau | Détail |',
  '|---|---|---|---|',
  ...results.map((r) => `| ${icon(r)} | ${r.name} | ${r.level} | ${r.detail ?? ''} |`),
  '',
  'Rappel : la validation visuelle (photos) et la licence doivent aussi être confirmées dans le manifeste.',
].join('\n');
console.log(md);
if (reportPath) writeFileSync(reportPath, md + '\n');
process.exit(blockers.length ? 1 : 0);
