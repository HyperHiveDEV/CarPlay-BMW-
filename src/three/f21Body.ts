import * as THREE from 'three';
import {
  TOP, BOTTOM, BELT, CHARACTER, SWAGE, DOOR, WHEELS, HINGES, X_FRONT, X_REAR, pxY,
} from './f21Blueprint';

/**
 * Carrosserie F21 générée par « lofting » : une section transversale lissée (Catmull-Rom)
 * est calculée en chaque station X à partir des lignes relevées sur la photo de profil,
 * puis les stations sont reliées en une surface continue. Les ouvrants sont découpés
 * sur leurs contours réels et deviennent des pièces séparées articulées.
 */

// ---------------------------------------------------------------- utilitaires
const clamp = THREE.MathUtils.clamp;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = THREE.MathUtils.lerp;

/** Fonction y(x) lissée à partir d'une polyligne relevée. */
function lookup(points: [number, number][]) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal');
  const s = curve.getPoints(points.length * 24).map((p) => [p.x, p.y] as [number, number]).sort((a, b) => a[0] - b[0]);
  return (x: number) => {
    if (x <= s[0][0]) return s[0][1];
    if (x >= s[s.length - 1][0]) return s[s.length - 1][1];
    let lo = 0;
    let hi = s.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (s[m][0] < x) lo = m;
      else hi = m;
    }
    const t = (x - s[lo][0]) / (s[hi][0] - s[lo][0] || 1);
    return s[lo][1] + (s[hi][1] - s[lo][1]) * t;
  };
}

function inPoly(poly: [number, number][], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export const yTop = lookup(TOP);
export const yBottom = lookup(BOTTOM);
const yBeltRaw = lookup(BELT);
const yChar = lookup(CHARACTER);
const ySwage = lookup(SWAGE);

/** Demi-largeur en plan (1 765 mm hors rétros), nez et poupe arrondis en super-ellipse. */
export function halfWidth(x: number) {
  let w = 0.872 + 0.0105 * smooth(0.2, -1.0, x);
  const Lf = 0.44;
  if (x > X_FRONT - Lf) {
    const t = clamp((x - (X_FRONT - Lf)) / Lf, 0, 1);
    w *= Math.pow(Math.max(0, 1 - Math.pow(t, 3.2)), 1 / 3.2);
  }
  const Lr = 0.36;
  if (x < X_REAR + Lr) {
    const t = clamp((X_REAR + Lr - x) / Lr, 0, 1);
    w *= Math.pow(Math.max(0, 1 - Math.pow(t, 2.8)), 1 / 2.8);
  }
  return w;
}
export const yShoulder = (x: number) => Math.min(yBeltRaw(x), yTop(x) - 0.03);
/** 0 = capot / malle, 1 = habitacle (pavillon). */
const cabin = (x: number) => smooth(0.07, 0.26, yTop(x) - yBeltRaw(x));

/** Section transversale (moitié droite, z ≥ 0) : points de contrôle (z, y). */
function sectionControls(x: number): [number, number][] {
  const w = halfWidth(x);
  const yb = yBottom(x);
  const yt = yTop(x);
  const ys = Math.max(yb + 0.002, yShoulder(x));
  const h = Math.max(0.001, ys - yb);
  const d = Math.max(0.001, yt - ys);
  const c = cabin(x);
  const sw = clamp(ySwage(x), yb + 0.3 * h, yb + 0.55 * h);
  const hc = clamp(yChar(x), yb + 0.62 * h, yb + 0.86 * h);
  const lower: [number, number][] = [
    [0, yb],
    [0.8 * w, yb],
    [0.962 * w, yb + Math.min(0.045, 0.08 * h)],
    [0.99 * w, yb + Math.min(0.12, 0.22 * h)],
    [0.977 * w, sw],
    [w, hc - Math.min(0.014, 0.03 * h)],
    [0.984 * w, Math.min(hc + 0.014, yb + 0.93 * h)],
    [0.935 * w, ys],
  ];
  const gw = Math.min(0.75, 0.86 * w);
  const rw = Math.min(0.6, 0.7 * w);
  const hood: [number, number][] = [
    [0.8 * w, ys + 0.45 * d],
    [0.55 * w, ys + 0.86 * d],
    [0.27 * w, yt - 0.002],
  ];
  const cab: [number, number][] = [
    [gw, ys + 0.022],
    [rw + 0.035, yt - 0.075],
    [rw * 0.62, yt - 0.013],
  ];
  const upper = hood.map(([z, y], i) => [lerp(z, cab[i][0], c), lerp(y, cab[i][1], c)] as [number, number]);
  return [...lower, ...upper, [0, yt]];
}

// ---------------------------------------------------------------- matériaux par zone
/** Identifiants de zones évalués par pixel dans zoneMaterial.ts */
export const ZONE = {
  paint: 0, glass: 1, gloss: 2, trim: 3, cavity: 4, headLens: 5, tail: 6, mesh: 7, reflector: 8, kidney: 9, seam: 10,
} as const;
export const PART = { body: 0, doorL: 1, doorR: 2, hood: 3, tailgate: 4 } as const;

export const HEAD_FRONT: [number, number][] = [
  [0.3, 0.655], [0.36, 0.615], [0.55, 0.594], [0.72, 0.584], [0.8, 0.6], [0.83, 0.7], [0.7, 0.716], [0.5, 0.703], [0.34, 0.68],
];
export const SIDE_INTAKE: [number, number][] = [[0.47, 0.265], [0.76, 0.3], [0.79, 0.47], [0.6, 0.475], [0.49, 0.43]];

const xCowl = HINGES.hood.x + 0.02;
const xRoofRear = HINGES.tailgate.x;
export const ZONE_LIMITS = { roofFront: 0.19, cowl: xCowl, roofRear: xRoofRear, hatchBottom: -2.1, doorBottom: pxY(570) };

/**
 * Pièce d'un point de surface (caisse ou ouvrant). La même règle est évaluée par pixel dans
 * zoneMaterial.ts : un triangle à cheval sur une frontière appartient aux deux pièces et le
 * shader élimine les pixels de l'autre pièce — les bords d'ouvrants sont ainsi nets.
 */
function classifyPart(x: number, y: number, z: number, nx: number, ny: number, nz: number): number {
  const az = Math.abs(z);
  const sideFacing = Math.abs(nz) > 0.45;
  if (sideFacing && inPoly(DOOR, x, y) && y > pxY(570)) return z < 0 ? PART.doorL : PART.doorR;
  if (x > xCowl && (ny > 0.42 || (nx > 0.25 && y > 0.69)) && az < halfWidth(x) * 0.87 && y > 0.66) return PART.hood;
  if (x < xRoofRear && az < 0.6 && y > 0.66 && !sideFacing && (nx < -0.25 || ny > 0.3)) return PART.tailgate;
  return PART.body;
}

// ---------------------------------------------------------------- construction
export interface PartGeometry {
  outer: THREE.BufferGeometry;
  inner: THREE.BufferGeometry | null;
  pivot: THREE.Vector3;
}
export interface F21BodyGeometry {
  parts: Record<keyof typeof PART, PartGeometry>;
  interior: THREE.BufferGeometry;
  /** surface complète (repère monde) pour le placement des accessoires par lancer de rayon */
  raycast: THREE.BufferGeometry;
  triangles: number;
}

export function buildF21Body(detail: 0 | 1 | 2): F21BodyGeometry {
  const S = [140, 200, 260][detail];
  const N = [88, 120, 150][detail];
  const pos = new Float32Array(S * N * 3);
  const archV = new Uint8Array(S * N);
  for (let i = 0; i < S; i++) {
    const s = i / (S - 1);
    // stations plus denses aux extrémités
    const x = X_REAR + (X_FRONT - X_REAR) * (0.5 - 0.5 * Math.cos(Math.PI * s));
    const half = sectionControls(x);
    const loop = [...half, ...half.slice(1, -1).reverse().map(([z, y]) => [-z, y] as [number, number])];
    const curve = new THREE.CatmullRomCurve3(loop.map(([z, y]) => new THREE.Vector3(z, y, 0)), true, 'centripetal');
    for (let j = 0; j < N; j++) {
      const p = curve.getPoint(j / N);
      let y = p.y;
      let vx = x;
      const z = p.x;
      // passages de roue : projection sur le cercle d'arche (moitié haute radiale, basse horizontale)
      [WHEELS.front, WHEELS.rear].forEach((wh, wi) => {
        if (Math.abs(z) <= 0.58) return;
        const dx = vx - wh.x;
        const dy = y - WHEELS.radius;
        const d = Math.hypot(dx, dy);
        if (d >= wh.archR) return;
        if (dy >= 0) {
          const k = wh.archR / Math.max(d, 1e-4);
          vx = wh.x + dx * k;
          y = WHEELS.radius + dy * k;
          archV[i * N + j] = 1;
        } else {
          vx = wh.x + Math.sign(dx || 1) * Math.sqrt(wh.archR * wh.archR - dy * dy);
          archV[i * N + j] = (dx >= 0 ? 2 : 3) + wi * 2;
        }
      });
      const k = (i * N + j) * 3;
      pos[k] = vx;
      pos[k + 1] = y;
      pos[k + 2] = z;
    }
  }
  const idx: number[] = [];
  // un triangle « à cheval » sur la roue (sommets projetés de part et d'autre) est supprimé
  const torn = (a: number, b: number, c: number) => {
    const s1 = [archV[a], archV[b], archV[c]].filter((v) => v >= 2);
    return s1.some((v) => s1.some((u) => u !== v && Math.floor((u - 2) / 2) === Math.floor((v - 2) / 2)));
  };
  for (let i = 0; i < S - 1; i++)
    for (let j = 0; j < N; j++) {
      const a = i * N + j;
      const b = i * N + ((j + 1) % N);
      const c = (i + 1) * N + j;
      const d = (i + 1) * N + ((j + 1) % N);
      if (!torn(a, c, b)) idx.push(a, c, b);
      if (!torn(b, c, d)) idx.push(b, c, d);
    }
  const full = new THREE.BufferGeometry();
  full.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  full.setIndex(idx);
  full.computeVertexNormals();
  const nrm = full.attributes.normal.array as Float32Array;

  // appartenance par sommet, puis masque de pièces par triangle
  const T = idx.length / 3;
  const vPart = new Uint8Array(S * N);
  for (let v = 0; v < S * N; v++) {
    vPart[v] = classifyPart(pos[3 * v], pos[3 * v + 1], pos[3 * v + 2], nrm[3 * v], nrm[3 * v + 1], nrm[3 * v + 2]);
  }
  const triMask = new Uint8Array(T);
  for (let t = 0; t < T; t++) for (let k = 0; k < 3; k++) triMask[t] |= 1 << vPart[idx[3 * t + k]];

  const pivots: Record<keyof typeof PART, THREE.Vector3> = {
    body: new THREE.Vector3(),
    doorL: new THREE.Vector3(HINGES.door, 0, -halfWidth(HINGES.door) - 0.005),
    doorR: new THREE.Vector3(HINGES.door, 0, halfWidth(HINGES.door) + 0.005),
    hood: new THREE.Vector3(HINGES.hood.x, HINGES.hood.y, 0),
    tailgate: new THREE.Vector3(HINGES.tailgate.x, HINGES.tailgate.y, 0),
  };


  const makePart = (partId: number, key: keyof typeof PART): PartGeometry => {
    const pivot = pivots[key];
    const tris: number[] = [];
    for (let t = 0; t < T; t++) if (triMask[t] & (1 << partId)) tris.push(t);
    const map = new Map<number, number>();
    const P: number[] = [];
    const Nn: number[] = [];
    const I: number[] = [];
    const vid = (v: number) => {
      let n = map.get(v);
      if (n === undefined) {
        n = P.length / 3;
        map.set(v, n);
        P.push(pos[3 * v] - pivot.x, pos[3 * v + 1] - pivot.y, pos[3 * v + 2] - pivot.z);
        Nn.push(nrm[3 * v], nrm[3 * v + 1], nrm[3 * v + 2]);
      }
      return n;
    };
    const outer = new THREE.BufferGeometry();
    tris.forEach((t) => I.push(vid(idx[3 * t]), vid(idx[3 * t + 1]), vid(idx[3 * t + 2])));
    outer.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    outer.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
    outer.setIndex(I);
    if (partId === PART.body) return { outer, inner: null, pivot };

    // panneau intérieur (doublure) + chant fermant l'épaisseur
    const thick = partId === PART.doorL || partId === PART.doorR ? 0.06 : 0.035;
    const nV = P.length / 3;
    const IP: number[] = [...P];
    for (let v = 0; v < nV; v++) {
      IP[3 * v] -= Nn[3 * v] * thick;
      IP[3 * v + 1] -= Nn[3 * v + 1] * thick;
      IP[3 * v + 2] -= Nn[3 * v + 2] * thick;
    }
    const allP = [...P, ...IP];
    const II: number[] = [];
    for (let k = 0; k < I.length; k += 3) II.push(I[k] + nV, I[k + 2] + nV, I[k + 1] + nV);
    // arêtes de contour
    const edges = new Map<string, [number, number, number]>();
    for (let k = 0; k < I.length; k += 3)
      for (let e = 0; e < 3; e++) {
        const u = I[k + e];
        const v = I[k + ((e + 1) % 3)];
        const key2 = u < v ? `${u}_${v}` : `${v}_${u}`;
        const ex = edges.get(key2);
        if (ex) ex[2]++;
        else edges.set(key2, [u, v, 1]);
      }
    edges.forEach(([u, v, count]) => {
      if (count !== 1) return;
      II.push(u, v, v + nV, u, v + nV, u + nV);
    });
    const inner = new THREE.BufferGeometry();
    inner.setAttribute('position', new THREE.Float32BufferAttribute(allP, 3));
    inner.setIndex(II);
    inner.computeVertexNormals();
    return { outer, inner, pivot };
  };

  const parts = {
    body: makePart(PART.body, 'body'),
    doorL: makePart(PART.doorL, 'doorL'),
    doorR: makePart(PART.doorR, 'doorR'),
    hood: makePart(PART.hood, 'hood'),
    tailgate: makePart(PART.tailgate, 'tailgate'),
  };

  // coque intérieure (vue au travers des vitres et des ouvrants ouverts)
  const ipos = new Float32Array(pos.length);
  for (let v = 0; v < S * N; v++) {
    ipos[3 * v] = pos[3 * v] * 0.985;
    ipos[3 * v + 1] = 0.72 + (pos[3 * v + 1] - 0.72) * 0.955;
    ipos[3 * v + 2] = pos[3 * v + 2] * 0.955;
  }
  const interior = new THREE.BufferGeometry();
  interior.setAttribute('position', new THREE.BufferAttribute(ipos, 3));
  interior.setIndex(idx);
  interior.computeVertexNormals();

  return { parts, interior, raycast: full, triangles: T };
}
