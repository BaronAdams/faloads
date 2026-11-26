# Formules — flexion composée EC2

Sources : *Pratique de l'Eurocode 2*, chap. 11 « Flexion composée » (§1 à §5, applications 1-3) et le
support de cours « Chapitre VIII — Flexion composée, IV-6 Sections entièrement comprimées » (formules
sans abaques). Les numéros ci-dessous sont ceux de ce fichier.

Table des matières : §0 conventions · §1 matériaux · §2 sollicitations · §3 classification ·
§4 cas A (partiellement tendue) · §5 cas B (entièrement tendue) · §6 cas C (comprimée, sans abaques) ·
§7 As min/max · §8 ELS · §9 moteur d'interaction · §10 écarts relevés (flexion composée) ·
§12 second ordre — rigidité nominale · §13 second ordre — courbure nominale · §14 fluage et imperfections ·
§15 boucle de résolution du second ordre · §16 écarts relevés (second ordre) ·
§18 re-vérification de l'élancement avec l'acier réel · §19 schéma

## §0 — Conventions

- Compression positive. N > 0 compression, N < 0 traction. M_G0 = moment autour du CDG du béton seul.
- e0 = M_G0 / N (signe de N). Le centre de pression C est à la profondeur y_C = v'c − e0 depuis la fibre
  supérieure (v'c = h/2 pour un rectangle).
- M > 0 tend la fibre inférieure : As1 = nappe basse (tendue ou la moins comprimée), As2 = nappe haute
  (Asc dans le §6). Si M < 0, retourner la section (mêmes formules, nappes permutées).
- d = hauteur utile de As1, d' = distance de As2 au parement supérieur. δ' = d'/d, δh = d/h.
- Moment ramené aux aciers As1 : **M_A = M_G0 + N.(d − v'c)** (rectangle : d − h/2).
  À l'ELU M_EdA, à l'ELS M_serA.
- N/σ : N en valeur algébrique. Traction ⇒ la section d'acier augmente, compression ⇒ elle diminue.

## §1 — Matériaux

fck ≤ 50 MPa uniquement (λ = 0,8 ; η = 1).
fcd = fcu = αcc.fck/γc ; fyd = fyk/γs ; fctm = 0,3.fck^(2/3) ;
σc̄ = k1.fck (k1 = 0,6, limitée seulement pour XD, XF, XS) ; σs̄ = k3.fyk (k3 = 0,8) ;
fct,eff = fctm si maîtrise de la fissuration requise, sinon Max{(1,6 − h/1000).fctm ; fctm} (h en mm) ;
αe = Es/Ec,eff (donnée, 15 dans le livre) ; Es = 200 000 MPa ; εyd = fyd/Es.

## §2 — Sollicitations

ELU : NEd = 1,35.NG + 1,5.NQ ; Σ γj.Mj ; e1 = ΣγM / ΣγN ;
e0 = e1 + ei + Δe0 (ELU) ; M_EdG0 = NEd.e0.
ELS : Nser = NG + NQ ; M_serG0 = MG + MQ ; e0ser = M_serG0/Nser.

**Imperfections (compression seulement)** : élément isolé d'une structure contreventée → ei = l0/400 ;
ferraillage symétrique → Δe0 = Max{20 mm ; h/30}. (Cas général θi, ponts : non couverts.)

**Élancement** (5.13N) : i = √(I/Ac) (rectangle : h/√12 dans le plan de flexion, b/√12 dans l'autre),
λ = l0/i ; λlim = 20.A.B.C/√n avec A = 0,7 (φef inconnu), B = 1,1 (ω inconnu),
C = 1,7 − rm (0,7 si rm inconnu ; rm = M01/M02, 1 si non contreventé), n = NEd/(Ac.fcd).
- λ ≤ λlim dans le plan de flexion : pas de second ordre → flexion composée du 1er ordre (ce skill).
- λ > λlim : second ordre requis → **hors périmètre**, le dire.
- Autre plan λ ≤ λlim : compression simple dans ce plan (skill ec2-compression-simple).

## §3 — Classification (ELU)

1. N < 0 (traction) : C entre les nappes (d' ≤ y_C ≤ d) → **cas B** ; sinon → **cas A**.
2. N > 0 (compression) : e_o,lim = v'c − d' − 0,81.b.d.fcd.(0,416.d − d')/NEd.
   - e0 ≥ e_o,lim ⇒ x ≤ d (pivot B, région 2a) → **cas A**.
   - e0 < e_o,lim ⇒ x > d (pivot B région 2b ou pivot C région 3) → **cas C**.
3. **Bascule A → C** : si en cas A la section calculée As1 = A_s1 − N/σs1 est ≤ 0, alors x > d, les aciers
   sont tous comprimés et l'assimilation à la flexion simple n'est plus valable → traiter en cas C.

## §4 — Cas A : section partiellement tendue

**Principe** : mêmes déformations et même axe neutre qu'en flexion simple sous M_A, avec les sections
A_s1, A_s2 de la flexion simple. Puis **As2 = A_s2 ; As1 = A_s1 − N/σs1**.

1. M_A = M_G0 + N(d − v'c) ; bw.d.fcu ; **μcu = M_A/(b.d².fcu)** ; **νu = NEd/(b.d.fcu)** ;
   γM = M_EdA/M_serA ; γN = NEd/Nser.
   Section en T : MTu = beff.hf.fcu.(d − hf/2). Si M_A ≤ MTu → rectangle beff. Sinon
   M_EdR = M_A − (beff − bw).hf.fcu.(d − hf/2), N_EdR = NEd − (beff − bw).hf.fcu, calcul sur bw.d et
   **retrancher N_EdR/σs1 (pas NEd/σs1)**.
2. **μlu** (moment limite réduit) :
   - σc limitée (XD, XF, XS) : μlu(νu, γM, γN) est la valeur de μcu pour laquelle, avec As1 dimensionné à
     l'ELU (As2 = 0), la contrainte du béton à l'ELS atteint σc̄ (section fissurée sous (Nser, M_serA)).
     Le script le calcule **exactement** (`mu_lu_composee`) ; il reproduit les tableaux de l'annexe A3
     (S500, palier horizontal, fck = 25, αe = 15) au 4e chiffre. Ne pas interpoler à la main.
   - σc non limitée : μlu = μls = λ.αl.(1 − λ.αl/2), αl = εcu/(εcu + εyd) (≈ 0,3717 pour S500).
3. **μcu ≤ μlu** (As2 = 0) : αu = (1/λ)[1 − √(1 − 2μcu)] ; εs1 = εcu(1 − αu)/αu ; σs1 = fyd si εs1 ≥ εyd,
   sinon Es.εs1 ; zc = d(1 − 0,6.μcu) si μcu ≤ 0,225, sinon d(1 − λ.αu/2) ; A_s1 = M/(zc.σs1).
4. **μcu > μlu** (As2 ≠ 0) : Mlu = μlu.b.d².fcu ;
   A = 0,5/αe + 13 ; B = 6517/αe + 1 (S500, palier horizontal, fck ≤ 35 MPa, γs = 1,15) ;
   σs2,e = k1.αe.γM.fck − δ'.(A.fck + B) ; σs1,e = (A.fck + B) − k1.αe.γM.fck ≤ fyd ;
   As2 = (M − Mlu)/[(d − d').σs2,e] ;
   αu et zc issus de μlu ; A_s1 = Mlu/(zc.σs1,e) + As2.σs2,e/σs1,e ; σs1 = σs1,e.
   (Hors domaine des formules → σ = fyd par sécurité, signalé.)
5. **As1 = A_s1 − N/σs1** (cm²) ; As1 ≥ As,min (§7) ; As1, As2 ≤ 0,04.Ac.

## §5 — Cas B : section entièrement tendue

C entre les nappes. eA1 = d − y_C (distance à As1), eA2 = y_C − d', zA = eA1 + eA2.
À l'ELU (palier horizontal, σs = fyd) :
**As1 = |N|.eA2/(zA.fyd) ; As2 = |N|.eA1/(zA.fyd)** (la nappe la plus proche de C prend le plus d'effort).
Section minimale : effort normal de fissuration **Nf = Ac.I.fctm/(Ac.e0ser.v − I)** (v = distance du CDG à la fibre
inférieure, e0ser < 0) ; As1,min = |Nf|.eA2/(zA.fyk) ; As2,min = |Nf|.eA1/(zA.fyk).
ELS : σs1 = |Nser|.eA2/(zA.As1) ; σs2 = |Nser|.eA1/(zA.As2) ≤ σs̄ (eA avec e0ser).

## §6 — Cas C : section comprimée (x > d), sans abaques

Diagramme parabole-rectangle EC2 (n = 2, εc2 = 2 ‰, εcu2 = 3,5 ‰), aciers élasto-plastiques (palier horizontal).
Le palier de contrainte fcd s'arrête à la profondeur 3h/7 (pivot C) ou 3x/7 (pivot B).

**Région 3 (pivot C, x > h)** — ξh = x/h :
- λ = 4/(7.ξh − 3) ; **ψ = 1 − (4/21).λ²** (coefficient de remplissage, Fc = ψ.b.h.fcd) ;
  **δG = (0,5 − (8/49).λ²)/(1 − (4/21).λ²)** (profondeur du CDG des contraintes, en fraction de h) ;
  éliminer λ² : **δG = 0,857 − 0,357/ψ**.
- Déformation à la profondeur y : ε(y) = 2 ‰ · [1 − λ.(7y/h − 3)/4].
- Aciers tendus/moins comprimés : **σs = 100.(4 + 3λ − 7.δh.λ) ≤ fyd** (MPa) ; aciers comprimés
  σsc = fyd si ξh ≤ 5,36 − 11,49.δ'h (B500, δ'h = d'/h).
- Équilibre : **NEd = ψ.b.h.fcd + Asc.σsc + As.σs** ;
  **M_EduA = ψ.b.h.fcd.(d − δG.h) + Asc.σsc.(d − d')**.
- Décomposition en deux sections fictives : M1 = M_EduA − Asc.fyd.(d − d') = b.h².fcd.ψ.(δh − δG)
  ⇒ **μdu,h = M1/(b.h².fcd) = 0,357 + ψ.(δh − 0,857)** ⇒ ψ = (μdu,h − 0,357)/(δh − 0,857) ;
  λ = √(21/4.(1 − ψ)) = 2,291.√(1 − ψ) ; puis σs ; **As = [NEd − ψ.b.h.fcd − Asc.fyd]/σs**.
- Bornes : Asc1 = [M_EduA − b.h.fcd.(d − h/2)]/[fyd.(d − d')] (x → ∞) ;
  Asc2 = [M_EduA − b.h.fcd.(0,81.d − 0,337.h)]/[fyd.(d − d')] (x = h) ;
  pivot C ⇔ Asc1 ≤ Asc ≤ Asc2 ; Asc < Asc1 : augmenter b, h ou fck ; Asc > Asc2 : région 2b.
  Asc2 − Asc1 = (0,19.δh − 0,163).b.h².fcd/[fyd.(d − d')] ≈ 2,07.10⁻⁵.b.h².fcd pour d = 0,9h : intervalle très
  faible ⇒ en pivot C, Asc est presque imposée par M.
- Critère de dimensionnement (l'équilibre a 2 équations pour 3 inconnues x, As, Asc) :
  **rapport χ = As/Asc imposé** (défaut χ = 1 : armatures symétriques, comme les abaques), ou Asc imposée,
  ou As imposée. Avec χ : **Asc = (NEd − ψ.b.h.fcd)/(fyd + χ.σs)** et As = χ.Asc, μdu,h à faire coïncider.

**Région 2b (pivot B, d < x ≤ h)** : mêmes équilibres avec ψ = 0,8095 et δG.h = 0,416.x (bloc
parabole-rectangle complet) ; σs = 700.(ξ − 1)/ξ (ξ = x/d, compression) ; ξ ≈ 1,20.(1 − √(1 − 2,06.μuA)),
μuA = [M_EdA − Asc.fyd.(d − d')]/(b.d².fcd) ; As = [NEd − Asc.fyd − (M_EdA − Asc.fyd.(d − d'))/z]/σs ;
z = d.(1 − 0,416.ξ).

**Section en T** : si hf ≤ 3h/7 la table est entièrement sous fcd → calcul sur bw.h avec
N_ur = NEd − (beff − bw).hf.fcd ; M_urA = M_EduA − (beff − bw).hf.fcd.(d − hf/2). Sinon non couvert.

**Résolution retenue dans le script** : le moteur d'interaction (§9) cherche la plus petite armature telle que
**M_Rd,A(N = NEd) ≥ M_EdA** — équivalent à l'équilibre du cours quand l'armature est requise (M_Rd = M_Ed), et
sûr quand les armatures minimales gouvernent. Le script recoupe ensuite les formules ci-dessus
(`book_crosscheck` : μdu,h, δG, λ, σs, Asc à 1e-4 près) dès que x > h.

## §7 — Armatures minimales et maximales

**Cas A** : As1 ≥ As,min = Max{0,26.(fct,eff/fyk).bt.d ; 0,0013.bt.d} (9.1N). Si la maîtrise de la fissuration
est requise (calcul rigoureux, cours §2.3.2) : rectangle, e0 = e0ser signé,
**As,min = 0,23.(fctm/fyk).bw.d.(e0 − 0,45.d)/(e0 − 0,185.d)** (suppose d ≈ 0,9.h) ;
T : As,min = Ac.(fctm/fyk).I/(0,9.d).(e0 − v' + 0,1.d)/(Ac.e0.v − I). Section entièrement comprimée
(0 < e0 ≤ ρ.v', ρ.v' = h/6 pour un rectangle) : minimum des pièces comprimées.
As1, As2 ≤ 0,04.Ac.
**Cas B** : §5 (Nf). **Cas C** (9.12N) : As,min = Max{0,10.NEd/fyd ; 0,002.Ac} ≤ As,tot ≤ 0,04.Ac
(0,08.Ac en zone de recouvrement).

## §8 — ELS

**Section homogène non fissurée** : Ach = Ac + αe.(As1 + As2) ; v' = [Ac.v'c + αe.(As1.d + As2.d')]/Ach ; v = h − v' ;
Ich = bw.h³/3 + (beff − bw).hf³/3 + αe.(As1.d² + As2.d'²) − Ach.v'² ;
M_AN = Nser.(e0ser − v'c + v') (e0ser **signé comme Nser**) ;
σct = Nser/Ach − M_AN.v/Ich (fibre inférieure) ; σc = Nser/Ach + M_AN.v'/Ich ;
σs1 = αe.[Nser/Ach − M_AN.(d − v')/Ich] ; σs2 = αe.[Nser/Ach + M_AN.(v' − d')/Ich].
Fissurée si σct < −fct,eff.

**Section fissurée** (béton tendu négligé) : c = y_C = d − eA (eA = M_serA/Nser signé). Rectangle :
x_c³ + p.x_c + q = 0, p = −3c² + 6αe.As2/b.(d' − c) + 6αe.As1/b.(d − c),
q = −2c³ − 6αe.As2/b.(d' − c)² − 6αe.As1/b.(d − c)² ; x1 = x_c + c (doit vérifier x1 ≤ d) ;
Icf = b.x1³/3 + αe.As2.(x1 − d')² + αe.As1.(d − x1)² ; K = Nser.x_c/Icf ;
σc = K.x1 ≤ σc̄ (XD/XF/XS) ; σs1 = αe.K.(d − x1) ≤ σs̄ ; σs2 = αe.K.(x1 − d').
Le script résout l'équilibre par racine numérique (rectangle et T), équivalent à la cubique.

**Cas C** : σc,max = Nser/Ach + M_serG.v'/Ich ≤ σc̄ ; C dans le noyau central (σct ≥ 0) sinon fissurée.

## §9 — Moteur d'interaction (compatibilité des déformations)

Rectangle b × h, aciers Asc (à d') et As (à d), x = profondeur de l'axe neutre :
strain : εtop = 3,5 ‰ si x ≤ h, sinon 2 ‰.x/(x − 3h/7) ; ε(y) = εtop.(x − y)/x.
Bloc : p = 3x/7 (x ≤ h) ou 3h/7 ; H = min(x, h) ; L = H − p ; λ = L/(x − p) ;
Fc = b.fcd.[p + L.(1 − λ²/3)] ; premier moment M0 = b.fcd.[p²/2 + p.L.(1 − λ²/3) + L².(1/2 − λ²/4)].
N_int = Fc + Asc.σsc + As.σs ; M_A = Fc.(d − yc) + Asc.σsc.(d − d').
Capacité : pour NEd donné, x tel que N_int = NEd (monotone), puis M_Rd,A.
Validé contre une intégration numérique par tranches et contre le tableau ψ/δG du cours (ξh de 1 à 5).

## §10 — Écarts relevés dans les sources (à signaler à l'utilisateur)

| Où | Source | Constat | Effet |
|---|---|---|---|
| Support de cours, δG | « 1 − 4/24.λ² » | coquille : c'est **4/21** (le tableau du cours n'est retrouvé qu'avec 4/21) | aucun (le script utilise 4/21) |
| Support de cours | λ = 2,294.√(1 − ψ) | √(21/4) = **2,2913** | < 0,2 % |
| Livre, Ex. 1, μlu | table lue avec γN = 1,40/1,45 | valeurs qui correspondent en réalité à γN = 1,45/1,50 (décalage d'une ligne) ; μlu exact = **0,2348** et non 0,231 | As2 = 5,44 cm² au lieu de 5,75 |
| Livre, Ex. 1, νu | « νu = 0,13 » | le calcul d'interpolation utilise 0,113 (coquille d'écriture) | aucun |
| Livre, Ex. 1, élancement | i = 0,55/√12 « = 0,151 » | 0,55/√12 = **0,1588** ⇒ λ = 26,7 (et non 28,08) | aucun (λ ≪ λlim) |
| Livre, Ex. 2, μlu | tableau du cas compression utilisé en traction (νu = +0,14) | valeur exacte pour νu = −0,136 : 0,2299 (vs 0,227) | aucun (μcu ≪ μlu) |
| Livre, Ex. 2, ELS non fissuré | M_ser/AN = 0,147 (e0 pris positif) | avec e0 signé : Nser.(e0 − v'c + v') = 0,1333 ⇒ σct = −6,33 MPa (vs −6,9) | conclusion inchangée (fissurée) |
| Livre, Ex. 2, μlu table | ligne γN = 1,42 : « 2 484 » | interpolation correcte ≈ 2 404 ; le résultat 2 294 utilise 2 484 | aucun |
| Livre, Ex. 1, x1 / K | arrondis d'itération | x1 = 0,223 identique ; Ex. 2 : x1 = 0,104 (livre) vs 0,1051 | σc = 6,15 vs 6,23 MPa |

## §12 — Second ordre : méthode de la rigidité nominale (EC2 5.8.7)

Source : *Maîtrise de l'Eurocode 2*, J. Roux, chap. « Instabilité de forme – Flambement », §6. S'applique aux
poteaux isolés et aux ossatures quand λ > λlim (§2). Amplifie le moment du 1er ordre par un facteur lié à la
charge critique d'Euler évaluée avec une rigidité **nominale** (fissurée, pas la rigidité brute).

**Rigidité nominale** : $EI = K_c.E_{cd}.I_c + K_s.E_s.I_s$, avec $E_{cd}=E_{cm}/\gamma_{cE}$ ($\gamma_{cE}=1{,}2$,
$E_{cm}=22000.((f_{ck}+8)/10)^{0{,}3}$), $I_c$ = inertie du béton seul (section brute), $I_s = 2.A_{s,face}.(h/2-d')^2$
(armatures symétriques, deux nappes), $\rho=A_{s,tot}/A_c$ :
- $0{,}002 \le \rho < 0{,}01$ (ou $\rho$ pas encore connu) : $K_s=1$, $K_c = k_1.k_2/(1+\varphi_{ef})$,
  $k_1=\sqrt{f_{ck}/20}$, $k_2=\min(n.\lambda/170\,;\,0{,}20)$ ($n=N_{Ed}/(A_c.f_{cd})$, $\lambda=l_0/i$).
- $\rho \ge 0{,}01$ : $K_s=0$, $K_c = 0{,}3/(1+0{,}5.\varphi_{ef})$.
  (Le livre re-sélectionne la branche selon le $\rho$ **réel** à chaque itération manuelle ; le script fait de même.)

**Moment total** : $N_B=\pi^2.EI/l_0^2$ (nécessite $N_B>N_{Ed}$, sinon la rigidité est insuffisante) ;
$$M_{Ed}=M_{0Ed}\left(1+\dfrac{\beta}{N_B/N_{Ed}-1}\right),\qquad \beta=\dfrac{\pi^2}{c_0}$$
$c_0$ : 8 (moment du 1er ordre constant, cas par défaut d'un poteau isolé), 9,6 (parabolique), 12 (triangulaire
symétrique). $M_{0Ed}$ = moment du 1er ordre **incluant** $e_i$ et, pour une section symétrique, $\Delta e_0$
(même convention que la classification A/B/C — voir §2 et la remarque du §13).

## §13 — Second ordre : méthode de l'estimation de la courbure (EC2 5.8.8)

Source : même ouvrage, §7. S'applique aux éléments isolés à effort normal constant. Fixe l'excentricité du
second ordre de façon forfaitaire via une courbure nominale.

$$M_{Ed}=M_{0Ed}+M_2,\qquad M_2=N_{Ed}.e_2,\qquad e_2=\dfrac{l_0^2}{c}.\dfrac1r$$
$c$ = 8 (courbure constante) ou $\approx\pi^2\approx10$ (déformée sinusoïdale — cas par défaut, tous les
exemples du cours l'utilisent, y compris pour un mât à moment constant).

$$\frac1r = K_r.K_\varphi.\frac1{r_0},\qquad \frac1{r_0}=\frac{\varepsilon_{yd}}{0{,}45.d},\qquad
K_r=\min\!\left(\frac{n_u-n}{n_u-n_{bal}}\,;\,1\right),\qquad K_\varphi=\max(1+\beta.\varphi_{ef}\,;\,1)$$

$n=N_{Ed}/(A_c.f_{cd})$, $n_u=1+\omega$ ($\omega=A_{s,tot}.f_{yd}/(A_c.f_{cd})$), $n_{bal}=0{,}40$ (valeur
forfaitaire EC2, section rectangulaire symétrique S500), $\beta=0{,}35+f_{ck}/200-\lambda/150$ ($\lambda=l_0/i$).

## §14 — Fluage effectif φef et imperfections (méthodes du second ordre)

$$\varphi_{ef}=\varphi(\infty,t_0).\dfrac{M_{0Eqp}}{M_{0Ed}}$$
$\varphi(\infty,t_0)$ = coefficient de fluage final (donnée matériau/âge de mise en charge, hors périmètre de
calcul ici) ; $M_{0Eqp}$ = moment de service du 1er ordre sous la combinaison **quasi permanente**
($\approx N_G.e_{0e}$, **sans** $e_i$ ni $\Delta e_0$ — ce sont des majorations ELU, absentes de la combinaison
quasi permanente ; $\psi_2.N_Q$ négligé par défaut faute de donnée) ; $M_{0Ed}$ = moment ELU du 1er ordre
(avec $e_i$, $\Delta e_0$). On peut négliger le fluage ($\varphi_{ef}=0$) si $\varphi(\infty,t_0)\le2$,
$\lambda\le75$ et $M_{0Ed}/N_{Ed}\ge h$ simultanément. Si $\varphi_{ef}$ n'est pas connu du tout,
$\varphi_{ef}=2$ est une hypothèse par défaut usuelle (à confirmer) — **utilisée aussi**, telle quelle, dans le
test d'élancement (§2) pour le coefficient $A=1/(1+0{,}2\varphi_{ef})$, y compris quand $\varphi_{ef}$ est
ensuite affiné par le ratio ci-dessus pour $K_c$/$K_\varphi$ (le cours fait cette même distinction : le
$\varphi(\infty,t_0)$ brut sert au test précoce d'élancement, le $\varphi_{ef}$ affiné sert à la rigidité/courbure).

**Imperfections géométriques**, deux formules équivalentes (EC2 §5.2) :
- Cas courant (poteau isolé contreventé) : $e_i=l_0/400$ (déjà utilisé en §2 sans second ordre).
- Cas général : $\theta_i=\theta_0.\alpha_h.\alpha_m$, $\theta_0=1/200$,
  $\alpha_h=\text{clamp}(2/\sqrt l\,;\,2/3\,;\,1)$ ($l$ = hauteur de l'élément ou du bâtiment),
  $\alpha_m=0{,}5.(1+1/m)$ ($m$ = nombre d'éléments verticaux), $e_i=\theta_i.l_0/2$.

Moment équivalent pour extrémités à moments différents (§6.4/(5.31), valable pour les deux méthodes) :
$$M_{0e}=\max(0{,}6.M_{02}+0{,}4.M_{01}\,;\,0{,}4.M_{02}),\quad M_{02}\ge M_{01}\text{ en valeur algébrique}$$
($c_0=8$ reste recommandé dans ce cas pour la méthode de la rigidité). Le script accepte un $M_{0e}$
précalculé (`slenderness.M0e_kNm`) en remplacement de $M_{0Ed}$ dans les formules de second ordre uniquement.

## §15 — Boucle de résolution du second ordre (choix du script, au-delà du cours)

$EI$ (rigidité) et $\omega$/$n_u$ (courbure) dépendent de l'armature, qui elle-même dépend du moment total —
c'est circulaire. Le cours résout ce problème **à la main en 1 ou 2 passes** (une section d'aciers de départ
arbitraire, un calcul, une vérification). Le script **itère jusqu'à convergence** (armature symétrique
$A_{s,face}=\max(A_{s1},A_{s2})$ obtenue par le moteur cas A/B/C en entrée de l'itération suivante, jusqu'à
stabilisation à ±2 % ou 0,03 cm²), ce qui est plus rigoureux qu'un arrêt après 2 passes — voir l'écart avec le
livre noté au §16 (méthode de la rigidité, discontinuité de $K_c$ à $\rho=0{,}01$).

## §16 — Écarts relevés (second ordre, à ajouter à §10)

| Où | Constat | Effet |
|---|---|---|
| Livre, App. « vérification par la courbure » (poteau carré) | $M_{0Ed}$ utilisé dans $M_{Ed}=M_{0Ed}+M_2$ **exclut** $\Delta e_0$ (ajouté seulement plus tard, à l'entrée des abaques) | Contredit la remarque générale du §1.2.3 (« $e_i$ et $\Delta e_0$ doivent être ajoutés à l'excentricité du 1er ordre ») et l'exemple « dimensionnement par la courbure » (qui, lui, inclut $\Delta e_0$ dans $M_{0Ed}$ dès le départ). Le script suit la règle générale (et cet autre exemple) : $\Delta e_0$ est inclus dans $M_{0Ed}$ dès la première itération, pour les deux méthodes. |
| Livre, méthode de la rigidité, exemple carré | Les 2 passes manuelles ne convergent pas : la 2e passe (As=24,26 cm²/face → EI grand → M­Ed=103 kNm → As=3,69 cm²/face) ne revérifie pas l'EI avec ce nouvel As, alors que 3,69 cm² (ρ=0,46 %) tombe dans l'**autre branche** de $K_c$ (ρ<0,01), qui donne un EI bien plus faible et donc un moment bien plus grand | Une itération complète (comme celle du script) converge vers ≈ 6,2 cm²/face — nettement plus que les 3,69 cm² retenus tels quels par le livre. Le script signale cette discontinuité via son historique d'itérations ; ne pas retenir 3,69 cm²/face sans vérifier la convergence. |

## §18 — Re-vérification de l'élancement avec l'acier réel

$A$, $B=\sqrt{1+2\omega}$ et $C$ de $\lambda_{lim}=20.A.B.C/\sqrt n$ (§2) ont des valeurs par défaut
**uniquement parce que l'acier n'est pas encore connu au moment du premier test** ($A=0{,}7$ si $\varphi_{ef}$
inconnu, $B=1{,}1$ si $\omega$ inconnu, $C=0{,}7$ si $r_m$ inconnu). Une fois le dimensionnement fait, $\omega$
(donc $B$) est calculable exactement à partir de la section d'acier réellement requise — et rien ne garantit
que $B_{réel} \ge 1{,}1$ : une section faiblement armée (souvent parce que $A_{s,min}$ gouverne) donne
$\omega_{réel} < 0{,}105$, donc $B_{réel}<1{,}1$, donc $\lambda_{lim,réel} < \lambda_{lim}$ utilisé pour la
dispense initiale. **La dispense initiale doit donc être reconfirmée avec le $B$ réel.**

Le script fait cela automatiquement, une seule fois, après le premier dimensionnement (utilisé uniquement
quand la dispense a été accordée sans second ordre) :
$$\omega_{réel}=\frac{A_{s,tot,requis}.f_{yd}}{A_c.f_{cd}},\qquad B_{réel}=\sqrt{1+2\omega_{réel}},\qquad
\lambda_{lim,réel}=\frac{20.A.B_{réel}.C}{\sqrt n}$$
($A_{s,tot,requis}$ = acier requis avant arrondi aux barres commerciales — un arrondi ne peut qu'augmenter
$\omega$, donc ne peut qu'aider la dispense ; utiliser le requis est donc le choix côté sécurité). $A$, $C$, $n$
restent ceux du premier calcul (ils ne dépendent pas de l'acier).
- **$\lambda \le \lambda_{lim,réel}$** : dispense confirmée, le dimensionnement du 1er ordre reste valable.
- **$\lambda > \lambda_{lim,réel}$** : la dispense n'était pas justifiée. Le script applique alors le second
  ordre rétroactivement (méthode par défaut ou choisie par l'utilisateur) et **refait entièrement** le
  dimensionnement avec le moment total corrigé — le premier dimensionnement (armatures, ELS, checks) est
  écarté, pas juxtaposé.

Ce mécanisme ne s'applique jamais si le second ordre était **déjà** déclenché dès le premier passage (aucune
raison de « annuler » un second ordre déjà appliqué : plus d'acier ne peut que renforcer la conclusion qu'il
fallait le calculer, jamais l'inverse). Il ne s'applique pas non plus en traction ($N<0$, pas de flambement).

Sortie : `slenderness_recheck` (`As_total_used_cm2`, `omega_real`, `B_assumed`, `B_real`, `lambda_lim_real`,
`ok`), absent du résultat si non applicable (pas de bloc `slenderness`, $N<0$, ou second ordre déjà déclenché).

## §19 — Schéma de ferraillage

Coupe transversale à l'échelle (module `diagram` de `mcp__visualize`) : contour béton, nappe tendue As1 en bas
et nappe comprimée As2 en haut (cercles), cotes b, h, d, d', cadres schématiques en pointillé (l'effort
tranchant n'est pas dimensionné ici). Barres aux positions retenues ; avertissement enrobage/espacement en
orange si applicable. Ne pas redécrire le schéma en texte.
