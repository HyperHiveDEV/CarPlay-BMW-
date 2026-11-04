# Importer le modèle 3D définitif de la BMW 116i F21 LCI

Objectif : remplacer la reconstitution procédurale (RealisticF21, conservée uniquement comme
**solution de secours**) par un **vrai modèle 3D professionnel** de BMW Série 1 F21 LCI trois portes,
personnalisé comme la voiture du propriétaire. Aucune nouvelle carrosserie approximative n'est créée.

La chaîne ci-dessous a été **exécutée de bout en bout** le 04/11/2026 avec Blender 5.2.3 (module
Python `bpy`) sur le GLB maquette : préparation → validation technique → chargement dans
l'application → ouverture des portières, du capot et du hayon. Elle reste à valider sur le modèle réel.

---

## Étape 0 — Avant tout achat : critères obligatoires

Ne pas acheter / intégrer un modèle qui ne coche pas **toutes** ces cases (à vérifier sur la vue 360°,
la fiche produit et la licence) :

| # | Critère | Comment vérifier |
|---|---|---|
| 1 | **Carrosserie F21 trois portes** | 2 portes latérales longues, custode avec « coup de crosse » |
| 2 | **Face avant et feux arrière LCI** (2015-2019) | feux arrière en L à LED, projecteurs à double « U » LED, haricots élargis |
| 3 | **Géométrie haute qualité** | ≥ 100 000 triangles, surfaces lisses, passages de roue découpés, jours modélisés |
| 4 | **Format compatible Blender** | .blend, .fbx, .obj ou .glb/.gltf |
| 5 | **Matériaux modifiables** | matériaux séparés par pièce (peinture, vitres, plastiques, chromes…) |
| 6 | **Portières, capot, hayon et roues séparés** | ou séparables proprement (objets distincts dans la fiche « parts ») |
| 7 | **Licence autorisant une application Android** | intégration dans une application distribuée (APK), modèle non extractible si exigé |

Puis, après intégration : **8. comparaison aux photographies** du véhicule (vues de face, 3/4 avant,
profils gauche et droit, 3/4 arrière, arrière).

Ces 8 critères sont reportés dans le manifeste (`validation`) : **l'application refuse le modèle tant
qu'ils ne sont pas tous validés** (Réglages › Diagnostic affiche ceux qui manquent).

## Étape 1 — Ouvrir le modèle et écrire la correspondance

1. Ouvrir le fichier acheté dans Blender ≥ 3.6 et relever, dans l'Outliner, les noms des objets :
   portières, capot, hayon, roues (pneu, jante, disque, étrier), projecteurs, feux, clignotants, et le
   nom des matériaux (peinture, vitres…).
2. Copier `tools/blender/f21_mapping.example.json` en `tools/blender/f21_mapping.json` et adapter :
   - `rotate_deg` : rotation à appliquer si l'avant n'est pas vers +X ou le haut vers +Z (Blender) ;
   - `length_reference` : objets de carrosserie servant à mesurer la longueur (4 324 mm) ;
   - `openings` : motifs (expressions régulières) des objets de chaque ouvrant ; `hinge` à `null`
     pour une charnière déduite (bord avant extérieur des portières, bord arrière haut du capot, bord
     avant haut du hayon) ou des coordonnées exactes en mètres ;
   - `wheels` : motifs des pièces de chaque roue (fl, fr, rl, rr) ;
   - `materials` : motifs des matériaux/objets pour chaque rôle de l'application ;
   - `lights` : objets lumineux (projecteurs, feux, stop, clignotants) ;
   - `triangle_budget` : plafond pour l'autoradio (300 000 conseillé).

## Étape 2 — Préparation automatique (Blender)

```bash
blender --background --python tools/blender/prepare_f21_model.py -- chemin/du/modele.blend tools/blender/f21_mapping.json public/models/bmw_f21_lci.glb
```

Sans Blender installé, le module Python fonctionne aussi :

```bash
python3.13 -m venv bpyenv && bpyenv/bin/pip install bpy==5.2.3
```
```bash
bpyenv/bin/python tools/blender/prepare_f21_model.py -- chemin/du/modele.blend tools/blender/f21_mapping.json public/models/bmw_f21_lci.glb
```

Le script : oriente et met à l'échelle, regroupe chaque ouvrant sous un pivot de charnière nommé
`door_driver`, `door_passenger`, `hood`, `tailgate`, crée `wheel_fl/fr/rl/rr` et `steer_fl/fr`,
attribue les matériaux `Paint`, `Glass`, `BlackGloss`, `Rim`, `Tyre`, `Chrome`, `Trim`, nomme les
pièces lumineuses, décime si nécessaire, puis écrit `public/models/bmw_f21_lci.glb` et
`public/models/model-manifest.json` (validation à `false`). Il affiche pour chaque pièce le nombre
d'objets trouvés et la charnière retenue : un « ! » signale un motif à corriger.

## Étape 3 — Validation technique

```bash
npm run model:check -- public/models/bmw_f21_lci.glb public/models/model-manifest.json --report docs/validation_modele.md
```

Contrôles : glTF lisible, axe Y vertical, longueur 4,324 m ± 4 %, largeur, hauteur, roues au sol,
nombre de triangles (≥ 100 000, ≤ 600 000), normales, présence et **position des charnières** des
4 ouvrants (côté conducteur = −Z), pivots de roues au moyeu, empattement 2,69 m, pivots de braquage,
pièces lumineuses, matériaux nommés. Code de sortie 1 si un contrôle bloquant échoue.

## Étape 4 — Personnalisation selon les photos

À appliquer dans Blender (ou via les matériaux de l'application) si le modèle ne l'a pas déjà :

| Élément | Attendu |
|---|---|
| Peinture | blanc brillant vernis (Alpinweiss III) |
| Pack M Sport | boucliers avant/arrière M Sport, bas de caisse M — **à acheter/modéliser si le modèle est en finition Urban/Sport Line** |
| Calandre | haricots noir brillant + petit badge M |
| Jantes | 18" cinq doubles branches, anthracite |
| Rétroviseurs | coques noir brillant |
| Vitrage | vitres arrière et lunette teintées, bandeau « M PERFORMANCE » en haut du pare-brise |
| Avant | lame noire, anneau de remorquage rouge (côté droit) |
| Arrière | becquet de toit noir brillant, diffuseur noir avec feu central rouge, sortie simple à gauche |
| Éclairage | anneaux LED nommés `light_head_*` : phares blancs **et violets simulés** par l'application |
| Plaques | neutres (texte personnalisable dans Réglages › Véhicule) |

## Étape 5 — Comparaison aux photos

1. `npm run dev`, puis `http://localhost:5173/?ortho=front` (et `side`, `right`, `rear`) : vue
   orthographique 1 m = 300 px, à superposer aux photos.
2. Vues en perspective : Réglages › Rendu 3D › Modèle 3D, comparer « Auto » (modèle définitif) et
   « RealisticF21 » dans les mêmes conditions de caméra et d'éclairage.
3. Vérifier : silhouette 3 portes, longueur du capot et des portières, ligne de toit, vitrages,
   hayon, boucliers M Sport, calandre LCI, optiques, position des roues, voies, proportions.

## Étape 6 — Approbation

Compléter `public/models/model-manifest.json` › `validation` : passer chaque critère à `true` **après
vérification**, renseigner `approvedBy`, `date`, `licenceReference` (n° de commande / licence), puis
`approved: true`. Le modèle devient alors le modèle affiché en mode « Auto » ; RealisticF21 reste le
repli automatique en cas d'erreur de chargement.

## Étape 7 — Android

`npm run android:sync` copie le modèle dans l'APK. Vérifier sur l'autoradio : temps de chargement,
FPS (Réglages › Diagnostic), mémoire. Si la licence exige que le fichier ne soit pas extractible,
le signaler : une protection (chiffrement du fichier dans l'APK) devra être ajoutée.

---

### Annexe — scripts

| Fichier | Rôle | État |
|---|---|---|
| `tools/blender/prepare_f21_model.py` | préparation d'un vrai modèle (étape 2) | exécuté avec Blender 5.2.3 sur une entrée de test |
| `tools/blender/f21_mapping.example.json` | modèle de correspondance à adapter | motifs testés sur des noms usuels |
| `tools/blender/f21_mapping.maquette.json` | correspondance de test (maquette découpée) | utilisé pour le test de bout en bout |
| `tools/blender/f21_split_openings.py` | découpe de la maquette sans ouvrants (cas particulier) | exécuté avec Blender 5.2.3 |
| `tools/validate-glb.mjs` (`npm run model:check`) | validation technique (étape 3) | exécuté |
