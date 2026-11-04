# Scripts Blender

Procédure complète : `docs/IMPORT_MODELE_3D.md`.

- `prepare_f21_model.py` — prépare un **vrai** modèle F21 LCI (sous licence) pour l'application.
- `f21_mapping.example.json` — correspondance noms → pièces à adapter au modèle acheté.
- `f21_mapping.maquette.json` — correspondance de test (GLB maquette découpé).
- `f21_split_openings.py` — découpe spécifique au GLB maquette (pas de géométrie nouvelle).

Test de bout en bout (Blender 5.2.3 en module Python) :
```bash
python3.13 -m venv bpyenv && bpyenv/bin/pip install bpy==5.2.3
bpyenv/bin/python tools/blender/f21_split_openings.py -- public/models/BMW_116i_F21_2018_maquette_3D.glb /tmp/split.glb
bpyenv/bin/python tools/blender/prepare_f21_model.py -- /tmp/split.glb tools/blender/f21_mapping.maquette.json /tmp/out/bmw_f21_lci.glb
node tools/validate-glb.mjs /tmp/out/bmw_f21_lci.glb /tmp/out/model-manifest.json
```
Ne pas écrire la sortie de test dans `public/models/` : elle serait proposée à l'application.
