# Arrêt des barres longitudinales et longueurs d'ancrage (§8.4, §9.2.1.3, §9.2.1.4)

## 1. Décalage de la courbe enveloppe (§9.2.1.3)

Avant de déterminer où arrêter chaque groupe d'armatures, décaler la courbe des moments sollicitants de $a_1$ vers l'extérieur (dans le sens défavorable) :

$$a_1 = z\,\frac{\cot\theta-\cot\alpha}{2} \quad \text{(éléments avec armatures d'effort tranchant, ex. poutres)}$$

**Ne pas recalculer $a_1$ indépendamment** : c'est le skill `ec2-effort-tranchant` (§8) qui le fournit, car il dépend de la méthode d'inclinaison des bielles retenue à l'étape 5 (inclinaison variable ou standard $\theta=45°$) — les deux méthodes donnent un $a_1$ différent (respectivement $z(\cot\theta-\cot\alpha)/2$ avec $\cot\theta$ variable, ou $0{,}9d(1-\cot\alpha)/2$, soit $0{,}45d$ dans le cas courant $\theta=45°,\alpha=90°$). Réutiliser la valeur déjà calculée plutôt que de la reproduire ici.

Pour les éléments sans armature d'effort tranchant (dalles, hors périmètre de ce skill) : $a_1 = d$.

## 2. Moment résistant de chaque lit d'armatures

Avec la section d'acier réellement mise en place (après choix des barres), recalculer la position réelle de l'axe neutre :

$$\alpha_{u,réel} = \frac{A_{s,réel}\,f_{yd}}{R_{emp}\,d_{réel}\,b_w\,f_{cd}} \qquad (\text{avec } R_{emp}=0{,}8 \text{, bloc rectangulaire simplifié})$$

Moment résistant apporté par un lit d'armature $A_{s,x}$ (à sa position $d_x$) :

$$M_{Rd}(A_{s,x}) = A_{s,x}\,f_{yd}\,d_x\,(1-C_{dg}\,\alpha_{u,réel}) \qquad (C_{dg}=0{,}4)$$

Le premier lit seul donne $M_{Rd}(A_{sa})$ ; le cumul des deux premiers lits donne $M_{Rd}(A_{sa}+A_{sb})$, etc.

## 3. Longueur d'ancrage de calcul $l_{bd}$ (§8.4.4)

### Contrainte à l'origine de l'ancrage

$$\sigma_{sd} = \frac{V_{Ed}(a_i)}{2\,A_{s,réel}}$$

où $V_{Ed}(a_i)$ est l'effort tranchant au nu de l'appui considéré, pour le cas de charge donnant l'effort tranchant maximal à cet endroit. Pour un ancrage "en cours de course" (2e lit et suivants), la valeur sécuritaire $\sigma_{sd} = \dfrac{A_{s1}}{A_{s1,réel}}f_{yk}$ peut être retenue si la contrainte réelle au point de départ de l'ancrage n'est pas facilement déterminable.

### Contrainte ultime d'adhérence

$$f_{bd} = 2{,}25\,\eta_1\,\eta_2\,f_{ctd} \qquad f_{ctd}=\gamma_{ct}\frac{f_{ctk,0,05}}{\gamma_c} \qquad f_{ctk,0,05}=0{,}7\,f_{ctm} \qquad f_{ctm}=0{,}30\,f_{ck}^{2/3} \ (f_{ck}\leq 50\text{ MPa})$$

$\eta_1=1{,}0$ si conditions d'adhérence "bonnes" (armatures tendues en partie inférieure, sous 250 mm pour une poutre de hauteur usuelle) ; $\eta_2=1{,}0$ si $\phi_L\leq32$ mm.

### Longueur de référence puis longueur de calcul

$$l_{b,rqd} = \frac{\phi_L}{4}\frac{\sigma_{sd}}{f_{bd}}$$

$$l_{bd} = \max\left[\alpha_1\alpha_2\alpha_3\alpha_4\alpha_5\,l_{b,rqd}\;;\;0{,}7\,\alpha_1\alpha_4\,l_{b,rqd}\;;\;l_{b,min}\right]$$

avec (barres droites tendues) :
- $\alpha_1=1$
- $\alpha_2 = 1-0{,}15\dfrac{c_d-\phi_L}{\phi_L}$ (entre 0,7 et 1), $c_d=\min[a/2\,;\,c_1\,;\,c]$, $a$ = espacement entre barres du lit
- $\alpha_3 = 1-k\lambda$ ; prendre $\alpha_3=1$ si les armatures transversales ne sont pas encore quantifiées (valeur la plus restrictive)
- $\alpha_4=1$ (pas d'armature soudée), $\alpha_5=1-0{,}04p=1$ (pas de pression transversale, cas courant d'une poutre)
- $l_{b,min}=\max[0{,}3\,l_{b,rqd}\;;\;10\,\phi_L\;;\;100\text{ mm}]$ pour barres tendues

## 4. Longueur totale de chaque lit dans la travée

**Attention à ne pas confondre deux longueurs différentes** (erreur repérée en validant ce skill sur l'exercice 12.1) :
- la **portée effective $l_{eff}$** (axe à axe) sert de coordonnée $x$ pour $M_{Ed}(x)$ et $V_{Ed}(x)$ — c'est celle utilisée pour situer les points d'arrêt en travée ;
- la **portée aux nus $l_n$** (face à face des appuis) sert à calculer la **longueur physique réelle des barres** filantes — jamais $l_{eff}$ pour ça, sous peine de surestimer la longueur de deux fois la demi-largeur d'appui.

- **Lit filant sur toute la travée (1er groupe typiquement)** : longueur totale = $l_{bd,\text{rive}} + l_n + l_{bd,\text{interm}}$ (ou $10\,\phi_L$ côté appui intermédiaire, voir ci-dessous) — utiliser $l_n$ (portée aux nus), PAS $l_{eff}$.
- **Appui de rive** : ancrage droit $l_{bd}$ dans l'appui (vérifier que la largeur d'appui $t$ le permet, sinon envisager un ancrage courbe $l_{b,eq}=\alpha_1\,l_{b,rqd}$)
- **Appui intermédiaire** : prolonger d'au moins $10\,\phi_L$ (§6.2.8) au-delà du nu de l'appui
- **Point d'arrêt en travée, cas à deux groupes seulement** (1er groupe filant + 1 groupe arrêté) : intersection entre la courbe des moments sollicitants décalée ($+a_1$) et le moment résistant du 1er groupe $\overline{M_1}$, en résolvant $M_{Ed}(x) = \overline{M_1}$ (équation du second degré en $x$, à résoudre pour la travée et le cas de charge donnant le moment maximal) — ici $x$ est bien la coordonnée $l_{eff}$ utilisée dans l'analyse structurale, et la longueur du groupe arrêté se déduit par différence des deux racines $x_1,x_2$ plus $2\,a_1$ de part et d'autre (ce résultat-là, contrairement au lit filant, n'a pas besoin d'être reconverti en $l_n$ puisque c'est déjà une différence de positions, pas une longueur totale de travée).
  **Dès que trois groupes ou plus sont arrêtés successivement, ne pas répéter cette intersection groupe par groupe** — passer à l'épure complète du §5 ci-dessous, qui optimise les longueurs au lieu de les surestimer.

Longueur totale d'un groupe = distance entre les deux points d'arrêt (ou d'ancrage) trouvés, en tenant compte du décalage $a_1$ de part et d'autre.

## 5. Épure d'arrêt — cas général (plusieurs groupes de barres)

Source : *Pratique de l'Eurocode 2*, chapitre 10 §2. Cette section généralise le §4 ci-dessus dès qu'il y a plus de deux groupes de barres à arrêter dans une même travée (cas fréquent avec 3 lits ou plus, ou en présence de charges concentrées).

### Principe et ordre d'arrêt

Toujours arrêter les armatures par **groupes symétriques** par rapport au plan moyen de la travée.
- Armatures inférieures : commencer par le groupe de la nappe la plus haute ; dans chaque nappe, arrêter d'abord les barres les plus proches du plan moyen (les barres d'angle sont en général conservées jusqu'au bout).
- Armatures supérieures : même règle, en commençant par les nappes les plus basses.

### Moment résistant admissible d'un groupe

Pour un groupe $i$ de barres tendues de section $A_{si}$, à hauteur utile $d_i$, en supposant $z_c$ constant sur la longueur de la poutre (hypothèse sécuritaire) :

$$\overline{M_i} = A_{si}\,f_{yd}\,z_0 \qquad (\text{ELU, } z_0 = \text{bras de levier de la section de moment extrême considérée})$$

Pour plusieurs groupes cumulés : $\overline{M} = \sum_i \overline{M_i}$ (c'est $\overline{M_i}$, pas $M_{Rd}(A_{s,lit})$ du §2 ci-dessus, qui sert de référence pour l'épure — les deux formules sont cohérentes mais celle-ci simplifie en gelant $z_c$, ce qui va dans le sens de la sécurité et évite de recalculer $\alpha_{u,réel}$ à chaque groupe arrêté).

Le moment admissible d'un groupe décroît **linéairement** de $\overline{M_i}$ à 0 sur la longueur d'ancrage de ce groupe ($\ell_a=l_{bd}$ pour un ancrage droit, $\ell_a=l_{b,eq}$ pour un ancrage courbe) — car $\overline{M_i}=A_{si}\sigma_s z_c$ et $\sigma_s$ varie linéairement de 0 à sa valeur maximale sur cette longueur.

### Diagrammes de type I et II

Le diagramme du moment admissible cumulé, pour deux groupes arrêtés successivement en B (le plus proche du moment extrême) puis D (plus loin), dépend de la distance DB comparée à la longueur d'ancrage $\ell_a$ du groupe arrêté en D :

- **DB $\geq \ell_a$ → diagramme de type I** : les segments inclinés ne se chevauchent pas, chaque arrêt se place directement sur la courbe enveloppe décalée $(C')$ — c'est le cas déjà traité au §4 ci-dessus.
- **DB $< \ell_a$ → diagramme de type II** : les segments inclinés se chevauchent. Sur le tronçon commun, le supplément de moment admissible apporté par le groupe le plus externe croît linéairement depuis son point de départ : $\Delta M = \overline{M_3}\,\dfrac{x}{\ell_{a3}}$ (notations génériques, $x$ compté depuis le début du chevauchement). **Propriété utile** : à B fixe, quand D se rapproche de B, la droite du segment concerné se déplace **parallèlement à elle-même** (triangles semblables, B centre de similitude) — s'en servir pour optimiser rapidement la position d'arrêt sans refaire toute la construction à chaque itération.

### Construction pratique de l'épure

1. Toujours partir du moment maximal (positif en travée, négatif sur appui) et construire vers les zones de moment décroissant.
2. **Type I** (DB $\geq \ell_a$) : l'arrêt se place directement sur $(C')$, sans optimisation possible — c'est le cas par défaut.
3. **Type II** (DB $< \ell_a$) : se servir de la propriété des triangles semblables pour envelopper $(C')$ au plus près et raccourcir les groupes de barres, plutôt que d'arrêter chaque groupe à son intersection isolée avec $(C')$ (ce qui surestimerait les longueurs).
4. Répéter pour chaque groupe successif jusqu'à l'appui ou jusqu'au groupe filant sur toute la travée.

## 6. Rappel — barres de montage

Même lorsque l'épure d'arrêt des armatures supérieures n'exige plus aucune barre calculée (moment nul sur une longueur significative), **prévoir des barres de montage** pour tenir les armatures d'âme en place pendant le coulage — diamètre $\geq \max(\phi_t\,;\,8\text{ mm})$, cf. la règle déjà intégrée dans `ec2-flexion-simple` (§4.2 de ses formules) pour le cas d'une section isolée sans aciers comprimés. Ici, le besoin est le même mais motivé par la tenue des cadres sur toute la longueur de la travée, pas seulement par l'absence d'aciers comprimés en flexion.

## 7. Acier minimal à conserver sur appui (§9.2.1.4)

Sur chaque appui — de rive **et** intermédiaire — conserver et ancrer une section d'aciers inférieurs suffisante. Avec le choix retenu par l'Annexe nationale française ($\beta_2=0$, qui rend la seconde borne ci-dessous non gouvernante en pratique) :

$$A_s \geq \frac{F_E}{f_{yd}} = \frac{V_{Ed}\,\dfrac{a_1}{z} + N_{Ed} + \dfrac{M_{Ed}}{z}}{f_{yd}}$$

- $V_{Ed}$ = effort tranchant de calcul au nu d'appui (non réduit) — obtenu auprès de `ec2-effort-tranchant`, comme $a_1$
- $N_{Ed}$ = effort normal de calcul (nul en flexion simple)
- $M_{Ed}$ = moment fléchissant concomitant : **nul sur appui de rive simple**, mais **non nul sur appui intermédiaire** — c'est le moment déjà calculé à l'étape 2 de l'analyse structurale pour cet appui, ne pas le redemander ni le recalculer
- Cas courant $\theta=45°$, $\alpha=90°$, $z=0{,}9d$, appui de rive ($M_{Ed}=N_{Ed}=0$) : $A_s \geq 0{,}50\,V_{Ed}/f_{yd}$ (coefficient $=a_1/z=(\cot\theta-\cot\alpha)/2$ — ne pas confondre avec $a_1=0{,}45d$ du §8, c'est $a_1/z=0{,}5$ qui compte ici, pas $a_1/d$ ; erreur corrigée, 0,45 utilisé par erreur auparavant sous-évaluait $A_s$ de 10%)

Retenir pour $A_s$ un nombre entier de barres déjà présentes en travée (prolonger les lits inférieurs existants plutôt que d'en ajouter de nouveaux), jamais une section fractionnaire. Cette vérification est indépendante de celle du §5 ci-dessus (épure d'arrêt) : elle fixe un **plancher** sur ce qui doit rester ancré sur appui, même si l'épure de flexion seule autoriserait d'arrêter davantage de barres à cet endroit.
