import * as THREE from 'three';

/**
 * Gabarit dimensionnel BMW F21 (3 portes) — utilisé UNIQUEMENT par la maquette provisoire.
 * Longueur 4 329 mm, largeur 1 765 mm, hauteur ~1 420 mm, empattement 2 690 mm.
 * Repère : X = avant, Y = haut, Z = droite. Côté conducteur (France) = −Z.
 */
export const F21 = {
  length: 4.33,
  halfWidth: 0.8825,
  frontAxleX: 1.365,
  rearAxleX: -1.325,
  wheelRadius: 0.322,
  archRadius: 0.385,
  halfTrackFront: 0.765,
  halfTrackRear: 0.775,
  beltY: 0.93,
  greenhouseHalf: 0.76,
  greenhouseTaper: 0.36,
};

/** Profil latéral de la caisse (bas de caisse, ailes, capot, hayon jusqu'à la ligne de caisse). */
export function bodyProfile(): THREE.Shape {
  const s = new THREE.Shape();
  const r = F21.archRadius;
  const cy = F21.wheelRadius;
  const a = Math.asin((0.215 - cy) / r);
  const dx = r * Math.cos(a);
  s.moveTo(2.07, 0.19);
  s.lineTo(F21.frontAxleX + dx, 0.215);
  s.absarc(F21.frontAxleX, cy, r, a, Math.PI - a, false);
  s.lineTo(F21.rearAxleX + dx, 0.215);
  s.absarc(F21.rearAxleX, cy, r, a, Math.PI - a, false);
  s.lineTo(-2.06, 0.22);
  s.quadraticCurveTo(-2.165, 0.25, -2.165, 0.42);
  s.lineTo(-2.15, 0.7);
  s.quadraticCurveTo(-2.13, 0.86, -2.07, 0.93);
  s.lineTo(-1.98, 1.0);
  s.lineTo(-0.6, 0.975);
  s.lineTo(0.9, 0.935);
  s.quadraticCurveTo(1.55, 0.885, 2.02, 0.745);
  s.quadraticCurveTo(2.15, 0.71, 2.163, 0.56);
  s.lineTo(2.175, 0.4);
  s.quadraticCurveTo(2.16, 0.22, 2.07, 0.19);
  return s;
}

/** Profil du pavillon / vitrage (extrudé plus étroit, puis incliné vers l'intérieur). */
export function greenhouseProfile(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0.95, 0.88);
  s.lineTo(0.92, 0.93);
  s.lineTo(0.06, 1.375);
  s.quadraticCurveTo(-0.5, 1.43, -1.25, 1.405);
  s.quadraticCurveTo(-1.62, 1.39, -1.84, 1.31);
  s.lineTo(-2.02, 0.99);
  s.lineTo(-1.98, 0.88);
  s.closePath();
  return s;
}

let roofSamples: [number, number][] | null = null;
/** Hauteur exacte du haut du pavillon en x (échantillonnage du profil). */
export const roofY = (x: number) => {
  if (!roofSamples) {
    roofSamples = greenhouseProfile()
      .getPoints(64)
      .map((p) => [p.x, p.y] as [number, number])
      .filter((p) => p[1] > 1.2)
      .sort((a, b) => a[0] - b[0]);
  }
  const pts = roofSamples;
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const t = (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0] || 1);
      return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t;
    }
  }
  return pts[pts.length - 1][1];
};

/** Rétrécissement en plan (nez et poupe arrondis). */
export const taperX = (x: number) => {
  if (x > 1.25) return 1 - 0.17 * Math.pow((x - 1.25) / 0.92, 2.2);
  if (x < -1.75) return 1 - 0.08 * Math.pow((-1.75 - x) / 0.42, 2);
  return 1;
};
/** Galbe vertical des flancs. */
export const bulgeY = (y: number) => 1 - 0.055 * Math.pow(THREE.MathUtils.clamp((y - 0.62) / 0.42, -1, 1), 2);

/** Position Z de la surface latérale de caisse en (x, y). */
export const bodySideZ = (x: number, y: number) => F21.halfWidth * taperX(x) * bulgeY(y);
/** Position Z de la surface latérale du pavillon en y. */
export const greenSideZ = (y: number) => F21.greenhouseHalf * (1 - F21.greenhouseTaper * Math.max(0, y - F21.beltY));

export function shapeBody(geo: THREE.BufferGeometry, mode: 'body' | 'green') {
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    // arrondi des angles supérieurs du nez et de la poupe
    const nose = x > 1.6 ? 1 - 0.09 * THREE.MathUtils.clamp((y - 0.48) / 0.3, 0, 1) * ((x - 1.6) / 0.57) : 1;
    const tail = x < -1.9 ? 1 - 0.05 * THREE.MathUtils.clamp((y - 0.6) / 0.35, 0, 1) * ((-1.9 - x) / 0.27) : 1;
    const f = mode === 'body' ? taperX(x) * bulgeY(y) * nose * tail : 1 - F21.greenhouseTaper * Math.max(0, y - F21.beltY);
    p.setZ(i, z * f);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Extrusion centrée en Z avec biseau (arêtes arrondies) sans grossir le contour. */
export function extrudeCentered(shape: THREE.Shape, halfWidth: number, bevel: number, bevelSize: number, curveSegments = 28) {
  const depth = 2 * halfWidth - 2 * bevel;
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize,
    bevelOffset: -bevelSize,
    bevelSegments: 6,
    curveSegments,
    steps: 1,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

/**
 * Patch de surface latérale paramétrique : bord avant xF(y), bord arrière xR(y),
 * plaqué sur la surface z = zFn(x, y) + offset. side = −1 (gauche/conducteur) ou +1.
 */
export function sidePatch(
  xF: (y: number) => number,
  xR: (y: number) => number,
  y0: number,
  y1: number,
  zFn: (x: number, y: number) => number,
  offset: number,
  side: 1 | -1,
  segU = 10,
  segV = 8,
  origin: [number, number, number] = [0, 0, 0],
) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= segV; j++) {
    const y = y0 + ((y1 - y0) * j) / segV;
    for (let i = 0; i <= segU; i++) {
      const u = i / segU;
      const x = xF(y) + (xR(y) - xF(y)) * u;
      const z = side * (zFn(x, y) + offset);
      pos.push(x - origin[0], y - origin[1], z - origin[2]);
      uv.push(u, j / segV);
    }
  }
  for (let j = 0; j < segV; j++)
    for (let i = 0; i < segU; i++) {
      const a = j * (segU + 1) + i;
      const b = a + 1;
      const c = a + segU + 1;
      const d = c + 1;
      if (side > 0) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Quadrilatère sur une surface inclinée entre deux points de profil (pare-brise, lunette). */
export function slopedQuad(p0: [number, number], p1: [number, number], halfW0: number, halfW1: number, normalOffset: number) {
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const len = Math.hypot(dx, dy);
  // normale extérieure dans le plan XY
  let nx = -dy / len;
  let ny = dx / len;
  const mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
  if (nx * mid[0] + ny * (mid[1] - 0.6) < 0) {
    nx = -nx;
    ny = -ny;
  }
  const o = (p: [number, number]) => [p[0] + nx * normalOffset, p[1] + ny * normalOffset];
  const a = o(p0);
  const b = o(p1);
  const g = new THREE.BufferGeometry();
  const pos = [a[0], a[1], -halfW0, a[0], a[1], halfW0, b[0], b[1], -halfW1, b[0], b[1], halfW1];
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 2, 1, 1, 2, 3]);
  g.computeVertexNormals();
  return g;
}
