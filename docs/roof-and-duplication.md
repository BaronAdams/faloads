# Repères des diagrammes, duplication et toiture

## Repères de tracé

Pour les poutres, les ordonnées positives des diagrammes N, V, M et θ sont tracées vers le haut. Pour chaque barre de cadre orientée A → B, le côté positif est la normale obtenue par une rotation physique antihoraire de 90° : si le vecteur unitaire local est `(c, s)`, la normale est `(-s, c)`. Le SVG inverse le sens vertical ; sa normale de dessin est donc `(dy/L, -dx/L)`.

Les valeurs du solveur et les conventions des efforts ne changent pas. La déformée conserve la direction physique des déplacements ; inverser une ordonnée de diagramme ne doit pas inverser le mouvement de la structure. Les lectures au curseur et les valeurs aux extrémités restent associées aux mêmes abscisses.

## Duplication dans les analyses

Sélectionner un élément, placer le curseur dans le dessin en vue Structure, puis utiliser **Ctrl+D**. Le menu contextuel propose aussi **Dupliquer**. Les copies ont de nouveaux identifiants ; leurs propriétés peuvent être modifiées et supprimées indépendamment. Toute modification rend les anciens résultats non actualisés.

- Poutres : appuis, articulations, forces ponctuelles, moments et charges réparties. Les tronçons de section sont exclus. L’abscisse du curseur fixe la position ; une charge répartie conserve sa longueur et reste dans la poutre.
- Cadres : nœuds, barres, charges nodales, ponctuelles et réparties. Les forces sur barre sont projetées sur leur barre porteuse ; une charge nodale se rattache au nœud le plus proche. Les copies de barres conservent la connectivité entre leurs nouveaux nœuds et leurs charges associées. La section est une propriété conservée de la barre, pas un objet de section supplémentaire.
- Une sélection multiple conserve ses propriétés et reçoit de nouveaux identifiants. Pour les forces affectées à une même barre, le placement s’effectue sur cette barre. Les bornes et limites du modèle restent validées.

La transformation du curseur tient compte du zoom et du déplacement du dessin. Lorsqu’une copie étend le cadre, la caméra conserve son échelle jusqu’à **Recentrer**, afin de garder le nouvel élément au curseur.

## Toiture du bâtiment complet

Le groupe **Toiture** du ruban ouvre ses paramètres dans un dialogue Desktop ou un sheet mobile. La toiture appartient au projet et porte sur le dernier niveau. Les projets existants restent compatibles, sans toiture activée par défaut.

Modèles proposés : **un pan, deux pans, quatre pans**, sur l’emprise rectangulaire de la grille du dernier niveau. Paramètres : hauteur, orientation X/Y, entraxe maximal des fermes, entraxe indicatif des pannes et conservation éventuelle des dalles sous toiture. L’entraxe réel des fermes est ajusté uniformément pour terminer sur les deux rives. La vue 3D montre les pans, les pannes et une charpente équivalente ; la vue 2D en montre l’emprise et les fermes.

Chaque charge possède un nom, une intensité en kN/m², une surface de référence (inclinée ou projection horizontale), un pan cible ou tous les pans et une action : G, entretien, neige ou autre charge verticale. Aucun poids ni aucune valeur climatique réglementaire n’est prérempli. Le poids propre équivalent de la charpente doit être renseigné par l’utilisateur.

### Modèle de descente verticale

Le cheminement est : **couverture → pannes simplement appuyées → fermes équivalentes à deux appuis avec entrait → poutres/voiles de rive ou poteaux → étages inférieurs → fondations**.

Les pressions sont converties en charges par m² de projection horizontale. Chaque pan est découpé par les travées de pannes, puis les fonctions de réaction des pannes et des fermes sont intégrées sur ces polygones. L’intégration bilinéaire conserve les forces et les premiers moments, y compris sous chargement dissymétrique. Elle représente un transfert surfacique équivalent ; l’entraxe des pannes sert à leur représentation et ne constitue pas un calcul de résistance des pannes.

Une réaction sur un poteau existant lui est directement transmise. Entre poteaux, la poutre de rive reçoit une force ponctuelle dont les réactions d’extrémités respectent le bras de levier réel. Les tableaux et annotations de poutres présentent une charge linéique équivalente ; leurs estimations M/V ne remplacent pas une analyse de poutre sous les forces ponctuelles de toiture. Un voile de rive reçoit la charge équivalente. L’absence d’un porteur requis bloque le calcul et indique la rive concernée.

Les résultats donnent les G/Q, ELS et ELU par appui de ferme, le porteur destinataire, les surfaces et les résidus d’équilibre. Les charges de toiture entrent une seule fois dans les cumuls du dernier niveau au rez-de-chaussée. Les annotations de toiture se règlent dans **Vue → Annotations → Toiture** en 3D.

### Actions et limites

G est toujours actif. Un seul cas variable de toiture est sélectionné pour chaque calcul : entretien, neige ou autre. Les cas alternatifs ne sont pas additionnés automatiquement. La toiture est traitée en catégorie H pour ne pas appliquer la dégression des charges d’exploitation des étages à ses charges variables. Le bâtiment conserve ses combinaisons gravitaires simplifiées `G+Q` et `1,35G+1,5Q` ; ce n’est pas un générateur complet de combinaisons réglementaires.

Les actions de neige doivent être définies à partir du site, de la norme et de l’annexe nationale applicables, avant saisie des pressions caractéristiques. Cette première implémentation couvre les charges verticales descendantes : pas d’autogénération du vent de toiture, de soulèvement, de poussée horizontale, de flambement, de stabilité ou de dimensionnement des éléments de charpente. Les fermes dessinées sont une représentation du transfert équivalent, notamment aux extrémités d’une toiture à croupes ; elles ne constituent pas des détails constructifs validés.

### Sources consultées

- [SCI / BCSA — Portal frames](https://steelconstruction.info/topics/design/portal-frames) : systèmes toiture/pannes/portiques et distinction des actions d’entretien et climatiques.
- [FAO — Farm structures, structural design and roof trusses](https://www.fao.org/4/s1250e/S1250E0f.htm) : cheminement des charges couverture/pannes/fermes et hypothèses d’appui.
- [JRC / Access Steel — Actions on a portal-frame building](https://eurocodes.jrc.ec.europa.eu/sites/default/files/2022-06/SX016a-EN-EU.pdf) : exemples d’actions, notamment la neige sur projection horizontale ; les valeurs de cet exemple ne sont pas des valeurs par défaut de l’application.
- [JRC — EN 1991, atelier Eurocodes de deuxième génération, 2025](https://eurocodes.jrc.ec.europa.eu/sites/default/files/2025-08/2025_2G-Eurocodes-Workshop_EN%201991_MStacy_website_0.pdf) : évolution des actions et nécessité de choisir une édition et une annexe cohérentes.

## Vérification

Les tests couvrent les normales locales horizontales, verticales et inclinées, les copies indépendantes et leur équilibre après modification/suppression, les trois géométries de toiture, les surfaces inclinées, les charges dissymétriques et leurs moments, les cas alternatifs, les porteurs manquants, les cumuls jusqu’au sol et la sérialisation des résultats du worker. Les parcours navigateur vérifient les diagrammes signés, le curseur après zoom/déplacement, les formulaires et la sauvegarde/relecture sur Desktop et mobile.

## Aperçus

| Écran | Desktop | Mobile |
|---|---|---|
| Moment positif vers le haut | [Voir](roof-preview/beam-positive-desktop.png) | [Voir](roof-preview/beam-positive-mobile.png) |
| Paramètres de toiture | [Voir](roof-preview/roof-settings-desktop.png) | [Voir](roof-preview/roof-settings-mobile.png) |
| Modèle 3D | [Voir](roof-preview/roof-3d-desktop.png) | [Voir](roof-preview/roof-3d-mobile.png) |
| Réactions de toiture | [Voir](roof-preview/roof-results-desktop.png) | [Voir](roof-preview/roof-results-mobile.png) |
