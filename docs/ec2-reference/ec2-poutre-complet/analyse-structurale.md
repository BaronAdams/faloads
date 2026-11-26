# Analyse structurale — poutre continue EC2

## 1. Méthode des 3 moments (analyse élastique linéaire, §5.4)

### Cas de charge

Pour $n$ travées : $n+1$ cas de charge.
- 2 cas "classiques" : travées paires chargées, travées impaires chargées (donnent les moments max en travée)
- $n-1$ cas "adjacents" : pour chaque appui intermédiaire $i$, les deux travées qui l'encadrent sont chargées, les autres non (donnent les moments max sur appuis)

Charge par travée dans un cas donné :
- Travée chargée : $p_1 = 1{,}35G + 1{,}5Q$
- Travée non chargée : $p_2 = 1{,}35G$ (le poids propre reste toujours présent)

### Système à résoudre

Poutre à inerties constantes, charges uniformes, appuis simples aux extrémités ($M_1 = M_{n+1} = 0$) :

$$L_i M_{i-1} + 2(L_i+L_{i+1})M_i + L_{i+1}M_{i+1} = -\tfrac14\left(p_i L_i^3 + p_{i+1}L_{i+1}^3\right)$$

pour $i=2,\dots,n$ (appuis intermédiaires). Avec les conditions $M_1=M_{n+1}=0$, cela se réduit à un système tridiagonal $(n-1)\times(n-1)$ en $M_2,\dots,M_n$ — résoudre par inversion de matrice ou élimination de Gauss.

**Encastrement à une extrémité** : transformer en travée fictive de longueur et de chargement nul, cf. §12.2.3 du document source. L'équation reste valable en substituant la travée fictive.

**Longueur à utiliser** : $L_i$ = portée effective entre axes $l_{eff}$ (voir SKILL.md, étape 1), pas la portée aux nus.

### Moment en travée

À partir du moment isostatique de référence $\mu_0=\tfrac12 p\,x(L-x)$ :

$$M_{Ed}(x) = \tfrac12 p\,x(L-x) + \tfrac{x}{L}M_{droite} + \left(1-\tfrac{x}{L}\right)M_{gauche}$$

Moment maximal en travée (effort tranchant nul) :

$$x_{M_{max}} = \tfrac{L}{2} + \frac{M_{droite}-M_{gauche}}{p\,L}$$

### Écrêtage sur appui (§9.2.1.2, à appliquer systématiquement — étape absente des versions précédentes de ce skill)

Le moment théorique obtenu par la méthode des 3 moments (ou toute autre méthode élastique) suppose un appui ponctuel. En réalité l'appui a une largeur $t$ ; EC2 permet de réduire le moment en conséquence, à **chaque** appui (rive ou intermédiaire) — source : *EC2 — Maîtrise de l'Eurocode 2*, J. Roux, confirmé sur deux exemples (poutre et dalle continue) :

$$\Delta M_{Ed} = F_{Ed,sup}\cdot\frac{t}{8} \qquad M^*_{Ed,appui} = M_{Ed,appui} - \Delta M_{Ed}$$

avec $F_{Ed,sup}$ = réaction d'appui = saut d'effort tranchant à cet appui ($F_{Ed,sup}=|V_{Ed,droite}-V_{Ed,gauche}|$ de part et d'autre de l'appui — pour une poutre à travées égales entièrement chargées, se simplifie en $F_{Ed,sup}=p_u\cdot l_{eff}$). Appliquer cet écrêtage **après** le calcul élastique (et après redistribution si redistribution il y a), avant de fixer le moment de calcul final sur appui — ne pas l'oublier, il réduit le ferraillage requis sur appui de façon non négligeable (~7 % dans le cas de référence).

### Raccourci — travées toutes égales, entièrement chargées

Si toutes les travées ont la même portée effective $l_{eff}$ et sont chargées identiquement (cas d'une poutre à travées égales, charge répartie uniforme sur toute la longueur — pas de cas de charge alterné à étudier), inutile de résoudre le système des 3 moments : par symétrie,

$$M_{Edth,appui} = \frac{p_u\,l_{eff}^2}{12} \qquad M_{Ed,travée} = \frac{p_u\,l_{eff}^2}{24}$$

Appliquer ensuite l'écrêtage ci-dessus sur le moment d'appui, puis $M_{Ed0}=M^*_{Ed,appui}+M_{Ed,travée}$ (référence combinée, réutilisée telle quelle en §2 et §3 ci-dessous plutôt que de refaire le calcul de travée séparément après redistribution : $M'^*_{Ed,travée}=M_{Ed0}-|M'^*_{Ed,appui}|$).

Ce raccourci ne s'applique **pas** dès que les portées diffèrent ou qu'un cas de charge alterné (travées paires/impaires) doit être étudié — revenir à la méthode générale ci-dessus dans ce cas.

## 2. Redistribution des moments sur appuis (§5.5)

**Conditions d'application** : dimensionnement aux ELU uniquement (jamais à l'ELS), rapport des portées entre 0,5 et 2, éléments sollicités principalement en flexion.

**Où l'appliquer** : uniquement sur les cas de charge donnant les moments d'appui maximaux (jamais sur les cas donnant les moments de travée maximaux, sous peine de les aggraver).

**Procédure de plafonnement** (validée numériquement sur l'exercice de référence) :
1. Résoudre $\delta_{min}$ à partir de la relation ci-dessous (valeur minimale admissible = économie d'acier maximale).
2. $M_{appui,après} = \delta_{min}\times M_{appui,avant}$.
3. Comparer en magnitude à $M_{appui}$ du cas non-redistribuable (cas de travées chargées) qui touche le même appui : si $|M_{appui,après}| < |M_{appui,\text{cas non-redistribuable}}|$, plafonner — retenir la valeur la **plus grande en magnitude** entre les deux (donc la moins réduite) comme $M_{appui,après}$ final.
4. Recalculer le moment en travée avec cette valeur finale et vérifier qu'il ne dépasse pas le moment max en travée des cas non-redistribuables. Si un dépassement subsiste malgré l'étape 3 (configuration où le raccourci de l'étape 3 ne suffit pas), plafonner directement sur ce critère à la place — c'est la règle générale (§12.5.2 du document source), l'étape 3 n'en est qu'un raccourci qui a coïncidé avec elle sur le cas testé. **Cas le plus fréquent, à ne pas oublier** : il arrive que le moment de travée recalculé avec l'appui redistribué soit *déjà* inférieur au max non-redistribué (validé sur une poutre à 2 travées inégales, *EC2 — Maîtrise de l'Eurocode 2*) — dans ce cas il n'y a rien à plafonner, le moment de travée retenu pour le ferraillage est simplement le max non-redistribué (le calcul redistribué n'est pas utilisé). Dans tous les cas : moment de travée final = max(valeur redistribuée recalculée, valeur non-redistribuée des autres cas), jamais un mélange des deux ni le seul recalculé.

**Relation à résoudre** — avec $\delta = \mu_{u,après}/\mu_{u,avant}$ et $x/d=\alpha_{u,après}$ :

$$\frac{x}{d} = \alpha_{u,après} = \frac{1}{2C_{dg}}\left[1-\sqrt{1-\frac{4C_{dg}}{R_{emp}}\,\delta\,\mu_{u,avant}}\right]$$

$$\delta \geq 0{,}44 + 1{,}25\left(0{,}6+\frac{0{,}0014}{\epsilon_{cu2}}\right)\frac{x}{d} \quad (f_{ck}\leq 50\text{ MPa}) \qquad \delta \geq 0{,}7 \text{ (acier classe B/C)}$$

Avec le bloc rectangulaire simplifié retenu dans ce projet : $C_{dg}=0{,}4$, $R_{emp}=0{,}8$, $\epsilon_{cu2}=0{,}0035$ (béton $\leq$ C50/60).

**Important** : les constantes numériques du document source (0,625/Cdg, 1,5625·μu,avant, etc.) sont calées sur $C_{dg}=0{,}416$/$R_{emp}=0{,}810$ (parabole-rectangle) — **ne pas les réutiliser telles quelles**.

**Formule fermée validée** (spécifique à $C_{dg}=0{,}4$/$R_{emp}=0{,}8$, $f_{ck}\leq50$ MPa, $\epsilon_{cu2}=0{,}0035$ — source : *EC2 — Maîtrise de l'Eurocode 2*, J. Roux, vérifiée numériquement : retombe exactement sur les racines 0,743/2,101 de l'Application n°1 pour $\mu_{cu,avant}=0{,}237$) :

$$\delta = 2\left(1-1{,}22\,\mu_{u,avant}\right) - \sqrt{4\left(1-1{,}22\,\mu_{u,avant}\right)^2 - 1{,}56}$$

C'est la racine à retenir (la plus petite des deux, économie maximale) — vérifier $\delta\geq0{,}7$ (classe B/C) avant utilisation ; si $\delta<0{,}7$, retenir $\delta=0{,}7$. Cette formule remplace la résolution numérique employée précédemment (moins directe, sans gain de fiabilité).

Retenir le $\delta$ minimal admissible (économie d'acier maximale autorisée), sous réserve du plafonnement mentionné plus haut.

## 3. Analyse plastique — théorème statique (§5.6)

**Conditions d'application** (§5.6.2) — vérifier avant d'utiliser cette méthode :
- Acier de classe B ou C (jamais classe A)
- $x/d_1 \leq 0{,}25$ pour $f_{ck}\leq 50$ MPa (sinon vérification de la capacité de rotation nécessaire, voire méthode non permise au-delà d'un certain seuil)
- $0{,}5 \leq M_{travée}/M_{appui} \leq 2$

**Principe** : les moments plastiques $M_{pl}$ apparaissent simultanément en travée et sur les appuis adjacents. Un mécanisme est résolu par travée $i$ : le diagramme des moments dans la travée est une parabole $M(x)=ax^2+bx+c$, avec $\partial^2M/\partial x^2=-q_{ELU}$ (équilibre), et 4 inconnues ($a,b,c,k$ — $k$ définissant la position $k\cdot L_i$ de la rotule en travée) déterminées par 4 équations :
- valeur du moment aux deux extrémités de la travée (0 si appui de rive/simple, $-M_{pl}$ si appui intermédiaire — le même $M_{pl}$ que celui de la travée, car rotule simultanée)
- $M(k\cdot L_i) = M_{pl}$ (rotule en travée)
- $\partial M/\partial x = 0$ en $x=k\cdot L_i$ (effort tranchant nul au droit du moment max)

Résoudre pour $k$ puis $M_{pl}$ pour chaque travée $i=1,\dots,n$, indépendamment. Charge : $q_{ELU}=1{,}35G+1{,}5Q$ sur toute la poutre (un seul cas de charge en analyse plastique, toutes travées chargées identiquement).

**Raccourci — travées toutes égales** : dans ce cas $0{,}5\leq M_a/M_t\leq2$ est satisfaite trivialement par $M_a=M_t$ — inutile de résoudre le mécanisme (parabole, 4 inconnues) travée par travée. Prendre directement $M_{Ed,appui}=M_{Ed,travée}=0{,}5\,M_{Ed0}$ (avec $M_{Ed0}$ du raccourci travées-égales ci-dessus) — source : *EC2 — Maîtrise de l'Eurocode 2*, J. Roux, validé sur l'Application n°1 (résultat $M_a=M_t=171{,}43$ kN·m). Revenir au mécanisme complet dès que les portées ou les charges diffèrent d'une travée à l'autre.

**Bilan par élément** :
- Moment en travée $i$ = $M_{pl}$ du mécanisme de la travée $i$
- Moment sur un appui intermédiaire partagé par les travées $i$ et $i+1$ = le **maximum en valeur absolue** entre le $M_{pl}$ du mécanisme de la travée $i$ et celui du mécanisme de la travée $i+1$ (assure la stabilité vis-à-vis des deux mécanismes possibles)
- Appuis de rive (extrémités simples) : $M=0$

**Vérification de la capacité de rotation** (§5.6.3(1)) : $\theta_s \leq k_\lambda \cdot \theta_{pl,d}$, avec $\theta_s = \dfrac{1{,}2\,h\,f_{yd}}{(d_1-x)E_s}$, $k_\lambda=\lambda/3$ **(pas $\sqrt{\lambda/3}$ — erreur trouvée et corrigée ici ; formule EC2 5.11N officielle, confirmée par *EC2 — Maîtrise de l'Eurocode 2*, J. Roux)**, $\lambda = M_{Ed}/(V_{Ed}\cdot d_1)$, et $\theta_{pl,d}$ lu sur l'abaque (figure 5.6N EC2) selon la classe d'acier et $x_u/d$. Ne l'effectuer que si $0{,}25 < x/d_1 \leq 0{,}45$ (sinon vérification non requise si $x/d_1\leq0{,}25$, ou méthode non permise au-delà de 0,45).

## 4. Comparaison élastique / plastique

Présenter les deux enveloppes côte à côte. La méthode plastique est plus rapide mais peut conduire à une augmentation notable d'acier sur certaines travées (l'analyse élastique reste la référence par défaut en cas de doute — signaler à l'utilisateur si l'écart dépasse ~20 %).

## 5. Vérifications complémentaires si la poutre est solidaire de ses appuis (§9.2.1.2)

**Ne s'applique que si la poutre forme un ensemble monolithique avec ses appuis** (poteaux ou voiles coulés avec la poutre) — **pas** le cas d'une poutre simplement posée sur voiles/maçonnerie, même modélisée en appui simple pour l'analyse. Demander explicitement à l'utilisateur si c'est le cas avant d'appliquer ce qui suit ; les deux exemples validés de ce paragraphe ("*EC2 — Maîtrise de l'Eurocode 2*", J. Roux) précisent chacun que la vérification ne s'applique pas à leur cas.

### 5.1 Moment minimal au nu d'appui

$$M_{Ed}(\text{nu appui}) = M_{Ed,appui} - p_u\frac{a^2}{2} \qquad M_{Ed,enc} = \frac{p_u\,l_n^2}{12}$$

Vérifier $M_{Ed}(\text{nu appui}) \geq 0{,}65\,M_{Ed,enc}$ ($l_n$ = portée aux nus, pas $l_{eff}$ — ne pas confondre avec les formules d'écrêtage/3-moments qui utilisent $l_{eff}$). Si non vérifié, retenir $0{,}65\,M_{Ed,enc}$ comme moment de calcul minimal sur cet appui.

### 5.2 Aciers en chapeau sur appui de rive

Même en cas de calcul en appui simple, disposer sur l'appui de rive des aciers supérieurs pour équilibrer :

$$M = \beta_1\,M_t \qquad \beta_1=0{,}15 \text{ (valeur recommandée, AN française)}$$

avec $M_t$ = moment maximal en travée adjacente. Vérifier $A_s\geq A_{s,min}$ (§4.4 de `ec2-flexion-simple`) sur cette section.
