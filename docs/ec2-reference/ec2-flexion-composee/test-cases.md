# Cas de test

Source des 3 cas de référence : *Pratique de l'Eurocode 2*, chap. 11 « Flexion composée », applications
n° 1 à 3 (p. 487-508). Le cas C (section comprimée) n'a pas d'exemple corrigé dans les sources : il est validé
par le support de cours (tableau ψ/δG, formules) et par un calcul indépendant.

## Lancer la validation

```bash
python scripts/selftest.py                                   # 0 échec attendu
python scripts/flexion_composee_ec2.py scripts/example_1_arrondis_livre.json   # rejoue les chiffres du livre
python scripts/flexion_composee_ec2.py scripts/example_1_exact.json            # valeurs exactes (usage réel)
```

Chaque exemple existe en deux versions : `*_arrondis_livre.json` (fcu = 16,7 ; fyd = 435 ; fctm = 2,56 ; μlu du
livre imposé par `mu_lu_override`) et `*_exact.json` (fcd = 16,667 ; fyd = 434,78 ; μlu recalculé).

## Cas 1 — Flexion-compression, section partiellement tendue (Ex. 1)

Poteau 24 × 55 cm, l = 6 m (articulé en pied / encastré en tête, l0 = 4,24 m), structure contreventée,
M01/M02 = 1/3, C25/30, S500 palier horizontal, XD2, αe = 15, d = 50, d' = 5.
NG = 85 kN, MG = 90 kN·m, NQ = 75 kN, MQ = 80 kN·m. Barres du livre : 3 HA16 (haut), 6 HA16 (bas).

| Grandeur | Livre | Skill, arrondis livre | Skill, exact |
|---|---|---|---|
| NEd (kN) / e0 (m) | 227,25 / 1,074 | 227,25 / 1,074 | 227,25 / 1,073 |
| M_EdA / M_serA (kN·m) | 295,20 / 206,08 | 295,2 / 206,0 | 295,0 / 206,0 |
| λ plan h / plan b / λlim | 28,08 / 60,57 / 65,74 | — | 26,72 / 61,24 / 65,49 |
| μcu, νu | 0,295 ; 0,113 | 0,295 ; 0,113 | 0,295 ; 0,114 |
| γM, γN | 1,432 ; 1,42 | 1,433 ; 1,42 | 1,432 ; 1,42 |
| **μlu** | **0,231** | 0,231 (imposé) | **0,2348** |
| σs2,e (MPa) | 246 | 246,3 | 246,1 |
| **As2 (cm²)** | **5,75** | **5,75** | **5,44** |
| A_s1 flexion simple (cm²) | 15,54 | 15,53 | 15,58 |
| **As1 = A_s1 − N/σ (cm²)** | **10,32** | **10,31** | **10,35** |
| As,min non requise / requise (cm²) | 1,68 / 1,22 | 1,68 / 1,22 | 1,68 / 1,22 |
| σct non fissuré (MPa) | −8,7 | −8,64 | −8,64 |
| x1 (m) / K (MN/m³) | 0,223 / 63,54 | 0,223 / 63,51 | 0,223 / 63,51 |
| **σc ELS (MPa)** | **14,16** | **14,16** | **14,16** |
| **σs1 ELS (MPa)** | **264** | **263,9** | **263,9** |

Lecture : avec le μlu du livre le skill retrouve le corrigé (5,75 / 10,32). L'écart « exact » vient de μlu : les
valeurs de table imprimées dans l'Ex. 1 sont décalées d'une ligne de γN (voir `formulas.md` §10) ; la valeur
exacte 0,2348 est plus proche de μcu ⇒ As2 plus petit. Le ferraillage 3 HA16 + 6 HA16 du livre reste valable.
Recoupement du moteur d'interaction (parabole-rectangle) avec ces barres : M_Rd = 331,9 kN·m ≥ 295,0 (utilisation 0,89).

## Cas 2 — Flexion-traction, section partiellement tendue (Ex. 2)

Section 50 × 50, d = 45, d' = 5, C25/30, S500, XD2. NG = −200 kN, MG = 80 kN·m, NQ = −160 kN, MQ = 60 kN·m.
Maîtrise de la fissuration non requise. Barres du livre : 4 HA20 + 4 HA12 en nappe basse (17,08 cm²), As2 = 0.

| Grandeur | Livre | Skill, arrondis livre | Skill, exact |
|---|---|---|---|
| e0 (m) | −0,388 | −0,388 | −0,388 |
| M_EdA / M_serA (kN·m) | 96 / 68 | 96 / 68 | 96 / 68 |
| γM, γN, νu | 1,412 ; 1,42 ; 0,136 | 1,412 ; 1,417 ; −0,136 | idem |
| μcu | 0,057 | 0,0568 | 0,0569 |
| μlu | 0,227 | 0,227 (imposé) | 0,2299 (νu < 0) |
| zc (m) | 0,435 | 0,4347 | 0,4346 |
| A_s1 flexion simple (cm²) | 5,07 | 5,08 | 5,08 |
| **As1 (cm²)** | **16,79** | **16,80** | **16,81** |
| As,min (cm²) | 3,30 | 3,29 | 3,30 |
| σct non fissuré (MPa) | −6,9 | −6,33 | −6,33 (livre : M/AN erroné) |
| x1 (m) / K | 0,104 / 59,18 | 0,1051 / 59,29 | 0,1051 / 59,29 |
| σc ELS (MPa) | 6,15 | 6,23 | 6,23 |
| **σs1 ELS (MPa)** | **307** | **306,7** | **306,7** |

Recoupement moteur d'interaction : M_Rd = 101,3 ≥ 96 kN·m (utilisation 0,95).

## Cas 3 — Flexion-traction, section entièrement tendue (Ex. 3)

Section 30 × 60, d = 55, d' = 5, C25/30, S500. NG = NQ = −200 kN, MG = MQ = 20 kN·m. Barres du livre :
3 HA20 (bas, 9,42 cm²) + 3 HA14 (haut, 4,62 cm²).

| Grandeur | Livre | Skill, arrondis livre | Skill, exact |
|---|---|---|---|
| e0 (m) ; eA1, eA2 (m) | −0,10 ; 0,15, 0,35 | idem | idem |
| **As1 / As2 (cm²)** | **9,17 / 3,93** | **9,17 / 3,93** | **9,18 / 3,93** |
| Nf (MN) | −0,230 | −0,2304 | −0,2308 |
| As1,min / As2,min (cm²) | 3,23 / 1,38 | 3,23 / 1,38 | 3,23 / 1,39 |
| **σs1 / σs2 ELS (MPa)** | **297,3 / 259,7** | **297,2 / 259,7** | **297,2 / 259,7** |

## Cas 4 — Section comprimée (cas C), sans corrigé du livre

Rectangle 30 × 50, d = 45, d' = 5, C25/30, S500, χ = 1 (armatures symétriques).

| Fichier | NEd ; MEdG0 | Résultat attendu |
|---|---|---|
| `example_4_comprimee_pivotC.json` | 3 200 kN ; 100 kN·m | pivot C (ξh = 1,349), Asc = As = 14,03 cm² ; ψ = 0,9266, δG = 0,4717, λ = 0,6208, σs = 195,1 MPa ; formules du cours = moteur à 1e-4 ; barres proposées 16,08 cm² par nappe : utilisation 0,956 |
| `example_5_comprimee_region2b.json` | 2 300 kN ; 200 kN·m | région 2b (d < x ≤ h), Asc = As = 10,34 cm² |
| `example_6_bascule_A_vers_C.json` | 2 000 kN ; 150 kN·m | e0 ≥ e_o,lim mais As1 ≤ 0 en flexion simple équivalente ⇒ bascule vers C, Asc = As = 4,10 cm² |

## Second ordre (λ > λlim) — méthodes de la rigidité et de la courbure nominales

Source : *Maîtrise de l'Eurocode 2*, J. Roux, chap. « Instabilité de forme – Flambement » (§6, §7 et leurs
applications n° 2, 3, 4 — l'application n° 1, méthode générale/équilibre, itérative sans formule fermée,
n'est pas implémentée). Les formules `rigidite_M2()` et `courbure_M2()` sont validées isolément (avec les
armatures données par le livre à chaque itération) avant d'être bouclées par `apply_second_order()`.

Fichiers : `app2_rigidite.json` (méthode rigidité), `app3_courbure.json` (méthode courbure, même poteau),
`app4_courbure_fluage.json` (méthode courbure, fluage recalculé via φ(∞,t0), imperfections par la formule θi).

### Poteau carré 40×40, l0=12 m (encastré-pied/libre-tête), NEd=0,300 MN, e0=9,6 cm, C25/30, φef=2 donné

| Grandeur | Livre (formule isolée, mêmes données) | Skill |
|---|---|---|
| λ / λlim (φef inconnu) | 104 / 32,2 | idem |
| **Rigidité**, avec As=24,26 cm²/face : EI / NB / β / MEd | 8,392 MNm² / 0,575 MN / 1,234 / 103 kNm | 8,394 / 0,575 / 1,234 / 103,2 |
| **Courbure**, avec As=0, M0Ed=38 kNm (convention du livre, sans Δe0) : 1/r0 / Kr / Kφ / e2 / M2 / MEd | 0,0138 / 1,00 / 1,00 / 0,199 m / 59,7 kNm / 97,7 kNm | 0,01380 / 1,00 / 1,00 / 0,1988 / 59,6 / 97,6 |

Le skill boucle jusqu'à convergence (le livre s'arrête après 1-2 passes manuelles) :
- **Courbure** : converge en 2 itérations vers As1=As2≈4,05 cm²/face (M0Ed inclut Δe0 dès le départ, cf. écart
  documenté en `formulas.md` §16 — d'où un résultat un peu supérieur aux 3,99 cm² du livre, qui n'inclut Δe0
  qu'à l'entrée des abaques).
- **Rigidité** : converge en 14 itérations (oscillation initiale due à la discontinuité de Kc à ρ=0,01) vers
  As1=As2≈6,23 cm²/face — sensiblement plus que les 3,69 cm²/face retenus par le livre, qui ne revérifie pas
  l'EI avec l'armature finale (voir `formulas.md` §16). Ne pas s'étonner de l'écart : c'est la conséquence
  d'itérer jusqu'au bout plutôt que de s'arrêter à 2 passes.

### Poteau 30×30, l0=6,5 m (bi-articulé), NG=0,600 MN, NQ=0,300 MN, e01=0/e02=10 cm, C35/45, φ(∞,t0)=2

| Grandeur | Livre | Skill |
|---|---|---|
| ei (imperfections, formule θi générale) | 0,0127 m | 0,01275 m |
| M0Ed (1er ordre, avec Δe0) | 117 kNm | 116,9 kNm |
| φef recalculé = φ(∞,t0).M0Eqp/M0Ed | 0,615 | 0,616 |
| **Courbure**, avec As=16,15 cm²/face (pass 2 du livre) : Kr / Kφ / e2 / MEd | 0,842 / 1,015 / 0,0646 m / 198 kNm | 0,8424 / 1,0154 / 0,06466 / 198,5 |
| Skill, boucle complète : convergence en 4 itérations vers | — | As1≈As2≈16,16 cm²/face (≈ 16,15-16,39 du livre : ici la méthode converge bien, cohérent avec les 2 passes du livre) |

### Lancer

```bash
python scripts/flexion_composee_ec2.py scripts/app2_rigidite.json
python scripts/flexion_composee_ec2.py scripts/app3_courbure.json
python scripts/flexion_composee_ec2.py scripts/app4_courbure_fluage.json
```

Champs d'entrée dédiés au second ordre (bloc `slenderness`) : `method` (`"rigidite"` ou `"courbure"`, défaut
courbure), `phi_ef` (effectif, direct) ou `phi_inf_t0` (+ `NG_kN` et/ou `M0Eqp_kNm` pour le recalcul du ratio),
`c0` (rigidité, défaut 8), `c_curvature` (courbure, défaut 10), `n_bal` (défaut 0,40), `imperfection`
(`"l0/400"` par défaut, ou `"theta"` avec `l_m`/`m_elements`), `M0e_kNm` (moment équivalent 5.31, si calculé
à la main pour des moments d'extrémité différents), `second_order_As_start_cm2` (amorce de l'itération).
`options.second_order` : `"auto"` (défaut, applique la méthode dès que λ>λlim), ou `"none"` (revient à
l'ancien comportement : avertissement seul, pas de calcul).

## Re-vérification de l'élancement avec l'acier réel

Fichier `app5_dispense_invalidee.json` : poteau 30×60, l0 = 3,846 m (choisi pour tomber juste sous λlim avec
B = 1,1 par défaut), NEd = 700 kN, MEdG0 = 20 kN·m. Construit spécifiquement pour illustrer le cas signalé :
la dispense initiale (λ = 22,21 ≤ λlim = 22,32 avec B assumé 1,1) est accordée, mais l'acier réellement requis
(gouverné par As,min, très faible) donne ω = 0,052 → B réel = 1,051 → λlim réel = 21,32 < λ : la dispense est
retirée, le second ordre est appliqué rétroactivement, et le dimensionnement est refait avec le moment total
corrigé (`second_order` non nul dans la sortie, alors que le premier passage avait conclu λ ≤ λlim).

```bash
python scripts/flexion_composee_ec2.py scripts/app5_dispense_invalidee.json
```

Contre-exemple (pas de fausse alerte) : `example_1_exact.json` (poteau 24×55 du chapitre flexion composée)
a aussi un bloc `slenderness` et une dispense initiale à revérifier — ici l'acier réel (bien plus important,
As1+As2 ≈ 15,8 cm²) donne ω = 0,312 → B réel = 1,274 > 1,1 assumé : la dispense n'en est que **plus** confirmée
(`slenderness_recheck.ok = true`), aucun second ordre déclenché.

## Cas limites à connaître

- Armatures minimales gouvernantes en cas C (N grand, M faible) : le script n'affiche pas d'axe neutre
  (le point (N, M) est strictement à l'intérieur du domaine) — c'est voulu.
- `N = 0` : erreur, renvoyer vers `ec2-flexion-simple`. `fck > 50` : erreur. T avec hf > 3h/7 en cas C : erreur.
- Aucune armature ne suffit : erreur « augmenter b, h ou fck ».
- λ > λlim : avertissement (second ordre hors périmètre), calcul du 1er ordre seulement.
