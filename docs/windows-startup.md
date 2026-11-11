# Démarrage Windows : diagnostic et corrections

## Ce que le dépôt permet d'établir

Le build précédent compilait et compressait l'application sans jamais la lancer. Un build vert ne vérifiait donc ni la première interface, ni le paquet extrait, ni le fonctionnement sur le GPU d'un utilisateur.

`main.dart` attendait `AppState.loadPersisted()` avec un simple fond sombre pendant l'attente. Une lecture qui ne se termine pas laissait ce fond sans indication ni limite. Les erreurs de restauration n'étaient pas traitées dans le `FutureBuilder`, et les données étaient modifiées progressivement pendant le décodage. Le ZIP Windows ne fournissait pas explicitement les bibliothèques redistribuables Visual C++ : leur présence sur un runner équipé de Visual Studio ne prouve pas leur présence sur le PC destinataire.

L'utilisateur a confirmé Windows 10, un GPU NVIDIA et la présence de `data` et des DLL après extraction. Cela rend l'extraction incomplète moins probable. **La cause précise de son écran noir n'est pas confirmée sans essai du nouveau paquet et journal de cette machine.** Un défaut de rendu graphique et une attente du stockage sont deux mécanismes différents ; le correctif rend leur distinction possible.

## Corrections

- Écran de chargement explicite ; lecture des préférences limitée à 8 secondes.
- En cas d'exception ou de délai dépassé : **Réessayer** ou **Continuer sans sauvegarde**.
- Restauration atomique : les données ne sont appliquées qu'après décodage complet. Un réessai ne duplique pas les projets ou les préréglages. Une lecture tardive ne remplace pas une session temporaire, et une lecture terminée après fermeture ne notifie pas un état détruit.
- La session temporaire affiche un bandeau et désactive les écritures de l'état global et des deux calculateurs. Aucun fichier de sauvegarde n'est effacé ou réparé automatiquement.
- Les erreurs d'écriture en arrière-plan sont interceptées et journalisées ; elles ne deviennent pas des exceptions asynchrones non prises en charge.
- Le ZIP inclut les DLL CRT x64 du toolset MSVC du runner, en plus du bundle Flutter complet. Le script vérifie aussi les données AOT, ICU et les deux fontes existantes.
- `Lancer-compatibilite.cmd` démarre le même exécutable avec `--compatibility`. Le runner C++ utilise les API publiques de Flutter pour désactiver Impeller et préférer un GPU basse consommation (intégré s'il existe). **Ce mode utilise toujours l'accélération graphique ; ce n'est pas un rendu logiciel et il ne garantit pas de contourner tous les défauts de pilote.** Le lancement normal conserve les choix par défaut du moteur.
- Les workflows utilisent Flutter **3.47.9** et le `pubspec.lock` validé. Comme `flutter create` réécrit ce fichier même avec `--no-pub`, les workflows le restaurent avant `flutter pub get --enforce-lockfile`. Les fontes et `AppTheme` restent inchangés.

Le runner personnalisé est conservé dans `tool/windows/main.cpp`. Le workflow le copie sur `windows/runner/main.cpp` après génération du projet, car les dossiers de plateforme restent générés. Pour reproduire localement : `flutter create --platforms=windows --org com.structcalc --project-name structcalc --no-pub .`, copier ce fichier, restaurer le lockfile avec `git restore -- pubspec.lock`, puis `flutter pub get --enforce-lockfile` et `flutter build windows --release`.

## Journaux et essai sur le PC concerné

1. Télécharger l'artefact **structcalc-windows** du nouveau build de cette branche/PR.
2. Extraire l'archive GitHub, puis le ZIP interne s'il est présent. Lancer `structcalc.exe` en conservant toutes les DLL et `data` à côté.
3. Si la fenêtre reste noire, la fermer et lancer `Lancer-compatibilite.cmd` dans le même dossier.
4. Consulter `%LOCALAPPDATA%\StructCalc\Logs\startup.log` (secours : `%TEMP%\StructCalc\Logs\startup.log`). Le journal est local ; rien n'est transmis automatiquement. Il peut contenir des chemins locaux. Le précédent journal est conservé à la rotation au-delà de 512 Kio.

Repères utiles :

| Dernier repère / symptôme | Ce qu'il permet d'examiner |
| --- | --- |
| Aucun `native.start` | Exécutable non atteint : extraction, architecture, chargement DLL, blocage Windows ; vérifier aussi que le dossier de journaux est accessible. |
| `native.start` sans `dart.startup.main` | Échec avant l'entrée Dart : moteur, données AOT, initialisation native ou graphique ; consulter les erreurs natives adjacentes. |
| `dart.preferences.failed` | Lecture ou décodage des données : un écran de récupération doit être affiché. Le type et la pile de l'exception sont journalisés sans recopier les projets. |
| `dart.startup.first_frame` et `dart.preferences.loaded`, mais écran noir | Le code Dart a démarré ; comparer les deux modes et le pilote graphique. La présence d'un callback de frame ne prouve pas à elle seule que les pixels ont été présentés correctement à l'écran. |
| Le mode compatibilité fonctionne seul | Indice en faveur d'une différence de moteur/GPU/pilote ; mettre à jour les pilotes depuis NVIDIA et le fabricant du GPU intégré. |

Une absence de runtime C++ provoque normalement un échec de chargement du processus, pas nécessairement une fenêtre noire déjà ouverte. Son inclusion corrige la distribution, sans constituer une preuve de la cause signalée.

## Validation

Les tests de régression simulent un stockage qui ne répond pas, une exception de plateforme, des données invalides, un réessai et une session temporaire sans écriture. Ils couvrent aussi les chargements tardifs et la sauvegarde des calculateurs dans cette session.

Le workflow Windows lance **l'exécutable release extrait du ZIP final**, en modes normal et compatibilité, depuis un répertoire de travail différent et un chemin contenant espaces et accent. Il attend le bouton accessible **Commencer**, vérifie les repères de démarrage et les exceptions, et capture la zone cliente pour rejeter une surface uniforme/noire. Les images et journaux sont téléversés dans **structcalc-windows-diagnostics**, y compris en cas d'échec. Cet essai vérifie le runner GitHub ; il ne reproduit pas la carte NVIDIA de l'utilisateur.

## Sources de recherche

- [Flutter : distribution Windows et DLL requises](https://docs.flutter.dev/platform-integration/windows/building#building-your-own-zip-file-for-windows).
- [Flutter : gestion des erreurs de framework et asynchrones](https://docs.flutter.dev/testing/errors).
- [Flutter : écran noir Windows sur certains matériels, incident corrigé #150546](https://github.com/flutter/flutter/issues/150546).
- [Flutter : écran noir lors d'un repli OpenGL d'Impeller, incident corrigé #187287](https://github.com/flutter/flutter/issues/187287). Ces incidents prouvent que cette famille de symptômes existe ; ils n'identifient pas le défaut de cette machine.
- [Code du moteur 3.47.9 : variables de switches ignorées en release](https://github.com/flutter/flutter/blob/3.47.9/engine/src/flutter/shell/platform/common/engine_switches.cc). Ajouter seulement `FLUTTER_ENGINE_SWITCH_1` ou passer un flag moteur au runner standard ne serait pas une solution fiable pour le ZIP release.
