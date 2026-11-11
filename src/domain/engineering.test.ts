import { describe, it, expect } from "vitest";
import fixtures from "./legacy-fixtures.json";
import {
  columnPredim,
  wallPredim,
  beamPredim,
  slabPredim,
  stairsPredim,
  balconyPredim,
  retainingPredim,
  footingPredim,
  newLevel,
  descent,
  panelTributary,
  type Code,
  type SupportKind,
} from "./engineering";
import {
  beamPreset,
  framePreset,
  solveBeam,
  solveFrame,
  resizeBeam,
  removeFrameNode,
} from "./analysis";
import {
  newFloor,
  buildingResults,
  resizeFloor,
  mergePanels,
  edgeKey,
} from "./building";
describe("Numerical parity with independently generated Dart fixtures", () => {
  for (const f of fixtures)
    it(`${f.type} ${JSON.stringify(f.input)}`, () => {
      const p = f.input as Record<
        string,
        string | number | boolean | undefined
      >;
      let actual: Record<string, string | number> = {};
      switch (f.type) {
        case "column":
          actual = columnPredim(Number(p.n), "C25/30", p.code as Code);
          break;
        case "wall":
          actual = wallPredim(
            Number(p.n),
            Number(p.length),
            "C25/30",
            p.code as Code,
          );
          break;
        case "beam":
          actual = beamPredim(
            Number(p.length),
            Number(p.q),
            p.support as SupportKind,
          );
          break;
        case "slab":
          actual = slabPredim(Number(p.length), Boolean(p.full));
          break;
        case "stairs":
          actual = stairsPredim(Number(p.height), Number(p.length));
          break;
        case "balcony":
          actual = balconyPredim(Number(p.length), Number(p.g), Number(p.q));
          break;
        case "retaining":
          actual = retainingPredim(
            Number(p.height),
            Number(p.gamma),
            Number(p.phi),
          );
          break;
        case "footing":
          actual = footingPredim(
            p.kind as "isolee" | "filante",
            Number(p.n),
            Number(p.bearing),
            Number(p.support),
          );
          break;
      }
      for (const [key, expected] of Object.entries(f.result)) {
        if (typeof expected === "number")
          expect(actual[key]).toBeCloseTo(expected, 8);
        else expect(actual[key]).toBe(expected);
      }
    });
});
describe("Actual beam and frame analysis", () => {
  it("reproduces the supplied partial-load beam reference", () => {
    const r = solveBeam(beamPreset());
    expect(r.reactions[0].Fy).toBeCloseTo(51, 5);
    expect(r.reactions[1].Fy).toBeCloseTo(37, 5);
    expect(r.extrema.M.max.val).toBeCloseTo(111, 5);
    expect(r.caracteristiques.fleche_max_abs * 1000).toBeCloseTo(7.64245, 3);
  });
  it("matches an analytical simply-supported UDL solution and changes with the load", () => {
    const m = beamPreset("blank");
    m.L = 6;
    m.sections[0].x2 = 6;
    m.supports[1].x = 6;
    m.timoshenko = false;
    m.loads = [
      {
        id: "q",
        type: "dist",
        x: 0,
        x1: 0,
        x2: 6,
        q1: 10,
        q2: 10,
        Fy: 0,
        Fx: 0,
        M: 0,
      },
    ];
    const r = solveBeam(m);
    expect(r.extrema.M.max.val).toBeCloseTo(45, 6);
    expect(r.reactions[0].Fy).toBeCloseTo(30, 5);
    const expected =
      (5 * 10 * 6000 ** 4) / (384 * 30000 * ((300 * 500 ** 3) / 12));
    expect(r.caracteristiques.fleche_max_abs * 1000).toBeCloseTo(expected, 4);
    m.loads[0].q1 = 20;
    m.loads[0].q2 = 20;
    expect(solveBeam(m).extrema.M.max.val).toBeCloseTo(90, 5);
  });
  it("handles the supplied continuous, cantilever and Gerber beam models", () => {
    for (const name of ["continuous", "cantilever", "gerber"]) {
      const r = solveBeam(beamPreset(name));
      expect(r.caracteristiques.fleche_max_abs).toBeGreaterThan(0);
      expect(Math.abs(r.caracteristiques.fermeture.M_fin)).toBeLessThan(1e-4);
    }
  });
  it("rejects discontinuous sections and unstable beams", () => {
    const m = beamPreset();
    m.sections[0].x2 = 7;
    expect(() => solveBeam(m)).toThrow();
    const free = beamPreset();
    free.supports = [];
    expect(() => solveBeam(free)).toThrow();
  });
  it("scales positions when changing the beam length", () => {
    const m = resizeBeam(beamPreset(), 16);
    expect(m.supports[1].x).toBe(16);
    expect(m.loads[1].x).toBe(10);
    expect(m.sections[0].x2).toBe(16);
  });
  it("reproduces frame reactions, internal moment and nodal displacements", () => {
    const r = solveFrame(framePreset());
    expect(r.rea[0].r[1]).toBeCloseTo(55.25991468, 5);
    expect(r.rea[1].r[1]).toBeCloseTo(64.740085, 5);
    expect(Math.max(...r.mem[1].pts.map((p) => p.M))).toBeCloseTo(67.019604, 5);
    expect(
      Math.max(...Array.from({ length: 4 }, (_, i) => Math.abs(r.u[3 * i]))) *
        1000,
    ).toBeCloseTo(2.294234, 5);
    expect(Math.abs(r.sx) + Math.abs(r.sy)).toBeLessThan(1e-7);
  });
  it("rejects a frame mechanism and removes incident elements with a deleted node", () => {
    const m = framePreset();
    m.nodes.forEach((n) => (n.s = 0));
    expect(() => solveFrame(m)).toThrow(/instable/);
    const next = removeFrameNode(framePreset(), 1);
    expect(next.nodes).toHaveLength(3);
    expect(next.nl).toHaveLength(0);
    expect(next.mem.every((b) => b.a <= 3 && b.b <= 3)).toBe(true);
  });
});
describe("Load paths and plan", () => {
  it("accumulates storeys from top to ground without reversing the sequence", () => {
    const levels = [newLevel("Roof"), newLevel("Ground")];
    const rows = descent(levels, 9);
    expect(rows[0].nElu).toBeCloseTo((1.35 * 3.54 + 1.5 * 1.5) * 9, 9);
    expect(rows[1].nElu).toBeCloseTo(rows[0].nElu * 2, 9);
    expect(rows[1].nEls).toBeCloseTo((3.54 + 1.5) * 18, 9);
  });
  it("accumulates the original simplified wind force", () => {
    const rows = descent([newLevel("R+1"), newLevel("RDC")], 12, 4);
    expect(rows[1].windElu).toBeCloseTo(
      1.5 * 4 * 3 * (0.55 + 0.032 * 4.5 + (0.55 + 0.032 * 1.5)),
      9,
    );
  });
  it("preserves panel area when splitting onto its four edges", () => {
    const r = panelTributary(4, 6, 10);
    expect(2 * r.shortArea + 2 * r.longArea).toBe(24);
    expect(r.shortLoad * 4 * 2 + r.longLoad * 6 * 2).toBe(240);
  });
  it("preserves the total nodal tributary area and uniform floor load", () => {
    const r = buildingResults(newFloor());
    expect(r.area).toBe(96);
    expect(r.columns.reduce((s, c) => s + c.area, 0)).toBe(96);
    expect(r.columns.reduce((s, c) => s + c.nElu, 0)).toBeCloseTo(
      r.totalElu,
      8,
    );
  });
  it("can group adjacent panels only after deleting their separating beam", () => {
    const f = newFloor();
    expect(() => mergePanels(f, "0,0", "1,0")).toThrow();
    f.edges[edgeKey(false, 1, 0)].exists = false;
    const next = mergePanels(f, "0,0", "1,0");
    expect(next.panels["0,0"].group).toBe(next.panels["1,0"].group);
    expect(next.panels["0,0"].group).not.toBeNull();
  });
  it("resizes floor slots without dangling coordinates", () => {
    const f = resizeFloor(newFloor(), 1, 1);
    expect(Object.keys(f.nodes)).toHaveLength(4);
    expect(Object.keys(f.edges)).toHaveLength(4);
    expect(Object.keys(f.panels)).toHaveLength(1);
    expect(f.spanX).toEqual([4]);
  });
});
