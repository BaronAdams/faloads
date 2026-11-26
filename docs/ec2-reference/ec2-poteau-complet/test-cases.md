# Cas de test — Paillé, *Calcul des structures en béton*, chap. 12 (Eyrolles 2013)

Rejouer : `python3 scripts/selftest.py` (39 vérifications, code retour 0 si tout est conforme). Les entrées sont dans
`scripts/examples/`. Comparaison faite avec les valeurs imprimées du livre et, pour les aciers, avec
une intégration indépendante des contraintes (parabole-rectangle) : les deux moteurs coïncident (MRd = MEd).

## Sommaire
1. Tableau livre / skill
2. Écarts attendus et leur origine
3. Erreurs relevées dans le livre
4. Limites et défauts connus

## 1. Tableau livre / skill

| Exemple | Donnée clé | Livre | Skill `ec2-poteau-complet` |
|---|---|---|---|
| 12.7.3.3 — 40×45, NEd = 3,38 MN, l0 = 1,40 m | compression centrée | 8,9 cm² | 9,5 cm² |
| | section sous NEd·2 cm | 9 cm²/face | 8,86 (plan y) ; 9,50 (plan z) cm²/face |
| | niveau 1 | — | porte fermée : λz = 12,1 > λlim = 10,2 (défaut). Porte désactivée : 4 HA16 + 2 HA12 (10,30 cm²), rejeté par e0 |
| | barres retenues | — | niveau 2 : 4 HA25 (19,63 cm²) |
| 12.7.3.4 — 35×60, NG 400, NQ 300, l0 = 5 m | M0Ed = NEd·2 cm | 0,198 (erreur) | 19,8 kN·m |
| | M2 ; MEd (courbure) | 33 ; 231 (erreur) | 48,3 ; 68,1 kN·m |
| | acier | 11 cm²/face (erreur) | As,min : 4 HA12 (4,52 cm²) |
| 12.7.3.6 — 42×65, NG 2,2, NQ 1,6 MN, l0 = 1,75 m | compression centrée | 18,8 cm² | 20,5 cm² |
| | flexion composée sous 2 cm | 19 cm²/face (18,7 + 1,9) | 17,08 (plan y) ; 14,47 (plan z) cm²/face |
| | 2nd ordre ; barres | dispense, 55 cm² (formule AN) | 17,44 cm²/face ; 4 HA32 + 2 HA14 (35,25 cm²) |
| 12.9.1 — mât 40×60, l0 = 8 m, rigidité | 8HA16 imposés (4+4) | EI 13,7 ; NB 2,11 ; MEd 46 | EI 14,0 ; NB 2,16 ; MEd 44,9 (mode vérification) |
| | dimensionnement | As = 0 | 4 HA14 (As,min = 4,8 cm² → 6,16 cm²) |
| 12.9.2 — 35×60, FQ = 250 kN à mi-hauteur | M0Ed ; M2 ; MEd | 490 ; 38,3 ; 527 | 488,6 ; 38,9 ; 527,4 kN·m |
| | acier | 39 + 19 = 58 cm² (asymétrique) | 33,8 cm²/face (symétrique, 67,6 cm²) ; 14 HA25 |
| 12.9.3 — mât 30×50, courbure | M0Ed ; M2 ; MEd | 171 ; 28,5 ; 199,5 | 171,4 ; 29,6 ; 201,0 kN·m |
| | rigidité (c0 = 12) | MEd = 190 à 196 | 192,2 kN·m |
| | acier | 8,1 cm² (face tendue seule) | 7,19 cm²/face (symétrique) ; 4 HA20 + 2 HA12 (14,83 cm²) |

Tous les exemples du livre ferment la porte d'entrée du niveau 1 (λ > λlim par défaut, ou moments réels) et démarrent au
niveau 2. Le niveau 1 est testé sur `ex_poteau_trapu.json` (40×40, l0 = 2,0 m, λ = 17,3 ≤ 18,3 : niveau 1 suffisant, 4 HA12
= As,min ; avec l0 = 3 m la porte se ferme) et, pour les valeurs de compression simple du livre, avec
`strict_level1_entry: false`.

Non testés (hors périmètre V1) : 12.9.4 (portique à nœuds déplaçables, formule 5.16) et 12.9.5 (méthode générale).

## 2. Écarts attendus et leur origine

- **Compression centrée 9,5 contre 8,9 cm²** : le skill `ec2-compression-simple` prend σs = 400 MPa (εc2 = 2 ‰) ;
  le livre prend 435 MPa. Même écart sur 12.7.3.6 (20,5 contre 18,8).
- **Ferraillage symétrique** : le skill dimensionne les deux faces à l'identique ; le livre et son logiciel admettent
  un ferraillage asymétrique. Le total est supérieur pour 12.9.2 (67,6 contre 58), inférieur par face pour 12.9.3.
- **Formule de l'annexe nationale** (12.7.3.6 : 55 cm²) : non implémentée ; ne pas comparer à ce chiffre.
- **Deux plans** : le livre ne justifie que le plan de flambement. Le skill justifie aussi l'autre plan (e0 = h/30 ou
  2 cm) : le besoin dans le plan z peut gouverner (12.7.3.6 : 14,47 cm²/face sur la face de 42 cm).
- **Répartition des barres en 2nd ordre par rigidité** : Is ne compte que les barres des nappes extrêmes. Avec 8HA16
  répartis 3 + 1 (au lieu de 4 + 4) : EI = 11,96, NB = 1,85, MEd = 54,9 (prudent).

## 3. Erreurs relevées dans le livre

- **12.7.3.4** : M0Ed écrit 0,198 MN·m au lieu de 0,0198 (= 990 kN × 0,02 m) ; e2 calculé avec c = 12 au lieu de 10 ;
  φef = 0,15 au lieu de 1,48. Conséquence : le livre aboutit à MEd ≈ 231 kN·m et 11 cm²/face ; avec les données
  corrigées MEd = 68 kN·m et As,min suffit (4 HA12 : MRd = 158 kN·m).
- **12.9.3** : concordance à 1 % près, sans erreur relevée.

## 4. Limites et défauts connus

Dans ce skill (V1) :
- section rectangulaire uniquement (la section circulaire avec moment n'est pas traitée) ;
- pas de portique à nœuds déplaçables (5.16), pas de méthode générale, pas de flexion déviée (5.8.9), pas de
  formule de l'annexe nationale, pas de poteaux en T/L ;
- ferraillage symétrique imposé ; barres intermédiaires ignorées dans MRd et Is ;
- N de calcul = N au pied pour toutes les sections ; ELS non vérifiés ;
- seuls les cas G / Q / W / S / T avec ψ0 / ψ2 ; pas de combinaison accidentelle ni sismique.

Dans le skill voisin `ec2-flexion-composee` (constatés pendant la mise au point, non corrigés par ce skill) :
- **αm sans racine carrée** (script ~l. 919 et `references/formulas.md` §14) : EC2 5.2(5) donne
  √(0,5·(1+1/m)). Pour m = 2, e_i = 0,0106 au lieu de 0,0123 (−13 %, non conservatif). Sans effet pour m = 1.
  L'orchestrateur calcule e_i lui-même avec la racine.
- pas d'option « acier imposé » pour le 2nd ordre (le skill itère sur l'acier requis) ; pas d'excentricité minimale
  automatique ; cas A conservatif d'environ 17 % (12.9.2 : 69,9 cm² contre 59,7 cm² de minimum exact).
