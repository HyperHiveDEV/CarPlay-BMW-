# Cahier des charges — modèle 3D professionnel BMW 116i F21 LCI M Sport

Liste des caractéristiques **indispensables** du futur modèle 3D, à vérifier avant tout achat
(fiche produit, vue 360°, réponse écrite du vendeur) puis après réception (`npm run model:check`,
comparaison aux photos). Statut actuel : **aucun modèle conforme acquis** ; RealisticF21 reste un
repli temporaire, il ne constitue pas le rendu final.

Légende : **[O]** obligatoire — **[R]** recommandé — **[A]** adaptable dans Blender si absent.

## 1. Identité du véhicule

| Exigence | Niveau | Comment le reconnaître |
|---|---|---|
| BMW Série 1 **F21** (3 portes), pas F20 (5 portes) | O | 2 portières longues, custode fixe avec « coup de crosse » |
| Phase **LCI** (2015-2019) | O | feux arrière en L à LED, projecteurs à double « U » LED, haricots élargis, bouclier arrière à réflecteurs verticaux |
| Finition **M Sport** | O ou A | bouclier avant à grandes prises d'air et lame, bouclier arrière avec diffuseur, bas de caisse M ; si finition Urban/Sport Line : boucliers et bas de caisse M Sport à fournir en pièces séparées |
| Proportions conformes | O | longueur 4 324 mm, largeur 1 765 mm hors rétroviseurs, hauteur ≈ 1 420 mm, empattement 2 690 mm, voies ≈ 1 535 / 1 569 mm |

## 2. Géométrie

| Exigence | Niveau |
|---|---|
| Modélisation « production » : surfaces de carrosserie continues, sans facettes ni triangles visibles, reflets nets sur la peinture | O |
| 150 000 à 500 000 triangles à la livraison (une version allégée ≤ 300 000 pour l'autoradio pourra être dérivée) | O |
| Passages de roue découpés, doublures d'aile, soubassement fermé | O |
| Jours d'ouvrants modélisés (épaisseur visible, panneaux non fusionnés) | O |
| Optiques avant et arrière en volume (verre, réflecteurs, guides de lumière LED) | O |
| Calandre à haricots avec barrettes en relief, cadre séparé | O |
| Vitrages modélisés en volume (épaisseur), joints de vitres | R |
| Habitacle au moins visible au travers des vitres (sièges, planche, volant) ; complet si les portières s'ouvrent | O (simple) / R (complet) |
| Compartiment moteur sous le capot (ou fond fermé propre) | R |
| Normales cohérentes, pas de faces inversées, pas de géométrie dupliquée | O |
| Échelle réelle (mètres) ou facilement mise à l'échelle | O |

## 3. Pièces séparées et articulables

| Pièce | Exigence | Niveau |
|---|---|---|
| Portière conducteur (gauche) | objet indépendant avec vitre, cadre, poignée, rétroviseur et répétiteur ; panneau intérieur | O |
| Portière passager (droite) | idem | O |
| Capot | objet indépendant, face inférieure modélisée | O |
| Hayon | objet indépendant avec lunette, becquet, troisième feu stop, essuie-glace et parties de feux portées par le hayon | O |
| Roues (×4) | chacune séparée : pneu, jante, centre de roue, écrous ; disques et étriers séparés (fixes) | O |
| Charnières | pivots positionnés (ou au minimum arêtes de charnière identifiables) | R (sinon placés par `prepare_f21_model.py`) |
| Roues avant | pivot de braquage possible (jante + pneu + disque) | O |
| Pièces lumineuses | projecteurs (anneaux/guides LED), feux arrière, feux stop, clignotants avant/arrière/rétroviseurs en objets ou matériaux distincts | O |
| Essuie-glaces, antenne requin, plaques | objets distincts | R |

## 4. Matériaux et textures

| Exigence | Niveau |
|---|---|
| Matériaux **séparés par fonction** : peinture, noir brillant, plastique noir mat/grainé, chromes, vitres, caoutchouc, jantes, optiques, feux | O |
| Matériaux PBR (metallic/roughness) ou convertibles dans Blender | O |
| Textures ≤ 4096 px (2048 conseillé), formats PNG/JPEG, incluses dans la livraison | O |
| Pas de matériau « procédural » propre à un moteur de rendu (V-Ray, Corona…) sans équivalent standard | O |
| UV propres sur pneus (flancs), plaques, logos | R |
| Logos BMW / M : présents ou ajoutables sous licence | R |

Personnalisation à appliquer (photos du véhicule) : peinture blanc brillant vernis, haricots noir
brillant + badge M, rétroviseurs noir brillant, lame avant noire, becquet de toit noir brillant,
diffuseur noir avec feu central rouge, sortie d'échappement simple à gauche, anneau de remorquage
rouge (côté droit), jantes 18" cinq doubles branches anthracite, vitres arrière et lunette teintées,
bandeau « M PERFORMANCE » en haut du pare-brise, plaques neutres, phares violets **simulés**.

## 5. Formats

| Exigence | Niveau |
|---|---|
| Format natif modifiable : **.blend** (idéal) ou **.fbx** / **.max** + .fbx | O |
| .obj ou .glb accepté en complément | R |
| Pas de compression Draco/meshopt imposée (l'application fonctionne hors ligne) | O |
| Hiérarchie et noms d'objets lisibles (portières, capot, hayon, roues identifiables) | O |
| Unités et axes documentés | R |

## 6. Licence

| Exigence | Niveau |
|---|---|
| Autorise l'**intégration dans une application** (logiciel / mobile) | O |
| Couvre la **distribution** de l'application contenant le modèle (APK) ; préciser si un usage personnel non commercial est le seul couvert | O |
| Précise si le fichier doit être protégé contre l'extraction (l'APK embarque le GLB) | O |
| Autorise les **modifications** (personnalisation, découpe, décimation) | O |
| Vendeur = auteur ou revendeur autorisé (pas de site de revente non autorisée) | O |
| Licence et n° de commande conservés ; référence reportée dans le manifeste (`validation.licenceReference`) | O |
| Licences « éditoriales » ou « non téléchargeables » : refusées | O |

## 7. Questions à poser au vendeur avant achat

1. Le modèle est-il la phase LCI (2015+) ? Captures des feux arrière et des projecteurs.
2. Finition : M Sport ? Sinon, des boucliers M Sport existent-ils en option ?
3. Liste des objets séparés : portières, capot, hayon, roues, optiques.
4. Nombre de polygones (avec et sans lissage), formats livrés, textures incluses.
5. La licence couvre-t-elle une application Android distribuée intégrant le fichier 3D ?

## 8. Après réception (rappel de procédure)

`docs/IMPORT_MODELE_3D.md` : correspondance des noms → `prepare_f21_model.py` (Blender) →
`npm run model:check` → personnalisation → comparaison aux photos (`?ortho=…`, mêmes caméras que
RealisticF21) → validation humaine dans le manifeste → le modèle devient le modèle par défaut.
