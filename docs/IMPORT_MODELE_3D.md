# Importer un modèle 3D BMW F21 LCI

La voiture affichée aujourd'hui est une **reconstitution générée par code** :

- `src/three/f21Blueprint.ts` : lignes relevées sur la photo de profil du véhicule (toit, capot,
  bas de caisse, ceinture de caisse, ligne de caractère, vitrages, portière, feux), converties en
  mètres via l'empattement (2 690 mm) et la longueur (4 324 mm) réels ;
- `src/three/f21Body.ts` : surface lissée par sections transversales (« lofting »), passages de roue,
  découpe des ouvrants (portières, capot, hayon) en pièces articulées ;
- `src/three/zoneMaterial.ts` : zones (vitres, noir brillant, haricots, prises d'air, optiques, feux,
  joints) calculées par pixel pour des contours nets.

Pour corriger la forme, modifier les points du gabarit (coordonnées en pixels de la photo).
Pour un rendu photoréaliste (surfaces exactes, optiques détaillées, intérieur), il faut un vrai modèle.

## 1. Se procurer un modèle

- Chercher une **BMW 1 Series F21 LCI 3 portes** (2015–2019), pas une F20 5 portes,
  ni une M135i/M140i (boucliers et sorties différents — ou les adapter).
- Sources possibles : Sketchfab, TurboSquid, CGTrader, Hum3D. Vérifier que la licence
  autorise l'**usage dans une application** (pas seulement le rendu d'images).
- Format : GLB/glTF de préférence ; FBX/OBJ/.blend se convertissent dans Blender.
- Budget conseillé pour un autoradio Android : **150 000 – 300 000 triangles**, textures ≤ 2048 px.

## 2. Préparer dans Blender (≥ 3.6)

1. **Orientation** : avant de la voiture vers **+X**, toit vers **+Y** (dans l'export glTF « +Y Up »),
   côté conducteur (gauche) vers **−Z**. Échelle : 1 unité = 1 mètre, roues posées à Y = 0.
2. **Séparer les ouvrants** (Édition › P › Sélection) en objets distincts :
   portière conducteur, portière passager, capot, hayon (vitre + becquet inclus).
3. **Placer l'origine sur la charnière** (Objet › Définir l'origine › Origine sur le curseur 3D,
   après avoir placé le curseur sur l'axe de charnière). C'est ce qui permet une rotation
   réaliste sans déformation.
4. **Roues** : un objet par roue (`wheel_fl`…), origine au centre du moyeu, axe de rotation = Z local.
   Pour le braquage, parenter chaque roue avant à un Empty `steer_fl` / `steer_fr` (rotation Y).
5. **Nommer les objets** selon la convention ci-dessous.
6. **Matériaux** : nommer les matériaux `Paint`, `BlackGloss`, `Glass`, `Rim`, `Tyre`, `Chrome`, `Trim` ;
   l'application les remplace par ses matériaux PBR (blanc brillant vernis, noir brillant,
   vitrage teinté, jantes anthracite satinées…).
7. **Feux** : objets séparés pour les zones lumineuses (`light_head_l`, `light_tail_r`, `blinker_fl`…).
8. Appliquer les transformations d'échelle (Ctrl+A › Échelle), **pas** celles des ouvrants (garder les pivots).
9. Export : Fichier › Exporter › glTF 2.0 (.glb), cocher *Apply Modifiers*, compression **Draco désactivée**
   (le décodeur n'est pas embarqué pour rester 100 % hors ligne) ou utiliser `gltf-transform` avec meshopt.

| Rôle | Nom du nœud | Axe | Angle d'ouverture |
|---|---|---|---|
| Portière conducteur | `door_driver` | y | −1,12 rad |
| Portière passager | `door_passenger` | y | +1,12 rad |
| Capot | `hood` | z | +0,92 rad |
| Hayon | `tailgate` | z | −1,22 rad |
| Roues | `wheel_fl`, `wheel_fr`, `wheel_rl`, `wheel_rr` | z | rotation continue |
| Braquage | `steer_fl`, `steer_fr` | y | ±0,55 rad |

Si vos noms ou axes diffèrent, copiez `public/models/model-manifest.example.json` en
`public/models/model-manifest.json` et adaptez-le — aucun code à modifier.

## 3. Personnalisation d'après les photos

À reproduire sur le modèle (voir `docs/ANALYSE_PHOTOS.md`) : haricots noirs + badge M,
rétroviseurs noir brillant, lame avant noire, becquet de toit noir brillant (extension),
diffuseur noir à ailettes avec feu central rouge, sortie simple à gauche, jantes 18" 5 doubles
branches anthracite, vitres arrière/lunette teintées, bandeau M Performance, anneau de
remorquage rouge côté droit, plaques neutres.

## 4. Intégrer

```bash
cp bmw_f21_lci.glb public/models/
npm run dev        # test sur PC
npm run android:sync   # copie dans le projet Android
```

Paramètres › Diagnostic affiche « Modèle 3D : GLB » et liste les nœuds manquants éventuels.
Optimisation : `npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-compress webp`.
