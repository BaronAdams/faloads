import { z } from "zod";
import { levelSchema } from "./levels";
import {
  newLevel,
  levelG,
  coatingG,
  elu,
  els,
  panelTributary,
  tributaryWidth,
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
  floors: [newFloor()],
  zone: "II",
  region: "Intérieure",
  terrain: "IIIb",
  direction: 0,
});
export function buildingResults(f: Floor) {
  const nx = f.spanX.length,
    ny = f.spanY.length,
    columns: {
      label: string;
      area: number;
      g: number;
      q: number;
      nElu: number;
      nEls: number;
    }[] = [],
    edges = new Map<
      string,
      {
        label: string;
        kind: string;
        length: number;
        elu: number;
        els: number;
        contributions: string[];
      }
    >();
  let area = 0,
    totalElu = 0;
  const add = (
    key: string,
    pressureElu: number,
    pressureEls: number,
    panel: string,
  ) => {
    const e = f.edges[key];
    if (!e?.exists) return;
    const [orientation, line, segment] = key.split(":"),
      horizontal = orientation === "h",
      length = horizontal ? f.spanX[Number(segment)] : f.spanY[Number(segment)];
    const current = edges.get(key) ?? {
      label: `${e.kind === "beam" ? "Poutre" : "Voile"} ${horizontal ? Number(line) + 1 : String.fromCharCode(65 + Number(line))}·${Number(segment) + 1}`,
      kind: e.kind,
      length,
      elu: 0,
      els: 0,
      contributions: [],
    };
    current.elu += pressureElu;
    current.els += pressureEls;
    current.contributions.push(panel);
    edges.set(key, current);
  };
  for (let c = 0; c < nx; c++)
    for (let r = 0; r < ny; r++) {
      const p = f.panels[`${c},${r}`];
      if (!p?.exists) continue;
      const g = levelG(p.level) + coatingG(p.level),
        q = p.level.q,
        w = f.spanX[c],
        h = f.spanY[r],
        e = panelTributary(w, h, elu(g, q)),
        s = panelTributary(w, h, els(g, q)),
        horizontalElu = w <= h ? e.shortLoad : e.longLoad,
        verticalElu = w <= h ? e.longLoad : e.shortLoad,
        horizontalEls = w <= h ? s.shortLoad : s.longLoad,
        verticalEls = w <= h ? s.longLoad : s.shortLoad;
      const factor = p.mode === "full" ? 1 : 0.5;
      area += w * h * factor;
      totalElu += elu(g, q) * w * h * factor;
      if (p.mode === "full" || p.mode === "ne") {
        add(
          edgeKey(true, r, c),
          horizontalElu * factor,
          horizontalEls * factor,
          p.label,
        );
        add(
          edgeKey(false, c + 1, r),
          verticalElu * factor,
          verticalEls * factor,
          p.label,
        );
      }
      if (p.mode === "full" || p.mode === "sw") {
        add(
          edgeKey(true, r + 1, c),
          horizontalElu * factor,
          horizontalEls * factor,
          p.label,
        );
        add(
          edgeKey(false, c, r),
          verticalElu * factor,
          verticalEls * factor,
          p.label,
        );
      }
    }
  // Preserve the original app's per-floor method: full geometric tributary
  // area × arithmetic mean of adjacent existing panels, not a global FEM.
  for (let c = 0; c <= nx; c++)
    for (let r = 0; r <= ny; r++) {
      if (!f.nodes[`${c},${r}`]?.exists) continue;
      const adjacent = [
        [-1, -1],
        [0, -1],
        [-1, 0],
        [0, 0],
      ]
        .map(([dc, dr]) => f.panels[`${c + dc},${r + dr}`])
        .filter((p) => p?.exists);
      if (!adjacent.length) continue;
      const a = tributaryWidth(f.spanX, c) * tributaryWidth(f.spanY, r),
        g =
          adjacent.reduce(
            (s, p) => s + levelG(p.level) + coatingG(p.level),
            0,
          ) / adjacent.length,
        q = adjacent.reduce((s, p) => s + p.level.q, 0) / adjacent.length;
      columns.push({
        label: nodeName(c, r),
        area: a,
        g: g * a,
        q: q * a,
        nElu: elu(g * a, q * a),
        nEls: els(g * a, q * a),
      });
    }
  return {
    area,
    totalElu,
    columns,
    edges: [...edges.entries()].map(([key, e]) => ({
      ...e,
      key,
      moment: (e.elu * e.length ** 2) / 8,
      shear: (e.elu * e.length) / 2,
    })),
    obliques: f.obliques.map((o, i) => ({
      id: o.id,
      label: `${o.kind === "beam" ? "Poutre" : "Poteau"} oblique ${i + 1}`,
      kind: o.kind,
      length: Math.hypot(o.x2 - o.x1, o.y2 - o.y1),
      elu: o.kind === "beam" ? elu(o.g, o.q) : elu(o.g * o.area, o.q * o.area),
    })),
  };
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
