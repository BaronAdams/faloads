# KaliSigma : identité et lecture du ruban

L’application affiche désormais **KaliSigma** dans l’onboarding, la navigation, les paramètres, les menus, les titres de fenêtres, les installateurs et les applications mobiles. Les fichiers exportés et les artefacts de build portent également ce nom.

## Résultats et tooltips

Le bouton Résultats des analyses de poutres/cadres et du bâtiment utilise **FileChartColumn**, un document de résultats chiffrés, avec le libellé accessible « Ouvrir les résultats ».

Les tooltips du header sont placés à partir de la position réelle de chaque bouton dans sa grille : **au-dessus pour la première ligne, au-dessous pour la seconde**. Une rangée simple utilise le dessus. Le placement est recalculé au survol et au focus clavier, après redimensionnement ou défilement horizontal. Les libellés restent dans la largeur de l’écran ; les popups ne participent pas à la hauteur du ruban. Leur hauteur compacte laisse la place nécessaire au-dessus de la première ligne sur mobile.

Les tests navigateur vérifient les trois projets sur Desktop et mobile : sens du tooltip, limites de l’écran, absence de recouvrement de tous les boutons du header et hauteur fixe. Le test du véritable EXE Windows vérifie aussi le nouveau nom, l’icône de rapport et les deux sens des tooltips.

## Une même icône sur les plateformes

La source commune reste [public/app-icon.svg](../public/app-icon.svg), le sigma bleu sur fond bleu nuit. Le même fichier est affiché dans l’interface et décliné par Tauri pour Windows, macOS, Linux, Android et iOS. [tools/app-icon.json](../tools/app-icon.json) définit le fond mobile et la mise à l’échelle de l’icône adaptative Android.

Les workflows exécutent **l’initialisation native, puis la génération des icônes**. Tauri écrit ainsi les images dans le projet Android ou le catalogue d’assets iOS utilisé par la compilation, au lieu de laisser l’initialisation recréer son icône par défaut. Le nom affiché par Android et celui de l’application iOS sont vérifiés dans les artefacts construits.

## Compatibilité des projets

Le nom affiché et les exécutables changent ; l’identifiant natif `com.structcalc.app`, la clé de stockage `structcalc.workspace.v1` et les marqueurs des anciens fichiers JSON sont conservés. Les projets et sauvegardes existants restent lisibles. Les noms internes de la bibliothèque Rust sont également conservés pour la compatibilité des liaisons mobiles. Les nouveaux exports utilisent le nom KaliSigma et l’extension `.kalisigma.json`.

Les polices et les treize icônes des projets types restent celles de l’application.

## Aperçus

| Écran | Desktop | Mobile |
|---|---|---|
| Identité KaliSigma | [Voir](kalisigma-preview/brand-desktop.png) | [Voir](kalisigma-preview/brand-mobile.png) |
| Tooltip de la première ligne | [Voir](kalisigma-preview/tooltip-top-desktop.png) | [Voir](kalisigma-preview/tooltip-top-mobile.png) |
| Résultats sur la seconde ligne | [Voir](kalisigma-preview/tooltip-bottom-desktop.png) | [Voir](kalisigma-preview/tooltip-bottom-mobile.png) |
