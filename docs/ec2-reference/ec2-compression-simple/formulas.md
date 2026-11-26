# Formules — poteau en compression centrée EC2

Source : *Pratique de l'Eurocode 2*, chapitre 6 « Compression centrée »
(p.151-174), références EC2 entre parenthèses. Numérotation [6.x] = celle du
cours. Les valeurs sont les valeurs recommandées / Annexe nationale française.

Sommaire : §0 Notations · §1 Matériaux · §2 Sollicitation · §3 Longueur
efficace · §4 Élancement et critère · §5 Coffrage · §6 Armatures
longitudinales · §7 Armatures transversales · §8 Recouvrement · §9 Vérification
finale · §10 Schéma · §11 Points d'attention sur le cours

## §0 — Notations et conventions
- Unités de travail : kN, m² ou cm², MPa. 1 MN = 1000 kN ; 1 cm² = 100 mm².
- Es = 2.10⁵ MPa ; γc = 1,5 ; γs = 1,15 (situation durable). Situation
  accidentelle : γc = 1,2 ; γs = 1,0.
- αcc = 1 (AN française, y compris ponts).
- b = petite dimension, h = grande dimension (h ≥ b) ; section circulaire :
  diamètre a.
- ϖ = 25 kN/m³ (poids volumique du béton armé).
- Série commerciale HA : 6, 8, 10, 12, 14, 16, 20, 25, 32, 40 mm (**pas de
  18 ni de 22** : c'est pourquoi le corrigé passe de 4φ16 à 4φ20).
- Rappel : la compression centrée pure n'existe pas en pratique (excentricités
  d'exécution, dissymétrie). Elle est **conventionnelle** : valable tant que
  §4 est vérifié.

## §1 — Matériaux
- fcd = αcc.fck/γc ; fyd = fyk/γs
- εc2 = 2,0 ‰ si fck ≤ 50 MPa (raccourcissement du béton au pivot C).
  Si fck > 50 : εc2 = 2,0 + 0,085.(fck-50)^0,53 ‰ (tableau 3.1 EC2, **hors
  corrigé** — le signaler).
- εyd = fyd/Es
- **Contrainte de l'acier à l'ELU** (l'acier suit le raccourcissement du béton)
  [p.159] :
  - σs = fyd si εc2 > εyd (l'acier est plastifié)
  - σs = Es.εc2 sinon
  - S500 : εyd = 2,17 ‰ > 2 ‰ → σs = Es.εc2 = 400 MPa (cas courant, béton
    ≤ C50/60)
  - S400 : εyd = 1,74 ‰ < 2 ‰ → σs = fyd = 347,8 MPa (palier horizontal, le
    cours ignore la branche inclinée)
  - Il n'y a **pas de choix de diagramme acier à demander** : σs découle de
    εc2 et fyd.
- Adhérence (utile pour le recouvrement, §8) :
  - fctm = 0,3.fck^(2/3) si fck ≤ 50 ; sinon 2,12.ln(1+(fck+8)/10)
  - fctk,0,05 = 0,7.fctm, **limitée à 3,1 MPa**
  - fctd = αct.fctk,0,05/γc avec αct = 1 et γc = 1,5 (1,2 accidentel)
    (le cours écrit γs dans la formule mais applique 1,5 = γc : c'est γc)

## §2 — Sollicitation ELU
- NEd = 1,35.NG + 1,5.NQ (poteau : poids propre à ajouter une fois la section
  connue)
- Poids propre : Gpp = ϖ.Ac.l (l = hauteur libre) ; à l'ELU : 1,35.Gpp
- NEd retenu = 1,35.NG + 1,5.NQ + 1,35.Gpp
- Le cours calcule le coffrage avec NEd **sans** poids propre, puis ajoute le
  poids propre pour les armatures (pas d'itération sur le coffrage).
- Si l'utilisateur donne directement NEd, demander à quel niveau il est donné
  (sous plancher supérieur → ajouter le poids propre ; en pied → ne pas
  l'ajouter).

## §3 — Longueur efficace l0 (5.8.3.2)
Une seule méthode est appliquée selon les données, dans cet ordre :

1. **l0 donnée** par l'utilisateur (éventuellement l0b et l0h par direction).
2. **Liaisons d'extrémité classiques** (poteau isolé, théorie d'Euler) :
   - encastré-libre : l0 = 2.l
   - articulé-articulé : l0 = l
   - encastré-guidé (rotation bloquée, translation libre) : l0 = l
   - encastré-articulé : l0 = 0,7.l
   - encastré-encastré : l0 = 0,5.l
3. **Poteau de portique**, souplesses k1, k2 aux extrémités 1 et 2
   (θ = K.M, k = (EI/l).(θ/M)) avec EI = rigidité de flexion du poteau,
   l = longueur libre entre nus :
   - **Contreventé** (non intégré au contreventement) (5.15) :
     l0 = 0,5.l.√[(1 + k1/(0,45+k1)).(1 + k2/(0,45+k2))]
   - **Non contreventé** (intégré au contreventement) (5.16) :
     l0 = l.Max{ √(1 + 10.k1.k2/(k1+k2)) ; (1 + k1/(1+k1)).(1 + k2/(1+k2)) }
   - Encastrement parfait : θ = 0 → k = 0 ; extrémité libre : M = 0 → k → ∞.
     Comme l'encastrement parfait n'existe pas : **k ≥ 0,10** (valeur min).
   - Si le nœud comporte un autre poteau : remplacer EI/l par
     [(EI/l)a + (EI/l)b] (poteau supérieur a, inférieur b).
   - Prendre en compte la fissuration des éléments de liaison sauf s'ils
     restent non fissurés à l'ELU.
   - Effort normal ou section variables : l0 = π.√(EI/NB), NB = charge
     critique de flambement (5.17) — hors périmètre, demander l0.
   - **Hypothèse du corrigé** : « poteau moins raide que les poutres du
     plancher » → k1 = k2 = 0,10 → l0 ≈ 0,59.l (avec l = 2,10 m : 1,24 m).
     C'est l'hypothèse **la plus favorable** ; toujours la signaler à
     l'utilisateur (poutres souples → k plus grand → l0 plus grand, jusqu'à l).

## §4 — Élancement et critère de compression centrée

### §4.1 — Conditions « poteau » [6.1]
- l/h ≥ 3 (sinon calcul en voile) ; h < 4.b
- Si l'une échoue : ce n'est plus un poteau → **arrêter et le signaler**
  (calcul en voile hors périmètre).

### §4.2 — Élancement λ = l0/i
- i = √(Ic/Ac) ; l'inertie est prise autour de l'axe perpendiculaire au plan
  de flambement, la section de béton seul.
- Rectangulaire [6.4] : λ = Max{ l0b.√12/b ; l0h.√12/h } (l0b : flambement
  parallèle à b, l0h : parallèle à h ; par défaut l0b = l0h = l0). Le plan de
  flambement est celui de λmax (en pratique la petite dimension b).
- Circulaire [6.5] : i = a/4 → λ = 4.l0/a

### §4.3 — Critère (5.13N) [6.2]
Compression centrée conventionnelle si  λ ≤ λlim = 20.A.B.C/√n
- n = NEd/(Ac.fcd)  (effort normal relatif)
- A = 1/(1 + 0,2.φef) ; **A = 0,7 si φef inconnu**
  φef = φ(∞,t0).MOEqp/MOEd  (5.19)
- B = √(1 + 2.ω) ; **B = 1,1 si ω inconnu** ; ω = As.fyd/(Ac.fcd)
- C = 1,7 − rm ; **C = 0,7 si rm inconnu**
  rm = 1 (éléments non contreventés ; ou contreventés dont les moments du
  1er ordre sont dus aux imperfections/charges transversales) ; rm = M01/M02
  sinon (|M02| ≥ |M01|)
- Le cours calcule λlim **deux fois** :
  1. **Au coffrage** (As inconnue) : A = 0,7 ; B = 1,1 ; C = 0,7 et poteau
     supposé carré de côté b (h inconnu). Un léger dépassement λ > λlim est
     toléré à ce stade (« écart faible », pas de second ordre) : verdict
     **provisoire**.
  2. **Après le ferraillage** (§9) : B = √(1+2ω) avec As réelle → verdict
     **définitif**.
- Si λ > λlim au verdict définitif : l'hypothèse de compression centrée est
  fausse → augmenter la section, réduire l0, ou passer en flexion composée avec
  effets du second ordre (**hors périmètre** : le dire clairement, ne pas
  poursuivre comme si tout était valide).

## §5 — Coffrage (section minimale)
- Effort normal ultime limite : NRd,th = Ac.fcd + As.σs [6.6]
- Ac ≥ NEd / (fcd + (As/Ac).σs)
- Hypothèse du cours : As/Ac = 1 % → **Ac ≥ NEd / (fcd + σs/100)** [6.18]
  (σs en MPa, donc σs/100 = 1 % de σs)
- Rectangulaire : la dimension imposée est b ; h = Ac/b, à arrondir **au
  multiple de 5 cm supérieur** (convention retenue : 41 cm → 45 cm dans le
  corrigé). Si h_calc < b : section carrée b×b (h ≥ b). Aucune dimension
  imposée : section carrée a = √Ac.
- Circulaire : a = √(4.Ac/π), arrondi au multiple de 5 cm supérieur.
- Vérifier ensuite les conditions §4.1 sur la section retenue.

## §6 — Armatures longitudinales (9.5.2)

### §6.1 — Calcul
- Béton : Fc = Ac.fcd [6.7]
- Aciers : Fs = NEd − Fc [6.8] ; As = Fs/σs [6.9]
- Si Fs ≤ 0 : le béton seul suffit → As = As,min.

### §6.2 — Sections extrêmes [6.10] (9.12N)
- As,min = Max{ 0,10.NEd/fyd ; 0,002.Ac }
- As,max = 0,04.Ac hors recouvrement ; 0,08.Ac en zone de recouvrement
  (armatures en recouvrement comprises : As.(1 + ρ1/100) si toutes les barres
  sont recouvertes dans la même section, ρ1 = 100 % → 2.As)
- As,min ≤ As ≤ As,max ; si As > As,max → revoir le coffrage.
- As,req = Max{As calculée ; As,min}

### §6.3 — Dispositions constructives
- φ ≥ φmin = 8 mm [6.11]
- Au moins **4 barres** (une dans chaque angle d'une section rectangulaire ;
  4 barres minimum en section circulaire) ; section polygonale : une barre
  au moins dans chaque angle.
- **Choix des barres** : viser As,prov ≥ As,req avec le **moins de barres
  possible** en commençant par 4 barres d'angle et le plus petit diamètre
  commercial qui convient (≤ 32 mm) ; passer à 6, 8… barres seulement si le
  diamètre dépasse 32 mm ou si les barres ne rentrent pas. Présenter au moins
  une alternative (ex. 4HA20 = 12,57 cm² ou 6HA16 = 12,06 cm²).
- Position des barres : distance face → axe = cnom + φt + φ/2.
  Espacement libre entre barres ≥ Max{φ ; dg + 5 mm ; 20 mm} (dg = plus gros
  granulat, 20 mm par défaut).
- Barres **intermédiaires** (n > 4) : toute barre non tenue doit être à
  moins de 150 mm (entre axes) de la barre tenue la plus proche, sinon la
  tenir par un cadre, étrier ou épingle (9.5.3(6)).
- cnom : le tableau 4.4N (cmin,dur) n'est **pas embarqué** → le demander à
  l'utilisateur (cnom = cmin + Δcdev, Δcdev = 10 mm par défaut).

## §7 — Armatures transversales (9.5.3)

### §7.1 — Diamètre [6.12] [6.13]
- φt ≥ Max{6 mm ; φl,max/4} ; treillis soudés : φt ≥ 5 mm
- **Retenu** : plus petit diamètre commercial ≥ Max{6 ; φl,max/3}
  (6, 8, 10, 12, 14, 16). Plus strict que l'EC2, mais c'est la règle de
  pratique du skill de flexion et elle redonne le φ8 du corrigé pour φ20.

### §7.2 — Espacement en zone courante [6.14]
- scl,t,max = Min{ 20.φl,min ; b (plus petite dimension) ; 400 mm }
- Retenu : scl,t = scl,t,max arrondi **par défaut** au multiple de 5 cm
  (40 cm dans le corrigé). Section circulaire : b ← a.

### §7.3 — Zones de nœud et de recouvrement [6.17] (9.5.3(4))
- Sur une hauteur h (plus grande dimension) de part et d'autre d'une poutre
  ou d'un plancher, et sur les recouvrements de barres φ > 14 mm :
  **scl,t ≤ 0,6.scl,t,max** (24 cm dans le corrigé → 20 cm retenu).
  (Le corrigé n'applique explicitement la réduction que sur le recouvrement.)

### §7.4 — Forme des armatures
- Cadre général entourant toutes les barres longitudinales + cadres, étriers
  ou épingles pour les barres intermédiaires (section circulaire : cerces).
- Retours d'équerre interdits : ancrages en crochet avec retours dirigés vers
  la masse du béton.

## §8 — Recouvrement des barres longitudinales (8.7)
Pratique du cours : **toutes les barres arrêtées dans la même section**
(ρ1 = 100 %), barres verticales (bonnes conditions d'adhérence). Si le
poteau n'a pas de reprise de bétonnage (pas de barres en attente), ce §8
est sans objet.

### §8.1 — Contrainte ultime d'adhérence [6.15] (8.2)
- fbd = 2,25.η1.η2.fctd
- η1 = 1 (bonnes conditions ; barres verticales, α = 90° par rapport à
  l'horizontale) ; 0,7 (conditions médiocres)
- η2 = 1 si φ ≤ 32 mm ; (132−φ)/100 si φ > 32 mm

### §8.2 — Longueur d'ancrage de référence [6.16] (8.3)
- lb,rqd = (φ/4).(σsd/fbd)
- σsd = Fs/As,prov (Fs = force reprise par les aciers, cf. §6.1)
- Si As,min gouverne : σsd est faible et lb,rqd aussi → l0 tombe sur les
  minima (15.φ ; 200 mm). Cas **non traité par le cours** : le signaler et
  proposer, par prudence, σsd = fyd.

### §8.3 — Longueur de recouvrement (8.7.3)
- l0 = Max{ α4.α6.lb,rqd ; 15.φ ; 200 mm }  (barres comprimées : α1 = α2 =
  α3 = 1, α5 sans objet)
- α4 = 1 (armatures transversales non soudées) ; 0,7 (soudées)
- α6 = √(ρ1/25) ∈ [1 ; 1,5], ρ1 = % de barres recouvertes dans la zone
  ±0,65.l0 autour du recouvrement considéré. **Le cours applique α6 pour
  les barres comprimées** (ρ1 = 100 % → α6 = 1,5) : reproduire.
- Diamètres différents : évaluer l0 avec la plus grande lb,rqd.
- Arrondir l0 au multiple de 5 cm supérieur.

### §8.4 — Armatures transversales dans le recouvrement (8.7.4.2)
- Section totale : **ΣAst ≥ As** (As = section d'**une** barre recouverte).
  Compter 2 branches parallèles par nappe.
- **φ ≥ 20 mm** : la moitié des armatures transversales à chaque extrémité :
  3 nappes sur le recouvrement (dans l0/3 à chaque bout) + 1 nappe hors
  recouvrement (à ≤ 4φ de l'extrémité).
  - Dépassement des barres arrêtées : 2φ au-delà des nappes extrêmes.
  - Espacement dans le groupe : scl,t = (l0/3)/2 arrondi **au cm inférieur**,
    et ≤ 150 mm ; ≤ 0,6.scl,t,max.
  - Position des nappes depuis l'origine du recouvrement : 2φ ; 2φ+s ;
    2φ+2s puis symétrique. Trou central = l0 − 4.s − 4.φ, à limiter à
    0,6.scl,t,max (sinon ajouter une nappe intermédiaire).
- **14 < φ < 20 mm** : au moins 3 nappes régulièrement espacées sur l0,
  espacement ≤ 0,6.scl,t,max.
- φ ≤ 14 mm : espacement courant.

## §9 — Vérification finale (avec As réelle)
1. ω = As,prov.fyd/(Ac.fcd) → B = √(1+2ω)
2. n = NEd/(Ac.fcd) (NEd **avec poids propre**) → λlim = 20.A.B.C/√n
3. **λ ≤ λlim** ? sinon voir §4.3.
4. **NEd ≤ NRd = Ac.fcd + As,prov.σs** [6.6] (le cours ne le fait pas
   explicitement dans l'exemple mais c'est la condition [6.6]). Donner le
   taux d'utilisation NEd/NRd.
5. As,min ≤ As,prov ≤ As,max ; φ ≥ 8 mm ; ≥ 4 barres ; espacements.

## §10 — Schéma de ferraillage
Toujours produire, en fin de note, sauf demande contraire (via
`mcp__visualize`, module `diagram`, approche « diagramme illustratif — coupe
d'un objet physique ») :
- **Coupe transversale** : contour à l'échelle (rectangle b×h ou cercle Ø a),
  cadre, barres d'angle (+ intermédiaires et épingles éventuelles), cotes b, h
  hors du contour, légende « n HA φ » et « cadre HA φt ».
- **Élévation** (hauteur libre l entre planchers) : barres verticales, cadres
  courants à e = scl,t, zone de recouvrement avec ses nappes (3+1 par
  extrémité) et leurs cotes (ex. 4 / 14 / 14 / 21 / 14 / 14 / 4), zone de
  nœud (e ≤ 0,6.scl,t,max). Repère l0 (recouvrement) et l.
- Une seule figure par poteau ; ne pas répéter son contenu en texte.

## §11 — Points d'attention sur le cours (à signaler quand ils s'appliquent)
- Le corrigé écrit « b = 0,45 m » au §3.2 : c'est **h = 0,45 m** (poteau
  45×40 cm).
- Dans fctd, le cours écrit γs mais utilise 1,5 : c'est γc.
- L'énoncé dit « poids propre négligeable » mais le corrigé l'ajoute (0,013 MN)
  après avoir choisi la section.
- Le corrigé arrondit fcd à 16,7 MPa, Fc à 3,01 MN, fbd à 2,68 MPa… : les
  résultats exacts diffèrent de 1-3 % (voir `test-cases.md`).
- Le corrigé choisit φt = 8 mm alors que l'EC2 autorise 6 mm (Max{6 ; 20/4}).
- Le corrigé accepte λ = 10,74 > λlim = 9,60 au coffrage (« écart faible »)
  puis constate λ < λlim = 10,80 en fin de calcul ; c'est le verdict final
  qui compte.
