# Cas de test — applications numériques de référence
(source : *Pratique de l'Eurocode 2*, chapitre Flexion simple, p.246-292)

## ⚠️ Note de politique (As2)
Le skill applique désormais systématiquement As2≠0 dès que μcu>μlu (validé
sur les Appli 2 et 4). L'Application 1 ci-dessous choisit dans le document
source de ne PAS ajouter As2 malgré un léger dépassement (μcu=0,245>
μlu=0,2252), en compensant par un As1 majoré via l'ELS — ce n'est PAS le
comportement attendu du skill (qui ajoutera As2 dans ce cas). Les autres
étapes de l'Application 1 (matériaux, sollicitations, ELS non fissurée)
restent valables comme cas de test.

## Application 1 — Rectangulaire sans aciers comprimés, ELU+ELS
Section : b=18cm, h=60cm, d≈55cm (enrobage 5cm), poutre isostatique
leff=6,85m. g1=15,40kN/m, q=9kN/m. fck=25MPa, S500A, XD2 (σc limitée),
αe=15, palier incliné.
Attendu : MEd=222,53mkN, Mser=158,95mkN, γ=1,40, μcu=0,245, pivot B,
εs1=6,30‰>εyd, σs1=439MPa, zc=0,472m, As1,u=10,74cm², As,min=1,32cm².
Ferraillage retenu : 1φ25+2φ20 = 11,19cm².
ELS non fissurée : σct=10,25MPa > fct,eff=2,56MPa → section fissurée.
Puis dimensionnement ELS par compression : As1,ser=12,87cm² (écart +20% vs
As1,u, confirme l'intérêt du moment limite). Vérif section fissurée :
σc=15,03MPa≈σc̄, σs1=263MPa<400MPa O.K.

## Application 2 — Rectangulaire, notion de moment limite ultime
Section identique à l'appli 1 (18×60, d=55cm), mais MEd=0,2048mMN,
Mser=0,1463mMN (γ=1,40) données directement. Mêmes matériaux.
Attendu : μcu=0,2252, pivot B, εs1=7,336‰.
- Palier incliné : σs1=440MPa, zc=0,479m, As1,u=9,72cm²
- Palier horizontal : σs1=435MPa(fyd), zc=0,479m, As1,u=9,82cm² (écart
  1,0% entre les deux diagrammes)
- ELS compression béton : As1,ser=9,77cm²
- Remarque attendue : αe=15 et μcu=0,2252=μlu(15) → confirme que la
  section équilibre exactement MEd=Mlu.

## Application 3 — Vérification des contraintes ELS (petites sollicitations)
b=18cm, h=60cm, d=55cm, MEd=0,04356mMN, Mser=0,03227mMN (γ=1,35),
fck=30MPa, S500C, XD2.
Attendu : μcu=0,040 (très faible) → pivot B, εs1=65,13‰, palier,
σs1=491MPa, As1,u=1,65cm² < As,min=1,49cm²... (As1,u>As,min de peu, 1,65>1,49
O.K.)
ELS non fissurée : σct=2,822MPa < fct,eff=2,896MPa → section NON fissurée
(contrairement aux applis 1 et 2). Contrainte de compression σc=2,94MPa,
σs1=35,13MPa (très faible, 0,07.fyk).
Enseignement : pour faible MEd, la vérif ELS doit se faire en section non
fissurée ; faire l'hypothèse fissurée reste sécuritaire mais inutile.

## Application 4 — Rectangulaire avec aciers comprimés
b=18cm, h=60cm, d=55cm, d'=5cm, MEd=0,250mMN, Mser=0,179mMN (γ=1,40),
fck=25MPa, S500A, XD2.
Attendu : μcu=0,2749 > μlu=0,2252(incliné) ou 0,2265(horizontal) → As2≠0.
- Palier incliné : Mlu=0,2048mMN, σs2,e=245MPa, As2=3,69cm², σs1,e=458MPa,
  zc=0,479m, σs1=440MPa, As1,u=11,69cm². Total=15,38cm².
- Palier horizontal : Mlu=0,2060mMN, σs2,e=246MPa, As2=3,58cm²,
  σs1,e=435MPa(plafonné fyd), As1,u=11,93cm². Total=15,51cm² (écart 0,8%).
Ferraillage retenu : 2φ16 (As2=4,02cm²) + 4φ20 (As1=12,56cm²).
ELS section fissurée (car non fissurée donne σct=10,78MPa>2,56MPa) :
σc=15,09MPa≈σc̄ O.K., σs1=320MPa<400MPa O.K., σs2=177MPa.

## Application 5 — Section en T
Poutrelles espacées de 2,66m, dalle hf=15cm, retombée bw=22cm, h=85cm,
d≈80cm. b=108,5+9,98+3,85... (charges composées), leff≈10,30m.
fck=25MPa, S500 palier horizontal, XC2 (σc NON limitée).
Attendu : beff=2,66m (=b entier ici), MEd=0,777mMN, MTu=4,831mMN → MEd<MTu
→ section rectangulaire de largeur beff=2,66m.
μcu=0,0273 < μlu=μls=0,3717 → As2=0. zc=0,787m, σs1=fyd=435MPa,
As1,u=22,70cm². As,min=2,34cm² O.K.
Ferraillage : 2×2φ25 + 2φ14 = 22,72cm² (3 lits), x réel du CDG=7,27cm,
d réel=77,73cm.
ELS section fissurée directe (T, AN dans la table car f(hf)>0) :
x1=12,89cm<hf=15cm, Icf=1 622 698cm⁴, σc=4,3MPa (non limitée, pas de
vérif σc̄), σs1=321MPa<400MPa O.K.

## Application 6 — Poutre à talon (section en T avec talon)
Pont, poutre leff=15m, table b=2,25+2×0,35=2,60m sur 16cm, âme bw=35cm,
h=1,70m, d≈1,58m (0,93h). g1=108,50kN/m, q=62kN/m. fck=25MPa, S500
palier horizontal, XD2, classe structurale S4, dg=25mm.
Attendu : MEd=7641,84mkN, Mser=5466,94mkN, γ=1,40. beff=2,60m, MTu=10,421
mMN > MEd → rectangulaire largeur beff.
μcu=0,071 < μlu=0,2265 → As2=0. αu=0,092, zc=1,522m, σs1=435MPa,
As1,u=115,42cm². As,min=7,36cm² O.K.
Ferraillage : 15φ32=120,60cm² sur 3 files — trop pour l'âme (35cm) →
talon nécessaire : ht≈30cm, bt≈65cm (calcul enrobage cnom=50mm, cmin,dur=
40mm pour S4/XD2, espacement a≥32mm).
ELS section fissurée (T) : x1=50,06cm>hf=16cm → vraie section T, Icf=
28 985 684cm⁴, σc=9,44MPa<15MPa O.K., σs1=305MPa<400MPa O.K.
