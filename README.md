# F21 Digital — cockpit 3D pour BMW 116i F21 LCI

Application Android personnalisée (APK) pour une BMW Série 1 116i **F21 LCI 2018, 3 portes, M Sport,
B38 Stage 1 (170 ch déclarés)** : visualisation 3D interactive, éclairage simulé, télémétrie OBD-II
en lecture seule, carnet d'entretien hors ligne, multimédia et réglages. Fonctionne intégralement
en **mode démonstration** sur PC, sans véhicule.

> **État actuel** — la voiture 3D est une **reconstitution générée par code d'après la photo de
> profil du véhicule** (silhouette, vitrages, portières, ligne de caractère, feux relevés sur la
> photo et mis à l'échelle sur l'empattement réel). Elle est fidèle en proportions mais reste une
> approximation : pour un rendu « catalogue », déposer un modèle GLB F21 LCI sous licence
> (voir [docs/IMPORT_MODELE_3D.md](docs/IMPORT_MODELE_3D.md)). **Aucun APK n'a été compilé** dans
> l'environnement de développement (dépôts Google bloqués) : voir « Générer l'APK ».

## Lancer sur PC

Prérequis : Node.js ≥ 20.

```bash
npm install
npm run dev
```

Ouvrir http://localhost:5173 (plein écran F11, format paysage). Autres commandes :

```bash
npm run build     # build de production dans dist/
npm run preview   # servir le build
npm test          # tests unitaires (garde lecture seule, PID, entretien, sécurité)
```

## Fonctionnalités

| Écran | Contenu |
|---|---|
| **My BMW** | identité du véhicule, kilométrage, heure/date, BMW 3D (caméra 3/4 avant), préréglages caméra, éclairage |
| **Vehicle** | ouvrants (portières conducteur/passager, capot, hayon) animés sur charnières, état réel (N/A sans source), batterie, carburant, température, connexion, alertes, feux (blanc/violet, clignotants, détresse, stop), rotation/braquage des roues, 7 caméras, retour position initiale |
| **Engine** | compte-tours circulaire, vitesse, 8 cartes (liquide, huile, suralimentation, MAP, accélérateur, charge, batterie, air), graphiques 60 s, badges **LIVE / DEMO / N/A**, puissance déclarée fixe |
| **Maintenance** | 10 postes suivis, ajout/modification/suppression, date, km, note, échéance, alertes « bientôt / dépassé », historique ; stockage local hors ligne ; historique DEMO séparé |
| **Media** | contrôles de lecture (session média Android), navigation, applications installées, Bluetooth, volume |
| **Settings** | accent bleu/violet, jour/nuit, qualité 3D, animation d'accueil, caméra par défaut, sensibilité, kilométrage, transmission, caractéristiques, source de données, connexion OBD, diagnostic, réinitialisation |

Interactions 3D : glisser pour tourner (360°), molette/pincement pour zoomer, toucher une portière,
le capot ou le hayon pour l'animer. Séquence d'accueil (~3,5 s, désactivable, toucher pour passer).

**Sécurité** : aucune animation n'envoie de commande au véhicule. En roulage (ou vitesse inconnue),
l'interface passe en vue « conduite » (vitesse, régime, température) et bloque la manipulation 3D et les saisies.
Tester : Paramètres › Diagnostic › Scénario « Roulage ».

## Architecture

```
src/
  components/   UI réutilisable (jauges, graphiques, badges, barre de navigation)
  screens/      écrans (présentation uniquement)
  three/        rendu 3D : scène, matériaux PBR, gabarit relevé (f21Blueprint), carrosserie lissée
                (f21Body), matériau par zones (zoneMaterial), chargeur GLB, caméras
  animations/   amortissements, animateur d'ouvrants, rythme des clignotants
  vehicle/      types, VehicleDataRepository, ConnectionManager, VehicleDataValidator,
                SimulatedVehicleProvider (données DEMO), sécurité conduite
  obd/          OBDVehicleProvider (ELM327), PID SAE J1979, garde lecture seule, transport Bluetooth
  maintenance/  modèle, calcul des échéances, stockage local, historique démo
  settings/     préférences persistantes
  native/       pont vers les plugins Android (applications, média, volume)
  state/        état visuel de la scène 3D
android/        projet Capacitor + plugins Kotlin (ObdBluetoothPlugin, AppLauncherPlugin, MainActivity)
public/models/  emplacement du modèle GLB définitif
docs/           import 3D, analyse des photos, validations sur véhicule
```

### Choix techniques
- **React + TypeScript + Vite** : itération visuelle rapide, typage strict.
- **Three.js / React Three Fiber / drei** : rendu PBR, environnement studio procédural (aucun HDR
  téléchargé : 100 % hors ligne), ombres de contact douces, sol réfléchissant en qualité élevée,
  **qualité adaptative** (3 niveaux + baisse automatique si les FPS chutent), rendu suspendu hors écran 3D
  et en arrière-plan.
- **Tailwind CSS** + police **Inter** embarquée (lisible, chiffres tabulaires).
- **Zustand** : état et persistance `localStorage` (préférences, entretien) — conservé par la WebView Android.
- **Capacitor 6** : empaquette l'app web dans un APK natif ; **Kotlin** pour le Bluetooth SPP et les intents Android.
  Alternative envisagée : Kotlin + Filament natif (plus performant), écartée pour la vitesse de développement de l'UI.

## Générer l'APK

### Option A — GitHub Actions (sans rien installer)
Poussez ce dossier dans un dépôt GitHub : le workflow `.github/workflows/android-apk.yml` compile
`app-debug.apk` (onglet **Actions** › dernier run › artefact `f21-digital-debug-apk`).

### Option B — en local
Prérequis : JDK 17, Android SDK (Android Studio), variable `ANDROID_HOME`.

```bash
npm install
npm run android:apk
```

APK : `android/app/build/outputs/apk/debug/app-debug.apk`. Ou ouvrir `android/` dans Android Studio.

### Installer sur l'autoradio
1. Vérifier que l'autoradio est sous Android et autorise les sources inconnues (CarPlay seul ≠ Android).
2. Copier l'APK sur une clé USB, l'ouvrir avec le gestionnaire de fichiers de l'autoradio, ou `adb install app-debug.apk`.
3. Premier lancement : autoriser le Bluetooth « Appareils à proximité » pour l'OBD.

## OBD-II
Adaptateur **ELM327 Bluetooth classique (SPP)** compatible (ex. OBDLink LX, Vgate iCar Pro 2S en mode
Bluetooth classique). Jumeler d'abord dans Android, puis Paramètres › Source de données › OBD-II ›
Rechercher. L'application interroge seulement les PID Mode 01 **déclarés supportés** par la DME.
Strictement en lecture : écriture, codage, reprogrammation, effacement des défauts et commandes
d'actionneurs sont refusés par une liste blanche (JS **et** Kotlin). Les données propriétaires
BMW (ouvrants, kilométrage, CBS) ne sont pas accessibles avec un adaptateur générique.

## Rendu 3D
**Modèle définitif** : évaluation des sources proposées et marche à suivre dans [docs/MODELE_DEFINITIF.md](docs/MODELE_DEFINITIF.md).
Modèles disponibles (Réglages › Rendu 3D › Modèle 3D, ou `?model=` dans l'URL) : **Auto** (modèle sous licence
`bmw_f21_lci.glb` s'il est présent, sinon RealisticF21), **GLB maquette** (fichier fourni, candidat —
rapport : [docs/GLB_MAQUETTE_RAPPORT.md](docs/GLB_MAQUETTE_RAPPORT.md)), **RealisticF21** (défaut effectif), **Ancien** (secours).
État de la reconstitution, limites et apport d'un modèle GLB : [docs/RENDU_3D.md](docs/RENDU_3D.md).
Outil de calage sur photo : `http://localhost:5173/?ortho=side` (ou `front`, `rear`, `top`).

## À valider sur le véhicule
Voir [docs/VALIDATION_VEHICULE.md](docs/VALIDATION_VEHICULE.md).

## Licence des ressources
Aucune ressource propriétaire n'est incluse (pas de logo BMW, pas de modèle 3D tiers).
« BMW », « M » et « M Performance » sont des marques de BMW AG ; le bandeau de pare-brise est un
texte personnalisable reproduisant l'équipement du véhicule du propriétaire.
