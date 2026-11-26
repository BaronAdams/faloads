# Cas de test — applications numériques de référence
(source : *Pratique de l'Eurocode 2*, chapitre Effort tranchant, p.352-391)

## Application 1 — Poutre isostatique rectangulaire, charges réparties (leff=10m)
Poutrelle bw=22cm, h=85cm, d=80cm, cnom=3cm, reprise de bétonnage
âme/hourdis. leff=10,00m, t(appui)=80cm → a=0,40m, ln=9,20m. q=26,60kN
(variable), pu=58,57kN/m. fck=25MPa, S500, T (beff=2,22m, hf=15cm), lits
inférieurs 2φ25+1φ32 (Asl=16,08cm² pour VRd,c) puis 2φ32 sur appui.

**§1-2** fcd=16,7MPa, fctd=1,19MPa, ν1=0,54. VEd,eff(axe)=292,9kN,
VEd(nu)=269,47kN=0,269MN, VEd0(d)=222,62kN=0,223MN (charges réparties
seules).

**§3 VRd,c** : ρl=0,009, k=1,5, CRd,c=0,12, vmin=0,321 →
VRd,c1=0,089MN, VRd,c2=0,056MN. VEd0=0,223MN > les deux → armatures
nécessaires.

**§4.1 Inclinaison variable** (α=90°) : ν0=0,188 → cotgθ calculé=5,12 >
2,5 → clampé à cotgθ=2,5. VRd,max=0,493MN > VEd=0,269MN O.K.
Asw/s≥1/35,11 cm²/cm (calculé) ; borne max=1/4,39 O.K. ; ρw,min=1/56,82
O.K. → retenu 1 cadre φ8 HA (Asw=1,00cm²) : **s0=35cm**. sl,max=60cm O.K.,
st,max=60cm, st réel=11,2cm O.K.

**§4.2 Méthode standard (θ=45°)** : VRd,max=0,714MN O.K. Asw/s≥1/14,04
cm²/cm → 1 cadre φ8 HA : **s0=14cm** (nettement plus contraignant que
l'inclinaison variable — confirme la remarque du §4.2 de formulas.md).
sl,max=60cm O.K., st=11,2cm O.K.

**§6 Répartition Caquot** (menée sur la base de θ=45°, s0=14cm→s1=13cm) :
ℓ0=4,60m, ℓ'0=3,80m. Suite retenue : 6 + 10×13 + 3×16 + 4×20 + 4×25 + 26 +
2×35 (cm), plafonnée à sl,max=60cm. Vérification à mi-portée (VEd=49,9kN
dû aux seules charges variables) : Asw/s=1/62,64 < ρw,min=1/56,82 en
calcul brut, mais l'espacement réellement retenu (35cm) donne
Asw/s=2×0,50/35=0,029>0,018 O.K. — c'est l'espacement retenu qui gouverne,
pas le calcul brut (cf. §6 de formulas.md).

**§9 Vérifications d'about** (θ=45°) : al=0,36m. Al(travée)=35,72cm².
As≥Max{8,93 ; 3,09}=8,93cm² [AN française : 3,09cm² — c'est la valeur EC2
retenue par le document, 2φ32 conservés = 16,08cm²]. Ancrage :
fbd=2,68MPa, σsd=84MPa, lb,rqd=7,84.φ, lbd calculé=24,32cm < lb,min=32cm →
**lbd=35cm** (borne lb,min qui gouverne, pas le calcul σsd). Bielle
d'about : sinθ=0,899 (θ=64,08°), σRd,1=4,32MPa < σRd,max=12,78MPa O.K.

**§10 Jonction hourdis-nervure** : Δx=leff/4=2,50m. MEd(leff/2)=732,13mkN,
MEd(Δx)=549,09mkN < MTu=4,031mMN → rectangulaire largeur beff. μcu=0,023,
xu=2,3cm, Fcd=0,682MN=ΔF. ΔFd=0,307MN, vEd=0,82MPa. Vérif bielles :
sin2θf≥0,182 → cotgθf≤10,90, borne 1≤cotgθf≤2 respectée. Armatures avec
cotgθf=2 : Asf/sf≥1/70,73cm²/cm, soit ≥1,41cm²/m pour sf=100cm — mais
vEd=0,82MPa < k.fctd=1×1,19=1,19MPa [AN française, k=1,0 sans reprise
rugueuse] → **pas d'armatures de couture supplémentaires nécessaires**
(remarque 3 de formulas.md §10 — dépend de la nature de la reprise ; avec
k=0,4 recommandé EC2, la condition serait au contraire non vérifiée,
d'où l'importance de préciser le choix d'AN à l'utilisateur).

## Application 2 — Poutre isostatique rectangulaire, charge concentrée près appui (ln=12m)
bw=75cm, h=205cm, d=185cm (d=0,9h), cnom=3cm. Charge ponctuelle Q à
x=3,00m de l'appui (Pu=1,5.Q, unités cohérentes en MN dans le corrigé
malgré l'énoncé en kN — traiter Pu comme donnée numérique du document,
sans convertir). fck=25MPa, S500, 7 files φ32 en travée (As2=0),
Asl(VRd,c)=13φ32=104,52cm² (2 lits).

**§1-2** VEd(pu,nu)=0,311MN, VEd(Pu)=3,966MN → VEd(non réduit)=4,277MN.
av=3,00m ∈[0,5d;2d]=[0,925;3,70] → β=Max{0,811;0,25}=0,811.
VEd0(Pu)=3,216MN → **V'Ed0=0,311+3,216=3,527MN**.

**§3 VRd,c** : ρl=0,008, k=1,33, vmin=0,268 → VRd,c1=0,601MN,
VRd,c2=0,372MN. V'Ed0=3,527MN et VEd=4,277MN > les deux → armatures
nécessaires. Vérif complémentaire 0,5.bw.d.ν.fcd=6,256MN > VEd O.K.

**§4.1 Inclinaison variable** (α=90°) : ν0=0,379 → cotgθ calculé=2,180 <
2,5 → **retenu cotgθ=2** (arrondi vers le bas, cf. politique de
formulas.md §4.1 — avec cotgθ=2,18 non arrondi, VRd,max=4,268MN <
VEd=4,277MN, la vérification échouerait de justesse ; avec cotgθ=2 retenu,
VRd,max=4,504MN > VEd O.K., confirmant qu'il faut arrondir cotgθ vers le
BAS, jamais vers le haut). Asw/s≥1/4,11cm²/cm (calcul de base) ; borne
max=1/1,28 O.K. ; ρw,min=1/16,67 O.K.

**§4.3 Vérification complémentaire (charge concentrée)** :
Asw/s≥V'Ed0/(0,75.av.fywd.sinα)=1/2,78cm²/cm — **plus contraignant** que
le calcul de base (1/4,11), donc gouverne le dimensionnement. Retenu :
3 cadres + 1 étrier φ12 HA (Asw=8×1,13=9,04cm²) → **s0=25cm**.
sl,max=138cm O.K., st,max=60cm, st réel=10,57cm O.K.

**§4.1bis Variante armatures inclinées (α=45°)** : cotgθ calculé=2,18 →
retenu cotgθ=2 également. VRd,max=6,76MN (nettement amélioré vs droites).
Asw/s de base=1/4,26cm²/cm ; condition charge concentrée
Asw/s≥1/1,96cm²/cm (plus contraignante) → 3 cadres+1 étrier φ12 HA
inclinés 45° : **s0=17cm**, ρw=1,0%. Illustre que l'inclinaison à 45°
améliore VRd,max mais ne réduit pas nécessairement l'espacement final
quand c'est la condition §4.3 qui gouverne.

**§9 Vérifications d'about** (armatures droites) : al=1,67m,
Al(travée)=112,56cm². As≥Max{28,14;98,62}=98,62cm² → 13φ32 conservés sur
appui (2 lits, As=104,52cm²). Ancrage forfaitaire donné par l'énoncé :
lbd=15.φ=96cm (alternative simplifiée du §9.2 de formulas.md). Bielle
d'about : sinθ=0,866 (θ=60,03°), σRd,1=7,92MPa < σRd,max=12,78MPa O.K.

## Application 3 — Poutre à talon (pont, leff=15m)
bw=35cm, h=1,70m, d=1,58m, cnom=3cm, talon 65×50cm, table b=2,60m sur
hf=16cm, 15φ32 en travée (3 lits de 5, dont 2 saillies de 3φ32 chacune :
As1=2×3φ32 côté talon). pu=271,71kN/m (charges réparties seules).
fck=25MPa, S500. Appareil d'appui 50×42cm → t=0,42m.

**§1-2** ln=leff-t=14,58m. VEd(nu)=1980,77kN=1,981MN,
VEd0(d)=1551,47kN=1,551MN.

**§3 VRd,c** : ρl=0,007 (Asl=5φ32=40,20cm², 1 lit), k=1,36, vmin=0,278 →
VRd,c1=0,234MN, VRd,c2=0,154MN. VEd0=1,551MN > les deux → armatures
nécessaires.

**§4.1 Inclinaison variable** (α=90°) : ν0=0,441 → cotgθ calculé=1,668 →
**retenu cotgθ=1,66** (dans la fourchette [1;2,5], simple troncature,
pas de risque de dépassement comme dans l'Application 2 car l'écart est
minime). VRd,max=1,984MN > VEd=1,981MN O.K. (marge très faible — bon
exemple pour illustrer qu'un arrondi vers le haut aurait fait échouer
cette vérification). Asw/s≥1/6,62cm²/cm ; borne max=1/2,75 O.K. ;
ρw,min=1/35,71 O.K. → retenu 1 cadre+1 étrier φ12 HA (Asw=4,52cm²) :
**s0=29cm**. sl,max=118,5cm O.K., st,max=60cm, st réel=11,7cm O.K.
[Remarque du document : la méthode standard θ=45° donnerait Asw/s≥1/3,99,
nettement plus contraignant, en cohérence avec la remarque du §4.2 de
formulas.md.]

**§9 Vérifications d'about** : al=1,18m, Al(travée)=120,60cm² (3 lits de
5). As≥Max{30,15;37,79}=37,79cm² → 5φ32 conservés sur appui (1 lit,
As=40,20cm²). Ancrage : lbd=100cm (calcul complet renvoyé à un autre
exercice du document source — considérer comme donnée dans ce cas de
test). Bielle d'about : sinθ=0,818 (θ=54,88°), σRd,1=8,46MPa <
σRd,max=12,78MPa O.K.

**§11 Talon de la poutre** : Δx=leff/4=3,75m. MEd(leff/2)=7641,84mkN,
MEd(Δx)=5731,38mkN < MTu=10,421mMN → rectangulaire largeur beff. μcu=0,053,
xu=10,7cm, Fcd=3,717MN=ΔF=Fs. As1/As=3/15=0,2 (3 barres en saillie sur 15
au total) → gEd=3,717×0,2/3,75=0,198MN/m. Armatures de liaison, cotgθf=1,5
(dans la fourchette [1;1,25] en membrure tendue — **remarque** : le
document source retient ici cotgθf=1,5, hors de la borne haute 1,25
indiquée par ailleurs pour la membrure tendue ; signaler cet écart si le
skill applique strictement la borne 1,25 et obtient un résultat différent
de ce cas de test) → Asf/sf≥1/27,46cm²/cm. Retenu 1 cadre φ12 HA
(Asf=2,26cm²) → sf calculé=62,06cm, mais **retenu sf=2.s0=58cm** pour
faciliter la mise en œuvre (cf. §11 de formulas.md).
