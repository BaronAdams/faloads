#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
poteau_complet_ec2.py — Dimensionnement complet d'un poteau rectangulaire en béton armé, Eurocode 2.

Orchestrateur : il n'invente aucune formule nouvelle. Il importe les scripts des skills voisins
  • ec2-compression-simple  (compression centrée : As, recouvrement, cadres)
  • ec2-flexion-composee    (moteur d'interaction parabole-rectangle, méthodes du 2nd ordre : rigidité / courbure)
et enchaîne la cascade de dimensionnement décrite dans SKILL.md :

  Niveau 1  porte d'entrée stricte (moments ≤ NEd·e0 ET λ ≤ λlim par défaut) → compression centrée
            (sans vérifier la flexion composée) → choix des barres → revérification du flambement avec l'acier réel
  Niveau 2  flexion composée du 1er ordre (NEd ; M = max(M1er ordre ; NEd·max(2 cm ; h/30)))
  Niveau 3  flexion composée avec second ordre (courbure ou rigidité nominale)

Unités : kN, kN·m, m (longueurs d'élément), cm (section), cm² (aciers), MPa.
Usage :  python poteau_complet_ec2.py entree.json [-o sortie.json]
"""
import argparse
import importlib.util
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL_DIR = os.path.dirname(HERE)


# ------------------------------------------------------------------ chargement des skills voisins
def _skill_dir(name):
    roots = []
    if os.environ.get("EC2_SKILLS_ROOT"):
        roots.append(os.environ["EC2_SKILLS_ROOT"])
    roots += [os.path.dirname(SKILL_DIR), "/mnt/skills/plugins", "/mnt/skills/user",
              "/mnt/skills/examples", "/mnt/skills/public"]
    for r in roots:
        p = os.path.join(r, name)
        if os.path.isdir(os.path.join(p, "scripts")):
            return p
    raise FileNotFoundError(
        "Skill dépendant introuvable : %s. Il doit se trouver à côté de ec2-poteau-complet "
        "(ou dans le dossier indiqué par la variable d'environnement EC2_SKILLS_ROOT)." % name)


def _load(alias, skill, script):
    path = os.path.join(_skill_dir(skill), "scripts", script)
    spec = importlib.util.spec_from_file_location(alias, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


CS = _load("ec2_compression_simple", "ec2-compression-simple", "compression_ec2.py")
FC = _load("ec2_flexion_composee", "ec2-flexion-composee", "flexion_composee_ec2.py")

GAMMA_G, GAMMA_Q = 1.35, 1.5
RHO_BA = 25.0
PSI_DEFAULT = {"Q": (0.7, 0.3), "W": (0.6, 0.0), "S": (0.5, 0.0), "T": (0.6, 0.5)}   # (ψ0, ψ2) par catégorie
PLANES = ("y", "z")      # y : plan de la dimension h (λ = l0·√12/h) ; z : plan de la dimension b


# ------------------------------------------------------------------ utilitaires
def ceil_div(x, y):
    return int(math.ceil(x / y - 1e-9))


# ------------------------------------------------------------------ 1. Effets des actions et combinaisons
def _new_plane():
    return {"Mtop": 0.0, "Mbot": 0.0, "trans": []}


def _new_effect():
    return {"N_top": 0.0, "N_base": 0.0, "y": _new_plane(), "z": _new_plane()}


def _add_scaled(dst, src, k):
    dst["N_top"] += k * src["N_top"]
    dst["N_base"] += k * src["N_base"]
    for p in PLANES:
        dst[p]["Mtop"] += k * src[p]["Mtop"]
        dst[p]["Mbot"] += k * src[p]["Mbot"]
        for t in src[p]["trans"]:
            t2 = dict(t)
            for key in ("F", "q"):
                if key in t2:
                    t2[key] = k * t2[key]
            if abs(t2.get("F", t2.get("q", 0.0))) > 1e-12:          # charge d'intensité nulle : ignorée
                dst[p]["trans"].append(t2)


def action_effect(a, l):
    """Effets d'une action caractéristique (compression positive). Voir SKILL.md pour le schéma."""
    e = _new_effect()
    n_top = float(a.get("N_kN", 0.0))
    axial = sum(float(x["N_kN"]) for x in a.get("axial", []))
    e["N_top"], e["N_base"] = n_top, n_top + axial
    for p in PLANES:
        m = (a.get("moments") or {}).get(p, {})
        e[p]["Mtop"] = float(m.get("top", 0.0))
        e[p]["Mbot"] = float(m.get("bottom", 0.0))
        ecc = float((a.get("eccentricity_m") or {}).get(p, 0.0))
        if ecc:
            e[p]["Mtop"] += n_top * ecc
            e[p]["Mbot"] += n_top * ecc
    for t in a.get("transverse", []):
        p = t.get("plane", "y")
        if t.get("type", "point") == "point":
            e[p]["trans"].append({"type": "point", "z": float(t["z_m"]), "F": float(t["F_kN"])})
        else:
            e[p]["trans"].append({"type": "uniform", "q": float(t["q_kN_m"])})
    return e


def _direct_effect(d, l, sw_kN=0.0, sw_factor=1.0):
    eff = _new_effect()
    eff["N_top"] = eff["N_base"] = float(d.get("NEd_kN", d.get("N_kN", 0.0)))
    for p in PLANES:
        dp = d.get(p, {})
        eff[p]["Mtop"] = float(dp.get("M_top_kNm", 0.0))
        eff[p]["Mbot"] = float(dp.get("M_bottom_kNm", 0.0))
        if dp.get("M_mid_kNm") is not None:
            # moment mi-hauteur imposé (charges transversales déjà intégrées) : représenté par une charge
            # transversale ponctuelle équivalente à mi-hauteur (appuis simples)
            lin_mid = 0.5 * (eff[p]["Mtop"] + eff[p]["Mbot"])
            extra = float(dp["M_mid_kNm"]) - lin_mid
            if abs(extra) > 1e-9:
                eff[p]["trans"].append({"type": "point", "z": l / 2.0, "F": 4.0 * extra / l})
    eff["N_base"] += sw_factor * sw_kN
    return eff


def build_combinations(loads, Ac_cm2, l, warn, notes):
    """Retourne (liste des combinaisons ELU, combinaison quasi permanente) sous forme d'effets combinés."""
    mode = loads.get("mode") or ("direct" if "direct" in loads else "actions")
    if mode == "direct":
        d = loads["direct"]
        sw = RHO_BA * Ac_cm2 / 1e4 * l if d.get("self_weight") else 0.0
        elu = _direct_effect(d, l, sw, GAMMA_G)
        qp = _direct_effect(d["qp"], l, sw, 1.0) if d.get("qp") else None
        return [{"name": "ELU (effets donnés directement)", "eff": elu}], qp

    # ---- mode "actions" : combinaisons automatiques
    gG = float(loads.get("gamma_G", GAMMA_G))
    gQ = float(loads.get("gamma_Q", GAMMA_Q))
    acts = []
    for a in loads.get("actions", []):
        cat = str(a.get("category", "Q")).upper()
        psi0, psi2 = PSI_DEFAULT.get(cat, (0.7, 0.3))
        user0, user2 = a.get("psi0"), a.get("psi2")
        if cat != "G" and (user0 is None or user2 is None):
            notes.append("Action « %s » (%s) : ψ0/ψ2 par défaut (%.2f ; %.2f) — à confirmer selon la catégorie "
                         "d'usage (EN 1990 tableau A1.1)." % (a.get("name", "?"), cat,
                                                              psi0 if user0 is None else user0,
                                                              psi2 if user2 is None else user2))
        acts.append({"name": a.get("name", cat), "cat": cat, "psi0": psi0 if user0 is None else float(user0),
                     "psi2": psi2 if user2 is None else float(user2), "eff": action_effect(a, l)})
    sw_on = loads.get("self_weight", True)
    if isinstance(sw_on, dict):
        sw_on = sw_on.get("include", True)
    if sw_on:
        sw_eff = _new_effect()
        sw_eff["N_base"] = RHO_BA * Ac_cm2 / 1e4 * l
        acts.append({"name": "Poids propre du poteau", "cat": "G", "psi0": 1.0, "psi2": 1.0, "eff": sw_eff})
    G = [a for a in acts if a["cat"] == "G"]
    Q = [a for a in acts if a["cat"] != "G"]
    combos = []

    def combine(coefs):
        eff = _new_effect()
        for a, k in coefs:
            _add_scaled(eff, a["eff"], k)
        return eff

    if not Q:
        combos.append({"name": "ELU — permanentes seules", "eff": combine([(a, gG) for a in G])})
    else:
        seen = []
        for lead in Q:
            coefs = [(a, gG) for a in G] + [(lead, gQ)] + [(a, gQ * a["psi0"]) for a in Q if a is not lead]
            eff = combine(coefs)
            sig = json.dumps(eff, sort_keys=True)
            if sig in seen:
                continue
            seen.append(sig)
            combos.append({"name": "ELU — %s dominante" % lead["name"], "eff": eff})
    qp = combine([(a, 1.0) for a in G] + [(a, a["psi2"]) for a in Q])
    return combos, qp


# ------------------------------------------------------------------ 2. Moments du 1er ordre
def moment_profile(pl, l, scheme, n=101):
    zs = [l * i / (n - 1) for i in range(n)]
    out = []
    for z in zs:
        M = pl["Mbot"] + (pl["Mtop"] - pl["Mbot"]) * z / l
        for t in pl["trans"]:
            if scheme == "console":
                M += t["F"] * max(t["z"] - z, 0.0) if t["type"] == "point" else t["q"] * (l - z) ** 2 / 2.0
            else:
                if t["type"] == "point":
                    a = t["z"]
                    M += t["F"] * (l - a) * z / l if z <= a else t["F"] * a * (l - z) / l
                else:
                    M += t["q"] * z * (l - z) / 2.0
        out.append(M)
    return zs, out


def first_order(eff, plane, l, scheme, braced, N, ei):
    """Grandeurs de 1er ordre d'un plan : moments d'extrémité, M0Ed du 2nd ordre (5.32 ou max), rm."""
    pl = eff[plane]
    zs, prof = moment_profile(pl, l, scheme)
    Mb, Mt = prof[0], prof[-1]
    Mmax = max(abs(x) for x in prof)
    has_t = any(abs(t.get("F", t.get("q", 0.0))) > 1e-12 for t in pl["trans"])
    if abs(Mt) >= abs(Mb):
        M02, M01 = Mt, Mb
    else:
        M02, M01 = Mb, Mt
    M01s = 0.0 if M02 == 0 else M01 * math.copysign(1.0, M02)
    M0e = max(0.6 * abs(M02) + 0.4 * M01s, 0.4 * abs(M02))
    if braced and not has_t:
        M0 = M0e
        rm = (M01s / abs(M02)) if (M02 != 0 and abs(M02) > N * ei) else 1.0
        basis = "M0e = max(0,6·M02 + 0,4·M01 ; 0,4·M02) (éq. 5.32)"
    else:
        M0 = Mmax
        rm = 1.0
        basis = "max |M(z)| sur la hauteur (charges transversales ou élément non contreventé)"
    return {"Mtop": Mt, "Mbot": Mb, "Mmax": Mmax, "M02": M02, "M01s": M01s, "M0": M0, "rm": rm,
            "has_transverse": has_t, "basis": basis}


# ------------------------------------------------------------------ 3. Section : moteur d'interaction
class Ctx:
    pass


def engine(ctx, plane):
    dim, wid = ctx.planes[plane]["dim"], ctx.planes[plane]["wid"]
    return FC.RectEngine(wid / 100.0, dim / 100.0, (dim - ctx.dp) / 100.0, ctx.dp / 100.0,
                         ctx.mat["fcd"], ctx.mat["fyd"])


def mrd(ctx, plane, N_kN, As_layer_cm2):
    """Moment résistant (kN·m, autour du CDG) sous N, avec As_layer sur chacune des deux faces."""
    eng = engine(ctx, plane)
    dim = ctx.planes[plane]["dim"] / 100.0
    d = (ctx.planes[plane]["dim"] - ctx.dp) / 100.0
    st = eng.capacity(N_kN / 1e3, As_layer_cm2 * 1e-4, As_layer_cm2 * 1e-4)
    if st is None:
        return None
    return (st["MA"] - (N_kN / 1e3) * (d - dim / 2.0)) * 1e3


def steel_sym_exact(ctx, plane, N_kN, M_kNm):
    """As minimal par face (cm²), ferraillage symétrique, tel que MRd(N) ≥ M. None si impossible."""
    f0 = mrd(ctx, plane, N_kN, 0.0)
    if f0 is not None and f0 >= M_kNm:
        return 0.0
    hi = 0.06 * ctx.Ac_cm2 / 2.0
    fh = mrd(ctx, plane, N_kN, hi)
    if fh is None or fh < M_kNm:
        return None
    lo = 0.0
    for _ in range(60):
        mid = 0.5 * (lo + hi)
        fm = mrd(ctx, plane, N_kN, mid)
        if fm is not None and fm >= M_kNm:
            hi = mid
        else:
            lo = mid
    return hi


# ------------------------------------------------------------------ 4. Élancement
def lam_lim_case(ctx, case, As_tot_cm2=None):
    n = case["N"] / 1e3 / (ctx.Ac_m2 * ctx.mat["fcd"])
    A = 1.0 / (1.0 + 0.2 * case["phi_ef"]) if case["phi_ef"] is not None else 0.7
    if As_tot_cm2 is None:
        B, omega = 1.1, None
    else:
        omega = As_tot_cm2 * 1e-4 * ctx.mat["fyd"] / (ctx.Ac_m2 * ctx.mat["fcd"])
        B = math.sqrt(1.0 + 2.0 * omega)
    C = 1.7 - case["rm"]
    lim = 20.0 * A * B * C / math.sqrt(n) if n > 0 else float("inf")
    return {"n": n, "A": A, "B": B, "C": C, "omega": omega, "lam_lim": lim}


# ------------------------------------------------------------------ 5. Second ordre (formules du skill flexion composée)
def geom(ctx, plane):
    dim, wid = ctx.planes[plane]["dim"], ctx.planes[plane]["wid"]
    return FC.Geom({"type": "rect", "b_cm": wid, "h_cm": dim, "d_cm": dim - ctx.dp, "dp_cm": ctx.dp})


def second_order_moment(ctx, case, layout):
    """Moment total (1er + 2nd ordre) au droit de la section critique, avec l'acier réel du layout."""
    g = geom(ctx, case["plane"])
    M0 = case["M0"] + case["N"] * case["ei"]
    phi_ef = case["phi_ef"] if case["phi_ef"] is not None else 2.0
    method = ctx.opts.get("second_order_method", "courbure").lower()
    tot = layout["As_prov"]
    if method == "rigidite":
        face = layout["layer_" + case["plane"]]
        info = FC.rigidite_M2(g, ctx.mat, case["N"], M0, face, phi_ef, case["l0"], case["lam"],
                              ctx.opts.get("c0", 8.0))
        ok = info["NB_gt_NEd"]
    else:
        info = FC.courbure_M2(g, ctx.mat, case["N"], M0, tot / 2.0, phi_ef, case["l0"], case["lam"],
                              ctx.opts.get("c_curvature", 10.0), ctx.opts.get("n_bal", 0.40))
        ok = info["n_lt_nu"]
    info = dict(info)
    info["method"] = method
    info["M0Ed_kNm"] = M0
    info["phi_ef_used"] = phi_ef
    info["stable"] = ok
    return info["MEd_kNm"], info


# ------------------------------------------------------------------ 6. Sections de calcul d'un cas
def case_sections(ctx, case, layout, second):
    """Liste des sections à justifier pour un cas (plan × combinaison)."""
    N = case["N"]
    floor = N * case["e0min"]
    secs = []
    secs.append({"name": "tête", "M": max(abs(case["Mtop"]), floor), "floor": abs(case["Mtop"]) < floor})
    secs.append({"name": "pied", "M": max(abs(case["Mbot"]), floor), "floor": abs(case["Mbot"]) < floor})
    crit_name = "section critique (mi-hauteur / pied)"
    M_first = case["M0"] + N * case["ei"]
    if second and layout is not None:
        Mtot, info = second_order_moment(ctx, case, layout)
        secs.append({"name": crit_name + " — avec 2nd ordre", "M": max(Mtot, floor), "floor": Mtot < floor,
                     "second_order": info})
    else:
        secs.append({"name": crit_name, "M": max(M_first, floor), "floor": M_first < floor})
    return secs


# ------------------------------------------------------------------ 7. Choix des barres
def choose_layout(ctx, face_y, face_z, As_tot_min, n_alt=4):
    """Disposition des barres : 4 barres d'angle φc, (k-2) barres intermédiaires φi sur chaque face b
    (faces du plan y), m barres intermédiaires φi sur chaque face h (faces du plan z), φi ≤ φc.
    Contraintes : acier par face ≥ besoins de chaque plan, As_tot ≥ As,min, As_tot ≤ 0,04·Ac,
    espacement libre ≥ max(φ ; dg+5 ; 20 mm). Retourne la liste triée (la plus économique d'abord)."""
    b, h = ctx.b, ctx.h
    cnom, phi_t, dg = ctx.cnom, ctx.phi_t_assumed, ctx.dg
    diams = [d for d in CS.LONG_DIAMS if ctx.phi_min <= d <= ctx.phi_max]
    cands = []
    for phc in diams:
        Ac = CS.bar_area(phc)
        e = cnom + phi_t + phc / 2.0
        a_min = max(phc, dg + 5.0, 20.0)
        span_b, span_h = b * 10.0 - 2 * e, h * 10.0 - 2 * e
        for phi in [d for d in diams if d <= phc]:
            Ai = CS.bar_area(phi)
            k = 2
            while True:
                ny = k - 2
                clear_b = span_b - phc if ny == 0 else span_b / (k - 1) - (phc + phi) / 2.0
                if clear_b < a_min:
                    break
                layer_y = 2 * Ac + ny * Ai
                if layer_y >= face_y - 1e-9:
                    m = 0
                    while True:
                        clear_h = span_h - phc if m == 0 else span_h / (m + 1) - (phc + phi) / 2.0
                        if clear_h < a_min:
                            break
                        layer_z = 2 * Ac + m * Ai
                        As = 4 * Ac + 2 * ny * Ai + 2 * m * Ai
                        if As > ctx.As_max:
                            break
                        if layer_z >= face_z - 1e-9 and As >= As_tot_min - 1e-9:
                            cc_b = span_b / (k - 1)
                            cc_h = span_h / (m + 1)
                            pins_b = [j for j in range(1, ny + 1) if min(j, ny + 1 - j) * cc_b > 150.0]
                            pins_h = [j for j in range(1, m + 1) if min(j, m + 1 - j) * cc_h > 150.0]
                            cands.append({"phi": phc, "phi_i": phi, "k": k, "m": m, "n": 4 + 2 * ny + 2 * m,
                                          "A_bar": Ac, "As_prov": As, "layer_y": layer_y, "layer_z": layer_z,
                                          "e_mm": e, "cc_b_mm": cc_b, "cc_h_mm": cc_h, "clear_b_mm": clear_b,
                                          "clear_h_mm": clear_h, "pins_b": pins_b, "pins_h": pins_h,
                                          "mixed": phi != phc,
                                          "cost": As * (1.03 if phi != phc else 1.0)})
                            break                    # m minimal suffisant pour ce (φc, φi, k)
                        m += 1
                k += 1
                if 2 * Ac + (k - 2) * Ai > ctx.As_max:
                    break
    cands.sort(key=lambda c: (round(c["cost"], 2), c["n"]))
    best, seen = [], set()
    for c in cands:
        if c["phi"] in seen:
            continue
        seen.add(c["phi"])
        best.append(c)
    return best[:max(n_alt, 3)]


def make_layout(ctx, bars, warn):
    """Ferraillage imposé par l'utilisateur : {"phi": φ angles, "phi_i": φ intermédiaires, "k": barres par face b
    (angles compris), "m": barres intermédiaires par face h}."""
    phc = float(bars["phi"])
    phi = float(bars.get("phi_i", phc))
    k, m = int(bars.get("k", 2)), int(bars.get("m", 0))
    if k < 2 or m < 0 or phi > phc:
        raise ValueError("ferraillage imposé incohérent : k ≥ 2, m ≥ 0 et φ intermédiaire ≤ φ d'angle.")
    Ac, Ai = CS.bar_area(phc), CS.bar_area(phi)
    ny = k - 2
    e = ctx.cnom + ctx.phi_t_assumed + phc / 2.0
    span_b, span_h = ctx.b * 10.0 - 2 * e, ctx.h * 10.0 - 2 * e
    clear_b = span_b - phc if ny == 0 else span_b / (k - 1) - (phc + phi) / 2.0
    clear_h = span_h - phc if m == 0 else span_h / (m + 1) - (phc + phi) / 2.0
    a_min = max(phc, ctx.dg + 5.0, 20.0)
    if min(clear_b, clear_h) < a_min:
        warn.append("Espacement libre entre barres insuffisant (%.0f mm < %.0f mm) pour le ferraillage imposé."
                    % (min(clear_b, clear_h), a_min))
    As = 4 * Ac + 2 * ny * Ai + 2 * m * Ai
    cc_b, cc_h = span_b / (k - 1), span_h / (m + 1)
    return {"phi": phc, "phi_i": phi, "k": k, "m": m, "n": 4 + 2 * ny + 2 * m, "A_bar": Ac, "As_prov": As,
            "layer_y": 2 * Ac + ny * Ai, "layer_z": 2 * Ac + m * Ai, "e_mm": e, "cc_b_mm": cc_b, "cc_h_mm": cc_h,
            "clear_b_mm": clear_b, "clear_h_mm": clear_h,
            "pins_b": [j for j in range(1, ny + 1) if min(j, ny + 1 - j) * cc_b > 150.0],
            "pins_h": [j for j in range(1, m + 1) if min(j, m + 1 - j) * cc_h > 150.0],
            "mixed": phi != phc, "cost": As, "imposed": True}


# ------------------------------------------------------------------ 8. Évaluation d'un layout
def evaluate(ctx, layout, flags, allow_second):
    """Vérifie un ferraillage sur tous les cas. flags : ensemble des cas soumis au 2nd ordre."""
    items, reqs = [], {"y": 0.0, "z": 0.0}
    all_ok = True
    bucklings = []
    newflags = set(flags)
    for ci, case in enumerate(ctx.cases):
        ll = lam_lim_case(ctx, case, layout["As_prov"] if layout else None)
        bk_ok = case["lam"] <= ll["lam_lim"]
        bucklings.append({"case": ci, "combo": case["combo"], "plane": case["plane"], "lam": case["lam"],
                          "lam_lim": ll["lam_lim"], "A": ll["A"], "B": ll["B"], "C": ll["C"], "n": ll["n"],
                          "omega": ll["omega"], "ok": bk_ok})
        second = (ci in flags) or (not bk_ok and allow_second)
        if second:
            newflags.add(ci)
        elif not bk_ok:
            all_ok = False
        secs = case_sections(ctx, case, layout, second)
        for s in secs:
            r = steel_sym_exact(ctx, case["plane"], case["N"], s["M"])
            s["As_req_face"] = r
            if r is None:
                reqs[case["plane"]] = float("inf")
            else:
                reqs[case["plane"]] = max(reqs[case["plane"]], r)
            if layout is not None:
                layer = layout["layer_" + case["plane"]]
                Mr = mrd(ctx, case["plane"], case["N"], layer)
                s["MRd"] = Mr
                s["ok"] = Mr is not None and Mr >= s["M"] - 1e-6
                if not s["ok"]:
                    all_ok = False
        items.append({"case": ci, "combo": case["combo"], "plane": case["plane"], "second_order": second,
                      "sections": secs})
    return {"items": items, "reqs": reqs, "buckling": bucklings, "all_ok": all_ok, "flags": newflags}


# ------------------------------------------------------------------ 9. Pipeline
def run(inp):
    warn, notes = [], []
    ctx = Ctx()
    opts = inp.get("options", {})
    ctx.opts = opts
    sec = inp["section"]
    ctx.b, ctx.h = float(sec["b_cm"]), float(sec["h_cm"])
    if sec.get("type", "rect") != "rect":
        raise ValueError("Section circulaire : hors périmètre de ce skill (flexion composée rectangulaire "
                         "uniquement). Utiliser ec2-compression-simple seul pour la compression centrée.")
    ctx.Ac_cm2 = ctx.b * ctx.h
    ctx.Ac_m2 = ctx.Ac_cm2 / 1e4
    mi = inp["materials"]
    ctx.mat = FC.materials({"fck": mi["fck"], "fyk": mi.get("fyk", 500), "gamma_c": mi.get("gamma_c", 1.5),
                            "gamma_s": mi.get("gamma_s", 1.15), "alpha_cc": mi.get("alpha_cc", 1.0)})
    ctx.cs_mat = CS.materials({"fck": mi["fck"], "fyk": mi.get("fyk", 500)})
    if ctx.h >= 4 * ctx.b or ctx.b >= 4 * ctx.h:
        raise ValueError("h ≥ 4·b : ce n'est pas un poteau (voile) — hors périmètre.")
    geo = inp["geometry"]
    l = float(geo["l_m"])
    if l * 100.0 / max(ctx.b, ctx.h) < 3:
        warn.append("l/h < 3 : élément trapu, à traiter en console courte / bielles — hors périmètre.")

    # ---- détails constructifs
    det = inp.get("detailing", {})
    ctx.cnom = float(det.get("cnom_mm", 30.0))
    if "cnom_mm" not in det:
        warn.append("cnom non fourni : 30 mm supposé (cnom = cmin,dur + Δcdev, tableau 4.4N non embarqué).")
    ctx.phi_t_assumed = float(det.get("phi_t_mm", 8.0))
    ctx.dg = float(det.get("dg_mm", 20.0))
    ctx.phi_min = float(det.get("phi_l_min_mm", 12.0))
    ctx.phi_max = float(det.get("phi_l_max_mm", 32.0))
    phi_l_assumed = float(det.get("phi_l_assumed_mm", 20.0))
    if "dp_cm" in sec:
        ctx.dp = float(sec["dp_cm"])
    else:
        ctx.dp = (ctx.cnom + ctx.phi_t_assumed + phi_l_assumed / 2.0) / 10.0
        notes.append("d' = %.1f cm (cnom + φt + φl/2 avec φt=%g, φl=%g supposés) ; contrôlé après le choix des barres "
                     "(calcul refait si le d' réel est plus grand)." % (ctx.dp, ctx.phi_t_assumed, phi_l_assumed))
    ctx.As_max = 0.04 * ctx.Ac_cm2

    # ---- longueurs efficaces et conditions de liaison
    ec = geo.get("end_conditions")
    braced = geo.get("braced", True)
    if isinstance(ec, str) and ec == "encastre_libre":
        braced = False
    ctx.braced = braced
    l0 = {}
    for p in PLANES:
        if geo.get("l0%s_m" % p) is not None:
            l0[p] = float(geo["l0%s_m" % p])
        elif geo.get("l0_m") is not None:
            l0[p] = float(geo["l0_m"])
        elif ec:
            e_p = ec.get(p) if isinstance(ec, dict) else ec
            if e_p == "encastre_libre":
                braced = ctx.braced = False
            l0[p] = CS.L0_FACTORS[e_p] * l
        else:
            if not braced:
                raise ValueError("Poteau non contreventé de portique : la formule 5.16 n'est pas admise par la "
                                 "commission française — fournir l0 (méthode générale / itération).")
            k1 = max(float(geo.get("k1_%s" % p, geo.get("k1", 0.1))), 0.1)
            k2 = max(float(geo.get("k2_%s" % p, geo.get("k2", 0.1))), 0.1)
            if "k1" not in geo and "k1_%s" % p not in geo:
                warn.append("k1/k2 non fournis : 0,10 supposé (encastrement quasi parfait) — à confirmer.")
            l0[p] = CS.l0_frame(l, k1, k2, True)
    scheme = geo.get("static_scheme") or ("console" if not braced else "simple")
    ctx.scheme = scheme
    ctx.planes = {"y": {"dim": ctx.h, "wid": ctx.b, "l0": l0["y"]},
                  "z": {"dim": ctx.b, "wid": ctx.h, "l0": l0["z"]}}
    for p in PLANES:
        ctx.planes[p]["lam"] = ctx.planes[p]["l0"] * 100.0 * math.sqrt(12.0) / ctx.planes[p]["dim"]
        ctx.planes[p]["e0min"] = max(ctx.planes[p]["dim"] / 30.0 / 100.0, 0.02)
    l_total = float(geo.get("l_total_m", l))
    m_el = int(geo.get("m_elements", 1))

    # ---- imperfections géométriques (EC2 5.2(5) ; αm avec racine carrée) + minimum de l'annexe nationale
    th0 = 1.0 / 200.0
    alpha_h = max(2.0 / 3.0, min(1.0, 2.0 / math.sqrt(l_total)))
    alpha_m = math.sqrt(0.5 * (1.0 + 1.0 / m_el))
    theta_i = th0 * alpha_h * alpha_m
    ei_min = float(opts.get("imperfection_min_m", 0.02))
    for p in PLANES:
        if opts.get("imperfection_m") is not None:
            ctx.planes[p]["ei"] = float(opts["imperfection_m"])
        else:
            ctx.planes[p]["ei"] = max(theta_i * ctx.planes[p]["l0"] / 2.0, ei_min)
    imperf = {"theta0": th0, "alpha_h": alpha_h, "alpha_m": alpha_m, "theta_i": theta_i, "ei_min_m": ei_min,
              "ei_y_m": ctx.planes["y"]["ei"], "ei_z_m": ctx.planes["z"]["ei"]}

    # ---- actions → combinaisons
    combos, qp = build_combinations(inp["loads"], ctx.Ac_cm2, l, warn, notes)
    phi_inf = mi.get("phi_inf_t0")
    ctx.cases, ctx.combos = [], combos
    for ci, cb in enumerate(combos):
        eff = cb["eff"]
        N = eff["N_base"]
        if N <= 0:
            raise ValueError("NEd ≤ 0 (traction) : poteau tendu hors périmètre.")
        for p in PLANES:
            pp = ctx.planes[p]
            fo = first_order(eff, p, l, scheme, braced, N, pp["ei"])
            case = {"combo": cb["name"], "plane": p, "N": N, "l0": pp["l0"], "lam": pp["lam"], "e0min": pp["e0min"],
                    "ei": pp["ei"], "braced": braced, "dim": pp["dim"], "wid": pp["wid"], **fo}
            M0Ed = fo["M0"] + N * pp["ei"]
            if qp is not None and phi_inf is not None:
                Nq = qp["N_base"]
                foq = first_order(qp, p, l, scheme, braced, Nq, pp["ei"])
                M0Eqp = foq["M0"] + Nq * pp["ei"]
                case["M0Eqp"], case["N_qp"] = M0Eqp, Nq
                case["phi_ef"] = float(phi_inf) * M0Eqp / M0Ed if M0Ed > 0 else float(phi_inf)
            elif phi_inf is not None:
                case["phi_ef"] = float(phi_inf)
                warn.append("Combinaison quasi permanente non fournie : φef = φ(∞,t0) pris tel quel (conservatif).")
            else:
                case["phi_ef"] = None
            ctx.cases.append(case)
    if phi_inf is None:
        warn.append("φ(∞,t0) non fourni : A = 0,7 pour λlim et φef = 2 pour le 2nd ordre (hypothèses à confirmer).")
    if not braced:
        notes.append("Élément non contreventé (mât) : rm = 1 (C = 0,7), M0Ed = moment maximal de 1er ordre.")

    both = [c for c in ctx.cases if c["Mmax"] > c["N"] * c["e0min"] + 1e-6]
    if {c["plane"] for c in both} == {"y", "z"}:
        warn.append("Moments significatifs dans les deux plans : le calcul est fait plan par plan ; la vérification "
                    "de flexion déviée (EC2 5.8.9, éq. 5.39) n'est PAS faite par ce skill.")

    Nmax = max(c["N"] for c in ctx.cases)
    As_min_tot = max(Nmax / ctx.mat["fyd"], 0.002 * ctx.Ac_cm2)      # (9.12N) : 0,10·N/fyd [cm²] = N[kN]/fyd
    cascade = []

    # ---- porte d'entrée du niveau 1 : (a) moments du 1er ordre négligeables ET (b) λ ≤ λlim « par défaut »
    #      (A = 0,7 ; B = 1,1 ; C = 0,7) avant tout choix d'acier — test préliminaire du cours.
    negligible = all(c["Mmax"] <= c["N"] * c["e0min"] + 1e-9 for c in ctx.cases)
    strict_entry = opts.get("strict_level1_entry", True)
    gate = []
    for ci, c in enumerate(ctx.cases):
        n_c = c["N"] / 1e3 / (ctx.Ac_m2 * ctx.mat["fcd"])
        lim_c = 20.0 * 0.7 * 1.1 * 0.7 / math.sqrt(n_c)
        gate.append({"case": ci, "combo": c["combo"], "plane": c["plane"], "lam": c["lam"], "n": n_c,
                     "lam_lim_default": lim_c, "ok": c["lam"] <= lim_c})
    gate_ok = all(g["ok"] for g in gate)
    level1 = negligible and (gate_ok or not strict_entry)
    final_layout, final_stage, ev = None, None, None

    # ================= Mode vérification : ferraillage imposé
    imposed = det.get("bars")
    flags = set()
    if imposed:
        lay_i = make_layout(ctx, imposed, warn)
        evb = evaluate(ctx, lay_i, set(), True)
        flags = evb["flags"]
        cascade.append({"stage": "vérification", "title": "Vérification d'un ferraillage imposé (pas de dimensionnement)",
                        "layout": lay_i, "recheck_buckling": evb["buckling"], "cases_second_order": sorted(flags),
                        "all_ok": evb["all_ok"],
                        "decision": "Ferraillage suffisant." if evb["all_ok"] else "Ferraillage INSUFFISANT."})
        final_layout, final_stage, ev = lay_i, "vérification", evb

    if final_layout is None:
        # ================= Niveau 1 : compression centrée
        st1 = {"stage": 1, "title": "Compression centrée (sans vérification de la flexion composée)",
               "applicable": level1,
               "entry_check": {"moments_negligible": negligible, "strict_lambda_gate": strict_entry,
                               "lambda_gate_ok": gate_ok, "lambda_gate": gate}}
        cs_out = None
        if level1:
            cs_in = {"section": {"type": "rect", "b_cm": ctx.b, "h_cm": ctx.h},
                     "loads": {"NEd_kN": Nmax, "add_self_weight": False},
                     "geometry": {"l_m": l, "l0b_m": ctx.planes["z"]["l0"], "l0h_m": ctx.planes["y"]["l0"],
                                  "braced": braced},
                     "materials": {"fck": mi["fck"], "fyk": mi.get("fyk", 500)},
                     "detailing": {"cnom_mm": ctx.cnom, "lap": False}}
            if ctx.b > ctx.h:          # le skill compression-simple range b ≤ h
                cs_in["geometry"].update(l0b_m=ctx.planes["y"]["l0"], l0h_m=ctx.planes["z"]["l0"])
            cs_out = CS.compute(cs_in)
            lg = cs_out["longitudinal"]
            st1.update({"NEd_kN": Nmax, "Fc_kN": lg["Fc_kN"], "Fs_kN": lg["Fs_kN"], "sigma_s_MPa": ctx.cs_mat["sigma_s"],
                        "As_calc_cm2": lg["As_calc_cm2"], "As_min_cm2": lg["As_min_cm2"], "As_req_cm2": lg["As_req_cm2"]})
            As1 = max(lg["As_req_cm2"], As_min_tot)
            bal = ctx.b + ctx.h
            cands = choose_layout(ctx, As1 * ctx.b / (2 * bal), As1 * ctx.h / (2 * bal), As1)
            if not cands:
                raise ValueError("Aucune disposition de barres ne convient au niveau 1 : revoir la section.")
            lay1 = cands[0]
            ev1 = evaluate(ctx, lay1, set(), False)
            st1.update({"layout": lay1, "recheck_buckling": ev1["buckling"],
                        "section_checks_e0": [{"case": it["case"], "combo": it["combo"], "plane": it["plane"],
                                               "sections": [{"name": s["name"], "M": s["M"], "MRd": s.get("MRd"),
                                                             "ok": s.get("ok")} for s in it["sections"]]}
                                              for it in ev1["items"]],
                        "all_ok": ev1["all_ok"]})
            buck_fail = any(not b["ok"] for b in ev1["buckling"])
            e0_fail = any(s.get("ok") is False for it in ev1["items"] for s in it["sections"])
            reasons = []
            if buck_fail:
                reasons.append("λ > λlim avec l'acier choisi")
            if e0_fail:
                reasons.append("section non justifiée sous NEd·max(2 cm ; h/30) (EC2 6.1(4))")
            check_e0 = opts.get("min_eccentricity_check", True)
            ok1 = ev1["all_ok"] if check_e0 else (not buck_fail)
            st1["min_eccentricity_check"] = check_e0
            st1["decision"] = "Niveau 1 suffisant." if ok1 else "Passage au niveau 2 : " + " ; ".join(reasons)
            if ok1:
                final_layout, final_stage, ev = lay1, 1, ev1
                if not check_e0 and e0_fail:
                    for it in ev["items"]:
                        for s in it["sections"]:
                            if s.get("ok") is False:
                                s["ok"], s["waived"] = True, True
                    warn.append("ATTENTION : la section n'est PAS justifiée sous (NEd ; NEd·max(2 cm ; h/30)) — EC2 6.1(4). "
                                "Cette vérification a été écartée à la demande (options.min_eccentricity_check = false).")
        else:
            why = []
            if not negligible:
                why.append("moments du 1er ordre supérieurs à NEd·max(2 cm ; h/30) (le poteau n'est pas en "
                           "compression centrée)")
            if strict_entry and not gate_ok:
                worst = max((g for g in gate if not g["ok"]), key=lambda g: g["lam"] - g["lam_lim_default"])
                why.append("λ = %.1f > λlim = %.1f avec les coefficients par défaut A = 0,7 ; B = 1,1 ; C = 0,7 "
                           "(plan %s)" % (worst["lam"], worst["lam_lim_default"], worst["plane"]))
            st1["reason"] = "Niveau 1 ignoré : " + " ; ".join(why) + "."
            st1["decision"] = "Départ au niveau 2."
        cascade.append(st1)

    # ================= Niveau 2 : flexion composée du 1er ordre
    if final_layout is None:
        st2 = {"stage": 2, "title": "Flexion composée 1er ordre — (NEd ; M = max(M1er ordre ; NEd·max(2 cm ; h/30)))"}
        ev0 = evaluate(ctx, None, set(), False)
        R = ev0["reqs"]
        if R["y"] == float("inf") or R["z"] == float("inf"):
            raise ValueError("Section insuffisante au niveau 2 (As > 6 % Ac) : augmenter la section ou fck.")
        min_tot = As_min_tot
        if cs_out is not None:
            min_tot = max(min_tot, st1["As_req_cm2"])
        cands = choose_layout(ctx, R["y"], R["z"], min_tot)
        if not cands:
            raise ValueError("Aucune disposition de barres ne convient au niveau 2 : revoir la section.")
        lay2 = cands[0]
        ev2 = evaluate(ctx, lay2, set(), False)
        st2.update({"As_face_req_y_cm2": R["y"], "As_face_req_z_cm2": R["z"], "layout": lay2,
                    "sections": ev0["items"], "recheck_buckling": ev2["buckling"], "all_ok": ev2["all_ok"]})
        st2["decision"] = "Niveau 2 suffisant." if ev2["all_ok"] else \
            "Passage au niveau 3 : λ > λlim avec l'acier choisi → second ordre."
        cascade.append(st2)
        if ev2["all_ok"]:
            final_layout, final_stage, ev = lay2, 2, ev2
        else:
            # ================= Niveau 3 : second ordre
            st3 = {"stage": 3, "title": "Flexion composée avec second ordre (méthode %s)" %
                   ctx.opts.get("second_order_method", "courbure"), "iterations": []}
            cur = lay2
            face_y, face_z = R["y"], R["z"]
            conv = False
            for it in range(1, 26):
                evi = evaluate(ctx, cur, flags, True)
                flags = evi["flags"]
                Ri = evi["reqs"]
                st3["iterations"].append({"iter": it, "As_prov_cm2": cur["As_prov"], "layer_y": cur["layer_y"],
                                          "layer_z": cur["layer_z"], "As_face_req_y": Ri["y"],
                                          "As_face_req_z": Ri["z"], "all_ok": evi["all_ok"]})
                if Ri["y"] == float("inf") or Ri["z"] == float("inf"):
                    raise ValueError("Section insuffisante au niveau 3 : augmenter la section ou fck.")
                if evi["all_ok"]:
                    conv, ev = True, evi
                    break
                face_y, face_z = max(face_y, Ri["y"]), max(face_z, Ri["z"])
                cands = choose_layout(ctx, face_y, face_z, max(min_tot, cur["As_prov"] * 1.0001))
                if not cands:
                    raise ValueError("Aucune disposition de barres ne convient au niveau 3 : augmenter la section.")
                cur = cands[0]
            st3["converged"] = conv
            if not conv:
                warn.append("Niveau 3 : pas de convergence après 25 itérations — résultat non exploitable.")
                ev = evi
            st3["layout"] = cur
            st3["cases_second_order"] = sorted(flags)
            cascade.append(st3)
            final_layout, final_stage = cur, 3

    # ---- recalcul si d' réel différent de d' supposé
    lay = final_layout
    e_real = lay["e_mm"] / 10.0
    if "dp_cm" not in sec and e_real - ctx.dp > 0.05 and not inp.get("_second_pass"):
        inp2 = json.loads(json.dumps(inp))
        inp2["section"]["dp_cm"] = round(e_real, 1)
        inp2["_second_pass"] = True
        res2 = run(inp2)
        res2["notes"].insert(0, "Dimensionnement refait avec d' = %.1f cm (valeur réelle après choix des barres)."
                             % e_real)
        return res2

    if e_real - ctx.dp > 0.1:
        warn.append("d' réel (%.2f cm) supérieur au d' retenu (%.2f cm) : vérifier avec d' réel (léger écart non conservatif)."
                    % (e_real, ctx.dp))

    # ---- détails constructifs (cadres, recouvrement) — règles du skill compression-simple
    phi_l = lay["phi"]
    phi_t = det.get("phi_t_mm") or CS.next_commercial(max(6.0, phi_l / 3.0), CS.TRANS_DIAMS)
    phi_t_min = max(6.0, phi_l / 4.0)
    phi_min_l = lay.get("phi_i", phi_l) if (lay["k"] > 2 or lay["m"] > 0) else phi_l
    scl_max = min(20.0 * phi_min_l, min(ctx.b, ctx.h) * 10.0, 400.0)
    s_cur = CS.floor_to(scl_max / 10.0, 5.0)
    s_node = CS.floor_to(0.6 * scl_max / 10.0, 5.0)
    trans = {"phi_t_mm": phi_t, "phi_t_min_ec2_mm": phi_t_min, "scl_t_max_mm": scl_max, "s_current_cm": s_cur,
             "s_node_cm": s_node, "zone_node_height_cm": max(ctx.b, ctx.h)}
    req_tot = max(2.0 * ev["reqs"]["y"], 2.0 * ev["reqs"]["z"], As_min_tot)
    lap = None
    if det.get("lap", True):
        Fs = req_tot * ctx.mat["fyd"] / 10.0          # kN : σsd = fyd·As,req/As,prov
        lap = CS.lap_design(ctx.cs_mat, phi_l, phi_t, Fs, lay["As_prov"], scl_max, det.get("rho1", 100.0),
                            det.get("good_bond", True), det.get("welded", False))
        factor = 1.0 + det.get("rho1", 100.0) / 100.0
        lap["As_in_lap_ok"] = factor * lay["As_prov"] <= 0.08 * ctx.Ac_cm2
        lap["basis"] = "σsd = fyd·As,req/As,prov (recouvrement proportionnel à la section nécessaire, annexe nationale)"
        if phi_l > 14:
            trans["near_lap"] = "espacement réduit (×0,6) sur l0 ≥ %.0f cm et au moins 3 cadres" % lap["l0_cm"]

    # ---- référence « méthode du cours » (skill flexion composée) sur la section la plus défavorable
    fc_ref = None
    try:
        worst = None
        for it in ev["items"]:
            for s in it["sections"]:
                ratio = s["M"] / max(1.0, ctx.cases[it["case"]]["N"])
                if worst is None or ratio > worst[0]:
                    worst = (ratio, it, s)
        _, it, s = worst
        case = ctx.cases[it["case"]]
        pl = ctx.planes[case["plane"]]
        fc_in = {"section": {"type": "rect", "b_cm": pl["wid"], "h_cm": pl["dim"], "d_cm": pl["dim"] - ctx.dp,
                             "dp_cm": ctx.dp},
                 "materials": {"fck": mi["fck"], "fyk": mi.get("fyk", 500), "alpha_e": 15},
                 "loads": {"NEd_kN": case["N"], "MEdG0_kNm": s["M"]}, "options": {"els_check": False}}
        r = FC.run(fc_in)
        fc_ref = {"case": case["combo"], "plane": case["plane"], "section": s["name"], "N_kN": case["N"],
                  "M_kNm": s["M"], "classification": r.get("classification"), "elu": r.get("elu"),
                  "reinforcement_course_method": {k: v for k, v in (r.get("reinforcement") or {}).items()
                                                  if not k.startswith("candidates")}}
    except Exception as exc:          # la référence est facultative
        fc_ref = {"error": str(exc)}

    # ---- sortie
    out = {
        "materials": {"fck": ctx.mat["fck"], "fyk": ctx.mat["fyk"], "fcd": ctx.mat["fcd"], "fyd": ctx.mat["fyd"]},
        "section": {"b_cm": ctx.b, "h_cm": ctx.h, "Ac_cm2": ctx.Ac_cm2, "d_prime_cm": ctx.dp, "cnom_mm": ctx.cnom},
        "geometry": {"l_m": l, "braced": braced, "static_scheme": scheme,
                     "plane_y": {"dim_cm": ctx.h, "l0_m": ctx.planes["y"]["l0"], "lambda": ctx.planes["y"]["lam"],
                                 "e0min_m": ctx.planes["y"]["e0min"]},
                     "plane_z": {"dim_cm": ctx.b, "l0_m": ctx.planes["z"]["l0"], "lambda": ctx.planes["z"]["lam"],
                                 "e0min_m": ctx.planes["z"]["e0min"]}},
        "combinations": [{"name": c["name"], "N_base_kN": c["eff"]["N_base"], "N_top_kN": c["eff"]["N_top"]}
                         for c in combos],
        "cases": [{k: v for k, v in c.items() if k not in ("dim", "wid")} for c in ctx.cases],
        "imperfections": imperf,
        "cascade": cascade,
        "final_stage": final_stage,
        "reinforcement": {"layout": lay, "As_req_tot_cm2": req_tot, "As_min_tot_cm2": As_min_tot,
                          "As_face_req_y_cm2": ev["reqs"]["y"], "As_face_req_z_cm2": ev["reqs"]["z"],
                          "alternatives": choose_layout(ctx, ev["reqs"]["y"], ev["reqs"]["z"], As_min_tot)[:4],
                          "transverse": trans, "lap": lap},
        "verification": {"buckling": ev["buckling"],
                         "sections": [{"case": it["case"], "combo": it["combo"], "plane": it["plane"],
                                       "second_order": it["second_order"],
                                       "sections": [dict(s) for s in it["sections"]]} for it in ev["items"]]},
        "fc_reference": fc_ref,
        "warnings": warn, "notes": notes,
    }
    checks = []
    for b in ev["buckling"]:
        if not b["ok"] and b["case"] not in ev["flags"]:
            checks.append({"name": "λ ≤ λlim (cas %d, plan %s)" % (b["case"], b["plane"]), "ok": False})
    for it in ev["items"]:
        for s in it["sections"]:
            checks.append({"name": "MRd ≥ MEd — %s, plan %s, %s" % (it["combo"], it["plane"], s["name"]),
                           "value": s["M"], "limit": s.get("MRd"), "ok": bool(s.get("ok"))})
    checks.append({"name": "As,min ≤ As,prov ≤ As,max (0,04·Ac)", "value": lay["As_prov"],
                   "limit": [As_min_tot, ctx.As_max],
                   "ok": As_min_tot - 1e-9 <= lay["As_prov"] <= ctx.As_max})
    checks.append({"name": "φt ≥ max(6 mm ; φl/4)", "value": phi_t, "limit": phi_t_min, "ok": phi_t >= phi_t_min})
    if lap:
        checks.append({"name": "As en zone de recouvrement ≤ 0,08·Ac", "ok": lap["As_in_lap_ok"]})
    out["checks"] = checks
    out["all_ok"] = all(c["ok"] for c in checks)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input")
    ap.add_argument("-o", "--output")
    a = ap.parse_args()
    with open(a.input, encoding="utf-8") as f:
        inp = json.load(f)
    res = FC.clean(run(inp))
    txt = json.dumps(res, indent=2, ensure_ascii=False)
    if a.output:
        with open(a.output, "w", encoding="utf-8") as f:
            f.write(txt)
    else:
        sys.stdout.write(txt + "\n")


if __name__ == "__main__":
    main()
