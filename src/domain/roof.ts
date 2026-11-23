import { z } from "zod";
import type { Floor } from "./building";
import { uid } from "@/lib/utils";
const scalar = z.number().finite().nonnegative().max(10000);
const loadSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  value: scalar,
  basis: z.enum(["slope", "plan"]),
  face: z.number().int().min(0).max(4),
  action: z.enum(["G", "maintenance", "snow", "other"]),
});
export const roofSchema = z.object({
  enabled: z.boolean(),
  shape: z.enum(["mono", "gable", "hip"]),
  axis: z.enum(["x", "y"]),
  rise: z.number().finite().min(0.05).max(100),
  spacing: z.number().finite().min(0.5).max(100),
  purlinSpacing: z.number().finite().min(0.3).max(10),
  keepSlab: z.boolean(),
  variable: z.enum(["maintenance", "snow", "other"]),
  loads: z.array(loadSchema).max(40),
});
export type Roof = z.infer<typeof roofSchema>;
export type RoofPoint = { u: number; v: number; z: number };
export const roofNames = {
  mono: "Un pan",
  gable: "Deux pans",
  hip: "Quatre pans",
};
export const roofDefault = (): Roof => ({
  enabled: false,
  shape: "gable",
  axis: "x",
  rise: 2,
  spacing: 3,
  purlinSpacing: 1.5,
  keepSlab: true,
  variable: "maintenance",
  loads: [
    {
      id: uid(),
      name: "Couverture",
      value: 0,
      basis: "slope",
      face: 0,
      action: "G",
    },
    {
      id: uid(),
      name: "Charpente · poids surfacique équivalent",
      value: 0,
      basis: "plan",
      face: 0,
      action: "G",
    },
    {
      id: uid(),
      name: "Entretien",
      value: 0,
      basis: "plan",
      face: 0,
      action: "maintenance",
    },
  ],
});
export function roofGeometry(floor: Floor, roof: Roof) {
  const along = roof.axis === "x" ? floor.spanX : floor.spanY,
    across = roof.axis === "x" ? floor.spanY : floor.spanX;
  const L = along.reduce((a, b) => a + b, 0),
    D = across.reduce((a, b) => a + b, 0),
    h = roof.rise;
  const A = { u: 0, v: 0, z: 0 },
    B = { u: L, v: 0, z: roof.shape === "mono" ? h : 0 },
    C = { u: L, v: D, z: roof.shape === "mono" ? h : 0 },
    E = { u: 0, v: D, z: 0 };
  let polygons: RoofPoint[][];
  if (roof.shape === "mono")
    polygons = [[A, { ...B, z: 0 }, C, { ...E, z: h }]];
  else if (roof.shape === "gable") {
    const r = { u: 0, v: D / 2, z: h },
      s = { u: L, v: D / 2, z: h };
    polygons = [
      [A, B, s, r],
      [r, s, C, E],
    ];
  } else {
    const inset = Math.min(L, D) / 2,
      r = { u: inset, v: D / 2, z: h },
      s = { u: L - inset, v: D / 2, z: h };
    polygons = [
      [A, B, s, r],
      [B, C, s],
      [C, E, r, s],
      [E, A, r],
    ];
  }
  const facets = polygons.map((points, i) => {
    let area = 0,
      plan = 0;
    for (let k = 1; k < points.length - 1; k++) {
      const a = points[0],
        b = points[k],
        c = points[k + 1],
        x = b.u - a.u,
        y = b.v - a.v,
        z = b.z - a.z,
        X = c.u - a.u,
        Y = c.v - a.v,
        Z = c.z - a.z;
      area += Math.hypot(y * Z - z * Y, z * X - x * Z, x * Y - y * X) / 2;
      plan += Math.abs(x * Y - y * X) / 2;
    }
    return { id: i + 1, points, area, plan, ratio: area / plan };
  });
  const n = Math.ceil(L / roof.spacing);
  if (n + 1 > 120)
    throw Error("La toiture dépasse 120 fermes : augmentez leur entraxe.");
  const frames = Array.from({ length: n + 1 }, (_, i) => (L * i) / n);
  const toPlan = (p: { u: number; v: number }) =>
    roof.axis === "x" ? { x: p.u, y: p.v } : { x: p.v, y: p.u };
  const height = (u: number, v: number) =>
    roof.shape === "mono"
      ? (h * v) / D
      : roof.shape === "gable"
        ? h * (1 - Math.abs((2 * v) / D - 1))
        : h *
          Math.max(
            0,
            Math.min(
              1,
              u / (Math.min(L, D) / 2),
              (L - u) / (Math.min(L, D) / 2),
              v / (D / 2),
              (D - v) / (D / 2),
            ),
          );
  return {
    L,
    D,
    facets,
    frames,
    toPlan,
    height,
    area: facets.reduce((s, f) => s + f.area, 0),
    planArea: L * D,
    actualSpacing: L / n,
  };
}
function clip(points: RoofPoint[], u: number, greater: boolean) {
  const out: RoofPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length],
      insideA = greater ? a.u >= u - 1e-10 : a.u <= u + 1e-10,
      insideB = greater ? b.u >= u - 1e-10 : b.u <= u + 1e-10;
    if (insideA) out.push(a);
    if (insideA !== insideB) {
      const t = (u - a.u) / (b.u - a.u);
      out.push({ u, v: a.v + t * (b.v - a.v), z: a.z + t * (b.z - a.z) });
    }
  }
  return out;
}
/** Exact area and bilinear moments of a convex polygon, via triangle barycentric integration. */
function moments(points: RoofPoint[]) {
  let A = 0,
    U = 0,
    V = 0,
    UV = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const tri = [points[0], points[i], points[i + 1]],
      a =
        Math.abs(
          (tri[1].u - tri[0].u) * (tri[2].v - tri[0].v) -
            (tri[1].v - tri[0].v) * (tri[2].u - tri[0].u),
        ) / 2;
    const su = tri.reduce((s, p) => s + p.u, 0),
      sv = tri.reduce((s, p) => s + p.v, 0);
    A += a;
    U += (a * su) / 3;
    V += (a * sv) / 3;
    UV += (a * (su * sv + tri.reduce((s, p) => s + p.u * p.v, 0))) / 12;
  }
  return { A, U, V, UV };
}
/** Gravity transfer: covering → simply supported purlins → tied two-support trusses → eaves. */
export function roofAnalysis(
  floor: Floor,
  roof: Roof,
  requirePermanent = false,
) {
  const geo = roofGeometry(floor, roof),
    facets = geo.facets.map((f) => {
      const loads = roof.loads.filter((l) => l.face === 0 || l.face === f.id);
      const pressure = (action: string) =>
        loads
          .filter((l) => l.action === action)
          .reduce(
            (s, l) => s + l.value * (l.basis === "slope" ? f.ratio : 1),
            0,
          );
      return { ...f, g: pressure("G"), q: pressure(roof.variable) };
    });
  if (roof.loads.some((l) => l.face > facets.length))
    throw Error(
      "Réaffectez les charges des pans supprimés dans les paramètres de toiture.",
    );
  const G = facets.reduce((s, f) => s + f.g * f.plan, 0),
    Q = facets.reduce((s, f) => s + f.q * f.plan, 0);
  if (requirePermanent && G <= 0)
    throw Error(
      "Renseignez les poids propres de la couverture et de la charpente dans Toiture.",
    );
  const supports = geo.frames.flatMap((u, i) =>
    [0, geo.D].map((v) => ({
      frame: i,
      u,
      v,
      ...geo.toPlan({ u, v }),
      g: 0,
      q: 0,
    })),
  );
  for (const facet of facets)
    for (let i = 0; i < geo.frames.length - 1; i++) {
      const u0 = geo.frames[i],
        u1 = geo.frames[i + 1],
        d = u1 - u0,
        m = moments(clip(clip(facet.points, u0, true), u1, false));
      // Product of purlin reaction shape N(u) and truss reaction shape N(v).
      const left = [u1 / d, -1 / d],
        right = [-u0 / d, 1 / d],
        near = [1, -1 / geo.D],
        far = [0, 1 / geo.D];
      for (const [index, nu] of [
        [i, left],
        [i + 1, right],
      ] as [number, number[]][])
        for (const [side, nv] of [
          [0, near],
          [1, far],
        ] as [number, number[]][]) {
          const share = Math.max(
            0,
            nu[0] * nv[0] * m.A +
              nu[1] * nv[0] * m.U +
              nu[0] * nv[1] * m.V +
              nu[1] * nv[1] * m.UV,
          );
          supports[index * 2 + side].g += facet.g * share;
          supports[index * 2 + side].q += facet.q * share;
        }
    }
  const sumG = supports.reduce((s, p) => s + p.g, 0),
    sumQ = supports.reduce((s, p) => s + p.q, 0);
  if (
    Math.abs(sumG - G) > 1e-7 * Math.max(1, G) ||
    Math.abs(sumQ - Q) > 1e-7 * Math.max(1, Q)
  )
    throw Error("Équilibre des charges de toiture non satisfait.");
  const { toPlan: _toPlan, height: _height, ...numericGeometry } = geo;
  return {
    ...numericGeometry,
    facets,
    supports,
    G,
    Q,
    balanceG: sumG - G,
    balanceQ: sumQ - Q,
  };
}
