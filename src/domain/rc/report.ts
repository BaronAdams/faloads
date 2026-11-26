import type {
  CalculationReport,
  ReportStep,
  ReportSelection,
  ReportBlock,
} from "../report";
import type { Project } from "@/lib/storage";
import type { RCModel } from "./model";
import type { RCResult } from "@/lib/rc-engine";
import { rcDrawing } from "./drawing";
const f = (v: unknown): string =>
  typeof v === "number"
    ? Number.isFinite(v)
      ? v.toLocaleString("fr-FR", { maximumFractionDigits: 3 })
      : "—"
    : Array.isArray(v)
      ? v.map(f).join(" à ")
      : v == null
        ? "—"
        : String(v);
const tex = (v: number) =>
  Number.isFinite(v) ? String(Math.round(v * 1000) / 1000) : "0";
export const rcReportSteps = (column: boolean): ReportStep[] => [
  {
    id: "model",
    title: "Modèle et matériaux",
    description: "Section, géométrie, matériaux et hypothèses EC2",
  },
  {
    id: "loads",
    title: "Actions et combinaisons",
    description: column
      ? "Effort normal, moments et combinaisons dimensionnantes"
      : "G/Q, poids propre et dispositions d’exploitation",
  },
  {
    id: "analysis",
    title: column ? "Stabilité et cascade de calcul" : "Analyse et enveloppes",
    description: column
      ? "Élancement, imperfections et second ordre"
      : "Trois moments, redistribution ou équilibre plastique",
  },
  {
    id: "longitudinal",
    title: "Armatures longitudinales",
    description:
      "Sections nécessaires, barres retenues et hauteur utile réelle",
  },
  {
    id: "transverse",
    title: column
      ? "Cadres et recouvrements"
      : "Effort tranchant, cadres et ancrages",
    description: "Justification et dispositions constructives",
  },
  {
    id: "drawing",
    title: "Schéma de ferraillage",
    description:
      "Coupe ou élévation du ferraillage calculé — schéma de principe",
  },
  {
    id: "checks",
    title: "Vérifications et limites",
    description:
      "Contrôles satisfaits, corrections nécessaires et domaine couvert",
  },
];
export function buildRCReport(
  project: Project,
  m: RCModel,
  r: RCResult,
  selection: ReportSelection,
  author: string,
  generatedAt: string,
): CalculationReport {
  const sections: CalculationReport["sections"] = [],
    column = m.kind === "rc-column";
  const add = (id: string, make: (b: ReportBlock[], full: boolean) => void) => {
    const detail = selection[id];
    if (!detail) return;
    const b: ReportBlock[] = [];
    make(b, detail === "full");
    sections.push({
      id,
      title: rcReportSteps(column).find((s) => s.id === id)!.title,
      detail,
      blocks: b,
    });
  };
  const table = (b: ReportBlock[], headers: string[], rows: unknown[][]) =>
    b.push({ kind: "table", headers, rows: rows.map((row) => row.map(f)) });
  const text = (b: ReportBlock[], value: string) =>
    b.push({ kind: "text", text: value });
  const formula = (b: ReportBlock[], latex: string) =>
    b.push({ kind: "formula", latex });
  add("model", (b, full) => {
    text(
      b,
      "EN 1992-1-1, première génération. Situation durable : γc = 1,50 ; γs = 1,15 ; αcc = 1. Les vérifications indiquées ne constituent pas une vérification complète de l’ouvrage.",
    );
    table(
      b,
      ["Paramètre", "Valeur"],
      [
        [
          "Section",
          column
            ? m.section.type === "circ"
              ? `Ø ${m.section.a_cm} cm`
              : `${m.section.b_cm} × ${m.section.h_cm} cm`
            : `${m.section.type === "t" ? "T" : "Rectangulaire"} : bw = ${m.section.bw_cm} cm ; h = ${m.section.h_cm} cm`,
        ],
        ["fck / fyk (MPa)", `${m.materials.fck} / ${m.materials.fyk}`],
        ["fcd / fyd (MPa)", `${f(r.materials.fcd)} / ${f(r.materials.fyd)}`],
        ["Enrobage nominal (mm)", m.detailing.cnom_mm],
        ["Granulat maximal (mm)", m.detailing.dg_mm],
      ],
    );
    if (full) {
      formula(
        b,
        "f_{cd}=\\frac{\\alpha_{cc}f_{ck}}{\\gamma_c},\\qquad f_{yd}=\\frac{f_{yk}}{\\gamma_s}",
      );
      formula(
        b,
        `f_{cd}=\\frac{${m.materials.fck}}{1.5}=${tex(r.materials.fcd)}\\;\\mathrm{MPa},\\quad f_{yd}=\\frac{${m.materials.fyk}}{1.15}=${tex(r.materials.fyd)}\\;\\mathrm{MPa}`,
      );
      if (column)
        table(
          b,
          ["Géométrie", "Valeur"],
          [
            ["Hauteur libre (m)", m.geometry.l_m],
            ["Contreventé", m.geometry.braced ? "Oui" : "Non"],
            ["Définition l0", m.geometry.effective],
            ["Méthode de second ordre", m.options.second_order_method],
            ["Coefficient final de fluage", m.materials.phi_inf_t0],
          ],
        );
      else
        table(
          b,
          ["Travée", "Portée nue (m)", "Portée efficace (m)"],
          m.spans.map((s, i) => [s.name, s.ln_m, r.effective_lengths_m[i]]),
        );
    }
  });
  add("loads", (b, full) => {
    if (column) {
      table(
        b,
        ["Combinaison", "N tête (kN)", "N pied (kN)"],
        r.combinations.map((c: any) => [c.name, c.N_top_kN, c.N_base_kN]),
      );
      text(
        b,
        m.loads.self_weight
          ? "Poids propre du poteau inclus une seule fois à 25 kN/m³."
          : "Poids propre du poteau exclu par l’utilisateur.",
      );
      if (full) {
        formula(
          b,
          "N_{Ed}=1.35\\sum G_k+1.5Q_{k,1}+1.5\\sum_{i>1}\\psi_{0,i}Q_{k,i}",
        );
        if (m.loads.mode === "actions")
          table(
            b,
            [
              "Action",
              "Nature",
              "N (kN)",
              "ψ0 / ψ2",
              "M tête y / z (kN·m)",
              "M pied y / z (kN·m)",
            ],
            m.loads.actions.map((a) => [
              a.name,
              a.category,
              a.N_kN,
              `${a.psi0} / ${a.psi2}`,
              `${f(a.moments.y.top)} / ${f(a.moments.z.top)}`,
              `${f(a.moments.y.bottom)} / ${f(a.moments.z.bottom)}`,
            ]),
          );
        table(
          b,
          ["Cas", "Plan", "N (kN)", "M1er ordre max (kN·m)"],
          r.cases.map((c: any) => [
            c.combo ?? c.name ?? c.id,
            c.plane,
            c.N ?? c.N_base,
            c.Mmax,
          ]),
        );
      }
    } else {
      table(
        b,
        ["Travée", "G total (kN/m)", "Q (kN/m)"],
        m.spans.map((s, i) => [
          s.name,
          r.permanent_kN_m[i],
          r.variable_kN_m[i],
        ]),
      );
      text(
        b,
        `Poids propre : ${f(r.self_weight_kN_m)} kN/m. ${r.cases.length} disposition(s) ELU ; enveloppe ${m.analysis.patterned ? "de tous les damiers de Q" : "du chargement intégral"}.`,
      );
      if (full) {
        formula(b, "q_{Ed,i}=1.35g_i+1.50q_i,\\qquad q_{ser,i}=g_i+q_i");
        table(
          b,
          ["Disposition", "qELU par travée (kN/m)", "Réactions (kN)"],
          r.cases.map((c: any) => [
            c.name,
            c.q.map(f).join(" ; "),
            c.reactions.map(f).join(" ; "),
          ]),
        );
      }
    }
  });
  add("analysis", (b, full) => {
    if (column) {
      text(
        b,
        `Niveau final : ${r.circular ? "compression centrée" : r.final_stage}. La dispense de second ordre est revérifiée avec le ferraillage réel.`,
      );
      if (!r.circular) {
        table(
          b,
          ["Niveau", "Démarche", "État"],
          r.cascade.map((s: any) => [
            s.stage,
            s.title,
            s.reason ??
              s.verdict ??
              (s.converged === false ? "Non convergé" : "Examiné"),
          ]),
        );
        table(
          b,
          ["Plan", "l0 (m)", "λ"],
          ["y", "z"].map((p) => [
            p,
            r.geometry[`plane_${p}`].l0_m,
            r.geometry[`plane_${p}`].lambda,
          ]),
        );
        if (full) {
          formula(
            b,
            "\\lambda=\\frac{l_0}{i},\\quad\\lambda_{lim}=\\frac{20ABC}{\\sqrt{n}},\\quad n=\\frac{N_{Ed}}{A_cf_{cd}},\\quad B=\\sqrt{1+2\\omega}",
          );
          formula(
            b,
            "e_{0,min}=\\max(20\\,\\mathrm{mm};h/30),\\quad M_{Ed}=M_{0Ed}+N_{Ed}e_2",
          );
          formula(
            b,
            m.options.second_order_method === "courbure"
              ? "e_2=\\frac{l_0^2}{c}\\frac{1}{r},\\quad\\frac{1}{r}=K_rK_\\varphi\\frac{\\varepsilon_{yd}}{0.45d}"
              : "EI=K_cE_{cd}I_c+K_sE_sI_s,\\quad N_B=\\frac{\\pi^2EI}{l_0^2},\\quad M_{Ed}=M_{0Ed}\\left(1+\\frac{\\pi^2/c_0}{N_B/N_{Ed}-1}\\right)",
          );
          table(
            b,
            ["Cas / plan", "λ", "λlim", "Dispense"],
            r.verification.buckling.map((v: any) => [
              `${v.case} / ${v.plane}`,
              v.lambda ?? v.lam,
              v.lambda_lim ?? v.lam_lim,
              v.ok ? "Oui" : "Second ordre / contrôle requis",
            ]),
          );
          const second = r.verification.sections.flatMap((v: any) =>
            v.sections
              .filter((s: any) => s.second_order)
              .map((s: any) => [v, s.second_order]),
          );
          if (second.length)
            table(
              b,
              [
                "Combinaison / plan",
                "M0Ed (kN·m)",
                "φef",
                "e2 (mm) ou EI (MN·m²)",
                "MEd (kN·m)",
              ],
              second.map(([v, s]: any[]) => [
                `${v.combo} / ${v.plane}`,
                s.M0Ed_kNm,
                s.phi_ef_used,
                s.method === "courbure" ? s.e2_m * 1000 : s.EI_MNm2,
                s.MEd_kNm,
              ]),
            );
        }
      } else {
        text(
          b,
          `λ = ${f(r.final_slenderness.lam)} ; λlim = ${f(r.final_slenderness.lam_lim)}. Compression conventionnelle ${r.final_slenderness.ok ? "admise" : "non admise"}.`,
        );
      }
    } else {
      text(
        b,
        r.method === "elastic"
          ? "Analyse élastique par résolution du système général des trois moments, section constante. Les extrémités simples ou encastrées sont traitées explicitement."
          : "Équilibre plastique statiquement admissible sous chargement intégral, avec contrôle séparé de la ductilité et des réactions.",
      );
      table(
        b,
        ["Section", "MEd (kN·m)"],
        [...r.spans, ...r.supports].map((s: any) => [s.label, s.MEd_kNm]),
      );
      if (full) {
        formula(b, "L_{eff}=L_n+\\min(t_g/2,h/2)+\\min(t_d/2,h/2)");
        formula(
          b,
          "L_iM_{i-1}+2(L_i+L_{i+1})M_i+L_{i+1}M_{i+1}=-\\frac{q_iL_i^3+q_{i+1}L_{i+1}^3}{4}",
        );
        formula(
          b,
          "M_i(x)=\\frac{q_ix(L_i-x)}{2}+M_i^g+\\frac{M_i^d-M_i^g}{L_i}x",
        );
        table(
          b,
          [
            "Appui",
            "Moment théorique (kN·m)",
            "Réduction (kN·m)",
            "Moment retenu (kN·m)",
          ],
          r.supports.map((s: any) => [
            s.label,
            s.theoretical_kNm,
            s.clipping_kNm,
            s.MEd_kNm,
          ]),
        );
        for (const n of r.notes.filter(
          (s: string) => s.includes("Redistrib") || s.includes("redistrib"),
        ))
          text(b, n);
        if (r.redistribution.length)
          table(
            b,
            ["Disposition / appui", "δ", "Avant / après (kN·m)"],
            r.redistribution.map((v: any) => [
              `${v.case} / ${v.support}`,
              v.delta,
              `${f(v.before_kNm)} / ${f(v.after_kNm)}`,
            ]),
          );
      }
      if (r.comparison.length) {
        table(
          b,
          ["Travée", "As élastique (cm²)", "As plastique (cm²)"],
          r.comparison.map((c: any) => [
            c.span + 1,
            c.elastic_As_mm2 / 100,
            c.plastic_As_mm2 / 100,
          ]),
        );
        table(
          b,
          ["Condition plastique", "État"],
          r.plastic_checks.map((c: any) => [
            c.name,
            c.ok ? "Satisfait" : "Non satisfait",
          ]),
        );
      }
    }
  });
  add("longitudinal", (b, full) => {
    if (column) {
      const q = r.reinforcement,
        l = q.layout;
      table(
        b,
        ["Grandeur", "Valeur"],
        [
          [
            "Armatures retenues",
            `${l.n} barres HA${l.phi}${l.mixed ? ` / HA${l.phi_i}` : ""}`,
          ],
          ["As requis (cm²)", q.As_req_tot_cm2],
          ["As fourni (cm²)", l.As_prov],
          ["As minimal (cm²)", q.As_min_tot_cm2],
          ["d’ réel (mm)", l.e_mm],
        ],
      );
      if (full) {
        formula(
          b,
          "A_{s,min}=\\max\\left(0.10\\frac{N_{Ed}}{f_{yd}};0.002A_c\\right),\\qquad A_{s,max}=0.04A_c",
        );
        formula(
          b,
          `A_{s,prov}=${tex(l.As_prov)}\\;\\mathrm{cm^2}${l.As_prov >= q.As_req_tot_cm2 ? "\\ge" : "<"} A_{s,req}=${tex(q.As_req_tot_cm2)}\\;\\mathrm{cm^2}`,
        );
        if (!r.circular)
          table(
            b,
            [
              "Combinaison / plan",
              "Section",
              "MEd (kN·m)",
              "MRd (kN·m)",
              "État",
            ],
            r.verification.sections.flatMap((v: any) =>
              v.sections.map((s: any) => [
                `${v.combo} / ${v.plane}`,
                s.name,
                s.M,
                s.MRd,
                s.ok ? "Satisfait" : "À corriger",
              ]),
            ),
          );
      }
    } else {
      table(
        b,
        [
          "Section",
          "As requis (cm²)",
          "As fourni (cm²)",
          "Nappe tendue",
          "Nappe opposée",
        ],
        [...r.spans, ...r.supports].map((s: any) => [
          s.label,
          s.As1_req_mm2 / 100,
          s.tension.area_mm2 / 100,
          `${s.tension.count} HA${s.tension.phi_mm}`,
          `${s.compression.count} HA${s.compression.phi_mm}`,
        ]),
      );
      if (full) {
        formula(
          b,
          "\\mu=\\frac{M_{Ed}}{b_wd^2f_{cd}},\\quad\\alpha=\\frac{1-\\sqrt{1-2\\mu}}{0.8},\\quad A_s=\\frac{M_{Ed}}{z\\sigma_s}",
        );
        formula(
          b,
          "A_{s,min}=\\max\\left(0.26\\frac{f_{ct,eff}}{f_{yk}}b_wd;0.0013b_wd\\right)",
        );
        table(
          b,
          [
            "Section",
            "d (mm)",
            "d réel (mm)",
            "μ / μlim",
            "As comprimé requis (cm²)",
            "σs ELS (MPa)",
          ],
          [...r.spans, ...r.supports].map((s: any) => [
            s.label,
            s.d_mm,
            s.actual_d_mm,
            `${f(s.mu)} / ${f(s.mu_limit)}`,
            s.As2_req_mm2 / 100,
            s.service?.sigma_s_MPa ?? "Non vérifié",
          ]),
        );
        const s = r.spans[0];
        formula(
          b,
          `A_{s,req,1}=${tex(s.As1_req_mm2 / 100)}\\;\\mathrm{cm^2},\\quad A_{s,prov,1}=${tex(s.tension.area_mm2 / 100)}\\;\\mathrm{cm^2}`,
        );
        if (m.section.type === "t") formula(b, "M_T=b_{eff}h_ff_{cd}(d-h_f/2)");
      }
    }
  });
  add("transverse", (b, full) => {
    if (column) {
      const q = r.reinforcement,
        t = q.transverse;
      table(
        b,
        ["Disposition", "Valeur"],
        [
          ["Cadres", `HA${t.phi_t_mm}`],
          ["Pas courant (cm)", t.s_current_cm],
          ["Pas aux nœuds (cm)", t.s_node_cm],
          ["Recouvrement (cm)", q.lap?.l0_cm ?? "Désactivé"],
        ],
      );
      if (full) {
        formula(
          b,
          "s_{cl,t,max}=\\min(20\\phi_{l,min};b;400\\,\\mathrm{mm}),\\quad s_{noeud}\\le0.6s_{cl,t,max}",
        );
        formula(
          b,
          "f_{bd}=2.25\\eta_1\\eta_2f_{ctd},\\quad l_{b,rqd}=\\frac{\\phi}{4}\\frac{\\sigma_{sd}}{f_{bd}},\\quad l_0=\\max(\\alpha_4\\alpha_6l_{b,rqd};15\\phi;200\\,\\mathrm{mm})",
        );
        if (q.lap)
          text(
            b,
            q.lap.basis ??
              "Recouvrement de barres comprimées, avec contrôle des cadres et du taux d’armatures dans la zone.",
          );
      }
    } else {
      table(
        b,
        ["Travée / côté", "VEd (kN)", "VRd,max (kN)", "cot θ", "Cadres"],
        r.shear.flatMap((s: any, i: number) =>
          s.critical.map((c: any) => [
            `${i + 1} / ${c.side}`,
            c.VEd_kN,
            c.VRdmax_kN,
            c.cot_theta,
            `${m.detailing.branches} brins HA${m.detailing.phi_t_mm} / ${c.spacing_mm} mm`,
          ]),
        ),
      );
      if (full) {
        formula(
          b,
          "V_{Rd,c}=\\max\\left[0.12k(100\\rho_lf_{ck})^{1/3};0.035k^{3/2}\\sqrt{f_{ck}}\\right]b_wd",
        );
        formula(
          b,
          "V_{Rd,max}=\\frac{b_wz\\nu_1f_{cd}(\\cot\\theta+\\cot\\alpha)}{1+\\cot^2\\theta},\\quad\\frac{A_{sw}}s=\\frac{V_{Ed,red}}{zf_{yd}(\\cot\\theta+\\cot\\alpha)\\sin\\alpha}",
        );
        formula(
          b,
          "l_{bd}=\\max(\\alpha_1\\alpha_2\\alpha_3\\alpha_4\\alpha_5l_{b,rqd};l_{b,min})",
        );
        table(
          b,
          ["Travée", "Côté", "Pas (mm)", "Nombre", "Début / fin (m)"],
          r.shear.flatMap((s: any, i: number) =>
            s.zones.map((z: any) => [
              i + 1,
              z.side === 0 ? "Gauche" : z.side === 1 ? "Droite" : "Complément",
              z.spacing_mm,
              z.count,
              `${f(z.start_m)} / ${f(z.end_m)}`,
            ]),
          ),
        );
        table(
          b,
          ["Travée / nappe", "Barres", "Début (m)", "Fin (m)", "Longueur (m)"],
          r.bars.flatMap((s: any, i: number) =>
            ["bottom", "top"].flatMap((k) =>
              s[k].groups.map((g: any) => [
                `${i + 1} / ${k === "bottom" ? "bas" : "haut"}`,
                `${g.count} HA${g.phi_mm}`,
                g.start_m,
                g.end_m,
                g.length_m,
              ]),
            ),
          ),
        );
        table(
          b,
          ["Appui", "lbd (mm)", "Disponible (mm)", "État"],
          r.bars.flatMap((s: any, i: number) =>
            ["bottom", "top"].flatMap((nappe) =>
              ["left_end", "right_end"]
                .filter((k) => s[nappe][k])
                .map((k) => [
                  `${i + 1} / ${nappe === "bottom" ? "bas" : "haut"} / ${k === "left_end" ? "gauche" : "droite"}`,
                  s[nappe][k].lbd_mm,
                  s[nappe][k].available_mm,
                  s[nappe][k].fits ? "Satisfait" : "À corriger",
                ]),
            ),
          ),
        );
        if (r.flange.length) {
          formula(
            b,
            "v_{Ed}=\\frac{\\Delta F_d}{h_f\\Delta x},\\qquad\\frac{A_{sf}}{s_f}\\ge\\frac{v_{Ed}h_f}{f_{yd}\\cot\\theta_f}",
          );
          table(
            b,
            ["Travée", "vEd (MPa)", "vRd,max (MPa)", "Couture par côté"],
            r.flange.map((s: any, i: number) => [
              i + 1,
              s.vEd_MPa,
              s.VRdmax_MPa,
              `HA${s.phi_mm} / ${s.spacing_mm} mm`,
            ]),
          );
        }
      }
    }
  });
  add("drawing", (b) => {
    b.push({ kind: "svg", svg: rcDrawing(m, r) });
    text(
      b,
      "Schéma de principe établi avec les barres et cadres calculés. Les assemblages, barres communes aux appuis, façonnages et longueurs finales doivent être détaillés sur le plan d’exécution.",
    );
  });
  add("checks", (b, full) => {
    const failed = r.checks.filter((c) => !c.ok);
    text(
      b,
      failed.length
        ? `${failed.length} contrôle(s) non satisfait(s) : le dimensionnement doit être corrigé.`
        : !r.scope_complete
          ? "Les contrôles disponibles sont satisfaits, mais une vérification complémentaire est nécessaire."
          : "Les contrôles calculés sont satisfaits dans le domaine indiqué.",
    );
    text(
      b,
      `${r.checks.length - failed.length} contrôle(s) satisfait(s) sur ${r.checks.length}.`,
    );
    table(
      b,
      ["Contrôle", "Valeur", "Référence", "État"],
      (full ? r.checks : failed).map((c) => [
        c.name,
        c.value,
        c.limit,
        c.ok ? "Satisfait" : "À corriger",
      ]),
    );
    if (full) for (const n of r.notes) text(b, n);
  });
  // A scoped engineering result must retain its limitations even if the user
  // selects only the reinforcement or drawing chapter.
  sections.push({
    id: "scope",
    title: "Domaine de validité et points d’attention",
    detail: "summary",
    blocks: [
      r.checks.some((c) => !c.ok)
        ? "Des contrôles ne sont pas satisfaits : ce résultat doit être corrigé avant utilisation."
        : !r.scope_complete
          ? "Une vérification complémentaire est nécessaire avant de conclure sur ce dimensionnement."
          : "Les contrôles calculés sont satisfaits uniquement dans le domaine indiqué ci-dessous.",
      ...r.warnings,
      ...r.limits,
    ].map((s) => ({
      kind: "text",
      text: s,
    })),
  });
  return {
    project: project.name,
    type: column
      ? "Dimensionnement EC2 — poteau BA"
      : "Dimensionnement EC2 — poutre BA",
    generatedAt,
    author,
    method: column
      ? "Cascade compression / flexion composée / second ordre, EC2"
      : "Analyse de poutre et dimensionnement flexion / effort tranchant, EC2",
    sections,
  };
}
