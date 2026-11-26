#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Auto-tests du skill ec2-flexion-composee : à rejouer avant toute modification du script.
Usage : python selftest.py     (code de sortie 0 si tout passe)"""
import json, math, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "public", "ec2-engine", "skills", "ec2-flexion-composee", "scripts"))
import flexion_composee_ec2 as F

fails = []
def check(name, got, ref, tol):
    ok = abs(got - ref) <= tol
    print(f"{'OK ' if ok else 'KO '} {name:<58} got={got:.5g} ref={ref:.5g} (tol {tol})")
    if not ok: fails.append(name)

# 1. Tableau ψ, δG du support de cours (section entièrement comprimée) --------------------------
eng = F.RectEngine(1.0, 1.0, 0.9, 0.1, 1.0, 434.78)
for xi, lam_b, psi_b, dg_b in [(1.0,1.000,0.810,0.416),(1.05,0.920,0.839,0.431),(1.5,0.533,0.946,0.480),
                               (2.0,0.364,0.975,0.491),(3.0,0.222,0.991,0.497),(5.0,0.125,0.997,0.499)]:
    Fc, yc, lam = eng.block(xi)
    check(f"ξh={xi}: λ", lam, lam_b, 0.0006); check(f"ξh={xi}: ψ", Fc, psi_b, 0.0006); check(f"ξh={xi}: δG", yc, dg_b, 0.0006)

# 2. Intégration numérique indépendante (σ-ε parabole-rectangle, tranches) ------------------------
def brute(b,h,d,dp,fcd,fyd,x,Asc,As,n=20000):
    et = F.ECU if x<=h else F.EC2*x/(x-3*h/7)
    Fc=M=0.0
    for i in range(n):
        y=(i+0.5)*h/n
        e=et*(x-y)/x
        if e>0:
            s=fcd*(1-(1-e/F.EC2)**2) if e<F.EC2 else fcd
            dF=s*b*h/n; Fc+=dF; M+=dF*(d-y)
    sig=lambda e:max(-fyd,min(fyd,200000*e))
    s1=sig(et*(x-dp)/x); s2=sig(et*(x-d)/x)
    return Fc+Asc*s1+As*s2, M+Asc*s1*(d-dp)
e2=F.RectEngine(0.30,0.50,0.45,0.05,16.667,434.78)
for x in (0.30,0.45,0.50,0.60,1.0,3.0):
    N_i,M_i=brute(0.30,0.50,0.45,0.05,16.667,434.78,x,12e-4,8e-4)
    st=e2.state(x,12e-4,8e-4)
    check(f"moteur vs intégration numérique, x={x} : N", st["N"], N_i, 2e-4*abs(N_i)+1e-4)
    check(f"moteur vs intégration numérique, x={x} : M", st["MA"], M_i, 2e-4*abs(M_i)+1e-4)

# 3. Solveur fissuré vs cubique du livre (Ex. 2) ---------------------------------------------------
g=F.Geom({"type":"rect","b_cm":50,"h_cm":50,"d_cm":45,"dp_cm":5})
As1=17.08e-4; c=g.d-(-0.36 and 68e-3/(-0.360))
c=g.d-(0.068/-0.360)
p=-3*c*c+6*15*As1/0.5*(g.d-c); q=-2*c**3-6*15*As1/0.5*(g.d-c)**2
xc=F.bisect(lambda z:z**3+p*z+q,-c+1e-9,g.d-c)
r=F.els_cracked(g,15,As1,0.0,-0.360,-0.14/0.36)
check("fissuré : x1 solveur vs cubique du livre", r["x1"], xc+c, 1e-5)

# 4. μlu vs tableaux A3 (Ex. 2 du livre, étiquettes correctes) ---------------------------------------
mat=F.materials({"fck":25,"fyk":500,"alpha_e":15,"exposure":"XD2"})
for nu,gM,gN,ref in [(0.10,1.40,1.40,0.2258),(0.10,1.45,1.40,0.2413),(0.15,1.40,1.40,0.2249),(0.15,1.45,1.45,0.2387)]:
    check(f"μlu(νu={nu}, γM={gM}, γN={gN}) vs table A3", F.mu_lu_composee(mat,nu,gM,gN), ref, 6e-4)

# 5. Exemples du livre --------------------------------------------------------------------------------
here=os.path.join(ROOT,"tests","ec2","fixtures","ec2-flexion-composee")
def run(n): return F.run(json.load(open(os.path.join(here,n))))
r=run("example_2_arrondis_livre.json"); check("Ex2 As1 (livre 16,79 cm²)", r["elu"]["As1_calc_cm2"], 16.79, 0.03)
check("Ex2 ELS σs1 (livre 307 MPa)", r["els"]["final"]["sigma_s1"], 307, 1.0)
r=run("example_3_arrondis_livre.json"); check("Ex3 As1 (livre 9,17)", r["elu"]["As1_cm2"], 9.17, 0.01); check("Ex3 As2 (livre 3,93)", r["elu"]["As2_cm2"], 3.93, 0.01)
r=run("example_1_arrondis_livre.json"); check("Ex1 As2 avec μlu du livre (livre 5,75)", r["elu"]["As2_cm2"], 5.75, 0.02); check("Ex1 As1 avec μlu du livre (livre 10,32)", r["elu"]["As1_calc_cm2"], 10.32, 0.03)

# 6. Cas C (section comprimée) : formules du support de cours vs moteur, résistance, bascule ------------
r=run("example_4_comprimee_pivotC.json"); e=r["elu"]; k=e["book_crosscheck"]
check("C pivot C : région x > h", 1.0 if e["state"]["xi_h"]>1 else 0.0, 1.0, 0)
check("C pivot C : δG moteur vs 0,857-0,357/ψ", e["state"]["delta_G"], k["delta_G_formule"], 1e-4)
check("C pivot C : λ moteur vs √(21/4.(1-ψ))", e["state"]["lambda_def"], k["lambda_formule"], 1e-4)
check("C pivot C : μdu,h vs 0,357+ψ(δh-0,857)", k["mu_du_h"], k["mu_du_h_formule_psi"], 1e-4)
check("C pivot C : σs moteur vs 100(4+3λ-7δhλ)", e["state"]["sigma_s_MPa"], k["sigma_s_formule"], 0.05)
check("C pivot C : Asc moteur vs (N-ψbhfcd)/(fyd+χσs)", e["Asc_req_cm2"], k["Asc_formule_N_cm2"], 0.01)
check("C pivot C : MRd des barres retenues ≥ MEd (util ≤ 1)", min(r["resistance"]["utilisation"],1.0), r["resistance"]["utilisation"], 1e-9)
r=run("example_5_comprimee_region2b.json"); check("C région 2b : d < x ≤ h", 1.0 if 0.45 < r["elu"]["state"]["x_m"] <= 0.50 else 0.0, 1.0, 0)
check("C région 2b : util ≤ 1", min(r["resistance"]["utilisation"],1.0), r["resistance"]["utilisation"], 1e-9)
r=run("example_6_bascule_A_vers_C.json"); check("Bascule A→C quand As1 ≤ 0", 1.0 if r["classification"]["case"]=="C" else 0.0, 1.0, 0)
for n in ("example_1_exact.json","example_2_exact.json"):
    r=run(n); check(f"{n} : recoupement moteur parabole-rectangle util ≤ 1", min(r["cross_check_engine"]["utilisation"],1.0), r["cross_check_engine"]["utilisation"], 1e-9)

# 7. Second ordre — rigidité nominale (§6) et courbure nominale (§7), vs « Maîtrise de l'Eurocode 2 », J. Roux ---
g2 = F.Geom({"type": "rect", "b_cm": 40, "h_cm": 40, "d_cm": 35, "dp_cm": 5})
mat2 = F.materials({"fck": 25, "fyk": 500, "alpha_e": 15, "exposure": "XC1"})

# App 2 (rigidité), itération 2 du livre : As=24,26 cm2/face, M0Ed=44 kNm (avec Δe0)
r = F.rigidite_M2(g2, mat2, N_kN=300, M0Ed_kNm=44.0, As_face_cm2=24.26, phi_ef=2.0, l0=12.0, lam=104.0, c0=8.0)
check("Rigidité App2 it.2 : EI (livre 8,392 MNm²)", r["EI_MNm2"], 8.392, 0.01)
check("Rigidité App2 it.2 : NB (livre 0,575 MN)", r["NB_MN"], 0.575, 0.002)
check("Rigidité App2 it.2 : beta (livre 1,234)", r["beta"], 1.234, 0.002)
check("Rigidité App2 it.2 : MEd (livre 103 kNm)", r["MEd_kNm"], 103.0, 0.5)

# App 3 (courbure), formules pures : M0Ed=38 kNm (convention du livre, sans Δe0), As=0
r = F.courbure_M2(g2, mat2, N_kN=300, M0Ed_kNm=38.0, As_face_cm2=0.0, phi_ef=2.0, l0=12.0, lam=104.0, c_curv=10.0, n_bal=0.40)
check("Courbure App3 : 1/r0 (livre 0,0138)", r["inv_r0"], 0.0138, 2e-4)
check("Courbure App3 : Kr (livre 1,00)", r["Kr"], 1.00, 1e-6)
check("Courbure App3 : Kphi (livre 1,00)", r["Kphi"], 1.00, 1e-6)
check("Courbure App3 : e2 (livre 0,199 m)", r["e2_m"], 0.199, 0.002)
check("Courbure App3 : M2 (livre 59,7 kNm)", r["M2_kNm"], 59.7, 0.5)
check("Courbure App3 : MEd (livre 97,7 kNm)", r["MEd_kNm"], 97.7, 0.5)

# App 4 (courbure + fluage calculé), pass 2 du livre : As=16,15 cm2/face, M0Ed=117 kNm, phief=0,615
g4 = F.Geom({"type": "rect", "b_cm": 30, "h_cm": 30, "d_cm": 27, "dp_cm": 3})
mat4 = F.materials({"fck": 35, "fyk": 500, "alpha_e": 15, "exposure": "XC1"})
r = F.courbure_M2(g4, mat4, N_kN=1260, M0Ed_kNm=117.0, As_face_cm2=16.15, phi_ef=0.615, l0=6.5, lam=75.0, c_curv=10.0, n_bal=0.40)
check("Courbure App4 : Kr (livre 0,842)", r["Kr"], 0.842, 0.002)
check("Courbure App4 : Kphi (livre 1,015)", r["Kphi"], 1.015, 0.002)
check("Courbure App4 : e2 (livre 0,0646 m)", r["e2_m"], 0.0646, 0.001)
check("Courbure App4 : MEd (livre 198 kNm)", r["MEd_kNm"], 198.0, 1.0)

# φef recalculé via φ(∞,t0).M0Eqp/M0Ed (App4 : φ(∞,t0)=2, M0Eqp=36, M0Ed=117 -> φef=0,615)
here2 = os.path.join(ROOT,"tests","ec2","fixtures","ec2-flexion-composee")
r = F.run(json.load(open(os.path.join(here2, "app4_courbure_fluage.json"))))
so = r["second_order"]
check("App4 : φef recalculé (livre 0,615)", so["phi_ef_used"], 0.615, 0.01)
check("App4 : ei via θi (livre 0,0127 m)", r["loads"]["ei_m"], 0.0127, 2e-4)
check("App4 : M0Ed 1er ordre avec Δe0 (livre 117 kNm)", so["M0Ed_kNm"], 117.0, 0.5)
check("App4 : convergence de la boucle second ordre", 1.0 if so["converged"] else 0.0, 1.0, 0)

# App3 (poteau carré 40x40, méthode courbure) : convergence, cohérence entrée/sortie de la dernière itération
r = F.run(json.load(open(os.path.join(here2, "app3_courbure.json"))))
so = r["second_order"]
check("App3 (run complet) : convergence", 1.0 if so["converged"] else 0.0, 1.0, 0)
last = so["iterations"][-1]
check("App3 (run complet) : itération finale auto-cohérente (in≈out)", last["As_face_in_cm2"], last["As_face_out_cm2"], max(0.02*last["As_face_out_cm2"], 0.03))

# App2 (poteau carré 40x40, méthode rigidité) : convergence malgré la discontinuité Kc à ρ=0,01
r = F.run(json.load(open(os.path.join(here2, "app2_rigidite.json"))))
so = r["second_order"]
check("App2 (run complet) : convergence malgré discontinuité ρ=0,01", 1.0 if so["converged"] else 0.0, 1.0, 0)
last = so["iterations"][-1]
check("App2 (run complet) : itération finale auto-cohérente (in≈out)", last["As_face_in_cm2"], last["As_face_out_cm2"], max(0.02*last["As_face_out_cm2"], 0.03))

# 8. Re-vérification de l'élancement avec l'acier réel : la dispense initiale (B=1,1 par défaut) peut ne
# plus tenir une fois ω réel connu (B réel < 1,1) — cas construit pour tomber juste sous le seuil.
r = F.run(json.load(open(os.path.join(here2, "app5_dispense_invalidee.json"))))
check("Dispense recalculée : λ ≤ λlim(défaut) au 1er passage", 1.0 if r["slenderness"]["plane_h"]["ok"] else 0.0, 1.0, 0)
rc = r["slenderness_recheck"]
check("Dispense recalculée : B réel < B assumé (ω réel plus faible)", 1.0 if rc["B_real"] < rc["B_assumed"] else 0.0, 1.0, 0)
check("Dispense recalculée : dispense invalidée au 2e passage (ok=False)", 1.0 if not rc["ok"] else 0.0, 1.0, 0)
check("Dispense recalculée : second ordre appliqué rétroactivement", 1.0 if r["second_order"] is not None else 0.0, 1.0, 0)
check("Dispense recalculée : le dimensionnement final est bien celui du 2e passage", r["second_order"]["MEd_kNm"] > r["loads"]["MEdG0_kNm"], True, 0)

print("\n%d échec(s)" % len(fails)); sys.exit(1 if fails else 0)
