import { create } from 'zustand';
import type { OpeningKey } from '../vehicle/types';
import type { CameraPreset } from '../three/cameraPresets';

export type LightMode = 'off' | 'white' | 'violet';
export type Blinker = 'off' | 'left' | 'right' | 'hazard';
export type ModelStatus = 'loading' | 'procedural' | 'glb' | 'error';

/**
 * État VISUEL de la scène 3D. Aucune de ces valeurs n'est transmise au véhicule :
 * ouvrir une portière ici n'envoie aucune commande.
 */
interface SceneState {
  openings: Record<OpeningKey, boolean>;
  lightMode: LightMode;
  blinker: Blinker;
  brake: boolean;
  wheelSpin: boolean;
  steer: number; // −1 … 1
  camera: CameraPreset;
  cameraNonce: number;
  hovered: OpeningKey | null;
  modelStatus: ModelStatus;
  modelMessage?: string;
  introDone: boolean;
  /** faux si le modèle affiché n'a pas d'ouvrants séparés (GLB maquette) */
  openingsSupported: boolean;
  fps: number;
  dprScale: number;
  toggle: (k: OpeningKey) => void;
  closeAll: () => void;
  set: (p: Partial<SceneState>) => void;
  goCamera: (c: CameraPreset) => void;
}

export const useScene = create<SceneState>((set) => ({
  openings: { driverDoor: false, passengerDoor: false, hood: false, tailgate: false },
  lightMode: 'off',
  blinker: 'off',
  brake: false,
  wheelSpin: false,
  steer: 0,
  camera: 'front34',
  cameraNonce: 0,
  hovered: null,
  modelStatus: 'loading',
  introDone: false,
  openingsSupported: true,
  fps: 0,
  dprScale: 1,
  toggle: (k) => set((s) => ({ openings: { ...s.openings, [k]: !s.openings[k] } })),
  closeAll: () => set({ openings: { driverDoor: false, passengerDoor: false, hood: false, tailgate: false } }),
  set: (p) => set(p),
  goCamera: (c) => set((s) => ({ camera: c, cameraNonce: s.cameraNonce + 1 })),
}));

export const OPENING_LABEL: Record<OpeningKey, string> = {
  driverDoor: 'Portière conducteur',
  passengerDoor: 'Portière passager',
  hood: 'Capot',
  tailgate: 'Hayon',
};
