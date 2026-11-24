import { profileShapes, profileProperties } from "./section-profile";
import { z } from "zod";
import { beamSolve } from "./beam-solver.js";
import { frameSolve } from "./frame-solver.js";
import { uid } from "@/lib/utils";
import { sectionTypesSchema, sectionCatalogue } from "./section-types";
const n = z.number().finite(),
  position = n.min(0).max(1000),
  id = z.string().min(1).max(100);
const restraint = z.union([z.boolean(), n.nonnegative().max(1e12)]);
const readingOptions = {
  probeUnit: z.enum(["m", "cm", "mm"]).optional(),
  deflectionLimit: z
    .object({
      mode: z.enum(["ratio", "absolute"]),
      ratio: n.min(1).max(100000),
      mm: n.positive().max(100000),
    })
    .optional(),
};
export const beamSchema = z
  .object({
    ...readingOptions,
    kind: z.literal("beam"),
    sectionTypes: sectionTypesSchema,
    L: n.positive().max(1000),
    material: z.object({ E: n.positive().max(1e7), nu: n.min(-0.9).max(0.49) }),
    timoshenko: z.boolean(),
    kappa: n.positive().max(1),
    selfWeight: z.object({
      enabled: z.boolean(),
      gamma: n.nonnegative().max(1000),
    }),
    sections: z
      .array(
        z.object({
          id,
          x1: position,
          x2: position,
          shape: z.enum(profileShapes),
          catalogue: z.string().optional(),
          tw: n.positive().optional(),
          tf: n.positive().optional(),
          b: n.positive(),
          h: n.positive(),
          A: n.positive(),
          I: n.positive(),
          As: n.positive(),
        }),
      )
      .min(1)
      .max(30),
    supports: z
      .array(
        z.object({
          id,
          x: position,
          ux: restraint,
          uy: restraint,
          rz: restraint,
          dx: n,
          dy: n,
          drz: n,
        }),
      )
      .max(30),
    loads: z
      .array(
        z.object({
          id,
          type: z.enum(["point", "dist", "moment"]),
          x: position,
          x1: position,
          x2: position,
          Fy: n,
          Fx: n,
          M: n,
          q1: n,
          q2: n,
        }),
      )
      .max(100),
    hinges: z.array(z.object({ id, x: position })).max(20),
  })
  .superRefine((m, ctx) => {
    for (const section of m.sections) {
      try {
        profileProperties(section);
      } catch (e) {
        ctx.addIssue({ code: "custom", message: (e as Error).message });
      }
    }
    const sorted = [...m.sections].sort((a, b) => a.x1 - b.x1);
    if (
      Math.abs(sorted[0].x1) > 1e-7 ||
      Math.abs(sorted[sorted.length - 1].x2 - m.L) > 1e-7 ||
      sorted.some(
        (s, i) =>
          s.x2 <= s.x1 || (i > 0 && Math.abs(sorted[i - 1].x2 - s.x1) > 1e-7),
      )
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Les tronçons doivent couvrir la poutre sans vide ni recouvrement.",
      });
    if (
      m.supports.some((s) => s.x > m.L) ||
      m.hinges.some((h) => h.x <= 0 || h.x >= m.L) ||
      m.loads.some((l) =>
        l.type === "dist" ? l.x2 > m.L || l.x2 <= l.x1 : l.x > m.L,
      )
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Un élément est situé hors de la poutre ou possède une longueur nulle.",
      });
  });
export type BeamModel = z.infer<typeof beamSchema>;
export type BeamSupport = BeamModel["supports"][number];
export type BeamLoad = BeamModel["loads"][number];
export const frameSchema = z
  .object({
    ...readingOptions,
    kind: z.literal("frame"),
    sectionTypes: sectionTypesSchema,
    pl: z
      .array(z.object({ id, member: id, t: n.min(0).max(1), fx: n, fy: n }))
      .max(100)
      .default([]),
    dl: z
      .array(
        z.object({
          id,
          member: id,
          w: n,
          q: n,
          w2: n.optional(),
          q2: n.optional(),
          loadStart: n.min(0).max(1),
          loadEnd: n.min(0).max(1),
        }),
      )
      .max(100)
      .optional(),
    E: n.positive().max(1e4),
    nodes: z
      .array(
        z.object({
          id,
          x: n.min(-1000).max(1000),
          y: n.min(-1000).max(1000),
          s: z.number().int().min(0).max(5),
          ky: n.positive().max(1e12).optional(),
          dx: n.optional(),
          dy: n.optional(),
          drz: n.optional(),
        }),
      )
      .min(2)
      .max(80),
    mem: z
      .array(
        z.object({
          id,
          a: z.number().int().positive(),
          b: z.number().int().positive(),
          bw: n.positive().max(1000),
          h: n.positive().max(1000),
          w: n,
          q: n,
          shape: z.enum(profileShapes).optional(),
          catalogue: z.string().optional(),
          tw: n.positive().optional(),
          tf: n.positive().optional(),
          A: n.positive().optional(),
          I: n.positive().optional(),
          w2: n.optional(),
          q2: n.optional(),
          loadStart: n.min(0).max(1).optional(),
          loadEnd: n.min(0).max(1).optional(),
        }),
      )
      .min(1)
      .max(150),
    nl: z
      .array(
        z.object({ id, n: z.number().int().positive(), fx: n, fy: n, m: n }),
      )
      .max(160),
  })
  .superRefine((m, ctx) => {
    for (const load of m.dl ?? []) {
      if (
        load.loadStart >= load.loadEnd ||
        !m.mem.some((b) => b.id === load.member)
      )
        ctx.addIssue({
          code: "custom",
          message: "Charge répartie : barre ou intervalle invalide.",
        });
    }
    for (const member of m.mem) {
      if ((member.loadStart ?? 0) >= (member.loadEnd ?? 1))
        ctx.addIssue({
          code: "custom",
          message: "La fin de la charge doit suivre son début.",
        });
      try {
        profileProperties({ ...member, b: member.bw });
      } catch (e) {
        ctx.addIssue({ code: "custom", message: (e as Error).message });
      }
    }
    if (
      m.mem.some(
        (b) => !m.nodes[b.a - 1] || !m.nodes[b.b - 1] || b.a === b.b,
      ) ||
      m.nl.some((l) => l.n > m.nodes.length) ||
      m.pl.some((l) => !m.mem.some((b) => b.id === l.member))
    )
      ctx.addIssue({
        code: "custom",
        message: "Un élément fait référence à un nœud inexistant.",
      });
  });
export type FrameModel = z.infer<typeof frameSchema>;
export function frameDistributions(model: FrameModel) {
  return [
    ...model.mem
      .filter(
        (b) => b.w !== 0 || (b.w2 ?? 0) !== 0 || b.q !== 0 || (b.q2 ?? 0) !== 0,
      )
      .map((b) => ({ ...b, member: b.id })),
    ...(model.dl ?? []),
  ];
}
export type AnalysisModel = BeamModel | FrameModel;
export interface BeamResult {
  ok: boolean;
  L: number;
  x: number[];
  N: number[];
  V: number[];
  M: number[];
  theta: number[];
  v: number[];
  reactions: { x: number; Fy: number; Fx: number; Mz: number }[];
  extrema: Record<
    "N" | "V" | "M" | "theta" | "v",
    { max: { val: number; x: number }; min: { val: number; x: number } }
  >;
  caracteristiques: {
    fermeture: { N_fin: number; V_fin: number; M_fin: number };
    fleche_max_abs: number;
    L_sur_f: number | null;
    part_effort_tranchant_pct?: number;
  };
}
export interface FrameResult {
  err?: string;
  u: number[];
  rea: { i: number; r: number[] }[];
  mem: {
    g: {
      L: number;
      c: number;
      s: number;
      A: { x: number; y: number };
      qx: number;
      qy: number;
    };
    ul: number[];
    fe: number[];
    pts: {
      x: number;
      N: number;
      V: number;
      M: number;
      v: number;
      theta: number;
      u?: number;
    }[];
  }[];
  sx: number;
  sy: number;
}
const vector = z.array(n);
const extrema = z.object({
  max: z.object({ val: n, x: n }),
  min: z.object({ val: n, x: n }),
});
const beamResultSchema = z.object({
  ok: z.boolean(),
  L: n,
  x: vector,
  N: vector,
  V: vector,
  M: vector,
  theta: vector,
  v: vector,
  reactions: z.array(z.object({ x: n, Fy: n, Fx: n, Mz: n })),
  extrema: z.object({
    N: extrema,
    V: extrema,
    M: extrema,
    theta: extrema,
    v: extrema,
  }),
  caracteristiques: z.object({
    fermeture: z.object({ N_fin: n, V_fin: n, M_fin: n }),
    fleche_max_abs: n,
    L_sur_f: n.nullable(),
    part_effort_tranchant_pct: n.optional(),
  }),
});
const frameResultSchema = z.object({
  u: vector,
  rea: z.array(z.object({ i: z.number(), r: vector })),
  mem: z.array(
    z.object({
      g: z.object({
        L: n,
        c: n,
        s: n,
        A: z.object({ x: n, y: n }),
        qx: n,
        qy: n,
      }),
      ul: vector,
      fe: vector,
      pts: z.array(
        z.object({ x: n, N: n, V: n, M: n, v: n, theta: n, u: n.optional() }),
      ),
    }),
  ),
  sx: n,
  sy: n,
});
export function solveBeam(model: BeamModel): BeamResult {
  const parsed = beamSchema.parse(model);
  parsed.sections = parsed.sections.map((s) => {
    if (s.shape === "custom") return s;
    const properties = profileProperties(s);
    return { ...s, ...properties, As: parsed.kappa * properties.A };
  });
  return beamResultSchema.parse(beamSolve(parsed, 180));
}
export function solveFrame(model: z.input<typeof frameSchema>): FrameResult {
  const parsed = frameSchema.parse(model);
  // Exact FE subdivision at point loads. Keep the public result indexed by the
  // user's members and nodes; auxiliary load nodes never leak into the editor.
  const expanded = structuredClone(parsed);
  expanded.mem = [];
  const ranges: { start: number; offsets: number[]; length: number }[] = [];
  for (const member of parsed.mem) {
    const a = parsed.nodes[member.a - 1],
      b = parsed.nodes[member.b - 1];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const loads = parsed.pl.filter((l) => l.member === member.id);
    const start = member.loadStart ?? 0,
      end = member.loadEnd ?? 1;
    const distributions = [
      { ...member, loadStart: start, loadEnd: end },
      ...(parsed.dl ?? []).filter((d) => d.member === member.id),
    ];
    const tolerance = 1e-6 / Math.max(length, 1e-7);
    const stations = [
      0,
      ...distributions.flatMap((d) => [d.loadStart, d.loadEnd]),
      ...loads.map((l) => l.t),
      1,
    ]
      .map((t) => (t < tolerance ? 0 : 1 - t < tolerance ? 1 : t))
      .sort((a, b) => a - b)
      .reduce<number[]>((kept, t) => {
        if (!kept.length || t - kept.at(-1)! > tolerance) kept.push(t);
        return kept;
      }, []);
    const nodes = stations.map((t) => {
      if (t === 0) return member.a;
      if (t === 1) return member.b;
      expanded.nodes.push({
        id: uid(),
        x: a.x + t * (b.x - a.x),
        y: a.y + t * (b.y - a.y),
        s: 0,
      });
      return expanded.nodes.length;
    });
    for (const l of loads)
      expanded.nl.push({
        id: l.id,
        n: nodes[stations.findIndex((t) => Math.abs(t - l.t) <= tolerance)],
        fx: l.fx,
        fy: l.fy,
        m: 0,
      });
    ranges.push({
      start: expanded.mem.length,
      offsets: stations.slice(0, -1).map((t) => t * length),
      length,
    });
    const properties = profileProperties({
      ...member,
      b: member.bw / 100,
      h: member.h / 100,
      tw: member.tw === undefined ? undefined : member.tw / 100,
      tf: member.tf === undefined ? undefined : member.tf / 100,
    });
    for (let i = 0; i < nodes.length - 1; i++) {
      const t0 = stations[i],
        t1 = stations[i + 1];
      const intensity = (axis: "w" | "q", t: number) =>
        distributions.reduce((sum, d) => {
          if ((t0 + t1) / 2 <= d.loadStart || (t0 + t1) / 2 >= d.loadEnd)
            return sum;
          return (
            sum +
            d[axis] +
            (((d[axis === "w" ? "w2" : "q2"] ?? d[axis]) - d[axis]) *
              (t - d.loadStart)) /
              (d.loadEnd - d.loadStart)
          );
        }, 0);
      expanded.mem.push({
        ...member,
        ...properties,
        a: nodes[i],
        b: nodes[i + 1],
        w: intensity("w", t0),
        w2: intensity("w", t1),
        q: intensity("q", t0),
        q2: intensity("q", t1),
      });
    }
  }
  const raw = frameSolve(expanded);
  const error = z.object({ err: z.string() }).safeParse(raw);
  if (error.success) throw Error(error.data.err);
  const result = frameResultSchema.parse(raw);
  return {
    ...result,
    u: result.u.slice(0, parsed.nodes.length * 3),
    rea: result.rea.filter((r) => r.i < parsed.nodes.length),
    mem: ranges.map(({ start, offsets, length }) => {
      const pieces = result.mem.slice(start, start + offsets.length),
        first = pieces[0],
        last = pieces.at(-1)!;
      return {
        ...first,
        g: { ...first.g, L: length },
        ul: [...first.ul.slice(0, 3), ...last.ul.slice(3)],
        fe: [...first.fe.slice(0, 3), ...last.fe.slice(3)],
        pts: pieces.flatMap((p, i) =>
          p.pts.map((v) => ({
            ...v,
            u: v.u ?? p.ul[0] * (1 - v.x / p.g.L) + (p.ul[3] * v.x) / p.g.L,
            x: v.x + offsets[i],
          })),
        ),
      };
    }),
  };
}
export const section = (
  x1: number,
  x2: number,
  b = 0.3,
  h = 0.5,
): BeamModel["sections"][number] => ({
  id: uid(),
  x1,
  x2,
  shape: "rect",
  b,
  h,
  A: b * h,
  I: (b * h ** 3) / 12,
  As: (5 * b * h) / 6,
});
export const support = (x: number, type = "pin"): BeamSupport => ({
  id: uid(),
  x,
  ux: type !== "roller",
  uy: true,
  rz: type === "fixed",
  dx: 0,
  dy: 0,
  drz: 0,
});
export const load = (type: BeamLoad["type"], L: number): BeamLoad => ({
  id: uid(),
  type,
  x: L / 2,
  x1: 0,
  x2: L,
  Fy: 20,
  Fx: 0,
  M: 10,
  q1: 10,
  q2: 10,
});
export function beamPreset(type = "iso"): BeamModel {
  const base: BeamModel = {
    kind: "beam",
    sectionTypes: sectionCatalogue(true),
    L: 8,
    material: { E: 30000, nu: 0.2 },
    timoshenko: true,
    kappa: 5 / 6,
    selfWeight: { enabled: false, gamma: 25 },
    sections: [section(0, 8)],
    supports: [support(0), support(8, "roller")],
    loads: [
      { ...load("dist", 8), x2: 4, q1: 12, q2: 12 },
      { ...load("point", 8), x: 5, Fy: 40 },
    ],
    hinges: [],
  };
  if (type === "blank") base.loads = [];
  if (type === "cantilever") {
    base.L = 4;
    base.sections = [section(0, 4, 0.3, 0.6)];
    base.supports = [support(0, "fixed")];
    base.loads = [
      { ...load("dist", 4), q1: 30, q2: 10 },
      { ...load("moment", 4), x: 4, M: 20 },
    ];
  }
  if (type === "continuous") {
    base.L = 9;
    base.sections = [
      section(0, 5),
      { ...section(5, 9), shape: "custom", I: 0.00625 },
    ];
    base.supports = [support(0), support(5, "roller"), support(9, "roller")];
    base.loads = [
      { ...load("dist", 9), x2: 5, q1: 15, q2: 15 },
      { ...load("point", 9), x: 7, Fy: 30 },
    ];
  }
  if (type === "gerber") {
    base.L = 10;
    base.sections = [section(0, 10)];
    base.supports = [support(0), support(6, "roller"), support(10, "roller")];
    base.loads = [load("dist", 10)];
    base.hinges = [{ id: uid(), x: 8 }];
  }
  return base;
}
export function framePreset(type = "portal"): FrameModel {
  const nodes = [
    { id: uid(), x: 0, y: 0, s: 1 },
    { id: uid(), x: 0, y: 4, s: 0 },
    { id: uid(), x: 6, y: 4, s: 0 },
    { id: uid(), x: 6, y: 0, s: 1 },
  ];
  const mem = [
    { id: uid(), a: 1, b: 2, bw: 30, h: 30, w: 0, q: 0 },
    { id: uid(), a: 2, b: 3, bw: 30, h: 50, w: 20, q: 0 },
    { id: uid(), a: 3, b: 4, bw: 30, h: 30, w: 0, q: 0 },
  ];
  if (type === "two-storeys") {
    nodes.push(
      { id: uid(), x: 0, y: 8, s: 0 },
      { id: uid(), x: 6, y: 8, s: 0 },
    );
    mem.push(
      { id: uid(), a: 2, b: 5, bw: 30, h: 30, w: 0, q: 0 },
      { id: uid(), a: 5, b: 6, bw: 30, h: 50, w: 20, q: 0 },
      { id: uid(), a: 3, b: 6, bw: 30, h: 30, w: 0, q: 0 },
    );
  }
  return {
    kind: "frame",
    sectionTypes: sectionCatalogue(true),
    pl: [],
    E: 30,
    nodes,
    mem,
    nl: [{ id: uid(), n: 2, fx: 15, fy: 0, m: 0 }],
  };
}
export function resizeBeam(m: BeamModel, L: number): BeamModel {
  const factor = L / m.L;
  return {
    ...m,
    L,
    sections: m.sections.map((s) => ({
      ...s,
      x1: s.x1 * factor,
      x2: s.x2 * factor,
    })),
    supports: m.supports.map((s) => ({ ...s, x: s.x * factor })),
    hinges: m.hinges.map((s) => ({ ...s, x: s.x * factor })),
    loads: m.loads.map((l) => ({
      ...l,
      x: l.x * factor,
      x1: l.x1 * factor,
      x2: l.x2 * factor,
    })),
  };
}
export const frameSupportNames = [
  "Libre",
  "Encastrement",
  "Articulé",
  "Bloqué verticalement",
  "Bloqué horizontalement",
  "Ressort vertical",
];
export function removeFrameNode(model: FrameModel, index: number): FrameModel {
  const n = index + 1;
  return {
    ...model,
    nodes: model.nodes.filter((_, i) => i !== index),
    mem: model.mem
      .filter((b) => b.a !== n && b.b !== n)
      .map((b) => ({
        ...b,
        a: b.a > n ? b.a - 1 : b.a,
        b: b.b > n ? b.b - 1 : b.b,
      })),
    nl: model.nl
      .filter((l) => l.n !== n)
      .map((l) => ({ ...l, n: l.n > n ? l.n - 1 : l.n })),
    pl: model.pl.filter((l) =>
      model.mem.some((b) => b.id === l.member && b.a !== n && b.b !== n),
    ),
    dl: model.dl?.filter((l) =>
      model.mem.some((b) => b.id === l.member && b.a !== n && b.b !== n),
    ),
  };
}
