import type { RCColumnModel } from "./model";
import type { RCResult } from "@/lib/rc-engine";
export type BeamCurve = {
  x_m: number;
  Mmax_kNm: number;
  Mmin_kNm: number;
  Vmax_kN: number;
  Vmin_kN: number;
};
/** Equilibrium curves before/after redistribution; no smoothing or invented ordinates. */
export function beamEnvelope(
  result: RCResult,
  source: "elastic" | "redistributed" | "design" = "design",
): BeamCurve[][] {
  if (source === "design") return result.traces;
  const cases =
    source === "elastic" ? result.elastic_cases : result.redistributed_cases;
  if (!cases?.length) return [];
  return result.effective_lengths_m.map((L: number, i: number) =>
    Array.from({ length: 161 }, (_, j) => {
      const x = (L * j) / 160;
      const M = cases.map(
        (c: any) =>
          (c.q[i] * x * (L - x)) / 2 +
          c.moments[i] +
          ((c.moments[i + 1] - c.moments[i]) * x) / L,
      );
      const V = cases.map(
        (c: any) =>
          c.q[i] * (L / 2 - x) + (c.moments[i + 1] - c.moments[i]) / L,
      );
      return {
        x_m: x,
        Mmax_kNm: Math.max(0, ...M),
        Mmin_kNm: Math.min(0, ...M),
        Vmax_kN: Math.max(...V),
        Vmin_kN: Math.min(...V),
      };
    }),
  );
}
/** Explicit placement: node/current zones plus the skill's exact lap stirrups. */
export function columnStirrups(m: RCColumnModel, r: RCResult): number[] {
  const t = r.reinforcement.transverse,
    lap = r.reinforcement.lap;
  const H = m.geometry.l_m,
    zone = Math.min(
      H / 2,
      (t.zone_node_height_cm ??
        (m.section.type === "circ"
          ? m.section.a_cm
          : Math.max(m.section.b_cm, m.section.h_cm))) / 100,
    );
  const boundaries = [0, zone, H - zone, H];
  const positions = new Set<number>();
  for (let k = 0; k < 3; k++) {
    const a = boundaries[k],
      b = boundaries[k + 1],
      step = (k === 1 ? t.s_current_cm : t.s_node_cm) / 100;
    const count = Math.ceil((b - a) / Math.max(0.005, step));
    for (let j = 0; j <= count; j++)
      positions.add(
        Number((a + ((b - a) * j) / Math.max(1, count)).toFixed(8)),
      );
  }
  for (const mm of lap?.positions_from_lap_start_mm ?? [])
    if (mm / 1000 <= H) positions.add(mm / 1000);
  return [...positions].sort((a, b) => a - b);
}
