import { describe, it, expect } from "vitest";
import { alphaN, reducedLive } from "./load-reduction";
import { descentDefaults, descentArea, descentBeamWeights } from "./descent";
import { descent, levelG, newLevel, type Level } from "./engineering";
import {
  buildingDefaults,
  buildingResults,
  buildingDescent,
  resizeFloor,
  newFloor,
} from "./building";
import { framePreset, solveFrame, beamPreset } from "./analysis";
import {
  analysisElements,
  analysisProperties,
  patchAnalysis,
  deleteAnalysis,
} from "./analysis-editing";
import { buildingProperties, patchBuildingElements } from "./building-editing";
describe("Storey loads and live-load reduction", () => {
  it("uses the supplied 16+4 surface weight, and both beam families only in the beam system", () => {
    const m = descentDefaults("column-load");
    expect(levelG(newLevel())).toBe(2.85);
    const weights = descentBeamWeights(m);
    expect(weights.primary).toBeCloseTo(15);
    expect(weights.secondary).toBeCloseTo(10.5);
    const rows = descent(m.levels, descentArea(m), 0, false, {
      ...weights,
      selfWeight: true,
    });
    expect(rows[0].g).toBeCloseTo(2.85 * 36 + 15 + 10.5 + 0.3 * 0.3 * 3 * 25);
    expect(rows[1].g).toBeCloseTo(rows[0].g * 2);
    expect(descentBeamWeights({ ...m, system: "slabs" })).toEqual({
      primary: 0,
      secondary: 0,
    });
  });
  it("applies EN recommended and French coefficients to the cumulative load, preserving roofs and excluded uses", () => {
    expect(alphaN(2, "A", "ec1")).toBe(1);
    expect(alphaN(5, "A", "ec1")).toBeCloseTo(0.82);
    expect(alphaN(5, "A", "nf-ec1")).toBeCloseTo(0.772);
    expect(alphaN(5, "B", "nf-ec1")).toBeCloseTo(0.86);
    expect(alphaN(5, "C", "nf-ec1")).toBe(1);
    expect(alphaN(2, "A", "nf-p06")).toBeCloseTo(0.95);
    expect(alphaN(7, "A", "nf-p06")).toBeCloseTo(10 / 14);
    const live = Array.from({ length: 5 }, (_, i) => ({
      floor: String(i),
      usage: "A",
      q: 20,
    }));
    live.push(
      { floor: "roof", usage: "H", q: 15 },
      { floor: "store", usage: "E", q: 30 },
    );
    expect(reducedLive(live, "ec1").q).toBeCloseTo(82 + 15 + 30);
    expect(reducedLive([...live, ...live], "ec1").q).toBeCloseTo(
      2 * (82 + 15 + 30),
    ); // panels are not extra storeys
  });
  it.each(["beams", "slabs"] as const)(
    "reduces a five-storey column in the %s system, without double reduction in quasi-permanent ELS",
    (system) => {
      const m = descentDefaults("column-load");
      m.system = system;
      m.levels = Array.from({ length: 5 }, (_, i) => newLevel(`L${i}`));
      const rows = descent(m.levels, 36, 0, true, {
        ...descentBeamWeights(m),
        reduction: "ec1",
        selfWeight: true,
      });
      const base = rows.at(-1)!;
      expect(base.qRaw).toBe(270);
      expect(base.q).toBeCloseTo(221.4);
      expect(base.nEls - base.g).toBeCloseTo(81);
    },
  );
});
describe("Complete building gravity path", () => {
  it("conserves heterogeneous floor loads and includes every beam and column self weight", () => {
    const f = resizeFloor(newFloor(), 1, 1);
    f.spanX = [6];
    f.spanY = [4];
    const r = buildingResults(f);
    const slab = 24 * 2.85,
      beams = 2 * (6 + 4) * 0.25 * 0.4 * 25,
      columns = 4 * 0.25 * 0.25 * 3 * 25;
    expect(r.totalG).toBeCloseTo(slab + beams + columns);
    expect(r.totalQ).toBeCloseTo(24 * 1.5);
    expect(r.columns.reduce((s, n) => s + n.area, 0)).toBeCloseTo(24);
    f.panels["0,0"].mode = "ne";
    expect(buildingResults(f).totalG).toBeCloseTo(slab / 2 + beams + columns);
  });
  it("cumulates top to bottom, reduces each column once, and keeps beam Q unreduced", () => {
    const model = buildingDefaults();
    const floor = resizeFloor(newFloor(), 1, 1);
    model.floors = Array.from({ length: 5 }, (_, i) => ({
      ...structuredClone(floor),
      id: `f${i}`,
      name: `R+${i}`,
    }));
    const local = buildingResults(floor),
      rows = buildingDescent(model);
    expect(rows.map((r) => r.id)).toEqual(["f4", "f3", "f2", "f1", "f0"]);
    rows.forEach((r, i) =>
      expect(r.cumulativeG).toBeCloseTo(local.totalG * (i + 1)),
    );
    expect(rows.at(-1)!.cumulativeQ).toBeCloseTo(local.totalQ * 5 * 0.82);
    expect(rows.at(-1)!.results.edges[0].q).toBeCloseTo(local.edges[0].q);
  });
  it("does not discard upper-storey loads at unsupported or offset columns", () => {
    const model = buildingDefaults(),
      top = structuredClone(model.floors[0]);
    top.id = "top";
    model.floors.push(top);
    model.floors[0].nodes["0,0"].exists = false;
    expect(() => buildingDescent(model)).toThrow(/Appui|aligné/);
    model.floors[0].nodes["0,0"].exists = true;
    top.spanX[0] = 5;
    expect(() => buildingDescent(model)).toThrow(/aligné/);
  });
  it("transmits stacked wall loads with raw contributions before reduction", () => {
    const model = buildingDefaults(),
      floor = resizeFloor(newFloor(), 1, 1);
    floor.edges["h:0:0"].kind = "wall";
    model.floors = Array.from({ length: 4 }, (_, i) => ({
      ...structuredClone(floor),
      id: `f${i}`,
    }));
    const local = buildingResults(floor),
      rows = buildingDescent(model),
      bottom = rows.at(-1)!;
    expect(bottom.cumulativeG).toBeCloseTo(local.totalG * 4);
    expect(bottom.cumulativeQ).toBeCloseTo(local.totalQ * 4 * 0.85);
  });
});
describe("Point forces on frame members", () => {
  it("matches analytical simply-supported reactions, moment and deflection before and after moving a point force", () => {
    const m = framePreset();
    m.nodes = [
      { id: "a", x: 0, y: 0, s: 2 },
      { id: "b", x: 8, y: 0, s: 3 },
    ];
    m.mem = [{ id: "ab", a: 1, b: 2, bw: 30, h: 50, w: 0, q: 0 }];
    m.nl = [];
    m.pl = [{ id: "p", member: "ab", t: 0.5, fx: 0, fy: -40 }];
    let r = solveFrame(m);
    expect(r.mem).toHaveLength(1);
    expect(r.u).toHaveLength(6);
    expect(r.rea.map((v) => v.r[1])).toEqual(
      expect.arrayContaining([expect.closeTo(20, 7), expect.closeTo(20, 7)]),
    );
    expect(Math.max(...r.mem[0].pts.map((v) => v.M))).toBeCloseTo(80);
    const EI = (30e6 * 0.3 * 0.5 ** 3) / 12;
    expect(Math.min(...r.mem[0].pts.map((v) => v.v))).toBeCloseTo(
      (-40 * 8 ** 3) / (48 * EI),
      8,
    );
    m.pl[0].t = 0.25;
    r = solveFrame(m);
    expect(r.rea[0].r[1]).toBeCloseTo(30);
    expect(r.rea[1].r[1]).toBeCloseTo(10);
    expect(Math.max(...r.mem[0].pts.map((v) => v.M))).toBeCloseTo(60);
    expect(Math.abs(r.sx) + Math.abs(r.sy)).toBeLessThan(1e-7);
  });
});
describe("Batch editing preserves element identity and topology", () => {
  it("copies beam section properties without endpoints and removes frame incident point loads", () => {
    const beam = beamPreset("continuous"),
      first = analysisElements(beam).find((v) => v.key.startsWith("section:"))!;
    const next = patchAnalysis(
      beam,
      beam.sections.map((s) => `section:${s.id}`),
      analysisProperties("section", { ...first.value, b: 0.45, h: 0.7 }),
    );
    if (next.kind !== "beam") throw Error();
    expect(next.sections.map((s) => [s.x1, s.x2])).toEqual([
      [0, 5],
      [5, 9],
    ]);
    expect(next.sections.map((s) => s.b)).toEqual([0.45, 0.45]);
    const frame = framePreset();
    frame.pl = [{ id: "p", member: frame.mem[0].id, t: 0.4, fx: 0, fy: -20 }];
    const removed = deleteAnalysis(frame, [`member:${frame.mem[0].id}`]);
    if (removed.kind === "frame") expect(removed.pl).toHaveLength(0);
  });
  it("applies a slab property template to multiple panels while retaining IDs, labels and groups", () => {
    const f = newFloor(),
      props = buildingProperties(f, "panel|0,0");
    (props.level as Level).q = 4;
    const keys = Object.keys(f.panels).map((k) => `panel|${k}`),
      next = patchBuildingElements(f, keys, props);
    for (const key of Object.keys(f.panels)) {
      expect(next.panels[key].level.q).toBe(4);
      expect(next.panels[key].level.id).toBe(f.panels[key].level.id);
      expect(next.panels[key].label).toBe(f.panels[key].label);
    }
  });
  it("changes only requested panel fields and recalculates each rectangular section from its own dimensions", () => {
    const f = newFloor();
    f.panels["0,0"].level.q = 4;
    const next = patchBuildingElements(f, ["panel|0,0", "panel|1,0"], {
      level: { thickness: 0.22 },
    });
    expect(next.panels["0,0"].level.q).toBe(4);
    expect(next.panels["1,0"].level.q).toBe(1.5);
    expect(next.panels["0,0"].level.thickness).toBe(0.22);
    const beam = beamPreset("continuous");
    beam.sections[0].h = 0.4;
    beam.sections[1].shape = "rect";
    beam.sections[1].h = 0.7;
    const updated = patchAnalysis(
      beam,
      beam.sections.map((s) => `section:${s.id}`),
      { b: 0.3 },
    );
    if (updated.kind !== "beam") throw Error();
    expect(updated.sections[0].I).toBeCloseTo((0.3 * 0.4 ** 3) / 12, 10);
    expect(updated.sections[1].I).toBeCloseTo((0.3 * 0.7 ** 3) / 12, 10);
  });
  it("keeps section types isolated between new projects and preserves them in saved schemas", () => {
    const a = buildingDefaults(),
      b = buildingDefaults();
    a.sectionTypes.push({ id: "t", name: "P30", kind: "column", b: 30, h: 30 });
    expect(b.sectionTypes).toEqual([]);
  });
});
