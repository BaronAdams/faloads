#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
flexion_composee_ec2.py — Flexion composée (N + M) d'une section rectangulaire ou en T
en béton armé, Eurocode 2 (EN 1992-1-1).

Trois cas, comme dans « Pratique de l'Eurocode 2 » (chap. 11) :
  A. section partiellement tendue   -> ramenée à la flexion simple autour des aciers tendus
  B. section entièrement tendue     -> équilibre des deux nappes autour du centre de pression
  C. section comprimée (x > d)      -> formules du pivot C / région 2b (support de cours
                                       « sections entièrement comprimées »), SANS abaques, avec un
                                       moteur d'interaction (compatibilité des déformations,
                                       diagramme parabole-rectangle) qui sert aussi de vérification.

Usage :
    python flexion_composee_ec2.py entree.json            # JSON détaillé sur stdout
    python flexion_composee_ec2.py entree.json -o sortie.json

Unités d'entrée : kN, kN.m, m (longueurs d'élément), cm (section), cm² (aciers), MPa.
Convention : compression positive ; M > 0 tend la fibre inférieure (aciers « As1 » en bas, fibre la
plus comprimée en haut). Un M < 0 est traité par symétrie (section retournée).
Détails des formules : references/formulas.md.
"""
import argparse
import json
import math

ES = 200_000.0                      # MPa
ECU = 3.5e-3                        # raccourcissement ultime (fck <= 50 MPa)
EC2 = 2.0e-3                        # raccourcissement au pic (parabole-rectangle, n = 2)
LONG_DIAMS = [8, 10, 12, 14, 16, 20, 25, 32, 40]


# ------------------------------------------------------------------ utilitaires
def bar_area(phi_mm):
    """Aire d'une barre en cm²."""
    return math.pi * phi_mm ** 2 / 4.0 / 100.0


def clean(obj, nd=5):
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return round(obj, nd)
    if isinstance(obj, dict):
        return {k: clean(v, nd) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [clean(v, nd) for v in obj]
    return obj


def bisect(f, lo, hi, n=200, tol=1e-12):
    flo, fhi = f(lo), f(hi)
    if flo == 0:
        return lo
    if fhi == 0:
        return hi
    if flo * fhi > 0:
        return None
    for _ in range(n):
        mid = 0.5 * (lo + hi)
        fm = f(mid)
        if flo * fm <= 0:
            hi, fhi = mid, fm
        else:
            lo, flo = mid, fm
        if abs(hi - lo) < tol * max(1.0, abs(mid)):
            break
    return 0.5 * (lo + hi)


# ------------------------------------------------------------------ matériaux
def materials(m):
    fck = float(m["fck"])
    if fck > 50:
        raise ValueError("fck > 50 MPa : hors périmètre (diagrammes et λ, η différents).")
    fyk = float(m.get("fyk", 500))
    gc = float(m.get("gamma_c", 1.5))
    gs = float(m.get("gamma_s", 1.15))
    acc = float(m.get("alpha_cc", 1.0))
    fcd = acc * fck / gc
    fcu = fcd                                   # η = 1 pour fck <= 50
    fyd = fyk / gs
    fctm = 0.3 * fck ** (2.0 / 3.0)
    if m.get("fcu_override"):                   # rejeu des chiffres arrondis d'un corrigé
        fcu = fcd = float(m["fcu_override"])
    if m.get("fyd_override"):
        fyd = float(m["fyd_override"])
    if m.get("fctm_override"):
        fctm = float(m["fctm_override"])
    expo = str(m.get("exposure", "X0")).upper()
    limited = expo.startswith(("XD", "XF", "XS"))
    k1, k3 = float(m.get("k1", 0.6)), float(m.get("k3", 0.8))
    return {
        "fck": fck, "fyk": fyk, "gamma_c": gc, "gamma_s": gs, "alpha_cc": acc,
        "lambda": 0.8, "eta": 1.0, "fcd": fcd, "fcu": fcu, "fyd": fyd, "eps_yd": fyd / ES,
        "fctm": fctm, "alpha_e": float(m.get("alpha_e", 15)),
        "exposure": expo, "sigma_c_limited": limited,
        "sigma_c_bar": k1 * fck, "sigma_s_bar": k3 * fyk, "k1": k1, "k3": k3,
        "crack_control": bool(m.get("crack_control", False)),
        "steel_diagram": "horizontal",
        "mu_lu_override": m.get("mu_lu_override"),
    }


# ------------------------------------------------------------------ géométrie
class Geom:
    """Section rectangulaire ou en T (table en haut), unités m."""

    def __init__(self, s):
        self.type = s.get("type", "rect").lower()
        self.h = s["h_cm"] / 100.0
        if self.type == "t":
            self.bw = s["bw_cm"] / 100.0
            self.beff = s["beff_cm"] / 100.0
            self.hf = s["hf_cm"] / 100.0
        else:
            self.bw = self.beff = s["b_cm"] / 100.0
            self.hf = 0.0
        self.d = s["d_cm"] / 100.0
        self.dp = s["dp_cm"] / 100.0
        self.Ac = self.bw * self.h + (self.beff - self.bw) * self.hf
        S = self.bw * self.h ** 2 / 2 + (self.beff - self.bw) * self.hf ** 2 / 2
        self.vpc = S / self.Ac                          # profondeur du CDG du béton (depuis le haut)
        self.vc = self.h - self.vpc
        self.I = (self.bw * self.h ** 3 / 3 + (self.beff - self.bw) * self.hf ** 3 / 3
                  - self.Ac * self.vpc ** 2)


# ------------------------------------------------------------------ béton (module)
def ecm_from_fck(fck):
    """Ecm (MPa), formule EC2 table 3.1 : 22000.(fcm/10)^0.3, fcm=fck+8."""
    return 22000.0 * ((fck + 8.0) / 10.0) ** 0.3


# ------------------------------------------------------------------ élancement
def slenderness_check(g, mat, N, sl):
    """Élancement et λlim (éq. 5.13N) dans le plan de flexion (h) et, si b est connu, dans l'autre plan."""
    l = sl.get("l_m")
    l0 = sl.get("l0_m")
    if l0 is None and l is not None and sl.get("l0_factor"):
        l0 = sl["l0_factor"] * l
    if l0 is None:
        return None
    A = 1.0 / (1 + 0.2 * sl["phi_ef"]) if sl.get("phi_ef") is not None else 0.7
    B = math.sqrt(1 + 2 * sl["omega"]) if sl.get("omega") is not None else 1.1
    braced = sl.get("braced", True)
    rm = sl.get("rm")
    if rm is None and not braced:
        rm = 1.0
    C = 1.7 - rm if rm is not None else 0.7
    n = N / (g.Ac * mat["fcd"]) * 1e-3
    lim = 20 * A * B * C / math.sqrt(n) if n > 0 else float("inf")
    i_h = math.sqrt(g.I / g.Ac)
    out = {"l0": l0, "A": A, "B": B, "C": C, "rm": rm, "n": n, "lambda_lim": lim,
           "plane_h": {"i": i_h, "lambda": l0 / i_h, "ok": l0 / i_h <= lim}}
    if sl.get("b_cm"):
        i_b = sl["b_cm"] / 100 / math.sqrt(12)
        out["plane_b"] = {"i": i_b, "lambda": l0 / i_b, "ok": l0 / i_b <= lim,
                          "note": "si λ <= λlim : pas de second ordre, compression simple dans ce plan"}
    return out


# ------------------------------------------------------------------ ELS : sections non fissurée / fissurée
def els_uncracked(g, ae, As1, As2, Ns, e0s):
    """Section homogène non fissurée. As en m², Ns en MN. Contraintes en MPa (compression +)."""
    Ach = g.Ac + ae * (As1 + As2)
    S = g.Ac * g.vpc + ae * (As1 * g.d + As2 * g.dp)
    vp = S / Ach
    v = g.h - vp
    Ich = (g.bw * g.h ** 3 / 3 + (g.beff - g.bw) * g.hf ** 3 / 3
           + ae * (As1 * g.d ** 2 + As2 * g.dp ** 2) - Ach * vp ** 2)
    MAN = Ns * (e0s - g.vpc + vp)                        # moment / centre de gravité de la section homogène
    return {"Ach": Ach, "v_prime": vp, "v": v, "Ich": Ich, "M_AN": MAN,
            "sigma_ct": Ns / Ach - MAN * v / Ich,        # fibre inférieure
            "sigma_c": Ns / Ach + MAN * vp / Ich,        # fibre supérieure
            "sigma_s1": ae * (Ns / Ach - MAN * (g.d - vp) / Ich),
            "sigma_s2": ae * (Ns / Ach + MAN * (vp - g.dp) / Ich)}


def _conc_integrals(g, x1):
    """∫ b(y)(x1-y) dy et ∫ b(y)(x1-y) y dy sur [0, x1]."""
    I0 = I1 = 0.0
    segs = [(0.0, min(g.hf, x1), g.beff)] if g.hf > 0 else []
    segs.append((min(g.hf, x1), min(g.h, x1), g.bw))
    for a, b, w in segs:
        if b <= a:
            continue
        I0 += w * (x1 * (b - a) - (b * b - a * a) / 2)
        I1 += w * (x1 * (b * b - a * a) / 2 - (b ** 3 - a ** 3) / 3)
    return I0, I1


def els_cracked(g, ae, As1, As2, Ns, e0s):
    """Section fissurée (béton tendu négligé). As en m², Ns en MN. None si pas de solution."""
    yC = g.vpc - e0s                                     # profondeur du point d'application de Ns

    def parts(x1):
        I0, I1 = _conc_integrals(g, x1)
        F1 = ae * As1 * (x1 - g.d)
        F2 = ae * As2 * (x1 - g.dp)
        return I0 + F1 + F2, (I1 - yC * I0) + F1 * (g.d - yC) + F2 * (g.dp - yC)

    xs = [g.h * 1e-3 * (1.0 + i) for i in range(0, 3000)]
    sol = None
    for a, b in zip(xs[:-1], xs[1:]):
        if parts(a)[1] * parts(b)[1] < 0:
            x1 = bisect(lambda x: parts(x)[1], a, b)
            n = parts(x1)[0]
            K = Ns / n if n != 0 else -1
            if K > 0:
                sol = (x1, K)
                break
    if sol is None:
        return None
    x1, K = sol
    return {"x1": x1, "K": K, "sigma_c": K * x1, "sigma_s1": ae * K * (g.d - x1),
            "sigma_s2": ae * K * (x1 - g.dp), "c": yC, "one_tension_layer": x1 <= g.d}


# ------------------------------------------------------------------ μlu (flexion composée, ELS couplé)
def mu_lu_composee(mat, nu, gM, gN):
    """μlu exact : valeur de μcu telle que, avec As1 dimensionné à l'ELU (As2 = 0), la contrainte du béton
    à l'ELS atteigne σc̄. Reproduit les tableaux de l'annexe A3 (S500, palier horizontal, αe donné).
    nu = NEd/(bw d fcu) signé ; gM = MEdA/MserA ; gN = NEd/Nser."""
    fcu, fyd, sc, ae = mat["fcu"], mat["fyd"], mat["sigma_c_bar"], mat["alpha_e"]
    lam = mat["lambda"]

    def f(mu):
        au = (1 - math.sqrt(1 - 2 * mu)) / lam
        es = ECU * (1 - au) / au
        s1 = min(ES * es, fyd)
        zc = 1 - lam * au / 2
        As = mu * fcu / (zc * s1) - nu * fcu / s1
        if As <= 0:
            return None
        Ms, Ns = mu * fcu / gM, nu * fcu / gN
        c = 1 - Ms / Ns
        g_ = lambda x: 0.5 * x * x * (x / 3 - c) + ae * As * (x - 1) * (1 - c)
        n_ = lambda x: 0.5 * x * x + ae * As * (x - 1)
        xs = [i / 1500 for i in range(1, 4500)]
        for a, b in zip(xs[:-1], xs[1:]):
            if g_(a) * g_(b) < 0:
                x = bisect(g_, a, b)
                K = Ns / n_(x)
                if K > 0:
                    return K * x - sc
        return None

    grid = [0.03 + 0.005 * i for i in range(0, 91)]     # 0,03 ... 0,48
    prev = None
    for m in grid:
        v = f(m)
        if v is None:
            continue
        if prev is not None and prev[1] * v <= 0:
            return bisect(lambda z: (f(z) if f(z) is not None else 1e9), prev[0], m, n=80)
        prev = (m, v)
    return None


def mu_ls(mat):
    """μls (σc non limitée) : λ.αl.(1 - λ.αl/2), αl = εcu/(εcu+εyd)."""
    la = mat["lambda"] * ECU / (ECU + mat["eps_yd"])
    return la * (1 - la / 2)


# ------------------------------------------------------------------ classification légère (réutilisée par le second ordre)
def classify(g, mat, N_kN, M0_abs_kNm):
    """Classification A/B/C pour un couple (N, M0) donné — version allégée de la classification de run(),
    réutilisée par la boucle itérative du second ordre (§10 de formulas.md)."""
    e0_sg = M0_abs_kNm / N_kN
    yC = g.vpc - e0_sg
    cls = {"y_C_m": yC, "e0_m": e0_sg}
    if N_kN < 0:
        cls["case"] = "B" if g.dp <= yC <= g.d else "A"
    else:
        e_lim = g.vpc - g.dp - 0.81 * g.beff * g.d * mat["fcd"] * (0.416 * g.d - g.dp) / (N_kN / 1e3)
        cls["e_o_lim_m"] = e_lim
        cls["case"] = "A" if e0_sg >= e_lim else "C"
    return cls


def quick_reinforcement(g, mat, N_kN, M0_kNm, Ns_kN, Ms0_kNm, opts):
    """Résout (As_bas, As_haut) en cm², via le moteur cas A/B/C, pour un (N, M0) donné, en ferraillage
    symétrique forcé (cas C : χ=1) — utilisé par la boucle itérative du second ordre. Sans warnings ni détail."""
    w = []
    case = classify(g, mat, N_kN, M0_kNm)["case"]
    if case == "A":
        elu, need = case_A(g, mat, N_kN, M0_kNm, Ns_kN, Ms0_kNm, w)
        if N_kN > 0 and elu["As1_calc_cm2"] <= 0:
            case = "C"
        else:
            e0ser = Ms0_kNm / Ns_kN if Ns_kN else 0.0
            amin = as_min_general(g, mat, e0ser)
            return case, max(need["As1"], amin["As_min_cm2"]), need["As2"]
    if case == "B":
        elu = case_B(g, mat, N_kN, M0_kNm, Ns_kN, Ms0_kNm)
        return case, max(elu["As1_cm2"], elu["As1_min_cm2"]), max(elu["As2_cm2"], elu["As2_min_cm2"])
    opts_sym = dict(opts)
    opts_sym["compressed"] = {"chi": 1.0}
    elu, need, eng, Nred, Mred = case_C(g, mat, N_kN, M0_kNm, opts_sym, w)
    return case, need["As"], need["Asc"]


# ------------------------------------------------------------------ SECOND ORDRE : méthode de la rigidité nominale (EC2 5.8.7)
def rigidite_M2(g, mat, N_kN, M0Ed_kNm, As_face_cm2, phi_ef, l0, lam, c0):
    """Moment total (1er + 2e ordre) par la méthode de la rigidité nominale. Notations et formules :
    « Maîtrise de l'Eurocode 2 », J. Roux, chap. « Instabilité de forme – Flambement », §6."""
    Ecd = ecm_from_fck(mat["fck"]) / 1.2                       # γcE = 1,2
    Ic = g.I
    As_tot_cm2 = 2.0 * As_face_cm2
    rho = As_tot_cm2 / (g.Ac * 1e4)
    Is = 2.0 * (As_face_cm2 * 1e-4) * (g.h / 2.0 - g.dp) ** 2
    n = (N_kN / 1e3) / (g.Ac * mat["fcd"])
    k1 = math.sqrt(mat["fck"] / 20.0)
    k2 = min(n * lam / 170.0, 0.20)
    if rho >= 0.01:
        Ks, Kc, branch = 0.0, 0.3 / (1 + 0.5 * phi_ef), "ρ ≥ 0,01"
    else:
        Ks, Kc, branch = 1.0, k1 * k2 / (1 + phi_ef), "0,002 ≤ ρ < 0,01 (ou ρ non encore connu)"
    EI = Kc * Ecd * Ic + Ks * ES * Is
    NB = math.pi ** 2 * EI / l0 ** 2
    beta = math.pi ** 2 / c0
    NEd_MN = N_kN / 1e3
    ok = NB > NEd_MN
    MEd = M0Ed_kNm * (1 + beta / (NB / NEd_MN - 1)) if ok else M0Ed_kNm * 10.0
    return {"Ecd_MPa": Ecd, "Ic_m4": Ic, "Is_m4": Is, "rho": rho, "branch": branch, "k1": k1, "k2": k2,
            "Kc": Kc, "Ks": Ks, "EI_MNm2": EI, "NB_MN": NB, "beta": beta, "c0": c0, "NB_gt_NEd": ok,
            "MEd_kNm": MEd}


# ------------------------------------------------------------------ SECOND ORDRE : méthode de l'estimation de la courbure (EC2 5.8.8)
def courbure_M2(g, mat, N_kN, M0Ed_kNm, As_face_cm2, phi_ef, l0, lam, c_curv, n_bal):
    """Moment total (1er + 2e ordre) par la méthode de la courbure nominale (« estimation de la courbure »).
    Mêmes notations que rigidite_M2 ; référence « Maîtrise de l'Eurocode 2 », §7."""
    eps_yd = mat["fyd"] / ES
    inv_r0 = eps_yd / (0.45 * g.d)
    As_tot_cm2 = 2.0 * As_face_cm2
    omega = (As_tot_cm2 * 1e-4) * mat["fyd"] / (g.Ac * mat["fcd"])
    nu = 1.0 + omega
    n = (N_kN / 1e3) / (g.Ac * mat["fcd"])
    ok = n < nu
    n_eff = min(n, 0.999 * nu) if not ok else n
    Kr = max(min((nu - n_eff) / (nu - n_bal), 1.0), 0.0)
    beta = 0.35 + mat["fck"] / 200.0 - lam / 150.0
    Kphi = max(1 + beta * phi_ef, 1.0)
    inv_r = Kr * Kphi * inv_r0
    e2 = l0 ** 2 / c_curv * inv_r
    NEd_MN = N_kN / 1e3
    M2 = NEd_MN * e2 * 1e3
    MEd = M0Ed_kNm + M2
    return {"eps_yd": eps_yd, "inv_r0": inv_r0, "omega": omega, "nu": nu, "n": n_eff, "n_bal": n_bal,
            "Kr": Kr, "beta": beta, "phi_ef": phi_ef, "Kphi": Kphi, "inv_r": inv_r, "c": c_curv,
            "e2_m": e2, "M2_kNm": M2, "n_lt_nu": ok, "MEd_kNm": MEd}


def apply_second_order(g, mat, N_kN, M0Ed_kNm, Ns_kN, Ms0_kNm, sled, sl, opts, warn, notes, e1_bare_m=None):
    """Pilote l'une des deux méthodes simplifiées (rigidité nominale ou courbure nominale) : itère sur la
    section d'aciers (ferraillage symétrique supposé, comme dans les deux méthodes) jusqu'à convergence entre
    l'armature utilisée pour EI/ω et celle que redonne le calcul en flexion composée sous le moment total.
    Retourne un dict avec la méthode, l'historique des itérations, et 'MEd_kNm' (moment total 1er+2e ordre)."""
    method = (opts.get("second_order_method") or (sl or {}).get("method") or "courbure").lower()
    l0, lam = sled["l0"], sled["plane_h"]["lambda"]
    sl = sl or {}

    phi_ef_raw = sl.get("phi_ef")
    phi_inf_t0 = sl.get("phi_inf_t0")
    if phi_inf_t0 is not None:
        M0Eqp_kNm = sl.get("M0Eqp_kNm")
        if M0Eqp_kNm is None and sl.get("NG_kN") is not None and e1_bare_m is not None:
            # M0Eqp = NG.e0e : effort permanent seul (ψ2.Q négligé, à défaut d'être fourni) à l'excentricité de
            # RdM SANS imperfections (ei, Δe0 sont un ajout ELU, pas une donnée de la combinaison quasi permanente).
            M0Eqp_kNm = sl["NG_kN"] * abs(e1_bare_m)
            notes.append("M0Eqp estimé = NG.e0e (ψ2.NQ négligé faute de donnée) : fournir slenderness.M0Eqp_kNm pour la valeur exacte.")
        if M0Eqp_kNm is not None and M0Ed_kNm > 0:
            phi_ef = phi_inf_t0 * M0Eqp_kNm / M0Ed_kNm
            notes.append(f"φef = φ(∞,t0).M0Eqp/M0Ed = {phi_inf_t0}×{M0Eqp_kNm:.4g}/{M0Ed_kNm/1e3:.4g} = {phi_ef:.3g} "
                        "(recalculé ; le test d'élancement, lui, utilise φ(∞,t0) tel quel — voir Remarque 1, §4.2.1).")
        else:
            phi_ef = phi_inf_t0
            warn.append("φ(∞,t0) donné mais M0Eqp non calculable (fournir slenderness.M0Eqp_kNm ou slenderness.NG_kN) : "
                        "φef = φ(∞,t0) utilisé tel quel pour le second ordre.")
    elif phi_ef_raw is not None:
        phi_ef = phi_ef_raw
    else:
        phi_ef = 2.0
        warn.append("Coefficient de fluage non fourni : φef = 2 retenu par défaut pour le second ordre "
                    "(hypothèse à confirmer — dépend de l'âge de mise en charge, l'hygrométrie, la taille de l'élément ; "
                    "hors périmètre de ce skill). Fournir slenderness.phi_ef pour lever cette hypothèse.")

    c0 = sl.get("c0", 8.0)               # β = π²/c0 (rigidité) ; 8 = moment du 1er ordre constant (défaut, cas courant d'un poteau isolé)
    c_curv = sl.get("c_curvature", 10.0)  # e2 = l0²/c . 1/r (courbure) ; 10 ≈ π² = déformée sinusoïdale (défaut, tous les exemples du cours)
    n_bal = sl.get("n_bal", 0.40)
    M0Ed_2nd = sl.get("M0e_kNm", M0Ed_kNm)   # moment équivalent (5.31) si fourni précalculé pour poteau à moments d'extrémité différents

    As_face = max(sl.get("second_order_As_start_cm2", 0.0), 0.0)
    history = []
    max_iter = 30
    converged = False
    info = None
    for it in range(1, max_iter + 1):
        if method == "rigidite":
            info = rigidite_M2(g, mat, N_kN, M0Ed_2nd, As_face, phi_ef, l0, lam, c0)
            if not info["NB_gt_NEd"]:
                warn.append(f"Méthode de la rigidité (itération {it}) : NB = {info['NB_MN']:.3f} MN ≤ NEd — "
                            "rigidité insuffisante avec cette section d'aciers ; poursuite de l'itération avec un moment majoré.")
        else:
            info = courbure_M2(g, mat, N_kN, M0Ed_2nd, As_face, phi_ef, l0, lam, c_curv, n_bal)
            if not info["n_lt_nu"]:
                warn.append(f"Méthode de la courbure (itération {it}) : n ≥ nu — NEd dépasse la capacité axiale "
                            "de la section avec cette armature ; poursuite de l'itération avec Kr plafonné.")
        MEd = info["MEd_kNm"]
        case, As_bottom, As_top = quick_reinforcement(g, mat, N_kN, MEd, Ns_kN, Ms0_kNm, opts)
        new_face = max(As_bottom, As_top)
        history.append({"iter": it, "As_face_in_cm2": As_face, "MEd_kNm": MEd, "case": case,
                        "As_face_out_cm2": new_face})
        if abs(new_face - As_face) <= max(0.02 * new_face, 0.03):
            As_face = new_face
            converged = True
            break
        As_face = new_face if it <= 2 else 0.5 * (As_face + new_face)
    if not converged:
        warn.append(f"Second ordre ({method}) : pas de convergence stricte après {max_iter} itérations — dernier résultat retenu.")
    info["method"] = method
    info["phi_ef_used"] = phi_ef
    info["iterations"] = history
    info["n_iterations"] = len(history)
    info["converged"] = converged
    info["As_face_final_cm2"] = As_face
    info["M0Ed_kNm"] = M0Ed_2nd
    return info


# ------------------------------------------------------------------ CAS A : section partiellement tendue
def case_A(g, mat, N, M0, Ns, Ms0, warn):
    """N en kN (signé), M0 >= 0 en kN.m autour de G0. Ns, Ms0 : service."""
    fcu, fyd, fck, ae = mat["fcu"], mat["fyd"], mat["fck"], mat["alpha_e"]
    lam = mat["lambda"]
    d, dp = g.d, g.dp
    N_MN, Ns_MN = N / 1e3, Ns / 1e3
    MEdA = M0 / 1e3 + N_MN * (d - g.vpc)                 # MN.m
    MserA = Ms0 / 1e3 + Ns_MN * (d - g.vpc)
    out = {"MEdA_kNm": MEdA * 1e3, "MserA_kNm": MserA * 1e3}
    bw, beff = g.bw, g.beff

    b, M_calc, N_calc = bw, MEdA, N_MN
    if g.type == "t":
        MTu = beff * g.hf * fcu * (d - g.hf / 2)
        out["MTu_kNm"] = MTu * 1e3
        if MEdA <= MTu:
            b = beff
            out["t_section"] = "zone comprimée rectangulaire (largeur beff)"
        else:
            M_calc = MEdA - (beff - bw) * g.hf * fcu * (d - g.hf / 2)
            N_calc = N_MN - (beff - bw) * g.hf * fcu
            out["t_section"] = "vraie section en T : MEdR et NEdR sur bw.d"
            out["MEdR_kNm"], out["NEdR_kN"] = M_calc * 1e3, N_calc * 1e3
            warn.append("Section en T (MEdA > MTu) : μlu calculé avec γM, γN globaux et νu = NEdR/(bw.d.fcu) — approximation.")
    mu_cu = M_calc / (b * d * d * fcu)
    nu = N_calc / (b * d * fcu)
    gM = MEdA / MserA if MserA != 0 else float("inf")
    gN = N / Ns if Ns != 0 else float("inf")
    out.update({"b_calc_m": b, "mu_cu": mu_cu, "nu_u": nu, "gamma_M": gM, "gamma_N": gN})

    if mat["mu_lu_override"] is not None:
        mu_lu = float(mat["mu_lu_override"])
        out["mu_lu_source"] = "imposé (override : valeur lue dans une table)"
    elif mat["sigma_c_limited"]:
        mu_lu = mu_lu_composee(mat, nu, gM, gN)
        out["mu_lu_source"] = "solveur exact (ELS couplé, équivalent des tableaux A3)"
        if mu_lu is None:
            mu_lu = mu_ls(mat)
            warn.append("μlu (ELS) introuvable : μls utilisé.")
            out["mu_lu_source"] = "μls (repli)"
    else:
        mu_lu = mu_ls(mat)
        out["mu_lu_source"] = "μls (σc non limitée)"
    out["mu_lu"] = mu_lu
    out["mu_BO"] = lam * (1 - lam / 2)                   # x = d

    dprime = dp / d
    if mu_cu <= mu_lu:
        au = (1 - math.sqrt(1 - 2 * mu_cu)) / lam
        eps1 = ECU * (1 - au) / au
        s1 = fyd if eps1 >= mat["eps_yd"] else ES * eps1
        zc = d * (1 - 0.6 * mu_cu) if mu_cu <= 0.225 else d * (1 - lam * au / 2)
        Asf = M_calc / (zc * s1)
        As2 = 0.0
        out.update({"As2_needed": False, "alpha_u": au, "eps_s1": eps1, "sigma_s1": s1, "z_c": zc})
    else:
        Mlu = mu_lu * b * d * d * fcu
        if fck <= 35 and abs(mat["fyk"] - 500) < 1e-6 and abs(mat["gamma_s"] - 1.15) < 1e-6:
            A_ = 0.5 / ae + 13
            B_ = 6517 / ae + 1
            s2e = mat["k1"] * ae * gM * fck - dprime * (A_ * fck + B_)
            s1e = min((A_ * fck + B_) - mat["k1"] * ae * gM * fck, fyd)
            out.update({"A_coef": A_, "B_coef": B_})
        else:
            s2e = s1e = fyd
            warn.append("fck > 35 MPa ou acier ≠ S500/γs 1,15 : formules de σs2,e / σs1,e non couvertes → σ = fyd (côté sécurité).")
        s2e = min(s2e, fyd)
        if s2e <= 0.05 * fyd:
            warn.append("Aciers comprimés quasi inefficaces (σs2,e trop faible) : augmenter la section.")
            s2e = 0.05 * fyd
        As2 = (M_calc - Mlu) / ((d - dp) * s2e)
        au = (1 - math.sqrt(1 - 2 * mu_lu)) / lam
        zc = d * (1 - 0.6 * mu_lu) if mu_lu <= 0.225 else d * (1 - lam * au / 2)
        Asf = Mlu / (zc * s1e) + As2 * s2e / s1e
        s1 = s1e
        out.update({"As2_needed": True, "M_lu_kNm": Mlu * 1e3, "sigma_s2_e": s2e, "sigma_s1_e": s1e,
                    "alpha_u": au, "z_c": zc})
    As1 = Asf - N_calc / s1                               # section réelle en flexion composée
    out.update({"A_s1_flexion_simple_cm2": Asf * 1e4, "As2_cm2": As2 * 1e4,
                "N_over_sigma_cm2": N_calc / s1 * 1e4, "As1_calc_cm2": As1 * 1e4})
    return out, {"As1": max(As1, 0.0) * 1e4, "As2": As2 * 1e4}


# ------------------------------------------------------------------ armatures minimales / maximales
def as_min_general(g, mat, e0ser):
    """Section minimale (9.1N) ou, si la maîtrise de la fissuration est requise, calcul rigoureux du cours."""
    fyk, fctm = mat["fyk"], mat["fctm"]
    bt = g.bw
    fct_eff = fctm if mat["crack_control"] else max((1.6 - g.h) * fctm, fctm)   # h en m : h_mm/1000
    formula = max(0.26 * fct_eff / fyk * bt * g.d, 0.0013 * bt * g.d) * 1e4
    res = {"fct_eff": fct_eff, "As_min_9_1N_cm2": formula, "As_max_cm2": 0.04 * g.Ac * 1e4,
           "As_min_cm2": formula}
    if mat["crack_control"]:
        e0 = e0ser
        if g.type == "rect":
            val = 0.23 * fctm / fyk * g.bw * g.d * (e0 - 0.45 * g.d) / (e0 - 0.185 * g.d) * 1e4
        else:
            den = g.Ac * e0 * g.vc - g.I
            val = (g.Ac * fctm / fyk * g.I / (0.9 * g.d) * (e0 - g.vpc + 0.1 * g.d) / den * 1e4
                   if den != 0 else 0.0)
        res["As_min_fissuration_cm2"] = max(val, 0.0)
        res["As_min_cm2"] = max(val, 0.0)
    return res


# ------------------------------------------------------------------ CAS B : section entièrement tendue
def case_B(g, mat, N, M0, Ns, Ms0):
    d, dp = g.d, g.dp
    e0 = M0 / N                                          # < 0
    yC = g.vpc - e0
    eA1, eA2 = d - yC, yC - dp
    zA = eA1 + eA2
    Nabs = abs(N) / 1e3
    fyd = mat["fyd"]
    As1 = Nabs * eA2 / (zA * fyd) * 1e4
    As2 = Nabs * eA1 / (zA * fyd) * 1e4
    out = {"e0": e0, "y_C": yC, "eA1": eA1, "eA2": eA2, "zA": zA,
           "As1_cm2": As1, "As2_cm2": As2, "sigma_s": fyd}
    e0s = Ms0 / Ns if Ns != 0 else e0
    den = g.Ac * e0s * g.vc - g.I
    Nf = g.Ac * g.I * mat["fctm"] / den if den != 0 else 0.0     # MN, < 0
    out["Nf_MN"] = Nf
    out["As1_min_cm2"] = abs(Nf) * eA2 / (zA * mat["fyk"]) * 1e4
    out["As2_min_cm2"] = abs(Nf) * eA1 / (zA * mat["fyk"]) * 1e4
    return out


# ------------------------------------------------------------------ MOTEUR d'interaction (rectangle b x h)
class RectEngine:
    """Compatibilité des déformations, parabole-rectangle (n=2, εc2=2‰, εcu2=3,5‰), aciers élasto-plastiques
    parfaits (palier horizontal). y depuis la fibre la plus comprimée ; compression positive ;
    moments pris autour de la nappe basse As (niveau d)."""

    def __init__(self, b, h, d, dp, fcd, fyd):
        self.b, self.h, self.d, self.dp, self.fcd, self.fyd = b, h, d, dp, fcd, fyd

    def block(self, x):
        h = self.h
        if x <= h:
            p, H = 3 * x / 7, x
        else:
            p, H = 3 * h / 7, h
        L = H - p
        lam = L / (x - p)
        b, f = self.b, self.fcd
        Fc = b * f * (p + L * (1 - lam ** 2 / 3))
        M0 = b * f * (p * p / 2 + p * L * (1 - lam ** 2 / 3) + L * L * (0.5 - lam ** 2 / 4))
        return Fc, M0 / Fc, lam

    def eps(self, x, y):
        et = ECU if x <= self.h else EC2 * x / (x - 3 * self.h / 7)
        return et * (x - y) / x

    def sig(self, e):
        return max(-self.fyd, min(self.fyd, ES * e))

    def state(self, x, Asc, As):
        Fc, yc, lam = self.block(x)
        s1, s2 = self.sig(self.eps(x, self.dp)), self.sig(self.eps(x, self.d))
        return {"N": Fc + Asc * s1 + As * s2,
                "MA": Fc * (self.d - yc) + Asc * s1 * (self.d - self.dp),
                "Fc": Fc, "yc": yc, "lambda": lam, "sigma_sc": s1, "sigma_s": s2,
                "psi": Fc / (self.b * self.h * self.fcd)}

    def capacity(self, N, Asc, As):
        f = lambda x: self.state(x, Asc, As)["N"] - N
        xlo, xhi = 0.02 * self.h, 1e5 * self.h
        if f(xhi) < 0 or f(xlo) > 0:
            return None
        x = bisect(f, xlo, xhi)
        st = self.state(x, Asc, As)
        st["x"] = x
        return st


# ------------------------------------------------------------------ CAS C : x > d (section comprimée)
def case_C(g, mat, N, M0, opt, warn):
    d, dp, h = g.d, g.dp, g.h
    fcd, fyd = mat["fcd"], mat["fyd"]
    N_MN = N / 1e3
    MEdA = M0 / 1e3 + N_MN * (d - g.vpc)
    b = g.bw
    Nred, Mred = N_MN, MEdA
    out = {"MEdA_kNm": MEdA * 1e3}
    if g.type == "t":
        if g.hf > 3 * h / 7 + 1e-9:
            raise ValueError("Section en T avec hf > 3h/7 en compression : non couvert (table non entièrement sous fcd).")
        Nred = N_MN - (g.beff - g.bw) * g.hf * fcd
        Mred = MEdA - (g.beff - g.bw) * g.hf * fcd * (d - g.hf / 2)
        out.update({"N_ur_kN": Nred * 1e3, "M_urA_kNm": Mred * 1e3,
                    "t_section": "table entièrement comprimée sous fcd : Nur, MurA sur bw.h"})
    eng = RectEngine(b, h, d, dp, fcd, fyd)
    dh = d / h
    e_lim = g.vpc - dp - 0.81 * b * d * fcd * (0.416 * d - dp) / Nred
    Asc1 = (Mred - b * h * fcd * (d - h / 2)) / (fyd * (d - dp))
    Asc2 = (Mred - b * h * fcd * (0.81 * d - 0.337 * h)) / (fyd * (d - dp))
    out.update({"mu_BC": 0.81 * dh * (1 - 0.416 * dh), "e_o_lim_m": e_lim,
                "Asc1_cm2": Asc1 * 1e4, "Asc2_cm2": Asc2 * 1e4})

    st_in = opt.get("compressed", {})
    chi = st_in.get("chi", 1.0)
    Asc_imp, As_imp = st_in.get("Asc_cm2"), st_in.get("As_cm2")
    As_tot_min = max(0.10 * abs(Nred) / fyd, 0.002 * g.Ac) * 1e4
    As_tot_max = 0.04 * g.Ac * 1e4
    out["As_tot_min_cm2"], out["As_tot_max_cm2"] = As_tot_min, As_tot_max

    def Rd(a, s):
        return eng.capacity(Nred, a / 1e4, s / 1e4)

    if Asc_imp is not None:
        out["design_mode"] = f"Asc imposée = {Asc_imp} cm² : As calculée"
        fa = lambda s: (Asc_imp, s)
    elif As_imp is not None:
        out["design_mode"] = f"As imposée = {As_imp} cm² : Asc calculée"
        fa = lambda s: (s, As_imp)
    else:
        out["design_mode"] = f"rapport χ = As/Asc = {chi} (χ = 1 : armatures symétriques)"
        fa = lambda s: (s, chi * s)

    def excess(s):
        r = Rd(*fa(s))
        return (r["MA"] - Mred) if r else -1.0

    grid = [0.0] + [0.05 * (1.12 ** i) for i in range(0, 90)]     # 0 ... ~1e3 cm²
    found, prev = None, grid[0]
    for s in grid:
        if excess(s) >= -1e-12:
            found = (prev, s)
            break
        prev = s
    if found is None:
        raise ValueError("Aucune armature ne permet d'équilibrer (N, M) : augmenter b, h ou fck.")
    s_req = 0.0 if found[1] == 0.0 else (bisect(excess, found[0], found[1], n=100) or found[1])
    Asc_req, As_req = fa(s_req)
    out.update({"Asc_req_cm2": Asc_req, "As_req_cm2": As_req})

    governed = (Asc_req + As_req) < As_tot_min
    if governed:
        if Asc_imp is not None:
            Asc_f, As_f = Asc_imp, max(As_tot_min - Asc_imp, As_req)
        elif As_imp is not None:
            As_f, Asc_f = As_imp, max(As_tot_min - As_imp, Asc_req)
        else:
            Asc_f = As_tot_min / (1 + chi)
            As_f = chi * Asc_f
    else:
        Asc_f, As_f = Asc_req, As_req
    out.update({"Asc_cm2": Asc_f, "As_cm2": As_f, "governed_by_min": governed})
    if Asc_f + As_f > As_tot_max:
        warn.append(f"As total = {Asc_f + As_f:.1f} cm² > As,max = {As_tot_max:.1f} cm² : revoir le coffrage.")

    r = None if governed else Rd(Asc_req, As_req)
    if governed:
        out["state_note"] = ("armatures minimales (9.12N) gouvernent : (N, M) est strictement à l'intérieur du domaine, "
                             "la position de l'axe neutre n'est pas déterminante")
    if r is not None:
        x = r["x"]
        region = ("pivot C, région 3 (x > h)" if x > h else "pivot B, région 2b (d < x ≤ h)" if x > d
                  else "x ≤ d (revoir : cas A)")
        out["state"] = {"x_m": x, "xi_h": x / h, "region": region, "psi": r["psi"], "delta_G": r["yc"] / h,
                        "lambda_def": r["lambda"], "sigma_sc_MPa": r["sigma_sc"], "sigma_s_MPa": r["sigma_s"],
                        "Fc_kN": r["Fc"] * 1e3, "MRd_A_kNm": r["MA"] * 1e3}
        if x > h and Asc_req > 0 and not governed:
            psi, lam = r["psi"], r["lambda"]
            chi_eff = As_req / Asc_req
            mu_h = (Mred - Asc_req / 1e4 * fyd * (d - dp)) / (b * h * h * fcd)
            out["book_crosscheck"] = {
                "mu_du_h": mu_h, "mu_du_h_formule_psi": 0.357 + psi * (dh - 0.857),
                "delta_G_formule": 0.857 - 0.357 / psi,
                "lambda_formule": math.sqrt(21 / 4 * (1 - psi)),
                "sigma_s_formule": min(100 * (4 + 3 * lam - 7 * dh * lam), fyd),
                "Asc_formule_N_cm2": (Nred - psi * b * h * fcd) / (fyd + chi_eff * r["sigma_s"]) * 1e4,
                "sigma_sc_eq_fyd": abs(r["sigma_sc"] - fyd) < 1e-6}
    return out, {"Asc": Asc_f, "As": As_f}, eng, Nred, Mred


# ------------------------------------------------------------------ barres (propositions)
def propose_bars(area_cm2, n_files):
    if area_cm2 <= 1e-9:
        return []
    cands = []
    for phi in LONG_DIAMS:
        for mult in (1, 2, 3):
            n = n_files * mult
            a = n * bar_area(phi)
            if a >= area_cm2 - 1e-9:
                cands.append({"n": n, "phi": phi, "area_cm2": round(a, 2),
                              "overshoot_pct": round((a / area_cm2 - 1) * 100, 1) if area_cm2 > 0 else None})
    cands.sort(key=lambda c: (c["area_cm2"], c["phi"]))
    return cands[:4]


# ------------------------------------------------------------------ ELS (cas A)
def els_block(g, mat, sA1, sA2, Ns, e0ser, checks, warn):
    ae = mat["alpha_e"]
    u = els_uncracked(g, ae, sA1 / 1e4, sA2 / 1e4, Ns / 1e3, e0ser)
    fct_eff = mat["fctm"] if mat["crack_control"] else max((1.6 - g.h) * mat["fctm"], mat["fctm"])
    out = {"uncracked": u, "fct_eff": fct_eff}
    if u["sigma_ct"] >= -fct_eff:
        out["state"] = "section non fissurée"
        s_c, s_s = u["sigma_c"], max(u["sigma_s1"], u["sigma_s2"])
        out["final"] = {"sigma_c": s_c, "sigma_s1": u["sigma_s1"], "sigma_s2": u["sigma_s2"]}
    else:
        c = els_cracked(g, ae, sA1 / 1e4, sA2 / 1e4, Ns / 1e3, e0ser)
        out["state"] = "section fissurée"
        if c is None:
            warn.append("ELS fissuré : équilibre introuvable.")
            return out
        out["cracked"] = c
        out["final"] = {"sigma_c": c["sigma_c"], "sigma_s1": c["sigma_s1"], "sigma_s2": c["sigma_s2"]}
        s_c, s_s = c["sigma_c"], c["sigma_s1"]
        if not c["one_tension_layer"]:
            warn.append("ELS : x1 > d, la nappe As1 n'est plus tendue : vérifier le modèle.")
    if mat["sigma_c_limited"]:
        checks.append({"name": "ELS σc ≤ σc̄", "ok": s_c <= mat["sigma_c_bar"], "value": s_c, "limit": mat["sigma_c_bar"]})
    checks.append({"name": "ELS σs ≤ σs̄", "ok": s_s <= mat["sigma_s_bar"], "value": s_s, "limit": mat["sigma_s_bar"]})
    return out


# ------------------------------------------------------------------ programme principal
def full_design(g, mat, N, M0, Ns, Ms0, opts, n_files, actual, e0ser):
    """Classification (A/B/C) + dimensionnement complet (ELU, ELS, recoupements) pour un couple (N, M0)
    donné. Appelée une ou deux fois par run() : une 2e fois si la dispense d'élancement doit être
    reconsidérée une fois l'acier réel connu (voir la re-vérification de l'élancement dans run())."""
    warn, notes, checks = [], [], []
    e0_sg = M0 / N                                       # excentricité avec le signe de N (M0 >= 0)
    # ---- classification
    yC = g.vpc - e0_sg
    cls = {"y_C_m": yC}
    if N < 0:
        cls["case"] = "B" if g.dp <= yC <= g.d else "A"
        cls["reason"] = ("traction, C entre les nappes → section entièrement tendue" if cls["case"] == "B"
                         else "traction, C hors des nappes → section partiellement tendue")
    else:
        e_lim = g.vpc - g.dp - 0.81 * g.beff * g.d * mat["fcd"] * (0.416 * g.d - g.dp) / (N / 1e3)
        cls["e_o_lim_m"] = e_lim
        if e0_sg >= e_lim:
            cls["case"], cls["reason"] = "A", "compression, e0 ≥ e0,lim → x ≤ d : section partiellement tendue (pivot B, région 2a)"
        else:
            cls["case"], cls["reason"] = "C", "compression, e0 < e0,lim → x > d : pivot B région 2b ou pivot C région 3"

    res = {"classification": cls}

    if cls["case"] == "A":
        wA = []
        elu, need = case_A(g, mat, N, M0, Ns, Ms0, wA)
        if N > 0 and elu["As1_calc_cm2"] <= 0:
            cls["case"] = "C"
            cls["reason"] += (" — bascule : As1 ≤ 0 en flexion simple équivalente (x > d, aciers tous comprimés, "
                              "l'assimilation à la flexion simple n'est plus valable) → traité comme cas C")
            notes.append("Bascule automatique A → C (As1 ≤ 0).")
        else:
            warn.extend(wA)
    if cls["case"] == "A":
        res["elu"] = elu
        amin = as_min_general(g, mat, e0ser)
        res["minmax"] = amin
        As1_req = max(need["As1"], amin["As_min_cm2"])
        As2_req = need["As2"]
        c1 = propose_bars(As1_req, n_files)
        c2 = propose_bars(As2_req, n_files) if As2_req > 0 else []
        res["reinforcement"] = {"As1_calc_cm2": need["As1"], "As2_calc_cm2": As2_req, "As1_required_cm2": As1_req,
                                "As1_governed_by_min": need["As1"] < amin["As_min_cm2"],
                                "candidates_As1": c1, "candidates_As2": c2}
        checks.append({"name": "As1 ≥ As,min", "ok": need["As1"] >= amin["As_min_cm2"],
                       "value": need["As1"], "limit": amin["As_min_cm2"]})
        checks.append({"name": "As1, As2 ≤ 0,04 Ac", "ok": max(As1_req, As2_req) <= amin["As_max_cm2"],
                       "value": max(As1_req, As2_req), "limit": amin["As_max_cm2"]})
        if actual:
            sA1, sA2, srcs = actual["As1_cm2"], actual.get("As2_cm2", 0.0), "actual_steel (entrée)"
        else:
            sA1 = c1[0]["area_cm2"] if c1 else As1_req
            sA2 = c2[0]["area_cm2"] if c2 else 0.0
            srcs = "1ère proposition de barres"
        res["reinforcement"]["steel_used_for_ELS"] = {"As1_cm2": sA1, "As2_cm2": sA2, "source": srcs}
        if opts.get("els_check", True):
            res["els"] = els_block(g, mat, sA1, sA2, Ns, e0ser, checks, warn)
        # recoupement ELU indépendant (parabole-rectangle) — informatif, section rectangulaire
        if g.type == "rect" or (g.type == "t" and abs(g.beff - g.bw) < 1e-12):
            eng = RectEngine(g.bw, g.h, g.d, g.dp, mat["fcd"], mat["fyd"])
            cap = eng.capacity(N / 1e3, sA2 / 1e4, sA1 / 1e4)
            if cap:
                MEdA_kNm = elu["MEdA_kNm"]
                res["cross_check_engine"] = {"MRd_A_kNm": cap["MA"] * 1e3, "MEdA_kNm": MEdA_kNm,
                                             "utilisation": MEdA_kNm / (cap["MA"] * 1e3), "x_m": cap["x"],
                                             "note": "diagramme parabole-rectangle avec les armatures retenues ; "
                                                     "le calcul principal utilise le bloc rectangulaire"}
                if MEdA_kNm / (cap["MA"] * 1e3) > 1.03:
                    warn.append("Recoupement ELU (parabole-rectangle) : utilisation > 1,03 avec les armatures retenues.")
    if cls["case"] == "B":
        elu = case_B(g, mat, N, M0, Ns, Ms0)
        res["elu"] = elu
        As1_req = max(elu["As1_cm2"], elu["As1_min_cm2"])
        As2_req = max(elu["As2_cm2"], elu["As2_min_cm2"])
        c1, c2 = propose_bars(As1_req, n_files), propose_bars(As2_req, n_files)
        res["reinforcement"] = {"As1_calc_cm2": elu["As1_cm2"], "As2_calc_cm2": elu["As2_cm2"],
                                "As1_required_cm2": As1_req, "As2_required_cm2": As2_req,
                                "candidates_As1": c1, "candidates_As2": c2}
        checks.append({"name": "As1 ≥ As,min1", "ok": elu["As1_cm2"] >= elu["As1_min_cm2"],
                       "value": elu["As1_cm2"], "limit": elu["As1_min_cm2"]})
        checks.append({"name": "As2 ≥ As,min2", "ok": elu["As2_cm2"] >= elu["As2_min_cm2"],
                       "value": elu["As2_cm2"], "limit": elu["As2_min_cm2"]})
        if actual:
            sA1, sA2, srcs = actual["As1_cm2"], actual["As2_cm2"], "actual_steel (entrée)"
        else:
            sA1, sA2, srcs = c1[0]["area_cm2"], c2[0]["area_cm2"], "1ère proposition de barres"
        res["reinforcement"]["steel_used_for_ELS"] = {"As1_cm2": sA1, "As2_cm2": sA2, "source": srcs}
        ySC = g.vpc - Ms0 / Ns
        eA1s, eA2s = g.d - ySC, ySC - g.dp
        zAs = eA1s + eA2s
        s1 = abs(Ns) / 1e3 * eA2s / (zAs * sA1 * 1e-4)
        s2 = abs(Ns) / 1e3 * eA1s / (zAs * sA2 * 1e-4)
        res["els"] = {"sigma_s1": s1, "sigma_s2": s2, "sigma_s_max": max(s1, s2), "sigma_s_bar": mat["sigma_s_bar"]}
        checks.append({"name": "ELS σs,max ≤ σs̄", "ok": max(s1, s2) <= mat["sigma_s_bar"],
                       "value": max(s1, s2), "limit": mat["sigma_s_bar"]})
    if cls["case"] == "C":
        elu, need, eng, Nred, Mred = case_C(g, mat, N, M0, opts, warn)
        res["elu"] = elu
        cA, cB = propose_bars(need["Asc"], n_files), propose_bars(need["As"], n_files)
        res["reinforcement"] = {"Asc_cm2": need["Asc"], "As_cm2": need["As"],
                                "candidates_Asc": cA, "candidates_As": cB}
        tot = need["Asc"] + need["As"]
        checks.append({"name": "As,tot ≥ As,min (9.12N)", "ok": tot >= elu["As_tot_min_cm2"] - 1e-9,
                       "value": tot, "limit": elu["As_tot_min_cm2"]})
        checks.append({"name": "As,tot ≤ As,max = 0,04 Ac", "ok": tot <= elu["As_tot_max_cm2"],
                       "value": tot, "limit": elu["As_tot_max_cm2"]})
        if actual:
            sAsc, sAs = actual.get("As2_cm2"), actual.get("As1_cm2")
        else:
            sAsc = cA[0]["area_cm2"] if cA else need["Asc"]
            sAs = cB[0]["area_cm2"] if cB else need["As"]
        cap = eng.capacity(Nred, sAsc / 1e4, sAs / 1e4)
        if cap:
            util = Mred / cap["MA"]
            res["resistance"] = {"steel_used": {"Asc_cm2": sAsc, "As_cm2": sAs}, "x_m": cap["x"],
                                 "MRd_A_kNm": cap["MA"] * 1e3, "MEdA_kNm": Mred * 1e3, "utilisation": util}
            checks.append({"name": "MRd(NEd) ≥ MEd (armatures retenues)", "ok": util <= 1.0 + 1e-9,
                           "value": util, "limit": 1.0})
        if opts.get("els_check", True):
            u = els_uncracked(g, mat["alpha_e"], sAs / 1e4, sAsc / 1e4, Ns / 1e3, e0ser)
            u["core_ok"] = u["sigma_ct"] >= 0
            res["els"] = u
            if mat["sigma_c_limited"]:
                checks.append({"name": "ELS σc ≤ σc̄", "ok": u["sigma_c"] <= mat["sigma_c_bar"],
                               "value": u["sigma_c"], "limit": mat["sigma_c_bar"]})
            if u["sigma_ct"] < 0:
                warn.append("ELS : σ < 0 sur la fibre inférieure : section fissurée à l'ELS (C hors du noyau central).")
    As_total_required_cm2 = {
        "A": As1_req + As2_req if cls["case"] == "A" else 0.0,
        "B": As1_req + As2_req if cls["case"] == "B" else 0.0,
        "C": need["Asc"] + need["As"] if cls["case"] == "C" else 0.0,
    }[cls["case"]]
    return res, As_total_required_cm2, warn, notes, checks


def run(inp):
    warn, notes, checks = [], [], []
    mat = materials(inp["materials"])
    g = Geom(inp["section"])
    ld = inp["loads"]
    sl = inp.get("slenderness")
    opts = inp.get("options", {})

    # ---- sollicitations ELU
    if "NEd_kN" in ld:
        N, e1, src = ld["NEd_kN"], ld["MEdG0_kNm"] / ld["NEd_kN"], "direct"
    else:
        gG, gQ = ld.get("gamma_G", 1.35), ld.get("gamma_Q", 1.5)
        N = gG * ld.get("NG_kN", 0) + gQ * ld.get("NQ_kN", 0)
        e1 = (gG * ld.get("MG_kNm", 0) + gQ * ld.get("MQ_kNm", 0)) / N
        src = "combinaison ELU"
    ei = de0 = 0.0
    sled = None
    if sl and N > 0:
        sled = slenderness_check(g, mat, N, sl)
        imp = sl.get("imperfection", "l0/400")
        if sled and imp == "l0/400":
            ei = sled["l0"] / 400.0
        elif imp == "theta":
            l_theta = sl.get("l_m") or (sled["l0"] if sled else None)
            m_elem = sl.get("m_elements", 1)
            theta0 = 1.0 / 200.0
            alpha_h = max(2.0 / 3.0, min(1.0, 2.0 / math.sqrt(l_theta))) if l_theta else 1.0
            alpha_m = 0.5 * (1 + 1.0 / m_elem)
            theta_i = theta0 * alpha_h * alpha_m
            ei = theta_i * sled["l0"] / 2.0 if sled else 0.0
        elif isinstance(sl.get("imperfection"), (int, float)):
            ei = float(sl["imperfection"])
        if sl.get("symmetric_reinforcement"):
            de0 = max(0.020, g.h / 30.0)
        if sled:
            for plane in ("plane_h", "plane_b"):
                if plane in sled:
                    checks.append({"name": f"Élancement {plane} : λ ≤ λlim", "ok": sled[plane]["ok"],
                                   "value": sled[plane]["lambda"], "limit": sled["lambda_lim"]})
    sgn = 1.0 if e1 >= 0 else -1.0
    e0 = e1 + sgn * (ei + de0) if N > 0 else e1
    M_signed = N * e0
    M0 = abs(M_signed)
    if M_signed < 0:
        notes.append("M < 0 : section retournée (As1 = nappe côté fibre tendue, As2 = côté fibre comprimée).")
        if g.type == "t":
            warn.append("Section en T avec table tendue (M < 0) : calculée comme rectangle bw × h (table ignorée).")
            g = Geom({"type": "rect", "b_cm": g.bw * 100, "h_cm": g.h * 100, "d_cm": g.d * 100, "dp_cm": g.dp * 100})
    if "Nser_kN" in ld:
        Ns, Ms0 = ld["Nser_kN"], abs(ld["MserG0_kNm"])
    else:
        Ns = ld.get("NG_kN", 0) + ld.get("NQ_kN", 0)
        Ms0 = abs(ld.get("MG_kNm", 0) + ld.get("MQ_kNm", 0))
    if N == 0:
        raise ValueError("N = 0 : flexion simple → utiliser le skill ec2-flexion-simple.")
    e0_sg = M0 / N                                       # excentricité avec le signe de N (M0 >= 0)
    e0ser = Ms0 / Ns if Ns != 0 else 0.0
    loads_out = {"source": src, "NEd_kN": N, "e1_m": e1, "ei_m": ei, "delta_e0_m": de0, "e0_m": e0_sg,
                 "MEdG0_kNm": M0, "Nser_kN": Ns, "MserG0_kNm": Ms0, "e0ser_m": e0ser}

    # ---- second ordre (si λ > λlim dans le plan de flexion) : M0 est réévalué (1er + 2e ordre) et
    # sert ensuite de moment d'entrée à la classification et au dimensionnement, comme dans le corps du skill.
    second_order = None
    if sled and not sled["plane_h"]["ok"]:
        so_mode = opts.get("second_order", "auto")
        if so_mode == "none":
            warn.append("λ > λlim dans le plan de flexion : effets du second ordre NON pris en compte "
                        "(options.second_order='none') — résultats du 1er ordre seulement, non valables en l'état.")
        else:
            second_order = apply_second_order(g, mat, N, M0, Ns, Ms0, sled, sl, opts, warn, notes, e1_bare_m=e1)
            M0 = second_order["MEd_kNm"]
            e0_sg = M0 / N

    res = {"materials": mat,
           "section": {"type": g.type, "h": g.h, "bw": g.bw, "beff": g.beff, "hf": g.hf, "d": g.d, "dp": g.dp,
                       "Ac_m2": g.Ac, "v_prime_c": g.vpc, "I_m4": g.I},
           "loads": loads_out, "slenderness": sled}
    n_files = opts.get("n_files", 3)
    actual = inp.get("actual_steel")                     # As1_cm2 (bas / tendus), As2_cm2 (haut / comprimés)

    design_res, As_total_required_cm2, d_warn, d_notes, d_checks = full_design(
        g, mat, N, M0, Ns, Ms0, opts, n_files, actual, e0ser)

    # ---- re-vérification de l'élancement : une fois l'acier réel connu, B = √(1+2ω) n'est plus
    # forcément la valeur par défaut (1,1) utilisée pour la dispense initiale. Si la dispense n'est
    # plus justifiée avec le B réel, le second ordre est appliqué rétroactivement et le
    # dimensionnement est refait avec le moment total corrigé. Les messages ajoutés directement à
    # warn/notes/checks (les listes de run(), pas d_warn/d_notes/d_checks) survivent même si
    # design_res/d_warn/d_notes/d_checks sont ensuite écrasés par le 2e appel à full_design().
    if sled is not None and second_order is None and N > 0:
        omega_real = (As_total_required_cm2 * 1e-4) * mat["fyd"] / (g.Ac * mat["fcd"])
        B_real = math.sqrt(1 + 2 * omega_real)
        lam_lim_real = 20.0 * sled["A"] * B_real * sled["C"] / math.sqrt(sled["n"]) if sled["n"] > 0 else float("inf")
        lam_h = sled["plane_h"]["lambda"]
        ok_real = lam_h <= lam_lim_real
        checks.append({"name": "Élancement (B recalculé avec l'acier réel) : λ ≤ λlim", "ok": ok_real,
                       "value": lam_h, "limit": lam_lim_real})
        slenderness_recheck = {"As_total_used_cm2": As_total_required_cm2, "omega_real": omega_real,
                               "B_assumed": sled["B"], "B_real": B_real,
                               "lambda_lim_real": lam_lim_real, "ok": ok_real}
        if not ok_real:
            warn.append(f"Élancement : la dispense initiale (B={sled['B']:.3f} par défaut, ω inconnu) "
                       f"n'est plus justifiée une fois l'acier réel connu (ω={omega_real:.3f} → B={B_real:.3f} "
                       f"→ λlim={lam_lim_real:.2f} < λ={lam_h:.2f}) : second ordre appliqué rétroactivement, "
                       "le dimensionnement ci-dessous est refait avec le moment total corrigé.")
            notes.append("1er dimensionnement (sans second ordre) écarté : la dispense d'élancement qui le "
                         "justifiait ne tenait qu'à l'hypothèse par défaut B=1,1 (ω inconnu) ; l'acier réel "
                         "donne un B plus faible qui invalide cette dispense.")
            second_order = apply_second_order(g, mat, N, M0, Ns, Ms0, sled, sl, opts, warn, notes, e1_bare_m=e1)
            M0 = second_order["MEd_kNm"]
            design_res, As_total_required_cm2, d_warn, d_notes, d_checks = full_design(
                g, mat, N, M0, Ns, Ms0, opts, n_files, actual, e0ser)
            checks.append({"name": "Élancement (dimensionnement refait avec second ordre)", "ok": True,
                          "value": lam_h, "limit": lam_lim_real})
        res["slenderness_recheck"] = slenderness_recheck

    res.update(design_res)
    warn.extend(d_warn)
    notes.extend(d_notes)
    checks.extend(d_checks)
    res["second_order"] = second_order

    res["checks"], res["warnings"], res["notes"] = checks, warn, notes
    res["all_ok"] = all(c["ok"] for c in checks)
    return clean(res)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input")
    ap.add_argument("-o", "--output")
    a = ap.parse_args()
    with open(a.input, encoding="utf-8") as f:
        inp = json.load(f)
    txt = json.dumps(run(inp), ensure_ascii=False, indent=2)
    if a.output:
        with open(a.output, "w", encoding="utf-8") as f:
            f.write(txt)
    else:
        print(txt)


if __name__ == "__main__":
    main()
