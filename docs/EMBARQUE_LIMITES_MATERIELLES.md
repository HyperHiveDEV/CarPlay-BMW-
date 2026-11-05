# Interface embarquée OEM+ — état et limites matérielles

Branche : `feature/ui-embedded-dashboard`. Ce document dit ce qui est **testé**, ce qui est
**préparé mais non fonctionnel**, et ce qui dépend d'un matériel non encore validé.

## 1. Ce qui est testé (PC, navigateur Chromium headless)

| Point | Test |
|---|---|
| 800×480, 1024×600, 1280×480, 1280×720, 1920×720 : aucun débordement, aucune barre de défilement sur My BMW | script de capture (mesure `scrollWidth`/`scrollHeight` et éléments défilants) |
| Démarrage sans réseau (aucune requête hors `localhost`, pas de CDN, pas de décodeur Draco distant) | scénario Playwright, requêtes externes bloquées |
| Navigation au clavier seul : barre latérale, zones, BACK, MENU, OPTION, pilotage 3D, ouvrants via menu | scénario Playwright |
| Contour de focus visible | scénario Playwright |
| Toucher simulé (`hasTouch`) | scénario Playwright |
| Persistance des paramètres après rechargement | scénario Playwright |
| Source OBD-II sans adaptateur (PC) : mesures en N/A, aucune valeur inventée | scénario Playwright |
| Vitesse inconnue : My BMW limité par prudence ; mode conduite simplifié | scénario Playwright |
| `InputManager`, profils de densité, filtrage des ouvrants (anti-rebond, perte de signal) | tests unitaires `tests/embedded.test.ts` |

Les autres écrans (Vehicle, Engine, Maintenance, Media, Settings) utilisent le nouveau shell
mais **n'ont pas encore été adaptés** aux densités compactes : ils peuvent encore défiler.

## 2. Ce qui n'est PAS validé — dépend du matériel

### Écran d'origine (EntryNav2 / NBT)
- L'APK **ne peut pas** être installé dans l'unité EntryNav2 : ce n'est pas un système Android.
- Afficher l'application sur l'écran d'origine nécessite une **interface vidéo** (entrée LVDS)
  pilotée par un appareil Android séparé. Aucune n'a été testée.
- Un boîtier CarPlay/Android Auto « classique » ne fait que projeter un téléphone : il
  **n'exécute pas** un APK tiers. Seul un boîtier Android complet (« AI box ») pourrait le faire,
  sous réserve de compatibilité, non vérifiée.
- Résolution réelle de l'écran : à mesurer sur le matériel retenu (les 5 profils testés couvrent
  les cas usuels).

### Molette iDrive
- Le mappage (rotation, pression, inclinaisons, BACK, MENU, OPTION) est prêt dans
  `src/input/` et testé **au clavier**.
- Aucune **passerelle iDrive → Android** n'est implémentée ni testée. La source `idrive` existe
  dans l'`InputManager`, mais rien ne l'alimente aujourd'hui. Une interface vidéo qui renvoie la
  molette sous forme de touches clavier/HID fonctionnerait via « Settings › Commandes » (touches
  configurables), sans code supplémentaire — à vérifier avec le matériel.
- Télécommande USB : toute télécommande se présentant comme un clavier HID est prise en charge
  par le même mécanisme (non testée physiquement).
- Bouton retour Android : relayé à l'interface (`MainActivity.kt`), non testé sur appareil.

### États des ouvrants (portières, hayon, capot)
- `BodyStatusProvider` : seul le **fournisseur simulé** (mode démonstration) existe. En mode
  OBD, l'état affiché est « non disponible ».
- Les PID OBD-II standard **ne contiennent pas** ces états. Il faudrait lire le bus CAN carrosserie
  BMW via un matériel adapté, ce qui n'est **ni validé ni implémenté**.
- Aucune commande d'ouverture ou de verrouillage n'existe, et aucune ne sera ajoutée.

### OBD-II
- Reste strictement en lecture seule. Le plugin Kotlin Bluetooth n'a pas été modifié par cette
  refonte (seul l'appel JS de demande d'autorisation a été aligné sur son nom réel).
- Qualité de connexion, horodatage des dernières données et perte de signal (> 5 s) sont
  affichés ; leur comportement avec un vrai adaptateur dans la voiture **n'est pas testé**.

### APK
- La compilation de l'APK n'a pas été relancée depuis cette branche dans cet environnement.
  Seule la compilation web (`npm run build`) est vérifiée.

## 3. Maquette 3D
La carrosserie reste la **maquette provisoire** (non modifiée par cette refonte), signalée à
l'écran. Seuls l'éclairage studio, l'ombre au sol et le plateau ont été ajoutés autour.
