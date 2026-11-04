import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useScene } from '../state/sceneStore';
import type { OpeningKey } from '../vehicle/types';
import { OpeningAnimator } from '../animations/OpeningAnimator';
import { blinkerIntensity, damp } from '../animations/easing';
import { PART, buildF21Body } from './f21Body';
import { SHARK_FIN, SPOILER, WHEELS, X_FRONT, X_REAR, pxX, pxY } from './f21Blueprint';
import { createBannerTexture, createGlowTexture, createPlateTexture, type CarMaterials, type RenderTier } from './materials';
import { Wheel } from './Wheel';
import { createZoneMaterial } from './zoneMaterial';

/**
 * BMW F21 LCI reconstituée : surface lissée générée depuis le gabarit relevé sur la photo de profil
 * du véhicule. Les ouvrants sont des pièces séparées découpées sur leurs contours réels et
 * pivotent autour de leurs charnières. Remplaçable à tout moment par un modèle GLB sous licence.
 */

const HEAD_WHITE = new THREE.Color('#EAF2FF');
const HEAD_VIOLET = new THREE.Color('#B65CFF');

interface Hit {
  p: THREE.Vector3;
  n: THREE.Vector3;
  q: THREE.Quaternion;
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

function profileExtrude(pts: [number, number][], halfW: number, bevel = 0.01) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 2 * halfW - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.6, bevelOffset: -bevel * 0.6, bevelSegments: 3, curveSegments: 6 });
  g.translate(0, 0, -(halfW - bevel));
  g.computeVertexNormals();
  return g;
}

interface Props {
  mats: CarMaterials;
  tier: RenderTier;
  interactive: boolean;
  plateText: string;
  bannerText: string;
}

export function RealisticF21({ mats, tier, interactive, plateText, bannerText }: Props) {
  const detail = (tier === 'high' ? 2 : tier === 'medium' ? 1 : 0) as 0 | 1 | 2;
  const body = useMemo(() => buildF21Body(detail), [detail]);

  /** Matériau de carrosserie par zones (une instance par pièce, avec son pivot). */
  const shared = useMemo(() => ({ uHeadEm: { value: new THREE.Color(0, 0, 0) }, uTailEm: { value: new THREE.Color(0, 0, 0) } }), []);
  const zoneMats = useMemo(() => {
    const P0 = body.parts;
    return {
      body: createZoneMaterial(tier, PART.body, P0.body.pivot, shared),
      doorL: createZoneMaterial(tier, PART.doorL, P0.doorL.pivot, shared),
      doorR: createZoneMaterial(tier, PART.doorR, P0.doorR.pivot, shared),
      hood: createZoneMaterial(tier, PART.hood, P0.hood.pivot, shared),
      tailgate: createZoneMaterial(tier, PART.tailgate, P0.tailgate.pivot, shared),
    };
  }, [body, tier, shared]);
  useEffect(() => () => Object.values(zoneMats).forEach((m) => m.dispose()), [zoneMats]);
  const interiorMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#16171a', roughness: 0.92, side: THREE.BackSide }), []);
  const leather = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1c1d20', roughness: 0.7 }), []);
  const panelInner = useMemo(() => new THREE.MeshStandardMaterial({ color: '#202226', roughness: 0.8, side: THREE.DoubleSide }), []);

  // ---------------------------------------------------- placement des accessoires sur la surface
  const hits = useMemo(() => {
    const mesh = new THREE.Mesh(body.raycast, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    mesh.updateMatrixWorld();
    const rc = new THREE.Raycaster();
    const cast = (origin: [number, number, number], dir: [number, number, number]): Hit => {
      rc.set(new THREE.Vector3(...origin), new THREE.Vector3(...dir).normalize());
      const h = rc.intersectObject(mesh, false)[0];
      const p = h ? h.point.clone() : new THREE.Vector3(...origin);
      const n = h?.face ? h.face.normal.clone() : new THREE.Vector3(...dir).negate();
      if (n.dot(new THREE.Vector3(...dir)) > 0) n.negate();
      // repère : X le long de la surface (sens de lecture pour un observateur extérieur), Z = normale
      const up = Math.abs(n.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      const xa = new THREE.Vector3().crossVectors(up, n).normalize();
      const ya = new THREE.Vector3().crossVectors(n, xa).normalize();
      return { p, n, q: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xa, ya, n)) };
    };
    const front = (z: number, y: number) => cast([X_FRONT + 1, y, z], [-1, 0, 0]);
    const rear = (z: number, y: number) => cast([X_REAR - 1, y, z], [1, 0, 0]);
    const side = (x: number, y: number, s: 1 | -1) => cast([x, y, s * 2], [0, 0, -s]);
    return {
      rings: [-1, 1].flatMap((s) => [0.45, 0.63].map((z) => ({ s, h: front(s * z, 0.648) }))),
      brows: [-1, 1].map((s) => ({ s, h: front(s * 0.56, 0.688) })),
      blinkFront: [-1, 1].map((s) => ({ s, h: front(s * 0.47, 0.607) })),
      kidneys: [-1, 1].map((s) => ({ s, h: front(s * 0.142, 0.603) })),
      fogs: [-1, 1].map((s) => ({ s, h: front(s * 0.64, 0.37) })),
      plateF: front(0, 0.485),
      plateR: rear(0, 0.5),
      tow: front(0.33, 0.56),
      exhaust: rear(-0.5, 0.27),
      blinkRear: [-1, 1].map((s) => ({ s, h: rear(s * 0.64, 0.84) })),
      tailBars: [-1, 1].map((s) => ({ s, h: rear(s * 0.67, 0.89) })),
      badgesM: [-1, 1].map((s) => ({ s, h: side(pxX(490), pxY(370), s as 1 | -1) })),
      mirrors: [-1, 1].map((s) => ({ s, h: side(pxX(615), pxY(262), s as 1 | -1) })),
      handles: [-1, 1].map((s) => ({ s, h: side(pxX(992), pxY(300), s as 1 | -1) })),
      banner: cast([0.31, 3, 0], [0, -1, 0.0]),
    };
  }, [body]);

  const spoilerGeo = useMemo(() => profileExtrude(SPOILER, 0.62, 0.012), []);
  const finGeo = useMemo(() => profileExtrude(SHARK_FIN, 0.035, 0.012), []);
  const tex = useMemo(() => ({ glow: createGlowTexture() }), []);
  const plateTex = useMemo(() => createPlateTexture(plateText), [plateText]);
  const bannerTex = useMemo(() => createBannerTexture(bannerText), [bannerText]);
  useEffect(() => () => plateTex.dispose(), [plateTex]);
  useEffect(() => () => bannerTex.dispose(), [bannerTex]);
  useEffect(() => () => {
    Object.values(body.parts).forEach((p) => { p.outer.dispose(); p.inner?.dispose(); });
    body.interior.dispose();
    body.raycast.dispose();
  }, [body]);

  // ---------------------------------------------------- animation
  const doorL = useRef<THREE.Group>(null);
  const doorR = useRef<THREE.Group>(null);
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
  const root = useRef<THREE.Group>(null);
  const anim = useMemo(() => ({
    driverDoor: new OpeningAnimator(1.15), passengerDoor: new OpeningAnimator(1.15),
    hood: new OpeningAnimator(1.5), tailgate: new OpeningAnimator(1.7),
    head: 0, tail: 0, brake: 0, spin: 0, wheelAngle: 0, steer: 0, headColor: new THREE.Color('#000'),
  }), []);

  useEffect(() => {
    [spotL.current, spotR.current].forEach((sp, i) => {
      if (!sp || !root.current) return;
      sp.target.position.set(9, -0.6, (i === 0 ? -1 : 1) * 1.2);
      root.current.add(sp.target);
    });
  }, [tier]);

  useFrame((state, dt) => {
    const s = useScene.getState();
    const t = state.clock.elapsedTime;
    const dL = anim.driverDoor.update(s.openings.driverDoor, dt);
    const dR = anim.passengerDoor.update(s.openings.passengerDoor, dt);
    const h = anim.hood.update(s.openings.hood, dt);
    const tg = anim.tailgate.update(s.openings.tailgate, dt);
    if (doorL.current) doorL.current.rotation.y = -dL * 1.1;
    if (doorR.current) doorR.current.rotation.y = dR * 1.1;
    if (hood.current) hood.current.rotation.z = h * 0.88;
    if (tailgate.current) tailgate.current.rotation.z = -tg * 1.25;
    if (engine.current) engine.current.visible = h > 0.05;

    anim.spin = damp(anim.spin, s.wheelSpin ? 9 : 0, 1.6, dt);
    anim.wheelAngle -= anim.spin * dt;
    spins.forEach((r) => r.current && (r.current.rotation.z = anim.wheelAngle));
    anim.steer = damp(anim.steer, s.steer * 0.55, 5, dt);
    if (steerFL.current) steerFL.current.rotation.y = anim.steer;
    if (steerFR.current) steerFR.current.rotation.y = anim.steer;

    anim.head = damp(anim.head, s.lightMode === 'off' ? 0 : 1, 2.4, dt);
    anim.tail = damp(anim.tail, s.lightMode === 'off' ? 0 : 1, 3, dt);
    anim.brake = damp(anim.brake, s.brake ? 1 : 0, 14, dt);
    anim.headColor.lerp(s.lightMode === 'violet' ? HEAD_VIOLET : HEAD_WHITE, 1 - Math.exp(-6 * dt));
    mats.headDrl.emissive.copy(anim.headColor);
    mats.headDrl.emissiveIntensity = 0.05 + anim.head * 3.4;
    mats.tail.emissiveIntensity = 0.12 + anim.tail * 1.2 + anim.brake * 1.6;
    shared.uHeadEm.value.copy(anim.headColor).multiplyScalar(anim.head);
    shared.uTailEm.value.setRGB(1, 0.05, 0.05).multiplyScalar(0.08 + anim.tail * 0.9 + anim.brake * 1.6);
    mats.brake.emissiveIntensity = anim.brake * 4 + anim.tail * 0.8;
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
      m.opacity = anim.head * 0.85;
      m.color.copy(anim.headColor);
    });
    tailGlow.current?.children.forEach((c) => {
      const sp = c as THREE.Sprite;
      const kind = sp.userData.kind as string;
      sp.material.opacity = kind === 'tail' ? anim.tail * 0.4 + anim.brake * 0.55 : kind === 'bl' ? (left ? bi : 0) : right ? bi : 0;
    });
  });

  const clickDriver = useClickable('driverDoor', interactive);
  const clickPass = useClickable('passengerDoor', interactive);
  const clickHood = useClickable('hood', interactive);
  const clickTg = useClickable('tailgate', interactive);

  const P = body.parts;
  const local = (h: Hit, pivot: THREE.Vector3, off = 0.003): [number, number, number] => [
    h.p.x + h.n.x * off - pivot.x, h.p.y + h.n.y * off - pivot.y, h.p.z + h.n.z * off - pivot.z,
  ];
  const at = (h: Hit, off = 0.003): [number, number, number] => [h.p.x + h.n.x * off, h.p.y + h.n.y * off, h.p.z + h.n.z * off];
  const spriteMat = (color: string) => new THREE.SpriteMaterial({ map: tex.glow, color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const tierShadow = tier !== 'low';

  const door = (s: 1 | -1) => {
    const part = s < 0 ? P.doorL : P.doorR;
    const m = hits.mirrors.find((x) => x.s === s)!.h;
    const hd = hits.handles.find((x) => x.s === s)!.h;
    return (
      <group ref={s < 0 ? doorL : doorR} position={part.pivot.toArray()} {...(s < 0 ? clickDriver : clickPass)}>
        <mesh geometry={part.outer} material={s < 0 ? zoneMats.doorL : zoneMats.doorR} castShadow={tierShadow} />
        {part.inner && <mesh geometry={part.inner} material={panelInner} />}
        {/* poignée affleurante couleur carrosserie */}
        <group position={local(hd, part.pivot, 0.006)} quaternion={hd.q}>
          <RoundedBox args={[0.15, 0.03, 0.014]} radius={0.006} smoothness={2} material={mats.paint} />
          <mesh position={[0, -0.018, -0.004]} material={mats.trim}>
            <boxGeometry args={[0.16, 0.004, 0.006]} />
          </mesh>
        </group>
        {/* rétroviseur coque noir brillant + répétiteur */}
        <group position={local(m, part.pivot, 0.0)}>
          <mesh position={[-0.02, 0.0, s * 0.05]} material={mats.gloss}>
            <boxGeometry args={[0.09, 0.05, 0.11]} />
          </mesh>
          <group position={[-0.05, 0.05, s * 0.15]} rotation={[0, s * 0.12, 0]}>
            <mesh scale={[0.085, 0.072, 0.13]} material={mats.gloss} castShadow={tierShadow}>
              <sphereGeometry args={[1, 28, 18]} />
            </mesh>
            <mesh position={[-0.084, 0, 0]} rotation={[0, -Math.PI / 2, 0]} scale={[0.115, 0.06, 1]} material={mats.chrome}>
              <circleGeometry args={[1, 28]} />
            </mesh>
            <mesh position={[0.03, -0.045, s * 0.02]} rotation={[0.2 * s, 0, 0]} material={s < 0 ? mats.blinkL : mats.blinkR}>
              <boxGeometry args={[0.07, 0.006, 0.12]} />
            </mesh>
          </group>
        </group>
      </group>
    );
  };

  const wheel = (x: number, s: 1 | -1, i: number, isFront: boolean) => {
    const z = s * (isFront ? WHEELS.halfTrackFront : WHEELS.halfTrackRear);
    const content = <Wheel ref={spins[i]} mats={mats} side={s} detail={detail} />;
    return (
      <group key={i} position={[x, WHEELS.radius, z]}>
        {isFront ? <group ref={s < 0 ? steerFL : steerFR}>{content}</group> : content}
      </group>
    );
  };

  return (
    <group ref={root} name="F21_LCI_Reconstitution">
      {/* caisse fixe, habitacle, lignes d'ouvrants */}
      <mesh geometry={P.body.outer} material={zoneMats.body} castShadow={tierShadow} receiveShadow />
      <mesh geometry={body.interior} material={interiorMat} />

      {/* habitacle : sièges, planche de bord, volant (visibles au travers des vitres) */}
      {[-1, 1].map((s) => (
        <group key={s} position={[-0.32, 0.5, s * 0.37]}>
          <RoundedBox args={[0.5, 0.12, 0.5]} radius={0.05} position={[0, 0, 0]} material={leather} />
          <RoundedBox args={[0.12, 0.62, 0.48]} radius={0.05} position={[-0.25, 0.32, 0]} rotation={[0, 0, 0.22]} material={leather} />
        </group>
      ))}
      <RoundedBox args={[0.5, 0.36, 1.25]} radius={0.06} position={[-1.12, 0.62, 0]} material={leather} />
      <RoundedBox args={[0.42, 0.22, 1.42]} radius={0.06} position={[0.42, 0.86, 0]} material={leather} />
      <mesh position={[0.16, 0.9, -0.37]} rotation={[0, Math.PI / 2, 0.45]} material={leather}>
        <torusGeometry args={[0.18, 0.02, 10, 36]} />
      </mesh>

      {/* ouvrants */}
      {door(-1)}
      {door(1)}
      <group ref={hood} position={P.hood.pivot.toArray()} {...clickHood}>
        <mesh geometry={P.hood.outer} material={zoneMats.hood} castShadow={tierShadow} />
        {P.hood.inner && <mesh geometry={P.hood.inner} material={panelInner} />}
      </group>
      <group ref={engine} visible={false}>
        {/* B38 : cache moteur, boîte à air, vase d'expansion */}
        <RoundedBox args={[0.38, 0.12, 0.46]} radius={0.04} position={[1.25, 0.78, 0.06]} material={mats.interior} />
        <mesh position={[1.25, 0.845, 0.06]} material={mats.trim}><boxGeometry args={[0.26, 0.01, 0.3]} /></mesh>
        <RoundedBox args={[0.3, 0.14, 0.26]} radius={0.04} position={[1.5, 0.76, 0.48]} material={mats.trim} />
        <mesh position={[1.65, 0.76, -0.5]} material={mats.trim}><cylinderGeometry args={[0.07, 0.07, 0.12, 20]} /></mesh>
        <mesh position={[0.86, 0.79, 0]} material={mats.trim}><boxGeometry args={[0.1, 0.06, 1.3]} /></mesh>
      </group>
      <group ref={tailgate} position={P.tailgate.pivot.toArray()} {...clickTg}>
        <mesh geometry={P.tailgate.outer} material={zoneMats.tailgate} castShadow={tierShadow} />
        {P.tailgate.inner && <mesh geometry={P.tailgate.inner} material={panelInner} />}
        <mesh geometry={spoilerGeo} material={mats.gloss} position={[-P.tailgate.pivot.x, -P.tailgate.pivot.y + 0.004, 0]} castShadow={tierShadow} />
        <mesh position={[pxX(1575) - P.tailgate.pivot.x, pxY(96) - P.tailgate.pivot.y, 0]} rotation={[0, 0, 0.6]} material={mats.brake}>
          <boxGeometry args={[0.006, 0.01, 0.3]} />
        </mesh>
      </group>
      <mesh geometry={finGeo} material={mats.paint} position={[0, 0.004, 0]} />

      {/* bandeau de pare-brise */}
      <mesh position={at(hits.banner, 0.006)} quaternion={hits.banner.q} scale={[1, 1, 1]}>
        <planeGeometry args={[1.0, 0.09]} />
        <meshBasicMaterial map={bannerTex} transparent depthWrite={false} toneMapped={false} />
      </mesh>

      {/* projecteurs : doubles anneaux LED + sourcil + clignotant */}
      {hits.rings.map(({ h }, i) => (
        <mesh key={i} position={at(h, 0.006)} quaternion={h.q} material={mats.headDrl}>
          <torusGeometry args={[0.042, 0.006, 8, 32]} />
        </mesh>
      ))}
      {hits.brows.map(({ s, h }) => (
        <mesh key={s} position={at(h, 0.004)} quaternion={h.q} rotation-z={s * -0.05} material={mats.headDrl}>
          <boxGeometry args={[0.3, 0.006, 0.004]} />
        </mesh>
      ))}
      {hits.blinkFront.map(({ s, h }) => (
        <mesh key={s} position={at(h, 0.004)} quaternion={h.q} material={s < 0 ? mats.blinkL : mats.blinkR}>
          <boxGeometry args={[0.18, 0.008, 0.004]} />
        </mesh>
      ))}
      {/* haricots : barrettes */}
      {hits.kidneys.map(({ s, h }) => (
        <group key={s} position={at(h, -0.004)} quaternion={h.q}>
          {Array.from({ length: 8 }).map((_, i) => (
            <mesh key={i} position={[-0.084 + i * 0.024, 0, 0]} material={mats.gloss}>
              <boxGeometry args={[0.007, 0.11, 0.014]} />
            </mesh>
          ))}
          {s < 0 && (
            <group position={[0.05, -0.045, 0.01]}>
              {[mats.mBlue, mats.mNavy, mats.mRed].map((m, i) => (
                <mesh key={i} position={[(i - 1) * 0.009, 0, 0]} material={m}><boxGeometry args={[0.007, 0.016, 0.003]} /></mesh>
              ))}
            </group>
          )}
        </group>
      ))}
      {hits.fogs.map(({ s, h }) => (
        <group key={s} position={at(h, 0.002)} quaternion={h.q}>
          <mesh material={mats.chrome}><circleGeometry args={[0.035, 24]} /></mesh>
          <mesh position={[0, 0, 0.002]} material={mats.lensClear}><circleGeometry args={[0.03, 24]} /></mesh>
        </group>
      ))}
      <mesh position={at(hits.plateF, 0.006)} quaternion={hits.plateF.q}>
        <planeGeometry args={[0.52, 0.11]} />
        <meshStandardMaterial map={plateTex} roughness={0.4} />
      </mesh>
      <mesh position={at(hits.plateR, 0.006)} quaternion={hits.plateR.q}>
        <planeGeometry args={[0.52, 0.11]} />
        <meshStandardMaterial map={plateTex} roughness={0.4} />
      </mesh>
      {/* anneau de remorquage rouge (côté droit) */}
      <group position={at(hits.tow, 0.02)} quaternion={hits.tow.q}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.towHook}><cylinderGeometry args={[0.012, 0.012, 0.05, 12]} /></mesh>
        <mesh position={[0, 0, 0.03]} rotation={[0, Math.PI / 2, 0]} material={mats.towHook}><torusGeometry args={[0.022, 0.008, 8, 20]} /></mesh>
      </group>
      {/* badges M d'aile */}
      {hits.badgesM.map(({ s, h }) => (
        <group key={s} position={at(h, 0.002)} quaternion={h.q}>
          {[mats.mBlue, mats.mNavy, mats.mRed].map((m, i) => (
            <mesh key={i} position={[(i - 1) * 0.011 * -s, 0, 0]} material={m}><boxGeometry args={[0.009, 0.02, 0.002]} /></mesh>
          ))}
        </group>
      ))}
      {/* feux arrière : barres LED en L + clignotants */}
      {hits.tailBars.map(({ s, h }) => (
        <group key={s} position={at(h, 0.004)} quaternion={h.q}>
          <mesh material={mats.brake}><boxGeometry args={[0.2, 0.01, 0.004]} /></mesh>
          <mesh position={[s * 0.09, -0.04, 0]} material={mats.brake}><boxGeometry args={[0.01, 0.08, 0.004]} /></mesh>
        </group>
      ))}
      {hits.blinkRear.map(({ s, h }) => (
        <mesh key={s} position={at(h, 0.004)} quaternion={h.q} material={s < 0 ? mats.blinkL : mats.blinkR}>
          <boxGeometry args={[0.16, 0.012, 0.004]} />
        </mesh>
      ))}
      {/* sortie d'échappement simple, côté gauche */}
      <group position={at(hits.exhaust, -0.03)}>
        <mesh rotation={[0, 0, Math.PI / 2]} material={mats.chrome}><cylinderGeometry args={[0.045, 0.045, 0.12, 28, 1, true]} /></mesh>
        <mesh position={[-0.055, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.trim}><cylinderGeometry args={[0.04, 0.04, 0.01, 24]} /></mesh>
      </group>

      {wheel(WHEELS.front.x, -1, 0, true)}
      {wheel(WHEELS.front.x, 1, 1, true)}
      {wheel(WHEELS.rear.x, -1, 2, false)}
      {wheel(WHEELS.rear.x, 1, 3, false)}

      {/* faisceaux (simulation visuelle uniquement) */}
      {tier !== 'low' &&
        [-1, 1].map((s) => (
          <spotLight key={s} ref={s < 0 ? spotL : spotR} position={[X_FRONT, 0.65, s * 0.55]} angle={0.42} penumbra={0.8} distance={14} decay={1.6} intensity={0} />
        ))}
      <mesh ref={groundGlow} position={[X_FRONT + 1.5, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.4, 2.6]} />
        <meshBasicMaterial map={tex.glow} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <group ref={glowSprites}>
        {hits.rings.map(({ h }, i) => (
          <sprite key={i} position={at(h, 0.03)} scale={[0.2, 0.2, 1]} material={spriteMat('#ffffff')} />
        ))}
      </group>
      <group ref={tailGlow}>
        {hits.tailBars.map(({ s, h }) => (
          <sprite key={`t${s}`} userData={{ kind: 'tail' }} position={at(h, 0.04)} scale={[0.4, 0.2, 1]} material={spriteMat('#ff2020')} />
        ))}
        {hits.blinkRear.map(({ s, h }) => (
          <sprite key={`b${s}`} userData={{ kind: s < 0 ? 'bl' : 'br' }} position={at(h, 0.04)} scale={[0.24, 0.14, 1]} material={spriteMat('#ff9000')} />
        ))}
        {hits.blinkFront.map(({ s, h }) => (
          <sprite key={`f${s}`} userData={{ kind: s < 0 ? 'bl' : 'br' }} position={at(h, 0.04)} scale={[0.22, 0.12, 1]} material={spriteMat('#ff9000')} />
        ))}
      </group>
    </group>
  );
}
