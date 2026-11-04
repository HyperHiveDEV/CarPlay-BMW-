import { useEffect, useMemo } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useScene } from '../state/sceneStore';
import { OpeningAnimator } from '../animations/OpeningAnimator';
import { blinkerIntensity, damp } from '../animations/easing';
import type { OpeningKey } from '../vehicle/types';
import type { CarMaterials } from './materials';
import type { ModelManifest } from './modelManifest';

/**
 * Chargeur du modèle définitif (GLB). Applique les matériaux PBR de l'application selon
 * le manifeste et anime les nœuds articulés (rotation autour de leur pivot = charnière).
 */
export function GlbCar({ manifest, mats, interactive }: { manifest: ModelManifest; mats: CarMaterials; interactive: boolean }) {
  const gltf = useGLTF(manifest.file, false); // pas de décodeur Draco (CDN) : fonctionnement hors ligne
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  const nodes = useMemo(() => {
    const find = (n?: string) => (n ? scene.getObjectByName(n) ?? null : null);
    const openings = Object.fromEntries(
      (Object.keys(manifest.openings) as OpeningKey[]).map((k) => {
        const spec = manifest.openings[k];
        const obj = find(spec.node);
        return [k, { spec, obj, base: obj ? obj.rotation[spec.axis] : 0, anim: new OpeningAnimator(spec.durationS) }];
      }),
    ) as Record<OpeningKey, { spec: ModelManifest['openings'][OpeningKey]; obj: THREE.Object3D | null; base: number; anim: OpeningAnimator }>;
    const w = manifest.wheels;
    return {
      openings,
      wheels: [w.fl, w.fr, w.rl, w.rr].map(find),
      steer: [find(w.steerFl), find(w.steerFr)],
      missing: [
        ...Object.values(manifest.openings).map((s) => s.node),
        w.fl, w.fr, w.rl, w.rr,
      ].filter((n) => !find(n)),
    };
  }, [scene, manifest]);

  useEffect(() => {
    const roleMap: Record<string, THREE.Material> = {
      paint: mats.paint, gloss: mats.gloss, glass: mats.glass, rim: mats.rim, tyre: mats.tyre, chrome: mats.chrome, trim: mats.trim,
    };
    const emissiveByNode = (names: string[], m: THREE.Material) =>
      names.forEach((n) => scene.getObjectByName(n)?.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = m; }));
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      const name = (mesh.material as THREE.Material)?.name;
      const role = name ? manifest.materials[name] : undefined;
      if (role) mesh.material = roleMap[role];
    });
    emissiveByNode(manifest.lights.headlights, mats.headDrl);
    emissiveByNode(manifest.lights.tail, mats.tail);
    emissiveByNode(manifest.lights.brake, mats.brake);
    emissiveByNode(manifest.lights.blinkLeft, mats.blinkL);
    emissiveByNode(manifest.lights.blinkRight, mats.blinkR);
    useScene.getState().set({
      modelStatus: 'glb',
      modelMessage: nodes.missing.length ? `Nœuds absents : ${nodes.missing.join(', ')}` : 'Modèle GLB chargé',
    });
  }, [scene, mats, manifest, nodes]);

  const anim = useMemo(() => ({ head: 0, tail: 0, brake: 0, spin: 0, angle: 0, steer: 0, color: new THREE.Color() }), []);
  useFrame((state, dt) => {
    const s = useScene.getState();
    for (const k of Object.keys(nodes.openings) as OpeningKey[]) {
      const o = nodes.openings[k];
      if (!o.obj) continue;
      o.obj.rotation[o.spec.axis] = o.base + o.anim.update(s.openings[k], dt) * o.spec.angle;
    }
    anim.spin = damp(anim.spin, s.wheelSpin ? 9 : 0, 1.6, dt);
    anim.angle -= anim.spin * dt;
    nodes.wheels.forEach((w) => w && (w.rotation.z = anim.angle));
    anim.steer = damp(anim.steer, s.steer * 0.55, 5, dt);
    nodes.steer.forEach((w) => w && (w.rotation.y = anim.steer));
    anim.head = damp(anim.head, s.lightMode === 'off' ? 0 : 1, 2.4, dt);
    anim.brake = damp(anim.brake, s.brake ? 1 : 0, 14, dt);
    anim.color.set(s.lightMode === 'violet' ? '#B65CFF' : '#EAF2FF');
    mats.headDrl.emissive.copy(anim.color);
    mats.headDrl.emissiveIntensity = anim.head * 3.2;
    mats.tail.emissiveIntensity = 0.15 + anim.head * 1.6 + anim.brake * 1.5;
    mats.brake.emissiveIntensity = anim.brake * 4;
    const bi = blinkerIntensity(state.clock.elapsedTime);
    mats.blinkL.emissiveIntensity = s.blinker === 'left' || s.blinker === 'hazard' ? bi * 4 : 0;
    mats.blinkR.emissiveIntensity = s.blinker === 'right' || s.blinker === 'hazard' ? bi * 4 : 0;
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!interactive || e.delta > 6) return;
    let o: THREE.Object3D | null = e.object;
    while (o) {
      const hit = (Object.keys(nodes.openings) as OpeningKey[]).find((k) => nodes.openings[k].obj === o);
      if (hit) return useScene.getState().toggle(hit);
      o = o.parent;
    }
  };

  return (
    <group scale={manifest.scale} rotation={[0, manifest.rotationY, 0]} onClick={onClick}>
      <primitive object={scene} />
    </group>
  );
}
