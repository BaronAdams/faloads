# Migration Flutter → Tauri 2

## Architecture

- `src/pages` : accueil, projets, dimensionnement béton armé, descentes, bâtiment, analyse poutre/cadre, paramètres et profil.
- `src/components/ui` : composants shadcn/ui générés avec le CLI officiel ; `components.json` conserve la configuration. Lucide fournit les icônes d’actions.
- `src/components/playground.tsx` : caméra SVG, zoom molette/pincement, panoramique par outil Main, touche Espace ou bouton central ; sélection au relâchement sans déplacement.
- `src/domain` : modèles validés avec Zod et calculs. Les noyaux des solveurs poutre/cadre proviennent des deux prototypes HTML fournis, débarrassés de leurs dépendances DOM ; les valeurs affichées sont recalculées à partir du modèle édité.
- `src/lib` : état, persistance, import/export, thème et brouillons. Le thème ne dépend d’aucun script injecté en ligne.
- `src-tauri` : entrée native desktop/mobile, commandes Rust, fichier de travail et capacités limitées aux dialogues et fichiers choisis par l’utilisateur.

Les calculs sont en TypeScript/JavaScript pour que navigateur et application native utilisent les mêmes fonctions. Rust gère la frontière native et les écritures durables. Les projets et préférences ne nécessitent pas de serveur.

## Préservation des icônes et polices

Les associations restent : **01C 02B 03C 04B 05B 06C 07B 08C 09A 10C 11C 12B 13C**. `public/project-icons` contient 26 PNG transparents de 352 × 352 pixels, exportés à partir du `CustomPainter` original sans changer sa géométrie. `provenance.json` donne la révision source et les empreintes SHA-256. Le test d’export se trouve dans l’archive Flutter. L’icône d’application sigma et les icônes Lucide sont indépendantes des icônes de projets.

Les trois fichiers de polices sont copiés à l’identique depuis `legacy/flutter/assets/fonts` vers `public/fonts`.

## Méthodes conservées et limites

Les huit modules de Dimensionnement Béton Armé, combinaisons ELU/ELS, charges de planchers/revêtements, surfaces d’influence et formules simplifiées de vent reprennent le domaine Dart d’origine. `tools/reference-fixtures.dart` permet de régénérer `src/domain/legacy-fixtures.json` depuis cette archive ; les tests TypeScript comparent les résultats aux références calculées indépendamment en Dart.

La poutre prend en charge appuis rigides/élastiques, déplacements imposés, rotules, sections variables, charges ponctuelles et réparties, moments et effort axial ; les modèles Euler-Bernoulli et Timoshenko sont disponibles. Le cadre utilise une analyse élastique linéaire plane avec charges nodales et réparties sur les barres. Un modèle instable affiche une erreur explicite. Le dialogue « Calcul simplifié G/Q » conserve les formules rapides originales, séparées de ces modèles détaillés.

Le bâtiment conserve la méthode **par niveau** d’origine : aire géométrique d’influence × moyenne des pressions des panneaux voisins pour les poteaux, répartition tributaire à 45° vers les poutres et voiles. Il ne s’agit pas d’un calcul global de structure à étages ; les niveaux ne sont pas automatiquement cumulés entre eux. Les descentes dédiées au poteau/voile réalisent, elles, le cumul vertical. Le poids propre des éléments verticaux, les vérifications de flambement et le dimensionnement des armatures ne sont pas ajoutés implicitement. Les éléments obliques utilisent les charges/surfaces renseignées explicitement.

## Données et démarrage

L’identifiant Tauri est `com.structcalc.app`. Le fichier `workspace.json` est dans le répertoire de données de cette application (`%APPDATA%\com.structcalc.app` sous Windows). Une écriture prépare un fichier temporaire, synchronise son contenu et remplace la sauvegarde ; la version précédente est conservée. Les écritures sont sérialisées côté interface et côté Rust. Les imports sont limités et les modèles sont validés avant ouverture.

Une sauvegarde illisible n’est pas effacée : l’écran de récupération propose une nouvelle tentative ou une session temporaire avec sauvegarde désactivée. Un échec de sauvegarde reste visible et permet de réessayer. L’écran de chargement et le secours HTML évitent de laisser un écran vide si le démarrage du front échoue. Les journaux contiennent des identifiants d’événements, pas les données des projets.

Les fichiers de la version Flutter sont conservés et sa zone de données n’est pas écrasée. **La reprise automatique des sauvegardes Flutter n’est pas implémentée** : le format JSON de cette version Tauri est distinct. Les imports/exports de la nouvelle version servent au transfert entre ses installations. Gardez l’ancienne application et ses sauvegardes si vous devez reprendre une étude existante.

## Workflows et distribution

`check.yml` compile le front, exécute les tests numériques, les tests du stockage Rust et les parcours Playwright sur desktop/mobile. `build_desktop.yml` produit Windows x64, macOS universel et Linux x64. Sur Windows, un test CDP ouvre le véritable WebView2 release, effectue un calcul et vérifie la persistance Rust après relancement avec le GPU désactivé ; ses captures et diagnostics sont joints au run.

`build_mobile.yml` génère les projets natifs avec le CLI Tauri, produit et signe l’APK Android ARM64, puis compile une application iOS pour simulateur. Les sources générées ne sont pas committées ; les versions npm et Rust sont verrouillées. Les secrets Android optionnels sont décrits dans le README. Pour une version iPhone réelle, il reste à configurer les identifiants et certificats de votre équipe Apple ; l’artefact simulateur ne s’installe pas sur iPhone.

Le job iOS utilise par défaut `macos-15-intel`, Xcode 16.4 et la cible `x86_64`. Le label `macos-latest` pointe vers le pool ARM64, dont une saturation peut annuler le job avant son démarrage, sans journal de compilation. Tauri 2.12 impose l’architecture de l’hôte à son script de compilation du simulateur : l’option manuelle `ios_host: apple-silicon` utilise donc `macos-15` et `aarch64-sim` pour produire la variante ARM64. Xcode est sélectionné aussi avec `xcode-select`, car les sous-processus Tauri ne conservent pas toutes les variables d’environnement. Le projet Xcode généré pour ce job est limité à `SDKROOT = iphonesimulator` et `SUPPORTED_PLATFORMS = iphonesimulator` pour éviter une destination d’archivage iPhone ambiguë et l’erreur `ARCHS: parameter null or not set`. Avant l’archivage, `lipo` vérifie l’architecture et `vtool` vérifie la plateforme `IOSSIMULATOR` ; un binaire iPhone ne peut donc pas être publié comme simulateur. Le nom de l’artefact indique `x86_64` ou `arm64`. Voir les [images GitHub disponibles](https://github.com/actions/runner-images#available-images) et le [script Xcode de Tauri](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.4/crates/tauri-cli/src/mobile/ios/xcode_script.rs).

Les versions minimales sont Android API 24 et iOS 16.4 (notamment pour les fonctionnalités CSS de Tailwind 4). Le mode Windows portable exige WebView2 ; l’installateur inclut son bootstrapper. La compatibilité GPU reste une option de dépannage et ne garantit pas le comportement de tous les pilotes Windows 10.

Les layouts natifs et les dessins sont documentés avec leurs aperçus dans [Espaces desktop/mobile et schémas](workspaces-and-diagrams.md). Le layout web reste distinct de l’atelier desktop. Le projet Android est initialisé avec `npm run android:init`, qui applique les insets système et clavier au conteneur de la WebView après génération par Tauri.

Sous Windows, `tauri.windows.conf.json` réserve la création de la fenêtre au code Rust : les arguments GPU sont transmis directement avec `additional_browser_args`. Depuis WebView2 150, les variables `WEBVIEW2_*` sont ignorées dans les processus élevés ; une modification de `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` seule ne suffit donc pas sur le runner Windows ou lors d’un lancement administrateur. Le test demande explicitement un port de diagnostic local avec `--ci-smoke-port`, accepté seulement quand `CI=true`. Chaque lancement utilise un profil WebView distinct, tout en relisant le même stockage Rust. Un lancement normal n’ouvre aucun port de diagnostic. Voir [l’explication Microsoft](https://github.com/MicrosoftEdge/WebView2Feedback/issues/5645#issuecomment-4934355430).

Références : [prérequis Tauri](https://v2.tauri.app/start/prerequisites/), [installateur Windows/WebView2](https://v2.tauri.app/distribute/windows-installer/), [GitHub Actions](https://v2.tauri.app/distribute/pipelines/github/), [dialogues mobiles](https://v2.tauri.app/plugin/dialog/), [signature iOS](https://v2.tauri.app/distribute/sign/ios/), [shadcn/Vite](https://ui.shadcn.com/docs/installation/vite).
