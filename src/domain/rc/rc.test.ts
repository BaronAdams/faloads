import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import {
  rcColumnDefaults,
  rcBeamDefaults,
  rcModelSchema,
  type RCModel,
} from "./model";
import { buildRCReport } from "./report";
import {
  reportSteps,
  defaultReportSelection,
  buildCalculationReport,
} from "../report";
import { projectDefaults } from "../project-defaults";
import { rcDrawing } from "./drawing";
import { latexSvg, reportDocument } from "@/lib/report-pdf";
import { validateProject } from "@/lib/project-io";
import { predimDefaults } from "../predim";
import type { Project } from "@/lib/storage";
import type { RCResult } from "@/lib/rc-engine";
const column = rcColumnDefaults(),
  beam = rcBeamDefaults();
beam.analysis.construction = "posed";
const compute = (m: RCModel): RCResult =>
  JSON.parse(
    execFileSync("python3", ["public/ec2-engine/bridge.py"], {
      input: JSON.stringify(m),
      maxBuffer: 10 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf8",
    }),
  );
const p = (m: RCModel): Project => ({
  id: m.kind,
  type: m.kind === "rc-column" ? "column" : "beam-size",
  name: "Étude EC2",
  data: m,
  updatedAt: "2026-11-26T10:00:00Z",
});
const cr = compute(column),
  br = compute(beam);
describe("EC2 modules use a real, scoped numerical result", () => {
  it("creates full RC defaults and preserves import of legacy estimates", () => {
    const prefs = {
      code: "ec2" as const,
      concrete: "C30/37" as const,
      quasi: false,
    };
    expect(projectDefaults("column", prefs)).toMatchObject({
      kind: "rc-column",
      materials: { fck: 30 },
    });
    expect(projectDefaults("beam-size", prefs)).toMatchObject({
      kind: "rc-beam",
      materials: { fck: 30 },
    });
    expect(validateProject(p(column)).data).toEqual(column);
    expect(
      validateProject({
        ...p(column),
        data: predimDefaults("column", "ec2", "C25/30"),
      }),
    ).toBeTruthy();
    expect(() => validateProject({ ...p(column), data: beam })).toThrow();
  });
  it("rejects inconsistent sections, bar ranges and span topology", () => {
    const wrong = structuredClone(column);
    wrong.detailing.phi_l_min_mm = 32;
    wrong.detailing.phi_l_max_mm = 12;
    expect(rcModelSchema.safeParse(wrong).success).toBe(false);
    const bad = structuredClone(beam);
    bad.supports.pop();
    expect(rcModelSchema.safeParse(bad).success).toBe(false);
    bad.supports.push(beam.supports[0]);
    bad.section.type = "t";
    bad.section.beff_cm = 10;
    expect(rcModelSchema.safeParse(bad).success).toBe(false);
  });
  it("carries the two-plan column cascade, actual bars and one self weight", () => {
    expect(cr.final_stage).toBe(3);
    expect(cr.all_ok).toBe(true);
    expect(cr.scope_complete).toBe(true);
    expect(cr.combinations[0].N_base_kN).toBeCloseTo(
      1.35 * (400 + 25 * 0.4 * 0.4 * 3) + 1.5 * 250,
      8,
    );
    expect(cr.reinforcement.layout.As_prov).toBeGreaterThanOrEqual(
      cr.reinforcement.As_req_tot_cm2,
    );
    expect(cr.section.d_prime_cm * 10).toBeGreaterThanOrEqual(
      cr.reinforcement.layout.e_mm - 1e-8,
    );
    const biaxial = structuredClone(column);
    biaxial.loads.actions[0].moments.y.top = 20;
    biaxial.loads.actions[0].moments.z.top = 30;
    expect(compute(biaxial).scope_complete).toBe(false);
  });
  it("verifies imposed bars and never validates undersized reinforcement", () => {
    const m = structuredClone(column);
    m.loads.mode = "direct";
    m.loads.self_weight = false;
    m.loads.direct.NEd_kN = 6000;
    m.detailing.mode = "verify";
    m.detailing.bars.phi = 8;
    m.detailing.bars.phi_i = 8;
    const r = compute(m);
    expect(r.all_ok).toBe(false);
    expect(r.reinforcement.layout.phi).toBe(8);
  });
  it("normalizes a centred circular column, respects its diameters and effective length", () => {
    const m = structuredClone(column);
    m.section.type = "circ";
    m.geometry.effective = "lengths";
    m.geometry.l0y_m = 1;
    m.geometry.l0z_m = 2;
    const r = compute(m);
    expect(r.circular).toBe(true);
    expect(r.reinforcement.layout.phi).toBeGreaterThanOrEqual(
      m.detailing.phi_l_min_mm,
    );
    expect(r.final_slenderness.lam).toBe(20);
    m.loads.actions[0].moments.y.top = 1;
    expect(() => compute(m)).toThrow(/centrés/);
  });
  it("calculates beam flexure, stirrups, anchors and validated capacity envelopes", () => {
    expect(br.all_ok).toBe(true);
    expect(br.spans[0].MEd_kNm).toBeCloseTo(66.069, 5);
    expect(br.shear[0].count).toBeGreaterThan(0);
    expect(br.bars[0].bottom.margin_kNm).toBeGreaterThanOrEqual(-1e-5);
    const m = structuredClone(beam);
    m.spans[0].q_kN_m *= 2;
    expect(compute(m).spans[0].As1_req_mm2).toBeGreaterThan(
      br.spans[0].As1_req_mm2,
    );
  });
  it.each([
    [column, cr],
    [beam, br],
  ] as const)(
    "builds all seven selectable chapters and valid local LaTeX",
    (m, r) => {
      const project = p(m),
        steps = reportSteps(project.type, m),
        selection = Object.fromEntries(
          steps.map((s) => [s.id, "full" as const]),
        );
      expect(steps).toHaveLength(7);
      const report = buildRCReport(
        project,
        m,
        r,
        selection,
        "Bureau d’études",
        "2026-11-26T10:00:00Z",
      );
      expect(report.sections).toHaveLength(8);
      expect(report.sections.at(-1)?.id).toBe("scope");
      const formulas = report.sections
        .flatMap((s) => s.blocks)
        .filter((b) => b.kind === "formula");
      expect(formulas.length).toBeGreaterThan(5);
      for (const formula of formulas)
        if (formula.kind === "formula") {
          expect(formula.latex).not.toContain("\\\\");
          expect(latexSvg(formula.latex).svg).not.toContain("merror");
        }
      expect(reportDocument(report).info?.creator).toBe("CaliSigma Structural");
      expect(rcDrawing(m, r)).not.toMatch(/undefined|NaN|Infinity/);
      const summary = buildRCReport(
        project,
        m,
        r,
        { longitudinal: "summary" },
        "",
        "2026-11-26T10:00:00Z",
      );
      expect(summary.sections.map((s) => s.id)).toEqual([
        "longitudinal",
        "scope",
      ]);
      expect(() =>
        buildCalculationReport(
          project,
          defaultReportSelection(project.type, m),
        ),
      ).toThrow(/moteur local/);
    },
  );
});
