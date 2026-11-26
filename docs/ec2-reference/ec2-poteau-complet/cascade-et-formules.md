# Cascade de dimensionnement et formules (EC2, poteau rectangulaire)

## Sommaire
1. Données de base et grandeurs communes
2. Niveau 1 — compression centrée
3. Niveau 2 — flexion composée du 1er ordre
4. Niveau 3 — flexion composée avec second ordre
5. Choix des barres, cadres, recouvrement
6. Règles de décision et pièges
7. Ce que le script délègue aux skills voisins

## 1. Grandeurs communes

| Grandeur | Formule |
|---|---|
| Élancement | λ = l0·√12 / dimension du plan (h en plan y, b en plan z) |
| Effort réduit | n = NEd / (Ac·fcd) |
| Excentricité minimale | e0 = max(2 cm ; dimension/30) — section justifiée sous (NEd ; NEd·e0), EC2 6.1(4) |
| Imperfection | θi = (1/200)·αh·αm ; αh = 2/√l ∈ [2/3 ; 1] ; αm = √(0,5(1+1/m)) ; e_i = max(θi·l0/2 ; 2 cm) |
| Élancement limite | λlim = 20·A·B·C/√n avec A = 1/(1+0,2·φef) (0,7 si φef inconnu), B = √(1+2ω) (1,1 si As inconnu), C = 1,7 − rm (0,7 si rm inconnu ou = 1) |
| ω | As·fyd / (Ac·fcd), As = section **totale** des barres retenues |
| φef | φ(∞,t0)·M0Eqp/M0Ed (imperfections incluses dans les deux moments) |
| As,min / As,max | max(0,10·NEd/fyd ; 0,002·Ac) / 0,04·Ac (0,08·Ac en zone de recouvrement) |

rm = 1 (donc C = 0,7) : élément non contreventé, ou moments du 1er ordre dus aux imperfections / charges
transversales. Sinon rm = M01/M02.

## 2. Niveau 1 — compression centrée

**Porte d'entrée stricte** — le niveau 1 n'est tenté que si les deux conditions sont réunies (deux plans, toutes les
combinaisons) :

- (a) tous les moments du 1er ordre ≤ NEd·e0 ;
- (b) λ ≤ λlim par défaut = 20·0,7·1,1·0,7/√n = 10,78/√n (A, B, C par défaut : φef, ω et rm encore inconnus).

Sinon : niveau 1 ignoré, départ au niveau 2 (l'acier est alors choisi au niveau 2 et le flambement revérifié avec ω réel).
La condition (b) est désactivable : `options.strict_level1_entry = false`.

1. Skill `ec2-compression-simple` : Fc = Ac·fcd ; Fs = NEd − Fc ; As = Fs/σs (σs = 400 MPa, εc2 = 2 ‰) ; As ≥ As,min.
2. Choix des barres (répartition équilibrée sur le périmètre).
3. **Revérification** avec l'acier réel : ω → B → λlim ; λ ≤ λlim dans les deux plans et toutes les combinaisons.
4. **Vérification de la section sous (NEd ; NEd·e0)** avec les barres retenues (MRd ≥ NEd·e0).
5. Les deux critères passent → fin au niveau 1. Sinon niveau 2.

## 3. Niveau 2 — flexion composée du 1er ordre

Pour chaque cas (combinaison × plan), sections justifiées, toujours avec M ≥ NEd·e0 :

| Section | Moment |
|---|---|
| tête | max(|M_tête| ; NEd·e0) |
| pied | max(|M_pied| ; NEd·e0) |
| critique (mi-hauteur, ou pied si mât) | max(M0Ed + NEd·e_i ; NEd·e0) |

Le besoin d'acier est l'**As par face minimal, ferraillage symétrique, tel que MRd(NEd) ≥ M** (moteur d'interaction
parabole-rectangle du skill `ec2-flexion-composee`, `RectEngine` ; εc2 = 2 ‰, εcu2 = 3,5 ‰, palier horizontal de
l'acier). On retient le max sur les sections, les combinaisons, pour chaque plan. Le script lance aussi le skill
`ec2-flexion-composee` (méthode du cours, cas A/B/C) sur la section la plus chargée → `fc_reference`.
Les barres sont choisies, puis le flambement est **revérifié** (ω du nouvel acier). Si λ ≤ λlim partout : fin.

## 4. Niveau 3 — second ordre

Pour chaque cas où λ > λlim avec l'acier courant, moment de la section critique :
M_Ed = M0Ed + NEd·e_i + M2, avec M2 fourni par le skill `ec2-flexion-composee` :

- **Courbure nominale** (5.8.8) : 1/r = Kr·Kφ·(1/r0) ; 1/r0 = εyd/(0,45·d) ; Kr = (nu − n)/(nu − nbal) ≤ 1 ;
  Kφ = 1 + β·φef ≥ 1 ; M2 = NEd·(1/r)·l0²/c (c = 10 par défaut).
- **Rigidité nominale** (5.8.7) : EI = Kc·Ecd·Ic + Ks·Es·Is ; NB = π²·EI/l0² ; MEd = M0Ed·[1 + β/(NB/NEd − 1)],
  β = π²/c0 (c0 = 8 par défaut). Is calculé sur les barres des deux faces extrêmes (les barres intermédiaires sont
  négligées : prudent).

Itération : on calcule M2 avec le **ferraillage réel** courant (plus d'acier → M2 plus faible), on recalcule le besoin,
on agrandit les barres si besoin, jusqu'à ce que le ferraillage retenu soit suffisant (≤ 25 itérations). Les
sections de tête et de pied restent justifiées au 1er ordre (pas de 2nd ordre aux extrémités). Un cas passé au 2nd
ordre le reste (pas d'oscillation).

## 5. Barres, cadres, recouvrement

- Disposition : 4 barres d'angle φc ; (k−2) barres intermédiaires φi ≤ φc sur chaque face b ; m barres
  intermédiaires φi sur chaque face h. Besoins par face : plan y → face b ; plan z → face h (les barres d'angle comptent
  dans les deux). Choix = section totale minimale (uniforme si ≤ +3 %), φ entre 12 et 32 mm par défaut,
  espacement libre ≥ max(φ ; dg+5 ; 20 mm). Épingles signalées si une barre intermédiaire est à plus de 150 mm d'une
  barre tenue.
- Cadres : φt = max(6 ; φl/3) arrondi commercial (≥ max(6 ; φl/4) EC2) ; espacement courant
  min(20·φl,min ; min(b,h) ; 400 mm) arrondi au 5 cm inférieur ; ×0,6 sur max(b,h) de part et d'autre des planchers
  et sur la longueur de recouvrement.
- Recouvrement : `lap_design` de `ec2-compression-simple` avec σsd = fyd·As,nec/As,prov (recouvrement proportionnel
  à la section nécessaire, annexe nationale) ; 3 nappes de cadres si φl > 14 mm.

## 6. Règles de décision et pièges

1. **Déclencheur e0 du niveau 2.** La vérification sous (NEd ; NEd·e0) est exigée par l'EC2 6.1(4) quel que soit λ.
   Sans elle, le niveau 1 sous-arme d'environ 35 à 50 % (12.7.3.3 : 10,3 cm² contre 19,6 cm² ; NEd = 3,0 MN : 8,0 contre
   12,6 cm²). Elle est donc un second déclencheur du niveau 2, pas seulement λ > λlim. Avec la porte stricte, elle ne
   joue que pour les poteaux qui passent le test préliminaire (ex. As,min gouverne : poteau trapu, niveau 1 suffisant).
   `options.min_eccentricity_check = false` restitue la cascade littérale (avec avertissement).
2. **rm d'un mât** : toujours 1 (C = 0,7). Prendre rm = M01/M02 = 0 pour un mât conclurait à tort « flambement négligeable ».
3. **αm avec racine carrée.** Le skill `ec2-flexion-composee` (version actuelle) l'écrit sans racine
   (−13 % sur e_i pour m = 2, non conservatif) : l'orchestrateur calcule lui-même θi et e_i.
4. **Ferraillage symétrique.** Les poteaux voient des moments réversibles. Les besoins sont donc des As par face
   identiques ; ils diffèrent des valeurs asymétriques du livre (12.9.3 : livre 8,1 cm² côté tendu seulement ; ici
   7,19 cm² sur chaque face, soit 14,4 cm² au total).
5. **Deux plans.** Chaque plan est justifié séparément. Des moments significatifs dans les deux plans déclenchent un
   avertissement : la flexion déviée (EC2 5.8.9) n'est pas vérifiée.
6. **Barres intermédiaires négligées** dans MRd et dans Is : résultat prudent.
7. **Annexe nationale française** (NRd = kh·ks·α·[b·h·fcd + As·fyd]) : non implémentée. Elle est beaucoup plus
   défavorable (55 cm² pour 12.7.3.6 contre 35 cm² ici) ; elle ne doit pas être mélangée aux résultats de ce skill.

## 7. Délégation aux skills voisins (aucune formule dupliquée)

| Étape | Skill / fonction |
|---|---|
| Niveau 1 : As, Fc, Fs | `ec2-compression-simple` → `compute()` |
| Barres, longueurs d'ancrage, cadres | `ec2-compression-simple` → `lap_design`, `next_commercial`, `bar_area`, `l0_frame` |
| Interaction N–M, MRd | `ec2-flexion-composee` → `RectEngine.capacity` |
| Matériaux, géométrie de section | `ec2-flexion-composee` → `materials`, `Geom` |
| Second ordre | `ec2-flexion-composee` → `courbure_M2`, `rigidite_M2` |
| Référence méthode du cours | `ec2-flexion-composee` → `run()` |

Si un des deux skills est introuvable, le script s'arrête avec un message explicite : ne pas improviser de calcul
parallèle. `EC2_SKILLS_ROOT` désigne le dossier qui les contient.
