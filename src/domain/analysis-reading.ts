import type {
  AnalysisModel,
  BeamModel,
  BeamResult,
  FrameModel,
  FrameResult,
} from "./analysis";

export type Point = { x: number; y: number };
export type ReadingPoint = Point & { station: number; value: number };
export type ReadingMember = {
  id: string;
  label: string;
  a: Point;
  b: Point;
  length: number;
  points?: ReadingPoint[];
};
/** Right-hand value at a discontinuity, never interpolate across coincident samples. */
export function interpolateReading(
  points: readonly ReadingPoint[],
  station: number,
): ReadingPoint | undefined {
  if (!points.length) return undefined;
  let i = 0;
  while (i + 1 < points.length && points[i + 1].station <= station) i++;
  const a = points[i],
    b = points[i + 1];
  if (!b || station <= a.station) return { ...a };
  const t = (station - a.station) / (b.station - a.station);
  return {
    station,
    x: a.x + t * (b.x - a.x),
    y: a.y + t * (b.y - a.y),
    value: a.value + t * (b.value - a.value),
  };
}
/** Project onto the original member axis, with no reading beyond its ends. */
export function projectReading(
  cursor: Point,
  members: readonly ReadingMember[],
) {
  let best:
    | { member: ReadingMember; point: Point; station: number; distance: number }
    | undefined;
  for (const member of members) {
    const dx = member.b.x - member.a.x,
      dy = member.b.y - member.a.y;
    const length2 = dx * dx + dy * dy;
    if (length2 < 1e-12) continue;
    const t =
      ((cursor.x - member.a.x) * dx + (cursor.y - member.a.y) * dy) / length2;
    if (t < -1e-9 || t > 1 + 1e-9) continue;
    const bounded = Math.max(0, Math.min(1, t));
    const point = {
      x: member.a.x + bounded * dx,
      y: member.a.y + bounded * dy,
    };
    const distance = Math.hypot(cursor.x - point.x, cursor.y - point.y);
    if (!best || distance < best.distance)
      best = { member, point, station: bounded * member.length, distance };
  }
  return best;
}
export const defaultDeflectionLimit = {
  mode: "ratio" as const,
  ratio: 250,
  mm: 10,
};
export const lengthFactor = (unit: AnalysisModel["probeUnit"]) =>
  unit === "mm" ? 1000 : unit === "cm" ? 100 : 1;
type DeflectionCheck = {
  label: string;
  length: number;
  actualMm: number;
  allowableMm: number;
  utilization: number;
};
function check(
  model: AnalysisModel,
  label: string,
  length: number,
  values: number[],
): DeflectionCheck {
  const limit = model.deflectionLimit ?? defaultDeflectionLimit;
  const allowableMm =
    limit.mode === "absolute" ? limit.mm : (length * 1000) / limit.ratio;
  const actualMm = Math.max(0, ...values.map(Math.abs)) * 1000;
  return {
    label,
    length,
    actualMm,
    allowableMm,
    utilization: actualMm / allowableMm,
  };
}
/** Absolute transverse displacement from the initial axis, including support movements.
 * This user criterion is not a reinforced-concrete code/long-term deflection check. */
export function beamDeflectionChecks(model: BeamModel, result: BeamResult) {
  const ends = [
    ...new Set([
      0,
      ...model.supports.filter((s) => s.uy !== false).map((s) => s.x),
      model.L,
    ]),
  ].sort((a, b) => a - b);
  const samples = result.x.map((x, i) => ({
    station: x,
    x,
    y: 0,
    value: result.v[i],
  }));
  return ends
    .slice(0, -1)
    .map((start, i) => {
      const end = ends[i + 1];
      const values = samples
        .filter((p) => p.station >= start && p.station <= end)
        .map((p) => p.value);
      values.push(
        interpolateReading(samples, start)!.value,
        interpolateReading(samples, end)!.value,
      );
      return check(
        model,
        `${(start === 0 && !model.supports.some((s) => s.x === 0 && s.uy !== false)) || (end === model.L && !model.supports.some((s) => s.x === model.L && s.uy !== false)) ? "Console" : "Travée"} ${i + 1}`,
        end - start,
        values,
      );
    })
    .filter((c) => c.length > 1e-9);
}
export function frameDeflectionChecks(model: FrameModel, result: FrameResult) {
  return result.mem.map((member, i) =>
    check(
      model,
      `Barre B${i + 1}`,
      member.g.L,
      member.pts.map((p) => p.v),
    ),
  );
}
