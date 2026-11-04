# Modèle 3D définitif — évaluation des sources et marche à suivre

Décision du propriétaire (04/11/2026) : **plus de carrosserie approximative**. Le rendu définitif doit
venir d'un vrai modèle 3D professionnel de BMW 116i **F21 LCI 3 portes (2015-2019), pack M Sport**.
Aucune nouvelle géométrie procédurale n'est développée ; RealisticF21 reste le repli en attendant.

## 1. Candidats proposés

| # | Source | Constat | Décision |
|---|---|---|---|
| 1 | Sketchfab — « BMW 1 Series Mk2 (F20) 2011-2019 » | Titre : **F20 = 5 portes**. Page non consultable depuis l'environnement (sketchfab.com bloqué) : licence, polygones, LCI ou non **non vérifiés**. | **Écarté comme modèle définitif** (mauvaise carrosserie). Utilisable au mieux comme référence de face avant / arrière LCI si c'est un LCI et si la licence le permet. |
| 2 | Sketchfab — « BMW F21 125i » | Titre : **F21 = 3 portes**, 125i (existe en M Sport). Page non consultable : licence, téléchargement, phase (pré-LCI 2011-2015 ou LCI 2015-2019), séparation des ouvrants **non vérifiés**. | **Meilleur candidat**, à vérifier (voir §2). Si pré-LCI : optiques avant/arrière et boucliers à remplacer, ce qui n'est pas acceptable pour un rendu fidèle. |
| 3 | model-copy.info, produit 68866 | Site non consultable. Signalé publiquement comme revendant des modèles sans l'accord de leurs auteurs (forum SketchUp). | **Écarté** : risque de copie non autorisée. Ne pas acheter. |

Sources consultées : [forum SketchUp — revente de modèles sans autorisation](https://forums.sketchup.com/t/someone-sells-my-models-from-3d-warehouse-without-owner-permission/115806),
[analyse Gridinsoft de model-copy.info](https://gridinsoft.com/online-virus-scanner/url/model_copy-info),
[licences Sketchfab](https://sketchfab.com/licenses).

## 1 bis. Piste 3dmodels.org — « BMW 1 Series F21 3-door 2015 » (id 30364)

Page non consultable depuis l'environnement (3dmodels.org bloqué) : **géométrie, pièces séparées,
formats et polygones non vérifiés**. Éléments établis par recherche :
- **Année** : la F21 restylée (LCI) a été présentée au salon de Genève en mars 2015 ([avtotachki](https://en.avtotachki.com/bmw-1-series-3-h-dvernyj-f21-2015-czena-foto-harakteristiki-2/)) :
  un modèle « 2015 » est *probablement* LCI, mais à confirmer visuellement (feux arrière en L à LED,
  projecteurs à double « U » LED, haricots plus larges, bouclier arrière à réflecteurs verticaux).
- **Licence** ([conditions 3dmodels.org](https://3dmodels.org/licence-terms/)) : licence non exclusive, mondiale, sans limite de durée,
  paiement unique ; usage explicitement autorisé pour les **applications mobiles et web, jeux et logiciels**.
  Point à vérifier dans le texte complet : les restrictions de **redistribution du fichier brut** — notre APK
  embarque le GLB dans ses ressources (extractible) ; demander confirmation écrite au support que cet
  usage est couvert, ou chiffrer/obfusquer le fichier si exigé.
- **Finition** : vérifier si le modèle est en finition M Sport (boucliers, bas de caisse) ou standard
  (dans ce cas, boucliers M Sport à modéliser / acheter séparément).

À relever sur la vue 360° avant tout achat : finition, feux LCI, objets séparés (portières, capot,
hayon, roues), formats (.blend / .fbx / .max / .obj), nombre de polygones, intérieur, textures.

## 2. Vérifications à faire sur le candidat n° 2 (page Sketchfab)

- [ ] **Licence** affichée sous le modèle : CC BY / CC BY-SA → OK (créditer l'auteur dans l'application) ;
      CC BY-NC → OK pour un usage strictement personnel, non distribué contre rémunération ;
      « Standard » (achat) → OK ; **« Editorial »** → non adapté à une application ; **non téléchargeable** → inutilisable.
- [ ] **Phase** : LCI (2015+) = feux arrière en L à LED, projecteurs à double « U » LED, haricots plus larges ;
      pré-LCI = feux arrière à barres horizontales, projecteurs à anneaux ronds.
- [ ] **Pare-chocs M Sport** (grandes prises d'air latérales, lame) et bas de caisse M.
- [ ] **Topologie** : 100 000 à 500 000 triangles, surfaces lisses, passages de roue découpés.
- [ ] **Pièces séparées** : 2 portières, capot, hayon, 4 roues (sinon prévoir la découpe dans Blender).
- [ ] Formats proposés (glTF/GLB, FBX, .blend), textures incluses.

Si ces points sont validés, deux façons de me transmettre le fichier :
1. le télécharger vous-même depuis Sketchfab (compte requis) et le déposer dans la conversation,
   comme pour la maquette précédente ;
2. ou autoriser `sketchfab.com` dans les réglages réseau de l'environnement — le téléchargement
   reste soumis à votre compte et à la licence.

## 3. Autres sources sérieuses à examiner (F21 LCI 3 portes)

Marchés avec licences explicites et auteurs identifiés : Hum3D, CGTrader, TurboSquid, 3DCADBrowser
(ex. fiche « BMW M135i F21 2012 », pré-LCI). Critères identiques au §2 ; préférer un modèle annoncé
« 2015 », « 2016 », « LCI » ou « facelift », 3-door.

## 4. Chaîne d'intégration prête

1. `tools/blender/prepare_f21_model.py` + `tools/blender/f21_mapping.example.json` : import (.blend, .fbx,
   .obj, .glb), orientation, mise à l'échelle sur 4 324 mm, regroupement des ouvrants sous pivots de
   charnière, pivots de roues et de braquage, matériaux de l'application (peinture blanche vernie,
   noir brillant, vitres teintées, jantes anthracite…), nommage des feux, budget de triangles,
   export `public/models/bmw_f21_lci.glb` + `model-manifest.json`.
2. L'application charge automatiquement ce fichier en mode **Auto** (`GlbCar.tsx`) : animations des
   ouvrants et des roues, feux simulés, repli automatique sur RealisticF21 en cas d'échec.
3. Personnalisations du véhicule à appliquer sur le modèle : calandre noire + badge M, rétroviseurs noir
   brillant, lame avant, becquet de toit noir, diffuseur noir à feu central rouge, sortie simple à gauche,
   anneau de remorquage rouge, jantes 5 doubles branches anthracite, bandeau M Performance,
   vitres arrière teintées, plaque neutre.

Le script n'a pas pu être exécuté ici (Blender absent) : il devra être validé avec le modèle réel.
