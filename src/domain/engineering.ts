import { uid } from "@/lib/utils";
/** Port of the shipped Dart domain. kN, m and cm are explicit at boundaries. */
export type Code = "ec2" | "bael91";
export const concreteClasses = ["C20/25", "C25/30", "C30/37", "C35/45"];
export const slabs = [
  { id: "cc12", label: "CC 12+4", g: 2.8 },
  { id: "cc16", label: "CC 16+4", g: 3.54 },
  { id: "cc20", label: "CC 20+5", g: 4.4 },
  { id: "dp", label: "Dalle pleine", g: 0 },
];
export const usages = [
  { id: "A", label: "Habitation", q: 1.5 },
  { id: "B", label: "Bureaux", q: 2.5 },
  { id: "C", label: "Lieux publics", q: 4 },
  { id: "D", label: "Commerce", q: 5 },
  { id: "E", label: "Stockage", q: 6 },
  { id: "H", label: "Toiture inaccessible", q: 1 },
];
export const up = (value: number, step: number) =>
  Math.ceil(value / step) * step;
export const fckOf = (beton: string) =>
  ({ "C20/25": 20, "C25/30": 25, "C30/37": 30, "C35/45": 35 })[beton] ?? 25;
export const elu = (g: number, q: number, w = 0, dominant = false) =>
  1.35 * g + 1.5 * q + (dominant ? 1.5 * w : 0);
export const els = (g: number, q: number, quasi = false) =>
  g + (quasi ? 0.3 : 1) * q;
export const windPressure = (z: number) => Math.max(0.45, 0.55 + 0.032 * z);
export const coeff = (beton: string, code: Code) =>
  (fckOf(beton) / 1.5) * 0.1 * (code === "ec2" ? 0.8 : 0.85 * 0.85);
export function columnPredim(n: number, beton = "C25/30", code: Code = "ec2") {
  const area = n / coeff(beton, code);
  return { side: Math.max(20, up(Math.sqrt(area), 5)), area };
}
export function wallPredim(
  n: number,
  length = 1,
  beton = "C25/30",
  code: Code = "ec2",
) {
  const area = n / coeff(beton, code);
  return { e: Math.max(15, up(area / (length * 100), 5)), area };
}
export type SupportKind = "isostatique" | "continue_" | "console";
export function beamPredim(
  length: number,
  q: number,
  support: SupportKind = "isostatique",
) {
  const k = { isostatique: 12, continue_: 16, console: 6 }[support],
    m = { isostatique: 1 / 8, continue_: 1 / 12, console: 1 / 2 }[support];
  const h = Math.max(20, up((length * 100) / k, 5));
  return { h, b: Math.max(15, up(h / 2, 5)), moment: m * q * length ** 2 };
}
export function stairsPredim(height: number, length: number) {
  const steps = Math.max(2, Math.round(height / 0.17)),
    riser = (height * 100) / steps,
    tread = (length * 100) / (steps - 1);
  return {
    steps,
    riser,
    tread,
    blondel: 2 * riser + tread,
    e: Math.max(12, up((Math.hypot(height, length) * 100) / 25, 2)),
  };
}
export function balconyPredim(length: number, g: number, q: number) {
  return {
    e: Math.max(12, up((length * 100) / 10, 2)),
    moment: (elu(g, q) * length ** 2) / 2,
  };
}
export function slabPredim(length: number, full: boolean) {
  const e = full
    ? Math.max(12, up((length * 100) / 25, 2))
    : length < 4.5
      ? 20
      : length < 6
        ? 24
        : 29;
  return {
    e,
    label: full
      ? `Dalle pleine ${e} cm`
      : e === 20
        ? "Corps creux 16+4"
        : e === 24
          ? "Corps creux 20+4"
          : "Corps creux 25+4",
  };
}
export function footingPredim(
  kind: "isolee" | "filante",
  n: number,
  bearing: number,
  support: number,
) {
  const area = n / bearing;
  const width =
    kind === "isolee"
      ? Math.max(60, up(Math.sqrt(area) * 100, 5))
      : Math.max(40, up(area * 100, 5));
  return { width, depth: Math.max(15, up((width - support) / 4, 5)), area };
}
export function retainingPredim(height: number, gamma: number, phi: number) {
  const ka = Math.tan(Math.PI / 4 - (phi * Math.PI) / 360) ** 2;
  return {
    ka,
    thrust: 0.5 * ka * gamma * height ** 2,
    width: up(0.6 * height * 100, 5),
    stem: Math.max(20, up((height * 100) / 12, 5)),
  };
}
export interface Coating {
  id: string;
  name: string;
  load: number;
}
export interface Level {
  id: string;
  label: string;
  height: number;
  slab: "cc12" | "cc16" | "cc20" | "dp";
  thickness: number;
  usage: "A" | "B" | "C" | "D" | "E" | "H";
  q: number;
  coatings: Coating[];
  b: number;
  h: number;
  e: number;
}
export function newLevel(label = "RDC"): Level {
  return {
    id: uid(),
    label,
    height: 3,
    slab: "cc16",
    thickness: 0.16,
    usage: "A",
    q: 1.5,
    coatings: [],
    b: 30,
    h: 30,
    e: 20,
  };
}
export const levelG = (l: Level) =>
  l.slab === "dp"
    ? l.thickness * 25
    : (slabs.find((s) => s.id === l.slab)?.g ?? 0);
export const coatingG = (l: Level) =>
  l.coatings.reduce((a, c) => a + c.load, 0);
export function tributaryWidth(spans: number[], i: number) {
  return (i > 0 ? spans[i - 1] / 2 : 0) + (i < spans.length ? spans[i] / 2 : 0);
}
export function columnPosition(spans: number[]) {
  const n = spans.filter((x) => x <= 0).length;
  return n === 0 ? "Intérieur" : n === 1 ? "De rive" : "D’angle";
}
export function descent(
  levels: Level[],
  area: number,
  wallLength = 0,
  quasi = false,
) {
  let g = 0,
    q = 0,
    w = 0;
  const elevations = new Array(levels.length).fill(0);
  let z = 0;
  for (let i = levels.length - 1; i >= 0; i--) {
    elevations[i] = z + levels[i].height / 2;
    z += levels[i].height;
  }
  return levels.map((level, i) => {
    const gs = levelG(level) * area,
      gr = coatingG(level) * area,
      ql = level.q * area;
    g += gs + gr;
    q += ql;
    w += wallLength
      ? windPressure(elevations[i]) * wallLength * level.height
      : 0;
    return {
      id: level.id,
      label: level.label,
      height: level.height,
      gs,
      gr,
      ql,
      g,
      q,
      nElu: elu(g, q),
      nEls: els(g, q, quasi),
      windElu: 1.5 * w,
      windDominant: 1.5 * w > 0.15 * elu(g, q),
    };
  });
}
export function panelTributary(
  width: number,
  height: number,
  pressure: number,
) {
  const s = Math.min(width, height),
    l = Math.max(width, height),
    shortArea = (s * s) / 4,
    longArea = (s / 2) * (l - s / 2);
  return {
    shortArea,
    longArea,
    shortLoad: (shortArea * pressure) / s,
    longLoad: (longArea * pressure) / l,
  };
}
export function quickBeam(
  length: number,
  g: number,
  q: number,
  b: number,
  h: number,
  beton = "C25/30",
) {
  const w = elu(g, q),
    e = 22000 * ((fckOf(beton) + 8) / 10) ** 0.3,
    i = (b * 10 * (h * 10) ** 3) / 12;
  return {
    wElu: w,
    wEls: g + q,
    reaction: (w * length) / 2,
    moment: (w * length ** 2) / 8,
    shear: (w * length) / 2,
    deflection: (5 * (g + q) * (length * 1000) ** 4) / (384 * e * i),
    limit: (length * 1000) / 250,
  };
}
export function quickFrame(
  length: number,
  height: number,
  g: number,
  q: number,
  bw: number,
  bh: number,
  cw: number,
  ch: number,
) {
  const w = elu(g, q),
    k = (bw * bh ** 3) / length / ((cw * ch ** 3) / height),
    joint = (w * length ** 2) / (12 + 6 * k);
  return {
    w,
    k,
    joint,
    base: joint / 2,
    midspan: (w * length ** 2) / 8 - joint,
    shear: (1.5 * joint) / height,
  };
}
