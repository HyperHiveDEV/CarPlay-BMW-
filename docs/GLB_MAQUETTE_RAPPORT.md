# Rapport d'intégration — `BMW_116i_F21_2018_maquette_3D.glb`

Fichiers reçus : `BMW_116i_F21_2018_maquette_3D(1).glb` (211 844 octets) et
`BMW_116i_F21_2018_pack_3D(1).zip` (même GLB, identique octet pour octet, + `visualiser_BMW_116i.html`,
une page `<model-viewer>` qui décrit elle-même le modèle comme une « base géométrique
personnalisée : proportions et détails approximés, pas un scan photogrammétrique »).

Le GLB est installé dans `public/models/BMW_116i_F21_2018_maquette_3D.glb` et chargé par
`src/three/BMWF21GLB.tsx` (conversion : `src/three/glbBake.ts`, testée par `tests/glb.test.ts`).

## 1. Inspection technique (vérifiée)

| Point | Constat |
|---|---|
| Format | glTF 2.0 binaire valide, générateur `trimesh` (bibliothèque Python) |
| Nœuds / maillages | 124 nœuds (1 racine « world ») / **123 maillages**, hiérarchie plate |
| Triangles | **16 196** (confirmé) |
| Répartition | 4 logos de roue (642 sommets chacun), 2 haricots (642), pneus (256), le reste est très simple : **coque de carrosserie entière = 60 sommets**, chaque vitre = 5 sommets, chaque branche de jante = un pavé de 8 sommets |
| Axes | **Z vers le haut** (non conforme glTF, qui impose Y), X vers l'avant, Y latéral |
| Dimensions | L 4,31 m (−2,15 → 2,16), l 1,74 m (2,04 m rétros inclus), H 1,43 m (1,51 m avec l'antenne) |
| Normales | **absentes** (recalculées à l'import, angle de pli 35°) |
| Matériaux / textures | **aucun** ; couleurs par sommet (COLOR_0) uniquement |
| Animations, squelette | aucun |
| Latéralité | l'échappement nommé « single left » est côté y < 0, soit à **droite** en repère direct → conversion avec miroir (le reste est symétrique) |
| Roues | 4 groupes identifiables par nom/position : pneu + voile intérieur + 10 branches + logo |
| Empattement | 2,72 m (réel 2,69 m) ; porte-à-faux avant 0,96 m (réel ≈ 0,80) et arrière 0,63 m (réel ≈ 0,84) : **roues décalées vers l'arrière** |
| Voies | pneus de |y| 0,73 à 0,94 m alors que la caisse fait ±0,87 m : **les pneus dépassent de 7 cm** |
| Ouvrants | **non séparés** : la coque est une pièce unique ; « door cut » et « shoulder crease » sont de simples bandes posées sur la surface |
| Éléments présents | haricots + barrettes, projecteurs + 2 anneaux LED, antibrouillards, prises d'air, lame, feux arrière + intérieurs, diffuseur + 3 ailettes, échappement, becquet, antenne requin, rétroviseurs, poignées, plaques vierges |
| Éléments absents | anneau de remorquage rouge, feu central du diffuseur, bandeau M Performance, badge M de calandre, clignotants, passages de roue (la coque n'est pas découpée) |

## 2. Ce que fait l'intégration

- Chargement asynchrone (Suspense), **repli automatique** sur RealisticF21 si le fichier est absent
  ou illisible, libération des géométries/matériaux au démontage.
- Conversion Z-haut → Y-haut + miroir latéral, inversion de l'ordre des sommets (faces correctes).
- Normales recalculées (`toCreasedNormals`), matériaux PBR de l'application par nom de pièce :
  peinture blanche vernie, noir brillant (calandre, rétros, becquet, diffuseur), plastique mat
  alvéolé (prises d'air), noir satiné (centres de roue), caoutchouc (pneus), jantes anthracite
  métallisées, chrome (échappement), **vitres avant claires** et **vitres arrière teintées**.
- **Fusion par matériau** : 123 maillages → ≈ 35 appels de rendu.
- **Roues sur pivots réels** (centre du pneu) : rotation de roulement et braquage des roues avant,
  toutes les pièces de la roue tournent ensemble (test automatisé).
- Éclairage simulé : anneaux LED (blanc / violet), feux arrière, stop, **clignotants et détresse
  ajoutés** (bas des projecteurs, feux, rétroviseurs), faisceaux et halo au sol.
- Ajouts des éléments de votre voiture absents du fichier : anneau de remorquage rouge, feu rouge
  central du diffuseur, bandeau M Performance, plaques neutres personnalisables.
- Compatible avec les 7 caméras, la rotation 360°, le zoom, l'outil de calage `?ortho=`.

## 3. Ouvrants

Les portières, le capot et le hayon **ne peuvent pas être séparés proprement dans Three.js** à
partir d'une coque de 60 sommets : toute découpe produirait des bords en dents de scie et des trous.
Conformément à la consigne, les animations existantes ne sont **pas désactivées** : elles restent
actives avec RealisticF21 (modèle par défaut) ; avec le GLB maquette, l'écran Vehicle indique
« N/D — ouvrants non séparés ».

Préparation de la version articulée : `tools/blender/f21_split_openings.py` (Blender ≥ 3.6) —
subdivision de la coque, découpes planes, séparation des 4 ouvrants avec vitres, poignées,
rétroviseurs, lunette, becquet et feux intérieurs, pivots sur charnières, pivots de roues et de
braquage, matériaux nommés, export `public/models/bmw_f21_lci.glb` directement chargé en mode Auto.
**Non exécuté ici (Blender absent)** ; avec cette maquette, le résultat sera fonctionnel mais grossier.

## 4. Verdict de fidélité

_Note : les captures en perspective du GLB ont été prises avant le correctif « double face » (faces internes du fichier source) ; les vues orthographiques aussi. Le correctif est dans le code._

Comparaison dans les mêmes conditions (même caméra, éclairage, résolution) : voir `docs/captures/comparaison/`.

**Le GLB ne remplit pas les critères de fidélité** et n'est donc **pas le modèle par défaut** :
- silhouette à facettes (coque de 60 sommets) : capot, ailes, pavillon et boucliers sans galbe ;
- proportions : porte-à-faux avant trop long, arrière trop court, pneus hors de la caisse ;
- face avant : haricots ovales de style ancien, projecteurs plats peu lisibles ;
- pas de passages de roue, pas de ligne de caractère sculptée, pas d'ouvrants.

RealisticF21 (gabarit relevé sur vos photos, surface lissée, ouvrants articulés) reste **plus
fidèle**. Le GLB est conservé comme **candidat** sélectionnable (Réglages › Rendu 3D › Modèle 3D ›
« GLB maquette ») et comme base pour le script Blender.

## 5. Ce qu'il faudrait pour qu'un GLB dépasse RealisticF21

1. Une vraie modélisation (ou un modèle du commerce sous licence) de F21 LCI : ≥ 150 000 triangles,
   surfaces en sous-division, passages de roue découpés, jours d'ouvrants modélisés.
2. Axes conformes glTF (Y haut), unités en mètres, normales exportées.
3. Ouvrants en objets séparés avec origine sur la charnière, nommés selon `docs/IMPORT_MODELE_3D.md`.
4. Matériaux nommés (`Paint`, `Glass`, `BlackGloss`, `Rim`, `Tyre`, `Chrome`, `Trim`) ou au minimum
   des pièces séparées par matériau.
5. Roues complètes avec pivot au moyeu, roues avant sous un pivot de braquage.
6. Optiques avec géométrie réelle (verre, réflecteurs, guides de lumière) et pièces lumineuses nommées.
