export type CameraPreset = 'front34' | 'rear34' | 'side' | 'front' | 'rear' | 'top' | 'wheel';

export interface CameraPose {
  label: string;
  position: [number, number, number];
  target: [number, number, number];
}

/** Repère : X = avant du véhicule, Y = haut, Z = droite (côté conducteur = −Z). */
export const CAMERA_PRESETS: Record<CameraPreset, CameraPose> = {
  front34: { label: '3/4 avant', position: [5.9, 1.75, -5.5], target: [0.1, 0.55, 0] },
  rear34: { label: '3/4 arrière', position: [-5.8, 2.0, -5.4], target: [-0.1, 0.6, 0] },
  side: { label: 'Profil', position: [0, 1.1, -9.2], target: [0, 0.62, 0] },
  front: { label: 'Face', position: [7.8, 1.25, 0], target: [0, 0.6, 0] },
  rear: { label: 'Arrière', position: [-7.8, 1.4, 0], target: [0, 0.65, 0] },
  top: { label: 'Dessus', position: [0.01, 10.5, 0.01], target: [0, 0, 0] },
  wheel: { label: 'Jante', position: [2.35, 0.55, -2.05], target: [1.36, 0.33, -0.78] },
};
