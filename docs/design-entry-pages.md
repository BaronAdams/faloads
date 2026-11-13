# Onboarding et catalogue des calculs

Le design reprend l’univers du bureau d’études : des surfaces graphite, des cotes, des unités et des modèles lisibles. DM Sans et JetBrains Mono restent les seules familles ; les 13 icônes de projets sont inchangées.

## Audit et direction

Les principaux points relevés étaient les textes de 9 à 11 pixels sur mobile, les grands blocs répétitifs, les libellés génériques et une illustration d’onboarding identique sur les trois étapes.

- **Produit** : calcul de structures et dimensionnement des éléments en béton armé.
- **Caractère** : précis, calme, lisible.
- **Univers** : plans, appuis, charges, cotes et notes de calcul.
- **Moments** : les icônes validées dans le catalogue et un exemple de poutre dont la portée peut être modifiée.
- **Signature** : les unités et les valeurs en caractères monospace, avec une hiérarchie inspirée des annotations de plans.

## Passes de design

1. **Espacement** : groupes distincts, contrôles alignés, cartes compactes et marges régulières ; cibles tactiles de 44 pixels pour les filtres et les actions principales.
2. **Couleur** : palette existante conservée ; surfaces neutres et action principale contrastée. La couleur reste surtout dans les icônes de projets et les charges du schéma.
3. **Icônes** : aucune modification des fichiers de projets. Les icônes d’action Lucide utilisent un trait homogène.
4. **Textes** : le titre de l’accueil décrit les calculs disponibles ; les étapes expliquent le choix d’un outil, les paramètres et la conservation du modèle. Les répétitions « Ouvrir le projet » sont retirées.
5. **Typographie** : mêmes fichiers de polices, titres moins lourds, libellés et descriptions plus lisibles ; les petites métadonnées du contenu redessiné restent à au moins 11 pixels.
6. **Disposition** : copie puis aperçu sur l’onboarding ; deux colonnes de calculs sur desktop, une sur petit mobile. Les trois familles restent dans leur ordre d’origine.
7. **Détails** : filtres par famille, recherche combinée, effacement, raccourci Ctrl/Cmd K, compte réel des projets et reprise triée par date. L’état vide explique comment retrouver sa première étude.
8. **Visuels** : catalogue avec les icônes originales, schéma 2D de poutre et aperçu du format JSON. L’exemple utilise la fonction de calcul du logiciel ; il est explicitement non enregistré.
9. **Mouvement** : changements de surface et de couleur courts ; retrait de l’orbite décorative, des déplacements de cartes au survol et de la transition de largeur des indicateurs d’étapes.

## Aperçus

| Page              | Desktop                                                   | Mobile                                       |
| ----------------- | --------------------------------------------------------- | -------------------------------------------- |
| Onboarding        | [Vue desktop](previews/onboarding-desktop.png)            | [Vue mobile](previews/onboarding-mobile.png) |
| Dashboard         | [Vue desktop](previews/dashboard-desktop.png)             | [Vue mobile](previews/dashboard-mobile.png)  |
| Exemple de calcul | [Poutre interactive](previews/onboarding-calculation.png) | Parcours testé sur petit écran               |

## Vérification

Les parcours navigateur vérifient l’onboarding complet et sa mémorisation, la modification de la portée et du moment calculé, le retour entre les étapes, les filtres combinés à la recherche, l’ouverture d’un projet, la reprise de données réelles et l’absence de débordement à 320 pixels. Les parcours existants continuent à couvrir les calculs et les gestes sur le playground.

Le travail suit le skill [Unslop](https://github.com/heydamir/unslop), créé par Damir Sokolovsky (@heydamir), sous licence CC BY 4.0. Les images de référence du skill ne sont pas reprises dans l’application. Aucun visuel généré ni prompt d’image n’a été nécessaire.
