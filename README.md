# StructCalc — Tauri 2 · React · Rust

Application de calcul de structures en français pour desktop et mobile. Le front-end utilise **React/Vite, TypeScript, shadcn/ui et Lucide** ; Tauri 2 fournit l’application native, les dialogues de fichiers et le stockage local en Rust.

Les **13 icônes de projets validées sont conservées**, exportées directement du peintre Flutter d’origine en variantes claire et sombre. Les textes gardent **DM Sans**, les valeurs **JetBrains Mono**. L’ancien projet est disponible dans [`legacy/flutter`](legacy/flutter), sans être compilé par les nouveaux workflows.

## Fonctionnalités

- Calculateurs de poutres et cadres plans : édition des modèles, solveurs numériques, réactions, efforts et déformations ; plan SVG avec zoom, panoramique et recentrage ; inspecteur desktop et onglets mobile.
- Descentes de charges sur poteaux et voiles : surfaces d’influence, niveaux et revêtements, cumuls ELU/ELS, vent simplifié sur voile.
- Bâtiments : niveaux, trames, panneaux, poutres, voiles, poteaux, éléments obliques, regroupement de panneaux et résultats par niveau.
- Huit prédimensionnements : poteau, poutre, voile, escalier, balcon, plancher, soutènement et semelle.
- Sauvegarde locale, réouverture, duplication, export/import JSON, sauvegarde de l’espace, préréglages de sections et thèmes.

Les méthodes et leurs limites sont précisées dans l’interface et dans [la documentation de migration](docs/tauri-migration.md). Le profil est local ; aucun service de connexion, paiement ou synchronisation distante n’est configuré.

## Développement

Prérequis : Node.js 24, Rust stable et [prérequis natifs Tauri](https://v2.tauri.app/start/prerequisites/) de votre système.

```bash
npm ci
npm run dev            # interface dans le navigateur
npm run tauri dev      # application native desktop
npm run tauri build    # bundles desktop de votre système
```

Le navigateur utilise son stockage local ; l’application native utilise un fichier JSON géré par Rust. Les données restent sur l’appareil. Pour Android : JDK 17, SDK/NDK Android et cible Rust `aarch64-linux-android` ; puis `npm run icons`, `npm run android:init` et `npm run tauri android dev`. La commande d’initialisation applique aussi les zones de sécurité de la WebView Android. Pour iOS, utilisez macOS/Xcode et `npm run tauri ios init`.

Le layout natif desktop dispose d’un atelier distinct du navigateur. Les éditeurs s’ouvrent à gauche sur desktop et en bas sur mobile ; les schémas et les graphes sont décrits dans les [aperçus des espaces de travail](docs/workspaces-and-diagrams.md).

## Builds GitHub Actions

Les workflows s’exécutent sur les pull requests, les pushes sur `main`, et manuellement après leur intégration à `main`. Les téléchargements se trouvent dans **Actions → run terminé → Artifacts** et restent disponibles 14 jours.

| Plateforme                           | Artefact                                            | Contenu                                                         |
| ------------------------------------ | --------------------------------------------------- | --------------------------------------------------------------- |
| Windows 10/11 x64                    | `structcalc-tauri-windows`                          | Installateur NSIS, EXE portable et lanceur de compatibilité GPU |
| macOS Intel et Apple Silicon         | `structcalc-tauri-macos-universal`                  | DMG universel, signature ad hoc                                 |
| Linux x64                            | `structcalc-tauri-linux`                            | DEB et AppImage                                                 |
| Android ARM64, Android 7+            | `structcalc-tauri-android-arm64`                    | APK signé installable et information de signature               |
| iOS 16.4+, simulateur Intel ou ARM64 | `structcalc-tauri-ios-simulator-x86_64` / `…-arm64` | Application `.app` pour simulateur Xcode                        |

**Windows :** privilégiez l’installateur `*-setup.exe`, qui vérifie WebView2 et installe son runtime si nécessaire (Internet requis dans ce cas). L’EXE portable exige WebView2 déjà installé. En cas de problème graphique, le lanceur `Lancer-compatibilite.cmd` démarre WebView2 avec `--disable-gpu`. Ce moteur diffère du moteur de rendu Flutter ; le résultat sur une carte NVIDIA particulière doit être confirmé sur la machine concernée. Le workflow ouvre réellement le build Windows, calcule et sauvegarde un projet, puis le relit après redémarrage en mode de compatibilité.

**Signature Android :** sans secrets, chaque run génère une clé de développement temporaire. Pour conserver les mises à jour entre builds et préparer une distribution, définissez `ANDROID_KEY_BASE64`, `ANDROID_STORE_PASSWORD`, `ANDROID_KEY_ALIAS` et `ANDROID_KEY_PASSWORD` dans les secrets Actions. Les APK créés avec des clés temporaires différentes ne peuvent pas se mettre à jour mutuellement.

**Simulateur iOS :** les builds automatiques ciblent un Mac Intel pour éviter la saturation du pool ARM64 de GitHub. Pour un Mac Apple Silicon, lancez manuellement le workflow avec `ios_host = apple-silicon`. Le nom de l’artefact précise son architecture.

**iPhone :** l’artefact actuel est pour le simulateur. Une application installable sur appareil ou distribuée via TestFlight nécessite votre équipe Apple, vos certificats et profils de provisionnement ; ils ne sont pas configurés dans ce dépôt. Les applications Windows ne sont pas signées avec un certificat éditeur et macOS n’est pas notarié.

## Vérification

```bash
npm run build
npm test
npx playwright install --with-deps chromium
npm run test:e2e
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo test --manifest-path src-tauri/Cargo.toml --no-default-features --lib --locked
```

Les tests couvrent les références de calcul Dart, les solveurs, les interactions desktop/mobile et le stockage Rust. Le détail de l’architecture, des données et des signatures se trouve dans [`docs/tauri-migration.md`](docs/tauri-migration.md).
