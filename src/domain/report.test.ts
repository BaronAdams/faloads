import { predimDefaults } from "./predim";
import { describe, it, expect } from "vitest";
import { projectTypes } from "./projects";
import { projectDefaults } from "./project-defaults";
import {
  buildCalculationReport,
  reportSteps,
  defaultReportSelection,
} from "./report";
import { projectDrawing, projectPreview } from "./project-preview";
import { latexSvg, reportDocument } from "@/lib/report-pdf";
import type { Project } from "@/lib/storage";

const preferences = {
  code: "ec2" as const,
  concrete: "C25/30" as const,
  quasi: false,
};
const project = (type: Project["type"]): Project => ({
  id: type,
  type,
  name: `Étude ${type}`,
  data:
    type === "column" || type === "beam-size"
      ? predimDefaults(type, preferences.code, preferences.concrete)
      : projectDefaults(type, preferences),
  updatedAt: "2026-11-26T10:00:00.000Z",
});
describe("Type-specific calculation notes", () => {
  it.each(projectTypes)(
    "builds every step and renders every full LaTeX expression for $id",
    ({ id }) => {
      const p = project(id),
        selection = Object.fromEntries(
          reportSteps(id).map((s) => [s.id, "full" as const]),
        );
      const report = buildCalculationReport(
        p,
        selection,
        "Agence témoin",
        "2026-11-26T10:00:00.000Z",
      );
      expect(report.sections.map((s) => s.id)).toEqual(
        reportSteps(id).map((s) => s.id),
      );
      expect(report.sections.every((s) => s.blocks.length > 0)).toBe(true);
      const formulas = report.sections
        .flatMap((s) => s.blocks)
        .filter((b) => b.kind === "formula");
      expect(formulas.length).toBeGreaterThan(0);
      for (const b of formulas) {
        if (b.kind !== "formula") throw Error();
        const svg = latexSvg(b.latex);
        expect(svg.svg).toContain("<svg");
        expect(svg.svg).not.toContain("merror");
        expect(svg.width).toBeGreaterThan(0);
      }
      expect(reportDocument(report).info?.creator).toBe("CaliSigma Structural");
    },
  );
  it("omits unchecked steps and full derivations from summary-only sections", () => {
    const report = buildCalculationReport(project("beam"), {
      reactions: "summary",
      checks: "full",
      model: false,
    });
    expect(report.sections.map((s) => s.id)).toEqual(["reactions", "checks"]);
    expect(report.sections[0].blocks.some((b) => b.kind === "formula")).toBe(
      false,
    );
    expect(report.sections[1].blocks.some((b) => b.kind === "formula")).toBe(
      true,
    );
    expect(() => buildCalculationReport(project("beam"), {})).toThrow(
      /au moins une étape/,
    );
  });
  it("recomputes the current model instead of reusing stale reactions", () => {
    const p = project("beam"),
      before = buildCalculationReport(p, { reactions: "summary" });
    const m = p.data as any;
    m.loads.forEach((l: any) => {
      l.Fy *= 2;
      l.q1 *= 2;
      l.q2 *= 2;
    });
    const after = buildCalculationReport(p, { reactions: "summary" });
    expect(after.sections[0].blocks).not.toEqual(before.sections[0].blocks);
    m.supports = [];
    expect(() =>
      buildCalculationReport(p, defaultReportSelection("beam")),
    ).toThrow();
  });
  it("keeps a page footer with generation time and page X/Y", () => {
    const report = buildCalculationReport(
      project("column"),
      defaultReportSelection("column"),
      "Auteur",
      "2026-11-26T10:30:45.000Z",
    );
    const footer = reportDocument(report).footer;
    if (typeof footer !== "function") throw Error();
    const value = JSON.stringify(
      footer(2, 4, { width: 595, height: 842, orientation: "portrait" }),
    );
    expect(value).toContain("Page 2 / 4");
    expect(value).toContain("CaliSigma Structural");
    expect(value).toContain("30:45");
  });
});
describe("Saved-model previews", () => {
  it.each(projectTypes)("has a finite vector preview for $id", ({ id }) => {
    const drawing = projectDrawing(project(id));
    expect(drawing).toContain("<svg");
    expect(drawing).not.toMatch(/NaN|Infinity|undefined/);
    expect(projectPreview(project(id))).toMatch(/^data:image\/svg\+xml/);
  });
  it("changes the thumbnail when geometry or load positions change", () => {
    const p = project("beam"),
      before = projectDrawing(p);
    (p.data as any).loads.find((l: any) => l.type === "point").x += 1;
    expect(projectDrawing(p)).not.toEqual(before);
  });
});
