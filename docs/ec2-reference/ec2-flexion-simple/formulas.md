# Formules — dimensionnement flexion simple EC2

Notations : fck (MPa), γc=1,5, γs=1,15, Es=2.10^5 MPa, αcc=1 (sauf ponts si
αcc≠1, cf. note EC2), αe=Es/Ec,eff.

## §0 — Sollicitations d'une poutre isostatique (si non données directement)
- ϖ = 25 kN/m3 (poids volumique béton armé)
- Rectangulaire : g = g1 + ϖ.bw.h ; Section en T : g = g1 + ϖ[b.hf + bw.(h-hf)]
- pu = 1,35.g + 1,5.q ; pser = g + q
- a = min(t/2, h/2) [t = épaisseur d'appui] ; leff = ln + a1 + a2
- MEd = pu.leff²/8 ; Mser = pser.leff²/8

## §1 — Matériaux
- fck ≤ 50 MPa : λ = 0,8 ; η = 1,0
- fck > 50 MPa : λ = 0,8 - (fck-50)/400 ; η = 1,0 - (fck-50)/200
- fcu = η.αcc.fck/γc
- fck ≤ 50 MPa : fctm = 0,3.fck^(2/3) [sinon formule log, non couverte ici —
  demander fctm si fck > 50 MPa]
- fct,eff = fctm,fl = Max{(1,6 - h/1000).fctm ; fctm} si maîtrise de la
  fissuration NON requise ; fct,eff = fctm si maîtrise requise (h en mm)
- fyd = fyk/γs
- σc̄ = k1.fck (k1 = 0,6) — limite ELS combinaison caractéristique, classes
  XD/XF/XS
- σs̄ = k3.fyk (k3 = 0,8) — limite ELS combinaison caractéristique
- εcu2 = εcu3 = 3,5‰ si fck ≤ 50 MPa [sinon valeurs réduites, table non
  couverte ici]
- εyd = fyd/Es

## §2 — Sollicitations
γ = MEd/Mser

## §3 — Type de section (rectangulaire / T)

### Hauteur utile estimée initiale (avant connaissance du ferraillage réel)
Deux estimations sont calculées, et on retient la **plus petite** (la plus
conservative, pour éviter d'avoir à itérer dans le mauvais sens en §5) :
- Géométrique : d_géo = h - (cnom + φt + φ/2)
  - φ = diamètre de barre longitudinale envisagé (donné par l'utilisateur,
    sinon poser une hypothèse raisonnable selon l'ordre de grandeur du
    moment et le signaler)
  - φt = diamètre des armatures transversales/cadres. Si non donné :
    φt ≈ φ/3, arrondi au diamètre commercial supérieur (6, 8, 10, 12, 14,
    16 mm)
- Empirique : d_emp = 0,9.h

**d (hypothèse initiale) = min(d_géo ; d_emp)**

Cette valeur sert au calcul ELU (§4). Elle est revérifiée en §5 une fois le
nombre réel de lits connu (δG réel) : si d_réel ≥ d (hypothèse), le
dimensionnement est validé sans itération ; si d_réel < d (hypothèse),
recalculer μcu, αu, εs1, σs1, zc, As1,u avec d_réel.

Si bw = beff → rectangulaire directe (passer à §4 avec bw=beff).
Sinon :
- MTu = beff.hf.fcu.(d - hf/2)
- MEd ≤ MTu → l'AN reste dans la table : calcul en section rectangulaire de
  largeur beff (bw ← beff pour la suite)
- MEd > MTu → vraie section en T :
  MEd1 = MEd - MTu.(beff-bw)/beff ; poursuivre avec MEd ← MEd1 et bw réel

## §4 — ELU

### §4.1 — μlu (moment limite ultime réduit)

**Cas σc limitée à l'ELS (classes XD, XF, XS)** :
- Palier incliné :
  μlu(αe) = fck / [(4,62-1,66γ).fck + (165,69-79,62γ)] . K
  K = (A + B.αe + C.αe²).10⁻⁴
  A = 75,3.fck - 189,8 ; B = -5,6.fck + 874,5 ; C = 0,04.fck - 13
- Palier horizontal :
  μlu(αe) = fck / [(4,69-1,70γ).fck + (159,90-76,20γ)] . K
  K = (A + B.αe + C.αe²).10⁻⁴
  A = 71,2.fck + 108 ; B = -5,2.fck + 847,4 ; C = 0,03.fck - 12,5
  (précision ~0,5% par rapport aux tables ; suffisant pour un dimensionnement)

**Cas σc NON limitée à l'ELS (classes X0, XC, XA)** :
- αl = εcu/(εcu+εyd) ; μlu = μls = λ.αl.(1-λ.αl/2)
  (pour S500/γs=1,15/fck≤50 : μls ≈ 0,3717 — à recalculer si acier/γs/fck
  différents)

**Politique retenue (validée sur les Applications 2 et 4 du document source)** :
dès que μcu > μlu, ajouter systématiquement des aciers comprimés (As2),
même en cas de dépassement faible — c'est la méthode rigoureuse et la
plus économique. Ne jamais basculer sur une simple majoration de As1 par
un calcul ELS à la place de As2 (cette alternative existe dans un des
exemples du document source mais n'est pas retenue par défaut ici).

### §4.2 — Cas μcu ≤ μlu (As2 = 0)
- μcu = MEd/(bw.d².fcu)
- αu = (1/λ).[1-√(1-2.μcu)]
- εud selon classe de ductilité (palier incliné uniquement) : A=22,5‰,
  B=45‰, C=67,5‰. Palier horizontal → toujours pivot B (μAB=0).
- αAB = εcu/(εcu+εud) ; μAB = λ.αAB.(1-λ.αAB/2)
- μcu > μAB → pivot B : εc = εcu (3,5‰ si fck≤50) ; εs1 = εc.(1-αu)/αu
- μcu ≤ μAB → pivot A : εs1 = εud (fixe)
- Comparer εs1 à εyd = fyd/Es :
  - εs1 > εyd → palier :
    - Palier incliné, S500 A : σs1 = 432,71+952,38.εs1 (≤454 MPa)
    - Palier incliné, S500 B : σs1 = 433,20+727,27.εs1 (≤466 MPa)
    - Palier incliné, S500 C : σs1 = 432,84+895,52.εs1 (≤493 MPa)
      (autre nuance/γs : formules non couvertes ici — à défaut utiliser le
      palier horizontal σs1 = fyd, par sécurité)
    - Palier horizontal : σs1 = fyd
  - εs1 ≤ εyd → droite de Hooke : σs1 = Es.εs1
- zc : μcu ≤ 0,225 → zc = d.(1-0,6.μcu) [approché] ; sinon zc =
  d.(1-λ.αu/2) [exact]
- As1,u = MEd/(zc.σs1)

### §4.3 — Cas μcu > μlu (As2 ≠ 0)
- Mlu = μlu.bw.d².fcu
- Contrainte équivalente aciers comprimés (S500, fck ≤ 35 MPa) :
  - Palier incliné : A = -5/αe+13 ; B = 6855/αe-9
  - Palier horizontal : A = 0,5/αe+13 ; B = 6517/αe+1
  - σs2,e = 0,6.αe.γ.fck - δ'.(A.fck+B) [MPa], δ' = d'/d
  - σs1,e = (A.fck+B) - 0,6.αe.γ.fck [MPa] ; si palier horizontal, plafonner
    σs1,e à fyd
  (fck > 35 MPa ou autre nuance : formules non couvertes ici — demander la
  valeur ou utiliser σs2,e = σs1,e = fyd par défaut sécuritaire)
- As2 = (MEd - Mlu) / [(d-d').σs2,e]
- Recalculer §4.2 avec μcu ← μlu pour obtenir zc, σs1 (σs1,e)
- As1,u = Mlu/(zc.σs1) + As2.(σs2,e/σs1,e)

### §4.4 — Sections min/max
- As,min = Max{0,26.(fct,eff/fyk).bt.d ; 0,0013.bt.d}, bt = largeur de la
  zone tendue (= bw en général)
- As1,u et As2 chacun ≤ 0,04.Ac (Ac = aire béton totale)

## §5 — Ferraillage réel
- cmin = Max{cmin,b ; cmin,dur+Δcdur,γ-Δcdur,st-Δcdur,add ; 10 mm}
  - cmin,b = φ (barre seule) ou φ+5mm (paquet de 2)
  - cmin,dur : Tableau 4.4N EC2 (classe structurale × exposition) — NON
    couvert ici, demander à l'utilisateur
  - Δcdur,γ = Δcdur,st = Δcdur,add = 0 par défaut
- cnom = cmin + Δcdev, Δcdev = 10 mm par défaut
- Espacement libre entre barres : a ≥ Max{k1.φ ; 20mm ; dg+k2} avec k1=1,
  k2=5mm (valeurs recommandées)
- Position du CDG des lits : δG = Σ(distance_i × section_i)/ΣSection ;
  d réel = h - δG (vérifier ≥ d supposé, sinon itérer)
- Si le nombre de barres ne rentre pas dans bw en 2-3 files : talon
  - ht > 2.cnom + 2.φt + 3.φ + a
  - bt > 2.cnom + 6.φt + 5.φ + 4.a (pour 3 files ; adapter selon nb de
    files)

## §6 — Vérification ELS

### §6.1 — Section non fissurée
- Ach = bw.h + (beff-bw).hf + αe.(As1+As2) [T ; =bw.h+αe(As1+As2) si
  rectangulaire, beff=bw]
- v' = [bw.h²/2 + (beff-bw).hf²/2 + αe.(As1.d+As2.d')] / Ach ; v = h - v'
- Ich = bw.h³/3 + (beff-bw).hf³/3 + αe.(As1.d²+As2.d'²) - Ach.v'²
- σct = Mser.v/Ich → comparer à fct,eff
  - σct ≤ fct,eff → section non fissurée : σc = Mser.v'/Ich (≤σc̄), σs1 =
    αe.Mser.(d-v')/Ich (≤σs̄), σs2 = αe.Mser.(v'-d')/Ich si As2>0
  - σct > fct,eff → passer en section fissurée (§6.2)

### §6.2 — Section fissurée
- Si section en T, vérifier d'abord si l'AN reste dans la table :
  f(hf) = beff.hf²/2 + αe.As2.(hf-d') - αe.As1.(d-hf)
  f(hf) ≥ 0 → rectangulaire largeur beff ; f(hf) < 0 → vraie section T
- Rectangulaire (ou AN dans la table) :
  bw.x1²/2 + αe.(As1+As2).x1 - αe.(As1.d+As2.d') = 0 → résoudre x1
  Icf = bw.x1³/3 + αe.As1.(d-x1)² + αe.As2.(x1-d')²
- Vraie section T :
  a = bw/2 ; b = (beff-bw).hf + αe.(As1+As2)
  c = (beff-bw).hf²/2 + αe.(As1.d+As2.d')
  Δ = b²-4ac ; x1 = (-b+√Δ)/(2a)
  Icf = beff.x1³/3 - (beff-bw).(x1-hf)³/3 + αe.As2.(x1-d')² +
  αe.As1.(d-x1)²
- K = Mser/Icf
- σc = K.x1 (≤ σc̄) ; σs1 = αe.K.(d-x1) (≤ σs̄) ; σs2 = αe.K.(x1-d') si
  As2>0

## §6bis — Dimensionnement direct des aciers à l'ELS par compression du
béton (optionnel, si demandé explicitement)
- μser = Mser/(bw.d².σc̄)
- α1 = 1,5.[1-√(1-8.μser/3)]
- σs1 = αe.σc̄.(1-α1)/α1
- zc1 = d.(1-α1/3)
- As1,ser = Mser/(zc1.σs1)
- (si μser dépasse le domaine correspondant à μlu, un As2 serait
  nécessaire aussi — cas non détaillé ici, rare en pratique)

## §7 — Schéma de ferraillage (une fois le calcul et les vérifications
terminés)

Toujours produire ce schéma en fin de note de calcul (sauf si l'utilisateur
dit explicitement de le sauter). Appeler `mcp__visualize__read_me` (module
`diagram`) puis `mcp__visualize__show_widget` avec une coupe transversale
en SVG (approche « diagramme illustratif — coupe d'un objet physique »,
pas un flowchart) :
- Contour béton (rectangulaire ou en T) tracé à l'échelle réelle
  (viewBox 680px de large, échelle ~150-250 px/m selon la taille de la
  section, à ajuster pour occuper la largeur disponible sans déborder)
- Barres longitudinales en cercles (rayon fixe ~5px, non à l'échelle du
  diamètre réel — convention d'illustration, pas de plan d'exécution),
  positionnées aux coordonnées réelles calculées en §5 (y1, y2, y3, …
  par lit ; x réparti uniformément dans bw en respectant l'espacement
  minimal a)
- Cotes (bw, h, beff, hf) en lignes fines à l'extérieur du contour, jamais
  superposées au texte
- Enveloppe des cadres en pointillés (schématique — rappeler que l'effort
  tranchant n'est pas dimensionné par ce skill), et le nombre/diamètre des
  aciers tendus et comprimés en légende
- Si l'alerte enrobage (§5) s'applique, l'afficher en rouge/orange dans le
  schéma (couleur sémantique d'avertissement), en plus de la mention dans
  le texte
- Une seule figure par section calculée ; ne pas dupliquer son contenu en
  texte après l'avoir affichée (le widget est déjà visible à
  l'utilisateur)
