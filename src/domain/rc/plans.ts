import type { RCModel } from "./model";
import type { RCResult } from "@/lib/rc-engine";
import { columnStirrups } from "./visual-data";
export type PlanPrimitive =
  | { kind: "line"; points: [number, number][]; layer: string; dash?: boolean }
  | { kind: "circle"; x: number; y: number; r: number; layer: string }
  | {
      kind: "text";
      x: number;
      y: number;
      text: string;
      latex?: string;
      size: number;
      anchor?: "left" | "center" | "right";
      layer: string;
    };
export type RCPlan = {
  title: string;
  number: string;
  scale: string;
  items: PlanPrimitive[];
  width: 297;
  height: 210;
};
export type PlanMetadata = {
  project: string;
  author: string;
  date: string;
  revision?: string;
};
const n = (x: number, d = 2) => Number(x.toFixed(d)).toString();
const weights: Record<string, number> = {
  CONCRETE: 0.2,
  STEEL: 0.28,
  STIRRUPS: 0.16,
  DIMENSIONS: 0.13,
  TEXT: 0.13,
  FRAME: 0.25,
  DEMAND: 0.2,
  CAPACITY: 0.25,
};
function drawing(
  title: string,
  number: string,
  scale: string,
  meta: PlanMetadata,
) {
  const items: PlanPrimitive[] = [];
  const line = (points: [number, number][], layer = "CONCRETE", dash = false) =>
    items.push({ kind: "line", points, layer, dash });
  const rect = (
    x: number,
    y: number,
    w: number,
    h: number,
    layer = "CONCRETE",
  ) =>
    line(
      [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
        [x, y],
      ],
      layer,
    );
  const text = (
    x: number,
    y: number,
    text: string,
    size = 2.5,
    latex?: string,
    anchor: "left" | "center" | "right" = "left",
  ) =>
    items.push({
      kind: "text",
      x,
      y,
      text,
      size,
      latex,
      anchor,
      layer: "TEXT",
    });
  const dim = (x1: number, x2: number, y: number, label: string) => {
    line(
      [
        [x1, y - 2],
        [x1, y + 2],
      ],
      "DIMENSIONS",
    );
    line(
      [
        [x2, y - 2],
        [x2, y + 2],
      ],
      "DIMENSIONS",
    );
    line(
      [
        [x1, y],
        [x2, y],
      ],
      "DIMENSIONS",
    );
    text((x1 + x2) / 2, y - 3, label, 2.2, undefined, "center");
  };
  const circle = (x: number, y: number, r: number, layer = "STEEL") =>
    items.push({ kind: "circle", x, y, r, layer });
  rect(5, 5, 287, 200, "FRAME");
  text(12, 14, title, 4);
  text(12, 20, "DIMENSIONS EN mm — PLAN DE PRINCIPE", 2.2);
  line(
    [
      [5, 174],
      [292, 174],
    ],
    "FRAME",
  );
  text(
    12,
    180,
    "Dispositions à confirmer avant exécution : ancrages, recouvrements, interfaces et contrôles non couverts.",
    2.1,
  );
  rect(5, 184, 287, 21, "FRAME");
  line(
    [
      [174, 184],
      [174, 205],
    ],
    "FRAME",
  );
  line(
    [
      [232, 184],
      [232, 205],
    ],
    "FRAME",
  );
  line(
    [
      [174, 195],
      [292, 195],
    ],
    "FRAME",
  );
  text(9, 190, "CaliSigma Structural", 3.1);
  text(9, 196, meta.project.slice(0, 76), 2.8);
  text(
    9,
    201.5,
    `Auteur : ${meta.author.trim() || "Non renseigné"}`.slice(0, 90),
    2.1,
  );
  text(178, 189, "FORMAT / ÉCHELLES", 1.9);
  text(178, 193, `A4 paysage · ${scale}`, 2.3);
  text(236, 189, "PLAN / INDICE", 1.9);
  text(236, 193, `${number} / ${meta.revision || "A"}`, 2.3);
  text(178, 199, "ÉTABLI LE", 1.9);
  text(178, 203, meta.date, 2.1);
  text(236, 200, "297 × 210 mm", 2.4);
  return {
    plan: {
      title,
      number,
      scale,
      items,
      width: 297 as const,
      height: 210 as const,
    },
    line,
    rect,
    text,
    dim,
    circle,
  };
}
function scaleFor(mm: number, max: number) {
  return (
    [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find((s) => mm / s <= max) ??
    Math.ceil(mm / max / 100) * 100
  );
}
function section(
  d: ReturnType<typeof drawing>,
  m: RCModel,
  r: RCResult,
  design: any,
  cx: number,
  cy: number,
) {
  const col = m.kind === "rc-column",
    circ = col && m.section.type === "circ",
    t = !col && m.section.type === "t";
  const b =
      (col ? (circ ? m.section.a_cm : m.section.b_cm) : m.section.bw_cm) * 10,
    h = (col ? (circ ? m.section.a_cm : m.section.h_cm) : m.section.h_cm) * 10,
    bf = t ? m.section.beff_cm * 10 : b,
    hf = t ? m.section.hf_cm * 10 : 0;
  const s = scaleFor(Math.max(bf, h), 52),
    x = cx - bf / s / 2,
    y = cy - h / s / 2,
    web = cx - b / s / 2,
    c = m.detailing.cnom_mm,
    pt = m.detailing.phi_t_mm;
  if (circ) d.circle(cx, cy, b / s / 2, "CONCRETE");
  else if (t)
    d.line(
      [
        [x, y],
        [x + bf / s, y],
        [x + bf / s, y + hf / s],
        [web + b / s, y + hf / s],
        [web + b / s, y + h / s],
        [web, y + h / s],
        [web, y + hf / s],
        [x, y + hf / s],
        [x, y],
      ],
      "CONCRETE",
    );
  else d.rect(web, y, b / s, h / s);
  if (circ) d.circle(cx, cy, (b / 2 - c - pt / 2) / s, "STIRRUPS");
  else
    d.rect(
      web + (c + pt / 2) / s,
      y + (c + pt / 2) / s,
      (b - 2 * c - pt) / s,
      (h - 2 * c - pt) / s,
      "STIRRUPS",
    );
  if (col) {
    const lay = r.reinforcement.layout,
      e = lay.e_mm;
    if (circ)
      for (let j = 0; j < lay.n; j++)
        d.circle(
          cx + ((b / 2 - e) / s) * Math.cos((j * 2 * Math.PI) / lay.n),
          cy + ((h / 2 - e) / s) * Math.sin((j * 2 * Math.PI) / lay.n),
          Math.max(0.35, lay.phi / 2 / s),
        );
    else {
      for (let j = 0; j < lay.k; j++)
        for (const yy of [e, h - e])
          d.circle(
            web + (e + ((b - 2 * e) * j) / (lay.k - 1)) / s,
            y + yy / s,
            Math.max(
              0.35,
              (j === 0 || j === lay.k - 1 ? lay.phi : lay.phi_i) / 2 / s,
            ),
          );
      for (let j = 1; j <= lay.m; j++)
        for (const xx of [e, b - e])
          d.circle(
            web + xx / s,
            y + (e + ((h - 2 * e) * j) / (lay.m + 1)) / s,
            Math.max(0.35, lay.phi_i / 2 / s),
          );
      for (const j of lay.pins_b ?? []) {
        const xx = web + (e + ((b - 2 * e) * j) / (lay.k - 1)) / s;
        d.line(
          [
            [xx, y + e / s],
            [xx, y + (h - e) / s],
          ],
          "STIRRUPS",
        );
      }
      for (const j of lay.pins_h ?? []) {
        const yy = y + (e + ((h - 2 * e) * j) / (lay.m + 1)) / s;
        d.line(
          [
            [web + e / s, yy],
            [web + (b - e) / s, yy],
          ],
          "STIRRUPS",
        );
      }
    }
  } else {
    for (const [steel, bottom] of [
      [design.tension, !design.negative],
      [design.compression, design.negative],
    ] as const)
      for (const row of steel.rows)
        for (const xx of row.xs_mm)
          d.circle(
            web + xx / s,
            y + (bottom ? h - row.offset_mm : row.offset_mm) / s,
            Math.max(0.3, row.phi_mm / 2 / s),
          );
  }
  d.dim(x, x + bf / s, y + h / s + 7, `${circ ? "D" : "b"} = ${n(bf, 0)}`);
  d.text(
    x + bf / s + 3,
    cy,
    `h = ${n(h, 0)}`,
    2.2,
    `$h=${n(h, 0)}\\,\\mathrm{mm}$`,
  );
  d.text(cx, y - 7, `COUPE · 1:${s}`, 2.4, undefined, "center");
  d.text(
    cx,
    y + h / s + 15,
    `Cadre HA${pt} · cnom ${c}`,
    2.2,
    `$\\phi_t=${pt}\\,\\mathrm{mm},\\quad c_{nom}=${c}\\,\\mathrm{mm}$`,
    "center",
  );
  return s;
}
function spacingRuns(positions: number[]) {
  const runs: { a: number; b: number; step: number; count: number }[] = [];
  for (let i = 1; i < positions.length; i++) {
    const step = (positions[i] - positions[i - 1]) * 1000,
      last = runs.at(-1);
    if (last && Math.abs(last.step - step) < 0.05) {
      last.b = positions[i];
      last.count++;
    } else runs.push({ a: positions[i - 1], b: positions[i], step, count: 1 });
  }
  return runs;
}
export function rcPlans(m: RCModel, r: RCResult, meta: PlanMetadata): RCPlan[] {
  if (m.kind === "rc-column") {
    const H = m.geometry.l_m * 1000,
      s = scaleFor(H, 120),
      b = (m.section.type === "circ" ? m.section.a_cm : m.section.b_cm) * 10;
    const d = drawing(
        "Poteau — plan de ferraillage",
        "BA-P01",
        `élévation 1:${s}`,
        meta,
      ),
      x = 44,
      y = 32,
      w = b / s,
      eh = H / s;
    d.rect(x, y, w, eh);
    const e = r.reinforcement.layout.e_mm;
    for (const xx of [x + e / s, x + w - e / s])
      d.line(
        [
          [xx, y],
          [xx, y + eh],
        ],
        "STEEL",
      );
    const positions = columnStirrups(m, r);
    for (const z of positions)
      d.line(
        [
          [x + m.detailing.cnom_mm / s, y + eh - (z * 1000) / s],
          [x + w - m.detailing.cnom_mm / s, y + eh - (z * 1000) / s],
        ],
        "STIRRUPS",
      );
    d.line(
      [
        [x - 8, y],
        [x - 8, y + eh],
      ],
      "DIMENSIONS",
    );
    d.text(
      x - 11,
      y + eh / 2,
      `L = ${n(H, 0)}`,
      2.5,
      `$L=${n(H, 0)}\\,\\mathrm{mm}$`,
      "right",
    );
    const lap = r.reinforcement.lap;
    if (lap) {
      const l = Math.min(H, lap.l0_cm * 10) / s;
      d.line(
        [
          [x + w + 3, y + eh - l],
          [x + w + 7, y + eh - l],
          [x + w + 7, y + eh],
          [x + w + 3, y + eh],
        ],
        "DIMENSIONS",
      );
      d.text(
        x + w + 10,
        y + eh - l / 2,
        `l0 = ${n(lap.l0_cm * 10, 0)}`,
        2.3,
        `$l_0=${n(lap.l0_cm * 10, 0)}\\,\\mathrm{mm}$`,
      );
    }
    const lay = r.reinforcement.layout;
    d.text(
      35,
      163,
      `${lay.n} HA${lay.phi}${lay.mixed ? ` / HA${lay.phi_i}` : ""} — aciers longitudinaux`,
      2.6,
    );
    const cs = section(d, m, r, null, 181, 64);
    d.plan.scale += ` · coupe 1:${cs}`;
    d.text(126, 115, "RÉPARTITION DES CADRES", 3);
    d.text(
      126,
      122,
      `HA${m.detailing.phi_t_mm} · ${positions.length} positions · pas réel entre axes`,
      2.4,
    );
    const runs = spacingRuns(positions);
    const rows = runs.length > 9 ? runs.slice(0, 8) : runs;
    rows.forEach((v, j) =>
      d.text(
        126,
        129 + j * 4.4,
        `${n(v.a * 1000, 0)} – ${n(v.b * 1000, 0)} : ${v.count} × ${n(v.step, 1)} mm`,
        2.3,
      ),
    );
    if (runs.length > 9)
      d.text(
        126,
        169,
        `Suite : ${runs.length - 8} zones supplémentaires repérées dans la note.`,
        2.1,
      );
    for (const p of d.plan.items)
      if (p.kind === "text" && p.text.startsWith("A4 paysage"))
        p.text = `A4 paysage · ${d.plan.scale}`;
    return [d.plan];
  }
  const plans: RCPlan[] = [];
  m.spans.forEach((span, i) => {
    const L = r.effective_lengths_m[i],
      groups = r.bars[i],
      allGroups = [...groups.top.groups, ...groups.bottom.groups],
      minX = Math.min(
        -m.supports[i].width_m / 2,
        ...allGroups.map((g: any) => g.start_m),
      ),
      maxX = Math.max(
        L + m.supports[i + 1].width_m / 2,
        ...allGroups.map((g: any) => g.end_m),
      ),
      s = scaleFor((maxX - minX) * 1000, 240),
      x = 14 - (minX * 1000) / s,
      y = 48,
      h = (m.section.h_cm * 10) / s,
      w = (L * 1000) / s;
    const d = drawing(
      `${span.name} — plan de ferraillage`,
      `BA-B${String(i + 1).padStart(2, "0")}`,
      `profil 1:${s}`,
      meta,
    );
    d.rect(x, y, w, h);
    for (const [j, xx] of [
      [i, x],
      [i + 1, x + w],
    ]) {
      const sw = (m.supports[j].width_m * 1000) / s;
      d.rect(xx - sw / 2, y - 3, sw, h + 6);
    }
    for (const z of r.shear[i].positions_m)
      d.line(
        [
          [x + (z * 1000) / s, y + m.detailing.cnom_mm / s],
          [x + (z * 1000) / s, y + h - m.detailing.cnom_mm / s],
        ],
        "STIRRUPS",
      );
    for (const [nappe, bottom] of [
      ["bottom", true],
      ["top", false],
    ] as const)
      groups[nappe].groups.forEach((g: any, j: number) => {
        const yy =
          y +
          (bottom
            ? h - m.detailing.cnom_mm / s - j * 0.9
            : m.detailing.cnom_mm / s + j * 0.9);
        d.line(
          [
            [x + (g.start_m * 1000) / s, yy],
            [x + (g.end_m * 1000) / s, yy],
          ],
          "STEEL",
        );
      });
    d.text(
      x,
      32,
      `Haut : ${groups.top.groups.map((g: any) => `${g.count} HA${g.phi_mm}`).join(" + ")}`,
      2.6,
    );
    d.text(
      x,
      y + h + 10,
      `Bas : ${groups.bottom.groups.map((g: any) => `${g.count} HA${g.phi_mm}`).join(" + ")}`,
      2.6,
    );
    d.dim(
      x,
      x + w,
      y + h + 20,
      `leff = ${n(L * 1000, 0)} · ln = ${n(span.ln_m * 1000, 0)}`,
    );
    const cs = section(d, m, r, r.spans[i], 248, 120);
    d.plan.scale += ` · coupe 1:${cs}`;
    d.text(12, 102, "NOMENCLATURE DES ACIERS LONGITUDINAUX", 3);
    d.text(
      12,
      109,
      "Nappe / repère     Barres          Début x       Fin x       Longueur",
      2.2,
    );
    const rows = ["top", "bottom"].flatMap((k) =>
      groups[k].groups.map((g: any) => ({ k, g })),
    );
    rows.slice(0, 10).forEach(({ k, g }, j) => {
      const yy = 116 + j * 4.3;
      d.text(12, yy, `${k === "top" ? "Haut" : "Bas"} / ${g.id}`, 2.2);
      d.text(66, yy, `${g.count} HA${g.phi_mm}`, 2.2);
      d.text(100, yy, n(g.start_m * 1000, 0), 2.2);
      d.text(126, yy, n(g.end_m * 1000, 0), 2.2);
      d.text(153, yy, `${n(g.length_m * 1000, 0)} mm`, 2.2);
    });
    d.text(
      12,
      166,
      `Cadres HA${m.detailing.phi_t_mm} · ${r.shear[i].count} positions · cnom ${m.detailing.cnom_mm} mm`,
      2.4,
    );
    for (const p of d.plan.items)
      if (p.kind === "text" && p.text.startsWith("A4 paysage"))
        p.text = `A4 paysage · ${d.plan.scale}`;
    const runs = spacingRuns(r.shear[i].positions_m);
    d.text(
      12,
      171,
      `Pas réels (mm) : ${runs
        .slice(0, 12)
        .map((v) => `${v.count} x ${n(v.step, 1)}`)
        .join(" ; ")}${runs.length > 12 ? " ; suite dans la note" : ""}`,
      2,
    );
    plans.push(d.plan);
    const ep = drawing(
      `${span.name} — épure d’arrêt des barres`,
      `BA-E${String(i + 1).padStart(2, "0")}`,
      `abscisses 1:${s}`,
      meta,
    );
    for (const [nappe, top, baseline] of [
      ["bottom", false, 76],
      ["top", true, 140],
    ] as const) {
      const data = groups[nappe].epure,
        max = Math.max(
          1,
          ...data.flatMap((p: any) => [p.capacity_kNm, p.demand_kNm]),
        );
      ep.text(
        12,
        baseline - 38,
        `${top ? "Nappe supérieure" : "Nappe inférieure"} · a1 = ${n(groups[nappe].shift_m * 1000, 0)} mm · marge ${n(groups[nappe].margin_kNm)} kN.m`,
        2.6,
        `\\textbf{${top ? "Nappe superieure" : "Nappe inferieure"}}\\quad $a_1=${n(groups[nappe].shift_m * 1000, 0)}\\,\\mathrm{mm},\\;\\Delta M_{min}=${n(groups[nappe].margin_kNm)}\\,\\mathrm{kN\\,m}$`,
      );
      ep.line(
        [
          [x, baseline],
          [x + w, baseline],
        ],
        "DIMENSIONS",
      );
      for (const [key, layer] of [
        ["demand_kNm", "DEMAND"],
        ["capacity_kNm", "CAPACITY"],
      ] as const)
        ep.line(
          data.map(
            (p: any) =>
              [x + (p.x_m * 1000) / s, baseline - (p[key] / max) * 30] as [
                number,
                number,
              ],
          ),
          layer,
          key === "demand_kNm",
        );
      groups[nappe].groups.forEach((g: any, j: number) => {
        const yy = baseline + 5 + j * 4;
        ep.line(
          [
            [x + (g.start_m * 1000) / s, yy],
            [x + (g.end_m * 1000) / s, yy],
          ],
          "STEEL",
        );
        ep.text(x + w + 4, yy, `${g.count} HA${g.phi_mm} · ${g.diagram}`, 2);
      });
    }
    ep.text(
      12,
      163,
      "Pointillés : enveloppe décalée MEd · Trait continu : résistance mobilisable MRd avec rampes d’ancrage.",
      2.4,
      `Pointilles : $M_{Ed,dec}$\\quad Trait continu : $M_{Rd}$ avec rampes d'ancrage.`,
    );
    ep.text(
      12,
      169,
      "Contrôle analytique entre nus d’appuis. Les ancrages dans les appuis sont vérifiés séparément.",
      2.1,
    );
    plans.push(ep.plan);
  });
  return plans;
}
const accents: Record<string, string> = {
  é: "\\'{e}",
  è: "\\`{e}",
  ê: "\\^{e}",
  à: "\\`{a}",
  â: "\\^{a}",
  ô: "\\^{o}",
  î: "\\^{i}",
  ï: '\\"{i}',
  ù: "\\`{u}",
  û: "\\^{u}",
  ç: "\\c{c}",
  É: "\\'{E}",
  È: "\\`{E}",
  À: "\\`{A}",
  œ: "\\oe{}",
  "’": "'",
  "—": "---",
  "–": "--",
  "·": "$\\cdot$",
  "×": "$\\times$",
  "²": "$^2$",
  "³": "$^3$",
  "≤": "$\\leq$",
  "≥": "$\\geq$",
};
export function escapePlanTex(value: string) {
  return value.replace(
    /[\\{}%$#&_~^éèêàâôîïùûçÉÈÀœ’—–·×²³≤≥]/g,
    (c) =>
      accents[c] ??
      {
        "\\": "\\textbackslash{}",
        "~": "\\textasciitilde{}",
        "^": "\\textasciicircum{}",
      }[c] ??
      "\\" + c,
  );
}
export function planTikz(plan: RCPlan, standalone = false): string {
  const body = plan.items
    .map((p) => {
      const style = `line width=${weights[p.layer] ?? 0.18}mm${p.kind === "line" && p.dash ? ",dashed" : ""}`;
      if (p.kind === "line")
        return `\\draw[${style}] ${p.points.map(([x, y]) => `(${n(x, 4)},${n(y, 4)})`).join(" -- ")};`;
      if (p.kind === "circle")
        return `\\draw[${style}${p.layer === "STEEL" ? ",fill=black" : ""}] (${n(p.x, 4)},${n(p.y, 4)}) circle (${n(p.r, 4)}mm);`;
      return `\\node[anchor=${p.anchor === "center" ? "center" : p.anchor === "right" ? "east" : "west"},inner sep=0pt,font=\\fontsize{${n((p.size * 72) / 25.4, 3)}}{${n((p.size * 1.2 * 72) / 25.4, 3)}}\\selectfont] at (${n(p.x, 4)},${n(p.y, 4)}) {${p.latex ?? escapePlanTex(p.text)}};`;
    })
    .join("\n");
  return `${standalone ? "\\documentclass{standalone}\n\\usepackage{tikz}\n" : ""}\\begin{document}\n\\begin{tikzpicture}[x=1mm,y=-1mm]\n\\path[use as bounding box] (0,0) rectangle (297,210);\n${body}\n\\end{tikzpicture}\n\\end{document}`;
}
