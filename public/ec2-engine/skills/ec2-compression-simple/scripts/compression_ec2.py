#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
compression_ec2.py — Poteau en compression centrée, Eurocode 2 (EN 1992-1-1).

Implémente la démarche du chapitre 6 de « Pratique de l'Eurocode 2 » :
matériaux, NEd, longueur efficace l0, élancement, critère λ ≤ λlim, coffrage,
armatures longitudinales (calcul, min/max, choix des barres), armatures
transversales, recouvrement, vérification finale NEd ≤ NRd.

Usage :
    python compression_ec2.py entree.json            # résultat JSON sur stdout
    python compression_ec2.py entree.json -o sortie.json

Unités d'entrée : kN, m (longueurs d'élément), cm (dimensions de section),
mm (diamètres, enrobage), MPa. Voir references/formulas.md pour les formules
et SKILL.md pour le schéma du JSON d'entrée.
"""
import argparse
import json
import math
import sys

ES = 200_000.0                       # module d'Young de l'acier (MPa)
RHO_BA = 25.0                        # poids volumique du béton armé (kN/m3)
LONG_DIAMS = [8, 10, 12, 14, 16, 20, 25, 32, 40]   # série commerciale HA
TRANS_DIAMS = [6, 8, 10, 12, 14, 16]
N_BARS_TRY = [4, 6, 8, 10, 12, 16]
L0_FACTORS = {                       # longueurs de flambement (Euler), l0 = f.l
    "encastre_libre": 2.0,
    "articule_articule": 1.0,
    "encastre_guide": 1.0,           # rotation bloquée aux 2 bouts, un bout libre en translation
    "encastre_articule": 0.7,
    "encastre_encastre": 0.5,
}


# ----------------------------------------------------------------- utilitaires
def bar_area(phi_mm):
    """Section d'une barre en cm²."""
    return math.pi * phi_mm ** 2 / 4.0 / 100.0


def ceil_to(x, step):
    return math.ceil(x / step - 1e-9) * step


def floor_to(x, step):
    return math.floor(x / step + 1e-9) * step


def next_commercial(x, series):
    for d in series:
        if d >= x - 1e-9:
            return d
    return series[-1]


def clean(obj, nd=4):
    """Arrondit récursivement les flottants pour une sortie lisible."""
    if isinstance(obj, float):
        return round(obj, nd)
    if isinstance(obj, dict):
        return {k: clean(v, nd) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [clean(v, nd) for v in obj]
    return obj


# ------------------------------------------------------------------- matériaux
def materials(mat):
    fck = mat["fck"]
    fyk = mat.get("fyk", 500.0)
    gc = mat.get("gamma_c", 1.5)          # 1,2 en situation accidentelle
    gs = mat.get("gamma_s", 1.15)         # 1,0 en situation accidentelle
    acc = mat.get("alpha_cc", 1.0)
    fcd = mat.get("fcd_override", acc * fck / gc)
    fyd = mat.get("fyd_override", fyk / gs)
    eps_c2 = 2.0 if fck <= 50 else 2.0 + 0.085 * (fck - 50) ** 0.53   # ‰
    eps_yd = fyd / ES * 1000.0                                          # ‰
    yields = eps_c2 > eps_yd
    sigma_s = fyd if yields else ES * eps_c2 / 1000.0
    fctm = 0.3 * fck ** (2.0 / 3.0) if fck <= 50 else 2.12 * math.log(1 + (fck + 8) / 10.0)
    fctk005 = min(0.7 * fctm, 3.1)        # limitée à 3,1 MPa (adhérence)
    fctd = 1.0 * fctk005 / gc             # αct = 1
    return dict(fck=fck, fyk=fyk, gamma_c=gc, gamma_s=gs, alpha_cc=acc, fcd=fcd,
                fyd=fyd, eps_c2=eps_c2, eps_yd=eps_yd, steel_yields=yields,
                sigma_s=sigma_s, fctm=fctm, fctk005=fctk005, fctd=fctd)


# ------------------------------------------------------------ longueur efficace
def l0_frame(l, k1, k2, braced):
    if braced:      # (5.15) éléments contreventés
        return 0.5 * l * math.sqrt((1 + k1 / (0.45 + k1)) * (1 + k2 / (0.45 + k2)))
    a = math.sqrt(1 + 10 * k1 * k2 / (k1 + k2))          # (5.16) non contreventés
    b = (1 + k1 / (1 + k1)) * (1 + k2 / (1 + k2))
    return l * max(a, b)


def effective_lengths(g, warn):
    """Retourne (l0b_m, l0h_m, description)."""
    l = g["l_m"]
    if "l0b_m" in g and "l0h_m" in g:
        return g["l0b_m"], g["l0h_m"], "l0 donné (par direction)"
    if "l0_m" in g:
        return g["l0_m"], g["l0_m"], "l0 donné"
    if "end_conditions" in g:
        f = L0_FACTORS[g["end_conditions"]]
        return f * l, f * l, "liaisons d'extrémité : %s (l0 = %.2f.l)" % (g["end_conditions"], f)
    k1 = max(g.get("k1", 0.1), 0.1)
    k2 = max(g.get("k2", 0.1), 0.1)
    braced = g.get("braced", True)
    if "k1" not in g or "k2" not in g:
        warn.append("k1 et/ou k2 non fournis : pris égaux à 0,10 (encastrement quasi parfait, "
                    "poteau supposé moins raide que les poutres). À confirmer : si les poutres "
                    "sont souples, l0 augmente (jusqu'à l pour k → ∞).")
    val = l0_frame(l, k1, k2, braced)
    kind = "contreventé (5.15)" if braced else "non contreventé (5.16)"
    return val, val, "portique %s, k1=%.2f, k2=%.2f" % (kind, k1, k2)


# -------------------------------------------------------------------- élancement
def slenderness(typ, l0b_m, l0h_m, b_cm=None, h_cm=None, a_cm=None):
    if typ == "circ":
        lam = 4.0 * l0b_m * 100.0 / a_cm
        return dict(lam=lam, lam_b=lam, lam_h=lam)
    lam_b = l0b_m * 100.0 * math.sqrt(12) / b_cm
    lam_h = l0h_m * 100.0 * math.sqrt(12) / h_cm
    return dict(lam=max(lam_b, lam_h), lam_b=lam_b, lam_h=lam_h)


def lam_lim(n, A=0.7, B=1.1, C=0.7):
    return 20.0 * A * B * C / math.sqrt(n)


def coef_A(phi_ef):
    return 0.7 if phi_ef is None else 1.0 / (1.0 + 0.2 * phi_ef)


def coef_C(rm):
    return 0.7 if rm is None else 1.7 - rm


def reduced_axial(NEd_kN, Ac_cm2, fcd):
    """n = NEd/(Ac.fcd) (kN, cm², MPa)."""
    return 10.0 * NEd_kN / (Ac_cm2 * fcd)


# ----------------------------------------------------------------------- barres
def propose_bars(As_req_cm2, phi_imposed=None):
    cands = []
    for n in N_BARS_TRY:
        for phi in LONG_DIAMS:
            if phi_imposed and phi != phi_imposed:
                continue
            if n * bar_area(phi) >= As_req_cm2 - 1e-9:
                cands.append(dict(n=n, phi=phi, As_prov=n * bar_area(phi)))
                break
    return cands


def layout_check(typ, b_cm, h_cm, a_cm, n, phi_l, phi_t, cnom, dg):
    e = cnom + phi_t + phi_l / 2.0                     # mm, face → axe de barre
    a_min = max(phi_l, dg + 5.0, 20.0)                 # espacement libre minimal (mm)
    res = dict(e_mm=e, a_min_mm=a_min)
    if typ == "circ":
        R = a_cm * 10.0 / 2.0 - e
        cc = 2 * math.pi * R / n
        res.update(bar_circle_radius_mm=R, cc_spacing_mm=cc, clear_spacing_mm=cc - phi_l,
                   spacing_ok=(cc - phi_l) >= a_min)
        return res
    k = (n - 4) // 2                                   # barres intermédiaires par grand côté
    span_h = h_cm * 10.0 - 2 * e
    span_b = b_cm * 10.0 - 2 * e
    s_h = span_h / (k + 1)
    pins = []
    for j in range(1, k + 1):
        if min(j, k + 1 - j) * s_h > 150.0:
            pins.append(j)
    res.update(span_h_mm=span_h, span_b_mm=span_b, cc_along_h_mm=s_h,
               clear_along_h_mm=s_h - phi_l, clear_along_b_mm=span_b - phi_l,
               intermediate_per_long_side=k, pins_needed_for_intermediate=pins,
               spacing_ok=(s_h - phi_l >= a_min and span_b - phi_l >= a_min))
    return res


# -------------------------------------------------------------------- recouvrement
def lap_design(M, phi_l, phi_t, Fs_kN, As_prov, scl_max_mm, rho1, good_bond, welded):
    eta1 = 1.0 if good_bond else 0.7
    eta2 = 1.0 if phi_l <= 32 else (132.0 - phi_l) / 100.0
    fbd = 2.25 * eta1 * eta2 * M["fctd"]
    sigma_sd = max(Fs_kN, 0.0) * 1e3 / (As_prov * 100.0)          # MPa
    lb_rqd = phi_l / 4.0 * sigma_sd / fbd                         # mm
    alpha4 = 0.7 if welded else 1.0
    alpha6 = min(max(math.sqrt(rho1 / 25.0), 1.0), 1.5)
    l0_raw = max(alpha4 * alpha6 * lb_rqd, 15.0 * phi_l, 200.0)   # mm
    l0_cm = ceil_to(l0_raw / 10.0, 5.0)
    l0_mm = l0_cm * 10.0
    lim06 = 0.6 * scl_max_mm
    out = dict(eta1=eta1, eta2=eta2, fbd=fbd, sigma_sd=sigma_sd, lb_rqd_mm=lb_rqd,
               lb_rqd_over_phi=lb_rqd / phi_l, alpha4=alpha4, alpha6=alpha6,
               l0_raw_mm=l0_raw, l0_cm=l0_cm, limit_0_6_scl_mm=lim06)
    e0 = 2.0 * phi_l
    a_t = 2 * bar_area(phi_t)                       # 2 branches parallèles par nappe (cm²)
    if phi_l >= 20:
        # 3 nappes à chaque extrémité dans l0/3 (pas s), + nappes intermédiaires si le
        # trou central dépasse 0,6.scl,t,max ; 1 nappe hors recouvrement à chaque bout.
        s_mm = min(floor_to(l0_mm / 6.0, 10.0), 150.0)
        pos_a = [e0, e0 + s_mm, e0 + 2 * s_mm]
        pos_b = [l0_mm - p for p in reversed(pos_a)]
        gap = pos_b[0] - pos_a[-1]
        n_mid = max(0, math.ceil(gap / lim06 - 1e-9) - 1)
        mid = [pos_a[-1] + (i + 1) * gap / (n_mid + 1) for i in range(n_mid)]
        pos = pos_a + mid + pos_b
        gap_eff = gap / (n_mid + 1)
        n_lap = len(pos)
        out.update(layout="3 nappes à chaque extrémité (dans l0/3) + 1 nappe hors recouvrement "
                          "à chaque bout (<= 4.phi)" + (" + %d nappe(s) intermédiaire(s)" % n_mid if n_mid else ""),
                   nappes_in_lap=n_lap, s_mm=s_mm, gap_between_groups_mm=gap,
                   intermediate_nappes=n_mid, positions_from_lap_start_mm=pos,
                   outer_nappe_offset_mm=e0,
                   s_ok_0_6=(s_mm <= lim06), gap_ok_0_6=(gap_eff <= lim06), s_ok_150=(s_mm <= 150.0))
    elif phi_l > 14:
        span = l0_mm - 2 * e0
        n_lap = 3
        while span / (n_lap - 1) > lim06 or n_lap * a_t < bar_area(phi_l):
            n_lap += 1
        s_mm = span / (n_lap - 1)
        pos = [e0 + i * s_mm for i in range(n_lap)]
        out.update(layout="au moins 3 nappes régulièrement espacées sur l0 (%d retenues)" % n_lap,
                   nappes_in_lap=n_lap, s_mm=s_mm, positions_from_lap_start_mm=pos,
                   outer_nappe_offset_mm=e0, s_ok_0_6=(s_mm <= lim06))
    else:
        n_lap = 0
        out.update(layout="phi <= 14 mm : pas de disposition particulière, espacement courant",
                   nappes_in_lap=0)
    if n_lap:
        sum_ast = n_lap * a_t
        out.update(sum_Ast_cm2=sum_ast, As_one_bar_cm2=bar_area(phi_l),
                   sum_Ast_ok=(sum_ast >= bar_area(phi_l)))
    return out


# ------------------------------------------------------------------------ calcul
def compute(inp):
    warn, checks, notes = [], [], []
    mat = materials(inp["materials"])
    fcd, fyd, sig = mat["fcd"], mat["fyd"], mat["sigma_s"]

    sec = inp["section"]
    typ = sec.get("type", "rect")
    ld = inp["loads"]
    geo = inp["geometry"]
    det = inp.get("detailing", {})
    coef = inp.get("coefficients", {})
    step = inp.get("round_cm", 5.0)
    rho_hyp = inp.get("rho_hyp", 0.01)
    l = geo["l_m"]

    # --- sollicitation ELU (hors poids propre)
    if "NEd_kN" in ld:
        N0 = ld["NEd_kN"]
        add_pp = ld.get("add_self_weight", False)
        n_txt = "NEd donné"
    else:
        N0 = ld.get("gammaG", 1.35) * ld["NG_kN"] + ld.get("gammaQ", 1.5) * ld["NQ_kN"]
        add_pp = ld.get("add_self_weight", True)
        n_txt = "1,35.NG + 1,5.NQ"
    out = dict(materials=mat, loads=dict(NEd_top_kN=N0, formula=n_txt))

    # --- longueurs efficaces
    l0b, l0h, l0_txt = effective_lengths(geo, warn)
    out["effective_length"] = dict(l0b_m=l0b, l0h_m=l0h, method=l0_txt)

    # --- coffrage / géométrie
    coff = {}
    imposed = False
    a = None
    if typ == "rect":
        b_in, h_in = sec.get("b_cm"), sec.get("h_cm")
        if b_in and h_in:
            imposed = True
            b, h = min(b_in, h_in), max(b_in, h_in)
        else:
            X = b_in or h_in
            Ac_req = N0 * 1e3 / (fcd + rho_hyp * sig) / 100.0          # cm²
            coff.update(rho_hypothesis=rho_hyp, Ac_req_cm2=Ac_req,
                        formula="Ac >= NEd / (fcd + rho.sigma_s)")
            if X is None:
                X = ceil_to(math.sqrt(Ac_req), step)
                Y = X
                notes.append("Aucune dimension imposée : section carrée proposée.")
                coff["imposed_dimension_cm"] = None
            else:
                Y_calc = Ac_req / X
                coff["imposed_dimension_cm"] = X
                coff["other_dimension_calc_cm"] = Y_calc
                Y = ceil_to(Y_calc, step)
                if Y < X:
                    notes.append("La dimension imposée (%.0f cm) dépasse le besoin (%.1f cm) : "
                                 "section %0.f x %.0f cm retenue." % (X, Y_calc, Y, X))
            b, h = min(X, Y), max(X, Y)
            # contrôle préliminaire (hypothèse du cours : poteau carré de côté = dim. imposée)
            n_pre = reduced_axial(N0, X * X, fcd)
            lam_pre = max(l0b, l0h) * 100.0 * math.sqrt(12) / X
            ll_pre = lam_lim(n_pre)
            coff["preliminary_check"] = dict(
                assumption="poteau carré %.0fx%.0f, A=0,7 B=1,1 C=0,7" % (X, X),
                n=n_pre, lam=lam_pre, lam_lim=ll_pre, ok=(lam_pre <= ll_pre),
                verdict=("OK" if lam_pre <= ll_pre else
                         "PROVISOIRE : λ > λlim avec les coefficients par défaut ; "
                         "verdict définitif après le ferraillage (ω connu)"))
        Ac = b * h
        dmin_cm = b
        hmax_cm = h
    else:                                             # section circulaire
        a_in = sec.get("a_cm")
        if a_in:
            imposed = True
            a = a_in
        else:
            Ac_req = N0 * 1e3 / (fcd + rho_hyp * sig) / 100.0
            a_calc = math.sqrt(4 * Ac_req / math.pi)
            a = ceil_to(a_calc, step)
            coff.update(rho_hypothesis=rho_hyp, Ac_req_cm2=Ac_req, a_calc_cm=a_calc,
                        formula="Ac >= NEd / (fcd + rho.sigma_s) ; a = sqrt(4.Ac/pi)")
            Ac_c = math.pi * a * a / 4
            n_pre = reduced_axial(N0, Ac_c, fcd)
            lam_pre = 4 * l0b * 100.0 / a
            ll_pre = lam_lim(n_pre)
            coff["preliminary_check"] = dict(
                assumption="a = %.0f cm, A=0,7 B=1,1 C=0,7" % a, n=n_pre, lam=lam_pre,
                lam_lim=ll_pre, ok=(lam_pre <= ll_pre),
                verdict=("OK" if lam_pre <= ll_pre else
                         "PROVISOIRE : λ > λlim avec les coefficients par défaut ; "
                         "verdict définitif après le ferraillage"))
        Ac = math.pi * a * a / 4
        dmin_cm = a
        hmax_cm = a
        b = h = None

    section = dict(type=typ, Ac_cm2=Ac, fully_imposed=imposed)
    if typ == "rect":
        section.update(b_cm=b, h_cm=h)
    else:
        section.update(a_cm=a)
    if coff:
        out["coffrage"] = coff
    out["section"] = section

    # --- conditions géométriques « poteau »
    ratio_lh = l * 100.0 / hmax_cm
    checks.append(dict(name="l/h >= 3 (sinon calcul en voile)", value=ratio_lh, ok=ratio_lh >= 3.0))
    if typ == "rect":
        checks.append(dict(name="h < 4.b (sinon voile)", value=h / b, ok=h < 4 * b))

    # --- effort normal de calcul avec poids propre
    G_pp = RHO_BA * Ac / 1e4 * l
    NEd = N0 + (1.35 * G_pp if add_pp else 0.0)
    out["loads"].update(self_weight_G_kN=G_pp, self_weight_included=add_pp,
                        self_weight_ELU_kN=(1.35 * G_pp if add_pp else 0.0), NEd_kN=NEd)

    # --- armatures longitudinales
    Fc = Ac * 100.0 * fcd / 1e3                       # kN
    Fs = NEd - Fc
    As_calc = max(Fs, 0.0) * 1e3 / sig / 100.0        # cm²
    As_min = max(0.10 * NEd * 1e3 / fyd, 0.002 * Ac * 100.0) / 100.0
    As_max = 0.04 * Ac
    As_req = max(As_calc, As_min)
    if Fs <= 0:
        notes.append("Le béton seul reprend NEd (Fs <= 0) : As = As,min.")
    long_ = dict(Fc_kN=Fc, Fs_kN=Fs, As_calc_cm2=As_calc, As_min_cm2=As_min,
                 As_min_terms_cm2=[0.10 * NEd * 1e3 / fyd / 100.0, 0.002 * Ac],
                 As_max_cm2=As_max, As_req_cm2=As_req)

    bars_in = inp.get("bars")
    if bars_in:
        n_b, phi_l = bars_in["n"], bars_in["phi"]
        cands = []
    else:
        cands = propose_bars(As_req, det.get("phi_l_mm"))
        if not cands:
            raise ValueError("Aucune combinaison de barres ne convient : revoir le coffrage.")
        pick = next((c for c in cands if c["phi"] <= 32), cands[-1])
        n_b, phi_l = pick["n"], pick["phi"]
    As_prov = n_b * bar_area(phi_l)
    long_.update(candidates=cands, n_bars=n_b, phi_l_mm=phi_l, As_prov_cm2=As_prov,
                 rho_geo=As_prov / Ac)
    out["longitudinal"] = long_
    checks.append(dict(name="phi_l >= 8 mm", value=phi_l, ok=phi_l >= 8))
    checks.append(dict(name="n >= 4 barres", value=n_b, ok=n_b >= 4))
    checks.append(dict(name="As,prov >= As,req", value=As_prov, limit=As_req, ok=As_prov >= As_req - 1e-9))
    checks.append(dict(name="As,min <= As,prov <= As,max (0,04.Ac)", value=As_prov,
                       limit=[As_min, As_max], ok=(As_min - 1e-9 <= As_prov <= As_max)))

    # --- armatures transversales
    phi_t_ec2 = max(6.0, phi_l / 4.0)
    phi_t = det.get("phi_t_mm") or next_commercial(max(6.0, phi_l / 3.0), TRANS_DIAMS)
    scl_max = min(20.0 * phi_l, dmin_cm * 10.0, 400.0)          # phi_l,min = phi_l (barres identiques)
    s_cur_cm = floor_to(scl_max / 10.0, 5.0)
    s_node_cm = floor_to(0.6 * scl_max / 10.0, 5.0)
    trans = dict(phi_t_min_ec2_mm=phi_t_ec2, phi_t_mm=phi_t,
                 phi_t_rule="phi_t >= max(6 ; phi_l/4) (EC2) ; retenu : commercial >= max(6 ; phi_l/3)",
                 scl_t_max_mm=scl_max, s_current_cm=s_cur_cm, s_node_max_mm=0.6 * scl_max,
                 s_node_cm=s_node_cm)
    checks.append(dict(name="phi_t >= phi_t,min EC2", value=phi_t, limit=phi_t_ec2,
                       ok=phi_t >= phi_t_ec2 - 1e-9))
    out["transverse"] = trans

    # --- disposition des barres
    lay = layout_check(typ, b, h, a, n_b, phi_l, phi_t,
                       det.get("cnom_mm", 30.0), det.get("dg_mm", 20.0))
    out["layout"] = lay
    checks.append(dict(name="espacement libre entre barres >= max(phi ; dg+5 ; 20 mm)",
                       ok=lay["spacing_ok"]))
    if typ == "rect" and lay.get("pins_needed_for_intermediate"):
        notes.append("Barres intermédiaires à tenir par épingle/étrier (distance > 150 mm "
                     "à la barre tenue la plus proche) : rangs %s de chaque grand côté."
                     % lay["pins_needed_for_intermediate"])
    if "cnom_mm" not in det:
        warn.append("cnom non fourni : 30 mm supposé pour la vérification d'espacement. "
                    "À remplacer par cnom = cmin,dur + Δcdev (tableau 4.4N non embarqué).")

    # --- recouvrement
    lap_on = det.get("lap", True)
    if lap_on:
        rho1 = det.get("rho1", 100.0)
        lap = lap_design(mat, phi_l, phi_t, Fs, As_prov, scl_max, rho1,
                         det.get("good_bond", True), det.get("welded", False))
        out["lap"] = lap
        factor = 1.0 + rho1 / 100.0
        checks.append(dict(name="As,tot en zone de recouvrement <= 0,08.Ac",
                           value=factor * As_prov, limit=0.08 * Ac,
                           ok=factor * As_prov <= 0.08 * Ac))
        if "s_ok_0_6" in lap:
            checks.append(dict(name="espacement nappes recouvrement <= 0,6.scl,t,max",
                               value=lap.get("s_mm"), limit=lap["limit_0_6_scl_mm"],
                               ok=lap["s_ok_0_6"] and lap.get("gap_ok_0_6", True)))
        if lap.get("s_ok_150") is not None:
            checks.append(dict(name="espacement nappes d'extrémité <= 150 mm",
                               value=lap.get("s_mm"), limit=150.0, ok=lap["s_ok_150"]))
        if "sum_Ast_ok" in lap:
            checks.append(dict(name="ΣAst >= As (1 barre en recouvrement)", value=lap["sum_Ast_cm2"],
                               limit=lap["As_one_bar_cm2"], ok=lap["sum_Ast_ok"]))
        if As_calc < As_min - 1e-9:
            warn.append("As,min gouverne (As,calc = %.2f cm² < As,min = %.2f cm²) : σsd = Fs/As,prov est "
                        "faible et l0 se réduit vers l0,min (15.phi ; 200 mm). Le cours ne traite pas ce "
                        "cas ; à apprécier (option prudente : prendre σsd = fyd)." % (As_calc, As_min))
        if det.get("welded"):
            notes.append("α4 = 0,7 retenu (armatures transversales soudées).")

    # --- vérifications finales
    if typ == "rect":
        sl = slenderness("rect", l0b, l0h, b_cm=b, h_cm=h)
    else:
        sl = slenderness("circ", l0b, l0h, a_cm=a)
    omega = As_prov * fyd / (Ac * fcd)
    A = coef_A(coef.get("phi_ef"))
    B = math.sqrt(1 + 2 * omega)
    C = coef_C(coef.get("rm"))
    n_fin = reduced_axial(NEd, Ac, fcd)
    ll = lam_lim(n_fin, A, B, C)
    final = dict(**sl, omega=omega, A=A, B=B, C=C, n=n_fin, lam_lim=ll, ok=(sl["lam"] <= ll))
    out["final_slenderness"] = final
    checks.append(dict(name="λ <= λlim (compression centrée valide)", value=sl["lam"],
                       limit=ll, ok=final["ok"]))
    if not final["ok"]:
        warn.append("λ > λlim : l'hypothèse de compression centrée n'est pas satisfaite. "
                    "Augmenter la section, réduire l0, ou passer en flexion composée avec "
                    "effets du second ordre (hors périmètre du skill).")

    NRd = (Ac * 100.0 * fcd + As_prov * 100.0 * sig) / 1e3
    out["resistance"] = dict(NRd_kN=NRd, NEd_kN=NEd, utilisation=NEd / NRd, ok=NEd <= NRd)
    checks.append(dict(name="NEd <= NRd = Ac.fcd + As.σs", value=NEd, limit=NRd, ok=NEd <= NRd))

    # --- synthèse
    summ = dict(section=("%.0fx%.0f cm" % (b, h)) if typ == "rect" else "Ø%.0f cm" % a,
                longitudinal="%d HA%d (%.2f cm²)" % (n_b, phi_l, As_prov),
                transverse="cadres HA%d, e = %.0f cm en zone courante, e <= %.0f cm en zone de nœud"
                           % (phi_t, s_cur_cm, s_node_cm))
    if lap_on:
        summ["recouvrement"] = "l0 = %.0f cm" % out["lap"]["l0_cm"]
    out["summary"] = summ
    out["checks"] = checks
    out["notes"] = notes
    out["warnings"] = warn
    out["all_ok"] = all(c["ok"] for c in checks)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input", help="fichier JSON d'entrée")
    ap.add_argument("-o", "--output", help="fichier JSON de sortie (défaut : stdout)")
    args = ap.parse_args()
    with open(args.input, encoding="utf-8") as f:
        inp = json.load(f)
    res = clean(compute(inp))
    txt = json.dumps(res, indent=2, ensure_ascii=False)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(txt)
    else:
        sys.stdout.write(txt + "\n")


if __name__ == "__main__":
    main()
