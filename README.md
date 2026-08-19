# faloads — StructCalc (Flutter)

Portage natif Flutter de **StructCalc**, une app de calcul de descente de charges et de prédimensionnement en béton armé — cahier des charges dans [`StructCalc - Spec Flutter.md`](.) (voir le dépôt de conception d'origine pour les prototypes HTML de référence).

## État du portage

Développement en 6 phases (voir la todo list de la session de build) :

1. ✅ **Socle** — projet Flutter, thème sombre, état d'app, Landing → Onboarding (5 écrans) → Paywall → shell à 3 onglets (Calculs / Paramètres / Mon compte), Dashboard avec sections Prédimensionnement / Descente de charges (écrans de destination en "Bientôt disponible" pour l'instant).
2. ⏳ Couche domaine/calcul (catalogues, formules de prédimensionnement, surfaces d'influence).
3. ⏳ Écran Prédimensionnement.
4. ⏳ Poteau isolé + Voile isolé (5 étapes).
5. ⏳ Réseau de poutres (3 étapes).
6. ⏳ Bâtiment complet (canvas interactif).

## Lancer le projet

Ce dépôt ne contient que le code Dart/Flutter (`lib/`, `pubspec.yaml`, tests) — les dossiers de plateforme (`android/`, `ios/`, …) sont générés, pas committés :

```bash
flutter create --platforms=android,ios .
flutter pub get
flutter run
```

## Récupérer un build sur votre téléphone

Chaque push sur `main` déclenche `.github/workflows/build_mobile.yml`, qui compile et publie deux artefacts dans l'onglet **Actions** du run correspondant :

- **`structcalc-android`** — un `.apk` installable directement (activez "Sources inconnues" sur Android).
- **`structcalc-ios-unsigned`** — un `.ipa` **non signé** (aucun compte Apple Developer n'est configuré dans ce dépôt). Pour l'installer sur un iPhone, il faut le signer localement avec un outil comme [Sideloadly](https://sideloadly.io/) ou [AltStore](https://altstore.io/) et votre propre identifiant Apple gratuit.
