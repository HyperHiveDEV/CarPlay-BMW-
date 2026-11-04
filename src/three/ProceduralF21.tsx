import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useScene } from '../state/sceneStore';
import type { OpeningKey } from '../vehicle/types';
import { OpeningAnimator } from '../animations/OpeningAnimator';
import { blinkerIntensity, damp } from '../animations/easing';
import {
  F21, bodyProfile, greenhouseProfile, extrudeCentered, shapeBody, sidePatch, slopedQuad,
  bodySideZ, greenSideZ, roofY, taperX,
} from './f21Geometry';
import { createBannerTexture, createGlowTexture, createPlateTexture, type CarMaterials, type RenderTier } from './materials';
import { Wheel } from './Wheel';

/**
 * MAQUETTE PROVISOIRE — volumes simplifiés au gabarit F21 trois portes.
 * Ce n'est PAS une reconstruction exacte de la carrosserie : elle sert à développer
 * l'interface et les animations en attendant un modèle GLB sous licence (voir docs/IMPORT_MODELE_3D.md).
 * Les ouvrants sont de vraies pièces séparées pivotant autour de charnières.
 */

const HEAD_WHITE = new THREE.Color('#EAF2FF');
const HEAD_VIOLET = new THREE.Color('#B65CFF');

// ---------- échantillonnage du dessus de caisse (capot / épaules) ----------
let bodyTopSamples: [number, number][] | null = null;
function bodyTopY(x: number) {
  if (!bodyTopSamples) {
    bodyTopSamples = bodyProfile()
      .getPoints(48)
      .map((p) => [p.x, p.y] as [number, number])
      .filter((p) => p[1] > 0.74 && p[0] > -1.99 && p[0] < 2.06)
      .sort((a, b) => a[0] - b[0]);
  }
  const pts = bodyTopSamples;
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++)
    if (x <= pts[i][0]) {
      const t = (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0] || 1);
      return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t;
    }
  return pts[pts.length - 1][1];
}

/** Patch horizontal (dessus) : x de x0 à x1, z de zIn(x) à zOut(x), y = yFn(x). */
function topPatch(x0: number, x1: number, zIn: (x: number) => number, zOut: (x: number) => number, yFn: (x: number) => number, side: 1 | -1 | 0, seg = 16, origin: [number, number, number] = [0, 0, 0]) {
  const pos: number[] = [];
  const idx: number[] = [];
  const segZ = 6;
  for (let i = 0; i <= seg; i++) {
    const x = x0 + ((x1 - x0) * i) / seg;
    for (let j = 0; j <= segZ; j++) {
      const t = j / segZ;
      const z = side === 0 ? -zOut(x) + 2 * zOut(x) * t : side * (zIn(x) + (zOut(x) - zIn(x)) * t);
      pos.push(x - origin[0], yFn(x) - origin[1], z - origin[2]);
    }
  }
  for (let i = 0; i < seg; i++)
    for (let j = 0; j < segZ; j++) {
      const a = i * (segZ + 1) + j;
      const b = a + 1;
      const c = a + segZ + 1;
      const d = c + 1;
      const flip = (x1 > x0) !== (side >= 0);
      if (flip) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Plaque épaisse extrudée selon un contour de profil (capot, hayon, becquet). */
function profileSlab(outer: [number, number][], thickness: number, halfW: number, normalSign = 1, origin: [number, number] = [0, 0], taper = true) {
  const s = new THREE.Shape();
  const inner = outer.map((p, i) => {
    const a = outer[Math.max(0, i - 1)];
    const b = outer[Math.min(outer.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return [p[0] + (normalSign * dy * thickness) / l, p[1] - (normalSign * dx * thickness) / l] as [number, number];
  });
  s.moveTo(outer[0][0] - origin[0], outer[0][1] - origin[1]);
  outer.slice(1).forEach((p) => s.lineTo(p[0] - origin[0], p[1] - origin[1]));
  [...inner].reverse().forEach((p) => s.lineTo(p[0] - origin[0], p[1] - origin[1]));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 2 * halfW, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.006, bevelOffset: -0.006, bevelSegments: 3, curveSegments: 8 });
  g.translate(0, 0, -halfW);
  if (taper) {
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * taperX(p.getX(i) + origin[0]));
    p.needsUpdate = true;
  }
  g.computeVertexNormals();
  return g;
}

function useClickable(key: OpeningKey, interactive: boolean) {
  return {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (!interactive || e.delta > 6) return;
      useScene.getState().toggle(key);
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (!interactive) return;
      useScene.getState().set({ hovered: key });
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      useScene.getState().set({ hovered: null });
      document.body.style.cursor = '';
    },
  };
}

interface Props {
  mats: CarMaterials;
  tier: RenderTier;
  interactive: boolean;
  plateText: string;
  bannerText: string;
}

export function ProceduralF21({ mats, tier, interactive, plateText, bannerText }: Props) {
  const detail = tier === 'high' ? 2 : tier === 'medium' ? 1 : 0;

  // ---------------- géométries statiques ----------------
  const G = useMemo(() => {
    const body = shapeBody(extrudeCentered(bodyProfile(), F21.halfWidth, 0.1, 0.045, 18 + detail * 10), 'body');
    const green = shapeBody(extrudeCentered(greenhouseProfile(), F21.greenhouseHalf, 0.05, 0.035, 18), 'green');
    // pavillon blanc
    const roof = topPatch(0.12, -1.6, () => 0, (x) => greenSideZ(roofY(x)) - 0.045, (x) => roofY(x) + 0.003, 0, 24);
    // montants C blancs (custode) avec "Hofmeister kink"
    const cF = (y: number) => -1.56 + 0.3 * Math.pow((y - 0.95) / 0.4, 2);
    const cR = (y: number) => (y < 1.3 ? -2.0 + (y - 0.99) * (0.16 / 0.31) : -1.84 + (y - 1.3) * 2.2) + 0.012;
    const cPillar = (side: 1 | -1) => sidePatch(cF, cR, 0.95, 1.35, (_x, y) => greenSideZ(y), 0.004, side, 8, 8);
    // montants A
    const aF = (y: number) => 0.92 - (y - 0.93) * (0.86 / 0.445);
    const aPillar = (side: 1 | -1) => sidePatch((y) => aF(y) + 0.012, (y) => aF(y) - 0.07, 0.95, 1.36, (_x, y) => greenSideZ(y), 0.005, side, 2, 8);
    // montant B (noir)
    const bPillar = (side: 1 | -1) => sidePatch(() => -0.2, () => -0.27, 0.95, 1.36, (_x, y) => greenSideZ(y), 0.005, side, 1, 4);
    // passages de roue
    const arch = new THREE.CylinderGeometry(F21.archRadius - 0.006, F21.archRadius - 0.006, 0.34, 28, 1, true, Math.PI / 2 - 0.3, Math.PI + 0.6);
    arch.rotateX(Math.PI / 2);
    // bandeau pare-brise
    const banner = slopedQuad([0.235, 1.285], [0.11, 1.35], greenSideZ(1.285) - 0.1, greenSideZ(1.35) - 0.12, 0.006);
    return { body, green, roof, cPillarL: cPillar(-1), cPillarR: cPillar(1), aL: aPillar(-1), aR: aPillar(1), bL: bPillar(-1), bR: bPillar(1), arch, banner };
  }, [detail]);

  // ---------------- portières (pivot à la charnière avant) ----------------
  const hingeX = 0.95;
  const doorF = (y: number) => 0.96 - (y - 0.24) * 0.08;
  const doorR = (y: number) => -0.335 + (y - 0.24) * 0.15;
  const glassF = (y: number) => 0.92 - (y - 0.93) * (0.86 / 0.445) - 0.075;
  const DOOR = useMemo(() => {
    const mk = (side: 1 | -1) => {
      const hz = side * bodySideZ(hingeX, 0.6);
      const o: [number, number, number] = [hingeX, 0, hz];
      const panel = sidePatch(doorF, doorR, 0.25, 0.925, bodySideZ, 0.005, side, 14, 12, o);
      const glass = sidePatch(glassF, () => -0.205, 0.945, 1.34, (_x, y) => greenSideZ(y), 0.007, side, 6, 6, o);
      const cap = topPatch(glassF(0.94) + 0.02, doorR(0.925), (x) => greenSideZ(bodyTopY(x)) - 0.005, (x) => bodySideZ(x, 0.93) + 0.004, (x) => bodyTopY(x) + 0.006, side, 10, o);
      const aperture = sidePatch(doorF, doorR, 0.255, 0.92, bodySideZ, 0.0015, side, 6, 6);
      const apertureTop = topPatch(glassF(0.94), doorR(0.925), (x) => greenSideZ(bodyTopY(x)), (x) => bodySideZ(x, 0.93), (x) => bodyTopY(x) + 0.002, side, 6);
      // ligne de caractère (gouttière fine sombre) sur le panneau
      const crease = sidePatch((y) => doorF(y) - 0.02, (y) => doorR(y) + 0.02, 0.735, 0.742, bodySideZ, 0.0075, side, 6, 1, o);
      return { hz, panel, glass, cap, aperture, apertureTop, crease };
    };
    return { L: mk(-1), R: mk(1) };
  }, []);

  // ---------------- capot (pivot arrière) ----------------
  const hoodHinge: [number, number] = [0.98, bodyTopY(0.98) + 0.012];
  const HOOD = useMemo(() => {
    const outer: [number, number][] = [];
    for (let i = 0; i <= 14; i++) {
      const x = 0.98 + (1.06 * i) / 14;
      outer.push([x, bodyTopY(x) + 0.009]);
    }
    const slab = profileSlab(outer, 0.022, 0.74, -1, hoodHinge);
    const bay = topPatch(1.02, 2.0, () => 0, (x) => 0.68 * taperX(x), (x) => bodyTopY(x) + 0.003, 0, 12);
    return { slab, bay };
  }, []);

  // ---------------- hayon (pivot en haut) ----------------
  const tgHinge: [number, number] = [-1.6, 1.405];
  const TG = useMemo(() => {
    const glassLine: [number, number][] = [
      [-1.6, 1.41], [-1.72, 1.38], [-1.845, 1.318], [-1.94, 1.15], [-2.032, 0.992],
    ];
    const glass = profileSlab(glassLine, 0.03, 0.56, 1, tgHinge, false);
    const panelLine: [number, number][] = [
      [-2.0, 1.004], [-2.078, 0.936], [-2.126, 0.84], [-2.157, 0.7], [-2.16, 0.62],
    ];
    const panel = profileSlab(panelLine, 0.03, 0.55, 1, tgHinge);
    const spoilerLine: [number, number][] = [[-1.56, 1.432], [-1.72, 1.41], [-1.86, 1.37], [-1.97, 1.33]];
    const spoiler = profileSlab(spoilerLine, 0.035, 0.61, 1, tgHinge, false);
    const cargo = profileSlab(panelLine.map(([x, y]) => [x + 0.004, y]), 0.004, 0.52, 1, [0, 0]);
    return { glass, panel, spoiler, cargo };
  }, []);

  const tex = useMemo(() => ({ glow: createGlowTexture() }), []);
  const plateTex = useMemo(() => createPlateTexture(plateText), [plateText]);
  const bannerTex = useMemo(() => createBannerTexture(bannerText), [bannerText]);
  useEffect(() => () => { plateTex.dispose(); }, [plateTex]);
  useEffect(() => () => { bannerTex.dispose(); }, [bannerTex]);

  // ---------------- refs animées ----------------
  const doorL = useRef<THREE.Group>(null);
  const doorR_ = useRef<THREE.Group>(null);
  const hood = useRef<THREE.Group>(null);
  const tailgate = useRef<THREE.Group>(null);
  const engine = useRef<THREE.Group>(null);
  const spins = [useRef<THREE.Group>(null), useRef<THREE.Group>(null), useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const steerFL = useRef<THREE.Group>(null);
  const steerFR = useRef<THREE.Group>(null);
  const spotL = useRef<THREE.SpotLight>(null);
  const spotR = useRef<THREE.SpotLight>(null);
  const groundGlow = useRef<THREE.Mesh>(null);
  const glowSprites = useRef<THREE.Group>(null);
  const tailGlow = useRef<THREE.Group>(null);
  const anim = useMemo(() => ({
    driverDoor: new OpeningAnimator(1.15), passengerDoor: new OpeningAnimator(1.15),
    hood: new OpeningAnimator(1.5), tailgate: new OpeningAnimator(1.7),
    head: 0, tail: 0, brake: 0, spin: 0, wheelAngle: 0, steer: 0,
    headColor: new THREE.Color('#000'),
  }), []);

  const root = useRef<THREE.Group>(null);
  useEffect(() => {
    // les cibles des SpotLight doivent appartenir à la scène pour être mises à jour
    [spotL.current, spotR.current].forEach((sp, i) => {
      if (!sp || !root.current) return;
      sp.target.position.set(9, -0.6, (i === 0 ? -1 : 1) * 1.2);
      root.current.add(sp.target);
    });
  }, [tier]);

  useFrame((state, dt) => {
    const s = useScene.getState();
    const t = state.clock.elapsedTime;
    // Ouvrants
    const dL = anim.driverDoor.update(s.openings.driverDoor, dt);
    const dR = anim.passengerDoor.update(s.openings.passengerDoor, dt);
    const h = anim.hood.update(s.openings.hood, dt);
    const tg = anim.tailgate.update(s.openings.tailgate, dt);
    if (doorL.current) doorL.current.rotation.y = -dL * 1.12;
    if (doorR_.current) doorR_.current.rotation.y = dR * 1.12;
    if (hood.current) hood.current.rotation.z = h * 0.92;
    if (tailgate.current) tailgate.current.rotation.z = -tg * 1.22;
    if (engine.current) engine.current.visible = h > 0.12;

    // Roues : rotation démo et braquage visuel
    anim.spin = damp(anim.spin, s.wheelSpin ? 9 : 0, 1.6, dt);
    anim.wheelAngle -= anim.spin * dt;
    spins.forEach((r) => r.current && (r.current.rotation.z = anim.wheelAngle));
    anim.steer = damp(anim.steer, s.steer * 0.55, 5, dt);
    if (steerFL.current) steerFL.current.rotation.y = anim.steer;
    if (steerFR.current) steerFR.current.rotation.y = anim.steer;

    // Éclairage : allumage progressif
    anim.head = damp(anim.head, s.lightMode === 'off' ? 0 : 1, 2.4, dt);
    anim.tail = damp(anim.tail, s.lightMode === 'off' ? 0 : 1, 3, dt);
    anim.brake = damp(anim.brake, s.brake ? 1 : 0, 14, dt);
    const target = s.lightMode === 'violet' ? HEAD_VIOLET : HEAD_WHITE;
    anim.headColor.lerp(target, 1 - Math.exp(-6 * dt));
    mats.headDrl.emissive.copy(anim.headColor);
    mats.headDrl.emissiveIntensity = 0.05 + anim.head * 3.2;
    mats.tail.emissiveIntensity = 0.15 + anim.tail * 1.6 + anim.brake * 1.5;
    mats.brake.emissiveIntensity = anim.brake * 4;
    const bi = blinkerIntensity(t);
    const left = s.blinker === 'left' || s.blinker === 'hazard';
    const right = s.blinker === 'right' || s.blinker === 'hazard';
    mats.blinkL.emissiveIntensity = left ? bi * 4 : 0;
    mats.blinkR.emissiveIntensity = right ? bi * 4 : 0;
    for (const sp of [spotL.current, spotR.current]) {
      if (!sp) continue;
      sp.intensity = anim.head * 55;
      sp.color.copy(anim.headColor);
    }
    if (groundGlow.current) {
      const m = groundGlow.current.material as THREE.MeshBasicMaterial;
      m.opacity = anim.head * 0.55;
      m.color.copy(anim.headColor);
    }
    glowSprites.current?.children.forEach((c) => {
      const m = (c as THREE.Sprite).material;
      m.opacity = anim.head * 0.9;
      m.color.copy(anim.headColor);
    });
    tailGlow.current?.children.forEach((c) => {
      const sp = c as THREE.Sprite;
      const kind = sp.userData.kind as string;
      const m = sp.material;
      m.opacity = kind === 'tail' ? anim.tail * 0.45 + anim.brake * 0.5 : kind === 'bl' ? (left ? bi : 0) : right ? bi : 0;
    });
  });

  const bz = (x: number, y: number) => bodySideZ(x, y);
  const clickDriver = useClickable('driverDoor', interactive);
  const clickPass = useClickable('passengerDoor', interactive);
  const clickHood = useClickable('hood', interactive);
  const clickTg = useClickable('tailgate', interactive);

  const door = (side: 1 | -1) => {
    const D = side < 0 ? DOOR.L : DOOR.R;
    const mirrorZ = side * (greenSideZ(0.95) + 0.17) - D.hz;
    return (
      <group ref={side < 0 ? doorL : doorR_} position={[hingeX, 0, D.hz]} {...(side < 0 ? clickDriver : clickPass)}>
        <mesh geometry={D.panel} material={mats.paint} castShadow />
        <mesh geometry={D.cap} material={mats.paint} />
        <mesh geometry={D.crease} material={mats.trim} />
        <mesh geometry={D.glass} material={mats.glass} />
        {/* poignée */}
        <mesh position={[-1.02, 0.83, side * (bz(-0.07, 0.83) + 0.014) - D.hz]}>
          <boxGeometry args={[0.16, 0.028, 0.02]} />
          <primitive object={mats.paint} attach="material" />
        </mesh>
        <mesh position={[-1.02, 0.815, side * (bz(-0.07, 0.815) + 0.006) - D.hz]}>
          <boxGeometry args={[0.17, 0.006, 0.006]} />
          <primitive object={mats.trim} attach="material" />
        </mesh>
        {/* rétroviseur noir brillant + répétiteur */}
        <group position={[0.82 - hingeX, 1.0, mirrorZ]}>
          <mesh position={[0.02, -0.02, -side * 0.08]} material={mats.gloss}>
            <boxGeometry args={[0.1, 0.05, 0.12]} />
          </mesh>
          <RoundedBox args={[0.16, 0.13, 0.22]} radius={0.05} smoothness={3} material={mats.gloss} castShadow />
          <mesh position={[0.035, -0.06, side * 0.03]} material={side < 0 ? mats.blinkL : mats.blinkR}>
            <boxGeometry args={[0.1, 0.008, 0.12]} />
          </mesh>
        </group>
      </group>
    );
  };

  const kidney = (z: number, withM: boolean) => (
    <group position={[2.14, 0.61, z]} rotation={[0, 0, 0.5]}>
      <RoundedBox args={[0.035, 0.15, 0.235]} radius={0.03} smoothness={3} material={mats.gloss} />
      {Array.from({ length: 7 }).map((_, i) => (
        <mesh key={i} position={[0.02, 0, -0.09 + i * 0.03]} material={mats.gloss}>
          <boxGeometry args={[0.012, 0.115, 0.007]} />
        </mesh>
      ))}
      {withM && (
        <group position={[0.026, -0.05, z < 0 ? 0.05 : -0.05]}>
          {[mats.mBlue, mats.mNavy, mats.mRed].map((m, i) => (
            <mesh key={i} position={[0, 0, (i - 1) * 0.009]} material={m}>
              <boxGeometry args={[0.004, 0.018, 0.007]} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );

  const headlight = (side: 1 | -1) => (
    <group position={[2.075, 0.69, side * 0.5]} rotation={[0, -side * 0.55, 0.75]}>
      <mesh material={mats.headHousing}>
        <boxGeometry args={[0.05, 0.1, 0.36]} />
      </mesh>
      {[-0.08, 0.065].map((dz, i) => (
        <mesh key={i} position={[0.027, 0.004, side * dz]} rotation={[0, Math.PI / 2, 0]} material={mats.headDrl}>
          <torusGeometry args={[0.044, 0.0065, 8, 32]} />
        </mesh>
      ))}
      {/* sourcil LED */}
      <mesh position={[0.026, 0.043, side * 0.02]} rotation={[0.05 * side, 0, 0]} material={mats.headDrl}>
        <boxGeometry args={[0.006, 0.006, 0.3]} />
      </mesh>
      {/* clignotant avant */}
      <mesh position={[0.026, -0.042, side * 0.05]} material={side < 0 ? mats.blinkL : mats.blinkR}>
        <boxGeometry args={[0.006, 0.01, 0.24]} />
      </mesh>
      <mesh position={[0.03, 0, 0]} material={mats.lensClear}>
        <boxGeometry args={[0.012, 0.11, 0.37]} />
      </mesh>
    </group>
  );

  const tailLight = (side: 1 | -1) => (
    <group position={[-2.1, 0.865, side * 0.69]} rotation={[0, side * 0.55, -0.25]}>
      <mesh material={mats.tail}>
        <boxGeometry args={[0.045, 0.11, 0.3]} />
      </mesh>
      {/* signature en L */}
      <mesh position={[-0.024, 0.025, side * 0.02]} material={mats.brake}>
        <boxGeometry args={[0.006, 0.012, 0.24]} />
      </mesh>
      <mesh position={[-0.024, -0.01, side * 0.13]} material={mats.brake}>
        <boxGeometry args={[0.006, 0.08, 0.012]} />
      </mesh>
      <mesh position={[-0.024, -0.04, -side * 0.02]} material={side < 0 ? mats.blinkL : mats.blinkR}>
        <boxGeometry args={[0.006, 0.014, 0.18]} />
      </mesh>
    </group>
  );

  const wheel = (x: number, side: 1 | -1, i: number, front: boolean) => {
    const z = side * (front ? F21.halfTrackFront : F21.halfTrackRear);
    const content = <Wheel ref={spins[i]} mats={mats} side={side} detail={detail} />;
    return (
      <group key={i} position={[x, F21.wheelRadius, z]}>
        {front ? <group ref={side < 0 ? steerFL : steerFR}>{content}</group> : content}
      </group>
    );
  };

  const spriteMat = (color: string) => new THREE.SpriteMaterial({ map: tex.glow, color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });

  return (
    <group ref={root} name="F21_Procedural_Placeholder">
      {/* caisse et pavillon */}
      <mesh geometry={G.body} material={mats.paint} castShadow receiveShadow />
      <mesh geometry={G.green} material={mats.glass} castShadow />
      <mesh geometry={G.roof} material={mats.paint} />
      <mesh geometry={G.cPillarL} material={mats.paint} />
      <mesh geometry={G.cPillarR} material={mats.paint} />
      <mesh geometry={G.aL} material={mats.paint} />
      <mesh geometry={G.aR} material={mats.paint} />
      <mesh geometry={G.bL} material={mats.trim} />
      <mesh geometry={G.bR} material={mats.trim} />
      <mesh geometry={G.banner}>
        <meshBasicMaterial map={bannerTex} transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      {/* passages de roue (doublures noires) */}
      {[F21.frontAxleX, F21.rearAxleX].flatMap((x) => [-1, 1].map((s) => (
        <mesh key={`${x}${s}`} geometry={G.arch} material={mats.cavity} position={[x, F21.wheelRadius, s * 0.71]} />
      )))}
      {/* ouvertures (visibles portières ouvertes) */}
      <mesh geometry={DOOR.L.aperture} material={mats.cavity} />
      <mesh geometry={DOOR.R.aperture} material={mats.cavity} />
      <mesh geometry={DOOR.L.apertureTop} material={mats.cavity} />
      <mesh geometry={DOOR.R.apertureTop} material={mats.cavity} />
      <mesh geometry={TG.cargo} material={mats.cavity} />
      <mesh geometry={HOOD.bay} material={mats.cavity} />

      {door(-1)}
      {door(1)}

      {/* capot */}
      <group ref={hood} position={[hoodHinge[0], hoodHinge[1], 0]} {...clickHood}>
        <mesh geometry={HOOD.slab} material={mats.paint} castShadow />
      </group>
      {/* compartiment moteur B38 (visible capot ouvert) */}
      <group ref={engine} visible={false}>
        <RoundedBox args={[0.42, 0.1, 0.5]} radius={0.03} position={[1.5, 0.79, 0.05]} material={mats.interior} />
        <mesh position={[1.5, 0.845, 0.05]} material={mats.trim}>
          <boxGeometry args={[0.3, 0.012, 0.36]} />
        </mesh>
        <mesh position={[1.82, 0.78, -0.45]} material={mats.trim}>
          <cylinderGeometry args={[0.07, 0.07, 0.1, 20]} />
        </mesh>
        <mesh position={[1.2, 0.78, 0.5]} material={mats.trim}>
          <boxGeometry args={[0.25, 0.08, 0.25]} />
        </mesh>
      </group>

      {/* hayon : vitre teintée, panneau, becquet noir, 3e feu stop, feux intérieurs */}
      <group ref={tailgate} position={[tgHinge[0], tgHinge[1], 0]} {...clickTg}>
        <mesh geometry={TG.glass} material={mats.glass} />
        <mesh geometry={TG.panel} material={mats.paint} castShadow />
        <mesh geometry={TG.spoiler} material={mats.gloss} castShadow />
        <mesh position={[-1.835 - tgHinge[0], 1.322 - tgHinge[1], 0]} rotation={[0, 0, -1.05]} material={mats.brake}>
          <boxGeometry args={[0.006, 0.012, 0.34]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[-2.118 - tgHinge[0], 0.865 - tgHinge[1], s * 0.46]} rotation={[0, 0, -0.35]} material={mats.tail}>
            <boxGeometry args={[0.035, 0.085, 0.16]} />
          </mesh>
        ))}
        {/* badge M */}
        <group position={[-2.13 - tgHinge[0], 0.74 - tgHinge[1], 0.2]} rotation={[0, 0, -0.3]}>
          {[mats.mBlue, mats.mNavy, mats.mRed].map((m, i) => (
            <mesh key={i} position={[-0.004, 0, (i - 1) * 0.012]} material={m}>
              <boxGeometry args={[0.004, 0.022, 0.009]} />
            </mesh>
          ))}
        </group>
        {/* essuie-glace arrière */}
        <mesh position={[-1.985 - tgHinge[0], 1.07 - tgHinge[1], -0.12]} rotation={[0.25, 0, -1.05]} material={mats.trim}>
          <boxGeometry args={[0.012, 0.012, 0.46]} />
        </mesh>
      </group>

      {/* face avant M Sport */}
      {kidney(-0.135, true)}
      {kidney(0.135, false)}
      {headlight(-1)}
      {headlight(1)}
      <mesh position={[2.16, 0.33, 0]} material={mats.plasticMesh}>
        <boxGeometry args={[0.04, 0.15, 0.74]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[2.09, 0.36, s * 0.58]} rotation={[0, -s * 0.55, 0]}>
          <mesh material={mats.plasticMesh}>
            <boxGeometry args={[0.05, 0.16, 0.24]} />
          </mesh>
          <mesh position={[0.02, -0.015, s * 0.02]} rotation={[0, 0, Math.PI / 2]} material={mats.chrome}>
            <cylinderGeometry args={[0.032, 0.032, 0.02, 20]} />
          </mesh>
        </group>
      ))}
      {/* lame avant noire */}
      <mesh position={[2.115, 0.188, 0]} material={mats.gloss}>
        <boxGeometry args={[0.1, 0.022, 1.3]} />
      </mesh>
      {/* plaque neutre avant */}
      <mesh position={[2.182, 0.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.52, 0.11]} />
        <meshStandardMaterial map={plateTex} roughness={0.4} />
      </mesh>
      {/* anneau de remorquage rouge (visible sur les photos, côté droit) */}
      <group position={[2.175, 0.55, 0.33]}>
        <mesh rotation={[0, 0, Math.PI / 2]} material={mats.towHook}>
          <cylinderGeometry args={[0.012, 0.012, 0.06, 12]} />
        </mesh>
        <mesh position={[0.035, 0, 0]} rotation={[0, Math.PI / 2, 0]} material={mats.towHook}>
          <torusGeometry args={[0.022, 0.008, 8, 20]} />
        </mesh>
      </group>
      {/* badges M d'aile */}
      {[-1, 1].map((s) => (
        <group key={s} position={[1.08, 0.79, s * (bz(1.08, 0.79) + 0.003)]}>
          {[mats.mBlue, mats.mNavy, mats.mRed].map((m, i) => (
            <mesh key={i} position={[(i - 1) * 0.011, 0, 0]} material={m}>
              <boxGeometry args={[0.008, 0.02, 0.003]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* arrière : feux, diffuseur noir, sortie simple côté gauche */}
      {tailLight(-1)}
      {tailLight(1)}
      <mesh position={[-2.135, 0.27, 0]} material={mats.gloss}>
        <boxGeometry args={[0.09, 0.13, 1.3]} />
      </mesh>
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={i} position={[-2.15, 0.215, -0.36 + i * 0.145]} material={mats.gloss}>
          <boxGeometry args={[0.14, 0.09, 0.012]} />
        </mesh>
      ))}
      <mesh position={[-2.185, 0.25, 0]} rotation={[0, 0, Math.PI / 4]} material={mats.reflector}>
        <boxGeometry args={[0.012, 0.05, 0.05]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[-2.125, 0.34, s * 0.62]} rotation={[0, s * 0.5, 0]}>
          <mesh material={mats.gloss}>
            <boxGeometry args={[0.05, 0.08, 0.26]} />
          </mesh>
          <mesh position={[-0.027, 0, 0]} material={mats.reflector}>
            <boxGeometry args={[0.004, 0.018, 0.16]} />
          </mesh>
        </group>
      ))}
      <group position={[-2.17, 0.285, -0.47]} rotation={[0, 0, Math.PI / 2]}>
        <mesh material={mats.chrome}>
          <cylinderGeometry args={[0.046, 0.046, 0.12, 24, 1, true]} />
        </mesh>
        <mesh position={[0, 0.05, 0]} material={mats.trim}>
          <cylinderGeometry args={[0.04, 0.04, 0.01, 24]} />
        </mesh>
      </group>
      <mesh position={[-2.172, 0.48, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.52, 0.11]} />
        <meshStandardMaterial map={plateTex} roughness={0.4} />
      </mesh>
      {/* antenne requin */}
      <mesh position={[-1.32, roofY(-1.32) + 0.03, 0]} material={mats.gloss}>
        <boxGeometry args={[0.16, 0.06, 0.06]} />
      </mesh>

      {/* roues */}
      {wheel(F21.frontAxleX, -1, 0, true)}
      {wheel(F21.frontAxleX, 1, 1, true)}
      {wheel(F21.rearAxleX, -1, 2, false)}
      {wheel(F21.rearAxleX, 1, 3, false)}

      {/* faisceaux des phares (simulation visuelle uniquement) */}
      {tier !== 'low' &&
        [-1, 1].map((s) => (
          <spotLight
            key={s}
            ref={s < 0 ? spotL : spotR}
            position={[2.15, 0.69, s * 0.5]}
            angle={0.42}
            penumbra={0.8}
            distance={14}
            decay={1.6}
            intensity={0}
          />
        ))}
      <mesh ref={groundGlow} position={[3.6, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.4, 2.6]} />
        <meshBasicMaterial map={tex.glow} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <group ref={glowSprites}>
        {[-1, 1].flatMap((s) => [-0.08, 0.065].map((dz) => (
          <sprite key={`${s}${dz}`} position={[2.12, 0.695, s * (0.5 + dz * 0.84)]} scale={[0.22, 0.22, 1]} material={spriteMat('#ffffff')} />
        )))}
      </group>
      <group ref={tailGlow}>
        {[-1, 1].map((s) => (
          <sprite key={`t${s}`} userData={{ kind: 'tail' }} position={[-2.16, 0.87, s * 0.66]} scale={[0.4, 0.22, 1]} material={spriteMat('#ff2020')} />
        ))}
        {[-1, 1].map((s) => (
          <sprite key={`b${s}`} userData={{ kind: s < 0 ? 'bl' : 'br' }} position={[-2.16, 0.83, s * 0.7]} scale={[0.25, 0.16, 1]} material={spriteMat('#ff9000')} />
        ))}
        {[-1, 1].map((s) => (
          <sprite key={`f${s}`} userData={{ kind: s < 0 ? 'bl' : 'br' }} position={[2.13, 0.665, s * 0.52]} scale={[0.22, 0.12, 1]} material={spriteMat('#ff9000')} />
        ))}
      </group>
    </group>
  );
}
