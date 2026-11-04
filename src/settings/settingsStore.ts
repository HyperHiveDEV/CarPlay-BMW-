import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CameraPreset } from '../three/cameraPresets';

export type Quality = 'auto' | 'low' | 'medium' | 'high';
export type Accent = 'blue' | 'violet';
export type ThemeMode = 'night' | 'day';
export type DataSourcePref = 'demo' | 'obd';
/**
 * auto : modèle sous licence public/models/bmw_f21_lci.glb s'il existe, sinon RealisticF21 ;
 * custom : GLB personnalisé BMW_116i_F21_2018_maquette_3D.glb (candidat) ;
 * realistic : reconstitution procédurale d'après photos ; legacy : ancien modèle de secours.
 */
export type ModelChoice = 'auto' | 'custom' | 'realistic' | 'legacy';
export type Transmission = 'unknown' | 'manual6' | 'auto8';

export interface VehicleSpec {
  name: string;
  generation: string;
  engine: string;
  displacementCc: number;
  cylinders: number;
  stage: string;
  stockHp: number;
  declaredHp: number;
  transmission: Transmission;
  /** Kilométrage saisi par l'utilisateur (aucune source fiable automatique). */
  mileageKm: number | null;
  mileageUpdatedAt: string | null;
  plateText: string;
  windshieldBanner: string;
}

export interface Settings {
  accent: Accent;
  theme: ThemeMode;
  quality: Quality;
  introEnabled: boolean;
  defaultCamera: CameraPreset;
  rotateSensitivity: number; // 0.2 – 2
  autoRotate: boolean;
  units: 'metric';
  dataSource: DataSourcePref;
  lastObdAddress: string | null;
  lastObdName: string | null;
  diagnostics: boolean;
  /** Modèle 3D affiché (voir docs/GLB_MAQUETTE_RAPPORT.md) */
  modelSource: ModelChoice;
  vehicle: VehicleSpec;
}

export const DEFAULT_VEHICLE: VehicleSpec = {
  name: 'BMW 116i',
  generation: 'F21 LCI',
  engine: 'B38',
  displacementCc: 1499,
  cylinders: 3,
  stage: 'Stage 1',
  stockHp: 109,
  declaredHp: 170,
  transmission: 'unknown',
  mileageKm: null,
  mileageUpdatedAt: null,
  plateText: 'F21 · LCI',
  windshieldBanner: 'M PERFORMANCE',
};

export const DEFAULT_SETTINGS: Settings = {
  accent: 'violet',
  theme: 'night',
  quality: 'auto',
  introEnabled: true,
  defaultCamera: 'front34',
  rotateSensitivity: 0.8,
  autoRotate: true,
  units: 'metric',
  dataSource: 'demo',
  lastObdAddress: null,
  lastObdName: null,
  diagnostics: false,
  modelSource: 'auto',
  vehicle: DEFAULT_VEHICLE,
};

interface SettingsStore extends Settings {
  set: (patch: Partial<Settings>) => void;
  setVehicle: (patch: Partial<VehicleSpec>) => void;
  reset: () => void;
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (patch) => set(patch),
      setVehicle: (patch) => set((s) => ({ vehicle: { ...s.vehicle, ...patch } })),
      reset: () => set({ ...DEFAULT_SETTINGS }),
    }),
    {
      name: 'f21.settings.v1',
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Settings>;
        const modelSource = (['auto', 'custom', 'realistic', 'legacy'] as string[]).includes(p.modelSource as string) ? p.modelSource : 'auto';
        return { ...current, ...p, modelSource, vehicle: { ...DEFAULT_VEHICLE, ...(p.vehicle ?? {}) } } as typeof current;
      },
    },
  ),
);

export const TRANSMISSION_LABEL: Record<Transmission, string> = {
  unknown: 'À confirmer',
  manual6: 'Manuelle 6 rapports',
  auto8: 'Automatique 8 rapports (Steptronic)',
};
