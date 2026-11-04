import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, MeshReflectorMaterial, OrbitControls, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useScene } from '../state/sceneStore';
import { useSettings } from '../settings/settingsStore';
import { createMaterials, type RenderTier } from './materials';
import { RealisticF21 } from './RealisticF21';
import { GlbCar } from './GlbCar';
import { CAMERA_PRESETS } from './cameraPresets';
import { DEFAULT_MANIFEST, type ModelManifest } from './modelManifest';
import { smoothstep } from '../animations/easing';

export const INTRO_DURATION = 3.6;

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
      <ContactShadows position={[0, 0.002, 0]} opacity={0.85} scale={9} blur={2.4} far={1.6} resolution={tier === 'low' ? 256 : 512} frames={tier === 'low' ? 1 : Infinity} color="#000" />
    </>
  );
}

class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: Error) {
    useScene.getState().set({ modelStatus: 'error', modelMessage: `GLB illisible : ${e.message}` });
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
  const manifest = useModelManifest();
  const [pageHidden, setPageHidden] = useState(document.hidden);

  useEffect(() => {
    const h = () => setPageHidden(document.hidden);
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, []);
  useEffect(() => {
    if (manifest === null) useScene.getState().set({ modelStatus: 'procedural', modelMessage: 'Reconstitution d’après la photo de profil (aucun GLB fourni)' });
  }, [manifest]);

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
          {manifest ? (
            <ModelBoundary fallback={procedural}>
              <GlbCar manifest={manifest} mats={mats} interactive={interactive} />
            </ModelBoundary>
          ) : manifest === null ? (
            procedural
          ) : null}
        </Suspense>
        <CameraRig enabled={interactive && !introActive} introActive={introActive} />
        <IntroDirector active={introActive} onDone={onIntroDone} env={env} />
        <ViewShift shift={shift} />
        <FpsProbe />
      </Canvas>
    </div>
  );
}
