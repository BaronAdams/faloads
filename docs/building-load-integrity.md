# Liaisons, cumul des poteaux et paramètres par étage

## Descente du bâtiment

Le calcul commence par un contrôle géométrique des liaisons. Le bouton « Vérifier les liaisons du modèle », dans Calcul, permet aussi de l’ouvrir indépendamment. Les messages localisent le niveau et l’élément ; un clic sélectionne celui-ci en plan.

- Les coordonnées physiques déterminent les liaisons, avec une tolérance de 0,1 mm. Un même nom ou indice de grille ne suffit pas.
- Chaque extrémité de poutre doit rencontrer un poteau modélisé. Les poteaux de grille et les poteaux libres participent au même cheminement.
- Les doublons de poteaux, les poutres de longueur nulle, les panneaux sans porteur, les réactions de toiture sans support et les ruptures de continuité verticale bloquent le calcul.
- Un poteau inférieur sans prolongement au-dessus conserve uniquement ses charges propres au niveau considéré. Un poteau supérieur sans porteur inférieur ne transmet aucune charge fictive : il doit être corrigé avant de calculer.

Le contrôle couvre la descente gravitaire actuellement implémentée. Il n’est pas un diagnostic de stabilité par éléments finis comme celui d’un modèle Robot complet. Un transfert via une poutre de reprise, un décalage de poteau ou un assemblage intermédiaire doit disposer d’un modèle de calcul adapté ; l’application signale le transfert non résolu au lieu de perdre la charge.

Le cumul se fait du dernier niveau vers le RDC. Les contributions G et Q brutes restent identifiables par niveau. La dégression de Q est appliquée une seule fois au cumul de chaque porteur, et non successivement à des valeurs déjà réduites. La toiture conserve son cas variable non dégressé.

Dans les résultats, « Poteaux · détail étage par étage » permet de filtrer une file et de lire G étage, G supérieur, ΣG, ΣQ brut, ΣQ réduit, ELS et ELU. La colonne Origine détaille les contributions. Les titres restent visibles dans le tableau défilant. Les totaux cumulés, les annotations 2D/3D et la recherche du poteau le plus chargé utilisent les mêmes résultats calculés.

## Poteau ou voile isolé

Dans Niveaux → Modifier un niveau, activez « Paramètres propres à cet étage ». Les valeurs du projet restent le comportement par défaut des études existantes.

- Poteau : aire tributaire, sections et longueurs d’influence totales des poutres principales et secondaires.
- Voile : aire tributaire et longueur du voile à cet étage.
- Système dalles seules : aucun poids de poutre ajouté.

Le calcul utilise chaque aire pour G et Q, chaque section de poutre pour son poids propre, et la section/hauteur du porteur pour son poids propre. Les charges variables brutes sont conservées pour le calcul de la dégression et de l’ELS quasi permanent.

## Interface et sections

Les champs du ruban bâtiment réservent une colonne aux chiffres et une autre aux unités. Leur largeur augmente sans modifier la hauteur du header. Le menu Vue ne présente que les contrôles utiles à la vue active. Les réactions et leurs valeurs ont un seul emplacement dans les analyses ; les réglages globaux de charges qui doublaient les réglages par famille ont été supprimés.

Les nouveaux projets ont un catalogue local : poutres et poteaux 20×20, 20×30, 25×40, 30×30, 30×40, 30×50, 30×60, 40×40 cm, voiles et planchers. « Parcourir le catalogue » ajoute aussi les modèles aux études existantes. Les copies restent propres au projet.

Les analyses structurales proposent également huit IPE standard (80 à 400). Dimensions et propriétés fortes A/I proviennent de l’[Orange Book ArcelorMittal](https://orangebook.arcelormittal.com/node/6). Les conversions cm/cm²/cm⁴ → m/m²/m⁴ sont explicites. Modifier la géométrie d’un profil abandonne ses propriétés tabulées et recalcule ses propriétés géométriques. Le matériau et le modèle de cisaillement restent ceux choisis dans le projet d’analyse.

Les IPE sont réservés aux analyses ; le moteur de descente du bâtiment reste un modèle d’éléments en béton (25 kN/m³). Les dialogues affichent une coupe annotée du profil choisi : b, h ou diamètre, et âme/semelles si nécessaires.

## Captures de l’interface implémentée

- [Champs du ruban Desktop](load-integrity-preview/building-fields-desktop.png)
- [Diagnostic des liaisons Desktop](load-integrity-preview/model-validation-desktop.png)
- [Cumul des poteaux Desktop](load-integrity-preview/column-cumulative-desktop.png) · [Mobile](load-integrity-preview/column-cumulative-mobile.png)
- [Paramètres par étage Desktop](load-integrity-preview/per-storey-desktop.png) · [Mobile](load-integrity-preview/per-storey-mobile.png)
- [Catalogue et coupe IPE Desktop](load-integrity-preview/section-ipe-desktop.png) · [Mobile](load-integrity-preview/section-ipe-mobile.png)

L’adaptation d’interface suit les principes Operate d’[Impeccable](https://github.com/pbakaus/impeccable) : hiérarchie compacte, contrôles utiles et vérification des rendus aux deux formats.
