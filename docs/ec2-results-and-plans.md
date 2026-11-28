# Résultats et plans de ferraillage BA

Les projets Poteau BA et Poutre BA répartissent désormais leurs résultats en cinq catégories : synthèse, analyse, longitudinal, cadres et vérifications. Les contrôles en échec restent signalés dès la synthèse et dans l’accès aux vérifications. Chaque changement de catégorie repart en haut des résultats ; chaque ouverture ou changement de page des paramètres repart en haut du formulaire, en conservant les données saisies.

## Lecture du ferraillage

Les barres longitudinales et les cadres utilisent des traits fins. Le profil distingue les repères de la nappe supérieure, au-dessus, de ceux de la nappe inférieure, en dessous. Dans une coupe sur appui, les nappes restent à leur position physique, y compris lorsque la traction est en face supérieure.

Le survol d’un intervalle entre deux cadres affiche son pas réel, calculé par différence entre leurs positions, et le diamètre du cadre. Sur téléphone, toucher cet intervalle affiche la même information ; le zoom reste disponible pour les zones denses. Les positions de recouvrement calculées par le skill Poteau sont conservées, avec les positions courantes et nodales.

Pour les poutres continues, `M` affiche l’enveloppe élastique avant redistribution ; `M redistrib.` apparaît uniquement lorsqu’une redistribution a effectivement été appliquée. `V` reste l’enveloppe d’effort tranchant retenue pour le dimensionnement. Les grandeurs des légendes correspondent à la courbe affichée.

`Épure` superpose l’enveloppe décalée et la résistance mobilisable des groupes d’aciers, avec leurs rampes d’ancrage. Les deux nappes et les longueurs des groupes sont représentées. Ces tracés réutilisent le décalage et les rampes du contrôle analytique existant du moteur : aucun redimensionnement n’est effectué dans le dessin. Le tracé est échantillonné entre les nus d’appuis, domaine du contrôle des arrêts ; les ancrages dans les appuis sont vérifiés séparément. Le contrôle des marges demeure analytique. Référence fournie : `ec2-poutre-complet/references/arret-barres.md`, notamment les paragraphes 1, 4 et 5.

## Notes PDF et plans

La note conserve le choix des chapitres et de leur niveau de détail. Les sections de calcul sont paginées et les planches de ferraillage sont jointes en A4 paysage, avec coupes, cotes, repères et cartouche. Le pied de chaque page indique CaliSigma Structural, la date et l’heure de génération, et la pagination.

Les dessins sont réellement composés en TikZ/LaTeX : moteur TeX WebAssembly local, conversion DVI puis tracés vectoriels, y compris les glyphes et annotations. LaTeX n’est pas installé sur la machine de l’utilisateur et aucun service distant n’est appelé. Une compilation défaillante interrompt l’export plutôt que d’insérer un schéma de remplacement.

L’action **Exporter le plan de ferraillage** propose :

- PDF vectoriel, une planche A4 paysage à son échelle indiquée ;
- DXF R2007, entités modifiables, calques, unités en millimètres et présentation `A4 Landscape` de 297 × 210 mm ;
- source `.tex` autonome pour reprise dans un outil LaTeX/TikZ.

Chaque travée dispose de sa planche de profil/coupe et de sa planche d’épure. Les coordonnées et les cotes sont issues des résultats courants. Un modèle modifié impose un nouveau calcul avant l’export. Les plans restent des plans de principe : les détails de façonnage, les assemblages et les interfaces nécessitent la validation du plan d’exécution.

## Runtime et vérification

`prepare:drawings` prépare les ressources épinglées de node-tikzjax 1.0.5 et les polices BaKoMa. Le moteur TeX s’exécute dans un worker, partagé entre les planches et arrêté après inactivité. Si la WebView interdit les workers, le même moteur local s’exécute dans le contexte principal. Un cache borné évite de recomposer une planche identique. Les ressources sont servies sous le CSP Tauri existant, sans ajouter `unsafe-eval` pour JavaScript.

Les licences et provenances du moteur, du convertisseur DVI et des polices sont incluses dans `tikz-runtime/NOTICE.txt` et `FONT-LICENCE.txt`. Les scripts Python originaux des skills restent inchangés ; le moteur Poutre fournit uniquement des données de tracé supplémentaires.

Vérifications reproductibles :

- `npm run build`, `npm test`, `npm run test:ec2` ;
- `e2e/rc-presentation.spec.ts` : catégories, haut de formulaire, survol/toucher du pas réel, enveloppes distinctes, épure et téléchargement DXF sur desktop/mobile ;
- `tools/verify-rc-production.mjs` : calcul et notes complets dans le bundle de production sous CSP Tauri ;
- `tools/verify-rc-plans.mjs` : production des exemples depuis le serveur de développement sur le port 1422 ;
- `tools/capture-rc-presentation.mjs` : captures du layout desktop et du mobile depuis le serveur sur le port 1420.

Les exemples PDF, DXF, sources LaTeX et captures sont dans [ec2-preview](ec2-preview/). Les DXF ont été ouverts et audités avec ezdxf : aucune erreur et aucune correction automatique, présentation A4 de 297 × 210 mm reconnue.
