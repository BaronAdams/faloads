# Cas de test

Source du cas de référence : *Pratique de l'Eurocode 2*, chapitre 6
« Compression centrée », application « poteau – coffrage et armatures »
(p.166-174).

## Lancer la validation

```bash
python scripts/compression_ec2.py scripts/example_corrige_arrondis_livre.json   # arrondis du livre
python scripts/compression_ec2.py scripts/example_corrige.json                  # valeurs exactes
```

Le premier fichier force fcd = 16,7 MPa et fyd = 435 MPa (valeurs arrondies
du livre) : il sert à retrouver les chiffres du corrigé. Le second utilise
les valeurs exactes (fcd = 16,667 ; fyd = 434,78) : c'est ce que le skill fait
en usage réel.

## Cas 1 — Corrigé du cours (référence validée)

**Énoncé** : poteau sous plancher supérieur, NG = 1 390 kN, NQ = 1 000 kN,
poids propre négligé dans l'énoncé, l = 2,10 m, **poteau non intégré au
contreventement** (contreventé), encastré aux deux bouts (k1 = k2 = 0,10),
largeur imposée b = 40 cm, béton C25/30, acier S500, cnom = 3 cm.
Demandé : coffrage, armatures longitudinales et transversales, recouvrement.

### Valeurs attendues (corrigé) et résultats du skill

| Grandeur | Corrigé | Skill, arrondis livre | Skill, exact |
|---|---|---|---|
| fcd (MPa) | 16,7 | 16,7 | 16,67 |
| fyd (MPa) | 435 | 435 | 434,8 |
| σs = Es.εc2 (MPa) | 400 | 400 | 400 |
| NEd sous plancher (kN) | 3 377 | 3 376,5 | 3 376,5 |
| l0 (m) | 1,24 | 1,241 | 1,241 |
| λ = l0.√12/b | 10,74 | 10,75 | 10,75 |
| n (poteau carré 40×40) | 1,26 | 1,264 | 1,266 |
| λlim provisoire (A=0,7 ; B=1,1 ; C=0,7) | 9,60 | 9,59 | 9,58 |
| Ac requis (m²) | 0,1633 | 0,1631 | 0,1634 |
| h calculé (cm) | 41 | 40,78 | 40,84 |
| **h retenu (cm)** | **45** | **45** | **45** |
| Poids propre ELU (kN) | 13 | 12,76 | 12,76 |
| NEd de calcul (kN) | 3 390 | 3 389 | 3 389 |
| Fc = Ac.fcd (kN) | 3 010 | 3 006 | 3 000 |
| Fs = NEd − Fc (kN) | 380 | 383 | 389 |
| As calculée (cm²) | 9,50 | 9,58 | 9,73 |
| As,min (cm²) | 7,79 | 7,79 | 7,80 |
| As,max (cm²) | 72 | 72 | 72 |
| **Armatures retenues** | **4 HA20** | **4 HA20** | **4 HA20** |
| As,prov (cm²) | 12,56 | 12,57 | 12,57 |
| ω | 0,182 | 0,182 | 0,182 |
| B = √(1+2ω) | 1,17 | 1,168 | 1,168 |
| n final (avec p.p.) | 1,128 | 1,127 | 1,130 |
| λlim final | 10,80 | 10,78 | 10,77 |
| **λ ≤ λlim ?** | **10,74 < 10,80 O.K.** | **OK** | **OK** |
| **φt (mm)** | **8** | **8** | **8** |
| scl,t,max (mm) | 400 | 400 | 400 |
| **Espacement courant** | **40 cm** | **40 cm** | **40 cm** |
| fctm / fctk,0,05 / fctd (MPa) | 2,56 / 1,79 / 1,19 | 2,565 / 1,796 / 1,197 | idem |
| fbd (MPa) | 2,68 | 2,693 | 2,693 |
| σsd (MPa) | 303 | 305 | 310 |
| lb,rqd / φ | 28,26 | 28,3 | 28,8 |
| α4 ; α6 | 1 ; 1,5 | 1 ; 1,5 | 1 ; 1,5 |
| l0 recouvrement brut (cm) | 84,78 | 84,9 | 86,3 |
| **l0 recouvrement retenu** | **85 cm** | **85 cm** | **90 cm** (arrondi 5 cm sup.) |
| Espacement nappes de recouvrement | 14 cm | 14 cm | 15 cm |
| Trou central entre groupes | 21 cm | 21 cm | 22 cm |
| Nappes | 2 × (3+1) cadres HA8 | 2 × (3+1) | 2 × (3+1) |
| Positions (cm) depuis le début du recouvrement | 4 – 18 – 32 – 53 – 67 – 81 (schéma p.174) | **identiques** | 4 – 19 – 34 – 56 – 71 – 86 |

### Critères de réussite
- **Décisions identiques au corrigé** : h = 45 cm, 4 HA20, φt = 8 mm, e = 40 cm
  en zone courante, recouvrement 3+1 nappes par extrémité en cadres HA8.
- **Le run « arrondis livre » retrouve le corrigé** : l0 = 85 cm, nappes à
  14 cm, trou de 21 cm, positions du schéma p.174.
- **Le run « exact » diffère de 1 à 3 %** à cause des arrondis du livre
  (As : 9,73 vs 9,50 cm² soit +2,4 % ; σsd : 310 vs 303 MPa ; l0 recouvrement :
  86,3 vs 84,8 cm, d'où 90 cm après arrondi à 5 cm). Ces écarts sont attendus
  et à **expliquer à l'utilisateur** s'il compare ; ils ne signalent pas un
  bug. Le sens de l'écart est sécuritaire (le livre arrondit fcd vers le haut).
- Le verdict de λ doit reproduire l'histoire du corrigé : **provisoire** au
  coffrage (10,75 > 9,58) puis **validé** en fin de calcul (10,75 < 10,77).
- Vérifications en plus du corrigé (doivent passer) : NEd ≤ NRd
  (3 389 ≤ 3 503 kN, taux 0,97), ΣAst = 6,03 cm² ≥ As(φ20) = 3,14 cm².

### Points d'écart volontaires avec le corrigé (à connaître)
- Le skill ajoute le contrôle **NEd ≤ NRd** (formule [6.6]) que le corrigé
  n'écrit pas.
- Le skill ajoute la zone de **nœud** (e ≤ 0,6.scl,t,max = 24 cm → 20 cm),
  que le corrigé ne dessine pas.
- Le skill vérifie **ΣAst ≥ As** dans le recouvrement.
- Le skill ajoute le poids propre au moment du calcul des armatures, comme le
  corrigé, mais ne réitère pas le coffrage.

## Cas de régression du script (non issus du cours)

Ces cas figent le comportement du script ; ils ne sont **pas validés par le
livre**. Entrées communes sauf indication : NG = 1 390 kN, NQ = 1 000 kN,
l = 2,10 m, k1 = k2 = 0,10, C25/30, S500, cnom = 30 mm.

| Cas | Particularité | Résultat attendu |
|---|---|---|
| R1 | Section **circulaire**, diamètre non imposé | Ø50 cm (a_calc = 45,6 cm), NEd = 3 390 kN, As,min gouverne (2,95 < 7,80) → 4 HA16 (8,04 cm²), λ = 9,93 < λlim = 10,61, NEd/NRd = 0,94, recouvrement 35 cm, avertissement « As,min gouverne » |
| R2 | 40×40 imposé, NG = 300, NQ = 150 | Fs < 0 → As = As,min = 3,20 cm² → 4 HA12, note « béton seul suffit », λ = 10,75 < 21,4 |
| R3 | **Non contreventé** (5.16), b = 40 imposé | l0 = 2,572 m (facteur 1,225), λ = 22,3 > λlim = 10,77 → **échec de λ** + avertissement « hors compression centrée », le script dimensionne quand même |
| R4 | l = 1,00 m (poteau court) | l/h = 2,2 < 3 → échec « l/h ≥ 3 » (calcul en voile) : le skill doit **arrêter** et le dire |
| R5 | Acier **S400** | σs = fyd = 347,8 MPa (l'acier plastifie avant εc2), As = 11,19 cm² → 4 HA20, mais λ = 10,75 > λlim = 10,48 → **échec de λ** |
| R6 | NG = 900, NQ = 600, section 35×35 imposée, φ16 imposé | 14 < φ < 20 → au moins 3 nappes, portées à **4** pour que ΣAst = 2,26 cm² ≥ As(φ16) = 2,01 cm² ; l0 recouvrement 25 cm, nappes à 62 mm (l'échec de λ sur ce cas est sans importance pour ce test) |
| R7 | NG = 3 500, NQ = 2 500, section 60×60 imposée, φ32 imposé, cnom = 40 mm | 8 HA32 (64,34 cm²), l0 recouvrement 175 cm, 10 nappes dont **4 intermédiaires** (le trou central de 1 022 mm dépasse 0,6.scl,t,max = 240 mm) |

## Tests qualitatifs (comportement attendu du skill)

1. **Demande complète** : « dimensionne un poteau 40×… sous NG = 1390 kN et
   NQ = 1000 kN, l = 2,10 m, C25/30, S500 » → pas de formulaire si tout est
   fourni ; sinon formulaire limité aux champs manquants ; résultat = note
   de calcul + schéma.
2. **Donnée manquante bloquante** (cnom, contreventement, l0) → question
   ciblée, jamais de valeur devinée en silence ; les hypothèses posées sont
   listées en fin de note (ex. k = 0,10).
3. **Hors périmètre** : moment fléchissant donné (flexion composée),
   poteau élancé (λ > λlim), poteau court (voile) → le skill le dit
   explicitement et ne présente pas le résultat comme valide.
4. **Fichier joint** (plan, descente de charges) → en extraire NG, NQ, l,
   section avant de poser des questions.
