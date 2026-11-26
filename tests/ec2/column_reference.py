#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Auto-test : rejoue les exemples du chapitre 12 de Paillé (scripts/examples/*.json) et vérifie les
valeurs clés (moments, besoins d'acier, niveau de la cascade). Code retour 0 si tout est conforme.

    python3 selftest.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HERE = os.path.join(ROOT, "public", "ec2-engine", "skills", "ec2-poteau-complet", "scripts")
os.environ["EC2_SKILLS_ROOT"] = os.path.join(ROOT, "public", "ec2-engine", "skills")
sys.path.insert(0, HERE)
import poteau_complet_ec2 as P      # noqa: E402

EX = os.path.join(ROOT, "tests", "ec2", "fixtures", "ec2-poteau-complet")


def load(name):
    with open(os.path.join(EX, name + ".json"), encoding="utf-8") as f:
        return json.load(f)


def crit(res, plane="y"):
    """Section critique avec 2nd ordre du plan donné (premier cas qui en comporte une)."""
    for it in res["verification"]["sections"]:
        if it["plane"] == plane:
            for s in it["sections"]:
                if s.get("second_order"):
                    return s
    return None


CHECKS = []


def check(name, value, expected, tol):
    ok = abs(value - expected) <= tol
    CHECKS.append(ok)
    print("  %s %-58s %10.3f  (attendu %.3f ± %.3f)" % ("OK " if ok else "KO ", name, value, expected, tol))


def check_eq(name, value, expected):
    ok = value == expected
    CHECKS.append(ok)
    print("  %s %-58s %10s  (attendu %s)" % ("OK " if ok else "KO ", name, value, expected))


def main():
    print("12.7.3.3 — compression centrée puis e0 min (livre : 8,9 ; 9 cm²/face)")
    r = P.run(load("ex_12_7_3_3"))
    check_eq("porte stricte : niveau 1 applicable", r["cascade"][0]["applicable"], False)
    check("porte stricte : λlim par défaut, plan z", r["cascade"][0]["entry_check"]["lambda_gate"][1]["lam_lim_default"], 10.15, 0.05)
    inp = load("ex_12_7_3_3")
    inp["options"] = {"strict_level1_entry": False}
    r0 = P.run(inp)
    check("porte désactivée : As compression simple (cm²)", r0["cascade"][0]["As_calc_cm2"], 9.5, 0.05)
    check_eq("porte désactivée : niveau 1 rejeté par e0 → niveau final", r0["final_stage"], 2)
    check("niveau 2 : As par face, plan y (cm²)", r["reinforcement"]["As_face_req_y_cm2"], 8.86, 0.03)
    check("niveau 2 : As par face, plan z (cm²)", r["reinforcement"]["As_face_req_z_cm2"], 9.50, 0.03)
    check_eq("niveau final", r["final_stage"], 2)
    check_eq("all_ok", r["all_ok"], True)

    print("12.7.3.4 (données corrigées) — second ordre, As,min suffisant (livre : M2 ≈ 33 faux)")
    r = P.run(load("ex_12_7_3_4"))
    s = crit(r, "y")
    check("M0Ed = NEd·2 cm (kN·m)", s["second_order"]["M0Ed_kNm"], 19.8, 0.05)
    check("MEd = M0Ed + M2 (kN·m)", s["M"], 68.1, 0.6)
    check("As retenu = As,min (cm²)", r["reinforcement"]["layout"]["As_prov"], 4.52, 0.01)
    check_eq("niveau final", r["final_stage"], 3)

    print("12.7.3.6 — flexion composée 17,08/face (livre 19/face) puis 2nd ordre")
    r = P.run(load("ex_12_7_3_6"))
    check("niveau 2 : As par face, plan y (cm²)", r["cascade"][1]["As_face_req_y_cm2"], 17.08, 0.05)
    inp = load("ex_12_7_3_6")
    inp["options"] = {"strict_level1_entry": False}
    check("porte désactivée : As compression simple (cm²)", P.run(inp)["cascade"][0]["As_calc_cm2"], 20.5, 0.1)
    check_eq("niveau final", r["final_stage"], 3)

    print("12.9.1 — mât, rigidité nominale (livre : NB = 2,11 MN avec 8HA16 imposés)")
    r = P.run(load("ex_12_9_1"))
    s = crit(r, "y")
    check("M0Ed = NEd·e_i (kN·m)", s["second_order"]["M0Ed_kNm"], 23.1, 0.3)
    check_eq("méthode", s["second_order"]["method"], "rigidite")
    check_eq("all_ok", r["all_ok"], True)

    print("12.9.1 en vérification — 8HA16 imposés, répartition du livre (livre : EI 13,7 ; NB 2,11 ; MEd 46)")
    r = P.run(load("ex_12_9_1_verification"))
    so = crit(r, "y")["second_order"]
    check("EI (MN·m²)", so["EI_MNm2"], 14.0, 0.5)
    check("NB (MN)", so["NB_MN"], 2.16, 0.08)
    check("MEd (kN·m)", so["MEd_kNm"], 44.9, 1.5)
    check_eq("mode", r["final_stage"], "vérification")

    print("12.9.2 — charge horizontale à mi-hauteur, courbure (livre : 490 ; 38,3 ; 527)")
    r = P.run(load("ex_12_9_2"))
    s = crit(r, "y")
    check("M0Ed (kN·m)", s["second_order"]["M0Ed_kNm"], 488.6, 1.0)
    check("M2 (kN·m)", s["second_order"]["MEd_kNm"] - s["second_order"]["M0Ed_kNm"], 38.9, 1.0)
    check("MEd (kN·m)", s["M"], 527.4, 1.5)

    print("12.9.3 — mât 30x50, courbure (livre : 171 ; 28,5 ; 199,5 — 8,1 cm² asymétrique)")
    r = P.run(load("ex_12_9_3"))
    s = crit(r, "y")
    check("M0Ed (kN·m)", s["second_order"]["M0Ed_kNm"], 171.4, 0.5)
    check("MEd (kN·m)", s["M"], 201.0, 1.5)
    check("As par face symétrique exact, plan y (cm²)", r["reinforcement"]["As_face_req_y_cm2"], 7.19, 0.05)

    print("Combinaisons automatiques — 2 actions variables → 1 combinaison identique (ψ0 = 1)")
    check_eq("nombre de combinaisons ELU (12.9.2)", len(P.run(load("ex_12_9_2"))["combinations"]), 1)

    print("Efforts personnalisés — N intermédiaire, moments d'extrémité, vent réparti, poids propre")
    r = P.run(load("ex_efforts_personnalises"))
    check("N au pied, combinaison Q dominante (kN)", r["combinations"][0]["N_base_kN"], 3364.7, 0.5)
    check("N au pied, combinaison vent dominant (kN)", r["combinations"][1]["N_base_kN"], 2923.7, 0.5)
    check("M0Eqp plan y = M0e(G) + N_qp·e_i (kN·m)", r["cases"][0]["M0Eqp"], 4.8 + 1697.5 * 0.02, 0.1)
    check_eq("all_ok", r["all_ok"], True)

    print("Porte d'entrée stricte du niveau 1 — poteau trapu 40x40, l0 = 2,0 m (λ = 17,3 ≤ λlim par défaut = 18,3)")
    r = P.run(load("ex_poteau_trapu"))
    check_eq("niveau 1 applicable", r["cascade"][0]["applicable"], True)
    check("λlim par défaut (A=0,7 ; B=1,1 ; C=0,7)", r["cascade"][0]["entry_check"]["lambda_gate"][0]["lam_lim_default"], 18.3, 0.1)
    check_eq("niveau final", r["final_stage"], 1)
    check("As retenu = As,min (cm²)", r["reinforcement"]["layout"]["As_prov"], 4.52, 0.01)
    inp = load("ex_poteau_trapu")
    inp["geometry"]["l0_m"] = 3.0
    r = P.run(inp)
    check_eq("même poteau, l0 = 3 m : niveau 1 fermé par λ", r["cascade"][0]["applicable"], False)
    check_eq("même poteau, l0 = 3 m : départ au niveau", r["cascade"][1]["stage"], 2)

    n_ko = CHECKS.count(False)
    print("\n%d vérifications, %d écart(s)." % (len(CHECKS), n_ko))
    return 1 if n_ko else 0


if __name__ == "__main__":
    sys.exit(main())
