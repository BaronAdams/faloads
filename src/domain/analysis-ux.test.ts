import { describe, it, expect } from "vitest";
import {
  beamPreset,
  framePreset,
  solveBeam,
  solveFrame,
  beamSchema,
  frameSchema,
} from "./analysis";
import { profileProperties } from "./section-profile";
import { compactNumber } from "@/lib/compact-number";
import {
  patchAnalysis,
  analysisElements,
  deleteAnalysis,
} from "./analysis-editing";
describe("Section geometry is used by both analysis engines", () => {
  it("uses exact circle and composite centroidal properties", () => {
    expect(profileProperties({ shape: "circle", b: 0.4, h: 8 }).I).toBeCloseTo(
      (Math.PI * 0.4 ** 4) / 64,
      12,
    );
    const i = profileProperties({
      shape: "I",
      b: 0.3,
      h: 0.5,
      tw: 0.02,
      tf: 0.03,
    });
    expect(i.A).toBeCloseTo(2 * 0.3 * 0.03 + 0.02 * 0.44, 12);
    expect(i.I).toBeCloseTo((0.3 * 0.5 ** 3 - 0.28 * 0.44 ** 3) / 12, 12);
    expect(
      profileProperties({ shape: "H", b: 0.3, h: 0.5, tw: 0.02, tf: 0.03 }),
    ).toEqual(i);
    const t = profileProperties({
      shape: "T",
      b: 0.3,
      h: 0.5,
      tw: 0.02,
      tf: 0.03,
    });
    const af = 0.3 * 0.03,
      aw = 0.02 * 0.47,
      z = (af * 0.485 + aw * 0.235) / (af + aw);
    expect(t.I).toBeCloseTo(
      (0.3 * 0.03 ** 3) / 12 +
        af * (0.485 - z) ** 2 +
        (0.02 * 0.47 ** 3) / 12 +
        aw * (0.235 - z) ** 2,
      12,
    );
    expect(() =>
      profileProperties({ shape: "I", b: 0.2, h: 0.4, tw: 0.3 }),
    ).toThrow();
  });
  it("recalculates named beam profile stiffness on import and keeps free properties", () => {
    const m = beamPreset("simple"),
      r = solveBeam(m);
    m.sections[0].shape = "circle";
    m.sections[0].b = 0.3;
    const circular = solveBeam(beamSchema.parse(m));
    expect(Math.max(...circular.v.map(Math.abs))).toBeGreaterThan(
      Math.max(...r.v.map(Math.abs)),
    );
    const next = patchAnalysis(m, [`section:${m.sections[0].id}`], {
      shape: "T",
      tw: 0.04,
      tf: 0.05,
    });
    expect(next.kind === "beam" && next.sections[0].I).toBeCloseTo(
      profileProperties({ ...m.sections[0], shape: "T", tw: 0.04, tf: 0.05 }).I,
      12,
    );
  });
});
function simpleFrame() {
  const m = framePreset("portal");
  m.nodes = [
    { id: "a", x: 0, y: 0, s: 2 },
    { id: "b", x: 8, y: 0, s: 3 },
  ];
  m.mem = [{ id: "m", a: 1, b: 2, bw: 30, h: 50, w: 10, q: 0 }];
  m.nl = [];
  m.pl = [];
  return m;
}
describe("Distributed frame loads retain equilibrium when stretched", () => {
  it("solves a partial trapezoid with its exact resultant and centroid", () => {
    const m = simpleFrame();
    Object.assign(m.mem[0], { w2: 20, loadStart: 0.25, loadEnd: 0.75 });
    const r = solveFrame(m),
      p = 60,
      x = 2 + (4 * (10 + 2 * 20)) / (3 * (10 + 20));
    expect(r.rea[1].r[1]).toBeCloseTo((p * x) / 8, 8);
    expect(r.rea[0].r[1]).toBeCloseTo((p * (8 - x)) / 8, 8);
    expect(r.sy).toBeCloseTo(0, 8);
    expect(r.mem[0].pts.at(-1)!.M).toBeCloseTo(0, 8);
    expect(r.mem[0].pts[0].M).toBeCloseTo(0, 8);
    expect(r.mem[0].pts.find((p) => Math.abs(p.x - 2) < 1e-9)!.M).toBeCloseTo(
      r.rea[0].r[1] * 2,
      8,
    );
  });
  it("handles an inclined member with simultaneous global and local trapezoids", () => {
    const m = simpleFrame();
    m.nodes[1].y = 6;
    m.nodes[0].s = 1;
    m.nodes[1].s = 0;
    Object.assign(m.mem[0], {
      w2: -5,
      q: 3,
      q2: 7,
      loadStart: 0.1,
      loadEnd: 0.9,
    });
    const r = solveFrame(m),
      L = 10 * 0.8,
      w = (10 - 5) / 2,
      q = (3 + 7) / 2;
    expect(r.rea[0].r[0]).toBeCloseTo(q * 0.6 * L, 7);
    expect(r.rea[0].r[1]).toBeCloseTo(w * L - q * 0.8 * L, 7);
    expect(r.mem[0].pts.at(-1)!.M).toBeCloseTo(0, 7);
  });
  it("accepts legacy uniform loads and removing a load preserves its bar", () => {
    const m = simpleFrame(),
      r = solveFrame(m);
    expect(r.rea.map((r) => r.r[1])).toEqual(
      expect.arrayContaining([expect.closeTo(40, 8), expect.closeTo(40, 8)]),
    );
    const elements = analysisElements(m);
    expect(elements.some((e) => e.key === "member-dist:m")).toBe(true);
    const next = deleteAnalysis(m, ["member-dist:m"]);
    expect(next.kind === "frame" && next.mem).toHaveLength(1);
    expect(analysisElements(next).some((e) => e.key === "member-dist:m")).toBe(
      false,
    );
    expect(() =>
      frameSchema.parse({
        ...m,
        mem: [{ ...m.mem[0], loadStart: 0.8, loadEnd: 0.1 }],
      }),
    ).toThrow();
  });
  it("includes axial distributed-load curvature between member ends", () => {
    const m = simpleFrame();
    m.nodes[0].s = 1;
    m.nodes[1] = { id: "b", x: 0, y: 4, s: 0 };
    const r = solveFrame(m),
      p = r.mem[0].pts.find((p) => Math.abs(p.x - 2) < 1e-9)!;
    expect(p.u).toBeCloseTo(-60 / (30e6 * 0.3 * 0.5), 12);
  });
  it("applies profile inertia to actual frame displacement", () => {
    const m = simpleFrame(),
      rect = solveFrame(m);
    m.mem[0].shape = "circle";
    const circle = solveFrame(m);
    expect(
      Math.max(...circle.mem[0].pts.map((p) => Math.abs(p.v))),
    ).toBeGreaterThan(Math.max(...rect.mem[0].pts.map((p) => Math.abs(p.v))));
  });
});
describe("Compact numeric display", () => {
  it.each([
    0, 1.234567, 1234567, -12345, 0.00000017, -0.00001, 1e12, -1e12, 9999.99,
  ])(
    "keeps %s within five characters without presenting a false zero",
    (value) => {
      const displayed = compactNumber(value);
      expect(displayed.length).toBeLessThanOrEqual(5);
      expect(Number(displayed.replace(",", "."))).not.toBeNaN();
      if (value !== 0) expect(Number(displayed.replace(",", "."))).not.toBe(0);
    },
  );
});
