import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Conversion du GLB maquette (trimesh, Z vers le haut) vers le repère de l'application,
 * normales recalculées, rôles matériaux par nom, roues regroupées sur pivots, fusion par matériau.
 */
export type Role =
  | 'paint' | 'seam' | 'glassFront' | 'glassRear' | 'gloss' | 'mesh' | 'tyre' | 'rimInner' | 'rim' | 'hub'
  | 'headLens' | 'drl' | 'fog' | 'tail' | 'brake' | 'chrome' | 'plate';

/** Rôle matériau d'après le nom du nœud GLB. */
/** GLTFLoader remplace les espaces des noms de nœuds par « _ » : on normalise. */
export const normName = (name: string) => name.toLowerCase().replace(/_/g, ' ');

export function roleOf(name: string): Role {
  const n = normName(name);
  if (/body shell|roof upper|side skirt|door handle|sharkfin|shoulder crease/.test(n)) return 'paint';
  if (/door cut/.test(n)) return 'seam';
  if (/front windshield|front side window/.test(n)) return 'glassFront';
  if (/rear quarter window|rear windshield/.test(n)) return 'glassRear';
  if (/tire/.test(n)) return 'tyre';
  if (/inner face/.test(n)) return 'rimInner';
  if (/spoke/.test(n)) return 'rim';
  if (/roundel/.test(n)) return 'hub';
  if (/headlight led ring/.test(n)) return 'drl';
  if (/led headlight/.test(n)) return 'headLens';
  if (/fog light/.test(n)) return 'fog';
  if (/inner rear taillight/.test(n)) return 'brake';
  if (/tail light/.test(n)) return 'tail';
  if (/exhaust/.test(n)) return 'chrome';
  if (/plate/.test(n)) return 'plate';
  if (/intake|lower black mesh/.test(n)) return 'mesh';
  return 'gloss'; // B pillar, mirror, kidney grille/bars, splitter, diffuser, fins, spoiler
}

const WHEEL_ROLES: Role[] = ['tyre', 'rimInner', 'rim', 'hub'];
const SWAP_YZ = new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1);

export interface Baked {
  body: { role: Role; geo: THREE.BufferGeometry }[];
  wheels: { key: string; front: boolean; side: 1 | -1; center: THREE.Vector3; parts: { role: Role; geo: THREE.BufferGeometry }[] }[];
  boxes: Record<string, THREE.Box3>;
  stats: { meshes: number; triangles: number; drawCalls: number };
}

/** Convertit, recalcule les normales (angle de pli 35°) et fusionne par matériau. */
export function bake(scene: THREE.Object3D): Baked {
  scene.updateMatrixWorld(true);
  const byRole = new Map<Role, THREE.BufferGeometry[]>();
  const wheelParts = new Map<string, Map<Role, THREE.BufferGeometry[]>>();
  const wheelBoxes = new Map<string, THREE.Box3>();
  const boxes: Record<string, THREE.Box3> = {};
  let meshes = 0;
  let triangles = 0;
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshes++;
    let g = mesh.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(SWAP_YZ, mesh.matrixWorld));
    // la permutation y/z inverse l'orientation des faces : on rétablit l'ordre des sommets
    g = g.index ? g.toNonIndexed() : g;
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i += 3) {
      const x = p.getX(i + 1), y = p.getY(i + 1), z = p.getZ(i + 1);
      p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2));
      p.setXYZ(i + 2, x, y, z);
    }
    triangles += p.count / 3;
    const role = roleOf(mesh.name);
    g = toCreasedNormals(g, role === 'tyre' || role === 'drl' || role === 'hub' ? Math.PI / 2.2 : (35 * Math.PI) / 180);
    g.computeBoundingBox();
    const name = normName(mesh.name);
    boxes[name] = g.boundingBox!.clone();
    if (WHEEL_ROLES.includes(role)) {
      const c = g.boundingBox!.getCenter(new THREE.Vector3());
      const key = `${c.x > 0 ? 'front' : 'rear'}${c.z < 0 ? 'L' : 'R'}`;
      if (!wheelParts.has(key)) wheelParts.set(key, new Map());
      const m = wheelParts.get(key)!;
      m.set(role, [...(m.get(role) ?? []), g]);
      if (role === 'tyre') wheelBoxes.set(key, g.boundingBox!.clone());
    } else {
      byRole.set(role, [...(byRole.get(role) ?? []), g]);
    }
  });
  const body = [...byRole.entries()].map(([role, list]) => ({ role, geo: mergeGeometries(list)! }));
  const wheels = [...wheelParts.entries()].map(([key, parts]) => {
    const center = (wheelBoxes.get(key) ?? new THREE.Box3()).getCenter(new THREE.Vector3());
    return {
      key,
      front: key.startsWith('front'),
      side: (key.endsWith('L') ? -1 : 1) as 1 | -1,
      center,
      parts: [...parts.entries()].map(([role, list]) => {
        const geo = mergeGeometries(list)!;
        geo.translate(-center.x, -center.y, -center.z); // pivot au centre du moyeu
        return { role, geo };
      }),
    };
  });
  const drawCalls = body.length + wheels.reduce((n, w) => n + w.parts.length, 0);
  return { body, wheels, boxes, stats: { meshes, triangles, drawCalls } };
}

