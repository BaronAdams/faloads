# Répartition des armatures transversales le long de la poutre

Ce fichier couvre deux méthodes distinctes :
- **§1-5** : le cas général (charges concentrées et/ou hauteur variable), source *Pratique de l'Eurocode 2* chapitre 10 §3.
- **§6** : une méthode alternative au cas simple (section constante, charges uniquement réparties), source *Le béton armé selon l'Eurocode 2* chapitre 13 §13.4.7 — **plus économique que Caquot** (~10 % d'armatures en moins sur le cas de référence de ce skill, cf. `references/test-cases.md`), à proposer à l'utilisateur en alternative à la suite de Caquot de `ec2-effort-tranchant` §6 pour ce cas précis.

## 1. Quand appliquer quelle méthode

- **Charges concentrées et/ou hauteur variable** → §2-5 ci-dessous (seule méthode applicable ; ni Caquot ni l'épure directe du §6 ne couvrent ce cas).
- **Section constante, charges uniquement réparties** → deux méthodes valides, à choix :
  - la suite de Caquot de `ec2-effort-tranchant` §6 (par défaut, plus simple, valeurs commerciales figées) ;
  - l'**épure directe du §6 ci-dessous** (plus économique, calcul zone par zone sans grille figée — à proposer explicitement à l'utilisateur, surtout s'il mentionne vouloir économiser l'acier).

## 2. Sections de calcul de l'espacement

Calculer l'espacement requis $s(x) = A_{sw}/(A_{sw}/s\text{ calculé par }$`ec2-effort-tranchant`$)$ successivement :
1. **Section initiale** : à la distance $d$ du nu d'appui si les charges réparties prédominent pour l'effort tranchant à cet endroit (utiliser $V_{Ed0}$), ou au nu d'appui même s'il y a des charges concentrées à son voisinage (utiliser $V'_{Ed0}$) — cf. `ec2-effort-tranchant` §2 pour le choix entre $V_{Ed0}$ et $V'_{Ed0}$.
2. **Sections intermédiaires** : immédiatement à gauche et à droite de chaque section où agit une charge concentrée (l'effort tranchant y est discontinu).
3. Appeler `ec2-effort-tranchant` à chacune de ces sections pour obtenir $A_{sw}/s$ — ne pas redupliquer son calcul de $V_{Rd,c}$, $\cot\theta$, etc.

Tracer (ou tabuler) la courbe $s(x)$ ainsi obtenue.

## 3. Borne supérieure de l'espacement $\bar s$

$$\bar s = \min\left[\frac{A_{sw}}{b_w\sin\alpha}\cdot\frac{f_{yk}}{0{,}08\sqrt{f_{ck}}}\;;\;0{,}75\,d\,(1+\cot\alpha)\;;\;15\,\phi \text{ si } A_{s2}\neq0\right]$$

Le premier terme vient directement du pourcentage minimal $\rho_{w,min}=0{,}08\sqrt{f_{ck}}/f_{yk}$ déjà utilisé par `ec2-effort-tranchant` §5.1 (c'est la même condition, reformulée en espacement plutôt qu'en $A_{sw}/s$ — ne pas revérifier $\rho_{w,min}$ séparément une fois $\bar s$ respecté). Les deux autres termes reprennent l'espacement longitudinal maximal de `ec2-effort-tranchant` §5.3.

## 4. Construction de l'épure (discrétisation par paliers croissants)

1. Placer la première nappe d'armatures d'âme à $s_1/2$ du nu d'appui, avec $s_1 \leq s_0$ (espacement calculé en section initiale, arrondi à l'entier inférieur en cm, $\geq 7$ cm en pratique).
2. Répéter cet espacement $s_1$ un nombre entier de fois tant que la courbe $s(x)$ (côté sécuritaire, "en dessous") le permet, puis passer à l'espacement entier supérieur suivant $s_2 > s_1$, et ainsi de suite — chaque palier enveloppe $s(x)$ **par dessous** (jamais un espacement plus grand que ce que $s(x)$ autorise à cet endroit).
3. Arrêter le processus dès que l'espacement immédiatement inférieur à $\bar s$ (§3) est atteint : au-delà, conserver ce dernier espacement jusqu'à mi-travée (ou jusqu'à la section symétrique côté opposé), sans continuer à l'augmenter.
4. **Règle impérative** : les paliers doivent être strictement croissants de $s_1$ à $\bar s$, avec des hauteurs de marche ($s_{i+1}-s_i$) elles-mêmes croissantes. Ne jamais redescendre à un espacement plus petit après avoir atteint un palier plus grand (le document source illustre explicitement ce tracé comme déconseillé) — si un changement de tracé (réduction de $A_{sw}$, diminution de $\phi_t$) devient nécessaire plus loin dans la poutre, soit reprendre toute la discrétisation depuis le début avec le nouveau tracé si $s_0 \geq 7$ cm, soit continuer à envelopper la nouvelle courbe uniquement au-delà de la section où $A_{sw}$ a été réduit — jamais retomber sous un palier déjà posé.

## 5. Orchestration avec `ec2-effort-tranchant`

Ce skill ne recalcule jamais $A_{sw}/s$, $\cot\theta$, $V_{Rd,max}$ ou $\rho_{w,min}$ — il les obtient de `ec2-effort-tranchant` à chaque section de calcul (§2 ci-dessus) et se limite à la construction de l'épure de répartition (§3-4) à partir de ces valeurs. Si l'utilisateur ne précise pas la méthode d'inclinaison des bielles (variable ou standard), utiliser la même que celle retenue pour le ferraillage longitudinal de la travée (cohérence du décalage $a_1$, §4 de `references/arret-barres.md`) plutôt que de redemander.

## 6. Méthode alternative pour le cas simple — épure directe (économique)

Source : *Le béton armé selon l'Eurocode 2*, chapitre 13 §13.4.7. Applicable **uniquement** section constante + charges uniquement réparties (même domaine que Caquot). Validée numériquement (cf. `references/test-cases.md`) sur la travée 1 de l'exercice de référence de ce skill : reproduit exactement le corrigé publié pour les 4 premières zones, à l'arrondi de 5 mm près au-delà.

**Ne pas confondre le décalage utilisé ici avec $a_1$** (celui des barres longitudinales, `references/arret-barres.md` §1) — c'est un décalage différent, propre à la courbe des armatures d'âme (EC2 §6.2.3(5)) :

$$l_i = z(\cot\theta+\cot\alpha) \qquad (\text{PAS divisé par 2, contrairement à } a_1)$$

### Principe

1. **Aucune vérification requise à moins de $d_1$ du nu d'appui** (§6.2(8)) — le premier cadre est placé forfaitairement à 50 mm du nu, par commodité de mise en œuvre, quel que soit le calcul.
2. **Zone 1** : calculer $V_{Ed}$ à la position $d_1+l_i$ du nu d'appui (coordonnée $l_{eff}$, celle de l'analyse structurale — pas $l_n$), en obtenir $A_{sw}/s$ auprès de `ec2-effort-tranchant`, puis $s = A_{sw}/(A_{sw}/s)$ **arrondi au 5 mm inférieur** (pas de grille commerciale figée, contrairement à Caquot). Nombre d'intervalles de cette zone : $n_1 = \lfloor (d_1+l_i-0{,}05)/s_1 \rfloor$, soit $n_1+1$ cadres.
3. **Zones suivantes** : décaler de $l_i$ depuis la position **réellement atteinte par les cadres déjà placés** ($0{,}05+\sum n_k s_k$) — **pas** depuis la position théorique de la zone précédente, c'est l'erreur la plus facile à faire ici (rencontrée et corrigée en validant cette méthode). Recalculer $V_{Ed}$ à cette nouvelle position, $A_{sw}/s$, $s$ (arrondi 5 mm inférieur), $n = \lfloor l_i/s \rfloor$ intervalles.
4. **Arrêt des zones "normales"** : dès que $A_{sw}/s$ requis descend sous $\rho_{w,min}$ (`ec2-effort-tranchant` §5.1).
5. **Dernière zone** : espacement $s_{l,max}$ jusqu'au point où $V_{Ed}(x)=0$ (déjà connu de l'analyse structurale de la travée — ne pas le recalculer). Si la somme des deux "restes" (droite + gauche, non couverts par un nombre entier d'intervalles) reste inférieure à $s_{l,max}$, aucun cadre supplémentaire n'est nécessaire à la jonction des deux moitiés de travée.
6. Répéter symétriquement côté gauche depuis l'autre appui.

### Comparaison avec Caquot (à mentionner à l'utilisateur s'il hésite entre les deux)

- Cette méthode donne un résultat **plus économique** (moins de cadres au total) que Caquot, pour deux raisons cumulées : le décalage $l_i$ appliqué à *chaque* zone (Caquot ne réduit qu'une fois, à $d_1$, près de l'appui) et l'arrondi libre au 5 mm (Caquot est contraint à sa suite commerciale 7-8-9-10-11-13-16-20-25-35-40-60 cm, plus grossière).
- En contrepartie, elle demande de recalculer $V_{Ed}$ et $A_{sw}/s$ à chaque zone (autant d'appels à `ec2-effort-tranchant` que de zones), alors que Caquot se contente d'un calcul initial puis d'une formule de répartition — plus rapide à dérouler à la main, mais moins économe en acier.
- Ne jamais mélanger les deux méthodes dans une même travée (décalages et règles d'arrondi incompatibles) — en choisir une et l'appliquer aux deux moitiés de la travée.
