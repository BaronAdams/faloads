import { isRCModel } from "./rc/model";
import { rcReportSteps } from "./rc/report";
import {
  beamSchema,
  frameSchema,
  solveBeam,
  solveFrame,
  frameDistributions,
} from "./analysis";
import {
  beamDeflectionChecks,
  frameDeflectionChecks,
} from "./analysis-reading";
import { buildingSchema, buildingDescent } from "./building";
import { validateBuilding } from "./building-validation";
import { descentSchema, descentArea, descentLevelLoads } from "./descent";
import {
  descent,
  levelG,
  coatingG,
  coeff,
  fckOf,
  columnPredim,
  wallPredim,
  beamPredim,
  stairsPredim,
  slabPredim,
  balconyPredim,
  retainingPredim,
  footingPredim,
} from "./engineering";
import { predimSchema } from "./predim";
import { profileProperties } from "./section-profile";
import { reductionOptions } from "./load-reduction";
import { typeInfo, type ProjectType } from "./projects";
import type { Project } from "@/lib/storage";
import { projectDrawing } from "./project-preview";

export type ReportDetail = "summary" | "full";
export type ReportSelection = Record<string, ReportDetail | false>;
export type ReportStep = { id: string; title: string; description: string };
export type ReportBlock =
  | { kind: "text"; text: string }
  | { kind: "formula"; latex: string }
  | { kind: "table"; headers: string[]; rows: string[][] }
  | { kind: "svg"; svg: string };
export type CalculationReport = {
  project: string;
  type: string;
  generatedAt: string;
  author: string;
  method: string;
  sections: {
    id: string;
    title: string;
    detail: ReportDetail;
    blocks: ReportBlock[];
  }[];
};
const steps = (entries: [string, string, string][]): ReportStep[] =>
  entries.map(([id, title, description]) => ({ id, title, description }));
export function reportSteps(type: ProjectType, data?: unknown): ReportStep[] {
  if (isRCModel(data)) return rcReportSteps(data.kind === "rc-column");
  if (type === "beam" || type === "frame")
    return steps([
      [
        "model",
        "Modèle et hypothèses",
        "Géométrie, sections, matériaux et liaisons",
      ],
      [
        "loads",
        "Actions appliquées",
        "Charges, positions et mouvements imposés",
      ],
      [
        "assembly",
        type === "beam" ? "Rigidités de la poutre" : "Assemblage du portique",
        "Formulation, paramètres mécaniques et résolution",
      ],
      [
        "reactions",
        "Réactions d’appui",
        "Réactions et contrôle de l’équilibre",
      ],
      ["internal", "Efforts internes", "N, V, M et valeurs caractéristiques"],
      [
        "deformation",
        "Déplacements et rotations",
        "Déformée, flèches et rotations",
      ],
      [
        "checks",
        "Vérification de la flèche",
        "Critère utilisateur et limites du modèle",
      ],
    ]);
  if (type === "column-load" || type === "wall-load")
    return steps([
      [
        "model",
        "Niveaux et hypothèses",
        "Ordre de cumul, système et matériaux",
      ],
      [
        "influence",
        "Aires tributaires",
        "Surface et longueurs propres à chaque étage",
      ],
      [
        "permanent",
        "Charges permanentes",
        "Planchers, revêtements, poutres et porteurs",
      ],
      ["variable", "Charges d’exploitation", "Apports Q bruts par niveau"],
      [
        "reduction",
        "Dégression des charges Q",
        "Catégories, coefficients et cumul réduit",
      ],
      [
        "cumulative",
        "Descente cumulée",
        "G, Q, ELS et ELU du sommet vers la base",
      ],
      ...(type === "wall-load"
        ? [
            [
              "wind",
              "Action du vent simplifiée",
              "Pression et effort cumulé par niveau",
            ] as [string, string, string],
          ]
        : []),
      [
        "section",
        "Estimation initiale de la section",
        "Dimension indicative et vérifications restantes",
      ],
    ]);
  if (type === "building")
    return steps([
      [
        "model",
        "Modèle du bâtiment",
        "Niveaux, grilles et hypothèses de descente",
      ],
      [
        "connectivity",
        "Contrôle des liaisons",
        "Continuité des porteurs et appuis de poutres",
      ],
      ["slabs", "Charges des planchers", "Surfaces, G et Q des panneaux"],
      [
        "beams",
        "Transmission par les poutres",
        "Aires d’influence, poids propres et réactions",
      ],
      [
        "roof",
        "Toiture et réactions",
        "Géométrie, actions et cheminement vers les porteurs",
      ],
      [
        "cumulative",
        "Cumul des poteaux par étage",
        "Apports locaux, niveaux supérieurs et combinaisons",
      ],
      [
        "critical",
        "Porteurs les plus chargés",
        "Maximum par famille et cas de charges",
      ],
      ["wind", "Vent par niveau", "Action simplifiée présentée séparément"],
    ]);
  const common: [string, string, string][] = [
    [
      "inputs",
      "Données et hypothèses",
      "Paramètres du projet et domaine de la méthode",
    ],
  ];
  const specific: Partial<Record<ProjectType, [string, string, string][]>> = {
    column: [
      [
        "resistance",
        "Résistance et aire minimale",
        "Béton, coefficient simplifié et effort normal",
      ],
      ["section", "Choix de la section", "Arrondi et section proposée"],
    ],
    wall: [
      [
        "resistance",
        "Aire résistante minimale",
        "Charge et résistance simplifiée",
      ],
      [
        "section",
        "Épaisseur du voile",
        "Longueur, arrondi et épaisseur proposée",
      ],
    ],
    "beam-size": [
      [
        "depth",
        "Dimensions de la poutre",
        "Portée, schéma statique et proportions",
      ],
      [
        "moment",
        "Moment de référence",
        "Coefficient de moment et charge ELU saisie",
      ],
    ],
    stairs: [
      ["steps", "Marches et giron", "Nombre de marches, hauteur et giron"],
      ["blondel", "Contrôle de Blondel", "Relation 2h + g"],
      ["thickness", "Paillasse", "Longueur inclinée et épaisseur indicative"],
    ],
    balcony: [
      ["loads", "Combinaison des actions", "G et Q par mètre de largeur"],
      ["moment", "Moment de la console", "Moment à l’encastrement"],
      ["thickness", "Épaisseur indicative", "Proportion portée/épaisseur"],
    ],
    slab: [
      [
        "thickness",
        "Choix du plancher",
        "Dalle pleine ou abaque simplifié de corps creux",
      ],
    ],
    retaining: [
      ["pressure", "Poussée active des terres", "Coefficient Ka et résultante"],
      ["geometry", "Proportions du mur", "Base et épaisseur du voile"],
    ],
    footing: [
      ["bearing", "Surface nécessaire", "Effort ELS et contrainte admissible"],
      [
        "dimensions",
        "Dimensions de la semelle",
        "Semelle isolée ou filante, arrondi",
      ],
      ["depth", "Hauteur indicative", "Critère géométrique de diffusion"],
    ],
  };
  return steps([
    ...common,
    ...(specific[type] ?? []),
    [
      "limits",
      "Portée des résultats",
      "Vérifications non effectuées et suites de l’étude",
    ],
  ]);
}
export const defaultReportSelection = (
  type: ProjectType,
  data?: unknown,
): ReportSelection =>
  Object.fromEntries(reportSteps(type, data).map((s) => [s.id, "summary"]));
const f = (n: number, d = 3) => {
  if (!Number.isFinite(n)) throw Error("Une valeur du calcul n’est pas finie.");
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: d }).format(
    Math.abs(n) < 0.5 * 10 ** -d ? 0 : n,
  );
};
const n = (v: number) => {
  if (!Number.isFinite(v)) throw Error("Expression numérique invalide.");
  return Number(v.toPrecision(7)).toString();
};
const txt = (text: string): ReportBlock => ({ kind: "text", text });
const eq = (latex: string): ReportBlock => ({ kind: "formula", latex });
const table = (
  headers: string[],
  rows: (string | number)[][],
): ReportBlock => ({
  kind: "table",
  headers,
  rows: rows.map((r) => r.map((v) => (typeof v === "number" ? f(v) : v))),
});
type Content = Record<string, { summary: ReportBlock[]; full: ReportBlock[] }>;
function step(
  content: Content,
  id: string,
  summary: ReportBlock[],
  detail: ReportBlock[] = [],
) {
  content[id] = { summary, full: [...detail, ...summary] };
}

/** Characteristic stations, including both sides of a discontinuity. */
function stations(x: number[], values: number[][], boundaries: number[] = []) {
  const indices = new Set([0, x.length - 1]);
  const at = [...boundaries];
  for (const t of [0.25, 0.5, 0.75]) at.push(x[0] + t * (x.at(-1)! - x[0]));
  for (const v of values) {
    let min = 0,
      max = 0;
    for (let i = 1; i < v.length; i++) {
      if (v[i] < v[min]) min = i;
      if (v[i] > v[max]) max = i;
    }
    indices.add(min);
    indices.add(max);
  }
  for (const target of at) {
    let nearest = 0;
    for (let i = 1; i < x.length; i++)
      if (Math.abs(x[i] - target) < Math.abs(x[nearest] - target)) nearest = i;
    indices.add(nearest);
  }
  for (let i = 1; i < x.length; i++) {
    if (
      Math.abs(x[i] - x[i - 1]) < 1e-8 &&
      values.some((v) => Math.abs(v[i] - v[i - 1]) > 1e-8)
    ) {
      indices.add(i - 1);
      indices.add(i);
    }
  }
  return [...indices]
    .filter((i) => i >= 0 && i < x.length)
    .sort((a, b) => a - b);
}

/** Recompute from a captured model, never from potentially stale UI results. */
export function buildCalculationReport(
  project: Project,
  selection: ReportSelection,
  author = "",
  generatedAt = new Date().toISOString(),
): CalculationReport {
  if (isRCModel(project.data))
    throw Error(
      "Le dimensionnement EC2 doit être recalculé avec le moteur local avant de préparer sa note.",
    );
  const definitions = reportSteps(project.type),
    content: Content = {};
  if (!definitions.some((s) => selection[s.id]))
    throw Error("Sélectionnez au moins une étape pour votre note.");
  let method = "";
  const sketch: ReportBlock = { kind: "svg", svg: projectDrawing(project) };
  if (project.type === "beam") {
    const m = beamSchema.parse(project.data),
      r = solveBeam(m),
      checks = beamDeflectionChecks(m, r);
    method = `Analyse élastique linéaire au premier ordre · ${m.timoshenko ? "Timoshenko" : "Euler–Bernoulli"}`;
    step(
      content,
      "model",
      [
        txt(method),
        sketch,
        table(
          ["Longueur · m", "E · MPa", "ν", "Tronçons", "Appuis"],
          [
            [
              m.L,
              m.material.E,
              m.material.nu,
              m.sections.length,
              m.supports.length,
            ],
          ],
        ),
      ],
      [
        txt(
          "Petits déplacements ; sections et matériau linéaires. Les rigidités saisies ne représentent pas automatiquement la fissuration ou le fluage du béton.",
        ),
        table(
          [
            "Section",
            "x₁ · m",
            "x₂ · m",
            "b · cm",
            "h · cm",
            "A · cm²",
            "I · cm⁴",
          ],
          m.sections.map((s, i) => {
            const p = profileProperties(s);
            return [
              `S${i + 1}`,
              s.x1,
              s.x2,
              s.b * 100,
              s.h * 100,
              p.A * 1e4,
              p.I * 1e8,
            ];
          }),
        ),
        table(
          ["Tronçon", "Profil", "Âme tw · cm", "Semelle tf · cm", "As · cm²"],
          m.sections.map((s, i) => [
            i + 1,
            s.catalogue ?? s.shape,
            s.tw === undefined ? "—" : s.tw * 100,
            s.tf === undefined ? "—" : s.tf * 100,
            m.kappa * profileProperties(s).A * 1e4,
          ]),
        ),
        table(
          ["Appui", "x · m", "Translation x", "Translation y", "Rotation"],
          m.supports.map((s, i) => [
            i + 1,
            s.x,
            ...[s.ux, s.uy, s.rz].map((v, j) =>
              typeof v === "boolean"
                ? v
                  ? "Bloquée"
                  : "Libre"
                : `Ressort ${f(v)} ${j === 2 ? "kN·m/rad" : "kN/m"}`,
            ),
          ]),
        ),
        txt(
          m.hinges.length
            ? `Rotules internes aux abscisses : ${m.hinges.map((h) => `${f(h.x)} m`).join(" ; ")}.`
            : "Aucune rotule interne.",
        ),
      ],
    );
    step(
      content,
      "loads",
      [
        table(
          ["Action", "x₁ / x · m", "x₂ · m", "Fy / q₁", "q₂ / M", "Fx · kN"],
          m.loads.map((l, i) => [
            `${i + 1} · ${l.type === "dist" ? "Répartie (kN/m)" : l.type === "point" ? "Ponctuelle (kN)" : "Moment (kN·m)"}`,
            l.type === "dist" ? l.x1 : l.x,
            l.type === "dist" ? l.x2 : "—",
            l.type === "dist" ? l.q1 : l.type === "point" ? l.Fy : "—",
            l.type === "dist" ? l.q2 : l.type === "moment" ? l.M : "—",
            l.type === "point" ? l.Fx : "—",
          ]),
        ),
        txt(
          m.selfWeight.enabled
            ? `Poids propre activé : γ = ${f(m.selfWeight.gamma)} kN/m³.`
            : "Poids propre désactivé.",
        ),
        txt(
          "Actions utilisées telles que saisies : aucune majoration G/Q supplémentaire n’est appliquée par le solveur d’analyse.",
        ),
      ],
      [
        eq(String.raw`q(x)=q_1+\frac{q_2-q_1}{x_2-x_1}(x-x_1)`),
        eq(String.raw`q_{pp}=\gamma A`),
        table(
          [
            "Appui",
            "x · m",
            "uₓ imposé · mm",
            "uᵧ imposé · mm",
            "θ imposée · mrad",
          ],
          m.supports.map((s, i) => [
            i + 1,
            s.x,
            s.dx * 1000,
            s.dy * 1000,
            s.drz * 1000,
          ]),
        ),
      ],
    );
    step(
      content,
      "assembly",
      [
        txt(
          "Maillage aux appuis, charges et changements de section, puis résolution matricielle des déplacements.",
        ),
        eq(String.raw`K_{ff}U_f=F_f-K_{fc}U_c`),
      ],
      [
        eq(String.raw`G=\frac{E}{2(1+\nu)},\quad EA=E A,\quad EI=E I`),
        eq(
          m.timoshenko
            ? String.raw`\phi=\frac{12EI}{GA_s\ell^2},\quad A_s=\kappa A`
            : String.raw`\phi=0`,
        ),
        eq(
          String.raw`k_f=\frac{EI}{(1+\phi)\ell^3}\begin{bmatrix}12&6\ell&-12&6\ell\\6\ell&(4+\phi)\ell^2&-6\ell&(2-\phi)\ell^2\\-12&-6\ell&12&-6\ell\\6\ell&(2-\phi)\ell^2&-6\ell&(4+\phi)\ell^2\end{bmatrix}`,
        ),
        txt(
          `Module de cisaillement G = ${f(m.material.E / (2 * (1 + m.material.nu)))} MPa ; κ = ${f(m.kappa)}. Ressorts et déplacements imposés sont introduits dans le système avant résolution.`,
        ),
      ],
    );
    step(
      content,
      "reactions",
      [
        table(
          ["x · m", "Rₓ · kN", "Rᵧ · kN", "M · kN·m"],
          r.reactions.map((s) => [s.x, s.Fx, s.Fy, s.Mz]),
        ),
      ],
      [
        eq(String.raw`R=KU-F`),
        txt(
          "Réaction verticale positive vers le haut ; charges verticales saisies positives vers le bas.",
        ),
        table(
          [
            "Résidu N en bout · kN",
            "Résidu V en bout · kN",
            "Résidu M en bout · kN·m",
          ],
          [
            [
              r.caracteristiques.fermeture.N_fin,
              r.caracteristiques.fermeture.V_fin,
              r.caracteristiques.fermeture.M_fin,
            ],
          ],
        ),
      ],
    );
    const extrema = ["N", "V", "M"] as const;
    const boundaries = [
      ...m.supports.map((s) => s.x),
      ...m.sections.flatMap((s) => [s.x1, s.x2]),
      ...m.loads.flatMap((l) => (l.type === "dist" ? [l.x1, l.x2] : [l.x])),
    ];
    step(
      content,
      "internal",
      [
        table(
          ["Grandeur", "Minimum", "x · m", "Maximum", "x · m"],
          extrema.map((k) => [
            `${k} · ${k === "M" ? "kN·m" : "kN"}`,
            r.extrema[k].min.val,
            r.extrema[k].min.x,
            r.extrema[k].max.val,
            r.extrema[k].max.x,
          ]),
        ),
      ],
      [
        eq(String.raw`\frac{dM}{dx}=V`),
        txt(
          "Les efforts sont reconstruits à partir des efforts d’extrémité et des actions appliquées. Pour le tracé, les ordonnées positives sont placées vers le haut.",
        ),
        txt(
          "Valeurs aux extrémités, appuis, limites des charges et extrema du solveur ; les deux côtés des discontinuités sont conservés.",
        ),
        table(
          ["x · m", "N · kN", "V · kN", "M · kN·m"],
          stations(r.x, [r.N, r.V, r.M], boundaries).map((i) => [
            r.x[i],
            r.N[i],
            r.V[i],
            r.M[i],
          ]),
        ),
      ],
    );
    step(
      content,
      "deformation",
      [
        table(
          ["Flèche maximale absolue · mm", "Rapport L/f"],
          [
            [
              r.caracteristiques.fleche_max_abs * 1000,
              r.caracteristiques.L_sur_f ?? "—",
            ],
          ],
        ),
      ],
      [
        eq(String.raw`EI\,v^{(4)}=q\quad\text{(Euler–Bernoulli)}`),
        txt(
          m.timoshenko
            ? "En Timoshenko, la rotation de section et la pente de la déformée diffèrent par la déformation de cisaillement."
            : "En Euler–Bernoulli, la pente de la déformée correspond à la rotation, selon les conventions du solveur.",
        ),
        table(
          ["x · m", "v · mm", "θ · mrad"],
          stations(r.x, [r.v, r.theta], boundaries).map((i) => [
            r.x[i],
            r.v[i] * 1000,
            r.theta[i] * 1000,
          ]),
        ),
      ],
    );
    step(
      content,
      "checks",
      [
        table(
          ["Travée", "f max · mm", "f admissible · mm", "Taux", "Conclusion"],
          checks.map((c) => [
            c.label,
            c.actualMm,
            c.allowableMm,
            c.utilization,
            c.utilization <= 1 ? "Critère respecté" : "Critère dépassé",
          ]),
        ),
      ],
      [
        eq(
          m.deflectionLimit?.mode === "absolute"
            ? String.raw`f_{adm}=f_{saisi}`
            : String.raw`f_{adm}=\frac{L_{travee}}{${n(m.deflectionLimit?.ratio ?? 250)}}`,
        ),
        eq(String.raw`\eta_f=\frac{|f_{max}|}{f_{adm}}\leq1`),
        txt(
          "Comparaison au critère utilisateur de l’analyse élastique. Ce n’est pas une vérification réglementaire de flèche différée du béton armé.",
        ),
      ],
    );
  } else if (project.type === "frame") {
    const m = frameSchema.parse(project.data),
      r = solveFrame(m),
      checks = frameDeflectionChecks(m, r);
    method =
      "Portique plan · méthode des rigidités · Euler–Bernoulli · premier ordre";
    step(
      content,
      "model",
      [
        txt(method),
        sketch,
        table(
          ["Nœuds", "Barres", "E · GPa"],
          [[m.nodes.length, m.mem.length, m.E]],
        ),
      ],
      [
        txt(
          "Trois degrés de liberté par nœud : uₓ, uᵧ et θ. Flexion et déformation axiale incluses ; déformation de cisaillement, fissuration et effets du second ordre non calculés.",
        ),
        table(
          [
            "Nœud",
            "x · m",
            "y · m",
            "Type d’appui",
            "uₓ · mm",
            "uᵧ · mm",
            "θ · mrad",
          ],
          m.nodes.map((s, i) => [
            i + 1,
            s.x,
            s.y,
            s.s,
            (s.dx ?? 0) * 1000,
            (s.dy ?? 0) * 1000,
            (s.drz ?? 0) * 1000,
          ]),
        ),
        table(
          ["Barre", "Nœud A", "Nœud B", "b · cm", "h · cm", "L · m"],
          m.mem.map((b, i) => [i + 1, b.a, b.b, b.bw, b.h, r.mem[i].g.L]),
        ),
        table(
          ["Nœud", "Ressort vertical ky · kN/m"],
          m.nodes
            .filter((s) => s.s === 5)
            .map((s) => [m.nodes.indexOf(s) + 1, s.ky ?? 10000]),
        ),
      ],
    );
    step(
      content,
      "loads",
      [
        table(
          [
            "Barre",
            "Début relatif",
            "Fin relative",
            "w₁ global · kN/m",
            "w₂ global · kN/m",
            "q₁ local · kN/m",
            "q₂ local · kN/m",
          ],
          frameDistributions(m).map((d) => [
            m.mem.findIndex((b) => b.id === d.member) + 1,
            d.loadStart ?? 0,
            d.loadEnd ?? 1,
            d.w,
            d.w2 ?? d.w,
            d.q,
            d.q2 ?? d.q,
          ]),
        ),
      ],
      [
        txt(
          "Les charges partielles et ponctuelles créent des nœuds de calcul internes ; les résultats sont ensuite regroupés sur les barres du modèle. Les chargements sont utilisés tels que saisis, sans majoration supplémentaire.",
        ),
        table(
          ["Nœud", "Fx · kN", "Fy · kN", "M · kN·m"],
          m.nl.map((l) => [l.n, l.fx, l.fy, l.m]),
        ),
        table(
          ["Barre", "Position relative", "Fx · kN", "Fy · kN"],
          m.pl.map((l) => [
            m.mem.findIndex((b) => b.id === l.member) + 1,
            l.t,
            l.fx,
            l.fy,
          ]),
        ),
      ],
    );
    step(
      content,
      "assembly",
      [
        eq(String.raw`K^g_e=T_e^T K^l_e T_e,\qquad K_{ff}U_f=F_f-K_{fc}U_c`),
        txt(
          "Assemblage des matrices 6×6 des barres, puis élimination de Gauss avec pivot partiel sur les degrés de liberté libres.",
        ),
      ],
      [
        eq(
          String.raw`k_a=\frac{EA}{L},\quad k_2=\frac{12EI}{L^3},\quad k_3=\frac{6EI}{L^2},\quad k_4=\frac{4EI}{L},\quad k_5=\frac{2EI}{L}`,
        ),
        eq(String.raw`c=\frac{x_B-x_A}{L},\quad s=\frac{y_B-y_A}{L}`),
        table(
          ["Barre", "L · m", "cos α", "sin α", "EA/L · kN/m", "EI · kN·m²"],
          m.mem.map((b, i) => {
            const p = profileProperties({
                ...b,
                b: b.bw / 100,
                h: b.h / 100,
                tw: b.tw === undefined ? undefined : b.tw / 100,
                tf: b.tf === undefined ? undefined : b.tf / 100,
              }),
              g = r.mem[i].g;
            return [
              i + 1,
              g.L,
              g.c,
              g.s,
              (m.E * 1e6 * p.A) / g.L,
              m.E * 1e6 * p.I,
            ];
          }),
        ),
      ],
    );
    step(
      content,
      "reactions",
      [
        table(
          ["Nœud", "Rx · kN", "Ry · kN", "M · kN·m"],
          r.rea.map((v) => [v.i + 1, ...v.r]),
        ),
      ],
      [
        eq(String.raw`R=KU-F`),
        table(
          ["Résidu global Fx · kN", "Résidu global Fy · kN"],
          [[r.sx, r.sy]],
        ),
      ],
    );
    const vals = (key: "N" | "V" | "M") =>
      r.mem.map((b, i) => [
        i + 1,
        Math.min(...b.pts.map((p) => p[key])),
        Math.max(...b.pts.map((p) => p[key])),
      ]);
    step(
      content,
      "internal",
      [
        ...(["N", "V", "M"] as const).map((k) =>
          table(
            [
              `Barre · ${k}`,
              `Minimum · ${k === "M" ? "kN·m" : "kN"}`,
              `Maximum · ${k === "M" ? "kN·m" : "kN"}`,
            ],
            vals(k),
          ),
        ),
      ],
      [
        eq(String.raw`f_e^l=K_e^l u_e^l-f_{eq,e}^l`),
        txt(
          "Repère local x de A vers B, axe y obtenu par rotation antihoraire de 90°. Les efforts locaux sont reconstruits avec les charges propres à chaque sous-tronçon.",
        ),
        ...r.mem.map((b, i) =>
          table(
            [`Barre ${i + 1} · x · m`, "N · kN", "V · kN", "M · kN·m"],
            stations(
              b.pts.map((p) => p.x),
              ["N", "V", "M"].map((k) =>
                b.pts.map((p) => p[k as "N" | "V" | "M"]),
              ),
            ).map((j) => {
              const p = b.pts[j];
              return [p.x, p.N, p.V, p.M];
            }),
          ),
        ),
      ],
    );
    step(
      content,
      "deformation",
      [
        table(
          ["Barre", "|v| max · mm", "|θ| max · mrad"],
          r.mem.map((b, i) => [
            i + 1,
            Math.max(...b.pts.map((p) => Math.abs(p.v))) * 1000,
            Math.max(...b.pts.map((p) => Math.abs(p.theta))) * 1000,
          ]),
        ),
      ],
      [
        txt(
          "Les valeurs sont obtenues par interpolation des déplacements nodaux avec la contribution des charges réparties. Les extrema de déplacement sont ceux des points évalués par le solveur.",
        ),
        table(
          ["Nœud", "uₓ · mm", "uᵧ · mm", "θ · mrad"],
          m.nodes.map((_, i) => [
            i + 1,
            r.u[3 * i] * 1000,
            r.u[3 * i + 1] * 1000,
            r.u[3 * i + 2] * 1000,
          ]),
        ),
      ],
    );
    step(
      content,
      "checks",
      [
        table(
          ["Barre", "f max · mm", "f admissible · mm", "Taux", "Conclusion"],
          checks.map((c) => [
            c.label,
            c.actualMm,
            c.allowableMm,
            c.utilization,
            c.utilization <= 1 ? "Critère respecté" : "Critère dépassé",
          ]),
        ),
      ],
      [
        eq(String.raw`\eta_f=\frac{|f_{max}|}{f_{adm}}\leq1`),
        txt(
          "Critère utilisateur appliqué à chaque barre, sur son déplacement transversal local. Les effets différés et les vérifications BA ne sont pas inclus.",
        ),
      ],
    );
  } else if (project.type === "column-load" || project.type === "wall-load") {
    const m = descentSchema.parse(project.data),
      area = descentArea(m),
      wall = m.kind === "wall-load",
      settings = descentLevelLoads(m);
    const rows = descent(m.levels, area, wall ? m.wallLength : 0, m.quasi, {
      perLevel: settings,
      reduction: m.reduction,
      selfWeight: true,
    });
    method = `Descente gravitaire du sommet vers la base · ${m.system === "beams" ? "poutres et dalles" : "dalles seules"} · ${reductionOptions.find((o) => o.value === m.reduction)?.label}`;
    step(
      content,
      "model",
      [
        txt(method),
        sketch,
        table(
          [
            "Niveaux",
            "Hauteur totale · m",
            "Béton",
            "Règlement de l’estimation",
          ],
          [
            [
              m.levels.length,
              m.levels.reduce((s, l) => s + l.height, 0),
              m.concrete,
              m.code === "ec2" ? "EC2" : "BAEL 91",
            ],
          ],
        ),
      ],
      [
        txt(
          "Sections entières en béton de 25 kN/m³. Ordre des niveaux affiché du haut vers le bas. Les paramètres propres à un niveau remplacent uniquement les valeurs communes de ce niveau.",
        ),
        table(
          [
            "Niveau",
            "H · m",
            "b porteur · cm",
            "h porteur · cm",
            "e voile · cm",
          ],
          m.levels.map((l) => [l.label, l.height, l.b, l.h, l.e]),
        ),
      ],
    );
    step(
      content,
      "influence",
      [
        table(
          ["Niveau", "Aire · m²", "Longueur voile · m", "Origine"],
          m.levels.map((l, i) => [
            l.label,
            settings[i].area,
            wall ? settings[i].wallLength : "—",
            l.tributary ? "Paramètres propres" : "Paramètres du projet",
          ]),
        ),
      ],
      [
        eq(
          wall
            ? String.raw`A=L_v\frac{L_{av}+L_{ar}}{2}`
            : String.raw`A=(L_1+L_2)(L_3+L_4)`,
        ),
        txt(
          "Pour les poteaux, les longueurs saisies sont déjà les longueurs d’influence : elles ne sont pas divisées une seconde fois. Une aire propre à un niveau est utilisée directement.",
        ),
      ],
    );
    step(
      content,
      "permanent",
      [
        table(
          [
            "Niveau",
            "G dalle · kN",
            "G revêt. · kN",
            "G poutres principales · kN",
            "G poutres secondaires · kN",
            "G porteur · kN",
          ],
          rows.map((r) => [r.label, r.gs, r.gr, r.gp, r.gsec, r.gv]),
        ),
      ],
      [
        eq(
          String.raw`G_i=A_i(g_{plancher,i}+g_{revetements,i})+G_{p,i}+G_{s,i}+G_{porteur,i}`,
        ),
        eq(String.raw`G_{p,i}=25\,b_{p,i}h_{p,i}L_{p,i}`),
        eq(
          wall
            ? String.raw`G_{voile,i}=25 L_{v,i}e_iH_i`
            : String.raw`G_{poteau,i}=25 b_i h_i H_i`,
        ),
        txt(
          "Les expressions de poids propre utilisent les dimensions en mètres. Plancher 16+4 : 2,85 kN/m².",
        ),
        table(
          ["Niveau", "g plancher · kN/m²", "g revêt. · kN/m²", "A · m²"],
          m.levels.map((l, i) => [
            l.label,
            levelG(l),
            coatingG(l),
            settings[i].area,
          ]),
        ),
      ],
    );
    step(
      content,
      "variable",
      [
        table(
          ["Niveau", "Catégorie", "q · kN/m²", "A · m²", "Q niveau · kN"],
          m.levels.map((l, i) => [
            l.label,
            l.usage,
            l.q,
            settings[i].area,
            rows[i].ql,
          ]),
        ),
      ],
      [
        eq(String.raw`Q_i=q_i A_i`),
        ...m.levels.map((l, i) =>
          eq(
            String.raw`Q_{${i + 1}}=${n(l.q)}\times${n(settings[i].area)}=${n(rows[i].ql)}\;\mathrm{kN}`,
          ),
        ),
      ],
    );
    step(
      content,
      "reduction",
      [
        table(
          [
            "Niveau",
            "Q brut cumulé · kN",
            "α effectif",
            "Q réduit cumulé · kN",
          ],
          rows.map((r) => [r.label, r.qRaw, r.alpha, r.q]),
        ),
      ],
      [
        txt(
          `Règle sélectionnée : ${reductionOptions.find((o) => o.value === m.reduction)?.label}. Les groupes de catégories sont réduits séparément. La toiture H et les catégories exclues conservent leur coefficient applicable. Une réduction déjà appliquée à un étage supérieur n’est jamais réduite à nouveau.`,
        ),
        eq(String.raw`Q_{red,i}=\sum_c \alpha_{n,c}\sum_{j\leq i,\,c_j=c}Q_j`),
        table(
          ["Niveau", "Catégorie", "Niveaux chargés", "Q brut · kN", "α"],
          rows.flatMap((r) =>
            r.reductionDetails.map((d) => [
              r.label,
              d.usage,
              d.n,
              d.raw,
              d.alpha,
            ]),
          ),
        ),
      ],
    );
    step(
      content,
      "cumulative",
      [
        table(
          [
            "Niveau",
            "ΣG · kN",
            "ΣQ brut · kN",
            "ΣQ réduit · kN",
            "ELS · kN",
            "ELU · kN",
          ],
          rows.map((r) => [r.label, r.g, r.qRaw, r.q, r.nEls, r.nElu]),
        ),
      ],
      [
        eq(String.raw`G_{cum,i}=G_i+G_{cum,i-1}`),
        eq(String.raw`N_{ELU}=1.35G_{cum}+1.5Q_{red}`),
        eq(
          m.quasi
            ? String.raw`N_{ELS,qp}=G_{cum}+\sum_j\psi_{2,j}Q_j`
            : String.raw`N_{ELS}=G_{cum}+Q_{red}`,
        ),
        txt(
          m.quasi
            ? "L’ELS quasi permanent applique ψ₂ au Q brut par catégorie, sans cumuler ψ₂ et αₙ."
            : "ELS caractéristique selon la combinaison simplifiée de l’application.",
        ),
        ...rows.map((r, i) =>
          eq(
            String.raw`N_{ELU,${i + 1}}=1.35\times${n(r.g)}+1.5\times${n(r.q)}=${n(r.nElu)}\;\mathrm{kN}`,
          ),
        ),
      ],
    );
    if (wall)
      step(
        content,
        "wind",
        [
          table(
            [
              "Niveau",
              "Effort de vent ELU cumulé · kN",
              "Indicateur > 15 % de N_ELU",
            ],
            rows.map((r) => [
              r.label,
              r.windElu,
              r.windDominant ? "Oui" : "Non",
            ]),
          ),
        ],
        [
          eq(String.raw`q_p(z)=\max(0.45,\,0.55+0.032z)\;\mathrm{kN/m^2}`),
          eq(String.raw`W_{ELU,i}=1.5\sum_{j\leq i}q_p(z_j)L_{v,j}H_j`),
          txt(
            "Action de vent simplifiée à mi-hauteur de chaque niveau, présentée séparément des charges verticales. Les champs zone/terrain ne constituent pas ici un calcul complet de vent normatif.",
          ),
        ],
      );
    step(
      content,
      "section",
      [
        table(
          [
            "Niveau",
            "Effort ELU · kN",
            wall ? "e indicative · cm" : "Côté indicatif · cm",
          ],
          rows.map((r) => [
            r.label,
            r.nElu,
            wall
              ? wallPredim(r.nElu, r.wallLength, m.concrete, m.code).e
              : columnPredim(r.nElu, m.concrete, m.code).side,
          ]),
        ),
      ],
      [
        eq(
          String.raw`A_{c,min}=\frac{N_{ELU}}{\sigma_{eq}},\quad \sigma_{eq}=${n(coeff(m.concrete, m.code))}\;\mathrm{kN/cm^2}`,
        ),
        txt(
          "Estimation initiale arrondie par pas de 5 cm. Le flambement, la flexion composée, le ferraillage et les vérifications réglementaires BA détaillées restent à effectuer.",
        ),
      ],
    );
  } else if (project.type === "building") {
    const m = buildingSchema.parse(project.data),
      rows = buildingDescent(m);
    method =
      "Descente gravitaire par surfaces d’influence et réactions isostatiques · continuité des porteurs par coordonnées";
    step(
      content,
      "model",
      [
        txt(method),
        sketch,
        table(
          ["Niveau", "Hauteur · m", "Travées X", "Travées Y"],
          m.floors.map((f) => [
            f.name,
            f.height,
            f.spanX.length,
            f.spanY.length,
          ]),
        ),
      ],
      [
        txt(
          "Les niveaux sont stockés du RDC vers le sommet et calculés dans l’ordre inverse. Le poids propre du béton utilise 25 kN/m³. Le modèle ne résout pas une analyse globale de stabilité ni des poutres de reprise entre poteaux décalés.",
        ),
        ...m.floors.map((fl) =>
          table(
            [`${fl.name} · axe`, "Portées successives · m"],
            [
              ["X", fl.spanX.map((v) => f(v)).join(" ; ")],
              ["Y", fl.spanY.map((v) => f(v)).join(" ; ")],
            ],
          ),
        ),
      ],
    );
    step(
      content,
      "connectivity",
      [
        txt(
          "Contrôle des liaisons effectué avant calcul : aucun défaut bloquant détecté pour le modèle gravitaire pris en charge.",
        ),
      ],
      [
        txt(
          "Tolérance géométrique : 0,1 mm. Les extrémités de poutres doivent rejoindre des poteaux modélisés. Un poteau supérieur sans porteur inférieur bloque le calcul ; un poteau inférieur sans prolongement supérieur ne reçoit pas de cumul fictif.",
        ),
        table(
          ["Niveau", "Anomalies"],
          m.floors.map((fl) => [
            fl.name,
            validateBuilding(m).filter((v) => v.floor === fl.id).length,
          ]),
        ),
      ],
    );
    const panels = m.floors.flatMap((fl, index) =>
      Object.entries(fl.panels)
        .filter(
          ([, p]) =>
            p.exists &&
            !(
              index === m.floors.length - 1 &&
              m.roof?.enabled &&
              !m.roof.keepSlab
            ),
        )
        .map(([key, p]) => {
          const [c, r] = key.split(",").map(Number);
          return {
            floor: fl.name,
            p,
            area: fl.spanX[c] * fl.spanY[r] * (p.mode === "full" ? 1 : 0.5),
          };
        }),
    );
    step(
      content,
      "slabs",
      [
        table(
          ["Niveau", "Panneau", "A · m²", "G surf. · kN/m²", "Q surf. · kN/m²"],
          panels.map((v) => [
            v.floor,
            v.p.label,
            v.area,
            levelG(v.p.level) + coatingG(v.p.level),
            v.p.level.q,
          ]),
        ),
      ],
      [
        eq(
          String.raw`A_{court}=\frac{s^2}{4},\quad A_{long}=\frac{s}{2}\left(\ell-\frac{s}{2}\right)`,
        ),
        txt(
          "Répartition des panneaux par aires d’influence. Si une rive est supprimée, la surface est redistribuée vers les porteurs présents selon le modèle de l’application.",
        ),
        eq(
          String.raw`G_{panneau}=A(g_{plancher}+g_{revetements}),\quad Q_{panneau}=Aq`,
        ),
      ],
    );
    step(
      content,
      "beams",
      [
        table(
          [
            "Niveau",
            "Porteur",
            "L · m",
            "A influ. · m²",
            "G équiv. · kN/m",
            "Q équiv. · kN/m",
          ],
          rows.flatMap((r) =>
            r.local.edges.map((e) => [
              r.name,
              e.label,
              e.length,
              e.area,
              e.g,
              e.q,
            ]),
          ),
        ),
      ],
      [
        eq(
          String.raw`g_{pp}=25 b h,\quad R_A=R_B=\frac{q\ell}{2}\quad\text{(charge uniforme)}`,
        ),
        eq(
          String.raw`R_A=P\frac{\ell-a}{\ell},\quad R_B=P\frac{a}{\ell}\quad\text{(charge ponctuelle de toiture)}`,
        ),
        txt(
          "Les charges linéiques des poutres sont des équivalents de lecture. Les réactions ponctuelles de toiture utilisent leur bras de levier réel. La note ne constitue pas le dimensionnement d’une poutre sous ces réactions.",
        ),
      ],
    );
    const roof = rows[0].local.roof;
    step(
      content,
      "roof",
      roof
        ? [
            table(
              ["Surface inclinée · m²", "G toiture · kN", "Q toiture · kN"],
              [
                [
                  roof.facets.reduce((s, p) => s + p.area, 0),
                  roof.supports.reduce((s, p) => s + p.g, 0),
                  roof.supports.reduce((s, p) => s + p.q, 0),
                ],
              ],
            ),
            table(
              ["Ferme", "Côté", "Porteur cible", "G · kN", "Q · kN"],
              roof.routes.map((p) => [
                p.frame + 1,
                p.side + 1,
                p.target,
                p.g,
                p.q,
              ]),
            ),
          ]
        : [txt("Aucune toiture paramétrée dans ce modèle.")],
      [
        txt(
          "Cheminement : couverture → pannes → fermes équivalentes à deux appuis → porteurs de rive → poteaux et étages inférieurs. Un seul cas variable alternatif de toiture est retenu. Ce Q toiture n’est pas dégressé avec les étages.",
        ),
        eq(String.raw`G=\sum_f g_f A_f,\quad Q=\sum_f q_f A_f`),
      ],
    );
    step(
      content,
      "cumulative",
      [
        table(
          [
            "Niveau",
            "G étage · kN",
            "Q étage · kN",
            "ΣG · kN",
            "ΣQ réduit · kN",
            "ELS · kN",
            "ELU · kN",
          ],
          rows.map((r) => [
            r.name,
            r.local.totalG,
            r.local.totalQ,
            r.cumulativeG,
            r.cumulativeQ,
            r.cumulativeG + r.cumulativeQ,
            1.35 * r.cumulativeG + 1.5 * r.cumulativeQ,
          ]),
        ),
      ],
      [
        eq(String.raw`G_{cum,i}=G_{local,i}+G_{superieur,i}`),
        eq(
          String.raw`N_{ELS}=G_{cum}+Q_{red},\quad N_{ELU}=1.35G_{cum}+1.5Q_{red}`,
        ),
        txt(
          `Dégression : ${reductionOptions.find((o) => o.value === m.reduction)?.label}. Les Q bruts sont conservés par catégorie et origine avant réduction.`,
        ),
        table(
          [
            "Niveau",
            "Poteau",
            "G étage · kN",
            "G supérieur · kN",
            "ΣG · kN",
            "ΣQ brut · kN",
            "ΣQ réduit · kN",
            "ELU · kN",
          ],
          rows.flatMap((r) =>
            r.results.columns.map((c) => [
              r.name,
              c.label,
              c.sources[0].g,
              c.g - c.sources[0].g,
              c.g,
              c.live.reduce((s, v) => s + v.q, 0),
              c.q,
              c.nElu,
            ]),
          ),
        ),
        table(
          ["Niveau", "Poteau libre", "ΣG · kN", "ΣQ · kN", "ELU · kN"],
          rows.flatMap((r) =>
            r.results.obliques
              .filter((o) => o.kind === "column")
              .map((o) => [r.name, o.label, o.g, o.q, o.elu]),
          ),
        ),
      ],
    );
    const carriers = rows.flatMap((r) => [
      ...r.results.columns.map((c) => ({
        floor: r.name,
        label: c.label,
        g: c.g,
        q: c.q,
        kind: "Poteau",
        unit: "kN",
      })),
      ...r.results.edges
        .filter((e) => e.kind === "beam")
        .map((e) => ({
          floor: r.name,
          label: e.label,
          g: e.g,
          q: e.q,
          kind: "Poutre",
          unit: "kN/m",
        })),
      ...r.results.obliques.map((o) => ({
        floor: r.name,
        label: o.label,
        g: o.g,
        q: o.q,
        kind: o.kind === "column" ? "Poteau" : "Poutre",
        unit: o.kind === "column" ? "kN" : "kN/m",
      })),
    ]);
    const critical = ["Poteau", "Poutre"].flatMap((kind) =>
      (["G", "Q", "ELS", "ELU"] as const).map((cas) => {
        const value = (g: number, q: number) =>
          cas === "G"
            ? g
            : cas === "Q"
              ? q
              : cas === "ELS"
                ? g + q
                : 1.35 * g + 1.5 * q;
        const c = carriers
          .filter((c) => c.kind === kind)
          .sort((a, b) => value(b.g, b.q) - value(a.g, a.q))[0];
        return c
          ? [kind, cas, c.floor, c.label, value(c.g, c.q), c.unit]
          : [kind, cas, "—", "Aucun élément", 0, "—"];
      }),
    );
    step(
      content,
      "critical",
      [
        table(
          ["Famille", "Cas", "Niveau", "Élément", "Charge", "Unité"],
          critical,
        ),
      ],
      [
        txt(
          "Les poteaux sont comparés sur leurs efforts cumulés ; les poutres sur leurs charges linéiques équivalentes. Le maximum est recherché dans l’ensemble du bâtiment pour chaque cas.",
        ),
      ],
    );
    step(
      content,
      "wind",
      [
        table(
          ["Niveau", "Vent simplifié · kN"],
          rows.map((r) => [r.name, r.wind.force]),
        ),
      ],
      [
        txt(
          "Action simplifiée par niveau. Le vent est présenté séparément de la descente gravitaire G/Q et ne constitue pas une analyse spatiale complète du bâtiment.",
        ),
      ],
    );
  } else {
    const m = predimSchema.parse(project.data),
      code = m.code === "ec2" ? "EC2" : "BAEL 91";
    method =
      "Estimation initiale des dimensions · méthodes simplifiées de l’application";
    const inputs: Record<string, string | number> = {};
    const add = (name: string, value: string | number) => {
      inputs[name] = value;
    };
    if (["column", "wall"].includes(project.type)) {
      add("N_ELU · kN", m.n);
      add("Béton", m.concrete);
      add("Règlement", code);
      if (project.type === "wall") add("Longueur du voile · m", m.length);
    }
    if (project.type === "beam-size") {
      add("Portée · m", m.length);
      add("Charge ELU déjà combinée · kN/m", m.q);
      add("Schéma statique", m.support);
    }
    if (project.type === "stairs") {
      add("Hauteur d’étage · m", m.height);
      add("Longueur horizontale · m", m.length);
    }
    if (project.type === "slab") {
      add("Portée · m", m.length);
      add("Plancher", m.full ? "Dalle pleine" : "Corps creux");
    }
    if (project.type === "balcony") {
      add("Portée · m", m.length);
      add("G · kN/m²", m.g);
      add("Q · kN/m²", m.q);
    }
    if (project.type === "retaining") {
      add("Hauteur · m", m.height);
      add("γ du sol · kN/m³", m.gamma);
      add("φ · degrés", m.phi);
    }
    if (project.type === "footing") {
      add("Semelle", m.footing);
      add(m.footing === "filante" ? "N_ELS · kN/ml" : "N_ELS · kN", m.n);
      add("Contrainte admissible · kPa", m.soil);
      add("Dimension du porteur · cm", m.supportCm);
    }
    step(
      content,
      "inputs",
      [table(["Donnée", "Valeur"], Object.entries(inputs)), sketch],
      [
        txt(method),
        txt(
          "Les dimensions présentées ne constituent pas un ferraillage ou une vérification complète de résistance et de service. Les données et expressions ci-dessous correspondent aux fonctions actuellement exécutées par l’application.",
        ),
      ],
    );
    let limits =
      "Le ferraillage, les ancrages et les vérifications réglementaires détaillées restent à effectuer.";
    if (project.type === "column" || project.type === "wall") {
      const sigma = coeff(m.concrete, m.code),
        area = m.n / sigma;
      step(
        content,
        "resistance",
        [
          table(
            ["fck · MPa", "σ équivalente · kN/cm²", "Aire minimale · cm²"],
            [[fckOf(m.concrete), sigma, area]],
          ),
        ],
        [
          eq(
            String.raw`\sigma_{eq}=\frac{f_{ck}}{1.5}\times0.1\times${m.code === "ec2" ? "0.8" : "0.85^2"}`,
          ),
          eq(
            String.raw`A_{min}=\frac{N_{ELU}}{\sigma_{eq}}=\frac{${n(m.n)}}{${n(sigma)}}=${n(area)}\;\mathrm{cm^2}`,
          ),
          txt(
            "σ équivalente est le coefficient simplifié utilisé par l’estimation de section, pas une justification complète de poteau ou voile BA.",
          ),
        ],
      );
      if (project.type === "column") {
        const r = columnPredim(m.n, m.concrete, m.code);
        step(
          content,
          "section",
          [
            table(
              ["Section carrée proposée · cm"],
              [[`${f(r.side)} × ${f(r.side)}`]],
            ),
          ],
          [
            eq(
              String.raw`b=\max\left(20,\,5\left\lceil\frac{\sqrt{A_{min}}}{5}\right\rceil\right)=${n(r.side)}\;\mathrm{cm}`,
            ),
          ],
        );
      } else {
        const r = wallPredim(m.n, m.length, m.concrete, m.code);
        step(
          content,
          "section",
          [table(["Épaisseur proposée · cm"], [[r.e]])],
          [
            eq(
              String.raw`e_{min}=\frac{A_{min}}{100 L}=${n(area / (100 * m.length))}\;\mathrm{cm}`,
            ),
            txt("Arrondi au pas de 5 cm, avec épaisseur minimale 15 cm."),
          ],
        );
      }
      limits +=
        " La flexion composée, l’élancement et le flambement ne sont pas vérifiés dans cette estimation.";
    } else if (project.type === "beam-size") {
      const r = beamPredim(m.length, m.q, m.support),
        k =
          m.support === "isostatique" ? 12 : m.support === "continue_" ? 16 : 6,
        den =
          m.support === "isostatique" ? 8 : m.support === "continue_" ? 12 : 2;
      step(
        content,
        "depth",
        [table(["b proposé · cm", "h proposé · cm"], [[r.b, r.h]])],
        [
          eq(
            String.raw`h_0=\frac{100L}{k}=\frac{100\times${n(m.length)}}{${k}}=${n((100 * m.length) / k)}\;\mathrm{cm}`,
          ),
          txt(
            "Hauteur minimale 20 cm, largeur minimale 15 cm. h est arrondi au pas supérieur de 5 cm, puis b ≈ h/2 est arrondi au même pas.",
          ),
        ],
      );
      step(
        content,
        "moment",
        [table(["Moment de référence · kN·m"], [[r.moment]])],
        [
          eq(
            String.raw`M=\frac{q_{ELU}L^2}{${den}}=\frac{${n(m.q)}\times${n(m.length)}^2}{${den}}=${n(r.moment)}\;\mathrm{kN\,m}`,
          ),
          txt(
            "La charge saisie est déjà la charge ELU : aucune majoration supplémentaire n’est appliquée. Le coefficient de poutre continue est une estimation, pas l’analyse d’un système hyperstatique réel.",
          ),
        ],
      );
    } else if (project.type === "stairs") {
      const r = stairsPredim(m.height, m.length);
      step(
        content,
        "steps",
        [
          table(
            ["Marches", "Hauteur · cm", "Giron · cm"],
            [[r.steps, r.riser, r.tread]],
          ),
        ],
        [
          eq(String.raw`n=\max(2,\operatorname{arrondi}(H/0.17))=${r.steps}`),
          eq(
            String.raw`h=\frac{100H}{n}=${n(r.riser)}\;\mathrm{cm},\quad g=\frac{100L}{n-1}=${n(r.tread)}\;\mathrm{cm}`,
          ),
        ],
      );
      step(
        content,
        "blondel",
        [
          table(
            ["2h + g · cm", "Conclusion géométrique"],
            [
              [
                r.blondel,
                r.blondel >= 58 && r.blondel <= 64
                  ? "Dans l’intervalle 58–64 cm"
                  : "À ajuster",
              ],
            ],
          ),
        ],
        [
          eq(
            String.raw`2h+g=2\times${n(r.riser)}+${n(r.tread)}=${n(r.blondel)}\;\mathrm{cm}`,
          ),
        ],
      );
      step(
        content,
        "thickness",
        [table(["Paillasse indicative · cm"], [[r.e]])],
        [
          eq(
            String.raw`\ell_i=\sqrt{H^2+L^2}=${n(Math.hypot(m.height, m.length))}\;\mathrm{m}`,
          ),
          eq(
            String.raw`e_0=\frac{100\ell_i}{25}=${n((100 * Math.hypot(m.height, m.length)) / 25)}\;\mathrm{cm}`,
          ),
          txt("Épaisseur minimale 12 cm, arrondie au pas de 2 cm."),
        ],
      );
      limits +=
        " Les charges, appuis des volées et paliers doivent être analysés pour le dimensionnement BA.";
    } else if (project.type === "slab") {
      const r = slabPredim(m.length, m.full);
      step(
        content,
        "thickness",
        [table(["Plancher proposé", "Épaisseur · cm"], [[r.label, r.e]])],
        m.full
          ? [
              eq(
                String.raw`e_0=\frac{100L}{25}=${n((100 * m.length) / 25)}\;\mathrm{cm}`,
              ),
              txt(
                "Épaisseur minimale 12 cm, arrondie au pas supérieur de 2 cm.",
              ),
            ]
          : [
              eq(
                String.raw`e=\begin{cases}20\;\mathrm{cm}&L<4.5\;\mathrm{m}\\24\;\mathrm{cm}&4.5\leq L<6\;\mathrm{m}\\29\;\mathrm{cm}&L\geq6\;\mathrm{m}\end{cases}`,
              ),
              txt(
                "Abaque simplifié : L < 4,5 m → 16+4 (20 cm) ; 4,5 ≤ L < 6 m → 20+4 (24 cm) ; L ≥ 6 m → 25+4 (29 cm).",
              ),
            ],
      );
      limits +=
        " Le sens porteur, le poinçonnement et la flèche ne sont pas vérifiés dans cette estimation.";
    } else if (project.type === "balcony") {
      const r = balconyPredim(m.length, m.g, m.q),
        q = 1.35 * m.g + 1.5 * m.q;
      step(
        content,
        "loads",
        [table(["Charge ELU · kN/m pour une bande de 1 m"], [[q]])],
        [
          eq(
            String.raw`q_{ELU}=1.35G+1.5Q=1.35\times${n(m.g)}+1.5\times${n(m.q)}=${n(q)}`,
          ),
        ],
      );
      step(
        content,
        "moment",
        [table(["Moment d’encastrement · kN·m/ml"], [[r.moment]])],
        [
          eq(
            String.raw`M_{ELU}=\frac{q_{ELU}L^2}{2}=\frac{${n(q)}\times${n(m.length)}^2}{2}=${n(r.moment)}`,
          ),
        ],
      );
      step(
        content,
        "thickness",
        [table(["Épaisseur indicative · cm"], [[r.e]])],
        [
          eq(
            String.raw`e_0=\frac{100L}{10}=${n((100 * m.length) / 10)}\;\mathrm{cm}`,
          ),
          txt(
            "Minimum 12 cm, arrondi au pas supérieur de 2 cm. Console : armatures principales en nappe supérieure.",
          ),
        ],
      );
    } else if (project.type === "retaining") {
      const r = retainingPredim(m.height, m.gamma, m.phi);
      step(
        content,
        "pressure",
        [table(["Ka", "Poussée active · kN/ml"], [[r.ka, r.thrust]])],
        [
          eq(
            String.raw`K_a=\tan^2\left(45^\circ-\frac{${n(m.phi)}^\circ}{2}\right)=${n(r.ka)}`,
          ),
          eq(
            String.raw`P_a=\frac{1}{2}K_a\gamma H^2=0.5\times${n(r.ka)}\times${n(m.gamma)}\times${n(m.height)}^2=${n(r.thrust)}\;\mathrm{kN/m}`,
          ),
        ],
      );
      step(
        content,
        "geometry",
        [table(["Base · cm", "Voile · cm"], [[r.width, r.stem]])],
        [
          eq(
            String.raw`B_0=0.6H=${n(0.6 * m.height)}\;\mathrm{m},\quad e_0=\frac{100H}{12}=${n((100 * m.height) / 12)}\;\mathrm{cm}`,
          ),
          txt("Base et voile arrondis par pas de 5 cm, voile minimal 20 cm."),
        ],
      );
      limits +=
        " Glissement, renversement, portance, nappe d’eau et surcharges ne sont pas vérifiés par cette fonction simplifiée.";
    } else {
      const r = footingPredim(m.footing, m.n, m.soil, m.supportCm);
      step(
        content,
        "bearing",
        [
          table(
            [
              m.footing === "isolee"
                ? "A nécessaire · m²"
                : "Largeur nécessaire · m",
            ],
            [[r.area]],
          ),
        ],
        [
          eq(
            String.raw`A_{req}=\frac{N_{ELS}}{\sigma_{sol}}=\frac{${n(m.n)}}{${n(m.soil)}}=${n(r.area)}\;${m.footing === "isolee" ? "\\mathrm{m^2}" : "\\mathrm{m}\;\\text{(par metre lineaire)}"}`,
          ),
        ],
      );
      step(
        content,
        "dimensions",
        [
          table(
            [
              m.footing === "isolee"
                ? "Semelle carrée · cm"
                : "Largeur semelle filante · cm",
            ],
            [
              [
                m.footing === "isolee"
                  ? `${f(r.width)} × ${f(r.width)}`
                  : r.width,
              ],
            ],
          ),
        ],
        [
          eq(
            m.footing === "isolee"
              ? String.raw`B_0=100\sqrt{A_{req}}=${n(100 * Math.sqrt(r.area))}\;\mathrm{cm}`
              : String.raw`B_0=100A_{req}=${n(100 * r.area)}\;\mathrm{cm}`,
          ),
          txt(
            `Arrondi au pas supérieur de 5 cm ; minimum ${m.footing === "isolee" ? 60 : 40} cm.`,
          ),
        ],
      );
      step(
        content,
        "depth",
        [table(["Hauteur indicative · cm"], [[r.depth]])],
        [
          eq(
            String.raw`h_0=\frac{B-b_{porteur}}{4}=\frac{${n(r.width)}-${n(m.supportCm)}}{4}=${n((r.width - m.supportCm) / 4)}\;\mathrm{cm}`,
          ),
          txt(
            "Hauteur minimale 15 cm, arrondie au pas supérieur de 5 cm. La hauteur utile dépendra de l’enrobage et du ferraillage.",
          ),
        ],
      );
      limits +=
        " Le poinçonnement, le cisaillement, les excentricités et le ferraillage ne sont pas vérifiés ici.";
    }
    step(
      content,
      "limits",
      [txt(limits)],
      [
        txt(
          "Cette note reproduit la démarche de l’outil d’estimation initiale. Elle ne transforme pas ces proportions en une justification complète de dimensionnement béton armé.",
        ),
      ],
    );
  }
  return {
    project: project.name,
    type: typeInfo(project.type).label,
    generatedAt,
    author,
    method,
    sections: definitions
      .filter((s) => selection[s.id])
      .map((s) => {
        const detail = selection[s.id] as ReportDetail;
        const source = content[s.id];
        if (!source) throw Error(`Étape non disponible : ${s.title}`);
        return {
          id: s.id,
          title: s.title,
          detail,
          blocks: detail === "full" ? source.full : source.summary,
        };
      }),
  };
}
