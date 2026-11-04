# Rendu 3D de la BMW F21 — état, limites et passage au modèle GLB

## Deux niveaux de rendu

| Niveau | Source | Quand |
|---|---|---|
| **1 — Reconstitution procédurale** (actuel) | générée par code depuis le gabarit relevé sur les photos du véhicule | toujours disponible, sert de secours |
| **2 — Modèle GLB définitif** | fichier `public/models/bmw_f21_lci.glb` sous licence | utilisé automatiquement dès qu'il est présent |

Réglages › Rendu 3D › **Modèle 3D** : « Auto » (GLB sous licence si présent, sinon RealisticF21),
« GLB maquette » (fichier personnalisé fourni, voir docs/GLB_MAQUETTE_RAPPORT.md), « RealisticF21 »,
« Ancien » (première maquette, secours). Même caméra, même éclairage et même résolution pour comparer. Réglages › Diagnostic indique le modèle chargé et les nœuds GLB manquants.

## Niveau 1 — comment la reconstitution est construite

1. **Gabarit** (`src/three/f21Blueprint.ts`) : lignes relevées en pixels sur la photo de profil
   (toit, capot, pare-brise, hayon, boucliers, ceinture de caisse, ligne de caractère, nervure basse,
   vitrage avec « coup de crosse », portière, feux), converties en mètres avec l'empattement
   (2 690 mm) et la longueur (4 324 mm) réels ; face avant (projecteurs, haricots) relevée sur la photo de nuit.
2. **Surface** (`src/three/f21Body.ts`) : section transversale lissée (Catmull-Rom) calculée à chaque station
   et reliée en surface continue (« lofting ») ; passages de roue découpés exactement sur un cercle.
3. **Zones par pixel** (`src/three/zoneMaterial.ts`) : vitres, noir brillant, haricots, grilles alvéolées,
   optiques, feux, jours d'ouvrants, soubassement — calculés dans le shader à partir de la position :
   contours nets quelle que soit la densité du maillage.
4. **Ouvrants** : portières, capot et hayon sont des pièces séparées pivotant sur leurs charnières.
   La frontière pièce / caisse est tranchée par pixel (même règle côté CPU et shader) → bords nets,
   jour de ~4,5 mm avec ombrage, doublure intérieure découpée de la même façon.

### Outil de calage
`http://localhost:5173/?ortho=side` (ou `front`, `rear`, `top`) affiche une vue orthographique à
l'échelle 1 m = 300 px pour superposer le rendu aux photos et corriger les points du gabarit.

## Ce qui est nettement plus réaliste qu'avant

- Silhouette F21 3 portes relevée sur la photo : capot long, pare-brise incliné, pavillon, hayon,
  porte longue de coupé, custode avec coup de crosse, ligne de ceinture montante, ligne de caractère.
- Surfaces continues sans facettes ; nez et poupe arrondis ; passages de roue circulaires propres.
- Contours nets des vitres, du montant B noir, des haricots (taille et position relevées), des optiques,
  des prises d'air M Sport (grille alvéolée), de la lame avant, du diffuseur.
- Jours d'ouvrants réguliers (portières, capot, hayon) ; ouvrants ouverts sans bords dentelés.
- Signature LED en double « U » des projecteurs (violet / blanc), feux arrière à guide de lumière en L.
- Jantes 5 doubles branches en V, concaves, anthracite satiné ; vitres teintées à reflet de Fresnel ;
  vernis désactivé sur les plastiques mats ; éclairage studio à bandes pour les lignes de reflet.
- Détails du véhicule : rétroviseurs noir brillant, badge M de calandre, badges M d'aile, anneau de
  remorquage rouge, becquet noir brillant + 3e feu stop, diffuseur noir à feu central rouge,
  sortie simple à gauche, bandeau M Performance, plaques neutres personnalisables.

## Limites restantes de la génération procédurale

- Les surfaces sont **reconstituées**, pas numérisées : galbes d'ailes, creux de portière, nervures
  du capot, détails des boucliers restent approximatifs (de l'ordre de quelques centimètres).
- La face avant et l'arrière sont reconstitués à partir de vues en perspective : la forme exacte
  des boucliers M Sport, des écopes et des feux reste simplifiée.
- Les optiques sont « peintes » sur la surface avec quelques éléments 3D (anneaux LED, modules) :
  pas de vraie profondeur de verre, pas de réflecteurs détaillés.
- Rétroviseurs, poignées, essuie-glaces, antenne : volumes simplifiés.
- Habitacle sommaire (sièges, planche, volant) ; compartiment moteur symbolique.
- Pas de logo BMW (marque déposée), pas d'autocollants personnels.
- Pneus sans marquages, disques et étriers simplifiés.

## Ce qu'apporterait un vrai modèle GLB F21 LCI

- [ ] Surfaces exactes de la carrosserie (aile, portière, capot, boucliers M Sport, bas de caisse)
- [ ] Projecteurs LCI fidèles : verre, réflecteurs, guides de lumière et projecteurs LED réels
- [ ] Feux arrière LCI en relief avec leur signature en L exacte
- [ ] Haricots avec barrettes en relief et cadre exact, logo BMW sous licence
- [ ] Rétroviseurs, poignées, joints, essuie-glaces et antenne à la bonne forme
- [ ] Jantes 18" exactes (style M), pneus avec flancs détaillés, freins
- [ ] Habitacle complet (sièges sport, planche de bord, volant M, console)
- [ ] Textures (cuir, plastiques grainés, grilles) et cartes normales pour le micro-relief
- [ ] Ouvrants découpés par le modeleur, avec charnières et joints réels

Ce que l'application fournit déjà pour le GLB : chargement automatique, remplacement des matériaux
par les matériaux PBR de l'application, animation des ouvrants et des roues par nom de nœud,
éclairage simulé (phares blancs/violets, clignotants, stop) par nom de nœud, manifeste
`model-manifest.json` pour adapter noms / axes / angles sans toucher au code, repli automatique sur
la reconstitution si le fichier est absent ou illisible. Procédure : `docs/IMPORT_MODELE_3D.md`.

## Performances

Le shader de zones évalue quelques polygones par pixel ; prévoir la qualité « Économie » sur un
autoradio d'entrée de gamme (maillage allégé, matériau standard, pas de sol réfléchissant). Le mode
Auto baisse la qualité si les FPS chutent. À valider sur l'appareil cible (docs/VALIDATION_VEHICULE.md).
