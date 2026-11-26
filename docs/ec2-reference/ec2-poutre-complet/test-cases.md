# Cas de test de référence

Ces trois cas ont servi à valider ce skill pendant sa construction (résultats
comparés à un corrigé publié, ou vérifiés par calcul indépendant). Les
rejouer après toute modification du skill.

## 1. Poutre continue 3 travées (couvre analyse structurale complète + ferraillage + ancrages)

**Source** : *Le béton armé selon l'Eurocode 2*, chapitre 12, exercice 12.1.

**Données** : $b_w=350$ mm, $h=600$ mm, $d_1=0{,}9h=540$ mm, C30/37 ($f_{cd}=20$ MPa),
HA S500 classe B, $G=30$ kN/ml, $Q=15$ kN/ml. Portées aux nus $L_1=9$ m,
$L_2=7$ m, $L_3=7{,}5$ m ; appuis de rive 0,30 m, appuis intérieurs 0,40 m
(→ $l_{eff}=9{,}35\,/\,7{,}40\,/\,7{,}85$ m).

**Résultats attendus (analyse élastique, méthode des 3 moments)** :
- Cas a : $M_2=-376{,}02$ ; $M_3=-278{,}61$ kN·m
- Cas b : $M_2=-445{,}77$ ; $M_3=-276{,}17$ kN·m
- Cas c : $M_2=-521{,}05$ ; $M_3=-243{,}42$ kN·m
- Cas d : $M_2=-355{,}20$ ; $M_3=-372{,}87$ kN·m
- Après redistribution (plafonnée) : $M_{2,après}=-445{,}77$ ; $M_{3,après}=-278{,}61$ kN·m — **ce résultat final est indépendant du couple $C_{dg}$/$R_{emp}$ utilisé** (vérifié avec 0,4/0,8 comme avec 0,416/0,810 du document source), la redistribution étant plafonnée par un autre cas de charge dans cet exemple.
- Moment max travée 1 (cas b/c) = 483,61 kN·m

**Résultats attendus (analyse plastique, théorème statique)** :
- $M_{pl}$ travée 1-2 = 472,48 kN·m ; travée 2-3 = 215,62 kN·m ; travée 3-4 = 333,04 kN·m (ces valeurs sont indépendantes de $C_{dg}$/$R_{emp}$ — mécanisme purement basé sur l'équilibre)
- Bilan appuis : appui 2 = 472,48 ; appui 3 = 333,04 kN·m

**Ferraillage travée 1** (avec bloc rectangulaire simplifié $C_{dg}=0{,}4$/$R_{emp}=0{,}8$, différent du document source qui utilise le parabole-rectangle) :
- $\mu_u=0{,}237$ (identique au document, indépendant du diagramme)
- $A_s\approx2388$ mm² (document source : 2400 mm² avec parabole-rectangle — écart ~0,5 % attendu, pas une erreur)

**Arrêt des barres travée 1** (avec le même choix de barres que le document, 3HA25+3HA20, pour permettre la comparaison) :
- $V_{Ed}(0{,}15)=-237{,}40$ kN, $\sigma_{sd}=80{,}58$ MPa, $f_{bd}=3{,}041$ MPa, $l_{bd,\text{rive}}=250$ mm — identiques au document (indépendants de $C_{dg}$/$R_{emp}$)
- Points d'arrêt du 2e lit : $x\approx1{,}52$ et $6{,}31$ m (document : 1,516 et 6,321 — léger écart dû à $M_{Rd}(A_{sa})$)
- **Longueur du 1er lit (filant) = portée aux nus $l_n$ + ancrages, PAS la portée effective $l_{eff}$** : $0{,}25+9+0{,}25=9{,}5$ m. (Piège identifié en validant ce skill : utiliser $l_{eff}=9{,}35$ à la place donne un résultat faux de 0,35 m.)

## 2. Poutre isostatique simple (couvre la branche isostatique + cas "un seul lit, pas de point d'arrêt intermédiaire")

**Données** : $b_w=200$ mm, $h=400$ mm, C25/30, HA S500 classe B, portée aux
nus $l_n=5$ m, appuis de 200 mm, $G$ = poids propre seul (2,00 kN/ml), $Q=3{,}75$
kN/ml (charge linéique déjà convertie).

**Résultats attendus** :
- $l_{eff}=5{,}20$ m, $p_{ELU}=8{,}325$ kN/ml, $M_{max}=28{,}14$ kN·m
- $\mu_u=0{,}0651$ (très faible → $A_{s2}=0$, cas d'application direct de la règle des aciers de montage — vérifier que `ec2-flexion-simple` les ajoute bien)
- $A_s=186$ mm² (> $A_{s,min}=96$ mm²) → 2HA12
- Un seul lit filant → pas de point d'arrêt intermédiaire à chercher, seulement les 2 ancrages de rive
- $l_{bd}=120$ mm (plafonné par $l_{b,min}=10\phi_L$) ; longueur totale = $l_n+2\,l_{bd}=5{,}24$ m

## 3. Armatures transversales, travée 1 (couvre l'épure directe économique, `repartition-armatures-transversales.md` §6)

**Source** : *Le béton armé selon l'Eurocode 2*, chapitre 13, exercice 13.1 — suite directe de l'exercice 12.1 ci-dessus (même travée 1, mêmes données : $A_{s,réel}=2415$ mm², $d_{réel}=540$ mm).

**Piège identifié en validant ce cas** : le "$L_1$" du document (chapitre 12 et 13) désigne $l_{eff}=9{,}35$ m, pas la portée aux nus $9$ m — utiliser $l_n$ ici donne un $V_{Ed}$ faux de ~9 kN. Deuxième piège : chaque zone se décale de $l_i$ depuis la position **réellement placée** des cadres précédents ($0{,}05+\sum n_k s_k$), pas depuis la position théorique de la zone précédente.

**Résultats attendus (méthode standard $\theta=45°$, $A_{sw}=151$ mm², 1 cadre + 1 épingle HA8)** :
- $V_{Ed}(9{,}15)=329{,}60$ kN (appui 2), $V_{Ed}(0{,}15)=-237{,}40$ kN (appui 1) — cohérents avec le cas de test n°1
- $V_{Rd,c}=123{,}0$ kN $<V_{Ed}$ → armatures transversales nécessaires
- $l_i=z(\cot\theta+\cot\alpha)=0{,}486$ m (décalage épure transversale — différent de $a_1$ des barres longitudinales, ne pas confondre)
- Zones 1 à 4 côté appui 2 (exactement reproduites) : $264{,}96$ kN → 12,0 cm (9 cadres) ; $235{,}35$ kN → 13,5 cm (3) ; $209{,}84$ kN → 15,0 cm (3) ; $181{,}49$ kN → 17,5 cm (2) — zones suivantes cohérentes à l'arrondi de 5 mm près
- Total côté appui 2 : 26 cadres ; côté appui 1 : 14 cadres

**Comparaison avec Caquot** (`ec2-effort-tranchant` §6, mêmes données, méthode "enveloppe par dessous" avec la suite commerciale faute de forme fermée fiable) : 29 cadres côté appui 2, 15 côté appui 1, soit 44 au total contre 40 pour l'épure directe — écart d'environ +10 % pour Caquot, imputable au double décalage ($d_1$ puis $l_i$, contre $d_1$ seul pour Caquot) et à l'arrondi libre au 5 mm (contre la grille commerciale figée de Caquot). Les deux méthodes restent valides EC2 ; ne pas s'attendre à ce qu'elles convergent.

## 4. Poutre à travées égales — écrêtage, raccourcis élastique/plastique, formule fermée de δ

**Source** : *EC2 — Maîtrise de l'Eurocode 2*, J. Roux, Application n°1 — poutre continue à travées égales de 6 m entre nus, appuis (voiles) de 0,30 m, $b_w=0{,}30$ m, $h=0{,}50$ m, C25/30, S500 palier horizontal classe B, XC2, $q=45$ kN/ml (poids propre seul en $G$).

**Données communes** : $l_{eff}=6{,}30$ m, $g=3{,}75$ kN/ml, $p_u=72{,}56$ kN/ml, $f_{cd}=16{,}7$ MPa, $f_{yd}=435$ MPa, $d=0{,}45$ m (pris à $0{,}9h$ dans cet exemple).

**1. Analyse élastique sans redistribution (raccourci travées égales)** :
$$M_{Edth,appui}=\frac{p_ul_{eff}^2}{12}=240{,}0\text{ kN·m} \qquad M_{Ed,travée}=\frac{p_ul_{eff}^2}{24}=120{,}0\text{ kN·m}$$
Écrêtage : $F_{Ed,sup}=p_ul_{eff}=457{,}13$ kN, $\Delta M_{Ed}=F_{Ed,sup}\cdot t/8=17{,}14$ kN·m → $M^*_{Ed,appui}=222{,}86$ kN·m. Référence combinée $M_{Ed0}=M^*_{Ed,appui}+M_{Ed,travée}=342{,}86$ kN·m.

**2. Redistribution (formule fermée)** : $\mu_{cu,avant}=M_{Edth,appui}/(b_wd^2f_{cu})=0{,}237$ → $\delta=2(1-1{,}22\times0{,}237)-\sqrt{4(1-1{,}22\times0{,}237)^2-1{,}56}=0{,}743$ (racine basse) → retenu $\delta=0{,}76>0{,}743$ (valeur pratique, $>\delta_{lim}=0{,}75$ recalculé avec $\alpha_u$ après redistribution — vérifier $\delta\geq\delta_{lim}$ avant validation). $M'_{Ed,appui}=0{,}76\times240{,}0=182{,}0$ kN·m → écrêté $M'^*_{Ed,appui}=164{,}86$ kN·m → travée $M'^*_{Ed,travée}=M_{Ed0}-164{,}86=178{,}0$ kN·m.

**3. Analyse plastique (raccourci travées égales)** : $M_{Ed,appui}=M_{Ed,travée}=0{,}5\times M_{Ed0}=171{,}43$ kN·m. Dispense de vérification de rotation confirmée ($\alpha_u=0{,}233<0{,}25$, acier classe B, $M_a/M_t=1$).

**4. Vérification monolithique (§5 — non applicable dans cet exemple, la poutre repose sur voiles)** : $M_{Ed}(\text{nu appui})=M_{Edth,appui}-p_u a^2/2=239{,}18$ kN·m $>0{,}65\times M_{Ed,enc}=0{,}65\times(p_ul_n^2/12)=141{,}49$ kN·m — vérifié à titre d'exemple bien que non requis ici.

## 5. Portées inégales (2 travées), traité comme poutre de 1 m — méthode générale complète

**Source** : *EC2 — Maîtrise de l'Eurocode 2*, J. Roux, Application n°2 (énoncé pour une dalle 1 sens — traitée ici comme une poutre $b_w=1{,}00$ m, $h=0{,}20$ m, d'où $d=0{,}17$ m donné). 2 travées A-B-C, $l_{n,AB}=4{,}81$ m, $l_{n,BC}=3{,}81$ m, appuis rive $0{,}185$ m, appui B $0{,}24$ m ; C20/25, S500 classe A palier horizontal, XC2 ; $g=6{,}1$ kN/m², $q=5{,}0$ kN/m².

**Piège identifié et corrigé pendant cette validation** — $t/2$ vs le $a$ plafonné de $l_{eff}$ : ici $t_B/2=0{,}12$ m $>h/2=0{,}10$ m, donc $a_2$ (utilisé pour $l_{eff}$) est plafonné à $0{,}10$ m — **mais le nu d'appui physique reste à $t_B/2=0{,}12$ m**, pas à $0{,}10$ m. Utiliser $a_2$ plafonné pour la réduction de $V_{Ed}$ donne $V'_{Ed0,Bw}=42{,}1$ kN au lieu de $41{,}8$ kN (écart ~0,8 %, côté sécuritaire mais faux) — corrigé dans `ec2-effort-tranchant` §0/§2.1.

**Résultats attendus** — $l_{eff,AB}=5{,}00$ m, $l_{eff,BC}=4{,}00$ m, $p_u$(chargée)$=15{,}735$, $p_u$(déchargée)$=8{,}235$ kN/m :
- 3 cas de charge (tout chargé / AB seule / BC seule) : $M_B=-41{,}29\,/\,-34{,}63\,/\,-28{,}27$ kN·m — **reproduits exactement par le système des 3 moments général** (pas besoin du raccourci travées égales, portées inégales ici)
- $M_{travée,AB}$ max $=33{,}38$ kN·m (cas AB seule) ; $M_{travée,BC}$ max $=18{,}92$ kN·m (cas BC seule)
- Redistribution sur appui B (cas 1) : $\mu_{cu,avant}=0{,}107$ → racines $\delta=0{,}529/2{,}949$ (formule fermée, exactement reproduites) → retenu $\delta=0{,}85>0{,}8$ (mini classe A, **pas 0,7** — bien vérifier la classe d'acier) → $M'_{Ed,B}=-35{,}10$ kN·m
- Écrêtage sur B : $F_{Ed,sup}=|V'_{Ed,Be}-V'_{Ed,Bw}|=86{,}61$ kN, $\Delta M_{Ed}=F_{Ed,sup}\cdot t_B/8=2{,}60$ kN·m → $M'^*_{Ed,B}=-32{,}50$ kN·m
- **Moment de travée redistribué inférieur au non-redistribué → non retenu** : $M'_{Ed,AB}=33{,}19<33{,}38$ et $M'_{Ed,BC}=16{,}37<18{,}92$ — le calcul en travée reste sur les valeurs non redistribuées (cas isolés), la redistribution n'a ici d'effet que sur l'appui. Ne pas se limiter au plafonnement de `analyse-structurale.md` §2 pour ce cas : ici il n'y a même pas besoin de plafonner, le calcul de travée avec le moment redistribué donne directement une valeur plus faible que le max déjà connu — retenir le max des deux systématiquement.
- Ferraillage : appui B $A_s=4{,}61$ cm²/m ; travée AB $A_s=4{,}74$ cm²/m (sur $33{,}38$, non redistribué) ; travée BC $A_s=2{,}62$ cm²/m (sur $18{,}92$, non redistribué)
- Effort tranchant : $V'_{Ed0,Bw}=41{,}80$ kN $<V_{Rd,c}=74$ kN → armatures transversales non nécessaires sur cet appui (minimum réglementaire suffit)
