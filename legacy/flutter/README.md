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

## Récupérer un build desktop

Le workflow [Build desktop](https://github.com/BaronAdams/faloads/actions/workflows/build_desktop.yml) compile l'application Flutter en mode release pour **Windows, macOS et Linux**, sur un runner natif pour chaque système. Il se lance à chaque push sur `main`, pour les pull requests, ou manuellement via **Actions → Build desktop → Run workflow** une fois le workflow présent sur `main`.

Les dossiers `windows/`, `macos/` et `linux/` sont générés pendant le build, comme les plateformes mobiles. Aucun secret supplémentaire n'est nécessaire.

Après un run réussi, ouvrez sa section **Artifacts** et téléchargez le fichier correspondant à votre système (conservé pendant 14 jours) :

| Artefact | Archive incluse | Lancement après extraction |
| --- | --- | --- |
| `structcalc-windows` | `structcalc-windows.zip` | Lancez `structcalc.exe` en conservant les DLL et le dossier `data` à côté. |
| `structcalc-macos` | `structcalc-macos.zip` | Ouvrez `structcalc.app`. |
| `structcalc-linux` | `structcalc-linux.tar.gz` | Lancez `./structcalc` en conservant les dossiers `lib` et `data` à côté. |

GitHub télécharge chaque artefact dans un ZIP : extrayez-le, puis extrayez l'archive qu'il contient. Les archives macOS et Linux préservent les permissions d'exécution et les liens symboliques.

Ces builds sont des applications portables, sans installeur. Les builds Windows et Linux ciblent x64 ; le build macOS utilise l'architecture fournie par `macos-latest`. L'application macOS n'est pas signée avec un certificat Apple Developer ni notariée ; Gatekeeper peut donc demander une autorisation à la première ouverture. Le bundle Linux nécessite les bibliothèques système GTK 3 et une distribution compatible avec le runner `ubuntu-latest` utilisé pour le compiler.
