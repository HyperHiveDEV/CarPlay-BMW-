import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildF21Body } from '../src/three/f21Body';
import { X_FRONT, X_REAR } from '../src/three/f21Blueprint';

describe('carrosserie F21 reconstituée', () => {
  const b = buildF21Body(0);
  it('respecte les dimensions de la F21 (L 4 324, l 1 765, H ~1 420 mm)', () => {
    expect(X_FRONT - X_REAR).toBeCloseTo(4.324, 2);
    b.raycast.computeBoundingBox();
    const bb = b.raycast.boundingBox as THREE.Box3;
    expect(bb.max.z - bb.min.z).toBeCloseTo(1.765, 1);
    expect(bb.max.y).toBeGreaterThan(1.38);
    expect(bb.max.y).toBeLessThan(1.46);
  });
  it('découpe 2 portières, le capot et le hayon en pièces séparées', () => {
    for (const k of ['doorL', 'doorR', 'hood', 'tailgate'] as const) {
      expect(b.parts[k].outer.index!.count).toBeGreaterThan(300);
      expect(b.parts[k].inner).not.toBeNull();
    }
    // portières symétriques
    expect(Math.abs(b.parts.doorL.outer.index!.count - b.parts.doorR.outer.index!.count)).toBeLessThan(200);
  });
});
