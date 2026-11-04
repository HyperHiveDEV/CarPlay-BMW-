import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { bake, type Role } from './glbBake';
import { useScene } from '../state/sceneStore';
import { blinkerIntensity, damp } from '../animations/easing';
import { createBannerTexture, createGlowTexture, createPlateTexture, type CarMaterials, type RenderTier } from './materials';

/**
 * Modèle GLB personnalisé « BMW_116i_F21_2018_maquette_3D.glb » (fourni par le propriétaire).
 *
 * Particularités du fichier (inspection du 04/11/2026, cf. docs/GLB_MAQUETTE_RAPPORT.md) :
 *  - généré par trimesh, axe Z vers le haut, Y latéral, X vers l'avant ; aucune normale,
 *    aucun matériau (couleurs par sommet), aucune animation ;
 *  - 123 maillages / 16 196 triangles, carrosserie en UNE seule pièce de 60 sommets :
 *    portières, capot et hayon ne sont pas séparables proprement (voir tools/blender) ;
 *  - l'échappement nommé « left » est placé côté y < 0, soit à DROITE en repère direct :
 *    le modèle est donc converti avec un miroir latéral (le reste est symétrique).
 *
 * Conversion : (x, y, z)_GLB → (x, z, y)_application (Y haut, Z droite, X avant).
 */

export const CUSTOM_GLB_URL = 'models/BMW_116i_F21_2018_maquette_3D.glb';

const HEAD_WHITE = new THREE.Color('#EAF2FF');
const HEAD_VIOLET = new THREE.Color('#B65CFF');

interface Props {
  mats: CarMaterials;
  tier: RenderTier;
  plateText: string;
  bannerText: string;
}

export function BMWF21GLB({ mats, tier, plateText, bannerText }: Props) {
  const gltf = useGLTF(CUSTOM_GLB_URL);
  const baked = useMemo(() => bake(gltf.scene), [gltf.scene]);

  // matériaux propres au GLB (vitres différenciées, verre de projecteur)
  const own = useMemo(() => {
    const physical = tier !== 'low';
    const glassFront = physical
      ? new THREE.MeshPhysicalMaterial({ color: '#2a3440', roughness: 0.03, metalness: 0, transparent: true, opacity: 0.38, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.4, side: THREE.DoubleSide, depthWrite: false })
      : new THREE.MeshStandardMaterial({ color: '#2a3440', roughness: 0.05, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
    const glassRear = physical
      ? new THREE.MeshPhysicalMaterial({ color: '#05070a', roughness: 0.03, metalness: 0, transparent: true, opacity: 0.9, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.4, side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ color: '#05070a', roughness: 0.05, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
    const headLens = new THREE.MeshPhysicalMaterial({ color: '#3a4048', roughness: 0.1, metalness: 0.9, clearcoat: 1, clearcoatRoughness: 0.02 });
    const seam = new THREE.MeshStandardMaterial({ color: '#16181b', roughness: 0.8 });
    const satin = new THREE.MeshStandardMaterial({ color: '#0d0f12', roughness: 0.45, metalness: 0.2 });
    // le fichier source mélange les sens de faces (coque vue « en transparence » de l'arrière) :
    // pièces opaques rendues en double face
    const ds = <T extends THREE.Material>(m: T) => { const c = m.clone() as T; c.side = THREE.DoubleSide; return c; };
    const paint = ds(mats.paint), gloss = ds(mats.gloss), mesh = ds(mats.plasticMesh), tyre = ds(mats.tyre);
    const rimInner = ds(mats.rimDark), rim = ds(mats.rim), chrome = ds(mats.chrome);
    seam.side = THREE.DoubleSide; satin.side = THREE.DoubleSide; headLens.side = THREE.DoubleSide;
    return { glassFront, glassRear, headLens, seam, satin, paint, gloss, mesh, tyre, rimInner, rim, chrome };
  }, [tier, mats]);
  useEffect(() => () => Object.values(own).forEach((m) => m.dispose()), [own]);
  useEffect(() => () => {
    baked.body.forEach((b) => b.geo.dispose());
    baked.wheels.forEach((w) => w.parts.forEach((p) => p.geo.dispose()));
  }, [baked]);

  const matOf = (role: Role): THREE.Material => {
    switch (role) {
      case 'paint': return own.paint;
      case 'seam': return own.seam;
      case 'glassFront': return own.glassFront;
      case 'glassRear': return own.glassRear;
      case 'mesh': return own.mesh;
      case 'tyre': return own.tyre;
      case 'rimInner': return own.rimInner;
      case 'rim': return own.rim;
      case 'hub': return own.satin;
      case 'headLens': return own.headLens;
      case 'drl': return mats.headDrl;
      case 'fog': return own.chrome;
      case 'tail': return mats.tail;
      case 'brake': return mats.brake;
      case 'chrome': return own.chrome;
      case 'plate': return own.paint;
      default: return own.gloss;
    }
  };

  const B = baked.boxes;
  const find = (needle: string) => Object.entries(B).filter(([k]) => k.includes(needle)).map(([, b]) => b);
  const tex = useMemo(() => ({ glow: createGlowTexture() }), []);
  const plateTex = useMemo(() => createPlateTexture(plateText), [plateText]);
  const bannerTex = useMemo(() => createBannerTexture(bannerText), [bannerText]);
  useEffect(() => () => { plateTex.dispose(); bannerTex.dispose(); tex.glow.dispose(); }, [plateTex, bannerTex, tex]);

  // repères d'accessoires dérivés des boîtes englobantes du GLB
  const anchors = useMemo(() => {
    const plateF = find('front plate')[0];
    const plateR = find('rear plate')[0];
    const ws = find('front windshield')[0];
    const diff = find('rear glossy diffuser')[0];
    const heads = find('led headlight');
    const tails = find('rear tail light');
    const mirrors = find('mirror');
    const rings = find('headlight led ring');
    return { plateF, plateR, ws, diff, heads, tails, mirrors, rings };
  }, [B]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    useScene.getState().set({
      modelStatus: 'glb',
      modelMessage: `GLB personnalisé : ${baked.stats.meshes} maillages, ${baked.stats.triangles} triangles → ${baked.stats.drawCalls} appels de rendu après fusion. Ouvrants non séparés.`,
      openingsSupported: false,
    });
    return () => useScene.getState().set({ openingsSupported: true });
  }, [baked]);

  // ---------------------------------------------------- animation (roues, feux)
  const wheelRefs = useRef<(THREE.Group | null)[]>([]);
  const steerRefs = useRef<(THREE.Group | null)[]>([]);
  const spotL = useRef<THREE.SpotLight>(null);
  const spotR = useRef<THREE.SpotLight>(null);
  const root = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Group>(null);
  const groundGlow = useRef<THREE.Mesh>(null);
  const anim = useMemo(() => ({ head: 0, tail: 0, brake: 0, spin: 0, angle: 0, steer: 0, color: new THREE.Color() }), []);
  useEffect(() => {
    [spotL.current, spotR.current].forEach((sp, i) => {
      if (!sp || !root.current) return;
      sp.target.position.set(9, -0.6, (i === 0 ? -1 : 1) * 1.2);
      root.current.add(sp.target);
    });
  }, [tier]);

  useFrame((state, dt) => {
    const s = useScene.getState();
    anim.spin = damp(anim.spin, s.wheelSpin ? 9 : 0, 1.6, dt);
    anim.angle -= anim.spin * dt;
    wheelRefs.current.forEach((w) => w && (w.rotation.z = anim.angle));
    anim.steer = damp(anim.steer, s.steer * 0.55, 5, dt);
    steerRefs.current.forEach((w) => w && (w.rotation.y = anim.steer));
    anim.head = damp(anim.head, s.lightMode === 'off' ? 0 : 1, 2.4, dt);
    anim.tail = damp(anim.tail, s.lightMode === 'off' ? 0 : 1, 3, dt);
    anim.brake = damp(anim.brake, s.brake ? 1 : 0, 14, dt);
    anim.color.lerp(s.lightMode === 'violet' ? HEAD_VIOLET : HEAD_WHITE, 1 - Math.exp(-6 * dt));
    mats.headDrl.emissive.copy(anim.color);
    mats.headDrl.emissiveIntensity = 0.05 + anim.head * 3.4;
    mats.tail.emissiveIntensity = 0.12 + anim.tail * 1.2 + anim.brake * 1.6;
    mats.brake.emissiveIntensity = anim.brake * 4 + anim.tail * 0.8;
    const bi = blinkerIntensity(state.clock.elapsedTime);
    const left = s.blinker === 'left' || s.blinker === 'hazard';
    const right = s.blinker === 'right' || s.blinker === 'hazard';
    mats.blinkL.emissiveIntensity = left ? bi * 4 : 0;
    mats.blinkR.emissiveIntensity = right ? bi * 4 : 0;
    for (const sp of [spotL.current, spotR.current]) if (sp) { sp.intensity = anim.head * 55; sp.color.copy(anim.color); }
    if (groundGlow.current) {
      const m = groundGlow.current.material as THREE.MeshBasicMaterial;
      m.opacity = anim.head * 0.55;
      m.color.copy(anim.color);
    }
    glow.current?.children.forEach((c) => {
      const m = (c as THREE.Sprite).material;
      m.opacity = anim.head * 0.85;
      m.color.copy(anim.color);
    });
  });

  const banner = useMemo(() => {
    const ws = anchors.ws;
    if (!ws) return null;
    // pare-brise : du bas (x max, y min) au haut (x min, y max)
    const n = new THREE.Vector3(ws.max.y - ws.min.y, ws.max.x - ws.min.x, 0).normalize();
    const t = 0.88;
    const pos = new THREE.Vector3(ws.max.x + (ws.min.x - ws.max.x) * t, ws.min.y + (ws.max.y - ws.min.y) * t, 0).addScaledVector(n, 0.008);
    const xa = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), n).normalize();
    const ya = new THREE.Vector3().crossVectors(n, xa).normalize();
    return { pos: pos.toArray() as [number, number, number], q: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xa, ya, n)) };
  }, [anchors.ws]);
  const center = (b?: THREE.Box3) => (b ? b.getCenter(new THREE.Vector3()) : new THREE.Vector3());
  const spriteMat = () => new THREE.SpriteMaterial({ map: tex.glow, color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const front = anchors.plateF ? anchors.plateF.max.x : 2.2;

  return (
    <group ref={root} name="BMW_F21_GLB_personnalise">
      {baked.body.map(({ role, geo }) => (
        <mesh key={role} geometry={geo} material={matOf(role)} castShadow={tier !== 'low'} renderOrder={role === 'glassFront' ? 2 : 0} />
      ))}
      {baked.wheels.map((w, i) => {
        const content = (
          <group ref={(g) => (wheelRefs.current[i] = g)}>
            {w.parts.map(({ role, geo }) => <mesh key={role} geometry={geo} material={matOf(role)} castShadow={tier !== 'low'} />)}
          </group>
        );
        return (
          <group key={w.key} position={w.center.toArray()}>
            {w.front ? <group ref={(g) => (steerRefs.current[i] = g)}>{content}</group> : content}
          </group>
        );
      })}

      {/* ajouts de l'application : éléments du véhicule absents du GLB */}
      {anchors.plateF && (
        <mesh position={[anchors.plateF.max.x + 0.002, center(anchors.plateF).y, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[anchors.plateF.max.z - anchors.plateF.min.z, anchors.plateF.max.y - anchors.plateF.min.y]} />
          <meshStandardMaterial map={plateTex} roughness={0.4} />
        </mesh>
      )}
      {anchors.plateR && (
        <mesh position={[anchors.plateR.min.x - 0.002, center(anchors.plateR).y, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[anchors.plateR.max.z - anchors.plateR.min.z, anchors.plateR.max.y - anchors.plateR.min.y]} />
          <meshStandardMaterial map={plateTex} roughness={0.4} />
        </mesh>
      )}
      {anchors.ws && banner && (
        // bandeau M Performance en haut du pare-brise (plan incliné du GLB)
        <mesh position={banner.pos} quaternion={banner.q}>
          <planeGeometry args={[1.0, 0.07]} />
          <meshBasicMaterial map={bannerTex} transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* anneau de remorquage rouge, côté droit du bouclier */}
      {anchors.plateF && (
        <group position={[front + 0.01, center(anchors.plateF).y - 0.02, 0.34]}>
          <mesh rotation={[0, 0, Math.PI / 2]} material={mats.towHook}><cylinderGeometry args={[0.012, 0.012, 0.05, 12]} /></mesh>
          <mesh position={[0.03, 0, 0]} rotation={[0, Math.PI / 2, 0]} material={mats.towHook}><torusGeometry args={[0.022, 0.008, 8, 20]} /></mesh>
        </group>
      )}
      {/* feu central rouge du diffuseur */}
      {anchors.diff && (
        <mesh position={[anchors.diff.min.x - 0.004, center(anchors.diff).y, 0]} rotation={[0, -Math.PI / 2, Math.PI / 4]} material={mats.brake}>
          <planeGeometry args={[0.05, 0.05]} />
        </mesh>
      )}
      {/* clignotants (absents du GLB) : bas des projecteurs, feux arrière, rétroviseurs */}
      {anchors.heads.map((b, i) => {
        const c = center(b);
        return (
          <mesh key={`hb${i}`} position={[b.max.x - 0.06, b.min.y + 0.012, c.z]} material={c.z < 0 ? mats.blinkL : mats.blinkR}>
            <boxGeometry args={[0.12, 0.01, Math.abs(b.max.z - b.min.z) * 0.6]} />
          </mesh>
        );
      })}
      {anchors.tails.map((b, i) => {
        const c = center(b);
        return (
          <mesh key={`tb${i}`} position={[b.min.x - 0.003, b.min.y + 0.02, c.z]} material={c.z < 0 ? mats.blinkL : mats.blinkR}>
            <boxGeometry args={[0.006, 0.014, Math.abs(b.max.z - b.min.z) * 0.5]} />
          </mesh>
        );
      })}
      {anchors.mirrors.map((b, i) => {
        const c = center(b);
        return (
          <mesh key={`mb${i}`} position={[c.x + 0.04, b.min.y + 0.004, c.z]} material={c.z < 0 ? mats.blinkL : mats.blinkR}>
            <boxGeometry args={[0.08, 0.006, Math.abs(b.max.z - b.min.z) * 0.6]} />
          </mesh>
        );
      })}

      {tier !== 'low' && [-1, 1].map((s) => (
        <spotLight key={s} ref={s < 0 ? spotL : spotR} position={[front - 0.05, 0.9, s * 0.6]} angle={0.42} penumbra={0.8} distance={14} decay={1.6} intensity={0} />
      ))}
      <mesh ref={groundGlow} position={[front + 1.5, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.4, 2.6]} />
        <meshBasicMaterial map={tex.glow} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <group ref={glow}>
        {anchors.rings.map((b, i) => (
          <sprite key={i} position={center(b).add(new THREE.Vector3(0.05, 0, 0)).toArray()} scale={[0.2, 0.2, 1]} material={spriteMat()} />
        ))}
      </group>
    </group>
  );
}

