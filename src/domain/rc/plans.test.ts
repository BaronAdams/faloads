import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import DxfParser from "dxf-parser";
import { rcBeamDefaults, rcColumnDefaults, type RCModel } from "./model";
import { beamEnvelope, columnStirrups } from "./visual-data";
import { rcPlans, planTikz } from "./plans";
import { planDxf } from "./plan-dxf";
import type { RCResult } from "@/lib/rc-engine";
const compute = (m: RCModel): RCResult =>
  JSON.parse(
    execFileSync("python3", ["public/ec2-engine/bridge.py"], {
      input: JSON.stringify(m),
      encoding: "utf8",
      maxBuffer: 10000000,
    }),
  );
const meta = {
  project: "Poutre du hall",
  author: "Bureau d’études",
  date: "28/11/2026",
};
const beam = rcBeamDefaults();
beam.analysis.construction = "monolithic";
beam.analysis.redistribution = true;
beam.spans.push({ ...beam.spans[0], id: "span-2", name: "Travée 2", ln_m: 4 });
beam.supports.push({ ...beam.supports[0], id: "support-3" });
const r = compute(beam),
  column = rcColumnDefaults(),
  cr = compute(column);
describe("Reinforcement drawings retain calculated geometry", () => {
  it("separates elastic and accepted redistributed envelopes while retaining nodal continuity", () => {
    const elastic = beamEnvelope(r, "elastic"),
      redistributed = beamEnvelope(r, "redistributed");
    expect(r.redistribution.length).toBeGreaterThan(0);
    expect(elastic[0].at(-1)!.Mmin_kNm).toBeCloseTo(elastic[1][0].Mmin_kNm, 8);
    expect(redistributed[0].at(-1)!.Mmin_kNm).toBeCloseTo(
      redistributed[1][0].Mmin_kNm,
      8,
    );
    expect(Math.abs(redistributed[0].at(-1)!.Mmin_kNm)).toBeLessThan(
      Math.abs(elastic[0].at(-1)!.Mmin_kNm),
    );
    for (let i = 0; i < 2; i++)
      for (const p of redistributed[i])
        expect(p.Mmax_kNm).toBeCloseTo(
          r.traces[i].find((v: any) => Math.abs(v.x_m - p.x_m) < 1e-8)
            ?.Mmax_kNm ?? p.Mmax_kNm,
          6,
        );
  });
  it("plots the anchorage resistance ramps and the shifted design envelope", () => {
    for (const b of r.bars)
      for (const k of ["top", "bottom"]) {
        expect(b[k].epure.length).toBeGreaterThan(160);
        for (const p of b[k].epure)
          expect(
            [p.x_m, p.capacity_kNm, p.demand_kNm].every(Number.isFinite),
          ).toBe(true);
        // A sampled minimum cannot be worse than the exact analytic minimum.
        const eligible = b[k].epure.filter(
          (p: any) =>
            p.x_m >= 0.15 &&
            p.x_m <= r.effective_lengths_m[r.bars.indexOf(b)] - 0.15,
        );
        expect(
          Math.min(...eligible.map((p: any) => p.capacity_kNm - p.demand_kNm)),
        ).toBeGreaterThanOrEqual(b[k].margin_kNm - 1e-4);
      }
  });
  it("keeps the skill lap stirrups and stays within the current and node spacing bounds", () => {
    const model = rcColumnDefaults();
    model.detailing.mode = "verify";
    model.detailing.bars.phi = 20;
    model.detailing.bars.phi_i = 20;
    const result = compute(model),
      pos = columnStirrups(model, result);
    expect(pos[0]).toBe(0);
    expect(pos.at(-1)).toBe(model.geometry.l_m);
    for (const mm of result.reinforcement.lap.positions_from_lap_start_mm)
      expect(pos).toContain(mm / 1000);
    for (let i = 1; i < pos.length; i++)
      expect(pos[i] - pos[i - 1]).toBeLessThanOrEqual(
        result.reinforcement.transverse.s_current_cm / 100 + 1e-7,
      );
  });
  it("exports editable CAD entities on millimetre A4 landscape sheets with title blocks", () => {
    for (const [m, result] of [
      [beam, r],
      [column, cr],
    ] as const) {
      const plans = rcPlans(m, result, meta);
      expect(plans.length).toBe(m.kind === "rc-column" ? 1 : 4);
      for (const plan of plans) {
        const dxf = planDxf(plan),
          parsed = new DxfParser().parseSync(dxf)!;
        expect(parsed.header.$INSUNITS).toBe(4);
        expect(parsed.entities.some((e) => e.type === "TEXT")).toBe(true);
        expect(dxf).toContain("A4 Landscape");
        expect(dxf).toContain("ISO_A4_(297.00_x_210.00_MM)");
        expect(dxf).toContain("CaliSigma Structural");
        expect(planTikz(plan)).toContain("\\begin{tikzpicture}");
        expect(planTikz(plan, true)).toContain("\\documentclass{standalone}");
        expect(planTikz(plan)).not.toMatch(/NaN|undefined|Infinity/);
        expect(
          plan.items.every((item) =>
            item.kind === "line"
              ? item.points.every(
                  ([x, y]) => Number.isFinite(x) && Number.isFinite(y),
                )
              : Number.isFinite(item.x) && Number.isFinite(item.y),
          ),
        ).toBe(true);
      }
    }
  });
});
