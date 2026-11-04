/**
 * Convention de nommage des nœuds attendus dans le modèle GLB définitif
 * (public/models/bmw_f21_lci.glb). Le pivot (origine) de chaque ouvrant doit être placé
 * sur sa charnière dans Blender. Voir docs/IMPORT_MODELE_3D.md.
 */
export interface OpeningNodeSpec {
  node: string;
  axis: 'x' | 'y' | 'z';
  /** angle d'ouverture en radians (signe = sens d'ouverture dans le repère du modèle) */
  angle: number;
  durationS: number;
}

export interface ModelManifest {
  file: string;
  /** mise à l'échelle et orientation pour respecter X = avant, Y = haut */
  scale: number;
  rotationY: number;
  openings: {
    driverDoor: OpeningNodeSpec;
    passengerDoor: OpeningNodeSpec;
    hood: OpeningNodeSpec;
    tailgate: OpeningNodeSpec;
  };
  wheels: { fl: string; fr: string; rl: string; rr: string; steerFl?: string; steerFr?: string };
  lights: { headlights: string[]; tail: string[]; brake: string[]; blinkLeft: string[]; blinkRight: string[] };
  /** matériaux à surcharger (nom de matériau GLB -> rôle) */
  materials: Record<string, 'paint' | 'gloss' | 'glass' | 'rim' | 'tyre' | 'chrome' | 'trim'>;
}

export const DEFAULT_MANIFEST: ModelManifest = {
  file: 'models/bmw_f21_lci.glb',
  scale: 1,
  rotationY: 0,
  openings: {
    driverDoor: { node: 'door_driver', axis: 'y', angle: -1.12, durationS: 1.15 },
    passengerDoor: { node: 'door_passenger', axis: 'y', angle: 1.12, durationS: 1.15 },
    hood: { node: 'hood', axis: 'z', angle: 0.92, durationS: 1.5 },
    tailgate: { node: 'tailgate', axis: 'z', angle: -1.22, durationS: 1.7 },
  },
  wheels: { fl: 'wheel_fl', fr: 'wheel_fr', rl: 'wheel_rl', rr: 'wheel_rr', steerFl: 'steer_fl', steerFr: 'steer_fr' },
  lights: {
    headlights: ['light_head_l', 'light_head_r'],
    tail: ['light_tail_l', 'light_tail_r'],
    brake: ['light_brake'],
    blinkLeft: ['blinker_fl', 'blinker_rl', 'blinker_mirror_l'],
    blinkRight: ['blinker_fr', 'blinker_rr', 'blinker_mirror_r'],
  },
  materials: { Paint: 'paint', BlackGloss: 'gloss', Glass: 'glass', Rim: 'rim', Tyre: 'tyre', Chrome: 'chrome', Trim: 'trim' },
};
