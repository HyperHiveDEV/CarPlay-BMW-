import * as THREE from 'three';

export type RenderTier = 'low' | 'medium' | 'high';

/** Matériaux PBR partagés (instanciés une fois par niveau de qualité). */
export function createMaterials(tier: RenderTier) {
  const physical = tier !== 'low';
  const paint = physical
    ? new THREE.MeshPhysicalMaterial({ color: '#F4F5F2', roughness: 0.32, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.1 })
    : new THREE.MeshStandardMaterial({ color: '#F1F2EF', roughness: 0.3, metalness: 0.05 });
  const gloss = physical
    ? new THREE.MeshPhysicalMaterial({ color: '#050608', roughness: 0.18, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04 })
    : new THREE.MeshStandardMaterial({ color: '#060708', roughness: 0.2, metalness: 0.2 });
  const glass = physical
    ? new THREE.MeshPhysicalMaterial({ color: '#06080B', roughness: 0.04, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6 })
    : new THREE.MeshStandardMaterial({ color: '#07090c', roughness: 0.05, metalness: 0.6 });
  const trim = new THREE.MeshStandardMaterial({ color: '#0B0D10', roughness: 0.6, metalness: 0.1 });
  const plasticMesh = new THREE.MeshStandardMaterial({ color: '#0d0f12', roughness: 0.85, metalness: 0 });
  const cavity = new THREE.MeshStandardMaterial({ color: '#0c0e12', roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
  const interior = new THREE.MeshStandardMaterial({ color: '#1a1c20', roughness: 0.8 });
  const rim = new THREE.MeshStandardMaterial({ color: '#6b7079', roughness: 0.34, metalness: 0.65, envMapIntensity: 1.4 });
  const rimDark = new THREE.MeshStandardMaterial({ color: '#2b2e33', roughness: 0.45, metalness: 0.85 });
  const tyre = new THREE.MeshStandardMaterial({ color: '#141516', roughness: 0.92, metalness: 0 });
  const disc = new THREE.MeshStandardMaterial({ color: '#6f7175', roughness: 0.45, metalness: 0.9 });
  const caliper = new THREE.MeshStandardMaterial({ color: '#2a2c30', roughness: 0.5, metalness: 0.4 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#d9dde2', roughness: 0.12, metalness: 1 });
  const lensClear = physical
    ? new THREE.MeshPhysicalMaterial({ color: '#c9d2dc', roughness: 0.05, metalness: 0.1, transmission: 0, transparent: true, opacity: 0.35, clearcoat: 1 })
    : new THREE.MeshStandardMaterial({ color: '#9aa3ad', transparent: true, opacity: 0.35, roughness: 0.1 });
  const headHousing = new THREE.MeshStandardMaterial({ color: '#15181d', roughness: 0.25, metalness: 0.8 });
  const towHook = new THREE.MeshStandardMaterial({ color: '#d0202a', roughness: 0.4, metalness: 0.2 });
  const mRed = new THREE.MeshStandardMaterial({ color: '#e1251b', roughness: 0.4 });
  const mBlue = new THREE.MeshStandardMaterial({ color: '#0066b1', roughness: 0.4 });
  const mNavy = new THREE.MeshStandardMaterial({ color: '#1c2a6b', roughness: 0.4 });
  // Matériaux émissifs pilotés à chaque frame (intensité animée).
  const headDrl = new THREE.MeshStandardMaterial({ color: '#111', emissive: '#ffffff', emissiveIntensity: 0, toneMapped: false });
  const tail = new THREE.MeshStandardMaterial({ color: '#5a0508', emissive: '#ff1a1a', emissiveIntensity: 0.15, roughness: 0.2, toneMapped: false });
  const brake = new THREE.MeshStandardMaterial({ color: '#3a0306', emissive: '#ff0a0a', emissiveIntensity: 0, toneMapped: false });
  const blinkL = new THREE.MeshStandardMaterial({ color: '#2a1a05', emissive: '#ff8a00', emissiveIntensity: 0, toneMapped: false });
  const blinkR = blinkL.clone();
  const reflector = new THREE.MeshStandardMaterial({ color: '#6b0a0d', emissive: '#ff1010', emissiveIntensity: 0.05, roughness: 0.3 });
  return {
    paint, gloss, glass, trim, plasticMesh, cavity, interior, rim, rimDark, tyre, disc, caliper, chrome,
    lensClear, headHousing, towHook, mRed, mBlue, mNavy, headDrl, tail, brake, blinkL, blinkR, reflector,
  };
}
export type CarMaterials = ReturnType<typeof createMaterials>;

/** Texture de halo radial (faux bloom très peu coûteux pour les feux). */
export function createGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Plaque neutre personnalisable (aucune immatriculation réelle). */
export function createPlateTexture(text: string) {
  const c = document.createElement('canvas');
  c.width = 520;
  c.height = 112;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f2f3f5';
  g.fillRect(0, 0, 520, 112);
  g.fillStyle = '#1d4fa8';
  g.fillRect(0, 0, 46, 112);
  g.fillRect(474, 0, 46, 112);
  g.fillStyle = '#111';
  g.font = '600 58px Inter, Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text.slice(0, 12), 260, 60);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Bandeau de pare-brise (texte personnalisable, rayures tricolores). */
export function createBannerTexture(text: string) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 96;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 1024, 96);
  g.font = 'italic 800 54px Inter, Arial, sans-serif';
  g.textBaseline = 'middle';
  const w = g.measureText(text).width;
  const stripeW = 70;
  const x0 = (1024 - (w + stripeW + 16)) / 2;
  ['#5fb4ff', '#1c3e9c', '#e1251b'].forEach((col, i) => {
    g.fillStyle = col;
    g.beginPath();
    const sx = x0 + i * 22;
    g.moveTo(sx + 14, 24);
    g.lineTo(sx + 30, 24);
    g.lineTo(sx + 16, 72);
    g.lineTo(sx, 72);
    g.closePath();
    g.fill();
  });
  g.fillStyle = 'rgba(245,247,250,0.95)';
  g.fillText(text, x0 + stripeW + 16, 50);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
