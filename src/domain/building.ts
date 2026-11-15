import {
  reductionSchema,
  reducedLive,
  type LiveContribution,
} from "./load-reduction";
import { sectionTypesSchema } from "./section-types";
import { z } from "zod";
import { levelSchema } from "./levels";
import {
  newLevel,
  levelG,
  coatingG,
  elu,
  els,
  panelTributary,
  windPressure,
} from "./engineering";
import { uid } from "@/lib/utils";
const positive = z.number().positive().max(1000);
const slotSchema = z.object({
  exists: z.boolean(),
  kind: z.enum(["beam", "wall"]),
  b: positive,
  h: positive,
});
export const floorSchema = z
  .object({
    id: z.string(),
    name: z.string().min(1).max(100),
    height: positive,
    spanX: z.array(positive).min(1).max(12),
    spanY: z.array(positive).min(1).max(12),
    nodes: z.record(z.string(), slotSchema),
    edges: z.record(z.string(), slotSchema),
    panels: z.record(
      z.string(),
      z.object({
        exists: z.boolean(),
        group: z.string().nullable(),
        label: z.string().max(100),
        mode: z.enum(["full", "ne", "sw"]),
        level: levelSchema,
      }),
    ),
    obliques: z
      .array(
        z.object({
          id: z.string(),
          kind: z.enum(["beam", "column"]),
          x1: z.number(),
          y1: z.number(),
          x2: z.number(),
          y2: z.number(),
          b: positive,
          h: positive,
          angle: z.number(),
          area: z.number().nonnegative().max(1e6),
          g: z.number().nonnegative().max(1e6),
          q: z.number().nonnegative().max(1e6),
        }),
      )
      .max(100),
  })
  .superRefine((floor, ctx) => {
    const nx = floor.spanX.length,
      ny = floor.spanY.length;
    const coordinate = (key: string, maxX: number, maxY: number) => {
      const parts = key.split(",");
      if (parts.length !== 2 || !parts.every((p) => /^\d+$/.test(p)))
        return false;
      const [c, r] = parts.map(Number);
      return c <= maxX && r <= maxY;
    };
    if (
      Object.keys(floor.nodes).some((k) => !coordinate(k, nx, ny)) ||
      Object.keys(floor.panels).some((k) => !coordinate(k, nx - 1, ny - 1))
    )
      ctx.addIssue({ code: "custom", message: "Position hors de la grille" });
    for (const key of Object.keys(floor.edges)) {
      const [axis, line, segment, ...extra] = key.split(":");
      if (
        extra.length ||
        !["h", "v"].includes(axis) ||
        !/^\d+$/.test(line ?? "") ||
        !/^\d+$/.test(segment ?? "") ||
        Number(line) > (axis === "h" ? ny : nx) ||
        Number(segment) >= (axis === "h" ? nx : ny)
      )
        ctx.addIssue({ code: "custom", message: "Poutre hors de la grille" });
    }
  });
export const buildingSchema = z.object({
  kind: z.literal("building"),
  reduction: reductionSchema.default("none"),
  sectionTypes: sectionTypesSchema,
  floors: z.array(floorSchema).min(1).max(60),
  zone: z.string(),
  region: z.string(),
  terrain: z.string(),
  direction: z.number(),
});
export type Floor = z.infer<typeof floorSchema>;
export type BuildingModel = z.infer<typeof buildingSchema>;
export const roman = (num: number): string => {
  let n = num,
    out = "";
  for (const [v, s] of [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ] as [number, string][]) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
};
export const nodeName = (c: number, r: number) =>
  `${r + 1}${String.fromCharCode(65 + c)}`;
export const edgeKey = (horizontal: boolean, line: number, segment: number) =>
  `${horizontal ? "h" : "v"}:${line}:${segment}`;
export function resizeFloor(f: Floor, nx: number, ny: number): Floor {
  const next: Floor = {
    ...f,
    spanX: Array.from({ length: nx }, (_, i) => f.spanX[i] ?? 4),
    spanY: Array.from({ length: ny }, (_, i) => f.spanY[i] ?? 4),
    nodes: {},
    edges: {},
    panels: {},
  };
  for (let c = 0; c <= nx; c++)
    for (let r = 0; r <= ny; r++) {
      const key = `${c},${r}`;
      next.nodes[key] = f.nodes[key] ?? {
        exists: true,
        kind: "beam",
        b: 25,
        h: 25,
      };
    }
  for (let r = 0; r <= ny; r++)
    for (let c = 0; c < nx; c++) {
      const key = edgeKey(true, r, c);
      next.edges[key] = f.edges[key] ?? {
        exists: true,
        kind: "beam",
        b: 25,
        h: 40,
      };
    }
  for (let c = 0; c <= nx; c++)
    for (let r = 0; r < ny; r++) {
      const key = edgeKey(false, c, r);
      next.edges[key] = f.edges[key] ?? {
        exists: true,
        kind: "beam",
        b: 25,
        h: 40,
      };
    }
  for (let c = 0; c < nx; c++)
    for (let r = 0; r < ny; r++) {
      const key = `${c},${r}`;
      next.panels[key] = f.panels[key] ?? {
        exists: true,
        group: null,
        label: roman(r * nx + c + 1),
        mode: "full",
        level: newLevel(`Panneau ${roman(r * nx + c + 1)}`),
      };
    }
  return next;
}
export const newFloor = (name = "RDC"): Floor =>
  resizeFloor(
    {
      id: uid(),
      name,
      height: 3,
      spanX: [],
      spanY: [],
      nodes: {},
      edges: {},
      panels: {},
      obliques: [],
    },
    3,
    2,
  );
export const buildingDefaults = (): BuildingModel => ({
  kind: "building",
  reduction: "ec1",
  sectionTypes: [],
  floors: [newFloor()],
  zone: "II",
  region: "Intérieure",
  terrain: "IIIb",
  direction: 0,
});
export function floorCoordinates(f: Floor) {
  const xs = [0],
    ys = [0];
  f.spanX.forEach((v) => xs.push(xs.at(-1)! + v));
  f.spanY.forEach((v) => ys.push(ys.at(-1)! + v));
  return { xs, ys };
}
export function buildingResults(f: Floor) {
  const { xs, ys } = floorCoordinates(f);
  const warnings: string[] = [];
  const columns = Object.entries(f.nodes)
    .filter(([, n]) => n.exists)
    .map(([key, n]) => {
      const [c, r] = key.split(",").map(Number);
      return {
        key,
        label: nodeName(c, r),
        x: xs[c],
        y: ys[r],
        area: 0,
        g: ((n.b * n.h) / 1e4) * f.height * 25,
        q: 0,
        live: [] as LiveContribution[],
        nElu: 0,
        nEls: 0,
      };
    });
  const edges = Object.entries(f.edges)
    .filter(([, e]) => e.exists)
    .map(([key, e]) => {
      const [axis, l, s] = key.split(":"),
        line = +l,
        segment = +s,
        horizontal = axis === "h";
      const a = horizontal ? `${segment},${line}` : `${line},${segment}`;
      const b = horizontal
        ? `${segment + 1},${line}`
        : `${line},${segment + 1}`;
      const length = horizontal ? f.spanX[segment] : f.spanY[segment];
      return {
        key,
        a,
        b,
        label: `${e.kind === "beam" ? "Poutre" : "Voile"} ${nodeName(...(a.split(",").map(Number) as [number, number]))}–${nodeName(...(b.split(",").map(Number) as [number, number]))}`,
        kind: e.kind,
        length,
        area: 0,
        g: (e.b / 100) * (e.kind === "wall" ? f.height : e.h / 100) * 25,
        q: 0,
        live: [] as LiveContribution[],
        contributions: [] as string[],
        elu: 0,
        els: 0,
        moment: 0,
        shear: 0,
      };
    });
  let area = 0;
  for (const [key, p] of Object.entries(f.panels)) {
    if (!p.exists) continue;
    const [c, r] = key.split(",").map(Number),
      w = f.spanX[c],
      h = f.spanY[r];
    const t = panelTributary(w, h, 1),
      horizontal = w <= h ? t.shortArea : t.longArea,
      vertical = w <= h ? t.longArea : t.shortArea;
    const candidates: [string, number][] = [];
    if (p.mode !== "sw")
      candidates.push(
        [edgeKey(true, r, c), horizontal],
        [edgeKey(false, c + 1, r), vertical],
      );
    if (p.mode !== "ne")
      candidates.push(
        [edgeKey(true, r + 1, c), horizontal],
        [edgeKey(false, c, r), vertical],
      );
    const supports = candidates
      .map(([key, a]) => ({ edge: edges.find((e) => e.key === key), a }))
      .filter((s) => s.edge);
    const panelArea = w * h * (p.mode === "full" ? 1 : 0.5),
      sum = supports.reduce((s, v) => s + v.a, 0);
    area += panelArea;
    if (!sum) {
      warnings.push(`Panneau ${p.label} sans poutre ni voile porteur.`);
      continue;
    }
    for (const { edge, a } of supports) {
      const share = (panelArea * a) / sum;
      edge!.area += share;
      edge!.g += (share * (levelG(p.level) + coatingG(p.level))) / edge!.length;
      edge!.q += (share * p.level.q) / edge!.length;
      edge!.live.push({
        floor: f.id,
        usage: p.level.usage,
        q: share * p.level.q,
      });
      edge!.contributions.push(p.label);
    }
  }
  const transmit = (
    key: string,
    g: number,
    live: LiveContribution[],
    area: number,
  ) => {
    const node = columns.find((n) => n.key === key);
    if (!node) {
      warnings.push(
        `Appui ${key} absent : ajoutez un poteau ou modélisez explicitement le transfert.`,
      );
      return;
    }
    node.area += area;
    node.g += g;
    node.live.push(...live);
    node.q += live.reduce((s, v) => s + v.q, 0);
  };
  for (const e of edges) {
    e.elu = elu(e.g, e.q);
    e.els = els(e.g, e.q);
    e.moment = (e.elu * e.length ** 2) / 8;
    e.shear = (e.elu * e.length) / 2;
    if (e.kind === "beam")
      for (const key of [e.a, e.b])
        transmit(
          key,
          (e.g * e.length) / 2,
          e.live.map((v) => ({ ...v, q: v.q / 2 })),
          e.area / 2,
        );
  }
  const obliques = f.obliques.map((o, i) => {
    const length = Math.hypot(o.x2 - o.x1, o.y2 - o.y1);
    const g =
      o.kind === "beam"
        ? o.g + ((o.b * o.h) / 1e4) * 25
        : o.g * o.area + ((o.b * o.h) / 1e4) * f.height * 25;
    const q = o.kind === "beam" ? o.q : o.q * o.area;
    if (o.kind === "beam")
      for (const [x, y] of [
        [o.x1, o.y1],
        [o.x2, o.y2],
      ]) {
        const node = columns.find((n) => Math.hypot(n.x - x, n.y - y) < 1e-6);
        if (node)
          transmit(
            node.key,
            (g * length) / 2,
            [{ floor: f.id, usage: "E", q: (q * length) / 2 }],
            0,
          );
        else
          warnings.push(
            `Poutre libre ${i + 1} : extrémité sans poteau de grille.`,
          );
      }
    return {
      ...o,
      label: `${o.kind === "beam" ? "Poutre" : "Poteau"} libre ${i + 1}`,
      length,
      g,
      q,
      elu: elu(g, q),
      els: els(g, q),
    };
  });
  columns.forEach((n) => {
    n.nElu = elu(n.g, n.q);
    n.nEls = els(n.g, n.q);
  });
  const totalG =
    columns.reduce((s, n) => s + n.g, 0) +
    edges
      .filter((e) => e.kind === "wall")
      .reduce((s, e) => s + e.g * e.length, 0) +
    obliques.filter((o) => o.kind === "column").reduce((s, o) => s + o.g, 0);
  const totalQ =
    columns.reduce((s, n) => s + n.q, 0) +
    edges
      .filter((e) => e.kind === "wall")
      .reduce((s, e) => s + e.q * e.length, 0) +
    obliques.filter((o) => o.kind === "column").reduce((s, o) => s + o.q, 0);
  return {
    area,
    totalElu: elu(totalG, totalQ),
    totalG,
    totalQ,
    columns,
    edges,
    obliques,
    warnings: [...new Set(warnings)],
  };
}

/** Floors are stored ground→roof. Transmit raw G/Q roof→ground, then reduce Q once at each level. */
export function buildingDescent(model: BuildingModel) {
  const rows = model.floors.map((f) => ({
    id: f.id,
    name: f.name,
    results: buildingResults(f),
    wind: floorWind(model, model.floors.indexOf(f)),
  }));
  for (let i = rows.length - 1; i >= 0; i--) {
    const current = rows[i].results;
    if (current.warnings.length)
      throw Error(`${rows[i].name} : ${current.warnings[0]}`);
    const above = rows[i + 1]?.results;
    if (above) {
      for (const upper of above.columns) {
        const lower = current.columns.find(
          (n) => Math.hypot(n.x - upper.x, n.y - upper.y) < 1e-6,
        );
        if (!lower)
          throw Error(
            `${rows[i].name} : le poteau supérieur ${upper.label} n’a pas de poteau aligné. Un transfert doit être modélisé.`,
          );
        lower.g += upper.g;
        lower.live.push(...upper.live);
      }
      for (const upper of above.edges.filter((e) => e.kind === "wall")) {
        const lower = current.edges.find(
          (e) =>
            e.kind === "wall" &&
            e.key === upper.key &&
            Math.abs(e.length - upper.length) < 1e-6,
        );
        const a = floorCoordinates(model.floors[i]),
          b = floorCoordinates(model.floors[i + 1]);
        if (!lower || JSON.stringify(a) !== JSON.stringify(b))
          throw Error(
            `${rows[i].name} : le voile supérieur ${upper.label} doit être aligné.`,
          );
        lower.g += upper.g;
        lower.live.push(...upper.live);
        lower.q += upper.q;
      }
      for (const upper of above.obliques.filter((o) => o.kind === "column")) {
        const lower = current.obliques.find(
          (o) =>
            o.kind === "column" &&
            Math.hypot(o.x1 - upper.x1, o.y1 - upper.y1) < 1e-6,
        );
        if (!lower)
          throw Error(
            `${rows[i].name} : poteau libre supérieur sans porteur aligné.`,
          );
        lower.g += upper.g;
        lower.q += upper.q;
      }
    }
    for (const n of current.columns) {
      const reduction = reducedLive(n.live, model.reduction);
      n.q = reduction.q;
      n.nElu = elu(n.g, n.q);
      n.nEls = els(n.g, n.q);
    }
    for (const e of current.edges.filter((e) => e.kind === "wall")) {
      e.q = reducedLive(e.live, model.reduction).q / e.length;
      e.elu = elu(e.g, e.q);
      e.els = els(e.g, e.q);
    }
    current.obliques.forEach((o) => {
      o.elu = elu(o.g, o.q);
      o.els = els(o.g, o.q);
    });
  }
  return rows.reverse().map((row) => {
    const local = buildingResults(model.floors.find((f) => f.id === row.id)!);
    return {
      ...row,
      local,
      cumulativeG:
        row.results.columns.reduce((s, n) => s + n.g, 0) +
        row.results.edges
          .filter((e) => e.kind === "wall")
          .reduce((s, e) => s + e.g * e.length, 0) +
        row.results.obliques
          .filter((o) => o.kind === "column")
          .reduce((s, o) => s + o.g, 0),
      cumulativeQ:
        row.results.columns.reduce((s, n) => s + n.q, 0) +
        row.results.edges
          .filter((e) => e.kind === "wall")
          .reduce((s, e) => s + e.q * e.length, 0) +
        row.results.obliques
          .filter((o) => o.kind === "column")
          .reduce((s, o) => s + o.q, 0),
    };
  });
}

export function mergeNeighbors(f: Floor, key: string) {
  const [c, r] = key.split(",").map(Number);
  return [
    [c - 1, r, edgeKey(false, c, r)],
    [c + 1, r, edgeKey(false, c + 1, r)],
    [c, r - 1, edgeKey(true, r, c)],
    [c, r + 1, edgeKey(true, r + 1, c)],
  ]
    .filter(([x, y, edge]) => {
      const p = f.panels[`${x},${y}`];
      return p?.exists && !f.edges[edge as string]?.exists;
    })
    .map(([x, y]) => `${x},${y}`);
}
export function mergePanels(f: Floor, a: string, b: string): Floor {
  if (!mergeNeighbors(f, a).includes(b))
    throw Error(
      "Supprimez la poutre séparatrice avant de regrouper ces panneaux.",
    );
  const next = structuredClone(f),
    ga = next.panels[a].group,
    gb = next.panels[b].group,
    group = ga ?? gb ?? uid();
  for (const [key, p] of Object.entries(next.panels))
    if (
      key === a ||
      key === b ||
      (ga && p.group === ga) ||
      (gb && p.group === gb)
    )
      p.group = group;
  return next;
}
export function floorWind(model: BuildingModel, index: number) {
  const floor = model.floors[index],
    z =
      model.floors.slice(0, index).reduce((s, f) => s + f.height, 0) +
      floor.height / 2,
    width = (model.direction === 0 ? floor.spanY : floor.spanX).reduce(
      (a, b) => a + b,
      0,
    );
  return {
    z,
    pressure: windPressure(z),
    force: windPressure(z) * width * floor.height * 1.5,
  };
}

/** True 45-degree bisectors, including trapezoids on rectangular panels. */
export function splitPanelRect(
  x: number,
  y: number,
  w: number,
  h: number,
): Record<string, number[][]> {
  if (w <= h) {
    const top = [x + w / 2, y + w / 2],
      bottom = [x + w / 2, y + h - w / 2];
    return {
      top: [[x, y], [x + w, y], top],
      bottom: [[x, y + h], [x + w, y + h], bottom],
      left: [[x, y], top, bottom, [x, y + h]],
      right: [[x + w, y], top, bottom, [x + w, y + h]],
    };
  }
  const left = [x + h / 2, y + h / 2],
    right = [x + w - h / 2, y + h / 2];
  return {
    left: [[x, y], [x, y + h], left],
    right: [[x + w, y], [x + w, y + h], right],
    top: [[x, y], left, right, [x + w, y]],
    bottom: [[x, y + h], left, right, [x + w, y + h]],
  };
}
