#!/usr/bin/env node
/**
 * Validateur de modèle GLB pour F21 Digital (BMW 116i F21 LCI, 3 portes).
 *
 *   node tools/validate-glb.mjs <fichier.glb> [manifest.json] [--report rapport.md]
 *   npm run model:check -- <fichier.glb> [manifest.json] [--report rapport.md]
 *
 * Contrôles TECHNIQUES automatiques : intégrité des géométries, dimensions de carrosserie,
 * ouvrants et charnières, roues et essieux, matériaux et pièces lumineuses, performances Android.
 *
 * Ce validateur ne déclare JAMAIS un modèle fidèle au véhicule ni autorisé à la distribution :
 * la comparaison aux photographies et la licence relèvent d'une validation humaine, consignée dans
 * le manifeste (champ "validation", vérifié par l'application — voir docs/IMPORT_MODELE_3D.md).
 * Il ne simule pas non plus les collisions des ouvrants : une checklist visuelle est fournie.
 *
 * Codes de sortie : 0 = aucun contrôle bloquant en échec ; 1 = au moins un bloquant ; 2 = usage.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ===================================================================== arguments
const args = process.argv.slice(2);
const reportIdx = args.indexOf('--report');
const reportPath = reportIdx >= 0 ? args[reportIdx + 1] : null;
const pos = args.filter((a, i) => !a.startsWith('--') && (reportIdx < 0 || i !== reportIdx + 1));
const [glbPath, manifestPath] = pos;
if (!glbPath) {
  console.error('Usage : node tools/validate-glb.mjs <fichier.glb> [manifest.json] [--report rapport.md]');
  process.exit(2);
}

// ===================================================================== référentiel
/** BMW 116i F21 LCI (2015-2019) — données constructeur arrondies. */
const F21 = {
  L: 4.324, // longueur hors tout carrosserie
  W: 1.765, // largeur hors rétroviseurs
  H: 1.42, // hauteur approximative (sans antenne)
  wheelbase: 2.69,
  trackFront: [1.45, 1.62], // voie avant (m), plage plausible selon jantes
  trackRear: [1.48, 1.65],
  wheelDiameter: [0.6, 0.7], // 225/40 R18 ≈ 0,637 m ; 205/55 R16 ≈ 0,632 m
};

/** Manifeste par défaut — identique à DEFAULT_MANIFEST de l'application (src/three/modelManifest.ts). */
const DEFAULT = {
  openings: {
    driverDoor: { node: 'door_driver', axis: 'y', angle: -1.12 },
    passengerDoor: { node: 'door_passenger', axis: 'y', angle: 1.12 },
    hood: { node: 'hood', axis: 'z', angle: 0.92 },
    tailgate: { node: 'tailgate', axis: 'z', angle: -1.22 },
  },
  wheels: { fl: 'wheel_fl', fr: 'wheel_fr', rl: 'wheel_rl', rr: 'wheel_rr', steerFl: 'steer_fl', steerFr: 'steer_fr' },
  lights: {
    headlights: ['light_head_l', 'light_head_r'],
    tail: ['light_tail_l', 'light_tail_r'],
    brake: [],
    blinkLeft: [],
    blinkRight: [],
  },
  materials: { Paint: 'paint', Glass: 'glass', BlackGloss: 'gloss', Rim: 'rim', Tyre: 'tyre' },
};
let manifest = DEFAULT;
if (manifestPath) {
  const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest = {
    ...DEFAULT,
    ...m,
    openings: { ...DEFAULT.openings, ...(m.openings ?? {}) },
    wheels: { ...DEFAULT.wheels, ...(m.wheels ?? {}) },
    lights: { ...DEFAULT.lights, ...(m.lights ?? {}) },
    materials: m.materials ?? DEFAULT.materials,
  };
}

/** Critères de validation humaine — mêmes clés que ModelValidation (src/three/modelManifest.ts). */
const HUMAN_CRITERIA = {
  body3DoorF21: 'Carrosserie F21 trois portes',
  lciFrontAndRearLights: 'Face avant et feux arrière LCI',
  highQualityGeometry: 'Géométrie haute qualité',
  blenderCompatibleFormat: 'Format compatible Blender',
  editableMaterials: 'Matériaux modifiables',
  separableOpeningsAndWheels: 'Portières, capot, hayon et roues séparés',
  licenceAllowsAndroidApp: 'Licence autorisant une application Android',
  comparedToPhotos: 'Comparaison aux photographies',
};

/** Pièces qui faussent les mesures de carrosserie (exclues des dimensions). */
const ACCESSORY = /mirror|retro|rétro|exhaust|echap|échap|tip|spoiler|becquet|aileron|antenna|antenne|shark|plate|plaque|splitter|lip\b|lame|diffuser|diffuseur|fin\b|ailette|wiper|essuie|tow|remorq|light|lamp|phare|feu|blinker|indicator|glass|window|vitre|windshield|pare-brise|wheel|tire|tyre|pneu|rim|jante|spoke|roundel|brake|caliper|disc|interior|seat/i;

// ===================================================================== résultats
const CATEGORIES = ['Fichier', 'Géométrie', 'Dimensions', 'Ouvrants', 'Roues', 'Matériaux', 'Éclairage', 'Performances'];
const results = [];
/** niveau : 'bloquant' | 'important' (avertissement) | 'info' */
const check = (cat, level, name, ok, detail = '') => results.push({ cat, level, name, ok: !!ok, detail });
const f3 = (v) => (Number.isFinite(v) ? v.toFixed(3) : String(v));
const fmt = (n) => Math.round(n).toLocaleString('fr-FR');

// ===================================================================== lecture du GLB
/**
 * Lit les blocs du GLB, relève les textures (dimensions lues dans les en-têtes d'images) puis
 * produit une copie sans textures pour le chargeur (Node ne décode pas les images).
 */
function readGlb(path) {
  const buf = readFileSync(path);
  if (buf.length < 20 || buf.toString('ascii', 0, 4) !== 'glTF') {
    throw new Error(path.endsWith('.gltf') ? 'fichier .gltf texte : exporter en .glb (binaire)' : 'en-tête glTF absent : ce n’est pas un fichier GLB');
  }
  const version = buf.readUInt32LE(4);
  let off = 12;
  let json = null;
  let bin = null;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'JSON') json = JSON.parse(data.toString('utf8'));
    else if (type.startsWith('BIN')) bin = data;
    off += 8 + len;
  }
  if (!json) throw new Error('bloc JSON absent');
  return { version, json, bin, size: buf.length };
}

function imageSize(bytes) {
  if (!bytes || bytes.length < 24) return null;
  // PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return { w: bytes.readUInt32BE(16), h: bytes.readUInt32BE(20), type: 'png' };
  // JPEG : recherche du marqueur SOF
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1];
      const len = bytes.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
        return { h: bytes.readUInt16BE(i + 5), w: bytes.readUInt16BE(i + 7), type: 'jpeg' };
      i += 2 + len;
    }
  }
  // WebP (VP8X)
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' && bytes.toString('ascii', 12, 16) === 'VP8X')
    return { w: 1 + bytes.readUIntLE(24, 3), h: 1 + bytes.readUIntLE(27, 3), type: 'webp' };
  return { w: 0, h: 0, type: 'inconnu' };
}

function textureInventory(json, bin, baseDir) {
  return (json.images ?? []).map((img, i) => {
    let bytes = null;
    if (img.bufferView !== undefined && bin) {
      const bv = json.bufferViews[img.bufferView];
      bytes = bin.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength);
    } else if (img.uri && !img.uri.startsWith('data:') && existsSync(join(baseDir, img.uri))) {
      bytes = readFileSync(join(baseDir, img.uri));
    } else if (img.uri?.startsWith('data:')) {
      bytes = Buffer.from(img.uri.split(',')[1] ?? '', 'base64');
    }
    const s = imageSize(bytes);
    return { index: i, name: img.name ?? img.uri ?? `image ${i}`, mime: img.mimeType, ...(s ?? { w: 0, h: 0, type: 'introuvable' }) };
  });
}

/** Copie du JSON sans textures/images (le chargeur Node ne décode pas les images). */
function stripTextures(json) {
  const j = structuredClone(json);
  delete j.images;
  delete j.textures;
  delete j.samplers;
  const strip = (o) => {
    if (!o || typeof o !== 'object') return;
    for (const k of Object.keys(o)) {
      if (/Texture$/.test(k) && o[k] && typeof o[k] === 'object' && 'index' in o[k]) delete o[k];
      else strip(o[k]);
    }
  };
  (j.materials ?? []).forEach(strip);
  const texExt = ['KHR_texture_transform', 'KHR_texture_basisu', 'EXT_texture_webp', 'EXT_texture_avif'];
  j.extensionsUsed = (j.extensionsUsed ?? []).filter((e) => !texExt.includes(e));
  j.extensionsRequired = (j.extensionsRequired ?? []).filter((e) => !texExt.includes(e));
  return j;
}

function buildGlb(json, bin) {
  const pad = (b, fill) => (b.length % 4 ? Buffer.concat([b, Buffer.alloc(4 - (b.length % 4), fill)]) : b);
  const j = pad(Buffer.from(JSON.stringify(json), 'utf8'), 0x20);
  const b = bin ? pad(Buffer.from(bin), 0) : null;
  const total = 12 + 8 + j.length + (b ? 8 + b.length : 0);
  const out = Buffer.alloc(total);
  out.write('glTF', 0, 'ascii');
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(total, 8);
  out.writeUInt32LE(j.length, 12);
  out.write('JSON', 16, 'ascii');
  j.copy(out, 20);
  if (b) {
    out.writeUInt32LE(b.length, 20 + j.length);
    out.write('BIN\0', 24 + j.length, 'ascii');
    b.copy(out, 28 + j.length);
  }
  return out;
}

let raw;
try {
  raw = readGlb(glbPath);
} catch (e) {
  console.error('GLB illisible :', e.message);
  process.exit(1);
}
const json = raw.json;
const textures = textureInventory(json, raw.bin, dirname(glbPath));

check('Fichier', 'bloquant', 'Fichier GLB (glTF binaire) lisible', true, `${(raw.size / 1048576).toFixed(2)} Mo, générateur : ${json.asset?.generator ?? '?'}`);
check('Fichier', 'bloquant', 'Version glTF 2.0', String(json.asset?.version ?? '').startsWith('2'), `asset.version = ${json.asset?.version ?? '?'}`);
const required = json.extensionsRequired ?? [];
const UNSUPPORTED = ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_mesh_quantization', 'KHR_texture_basisu'];
const blockedExt = required.filter((e) => UNSUPPORTED.includes(e));
check('Fichier', 'bloquant', 'Pas de compression exigeant un décodeur en ligne', blockedExt.length === 0,
  blockedExt.length ? `extensions requises : ${blockedExt.join(', ')} — l'application fonctionne hors ligne sans décodeur Draco/meshopt/Basis : réexporter sans compression` : `extensions : ${(json.extensionsUsed ?? []).join(', ') || 'aucune'}`);
check('Fichier', 'info', 'Animations intégrées', true, `${json.animations?.length ?? 0} (l'application anime elle-même ouvrants et roues)`);

let gltf = null;
if (!blockedExt.length) {
  const clean = buildGlb(stripTextures(json), raw.bin);
  gltf = await new Promise((res, rej) =>
    new GLTFLoader().parse(clean.buffer.slice(clean.byteOffset, clean.byteOffset + clean.byteLength), '', res, rej),
  ).catch((e) => {
    check('Fichier', 'bloquant', 'Chargement par Three.js (GLTFLoader)', false, e?.message ?? String(e));
    return null;
  });
}
if (gltf) check('Fichier', 'bloquant', 'Chargement par Three.js (GLTFLoader)', true, 'même chargeur que l’application');

// ===================================================================== inventaire de la scène
const scene = gltf?.scene ?? new THREE.Group();
scene.updateMatrixWorld(true);
const byName = (n) => (n ? scene.getObjectByName(n) ?? scene.getObjectByName(String(n).replace(/ /g, '_')) : undefined);
const meshesOf = (root) => { const out = []; root?.traverse((o) => o.isMesh && out.push(o)); return out; };
const allMeshes = meshesOf(scene);
/** Boîte englobante des maillages listés SEULS (sans leurs enfants : un rétroviseur rattaché à la
 *  portière ne doit pas élargir la carrosserie ni déplacer la charnière attendue). */
const meshBox = (m) => {
  if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
  return m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
};
const boxOfMeshes = (list) => { const b = new THREE.Box3(); list.forEach((m) => b.union(meshBox(m))); return b; };
const worldPos = (o) => o.getWorldPosition(new THREE.Vector3());
const isAncestor = (a, b) => { for (let p = b?.parent; p; p = p.parent) if (p === a) return true; return false; };
const matsOf = (m) => (Array.isArray(m.material) ? m.material : [m.material]).filter(Boolean);

// ===================================================================== 1. géométrie
const geo = { tris: 0, nanVerts: 0, badIdx: 0, nonIntIdx: 0, degenerate: 0, noNormals: 0, badNormals: 0, meshesWithNaN: [], meshesBadIdx: [], meshesNoNormals: [] };
const seenGeo = new Set();
const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3();
for (const m of allMeshes) {
  const g = m.geometry;
  const p = g.attributes.position;
  if (!p) continue;
  const triCount = (g.index ? g.index.count : p.count) / 3;
  geo.tris += triCount;
  if (seenGeo.has(g.uuid)) continue; // géométrie instanciée : analysée une fois
  seenGeo.add(g.uuid);
  let nan = 0;
  for (let i = 0; i < p.count; i++) if (!Number.isFinite(p.getX(i)) || !Number.isFinite(p.getY(i)) || !Number.isFinite(p.getZ(i))) nan++;
  if (nan) { geo.nanVerts += nan; geo.meshesWithNaN.push(m.name); }
  const n = g.attributes.normal;
  if (!n) { geo.noNormals++; geo.meshesNoNormals.push(m.name); }
  else for (let i = 0; i < n.count; i++) {
    const l = Math.hypot(n.getX(i), n.getY(i), n.getZ(i));
    if (!Number.isFinite(l) || l < 1e-6) geo.badNormals++;
  }
  const idx = g.index;
  let bad = 0;
  const get = (k) => (idx ? idx.getX(k) : k);
  if (idx) for (let k = 0; k < idx.count; k++) {
    const v = idx.getX(k);
    if (!Number.isInteger(v)) geo.nonIntIdx++;
    if (v < 0 || v >= p.count) bad++;
  }
  if (bad) { geo.badIdx += bad; geo.meshesBadIdx.push(m.name); }
  if (!bad) for (let t = 0; t + 2 < (idx ? idx.count : p.count); t += 3) {
    const a = get(t), b = get(t + 1), c = get(t + 2);
    if (a === b || b === c || a === c) { geo.degenerate++; continue; }
    vA.fromBufferAttribute(p, a); vB.fromBufferAttribute(p, b); vC.fromBufferAttribute(p, c);
    const area2 = ab.subVectors(vB, vA).cross(ac.subVectors(vC, vA)).length();
    if (!(area2 > 1e-12)) geo.degenerate++;
  }
}
const degRatio = geo.tris ? geo.degenerate / geo.tris : 0;
check('Géométrie', 'bloquant', 'Coordonnées finies (pas de NaN ni d’Infinity)', geo.nanVerts === 0,
  geo.nanVerts ? `${geo.nanVerts} sommet(s) invalides dans : ${geo.meshesWithNaN.slice(0, 6).join(', ')}` : `${allMeshes.length} maillages contrôlés`);
check('Géométrie', 'bloquant', 'Indices de triangles valides', geo.badIdx === 0 && geo.nonIntIdx === 0,
  geo.badIdx || geo.nonIntIdx ? `${geo.badIdx} indice(s) hors limites, ${geo.nonIntIdx} non entier(s) — ${geo.meshesBadIdx.slice(0, 6).join(', ')}` : 'tous les indices référencent un sommet existant');
check('Géométrie', degRatio > 0.05 ? 'bloquant' : 'important', 'Triangles dégénérés (aire nulle ou sommets répétés)', degRatio <= 0.01,
  `${fmt(geo.degenerate)} sur ${fmt(geo.tris)} (${(degRatio * 100).toFixed(2)} %) — tolérance 1 %, bloquant au-delà de 5 %`);
check('Géométrie', 'important', 'Normales présentes', geo.noNormals === 0,
  geo.noNormals ? `${geo.noNormals} géométrie(s) sans normales (éclairage faux) : ${geo.meshesNoNormals.slice(0, 6).join(', ')} — exporter les normales` : 'toutes les géométries ont des normales');
check('Géométrie', 'important', 'Normales valides (longueur non nulle, finies)', geo.badNormals === 0, `${fmt(geo.badNormals)} normale(s) invalide(s)`);
check('Géométrie', 'important', 'Géométrie haute qualité (≥ 100 000 triangles)', geo.tris >= 100000, `${fmt(geo.tris)} triangles, ${allMeshes.length} maillages`);

// ===================================================================== 2. dimensions
const role = (matName) => manifest.materials?.[matName];
const wheelNodes = ['fl', 'fr', 'rl', 'rr'].map((k) => byName(manifest.wheels[k])).filter(Boolean);
const inWheel = (m) => wheelNodes.some((w) => w === m || isAncestor(w, m));
let bodyMeshes = allMeshes.filter((m) => !inWheel(m) && matsOf(m).some((mt) => role(mt.name) === 'paint') && !ACCESSORY.test(m.name));
let bodyBy = 'matériau peinture';
if (bodyMeshes.length === 0) {
  bodyMeshes = allMeshes.filter((m) => !inWheel(m) && !ACCESSORY.test(m.name) && !matsOf(m).some((mt) => ['glass', 'tyre', 'rim', 'chrome'].includes(role(mt.name))));
  bodyBy = 'exclusion des accessoires par nom';
}
const all = new THREE.Box3().setFromObject(scene);
const allSize = all.getSize(new THREE.Vector3());
const body = boxOfMeshes(bodyMeshes);
const bodySize = body.isEmpty() ? new THREE.Vector3() : body.getSize(new THREE.Vector3());
// hauteur mesurée depuis le sol (bas des pneus), pas depuis le bas de caisse
const bodyHeight = body.isEmpty() ? 0 : body.max.y - Math.min(all.min.y, body.min.y);
const pct = (v, ref) => `${((v / ref - 1) * 100).toFixed(1)} %`;

check('Dimensions', 'info', 'Encombrement hors tout (accessoires compris)', true, `X ${f3(allSize.x)} · Y ${f3(allSize.y)} · Z ${f3(allSize.z)} m`);
check('Dimensions', 'info', 'Carrosserie mesurée', bodyMeshes.length > 0, `${bodyMeshes.length} maillage(s), identifiés par ${bodyBy} (rétroviseurs, échappement, becquet, antenne, plaques, lame, diffuseur, roues, vitres et feux exclus)`);
// F21 : hauteur (1,42) < largeur (1,765) < longueur (4,324) → Y doit être la plus petite dimension
check('Dimensions', 'bloquant', 'Axe vertical = Y (glTF)', bodySize.y > 0 && bodySize.y < bodySize.z && bodySize.z < bodySize.x,
  `carrosserie X ${f3(bodySize.x)} · Y ${f3(bodySize.y)} · Z ${f3(bodySize.z)} m${bodySize.z <= bodySize.y ? ' — Y plus grand que Z : modèle probablement en Z vers le haut (rotate_deg dans le mapping Blender)' : ''}`);
check('Dimensions', 'bloquant', 'Longueur de carrosserie ≈ 4,324 m (±3 %)', Math.abs(bodySize.x - F21.L) / F21.L <= 0.03, `${f3(bodySize.x)} m (${pct(bodySize.x, F21.L)}) — l'avant doit être vers +X`);
check('Dimensions', 'important', 'Largeur hors rétroviseurs ≈ 1,765 m (±3 %)', Math.abs(bodySize.z - F21.W) / F21.W <= 0.03, `${f3(bodySize.z)} m (${pct(bodySize.z, F21.W)}) ; avec rétroviseurs : ${f3(allSize.z)} m`);
check('Dimensions', 'important', 'Hauteur ≈ 1,42 m (±5 %, depuis le sol, sans antenne)', Math.abs(bodyHeight - F21.H) / F21.H <= 0.05, `${f3(bodyHeight)} m (${pct(bodyHeight, F21.H)})`);
check('Dimensions', 'important', 'Véhicule posé au sol (Y min ≈ 0)', Math.abs(all.min.y) < 0.03, `Y min = ${f3(all.min.y)} m`);
check('Dimensions', 'important', 'Centré latéralement (Z ≈ 0)', Math.abs((body.min.z + body.max.z) / 2) < 0.03, `centre Z = ${f3((body.min.z + body.max.z) / 2)} m`);
const heads = (manifest.lights.headlights ?? []).map(byName).filter(Boolean);
if (heads.length) {
  const hx = boxOfMeshes(heads.flatMap(meshesOf)).getCenter(new THREE.Vector3()).x;
  check('Dimensions', 'bloquant', 'Avant du véhicule vers +X (projecteurs à l’avant)', hx > 0.5, `projecteurs à X = ${f3(hx)} m`);
}
check('Dimensions', 'info', 'Dépassement des accessoires', true, `longueur hors tout − carrosserie : ${f3(allSize.x - bodySize.x)} m (échappement, lame, diffuseur…)`);

// ===================================================================== 3. ouvrants
const OPEN_LABEL = { driverDoor: 'Portière conducteur', passengerDoor: 'Portière passager', hood: 'Capot', tailgate: 'Hayon' };
const EXPECTED_AXIS = { driverDoor: 'y', passengerDoor: 'y', hood: 'z', tailgate: 'z' };
const opening = {};
for (const [key, spec] of Object.entries(manifest.openings)) {
  const label = `${OPEN_LABEL[key] ?? key} « ${spec.node} »`;
  const o = byName(spec.node);
  if (!o) { check('Ouvrants', 'bloquant', `${label} : nœud présent`, false, 'nœud absent du fichier'); continue; }
  const ms = meshesOf(o);
  opening[key] = { o, ms };
  check('Ouvrants', 'bloquant', `${label} : élément séparé`, ms.length > 0, `${ms.length} maillage(s), ${fmt(ms.reduce((n, m) => n + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3, 0))} triangles`);
  if (!ms.length) continue;
  const own = ms.filter((m) => !/mirror|retro|rétro|handle|poign|glass|window|vitre|spoiler|becquet|light|feu/i.test(m.name));
  const b = boxOfMeshes(own.length ? own : ms);
  const bAll = boxOfMeshes(ms);
  const p = worldPos(o);
  const sz = b.getSize(new THREE.Vector3());
  let ok = false, how = '';
  if (key === 'driverDoor' || key === 'passengerDoor') {
    const side = key === 'driverDoor' ? -1 : 1;
    const outer = side < 0 ? b.min.z : b.max.z;
    const sideOk = Math.sign((bAll.min.z + bAll.max.z) / 2) === side;
    ok = sideOk && Math.abs(p.x - b.max.x) < 0.15 && Math.abs(p.z - outer) < 0.12 && p.y > b.min.y - 0.05 && p.y < b.max.y + 0.05;
    how = `pivot (x ${f3(p.x)}, y ${f3(p.y)}, z ${f3(p.z)}) ; attendu au bord avant extérieur (x ${f3(b.max.x)}, z ${f3(outer)}), hauteur dans la portière ; côté ${side < 0 ? 'gauche −Z' : 'droit +Z'}${sideOk ? '' : ' — MAUVAIS CÔTÉ'}`;
    check('Ouvrants', 'important', `${label} : longueur plausible (porte longue de 3 portes)`, sz.x >= 1.1 && sz.x <= 1.6, `${f3(sz.x)} m (attendu 1,1 à 1,6 m)`);
  } else if (key === 'hood') {
    ok = Math.abs(p.x - b.min.x) < 0.15 && p.y > b.max.y - 0.25 && Math.abs(p.z) < 0.1;
    how = `pivot (x ${f3(p.x)}, y ${f3(p.y)}, z ${f3(p.z)}) ; attendu au bord arrière (x ${f3(b.min.x)}), en haut, centré`;
    check('Ouvrants', 'important', `${label} : dimensions plausibles`, sz.x >= 0.7 && sz.x <= 1.5 && sz.z >= 1.0, `${f3(sz.x)} × ${f3(sz.z)} m`);
  } else {
    ok = Math.abs(p.x - bAll.max.x) < 0.2 && p.y > bAll.max.y - 0.2 && Math.abs(p.z) < 0.1;
    how = `pivot (x ${f3(p.x)}, y ${f3(p.y)}, z ${f3(p.z)}) ; attendu au bord avant (x ${f3(bAll.max.x)}), en haut, centré (lunette et becquet inclus)`;
    check('Ouvrants', 'important', `${label} : dimensions plausibles`, sz.z >= 0.9 && sz.z <= 1.45, `largeur ${f3(sz.z)} m`);
  }
  check('Ouvrants', 'bloquant', `${label} : charnière (pivot) bien placée`, ok, how);
  if (spec.axis) check('Ouvrants', 'important', `${label} : axe de rotation du manifeste`, spec.axis === EXPECTED_AXIS[key], `axe « ${spec.axis} » (attendu « ${EXPECTED_AXIS[key]} »), angle ${spec.angle ?? '?'} rad`);
}
// indépendance : aucun ouvrant contenu dans un autre ni dans une roue ; la caisse reste non vide
const keys = Object.keys(opening);
for (let i = 0; i < keys.length; i++) for (let j = 0; j < keys.length; j++) {
  if (i === j) continue;
  const a = opening[keys[i]].o, b = opening[keys[j]].o;
  if (a === b || isAncestor(a, b)) check('Ouvrants', 'bloquant', `Indépendance ${OPEN_LABEL[keys[i]]} / ${OPEN_LABEL[keys[j]]}`, false, `« ${b.name} » est contenu dans « ${a.name} » : il tournerait avec lui`);
}
if (keys.length === 4) {
  const nested = keys.some((k) => keys.some((l) => k !== l && (opening[k].o === opening[l].o || isAncestor(opening[k].o, opening[l].o))));
  if (!nested) check('Ouvrants', 'bloquant', 'Ouvrants indépendants entre eux', true, 'aucun ouvrant n’est contenu dans un autre');
  const openingMeshes = new Set(keys.flatMap((k) => opening[k].ms));
  const wheelInOpening = wheelNodes.some((w) => keys.some((k) => isAncestor(opening[k].o, w)));
  check('Ouvrants', 'bloquant', 'Aucune roue rattachée à un ouvrant', !wheelInOpening, wheelInOpening ? 'une roue tournerait avec un ouvrant' : 'roues indépendantes');
  const rest = allMeshes.filter((m) => !openingMeshes.has(m) && !inWheel(m));
  check('Ouvrants', 'bloquant', 'Caisse fixe non vide après séparation', rest.length > 0, `${rest.length} maillage(s) fixes`);
}
check('Ouvrants', 'info', 'Collisions à l’ouverture', true, 'non simulées : à contrôler visuellement (checklist ci-dessous)');

// ===================================================================== 4. roues
const W = manifest.wheels;
const wheel = {};
for (const k of ['fl', 'fr', 'rl', 'rr']) {
  const o = byName(W[k]);
  if (!o) { check('Roues', 'bloquant', `Roue « ${W[k]} » présente`, false, 'nœud absent'); continue; }
  const ms = meshesOf(o);
  const b = boxOfMeshes(ms);
  const c = worldPos(o);
  const d = Math.max(b.max.y - b.min.y, b.max.x - b.min.x);
  wheel[k] = { o, c, b, d };
  check('Roues', 'bloquant', `Roue « ${W[k]} » : pièces regroupées`, ms.length > 0, `${ms.length} maillage(s) (pneu, jante, centre…) tournent ensemble`);
  const centered = Math.abs(c.y - (b.min.y + b.max.y) / 2) < 0.02 && Math.abs(c.x - (b.min.x + b.max.x) / 2) < 0.02;
  check('Roues', 'bloquant', `Roue « ${W[k]} » : pivot au centre du moyeu`, centered, `pivot (${f3(c.x)}, ${f3(c.y)}, ${f3(c.z)}) ; centre géométrique (${f3((b.min.x + b.max.x) / 2)}, ${f3((b.min.y + b.max.y) / 2)})`);
  check('Roues', 'important', `Roue « ${W[k]} » : diamètre plausible`, d >= F21.wheelDiameter[0] && d <= F21.wheelDiameter[1], `${f3(d)} m (225/40 R18 ≈ 0,637 m)`);
  check('Roues', 'important', `Roue « ${W[k]} » : moyeu à hauteur du rayon (roue au sol)`, Math.abs(c.y - d / 2) < 0.03, `moyeu à ${f3(c.y)} m pour un rayon de ${f3(d / 2)} m`);
}
const { fl, fr, rl, rr } = wheel;
if (fl && fr && rl && rr) {
  check('Roues', 'bloquant', 'Côtés des roues (gauche = −Z)', fl.c.z < 0 && rl.c.z < 0 && fr.c.z > 0 && rr.c.z > 0, `fl ${f3(fl.c.z)}, rl ${f3(rl.c.z)}, fr ${f3(fr.c.z)}, rr ${f3(rr.c.z)}`);
  check('Roues', 'bloquant', 'Roues avant devant les roues arrière', fl.c.x > rl.c.x && fr.c.x > rr.c.x, `avant X ${f3(fl.c.x)}, arrière X ${f3(rl.c.x)}`);
  check('Roues', 'important', 'Essieu avant aligné', Math.abs(fl.c.x - fr.c.x) < 0.01 && Math.abs(fl.c.y - fr.c.y) < 0.01, `ΔX ${f3(fl.c.x - fr.c.x)} m, ΔY ${f3(fl.c.y - fr.c.y)} m`);
  check('Roues', 'important', 'Essieu arrière aligné', Math.abs(rl.c.x - rr.c.x) < 0.01 && Math.abs(rl.c.y - rr.c.y) < 0.01, `ΔX ${f3(rl.c.x - rr.c.x)} m, ΔY ${f3(rl.c.y - rr.c.y)} m`);
  check('Roues', 'important', 'Symétrie gauche/droite', Math.abs(fl.c.z + fr.c.z) < 0.02 && Math.abs(rl.c.z + rr.c.z) < 0.02, `avant ${f3(fl.c.z + fr.c.z)} m, arrière ${f3(rl.c.z + rr.c.z)} m`);
  const wb = (fl.c.x + fr.c.x) / 2 - (rl.c.x + rr.c.x) / 2;
  check('Roues', 'important', 'Empattement ≈ 2,690 m (±1 %)', Math.abs(wb - F21.wheelbase) / F21.wheelbase <= 0.01, `${f3(wb)} m (${pct(wb, F21.wheelbase)})`);
  const tf = fr.c.z - fl.c.z, tr = rr.c.z - rl.c.z;
  check('Roues', 'important', 'Voie avant plausible', tf >= F21.trackFront[0] && tf <= F21.trackFront[1], `${f3(tf)} m (≈ 1,53 m)`);
  check('Roues', 'important', 'Voie arrière plausible', tr >= F21.trackRear[0] && tr <= F21.trackRear[1], `${f3(tr)} m (≈ 1,57 m)`);
  if (!body.isEmpty()) {
    const out = Math.max(Math.abs(fl.b.min.z), Math.abs(fr.b.max.z), Math.abs(rl.b.min.z), Math.abs(rr.b.max.z)) - Math.max(Math.abs(body.min.z), Math.abs(body.max.z));
    check('Roues', 'important', 'Pneus dans le gabarit de la carrosserie', out < 0.015, out < 0.015 ? 'aucun dépassement' : `les pneus dépassent de ${f3(out)} m`);
  }
}
for (const [k, wk] of [['steerFl', 'fl'], ['steerFr', 'fr']]) {
  const s = byName(W[k]);
  const w = wheel[wk];
  if (!s) { check('Roues', 'important', `Pivot de braquage « ${W[k]} »`, false, 'absent : braquage visuel indisponible'); continue; }
  const contains = w && isAncestor(s, w.o);
  const near = w && worldPos(s).distanceTo(w.c) < 0.05;
  check('Roues', 'important', `Pivot de braquage « ${W[k]} »`, contains && near, `${contains ? 'contient' : 'NE contient PAS'} la roue ; écart au moyeu ${w ? f3(worldPos(s).distanceTo(w.c)) : '?'} m`);
}
for (const k of ['rl', 'rr']) {
  const w = wheel[k];
  const steered = w && [W.steerFl, W.steerFr].map(byName).some((s) => s && isAncestor(s, w.o));
  if (w) check('Roues', 'bloquant', `Roue arrière « ${W[k]} » non directrice`, !steered, steered ? 'rattachée à un pivot de braquage' : 'fixe en braquage');
}

// ===================================================================== 5. matériaux et éclairage
const matByName = new Map();
allMeshes.forEach((m) => matsOf(m).forEach((mt) => matByName.set(mt.name || '(sans nom)', mt)));
const roles = {};
for (const [name, r] of Object.entries(manifest.materials ?? {})) {
  const mt = matByName.get(name);
  (roles[r] ??= []).push({ name, mt });
}
const ROLE_LABEL = { paint: 'Peinture', glass: 'Vitres', gloss: 'Noir brillant', trim: 'Plastique noir mat', rim: 'Jantes', tyre: 'Pneus', chrome: 'Chromes' };
const present = (r) => (roles[r] ?? []).filter((x) => x.mt);
for (const [r, level] of [['paint', 'important'], ['glass', 'important'], ['rim', 'important'], ['tyre', 'important']]) {
  const p = present(r);
  check('Matériaux', level, `${ROLE_LABEL[r]} : matériau nommé présent`, p.length > 0,
    p.length ? p.map((x) => x.name).join(', ') : `aucun des matériaux ${(roles[r] ?? []).map((x) => `« ${x.name} »`).join(', ') || '(rôle absent du manifeste)'} — matériaux du fichier : ${[...matByName.keys()].slice(0, 10).join(', ') || 'aucun'}`);
}
const blacks = [...present('gloss'), ...present('trim')];
check('Matériaux', 'important', 'Plastiques noirs (brillant et/ou mat) : matériau nommé présent', blacks.length > 0, blacks.map((x) => x.name).join(', ') || 'absents : calandre, rétroviseurs, becquet et diffuseur ne seront pas différenciés');
const lum = (c) => (c ? 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b : 1);
for (const { name, mt } of present('glass')) check('Matériaux', 'info', `Vitres « ${name} » : transparence`, mt.transparent || mt.opacity < 1 || (mt.transmission ?? 0) > 0, 'l’application remplace le matériau par ses vitres teintées');
for (const { name, mt } of present('rim')) check('Matériaux', 'info', `Jantes « ${name} » : aspect métallique`, (mt.metalness ?? 0) >= 0.3, `metalness ${f3(mt.metalness ?? 0)} — remplacé par l'anthracite de l'application`);
for (const { name, mt } of present('tyre')) check('Matériaux', 'info', `Pneus « ${name} » : teinte sombre`, lum(mt.color) < 0.2, `luminance ${f3(lum(mt.color))}`);
const unnamed = allMeshes.filter((m) => matsOf(m).some((mt) => !mt.name)).length;
check('Matériaux', 'important', 'Maillages avec un matériau nommé', unnamed === 0, unnamed ? `${unnamed} maillage(s) sans nom de matériau (non personnalisables)` : 'tous nommés');

const L = manifest.lights;
const lightGroups = [
  ['headlights', 'Projecteurs (phares blancs / violets simulés)', 'important'],
  ['tail', 'Feux arrière', 'important'],
  ['brake', 'Feux stop', 'info'],
  ['blinkLeft', 'Clignotants gauches', 'info'],
  ['blinkRight', 'Clignotants droits', 'info'],
];
for (const [k, label, level] of lightGroups) {
  const names = L[k] ?? [];
  if (!names.length) { check('Éclairage', 'info', `${label}`, true, 'aucune pièce déclarée dans le manifeste'); continue; }
  const found = names.filter((n) => byName(n) && meshesOf(byName(n)).length);
  check('Éclairage', level, `${label} : pièces lumineuses présentes`, found.length === names.length, `${found.length}/${names.length} : ${names.map((n) => (found.includes(n) ? n : `${n} (absent)`)).join(', ')}`);
}

// ===================================================================== 6. performances
const prims = allMeshes.length; // un maillage Three.js = une primitive glTF = un appel de rendu
const texMem = textures.reduce((s, t) => s + (t.w * t.h * 4 * 4) / 3, 0); // RGBA + mipmaps
const maxTex = textures.reduce((m, t) => Math.max(m, t.w, t.h), 0);
const level3 = (v, a, b) => (v <= a ? 0 : v <= b ? 1 : 2);
const score = Math.max(level3(geo.tris, 300000, 600000), level3(prims, 150, 300), level3(texMem / 1048576, 128, 256), level3(maxTex, 2048, 4096));
const COMPLEXITY = ['faible — adaptée à la plupart des autoradios', 'modérée — qualité « Standard », à vérifier sur l’appareil', 'élevée — décimer / réduire les textures avant Android'];
check('Performances', 'important', 'Triangles (budget autoradio ≤ 600 000)', geo.tris <= 600000, `${fmt(geo.tris)} (idéal ≤ 300 000 ; prepare_f21_model.py › triangle_budget)`);
check('Performances', 'important', 'Appels de rendu (≤ 300)', prims <= 300, `${prims} maillages (idéal ≤ 150 ; fusionner par matériau)`);
check('Performances', 'info', 'Matériaux distincts', matByName.size <= 64, `${matByName.size}`);
check('Performances', 'important', 'Mémoire textures estimée (≤ 256 Mo)', texMem / 1048576 <= 256, `${textures.length} image(s), ${(texMem / 1048576).toFixed(1)} Mo décompressées (mipmaps compris)`);
check('Performances', 'important', 'Taille maximale des textures (≤ 4096 px)', maxTex <= 4096, maxTex ? `${maxTex} px (2048 conseillé)` : 'aucune texture');
const unknownTex = textures.filter((t) => !t.w).map((t) => t.name);
if (unknownTex.length) check('Performances', 'info', 'Textures non mesurées', false, unknownTex.slice(0, 6).join(', '));
check('Performances', 'info', 'Complexité indicative Android', score < 2, COMPLEXITY[score]);

// ===================================================================== validation humaine (jamais automatique)
const v = manifest.validation ?? {};
const missingHuman = Object.entries(HUMAN_CRITERIA).filter(([k]) => v[k] !== true).map(([, l]) => l);
if (v.approved !== true) missingHuman.push('Approbation finale');

// ===================================================================== rapport Markdown
const blockers = results.filter((r) => r.level === 'bloquant' && !r.ok);
const warnings = results.filter((r) => r.level === 'important' && !r.ok);
const passed = results.filter((r) => r.ok && r.level !== 'info');
const icon = (r) => (r.ok ? '✅' : r.level === 'bloquant' ? '❌' : r.level === 'important' ? '⚠️' : 'ℹ️');
const row = (r) => `| ${icon(r)} | ${r.name} | ${r.level} | ${String(r.detail).replace(/\|/g, '/')} |`;
const verdict = blockers.length ? 'REFUSÉ techniquement' : warnings.length ? 'ACCEPTÉ techniquement, avec avertissements' : 'ACCEPTÉ techniquement';

const md = [
  `# Validation technique — ${basename(glbPath)}`,
  '',
  `Date : ${new Date().toISOString().slice(0, 10)} · manifeste : ${manifestPath ? basename(manifestPath) : 'valeurs par défaut'}`,
  '',
  `## Résultat : **${verdict}**`,
  '',
  `- ❌ ${blockers.length} erreur(s) bloquante(s)`,
  `- ⚠️ ${warnings.length} avertissement(s)`,
  `- ✅ ${passed.length} contrôle(s) réussi(s)`,
  '',
  '> Ce résultat porte **uniquement sur la conformité technique**. Il ne dit **pas** que le modèle est',
  '> fidèle à la BMW 116i F21 LCI du propriétaire ni que sa licence autorise la distribution : ces points',
  '> exigent la validation humaine ci-dessous, enregistrée dans le manifeste et vérifiée par l’application.',
  '',
  ...(blockers.length ? ['## Erreurs bloquantes', '', ...blockers.map((r) => `- **${r.cat} — ${r.name}** : ${r.detail}`), ''] : []),
  ...(warnings.length ? ['## Avertissements', '', ...warnings.map((r) => `- **${r.cat} — ${r.name}** : ${r.detail}`), ''] : []),
  '## Détail des contrôles',
  '',
  ...CATEGORIES.flatMap((cat) => {
    const rs = results.filter((r) => r.cat === cat);
    return rs.length ? [`### ${cat}`, '', '| | Contrôle | Niveau | Détail |', '|---|---|---|---|', ...rs.map(row), ''] : [];
  }),
  '## Validation humaine (manifeste)',
  '',
  missingHuman.length
    ? `Statut : **non approuvé** — critères manquants : ${missingHuman.join(', ')}. L’application continuera d’afficher RealisticF21.`
    : `Statut déclaré dans le manifeste : approuvé${v.approvedBy ? ` par ${v.approvedBy}` : ''}${v.date ? ` le ${v.date}` : ''}${v.licenceReference ? ` (licence : ${v.licenceReference})` : ''}. **Déclaration humaine, non vérifiable par ce validateur.**`,
  '',
  '| Critère | Déclaré |',
  '|---|---|',
  ...Object.entries(HUMAN_CRITERIA).map(([k, l]) => `| ${l} | ${v[k] === true ? 'oui' : 'non'} |`),
  `| Approbation finale | ${v.approved === true ? 'oui' : 'non'} |`,
  '',
  '## Checklist de validation visuelle (à cocher par une personne)',
  '',
  'Vues : `?ortho=front|side|right|rear` (1 m = 300 px) et caméras 3/4 avant, 3/4 arrière, comparées aux photos du véhicule.',
  '',
  '- [ ] Silhouette trois portes F21 : longueur du capot, portière longue, ligne de toit, custode avec coup de crosse',
  '- [ ] Face avant LCI : haricots élargis noir brillant + badge M, projecteurs à double « U » LED',
  '- [ ] Feux arrière LCI en L à LED',
  '- [ ] Pack M Sport : boucliers avant/arrière, prises d’air, bas de caisse',
  '- [ ] Lame avant noire, anneau de remorquage rouge (côté droit)',
  '- [ ] Becquet de toit noir brillant, diffuseur noir avec feu central rouge, sortie simple à gauche',
  '- [ ] Jantes 5 doubles branches anthracite, position et taille des roues, voies',
  '- [ ] Rétroviseurs noir brillant, vitres arrière et lunette teintées, bandeau M Performance',
  '- [ ] Peinture blanche brillante : reflets continus, pas de facettes visibles',
  '- [ ] Jours d’ouvrants réguliers, sans trou ni recouvrement, portes fermées',
  '- [ ] **Collisions (non simulées par ce validateur)** : portières ouvertes sans traverser les ailes ni le bas de caisse ; capot ouvert sans traverser le pare-brise ; hayon ouvert sans traverser le pavillon ni le becquet',
  '- [ ] Portières : vitre, poignée et rétroviseur suivent l’ouverture ; hayon : lunette, becquet et feux du hayon suivent',
  '- [ ] Roues : aucune pièce de jante immobile pendant la rotation ; seules les roues avant braquent',
  '- [ ] Phares blancs puis violets, clignotants, détresse et feux stop visibles aux bons endroits',
  '- [ ] Fluidité sur l’autoradio cible (Réglages › Diagnostic : FPS) en qualité choisie',
  '- [ ] Licence lue et compatible avec une application Android distribuée (référence notée dans le manifeste)',
  '',
].join('\n');

console.log(md);
if (reportPath) writeFileSync(reportPath, md + '\n');
process.exit(blockers.length ? 1 : 0);
