import { describe, expect, it } from 'vitest';
import { missingValidation } from '../src/three/modelManifest';

describe('verrou de validation du modèle définitif', () => {
  it('refuse un modèle sans validation', () => {
    expect(missingValidation(undefined)).toContain('Carrosserie F21 trois portes');
    expect(missingValidation({})).toContain('Approbation finale');
  });
  it('refuse si un seul critère manque (ex. licence)', () => {
    const v = { body3DoorF21: true, lciFrontAndRearLights: true, highQualityGeometry: true, blenderCompatibleFormat: true, editableMaterials: true, separableOpeningsAndWheels: true, licenceAllowsAndroidApp: false, comparedToPhotos: true, approved: true };
    expect(missingValidation(v)).toEqual(['Licence autorisant une application Android']);
  });
  it('accepte un modèle entièrement validé', () => {
    const v = { body3DoorF21: true, lciFrontAndRearLights: true, highQualityGeometry: true, blenderCompatibleFormat: true, editableMaterials: true, separableOpeningsAndWheels: true, licenceAllowsAndroidApp: true, comparedToPhotos: true, approved: true };
    expect(missingValidation(v)).toEqual([]);
  });
});
