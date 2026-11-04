import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, MeshReflectorMaterial, OrbitControls, OrthographicCamera, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useScene } from '../state/sceneStore';
import { useSettings } from '../settings/settingsStore';
import { createMaterials, type RenderTier } from './materials';
import { RealisticF21 } from './RealisticF21';
import { ProceduralF21 } from './ProceduralF21';
import { BMWF21GLB } from './BMWF21GLB';
import type { ModelChoice } from '../settings/settingsStore';
import { GlbCar } from './GlbCar';
import { CAMERA_PRESETS } from './cameraPresets';
import { DEFAULT_MANIFEST, missingValidation, type ModelManifest } from './modelManifest';
import { smoothstep } from '../animations/easing';

export const INTRO_DURATION = 3.6;

/**
 * Outil de calage : `?ortho=side|front|rear|top` affiche une vue orthographique (1 m = 300 px)
 * pour superposer le rendu aux photographies de référence (voir docs/IMPORT_MODELE_3D.md).
 */
const ORTHO = new URLSearchParams(location.search).get('ortho');
const ORTHO_POS: Record<string, [number, number, number]> = {
  side: [0, 0.7, -10], right: [0, 0.7, 10], front: [10, 0.7, 0], rear: [-10, 0.7, 0], top: [0, 10, 0.0001],
};

/** Choix du niveau de rendu : réglage utilisateur, ou heuristique matérielle en mode auto. */
export function resolveTier(q: string, degraded: number): RenderTier {
  if (q === 'low' || q === 'medium' || q === 'high') return q;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  let base: RenderTier = mem >= 6 && cores >= 8 ? 'high' : mem >= 3 ? 'medium' : 'low';
  if (degraded >= 1 && base === 'high') base = 'medium';
  if (degraded >= 2) base = 'low';
  return base;
}

/** Transitions de caméra fluides vers les préréglages, interrompues dès que l'utilisateur manipule. */
function CameraRig({ enabled, introActive }: { enabled: boolean; introActive: boolean }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const settings = useSettings();
  const nonce = useScene((s) => s.cameraNonce);
  const preset = useScene((s) => s.camera);
  const animating = useRef(true);
  const goal = useMemo(() => ({ pos: new THREE.Vector3(), target: new THREE.Vector3() }), []);

  useEffect(() => {
    const p = CAMERA_PRESETS[preset];
    goal.pos.set(...p.position);
    goal.target.set(...p.target);
    animating.current = true;
  }, [nonce, preset, goal]);

  // commandes d'orbite (molette / clavier) : rotation et zoom autour de la cible, transition douce
  const orbitCmd = useScene((s) => s.orbitCmd);
  useEffect(() => {
    if (!orbitCmd.n || !controls.current) return;
    const target = animating.current ? goal.target.clone() : controls.current.target.clone();
    const from = animating.current ? goal.pos.clone() : camera.position.clone();
    const sph = new THREE.Spherical().setFromVector3(from.sub(target));
    sph.theta += orbitCmd.dAz;
    sph.phi = THREE.MathUtils.clamp(sph.phi + orbitCmd.dPol, 0.15, Math.PI / 2 - 0.04);
    sph.radius = THREE.MathUtils.clamp(sph.radius * orbitCmd.zoom, 2.4, 13);
    goal.pos.copy(new THREE.Vector3().setFromSpherical(sph).add(target));
    goal.target.copy(target);
    animating.current = true;
  }, [orbitCmd, camera, goal]);

  useEffect(() => {
    // position de départ de l'intro : plus loin et décalée
    const p = CAMERA_PRESETS[useScene.getState().camera];
    camera.position.set(p.position[0] * 1.5, p.position[1] + 0.8, p.position[2] * 0.5 - 2.5);
  }, [camera]);

  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    if (animating.current) {
      const k = 1 - Math.exp(-(introActive ? 1.4 : 3.2) * Math.min(dt, 0.05));
      camera.position.lerp(goal.pos, k);
      c.target.lerp(goal.target, k);
      if (camera.position.distanceTo(goal.pos) < 0.01 && c.target.distanceTo(goal.target) < 0.01) animating.current = false;
    }
    c.update();
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enabled={enabled}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={settings.rotateSensitivity}
      zoomSpeed={0.7}
      minDistance={2.4}
      maxDistance={13}
      minPolarAngle={0.15}
      maxPolarAngle={Math.PI / 2 - 0.04}
      autoRotate={settings.autoRotate && enabled && !introActive}
      autoRotateSpeed={0.35}
      onStart={() => (animating.current = false)}
    />
  );
}

/** Séquence d'accueil : silhouette → éclairage studio → phares → rotation → interface. */
function IntroDirector({ active, onDone, env }: { active: boolean; onDone: () => void; env: { intensity: number } }) {
  const t0 = useRef<number | null>(null);
  const lit = useRef(false);
  useFrame((state) => {
    if (!active) {
      env.intensity = 1;
      return;
    }
    if (t0.current === null) t0.current = state.clock.elapsedTime;
    const t = state.clock.elapsedTime - t0.current;
    env.intensity = 0.04 + smoothstep(0.5, 2.0, t) * 0.96;
    if (!lit.current && t > 1.3) {
      lit.current = true;
      useScene.getState().set({ lightMode: 'violet' });
    }
    if (t > INTRO_DURATION) onDone();
  });
  return null;
}

/** Applique un décalage de projection pour placer la voiture à droite des panneaux d'info. */
function ViewShift({ shift }: { shift: number }) {
  const { camera, size } = useThree();
  const cur = useRef(shift);
  useFrame((_, dt) => {
    cur.current += (shift - cur.current) * (1 - Math.exp(-6 * Math.min(dt, 0.05)));
    const cam = camera as THREE.PerspectiveCamera;
    if (Math.abs(cur.current) < 0.001) {
      if (cam.view) cam.clearViewOffset();
      return;
    }
    cam.setViewOffset(size.width, size.height, -cur.current * size.width, 0, size.width, size.height);
  });
  return null;
}

function FpsProbe() {
  const acc = useRef({ n: 0, t: 0 });
  useFrame((_, dt) => {
    acc.current.n++;
    acc.current.t += dt;
    if (acc.current.t > 1) {
      useScene.getState().set({ fps: Math.round(acc.current.n / acc.current.t) });
      acc.current = { n: 0, t: 0 };
    }
  });
  return null;
}

function Studio({ tier, env }: { tier: RenderTier; env: { intensity: number } }) {
  const amb = useRef<THREE.AmbientLight>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const { scene } = useThree();
  useFrame(() => {
    if (amb.current) amb.current.intensity = 0.25 * env.intensity;
    if (key.current) key.current.intensity = 1.6 * env.intensity;
    scene.environmentIntensity = env.intensity;
  });
  return (
    <>
      <ambientLight ref={amb} intensity={0.25} />
      <directionalLight ref={key} position={[3, 6, -4]} intensity={1.6} />
      <Environment resolution={tier === 'high' ? 512 : tier === 'medium' ? 256 : 128} frames={1}>
        <color attach="background" args={['#050608']} />
        <Lightformer form="rect" intensity={2.4} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[10, 3, 1]} />
        {/* lattes de plafond : reflets nets sur capot et pavillon */}
        {[-2.4, -1.2, 1.2, 2.4].map((z) => (
          <Lightformer key={z} form="rect" intensity={1.4} position={[0, 5, z]} rotation-x={Math.PI / 2} scale={[9, 0.25, 1]} />
        ))}
        {/* bandes latérales fines : ligne de reflet le long des flancs */}
        <Lightformer form="rect" intensity={3} position={[0, 1.1, -7]} scale={[16, 0.12, 1]} />
        <Lightformer form="rect" intensity={3} position={[0, 1.1, 7]} rotation-y={Math.PI} scale={[16, 0.12, 1]} />
        <Lightformer form="rect" intensity={1.6} position={[0, 3, -8]} scale={[14, 1.2, 1]} />
        <Lightformer form="rect" intensity={1.6} position={[0, 3, 8]} rotation-y={Math.PI} scale={[14, 1.2, 1]} />
        <Lightformer form="rect" intensity={1.0} position={[9, 2, 0]} rotation-y={-Math.PI / 2} scale={[6, 2, 1]} />
        <Lightformer form="rect" intensity={0.7} position={[-9, 2, 0]} rotation-y={Math.PI / 2} scale={[6, 2, 1]} />
        <Lightformer form="ring" color="#A855F7" intensity={0.6} position={[-6, 4, -6]} scale={3} />
        <Lightformer form="ring" color="#168BFF" intensity={0.4} position={[6, 4, 6]} scale={3} />
      </Environment>
      {tier === 'high' ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <circleGeometry args={[14, 64]} />
          <MeshReflectorMaterial
            resolution={512}
            mirror={0.5}
            blur={[400, 120]}
            mixBlur={1}
            mixStrength={1.4}
            roughness={0.85}
            depthScale={0.6}
            minDepthThreshold={0.6}
            maxDepthThreshold={1.2}
            color="#0b0d11"
            metalness={0.4}
          />
        </mesh>
      ) : (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[14, 48]} />
          <meshStandardMaterial color="#0b0d11" roughness={0.7} metalness={0.2} />
        </mesh>
      )}
      {/* plateforme : anneau discret sous le véhicule */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
        <ringGeometry args={[3.05, 3.09, 128]} />
        <meshBasicMaterial color="#5a6b85" transparent opacity={0.35} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <circleGeometry args={[3.05, 96]} />
        <meshStandardMaterial color="#121620" roughness={0.6} metalness={0.3} transparent opacity={0.55} />
      </mesh>
      <ContactShadows position={[0, 0.004, 0]} opacity={0.85} scale={9} blur={2.4} far={1.6} resolution={tier === 'low' ? 256 : 512} frames={tier === 'low' ? 1 : Infinity} color="#000" />
    </>
  );
}

/** Repli automatique : si un GLB ne peut pas être chargé, le modèle de secours est affiché. */
class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: Error) {
    useScene.getState().set({ modelStatus: 'error', modelMessage: `GLB non chargé (${e.message}) — repli sur la reconstitution RealisticF21`, openingsSupported: true });
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Détecte la présence du modèle GLB définitif ; à défaut, la reconstitution d'après photo est utilisée. */
function useModelManifest() {
  const [manifest, setManifest] = useState<ModelManifest | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('models/model-manifest.json', { cache: 'no-store' }).catch(() => null);
        const custom = r?.ok ? await r.json().catch(() => ({})) : {};
        const m = { ...DEFAULT_MANIFEST, ...custom } as ModelManifest;
        const head = await fetch(m.file, { method: 'HEAD' });
        const ok = head.ok && !(head.headers.get('content-type') ?? '').includes('text/html');
        // verrou : le modèle définitif n'est utilisé qu'une fois les critères validés dans le manifeste
        const missing = ok ? missingValidation(m.validation) : [];
        if (ok && missing.length) {
          if (!cancelled) {
            useScene.getState().set({ modelMessage: `Modèle ${m.file} présent mais non validé (${missing.join(', ')}) — RealisticF21 affiché` });
            setManifest(null);
          }
          return;
        }
        if (!cancelled) setManifest(ok ? m : null);
      } catch {
        if (!cancelled) setManifest(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return manifest;
}

export interface CarSceneProps {
  visible: boolean;
  interactive: boolean;
  shift: number;
  introActive: boolean;
  onIntroDone: () => void;
}

export function CarScene({ visible, interactive, shift, introActive, onIntroDone }: CarSceneProps) {
  const quality = useSettings((s) => s.quality);
  const vehicle = useSettings((s) => s.vehicle);
  const [degraded, setDegraded] = useState(0);
  const tier = resolveTier(quality, degraded);
  const mats = useMemo(() => createMaterials(tier), [tier]);
  const env = useMemo(() => ({ intensity: introActive ? 0.04 : 1 }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const modelSource = useSettings((s) => s.modelSource);
  // ?model=custom|realistic|legacy|auto : forcer un modèle (comparaisons, captures)
  const choice = ((new URLSearchParams(location.search).get('model') as ModelChoice | null) ?? modelSource) as ModelChoice;
  const detected = useModelManifest();
  const manifest = choice === 'auto' ? detected : null;
  const [pageHidden, setPageHidden] = useState(document.hidden);

  useEffect(() => {
    const h = () => setPageHidden(document.hidden);
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, []);
  useEffect(() => {
    if (choice === 'legacy') useScene.getState().set({ modelStatus: 'procedural', modelMessage: 'Ancien modèle de secours (ProceduralF21)', openingsSupported: true });
    else if (choice === 'realistic' || (choice === 'auto' && manifest === null)) {
      const prev = useScene.getState().modelMessage ?? '';
      useScene.getState().set({
        modelStatus: 'procedural',
        modelMessage: prev.includes('non validé') ? prev : 'Reconstitution RealisticF21 d’après les photos (en attente du modèle définitif)',
        openingsSupported: true,
      });
    }
  }, [manifest, choice]);

  const dpr: [number, number] = tier === 'high' ? [1, 2] : tier === 'medium' ? [1, 1.5] : [0.75, 1];
  const procedural = (
    <RealisticF21 mats={mats} tier={tier} interactive={interactive} plateText={vehicle.plateText} bannerText={vehicle.windshieldBanner} />
  );

  return (
    <div className="absolute inset-0 transition-opacity duration-700" style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' }}>
      <Canvas
        key={tier}
        frameloop={visible && !pageHidden ? 'always' : 'never'}
        dpr={dpr}
        shadows={false}
        gl={{ antialias: tier !== 'low', powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        camera={{ fov: 32, near: 0.1, far: 60, position: [7, 2.4, -5] }}
        onPointerMissed={() => useScene.getState().set({ hovered: null })}
      >
        <color attach="background" args={['#080A0D']} />
        <fog attach="fog" args={['#080A0D', 12, 26]} />
        <PerformanceMonitor onDecline={() => quality === 'auto' && setDegraded((d) => Math.min(2, d + 1))} flipflops={2} />
        <Studio tier={tier} env={env} />
        <Suspense fallback={null}>
          {choice === 'legacy' ? (
            <ProceduralF21 mats={mats} tier={tier} interactive={interactive} plateText={vehicle.plateText} bannerText={vehicle.windshieldBanner} />
          ) : choice === 'custom' ? (
            <ModelBoundary key="custom" fallback={procedural}>
              <BMWF21GLB mats={mats} tier={tier} plateText={vehicle.plateText} bannerText={vehicle.windshieldBanner} />
            </ModelBoundary>
          ) : manifest ? (
            <ModelBoundary key="licensed" fallback={procedural}>
              <GlbCar manifest={manifest} mats={mats} interactive={interactive} />
            </ModelBoundary>
          ) : choice === 'realistic' || manifest === null ? (
            procedural
          ) : null}
        </Suspense>
        {ORTHO ? (
          <OrthographicCamera makeDefault zoom={300} position={ORTHO_POS[ORTHO] ?? ORTHO_POS.side} onUpdate={(c) => c.lookAt(0, ORTHO_POS[ORTHO]?.[1] ?? 0.7, 0)} />
        ) : (
          <CameraRig enabled={interactive && !introActive} introActive={introActive} />
        )}
        <IntroDirector active={introActive} onDone={onIntroDone} env={env} />
        <ViewShift shift={ORTHO ? 0 : shift} />
        <FpsProbe />
      </Canvas>
    </div>
  );
}
