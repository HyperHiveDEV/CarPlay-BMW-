# Sauvegarde et restauration du projet

## Contenu du dépôt
Code source (React/TypeScript/Three.js), projet Android (Capacitor + plugins Kotlin), tests, scripts
Blender (`tools/blender/`), configurations (Vite, TypeScript, Tailwind, Capacitor, GitHub Actions),
documentation (`docs/`), captures, GLB maquette (`public/models/`).

Exclus volontairement : `node_modules/`, `dist/`, builds Android, APK, clés de signature, `local.properties`,
fichiers `.env` (aucun secret n'existe dans le projet), **photos du véhicule** (immatriculation lisible).

## Restaurer depuis le bundle git
```bash
git clone bmw-f21-digital.bundle bmw-f21-digital
cd bmw-f21-digital && npm install && npm run dev
```

## Publier sur un dépôt GitHub privé
1. Créer un dépôt **vide et privé** (sans README) sur https://github.com/new, ex. `bmw-f21-digital`.
2. Depuis la copie restaurée :
```bash
git remote set-url origin https://github.com/<votre-compte>/bmw-f21-digital.git
git push -u origin main
```
Le workflow `.github/workflows/android-apk.yml` compile alors l'APK de débogage (onglet Actions).
