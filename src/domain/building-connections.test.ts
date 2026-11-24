import { describe, it, expect } from "vitest";
import {
  buildingDefaults,
  buildingDescent,
  buildingResults,
  newFloor,
  resizeFloor,
} from "./building";
import { validateBuilding } from "./building-validation";
import { calculate } from "@/workers/calculation";
import { descentDefaults, descentSchema } from "./descent";
import {
  analysisSectionType,
  ipeCatalogue,
  sectionCatalogue,
} from "./section-types";
import { beamPreset, solveBeam, framePreset, solveFrame } from "./analysis";
import { patchAnalysis } from "./analysis-editing";

function storeys(count = 3) {
  const model = buildingDefaults(),
    base = resizeFloor(newFloor(), 1, 1);
  model.reduction = "none";
  model.floors = Array.from({ length: count }, (_, i) => ({
    ...structuredClone(base),
    id: `f${i}`,
    name: `R+${i}`,
  }));
  return model;
}
describe("Column connectivity and traceable storey descent", () => {
  it("records every local G/Q contribution in each continuous column, top to ground", () => {
    const model = storeys();
    model.floors.forEach((f, i) => {
      f.height = 2 + i;
      f.panels["0,0"].level.q = i + 1;
    });
    const locals = model.floors.map((f) => buildingResults(f)),
      rows = buildingDescent(model);
    for (let j = 0; j < rows.length; j++) {
      const i = 2 - j,
        n = rows[j].results.columns.find((n) => n.key === "0,0")!;
      expect(n.g).toBeCloseTo(
        locals
          .slice(i)
          .reduce((s, r) => s + r.columns.find((n) => n.key === "0,0")!.g, 0),
      );
      expect(n.sources.map((s) => s.floor)).toEqual(
        model.floors.slice(i).map((f) => f.id),
      );
      expect(n.sources.reduce((s, v) => s + v.g, 0)).toBeCloseTo(n.g);
      expect(n.sources.reduce((s, v) => s + v.q, 0)).toBeCloseTo(n.q);
      expect(rows[j].results.totalG).toBeCloseTo(rows[j].cumulativeG);
    }
  });
  it("does not add upper loads to a lower column whose chain ends at this floor", () => {
    const model = storeys(2),
      top = model.floors[1];
    top.nodes["1,1"].exists = false;
    top.edges["h:1:0"].exists = false;
    top.edges["v:1:0"].exists = false;
    const n = buildingDescent(model)
      .at(-1)!
      .results.columns.find((n) => n.key === "1,1")!;
    expect(n.sources).toHaveLength(1);
    expect(n.g).toBeCloseTo(
      buildingResults(model.floors[0]).columns.find((n) => n.key === "1,1")!.g,
    );
  });
  it("blocks unsupported upper columns instead of dropping their loads or matching node labels", () => {
    const model = storeys(2);
    model.floors[1].spanX[0] = 5;
    const issues = validateBuilding(model);
    expect(
      issues.some((v) => /interrompue/.test(v.message) && v.floor === "f1"),
    ).toBe(true);
    expect(() => buildingDescent(model)).toThrow(/aligné/);
  });
  it("connects free and grid columns by physical position, independent of object ID", () => {
    const model = storeys(2),
      top = model.floors[1];
    top.nodes["0,0"].exists = false;
    top.obliques.push({
      id: "free-top",
      kind: "column",
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 0,
      b: 25,
      h: 25,
      angle: 0,
      area: 0,
      g: 0,
      q: 0,
    });
    expect(validateBuilding(model)).toEqual([]);
    const rows = buildingDescent(model),
      lower = rows[1].results.columns.find((n) => n.key === "0,0")!;
    expect(lower.sources).toHaveLength(2);
    expect(rows[1].cumulativeG).toBeCloseTo(
      rows[1].local.totalG + rows[0].local.totalG,
    );
    expect(rows[1].cumulativeQ).toBeCloseTo(
      rows[1].local.totalQ + rows[0].local.totalQ,
    );
  });
  it("rejects duplicate columns and beams without a connected endpoint", () => {
    const model = storeys(1),
      f = model.floors[0];
    f.obliques.push({
      id: "double",
      kind: "column",
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 0,
      b: 25,
      h: 25,
      angle: 0,
      area: 0,
      g: 0,
      q: 0,
    });
    expect(
      validateBuilding(model).some((v) => /même nœud/.test(v.message)),
    ).toBe(true);
    f.obliques = [];
    f.nodes["0,0"].exists = false;
    expect(
      validateBuilding(model).some(
        (v) => v.element.startsWith("edge|") && /Appui/.test(v.message),
      ),
    ).toBe(true);
  });
  it("free beams transmit reactions to free columns regardless of collection order", () => {
    const model = storeys(1),
      f = model.floors[0];
    const col = (id: string, x: number) => ({
      id,
      kind: "column" as const,
      x1: x,
      y1: 2,
      x2: x,
      y2: 2,
      b: 20,
      h: 20,
      angle: 0,
      area: 2,
      g: 1,
      q: 2,
    });
    f.obliques = [
      col("a", 1),
      col("b", 3),
      { ...col("beam", 1), kind: "beam", x2: 3, g: 3, q: 4 },
    ];
    const first = buildingDescent(model)[0].results.obliques.find(
      (o) => o.id === "a",
    )!;
    expect(first.g).toBeCloseTo(
      2 + 0.2 * 0.2 * 3 * 25 + ((3 + 0.2 * 0.2 * 25) * 2) / 2,
    );
    expect(first.q).toBeCloseTo(4 + (4 * 2) / 2);
    f.obliques.reverse();
    expect(
      buildingDescent(model)[0].results.obliques.find((o) => o.id === "a")!.g,
    ).toBeCloseTo(first.g);
  });
});
describe("Independent isolated-support geometry at each floor", () => {
  it.each(["column-load", "wall-load"] as const)(
    "uses local influence areas and beam weights for %s, including raw cumulative Q",
    (kind) => {
      const model = descentDefaults(kind);
      model.reduction = "none";
      model.levels[0].tributary = {
        area: 10,
        wallLength: 2,
        primaryB: 20,
        primaryH: 30,
        secondaryB: 20,
        secondaryH: 20,
        primaryLength: 4,
        secondaryLength: 3,
      };
      model.levels[1].tributary = {
        ...model.levels[0].tributary,
        area: 30,
        wallLength: 5,
        primaryLength: 6,
        primaryH: 50,
      };
      const rows = calculate("descent", { ...model, area: 999 }) as any[];
      expect(rows.map((r) => r.area)).toEqual([10, 30]);
      expect(rows[0].gs).toBeCloseTo(28.5);
      expect(rows[1].gs).toBeCloseTo(85.5);
      expect(rows[1].qRaw).toBeCloseTo(60);
      expect(rows[0].gp).toBeCloseTo(kind === "column-load" ? 6 : 0);
      expect(rows[1].gp).toBeCloseTo(kind === "column-load" ? 15 : 0);
      expect(rows[1].g).toBeCloseTo(
        rows.reduce((s, r) => s + r.gs + r.gr + r.gp + r.gsec + r.gv, 0),
      );
      expect(
        descentSchema.parse(JSON.parse(JSON.stringify(model))).levels[0]
          .tributary!.area,
      ).toBe(10);
    },
  );
});
describe("Ready-to-use independent section catalogues", () => {
  it("keeps IPE copies independent and preserves tabulated strong-axis properties", () => {
    const a = sectionCatalogue(true),
      b = sectionCatalogue(true);
    a.find((s) => s.id === "ipe-200")!.h = 999;
    expect(b.find((s) => s.id === "ipe-200")!.h).toBe(20);
    const t = ipeCatalogue.find((s) => s.id === "ipe-200")!,
      model = beamPreset();
    model.timoshenko = false;
    const updated = patchAnalysis(
      model,
      model.sections.map((s) => `section:${s.id}`),
      analysisSectionType(t, true),
    );
    if (updated.kind !== "beam") throw Error();
    expect(updated.sections[0].A).toBeCloseTo(28.5e-4);
    expect(updated.sections[0].I).toBeCloseTo(1940e-8);
    expect(solveBeam(updated).M.every(Number.isFinite)).toBe(true);
    const custom = patchAnalysis(
      updated,
      [`section:${updated.sections[0].id}`],
      { h: 0.3 },
    );
    if (custom.kind !== "beam") throw Error();
    expect(custom.sections[0].catalogue).toBeUndefined();
    expect(custom.sections[0].I).not.toBeCloseTo(1940e-8, 9);
    const f = framePreset();
    Object.assign(f.mem[1], analysisSectionType(t, false));
    expect(
      solveFrame(f).mem.every((m) => m.pts.every((p) => Number.isFinite(p.M))),
    ).toBe(true);
  });
});
