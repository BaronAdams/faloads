# Modèle d'efforts personnalisables et schéma d'entrée

Ce document décrit comment placer les efforts sur le poteau et le JSON attendu par `scripts/poteau_complet_ec2.py`.
Unités : kN, kN·m, m pour les efforts et longueurs d'élément ; cm pour la section ; MPa pour les matériaux.

## Sommaire
1. Conventions (plans, signes, repère)
2. Mode « actions » — combinaisons automatiques
3. Mode « direct » — efforts ELU déjà combinés
4. Comment le script déduit M0Ed, rm et φef
5. Schéma complet (sections `section`, `geometry`, `materials`, `detailing`, `loads`, `options`)
6. Exemples

## 1. Conventions

- **Plan y** : plan de la dimension `h` (élancement λ = l0·√12/h ; excentricité minimale e0 = max(2 cm ; h/30)).
  **Plan z** : plan de la dimension `b` (λ = l0·√12/b ; e0 = max(2 cm ; b/30)). Les deux plans sont toujours justifiés.
- Effort normal **positif en compression**. Tout effort normal ≤ 0 (traction) est refusé.
- **Moments** : `top` = tête (z = l), `bottom` = pied (z = 0). Même signe aux deux extrémités = courbure simple
  (tension du même côté, rm > 0) ; signes opposés = double courbure (rm < 0).
- **z** = hauteur depuis le pied (m). Une charge transversale positive donne un moment positif dans le diagramme.
- L'effort normal de calcul est pris **au pied** (valeur maximale, poids propre compris) pour toutes les sections :
  choix prudent, le profil N(z) n'est pas exploité.

## 2. Mode « actions »

```json
"loads": {
  "mode": "actions",
  "self_weight": true,
  "actions": [
    { "name": "G étage", "category": "G", "N_kN": 400,
      "axial": [ {"z_m": 1.5, "N_kN": 100} ],
      "moments": { "y": {"top": 20, "bottom": -10}, "z": {"top": 5, "bottom": 5} },
      "eccentricity_m": { "y": 0.05 } },
    { "name": "Q exploitation", "category": "Q", "N_kN": 300, "psi0": 0.7, "psi2": 0.3,
      "moments": { "y": {"top": 40, "bottom": -20} } },
    { "name": "Vent", "category": "W", "psi0": 0.6, "psi2": 0,
      "transverse": [
        {"plane": "y", "type": "point",   "z_m": 2.5, "F_kN": 8},
        {"plane": "y", "type": "uniform", "q_kN_m": 2.0} ] }
  ]
}
```

| Champ | Sens |
|---|---|
| `category` | `G` permanente ; `Q` exploitation ; `W` vent ; `S` neige ; `T` température. ψ0/ψ2 par défaut : Q (0,7 ; 0,3), W (0,6 ; 0), S (0,5 ; 0), T (0,6 ; 0,5) — le script le signale en note, **à confirmer** |
| `N_kN` | effort normal appliqué en tête |
| `axial` | efforts normaux intermédiaires (hauteur `z_m`) : additionnés à la valeur au pied |
| `moments` | moments d'extrémité par plan (`y`, `z`), déjà issus d'une analyse de portique |
| `eccentricity_m` | excentricité de `N_kN` : ajoute M = N·e en tête **et** en pied (moment constant) |
| `transverse` | charges horizontales : `point` (F_kN à z_m) ou `uniform` (q_kN_m sur toute la hauteur), par plan |
| `self_weight` | poids propre du poteau (25 kN/m³·Ac·l), permanent, ajouté au pied. Défaut : `true` en mode actions |

**Combinaisons ELU** (EN 1990 éq. 6.10) : 1,35·ΣG + 1,5·Q_dominante + Σ 1,5·ψ0,j·Q_j, une combinaison par action
variable dominante (doublons supprimés). **Quasi permanente** : ΣG + Σψ2,j·Q_j (sert à φef). Chaque combinaison donne
un cas de calcul par plan ; le dimensionnement retient l'enveloppe.

**Schéma statique** (`geometry.static_scheme`) :
- `simple` (défaut si contreventé) : diagramme = droite (moments d'extrémité) + moment de poutre sur appuis simples des
  charges transversales. Pour un poteau de portique, donner les moments d'extrémité *finaux* de l'analyse.
- `console` (défaut si `braced: false`) : les charges transversales donnent un moment d'encastrement au pied
  (F·(z_charge − z)) ; les moments d'extrémité saisis s'y ajoutent.

## 3. Mode « direct »

```json
"loads": {
  "mode": "direct",
  "direct": {
    "NEd_kN": 3380,
    "self_weight": false,
    "y": { "M_top_kNm": 0, "M_bottom_kNm": 165, "M_mid_kNm": null },
    "z": { "M_top_kNm": 0, "M_bottom_kNm": 0 },
    "qp": { "N_kN": 1690, "y": { "M_top_kNm": 0, "M_bottom_kNm": 20 } }
  }
}
```
- `M_mid_kNm` : moment de 1er ordre à mi-hauteur s'il diffère de la moyenne des moments d'extrémité
  (charges transversales déjà intégrées). Il signale aussi que rm = 1.
- `qp` : effets quasi permanents (sans imperfection : le script ajoute N_qp·e_i). Sans `qp`, φef = φ(∞,t0) (prudent).
- `self_weight: true` ajoute 1,35·G_pp à NEd (et G_pp à N_qp).

## 4. Déduction de M0Ed, rm, φef

- Moments d'extrémité seuls, élément contreventé : M0Ed = M0e = max(0,6·M02 + 0,4·M01 ; 0,4·M02) (éq. 5.32),
  rm = M01/M02.
- Charges transversales **ou** élément non contreventé : M0Ed = max |M(z)| sur la hauteur ; rm = 1 (C = 0,7).
- Imperfection : e_i = max(θi·l0/2 ; 2 cm) avec θi = θ0·αh·αm, αm = √(0,5·(1 + 1/m)) (**racine carrée**, EC2 5.2(5)).
  M0Ed total = M0Ed + NEd·e_i (annexe nationale : 2 cm minimum).
- φef = φ(∞,t0)·M0Eqp/M0Ed, avec M0Eqp = M0(quasi permanent) + N_qp·e_i.

## 5. Schéma complet

```json
{
  "section":   { "b_cm": 40, "h_cm": 45, "dp_cm": 4, "type": "rect" },
  "geometry":  { "l_m": 2.10,
                 "l0_m": 1.40,  "l0y_m": null, "l0z_m": null,
                 "end_conditions": "articule_articule|encastre_articule|encastre_encastre|encastre_libre|encastre_guide",
                 "k1": 0.1, "k2": 0.1,
                 "braced": true, "static_scheme": "simple|console",
                 "l_total_m": 2.10, "m_elements": 1 },
  "materials": { "fck": 25, "fyk": 500, "phi_inf_t0": 2.4, "gamma_c": 1.5, "gamma_s": 1.15 },
  "detailing": { "cnom_mm": 30, "phi_t_mm": null, "phi_l_min_mm": 12, "phi_l_max_mm": 32, "dg_mm": 20,
                 "lap": true, "rho1": 100, "good_bond": true, "welded": false },
  "loads":     { "...": "voir §2 ou §3" },
  "options":   { "second_order_method": "courbure|rigidite", "c_curvature": 10, "n_bal": 0.4, "c0": 8,
                 "imperfection_min_m": 0.02, "imperfection_m": null,
                 "min_eccentricity_check": true, "strict_level1_entry": true }
}
```

- `l0` : priorité `l0y_m`/`l0z_m` > `l0_m` > `end_conditions` > `k1`/`k2` (5.15, contreventé seulement).
  Un poteau non contreventé de portique (5.16) est **refusé** : fournir l0.
- `dp_cm` : enrobage du centre des barres (d'). Absent : estimé par cnom + φt + φl/2, recalculé si le d' réel est plus grand.
- `strict_level1_entry` : `true` (défaut) = porte d'entrée stricte du niveau 1 (λ ≤ λlim par défaut, avant tout
  dimensionnement). `false` = le niveau 1 est tenté dès que les moments sont négligeables.
- `min_eccentricity_check` : `true` (défaut) fait de « section non justifiée sous NEd·e0 » un déclencheur du
  niveau 2 (voir SKILL.md). `false` applique la cascade littérale.
- Section circulaire, portique à nœuds déplaçables, `fck > 50` : refusés.

## 6. Exemples
Les fichiers `scripts/examples/ex_12_*.json` sont des entrées complètes (mode direct : 12.7.3.3 et 12.9.3 ;
mode actions : 12.7.3.4, 12.7.3.6, 12.9.1, 12.9.2 avec charge horizontale à mi-hauteur).
