# Fonctions à valider sur le véhicule / l'autoradio

Rien de ce qui suit n'a pu être testé dans l'environnement de développement (pas de véhicule,
pas d'appareil Android). À vérifier dans cet ordre.

## Autoradio
- [ ] L'autoradio tourne réellement sous **Android** et autorise l'installation d'APK
      (sources inconnues). Un écran CarPlay seul (Linux/RTOS) ne le permet pas.
- [ ] Version d'Android ≥ 5.1 (minSdk 22) et WebView système à jour (Chrome ≥ 90 conseillé).
- [ ] WebGL 2 disponible (Paramètres › Diagnostic). Sinon, qualité « Économie ».
- [ ] Fluidité : viser 60 FPS, sinon baisser la qualité (le mode Auto dégrade de lui-même).
- [ ] Résolution / format (souvent 1280×480, 1920×720 ou 1024×600) : mise en page correcte.
- [ ] Plein écran immersif, pas de barre système résiduelle.
- [ ] Mise en veille / reprise (contact coupé, appel, retour d'une autre appli).
- [ ] Mémoire : pas de fermeture forcée après 30 min.
- [ ] Molette iDrive : uniquement si le boîtier d'interface transmet des événements clavier à Android
      (non implémenté ; la WebView recevra les touches directionnelles si elles existent).

## OBD-II (adaptateur ELM327 Bluetooth classique)
- [ ] Jumelage et connexion (adaptateurs BLE seuls non pris en charge dans cette version).
- [ ] PID réellement supportés par la DME (liste affichée dans Paramètres › Source de données).
- [ ] Cohérence : régime, vitesse, liquide de refroidissement vs combiné.
- [ ] Température d'huile (PID 5C) : probablement **N/A** en OBD générique sur B38.
- [ ] Suralimentation = MAP (0B) − baro (33) : vérifier ; 0B plafonne à 255 kPa (≈ 1,5 bar relatif).
- [ ] Tension batterie (PID 42 ou ATRV).
- [ ] Niveau carburant (PID 2F) : souvent non exposé.
- [ ] Rafraîchissement : ~5–8 PID/s selon l'adaptateur ; délai > 6 s => état « erreur ».
- [ ] Aucun voyant ni défaut provoqué sur le véhicule (lecture seule).
- [ ] Débrancher l'adaptateur en stationnement prolongé (consommation batterie).

## Sécurité
- [ ] En roulage (vitesse LIVE > 3 km/h), l'interface passe en vue conduite.
- [ ] Vitesse indisponible => interface limitée (pas d'hypothèse d'arrêt).
- [ ] Les alertes du combiné BMW restent prioritaires et visibles.

## Données non disponibles en OBD générique (affichées N/A)
- État réel des portières, capot, hayon (bus carrosserie BMW propriétaire).
- Kilométrage (saisie manuelle dans Paramètres › Véhicule).
- Transmission (à confirmer et saisir).
- Messages CBS BMW.
