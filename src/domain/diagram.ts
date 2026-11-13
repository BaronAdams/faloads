import type { FrameResult } from "./analysis";
export type DiagramField = "M" | "V" | "N" | "v" | "theta";
export const isForceDiagram = (field: DiagramField) =>
  field === "M" || field === "V" || field === "N";
export const diagramUnit = (field: DiagramField) =>
  field === "M"
    ? "kN·m"
    : field === "v"
      ? "mm"
      : field === "theta"
        ? "mrad"
        : "kN";
export const diagramFactor = (field: DiagramField) =>
  field === "v" || field === "theta" ? 1000 : 1;
/** Both ends and each global extremum, with coincident stations counted once. */
export function characteristicIndices(values: readonly number[]) {
  if (!values.length) return [];
  let min = 0,
    max = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] < values[min]) min = i;
    if (values[i] > values[max]) max = i;
  }
  return [...new Set([0, min, max, values.length - 1])].sort((a, b) => a - b);
}
/** Frame translation in the global plane; the reported magnitude is unamplified. */
export function frameDisplacement(
  member: FrameResult["mem"][number],
  station: { x: number; v: number },
) {
  const t = station.x / member.g.L;
  const axial = member.ul[0] * (1 - t) + member.ul[3] * t;
  return {
    dx: axial * member.g.c - station.v * member.g.s,
    dy: axial * member.g.s + station.v * member.g.c,
    magnitude: Math.hypot(axial, station.v),
  };
}
export type LabelCandidate = {
  x: number;
  y: number;
  nx: number;
  ny: number;
  text: string;
};
/** Keep adjacent member-end values readable without dropping structural values. */
export function placeDiagramLabels(
  candidates: LabelCandidate[],
  units: number,
  height: number,
) {
  const boxes: { x: number; y: number; w: number; h: number }[] = [];
  return candidates.map((candidate) => {
    const w = Math.min(220 * units, candidate.text.length * 6.8 * units),
      h = 15 * units;
    let chosen = { x: candidate.x, y: candidate.y };
    let best = Infinity;
    for (let attempt = 0; attempt < 12; attempt++) {
      const offset = (17 + Math.floor(attempt / 3) * 17) * units;
      const slide = [0, 18, -18][attempt % 3] * units;
      const x = Math.min(
        1000 - w / 2 - 6 * units,
        Math.max(
          w / 2 + 6 * units,
          candidate.x + candidate.nx * offset - candidate.ny * slide,
        ),
      );
      const y = Math.min(
        height - h / 2 - 8 * units,
        Math.max(
          h / 2 + 8 * units,
          candidate.y + candidate.ny * offset + candidate.nx * slide,
        ),
      );
      const box = { x: x - w / 2, y: y - h / 2, w, h };
      const overlap = boxes.reduce(
        (sum, b) =>
          sum +
          Math.max(0, Math.min(box.x + w, b.x + b.w) - Math.max(box.x, b.x)) *
            Math.max(0, Math.min(box.y + h, b.y + b.h) - Math.max(box.y, b.y)),
        0,
      );
      if (overlap < best) {
        best = overlap;
        chosen = { x, y };
      }
      if (overlap === 0) break;
    }
    boxes.push({ x: chosen.x - w / 2, y: chosen.y - h / 2, w, h });
    return chosen;
  });
}
