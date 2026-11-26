# Formules — armatures d'effort tranchant EC2

Notations : fck (MPa), γc=1,5, γs=1,15, z=0,9.d (bras de levier). Les
formules ELU de ce fichier sont homogènes en MN, MPa, m (convertir en
kN/cm²/cm en sortie). Valeurs d'Annexe nationale française retenues par
défaut partout où le document source les mentionne (signalé à chaque
formule concernée).

## §0 — Effort tranchant sollicitant (si non donné directement)
- Poutre isostatique à charges réparties, appuis simples :
  VEd (au nu d'appui) = pu.ln/2 + Pu.(1 - a/ln) si charge(s) concentrée(s)
  Pu présente(s) à la distance a de l'appui
- **Attention, ne pas confondre deux décalages différents** (erreur trouvée et corrigée en validant ce skill contre un exemple corrigé — écart ~0,8 % sur $V_{Ed0}$, côté sécuritaire mais à corriger) :
  - $a=\text{Min}(t/2\,;\,h/2)$ sert **uniquement** au calcul de $l_{eff}$ (modélisation de la travée équivalente, §5.3.2.2) — ne jamais le réutiliser ailleurs.
  - Le **nu d'appui physique** (point de départ réel pour $V_{Ed}$, l'écrêtage, l'ancrage) est toujours à $t/2$ de l'axe, **sans plafonnement par $h/2$** — utiliser $t/2$ directement pour passer de l'axe d'appui au nu d'appui dans ce fichier, même quand $t/2>h/2$ (poutre large/peu épaisse — cas fréquent pour une dalle traitée comme poutre de 1 m). $\ell_n = \ell_{eff}-2a$ reste la formule pour la portée aux nus (utilise le $a$ plafonné, cohérent avec §5.3.2.2), mais ce $\ell_n$-là ne sert pas à repositionner le nu pour les besoins de ce fichier — recalculer le nu directement à partir de $t/2$.
- $a = \text{Min}(t/2\,;\,h/2)$ [$t$ = largeur d'appui] pour passer de l'axe d'appui au
  nu d'appui **dans le calcul de $l_{eff}$ uniquement** ; $l_n = l_{eff} - t$ (ou $l_n$ donné directement)
- pu = 1,35.g + 1,5.q ; g = g1 + ϖ.bw.h (ϖ = 25 kN/m³), Pu = 1,5.Q
- **Limite connue** : formule directe valable pour poutre isostatique sur
  appuis simples uniquement. Si poutre continue/hyperstatique, demander VEd
  au nu de chaque appui directement (ou le résultat du skill [[rdm-poutre]]
  / [[ec2-poutre-complet]] si disponible dans la conversation).

## §1 — Matériaux
- fcd = fck/γc (αcc = 1)
- fctm = 0,3.fck^(2/3) si fck ≤ 50 MPa ; fctk,0,05 = 0,7.fctm ;
  fctd = fctk,0,05/γc (αct = 1)
- fywd = fyk/γs (nuance des armatures d'âme — souvent la même nuance que
  les aciers longitudinaux, à confirmer si le contexte ne le précise pas)
- ν1 = ν = 0,6.(1 - fck/250) — valeur recommandée et retenue pour l'Annexe
  nationale française (6.6N). Variante si fywd < 0,8.fyk (rare, signaler si
  applicable) : ν1 = Max{0,9-fck/200 si fck>60 MPa ; 0,5} sinon 0,6 si
  fck ≤ 60 MPa.
- ν' = 1 - fck/250 (pour la bielle d'about, §9.3)

## §2 — Effort tranchant de calcul et réduction pour transmission directe des charges aux appuis
Trois valeurs à distinguer et à utiliser chacune au bon endroit :
- **VEd** = effort tranchant NON réduit (au nu d'appui) → sert TOUJOURS à
  la vérification de compression des bielles (VRd,max, §4)
- **VEd0** = effort réduit, charges réparties prédominantes → sert au
  calcul des armatures (Asw/s) et à la nécessité d'armatures (VRd,c)
- **V'Ed0** = effort réduit, en présence de charges concentrées au
  voisinage des appuis → remplace VEd0 dans ce cas

### §2.1 — Charges réparties prédominantes
VEd0 = VEd - pu.d [effort tranchant réduit, à la distance d du nu d'appui ;
les armatures calculées avec VEd0 sont disposées à partir du nu d'appui]

### §2.2 — Charges concentrées au voisinage des appuis (0,5.d ≤ av < 2.d)
β = Max{av/(2.d) ; 1/4}
VEd0(Pu) = β.VEd(Pu) [uniquement pour une charge vérifiant 0,5.d≤av<2.d ;
en dehors de cette plage : av≤0,5.d → minoration forfaitaire Pu'=Pu/4 (soit
β=1/4) ; av≥2.d → pas de réduction, VEd0(Pu)=VEd(Pu)]
V'Ed0 = VEd(pu) + VEd0(Pu) [charges réparties prédominantes] ou
V'Ed0 = VEd(pu) + β.VEd(Pu) [sinon] — cette valeur sert au calcul des
armatures et à VRd,c ; VRd,max se vérifie toujours avec l'effort NON réduit
VEd = VEd(pu) + VEd(Pu).

## §3 — Nécessité d'armatures d'effort tranchant : VRd,c
- CRd,c = 0,18/γc ; k = Min{1+√(200/d) ; 2} (d en mm)
- ρl = Asl/(bw.d) ≤ 2% [Asl = aire des aciers longitudinaux ancrés au-delà
  de d+lbd au-delà de la section considérée — en pratique, le lit inférieur
  prolongé sur appui]
- σcp = NEd/Ac (compression positive), NEd=0 en flexion simple, k1=0,15
- vmin = 0,035.k^(3/2).√fck [poutres — valeur EC2 recommandée ; c'est
  cette valeur que les 3 applications numériques du document source
  utilisent effectivement. L'Annexe nationale française l'exprime comme
  0,053/γc.k^(3/2).√fck, présentée dans le document source comme « la même
  valeur » — en réalité ~1% plus élevée (0,0353 vs 0,035), écart que le
  document source lui-même arrondit sans le répercuter dans ses calculs.
  Utiliser 0,035 par défaut pour rester fidèle aux cas de test.]
- VRd,c1 = [CRd,c.k.(100.ρl.fck)^(1/3) + k1.σcp].bw.d
- VRd,c2 = [vmin + k1.σcp].bw.d
- VRd,c = Max{VRd,c1 ; VRd,c2}
- Pas d'armatures calculées requises si VEd0 (ou V'Ed0) ≤ VRd,c1 ET ≤
  VRd,c2 → mettre alors le ferraillage minimal uniquement (§5.1). Sinon,
  passer au §4.

## §4 — Calcul des armatures d'âme (VEd0 ou V'Ed0 > VRd,c)
Deux méthodes. Demander à l'utilisateur laquelle utiliser (ou traiter les
deux en comparaison, comme le fait l'Application 1 du document source —
c'est le comportement par défaut si l'utilisateur ne précise pas).

### §4.1 — Méthode de l'inclinaison variable des bielles (plus économique)
1 ≤ cotgθ ≤ 2,5 en flexion simple/compression (fourchette Annexe nationale
française) ; en traction : 1+σct/fctm ≤ cotgθ ≤ 2,5.(1+σct/fctm) [σct<0 =
contrainte de traction au CDG — cas rare, à signaler si applicable].

ν0 = VEd / (bw.z.ν1.fcd) [VEd NON réduit]
cotgθ = [1 + √(1-4.ν0.(ν0-cotgα))] / (2.ν0) [signe + devant le radical, θ
choisi le plus grand possible i.e. cotgθ le plus petit]
→ clamper le résultat dans [1 ; 2,5].

**Politique retenue** : ne jamais arrondir cotgθ AU-DESSUS de la valeur
calculée/clampée — cela réduit VRd,max et peut faire échouer la
vérification de compression des bielles (démontré dans l'Application 2 du
document source : cotgθ calculé=2,180, retenu à 2 reste sécuritaire, mais
la vérification VRd,max échoue si l'on garde 2,18 non arrondi à la valeur
inférieure — l'écart est faible mais le sens de l'arrondi est déterminant).
Un arrondi pratique vers le bas (cotgθ plus petit, donc θ plus grand,
souvent une valeur à 2 décimales ou un cotgθ "rond") est admis mais impose
de revérifier VRd,max avec la valeur finalement retenue avant de calculer
Asw/s.

**Précision numérique** : par construction, la valeur BRUTE de cotgθ (non
arrondie) rend VRd,max exactement égal à VEd — la marge de sécurité à ce
stade tient donc entièrement à l'arrondi choisi, pas au calcul lui-même.
Dans les cas proches de la limite haute (cotgθ→2,5 ou proche d'un cotgθ
"rond" naturel), cette marge peut être inférieure à 1% (l'Application 3 du
document source en est un exemple : marge finale <0,2%). Conserver fcd et
ν1 en pleine précision (ne pas arrondir fcd à 1 décimale) tout au long de
la chaîne ν0→cotgθ→VRd,max pour éviter un échec de vérification qui ne
serait dû qu'à un arrondi intermédiaire prématuré.

VRd,max = bw.z.ν1.fcd.(cotgθ+cotgα)/(1+cotg²θ) — vérifier VEd (NON réduit)
≤ VRd,max ; si dépassé, augmenter bw et/ou d (le coffrage est insuffisant,
ce n'est pas un problème d'armatures).

Asw/s = VEd0 (ou V'Ed0) / [z.fywd.(cotgθ+cotgα).sinα] — [8.12]

Borne haute (Asw,max/s) : cette borne s'exprime d'abord comme une
contrainte équivalente, à convertir en Asw/s avant comparaison (piège
d'unités à ne pas rater dans une implémentation) :
(Asw.fywd/bw)max = (1/2).ν1.fcd.sinα/(1-cosα) [MPa]
→ (Asw/s)max = (Asw.fywd/bw)max . bw/fywd [m²/m]
Vérifier Asw/s calculé (§4.1 ci-dessus) ≤ (Asw/s)max (sinon bielles trop
comprimées malgré VEd≤VRd,max ; augmenter bw et/ou d).

### §4.2 — Méthode standard (bielles à 45°, cotgθ=1)
VRd,max = (1/2).ν1.fcd.bw.0,9.d.(1+cotgα) — vérifier VEd (NON réduit) ≤
VRd,max.
Asw/s = VEd0 (ou V'Ed0) / [0,9.d.fywd.(sinα+cosα)]
Même borne (Asw/s)max qu'en §4.1 (même conversion contrainte→Asw/s à
appliquer).

**Remarque (comparaison des deux méthodes)** : à VEd égal, la méthode
standard donne systématiquement PLUS d'armatures transversales que la
méthode de l'inclinaison variable (Asw/s ∝ tgθ, donc minimal pour
θ=21,8°/cotgθ=2,5 et maximal pour θ=45°), mais un décalage al plus faible
pour l'arrêt des barres longitudinales (§8) — l'inclinaison variable
économise l'acier transversal au prix d'un décalage (et donc de longueurs
de barres longitudinales) plus important. Un bilan comparatif entre les
deux est à faire si le contexte s'y prête.

### §4.3 — Vérification complémentaire, charges concentrées au voisinage des appuis (0,5.d≤av≤2.d)
Asw/s ≥ V'Ed0 / [0,75.av.fywd.sinα] — comparer à la valeur retenue en
§4.1/§4.2 ; si plus contraignante, c'est elle qui gouverne le
dimensionnement (cas illustré par l'Application 2 : cette condition
multiplie par ~1,5 la section d'acier nécessaire par rapport au calcul de
base).

## §5 — Pourcentage d'armatures et dispositions constructives
### §5.1 — Pourcentage minimal (toujours à vérifier, y compris sans armatures calculées, §3)
ρw = Asw/(s.bw.sinα) ; ρw,min = 0,08.√fck/fyk [fck, fyk en MPa]

### §5.2 — Choix pratique de Asw et calcul de l'espacement s0
Choisir φw (cadre/étrier/épingle, généralement φw ≈ φlongitudinal/3
arrondi au diamètre commercial supérieur) et le nombre de brins traversant
l'âme n (2 brins par file verticale cousue) → Asw = n.π.φw²/4 ;
s0 = Asw / (Asw/s calculé au §4, borne la plus contraignante entre §4.1/
§4.2 et §4.3). Retenir un s0 usuel (arrondi à l'entier inférieur en cm).

### §5.3 — Espacement longitudinal maximal
sl,max = Min{0,75.d.(1+cotgα) ; 15.φ si As2≠0} [φ = diamètre minimal des
aciers comprimés] — vérifier s0 ≤ sl,max.

### §5.4 — Espacement transversal maximal
st,max = Min{0,75.d ; 600 mm}
st (réel, entre files/brins) = [bw - 2.(cnom+φt+φ/2)] / (n_files-1) —
vérifier st ≤ st,max.

### §5.5 — Inclinaison des armatures d'âme
45° ≤ α ≤ 90° (cadres/étriers verticaux : α=90°, cas courant et par
défaut).

## §6 — Répartition pratique des armatures d'âme (méthode Caquot)
Applicable uniquement aux poutres de section constante à charges
réparties (si conditions non vérifiées, ne pas appliquer — répartition à
étudier au cas par cas, hors périmètre de ce skill).
- ℓ0 = ln/2 (poutre sur deux appuis simples) ou ℓ0 = ln (console) ;
  ℓ'0 = ℓ0 - d
- s0 = espacement calculé au §5.2 (à VEd0/V'Ed0 nu d'appui) ; s1 ≤ s0
  choisi dans la suite de Caquot : 7, 8, 9, 10, 11, 13, 16, 20, 25, 35, 40,
  60 cm
- Nombre théorique de répétitions cumulé : ℓ'0 + d/s0 pour le 1er
  espacement de la suite (à partir de s1), puis + ℓ'0 pour chaque
  espacement suivant successif ; arrondir chaque cumul à l'entier le plus
  proche pour obtenir mi, puis ni = mi - mi-1 (nombre de répétitions de
  l'espacement i)
- Abscisses cumulées depuis le nu d'appui : s0/2, puis +n1.s1, +n2.s2, … —
  répartir jusqu'à mi-portée (leff/2) ; s'il manque un reliquat pour
  atteindre exactement mi-portée, insérer une dernière nappe à cette
  abscisse plutôt que de dépasser (voir Application 1, réf. test-cases.md)
- Toujours plafonner chaque espacement retenu à sl,max (§5.3)
- Vérifier Asw/s à mi-travée (leff/2) avec l'effort tranchant minimal de
  la travée (souvent dû aux seules charges variables, ligne d'influence
  triangulaire) — ne jamais descendre sous ρw,min (§5.1) : si le calcul
  donne moins, c'est le dernier espacement retenu (souvent le plus grand
  de la suite) qui gouverne, pas le calcul brut.

## §7 — Barres relevées à 45° (complément optionnel aux armatures d'âme droites)
À proposer seulement si l'utilisateur le demande explicitement ou si le
tracé longitudinal s'y prête (barres relevées disponibles en about).
Reprennent au plus la moitié de VEd (β3 ≥ 1/2 reste obligatoirement sur des
armatures d'âme droites) :
- Armatures d'âme (β3=0,5, valeur AN française) :
  Asw/s ≥ β3.VEd0 / [z.fywd.(cotgθ+cotgα).sinα]
- Barres relevées (α=45°, β3=0,5) :
  Aswr/sr ≥ (1-β3).VEd0 / [z.fywd.(cotgθ+1).(√2/2)]
- Espacement des relevés : sr ≤ sb,max = 0,6.d.(1+cotgα)
- Ancrage des relevés (compté depuis l'intersection avec l'axe des
  aciers longitudinaux) : ≥ 1,3.lbd en zone tendue ; ≥ 0,7.lbd en zone
  comprimée
- Vérifier le pourcentage minimal (§5.1) en cumulant les deux systèmes
  d'armatures ; les barres relevées doivent être conservées jusqu'à
  l'abscisse xr où l'équilibre est à nouveau assuré par les seules
  armatures d'âme droites ; jamais une seule nappe de relevés traversant
  seule la section d'appui.

## §8 — Force de traction dans l'armature longitudinale / règle du décalage
Ftd = MEd/z + VEd.(cotgθ-cotgα)/2 < MEd,max/z [z=0,9.d]
Décalage de la courbe des moments (pour l'arrêt des barres longitudinales) :
- Méthode inclinaison variable : al = z.(cotgθ-cotgα)/2 ≥ 0
- Méthode standard (θ=45°) : al = 0,9.d.(1-cotgα)/2
- Cas courant (θ=45°, α=90°) : al = 0,45.d
- Le décalage al varie de 1,25.z à z/2 selon θ (21,8°≤θ≤45°) — signaler à
  l'utilisateur que la méthode inclinaison variable impose un décalage
  plus important (voir §4.2 remarque).

## §9 — Vérifications d'about (appui simple d'about)
### §9.1 — Armature inférieure tendue sur appui
al = z.(cotgθ-cotgα)/2 [z=0,9.d, cf. §8]
FE = VEd.al/z + NEd [VEd au nu d'appui, NON réduit ; NEd=0 en flexion
simple]
**Valeur retenue (Annexe nationale française)** :
As ≥ Max{ [VEd.al/z + NEd + MEd/z] / fyd ; β2.Al } avec β2=0,0 pour l'AN
française (donc la seconde borne ne gouverne jamais avec ce choix — la
formule de gauche suffit en pratique). MEd = moment fléchissant concomitant
(nul sur appui simple d'about). Al = section d'aciers longitudinaux en
travée (référence informative uniquement avec β2=0).
- Cas courant θ=45°, α=90°, z=0,9.d, MEd=0, NEd=0 :
  As ≥ 0,50.VEd/fyd [coefficient = al/z = (cotgθ-cotgα)/2 = 0,5 pour θ=45°/α=90° —
  ne pas confondre avec al=0,45.d (§8) : c'est al/z qui compte ici, pas al/d.
  Erreur corrigée ici (0,45 utilisé par erreur auparavant, sous-évaluait As de 10%)]
- Retenir pour As un nombre entier de files/barres déjà présentes en
  travée (prolonger les lits inférieurs existants plutôt que d'en ajouter
  de nouveaux), jamais une section fractionnaire.

### §9.2 — Ancrage de l'armature inférieure sur appui
- fbd = 2,25.η1.η2.fctd [η1=1 bonnes conditions d'adhérence (cas courant
  des aciers inférieurs), sinon 0,7 ; η2=1 si φ≤32mm, sinon (132-φ)/100]
- σsd = FE/As [FE et As du §9.1] ; lb,rqd = (φ/4).(σsd/fbd)
- lbd = Max{α1.α2.α3.α4.α5.lb,rqd ; 0,7.α1.α4.lb,rqd} ≥ lb,min
  - α1=1 (barres droites tendues) ;
    α2=1-0,15.(cd-φ)/φ ∈[0,7;1] (cd = Min(a/2 ; c1 ; c) — enrobage
    latéral/vertical minimal autour de la barre, voir figure du chapitre
    « Dispositions constructives ») ;
    α3=1 par sécurité (à défaut de connaître à l'avance les armatures
    transversales disposées sur lbd) ; α4=1 (pas de barres soudées) ;
    α5=1 (pas de pression transversale)
  - lb,min = Max{0,3.lb,rqd ; 10.φ ; 100mm} (barres tendues)
- **Simplification possible** : si le contexte ne demande pas le calcul
  complet, proposer l'alternative forfaitaire lbd=15.φ (utilisée par le
  document source dans un des exercices) — demander à l'utilisateur son
  choix si ce n'est pas précisé.
- **Arrondi pratique** : le lbd calculé (ou lb,min s'il gouverne) est
  ensuite arrondi au cm supérieur, voire à une valeur ronde facilitant le
  plan de ferraillage (ex : 32cm calculé → 35cm retenu dans un cas de
  test) ; c'est cette valeur arrondie qui est réutilisée en §9.3.

### §9.3 — Vérification de la bielle d'about
sinθ = 1/√[1+(lbd/z)²] [z=0,9.d, lbd du §9.2]
σRd,1 = VEd / (lbd.bw.sin²θ) [VEd au nu d'appui, NON réduit]
σRd,max = k2.ν'.fcd [k2=0,85 ; ν'=1-fck/250, §1]
Vérifier σRd,1 ≤ σRd,max (sinon augmenter bw et/ou lbd, ou revoir la
disposition de l'appui — ne jamais réduire lbd pour faire passer cette
vérification, cela dégraderait §9.2).

## §10 — Jonction hourdis-nervure (section en T, si beff>bw)
Applicable si MEd>0 (moment positif, table comprimée) — cas de figure
traité ici ; si MEd<0 sur la section considérée (travée d'une poutre
continue côté appui), le principe est identique en remplaçant l'effort de
compression Fcd par l'effort de traction Fs dans les aciers de la saillie
(ΔFd = ΔF.As1/As au lieu de ΔF.(beff-bw)/(2.beff)) — signaler ce cas s'il
se présente plutôt que d'appliquer la formule MEd>0 par erreur.
- Δx = demi-distance entre la section de moment nul et celle de moment
  maximal, ≤ leff/4 (poutre isostatique sur appuis simples, en l'absence
  d'indication sur la nature de la liaison hourdis-appui — hypothèse
  standard du document source)
- Calculer l'effort de compression Fcd à leff/2 (section de MEd maximal)
  et à l'abscisse Δx (souvent leff/4) — mêmes formules qu'en flexion
  simple (voir [[ec2-flexion-simple]] §3-§4 si le skill est disponible :
  MTu, comparaison à MEd, μcu, αu, xu, Fcd=λ.beff.xu.fcd)
- ΔF = Fcd(leff/2) - Fcd(Δx) [variation de l'effort de compression dans
  la table entre les deux sections]
- ΔFd = ΔF.(beff-bw)/(2.beff) [MEd>0, répartie sur les deux débords
  symétriques de la table]
- vEd = ΔFd / (hf.Δx)
- Vérification de la compression des bielles de la table :
  vEd ≤ ν.fcd.sinθf.cosθf, avec 1≤cotgθf≤2 en membrure comprimée
  (26,5°≤θf≤45°), 1≤cotgθf≤1,25 en membrure tendue (38,6°≤θf≤45°) —
  choisir cotgθf au maximum autorisé (θf minimal) pour minimiser Asf/sf
  ensuite
- Armatures de couture (liaison table/nervure) :
  Asf/sf ≥ vEd.hf/(fyd.cotgθf)
- Si vEd ≤ k.fctd [k=1,0 valeur AN française en l'absence de reprise de
  bétonnage rugueuse en surface verticale, k=0,50 si reprise rugueuse —
  demander la nature de la reprise si le contexte ne la précise pas], les
  aciers de flexion déjà présents dans la dalle suffisent, pas d'ajout
  nécessaire ; sinon compléter avec Asf/sf ci-dessus (à répartir entre
  aciers supérieurs et inférieurs de la dalle, espacés de sf).

## §11 — Poutre à talon (section en T élargie au niveau des aciers tendus)
Même principe que §10, appliqué à la jonction talon/nervure (plan
horizontal au niveau du haut du talon, entre les saillies du talon et
l'âme) :
- As1 = section des aciers longitudinaux situés dans les saillies du
  talon (hors âme) ; As = section totale des aciers longitudinaux dans le
  talon (âme + saillies)
- Δx = leff/4 (même hypothèse qu'au §10, poutre isostatique sur appuis
  simples)
- ΔF = variation de l'effort de traction (ou compression, selon le signe
  de MEd) des aciers longitudinaux entre les deux sections d'abscisses
  leff/2 et Δx — mêmes formules qu'au §10 pour Fcd/Fs
- gEd = ΔF.(As1/As)/Δx
- Asf/sf ≥ gEd / (fyd.cotgθf), avec 1≤cotgθf≤1,25 en membrure tendue —
  choisir cotgθf au maximum autorisé (1,25) pour minimiser Asf/sf, sauf
  indication contraire du contexte
- Espacement pratique sf : privilégier un multiple entier de l'espacement
  s0 des armatures d'âme (§5/§6) même si le calcul autorise plus large,
  pour simplifier la mise en œuvre du ferraillage (voir Application 3,
  réf. test-cases.md : sf retenu = 2.s0).

## §12 — Schéma de ferraillage (une fois le calcul et les vérifications terminés)
Toujours produire ce schéma en fin de note de calcul (sauf si l'utilisateur
dit explicitement de le sauter). Appeler `mcp__visualize__read_me` (module
`diagram`) puis `mcp__visualize__show_widget` avec :
- Une coupe transversale en SVG (approche « diagramme illustratif — coupe
  d'un objet physique », pas un flowchart) : contour béton (rectangulaire,
  T ou T à talon) à l'échelle réelle, position des cadres/étriers/épingles
  autour des aciers longitudinaux, barres relevées le cas échéant tracées
  à 45°, cotes (bw, h, beff, hf, bt si talon) en lignes fines à l'extérieur
- Une élévation schématique de la répartition des espacements le long de
  la demi-poutre (façon épure de Caquot du §6), avec chaque tronçon annoté
  « n × s » et l'échelle horizontale respectée approximativement
- Une seule paire de figures par poutre calculée ; ne pas dupliquer leur
  contenu en texte après les avoir affichées (le widget est déjà visible à
  l'utilisateur)
