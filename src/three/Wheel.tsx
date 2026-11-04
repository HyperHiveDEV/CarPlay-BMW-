import { forwardRef, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CarMaterials } from './materials';
import { F21 } from './f21Geometry';

/** Géométries partagées par les 4 roues (créées une seule fois). */
function buildWheelGeometries(detail: number) {
  const R = F21.wheelRadius; // rayon extérieur pneu
  const rimR = 0.229; // jante 18" (457 mm)
  const W = 0.225; // largeur pneu 225
  // Pneu : profil (section) révolutionné autour de l'axe
  const prof: THREE.Vector2[] = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ang = -Math.PI / 2 + Math.PI * t;
    const x = (W / 2) * Math.sin(ang) * 0.98;
    const bulge = Math.cos(ang);
    const r = rimR + 0.012 + (R - rimR - 0.012) * Math.pow(Math.max(0, bulge), 0.35);
    prof.push(new THREE.Vector2(r, x));
  }
  const tyre = new THREE.LatheGeometry(prof, 24 + detail * 24);
  tyre.rotateX(Math.PI / 2);

  // Fût et rebord de jante
  const barrel = new THREE.CylinderGeometry(rimR - 0.006, rimR - 0.006, W * 0.92, 24 + detail * 24, 1, true);
  barrel.rotateX(Math.PI / 2);
  const lip = new THREE.TorusGeometry(rimR - 0.004, 0.009, 8, 24 + detail * 24);

  // Branches : 5 paires (design 5 doubles branches), légèrement concaves
  const spokeShape = new THREE.Shape();
  spokeShape.moveTo(0.055, -0.016);
  spokeShape.lineTo(rimR - 0.012, -0.011);
  spokeShape.lineTo(rimR - 0.012, 0.011);
  spokeShape.lineTo(0.055, 0.016);
  spokeShape.closePath();
  const one = new THREE.ExtrudeGeometry(spokeShape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.004, bevelSegments: 2 });
  one.translate(0, 0, -0.015);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    for (const off of [-0.15, 0.15]) {
      const g = one.clone();
      // concavité : la branche recule vers l'extérieur
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let k = 0; k < p.count; k++) {
        const r = p.getX(k);
        p.setZ(k, p.getZ(k) + (r - 0.055) * 0.2);
      }
      g.rotateZ(((i * 2 * Math.PI) / 5) + off);
      parts.push(g);
    }
  }
  const spokes = mergeGeometries(parts)!;
  spokes.computeVertexNormals();
  const hub = new THREE.CylinderGeometry(0.068, 0.072, 0.05, 32);
  hub.rotateX(Math.PI / 2);
  const cap = new THREE.CylinderGeometry(0.03, 0.03, 0.012, 32);
  cap.rotateX(Math.PI / 2);
  const capRing = new THREE.TorusGeometry(0.03, 0.003, 6, 32);
  const bolts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const b = new THREE.CylinderGeometry(0.008, 0.008, 0.012, 8);
    b.rotateX(Math.PI / 2);
    const a = (i * 2 * Math.PI) / 5 + Math.PI / 5;
    b.translate(Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0.026);
    bolts.push(b);
  }
  const boltGeo = mergeGeometries(bolts)!;
  const disc = new THREE.CylinderGeometry(0.17, 0.17, 0.022, 40);
  disc.rotateX(Math.PI / 2);
  const caliper = new THREE.BoxGeometry(0.11, 0.06, 0.07);
  return { tyre, barrel, lip, spokes, hub, cap, capRing, boltGeo, disc, caliper, W };
}

let cache: ReturnType<typeof buildWheelGeometries> | null = null;
let cacheDetail = -1;
function geos(detail: number) {
  if (!cache || cacheDetail !== detail) {
    cache = buildWheelGeometries(detail);
    cacheDetail = detail;
  }
  return cache;
}

interface WheelProps {
  mats: CarMaterials;
  side: 1 | -1;
  detail: number;
}

/**
 * Roue complète. Le groupe externe porte le braquage (rotation Y, appliquée par le parent),
 * le groupe "spin" (ref) porte la rotation autour de l'axe de roue.
 * Le disque et l'étrier ne tournent pas avec la jante.
 */
export const Wheel = forwardRef<THREE.Group, WheelProps>(function Wheel({ mats, side, detail }, spinRef) {
  const g = useMemo(() => geos(detail), [detail]);
  const face = side * (g.W / 2 - 0.075);
  return (
    <group>
      <mesh geometry={g.disc} material={mats.disc} position={[0, 0, side * -0.03]} />
      <mesh geometry={g.caliper} material={mats.caliper} position={[-0.12, 0.08, side * -0.02]} rotation={[0, 0, 0.6]} />
      <group ref={spinRef}>
        <group scale={[1, 1, side]}>
          <mesh geometry={g.tyre} material={mats.tyre} castShadow />
          <mesh geometry={g.barrel} material={mats.rimDark} />
          <mesh geometry={g.lip} material={mats.rim} position={[0, 0, g.W / 2 - 0.02]} />
          <group position={[0, 0, Math.abs(face)]}>
            <mesh geometry={g.spokes} material={mats.rim} castShadow />
            <mesh geometry={g.hub} material={mats.rim} position={[0, 0, -0.01]} />
            <mesh geometry={g.boltGeo} material={mats.chrome} />
            <mesh geometry={g.cap} material={mats.trim} position={[0, 0, 0.026]} />
            <mesh geometry={g.capRing} material={mats.chrome} position={[0, 0, 0.033]} />
          </group>
        </group>
      </group>
    </group>
  );
});
