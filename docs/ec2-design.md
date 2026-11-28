# Dimensionnement EC2 — Poteau et Poutre

Les nouveaux projets **Poteau** et **Poutre**, dans « Dimensionnement Béton Armé », utilisent désormais un moteur de dimensionnement. Les études antérieures conservent leur ancien prédimensionnement et leurs notes ; un bouton permet de créer une nouvelle étude EC2 sans réinterpréter leurs données.

Les treize icônes de projets types, DM Sans, JetBrains Mono, la sauvegarde automatique et le format de stockage existant sont conservés. Chaque étude contient ses propres dimensions types. La vignette de bibliothèque est un aperçu vectoriel du modèle enregistré.

## Utilisation

1. Créer un Poteau ou une Poutre et donner son nom avant d’entrer dans l’étude.
2. Ouvrir les paramètres : **Géométrie**, **Matériaux**, **Actions**, **Armatures**, **Méthode**. Les modifications de ce formulaire sont provisoires jusqu’à **Appliquer les paramètres** ; **Annuler** les abandonne. Sur téléphone, le formulaire sort du bas. Sur ordinateur, un dialogue compact complète les champs de la barre fixe.
3. Pour une poutre, préciser si elle est **posée** ou **solidaire des appuis** dans Méthode. Il n’existe pas de choix implicite qui pourrait modifier le ferraillage d’appui.
4. Lancer le dimensionnement. Le voile de progression couvre l’espace de dessin pendant le calcul réel. Choisir Structure, Armatures, M ou V pour explorer le modèle. Zoom, recentrage et déplacement de la caméra restent disponibles.
5. Ouvrir les résultats pour lire les armatures, les contrôles, la démarche et les limites. Une modification rend immédiatement les résultats précédents indisponibles et affiche **Calcul non actualisé**.
6. Préparer la note PDF : sélectionner les chapitres et, pour chacun, la synthèse ou la démarche complète. Le moteur recalcule une copie des données courantes avant la génération. Le domaine de validité et les contrôles non satisfaits sont toujours rappelés, même si seul le ferraillage est demandé.

Sur une poutre, cliquer une travée ou un appui le sélectionne ; Shift ajoute ou retire une sélection. Le menu contextuel propose Modifier, Copier/Coller les propriétés et, pour une travée, Dupliquer/Supprimer. Ctrl+A sélectionne les éléments de même nature, ou tous les éléments sans présélection. Ctrl+D ajoute la copie d’une travée à l’extrémité ; les sections restent constantes sur la poutre. Les déplacements d’une charge ponctuelle du module d’analyse ne s’appliquent pas à ces charges uniformes par travée.

## Origine et exécution du moteur

Les six archives fournies par l’utilisateur constituent les sources de calcul :

- `ec2-poteau-complet`, `ec2-compression-simple`, `ec2-flexion-composee` ;
- `ec2-poutre-complet`, `ec2-flexion-simple`, `ec2-effort-tranchant`.

Les trois moteurs Python fournis sont embarqués **sans modification** dans `public/ec2-engine/skills/`. Leurs empreintes SHA-256 figurent dans `public/ec2-engine/provenance.json` et sont contrôlées par les tests. L’adaptateur `bridge.py` orchestre l’entrée/sortie et ajoute les contrôles complémentaires. Les skills de poutre fournissent des formules et des cas numériques ; leur implantation se trouve dans `beam_sections.py` et `beam_design.py`.

Le moteur Python s’exécute dans un Web Worker via **Pyodide 0.27.7**, distribué avec l’application. Aucun CDN, calcul distant ou Python installé par l’utilisateur n’est nécessaire. Les fichiers d’exécution ajoutent environ 14 Mo non compressés au paquet et ne sont initialisés qu’au premier calcul BA. Les WebViews sans module workers utilisent les mêmes sources dans un repli local sérialisé. Le calcul de bureau n’appelle pas un moteur différent de celui du mobile.

`npm ci`, puis `npm run build`, copie le runtime installé dans les ressources locales de la distribution. Le CSP conserve `script-src 'self'` et ajoute uniquement `'wasm-unsafe-eval'` pour WebAssembly ; l’évaluation JavaScript arbitraire n’est pas activée. Les schémas natifs sont résolus à partir de `location.href`, y compris lorsqu’ils ne fournissent pas d’origine HTTP.

## Profil de calcul commun

- EN 1992-1-1 de première génération, selon les formules et conventions des skills fournis ; il ne s’agit pas d’un moteur de l’Eurocode 2 de seconde génération.
- Situation durable : γc = 1,50 ; γs = 1,15 ; αcc = 1 ; béton 12 ≤ fck ≤ 50 MPa ; acier 400/500/600 MPa, avec palier incliné limité aux données S500 des skills.
- Poids volumique du béton armé : 25 kN/m³. Le poids propre est activable et compté une seule fois.
- Les résultats indiquent **Contrôles calculés satisfaits**, et non une conformité réglementaire complète. Les contrôles non satisfaits, la non-convergence et les situations hors domaine restent visibles.
- L’enrobage nominal est saisi explicitement. La liaison et la tolérance sont vérifiées ; les tableaux de durabilité, le feu et les dispositions de l’ouvrage restent à justifier.
- Les dessins sont des schémas de principe, pas des plans d’exécution validés.

## Poteau

### Sollicitations et stabilité

Section rectangulaire, deux plans, effort normal positif en compression. La saisie accepte les efforts ELU directs ou des actions caractéristiques G/Q/W/S/T : N, moments algébriques de tête/pied, excentricités, charges axiales intermédiaires et charges transversales ponctuelles/uniformes.

Les combinaisons automatiques du moteur fourni considèrent les actions simultanées, chacune variable dominante à son tour. Elles ne constituent pas une génération complète des enveloppes EN 1990 : actions favorables, omissions, alternances/signes de vent et situations accidentelles doivent être enveloppées dans l’analyse structurale et transférées comme efforts directs. Les coefficients ψ0 et ψ2 sont modifiables par action. Le fluage utilise la combinaison quasi permanente lorsqu’elle est renseignée.

La cascade applique successivement :

1. Compression conventionnelle, avec entrée strictement conditionnée par l’élancement et les excentricités.
2. Flexion composée du premier ordre, avec excentricité minimale max(20 mm ; h/30).
3. Second ordre par courbure nominale ou rigidité nominale si nécessaire, itération sur les barres retenues et nouvelle vérification de la dispense d’élancement.

L’adaptateur reboucle aussi sur d’ jusqu’à couvrir la position réelle des barres choisies. Il ajoute les espacements réels, le domaine géométrique de poteau, l’enrobage et les dispositions de recouvrement aux critères de validation. Le guide de prise en main EC2 est versionné séparément de celui des anciennes estimations. Les variantes ne sont pas validées par leur simple sélection : elles exigent un nouveau calcul.

**Flexion déviée :** les résistances sont vérifiées séparément dans les deux plans. Si des moments sont présents dans les deux plans, la vérification d’interaction EC2 5.8.9 reste requise et le résultat est marqué incomplet. Les armatures intermédiaires ne contribuent pas aux résistances de flexion dans le moteur fourni, de manière conservative. L’analyse globale d’un portique déplaçable, la méthode générale, les ELS, le feu et le séisme ne sont pas calculés par ce module.

### Ferraillage

Recherche d’un ferraillage symétrique dans une plage de diamètres commerciaux, ou vérification d’une disposition imposée. Coupe avec angles/intermédiaires et épingles nécessaires ; élévation avec cadres courants, zones de nœud et recouvrement. Les pas réduits et la longueur de recouvrement figurent dans les résultats et la note.

La section circulaire utilise uniquement le moteur de compression conventionnelle. Elle refuse les moments et charges transversales, contrôle l’élancement et respecte la plage de diamètres. L’adaptateur vérifie l’espacement libre sur la corde réelle entre deux barres, plus strict que la distance d’arc du script d’origine. En longueurs imposées, le plan le plus défavorable est retenu.

## Poutre

### Modèle et analyse

Une à huit travées, section constante rectangulaire ou en T, charges uniformes G et Q par travée. Appuis intermédiaires continus ; extrémités simples ou encastrées. Les consoles, les charges ponctuelles et les encastrements intermédiaires restent à étudier dans le module d’analyse structurale.

Portées aux nus en entrée ; portée efficace calculée suivant les débords EC2. Les efforts tranchants aux nus utilisent la demi-largeur physique d’appui selon la convention des références fournies, distincte du débord plafonné utilisé pour la portée efficace.

L’analyse élastique résout le système général des trois moments et enveloppe jusqu’aux 256 dispositions de Q. Le raccourci qL²/12 n’est pas appliqué à tous les appuis d’une poutre finie à travées égales : pour deux travées identiques à rives simples, l’appui central vaut bien −qL²/8.

La redistribution ELU vérifie les limites de ductilité, les rapports de portées et le maintien de l’enveloppe maximale en travée ; l’ELS reste non redistribué. Le moment de calcul sur appui tient compte de l’écrêtage et des minima de construction choisis.

L’option plastique emploie un équilibre statiquement admissible sous chargement intégral et vérifie acier B/C, x/d ≤ 0,25 en travée **et sur appui**, rapports de moments et absence de soulèvement pour les appuis posés. Les damiers sont hors de cette option : leur maintien produit un contrôle non satisfait, sans remplacement silencieux par un autre calcul. La comparaison présente les deux besoins d’acier et laisse explicite la méthode retenue.

### Sections, effort tranchant et dispositions

- Flexion simple avec section comprimée, minimum longitudinal et aciers comprimés obligatoires lorsque μ dépasse μlim. Les relations approchées de moment limite des skills sont conservées ; elles peuvent légèrement différer des tables et des calculs utilisant fcd arrondi à 16,7 MPa.
- Jusqu’à trois lits, espacements libres constructifs, recalcul du centre de gravité et réduction de d si nécessaire. Continuité constructive des nappes entre travées et appuis : le moteur itère sur les aciers opposés nécessaires et protège les aciers comprimés filants. Les contraintes ELS sont vérifiées sur les barres réellement présentes après arrêt, sans créditer des chapeaux absents à la section critique. Les relations approchées de moment limite ELS en XD/XF/XS sont limitées à S500 dans ce profil.
- Effort tranchant : VRdc = max(VRdc1 ; VRdc2), contrôle des bielles sous V non réduit, calcul des aciers sous l’effort réduit à d, cot θ arrondi vers le bas, pas réglementaires et minimum transversal. Les intervalles réellement produits sont contrôlés et densifiés si nécessaire.
- Répartition au pas direct de 5 mm ou sur série commerciale Caquot enveloppe par dessous. Il ne s’agit pas de la reproduction de l’épure économique particulière à 40 cadres du corrigé : les deux variantes gardent une enveloppe conservative.
- Arrêts longitudinaux contrôlés par capacité avec rampes de développement et points critiques, y compris les raccordements des plateaux d’écrêtage. Les barres restent filantes si le raccourcissement ne peut être justifié. Une marge de capacité négative fait échouer le contrôle.
- Ancrages droits inférieurs **et supérieurs aux rives**, y compris les extrémités encastrées, avec contraintes réelles, longueurs disponibles et contrôle des bielles d’about. Les longueurs physiques filantes partent de la portée **aux nus**, pas de la portée efficace. β₂ = 0,25 par défaut, modifiable explicitement ; la valeur 0 n’est pas imposée implicitement comme « annexe française ».
- Section en T : table comprimée en travée, âme seule sur appui ; contrôle de couture de chaque côté de l’âme par variation de la force comprimée. Les fenêtres de variation couvrent les extrêmes analytiques et le plateau de compression de la table. La reprise monolithique/rugueuse est explicite et conditionne le seuil de béton sans couture supplémentaire.

La flèche différée, l’ouverture des fissures, les talons, la torsion, le poinçonnement, le feu, la fatigue et le séisme ne sont pas calculés. Les façonnages, crochets et continuités d’acier entre travées doivent être détaillés sur un plan d’exécution.

## Vérification et traçabilité

- `npm run test:ec2` : cas de flexion, cisaillement et statique indépendante ; tests d’enveloppe, ancrage et domaine ; 39 vérifications du script poteau et auto-tests fournis de flexion composée.
- `npm test` : validation/import, défauts, comparaison avec les résultats Python, résultats hors domaine et génération des expressions LaTeX.
- `npm run test:e2e` : saisie et confirmation desktop/mobile, calcul Python/WASM local, absence de requête externe, résultats périmés masqués, repli sans worker et export PDF sélectionné.
- `npm run build` : assets du moteur présents dans la distribution utilisée par les workflows Tauri desktop/mobile.

Les exemples des skills sont conservés dans `tests/ec2/fixtures/`, les références dans `docs/ec2-reference/`. Les moteurs d’origine ne sont pas corrigés à la volée ni remplacés par des résultats préenregistrés.

## Aperçus de l’implantation

Les captures réelles et les deux notes PDF générées par l’application se trouvent dans [ec2-preview](./ec2-preview/). Le script `tools/capture-rc-preview.mjs` permet de les reproduire à partir du serveur Vite local. La barre native est simulée pour la capture de bureau ; le moteur de calcul et les composants affichés sont ceux de l’application.

Les évolutions des résultats par catégories, des enveloppes et de l’épure, ainsi que les plans LaTeX et DXF A4 paysage sont décrites dans [Résultats et plans BA](ec2-results-and-plans.md). Les captures actualisées sont reproductibles avec `tools/capture-rc-presentation.mjs` ; les nouveaux exemples sont `ec2-preview/beam-size-note.pdf` et `ec2-preview/column-note.pdf`.
