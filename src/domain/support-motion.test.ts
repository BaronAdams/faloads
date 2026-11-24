import { describe, it, expect } from "vitest";
import {
  framePreset,
  solveFrame,
  frameSchema,
  beamPreset,
  solveBeam,
  support,
} from "./analysis";

function member() {
  const model = framePreset();
  model.nodes = [
    { id: "a", x: 0, y: 0, s: 1 },
    { id: "b", x: 8, y: 0, s: 1 },
  ];
  model.mem = [{ id: "ab", a: 1, b: 2, bw: 30, h: 50, w: 0, q: 0 }];
  model.nl = [];
  model.pl = [];
  return model;
}
const EI = (30e6 * 0.3 * 0.5 ** 3) / 12;
describe("Imposed support motion in global frame coordinates", () => {
  it("solves a fully restrained member with a differential settlement", () => {
    const model = member(),
      delta = -0.01;
    model.nodes[1].dy = delta;
    const result = solveFrame(model);
    expect(result.u[4]).toBe(delta);
    expect(result.rea[0].r[1]).toBeCloseTo((-12 * EI * delta) / 8 ** 3, 8);
    expect(result.rea[1].r[1]).toBeCloseTo((12 * EI * delta) / 8 ** 3, 8);
    expect(result.rea[0].r[2]).toBeCloseTo((-6 * EI * delta) / 8 ** 2, 8);
    expect(result.sy).toBeCloseTo(0, 8);
  });
  it("transfers prescribed rotation and axial extension to member end forces", () => {
    const model = member();
    model.nodes[0].drz = 0.002;
    model.nodes[1].dx = 0.001;
    const result = solveFrame(model);
    expect(result.rea[0].r[2]).toBeCloseTo((4 * EI * 0.002) / 8, 8);
    expect(result.rea[1].r[2]).toBeCloseTo((2 * EI * 0.002) / 8, 8);
    expect(result.rea[1].r[0]).toBeCloseTo((30e6 * 0.3 * 0.5 * 0.001) / 8, 8);
    expect(result.mem[0].pts.at(-1)!.theta).toBeCloseTo(0, 10);
  });
  it("subtracts Kfc uc from the free system and preserves rigid translation/rotation on an inclined cantilever", () => {
    const model = member();
    model.nodes[0] = { ...model.nodes[0], dx: 0.003, dy: -0.002, drz: 0.001 };
    model.nodes[1] = { ...model.nodes[1], x: 4, y: 3, s: 0 };
    // Force subdivision as well: virtual member-load stations must retain support motion.
    Object.assign(model.mem[0], { loadStart: 0.2, loadEnd: 0.7 });
    const result = solveFrame(model);
    expect(result.u[3]).toBeCloseTo(0.003 - 0.001 * 3, 10);
    expect(result.u[4]).toBeCloseTo(-0.002 + 0.001 * 4, 10);
    expect(result.u[5]).toBeCloseTo(0.001, 10);
    for (const reaction of result.rea[0].r) expect(reaction).toBeCloseTo(0, 7);
    for (const p of result.mem[0].pts) expect(p.M).toBeCloseTo(0, 7);
  });
  it("moves the spring anchor without constraining its node and excludes anchor forcing from load equilibrium", () => {
    const model = member();
    model.nodes[0] = { ...model.nodes[0], s: 2, dy: 0.01 };
    model.nodes[1] = { ...model.nodes[1], s: 5, ky: 1000, dy: 0.01 };
    const result = solveFrame(model);
    expect(result.u[4]).toBeCloseTo(0.01, 10);
    expect(result.u[5]).toBeCloseTo(0, 10);
    expect(result.rea[1].r[1]).toBeCloseTo(0, 8);
    expect(result.sy).toBeCloseTo(0, 8);
    model.nl = [{ id: "load", n: 2, fx: 0, fy: -10, m: 0 }];
    const loaded = solveFrame(model);
    expect(loaded.u[4]).toBeCloseTo(0, 8);
    expect(loaded.rea[1].r[1]).toBeCloseTo(10, 8);
    expect(loaded.sy).toBeCloseTo(0, 8);
  });
  it("ignores motion on free DOFs and still reads old projects", () => {
    const legacy = member(),
      before = solveFrame(legacy);
    legacy.nodes[1] = { ...legacy.nodes[1], s: 3, dx: 0.5, drz: 2 };
    expect(frameSchema.parse(legacy).nodes[0].dx).toBeUndefined();
    const after = solveFrame(legacy);
    expect(after.u).toEqual(before.u);
  });
});
describe("Beam conventions retained for imposed motion", () => {
  it("uses right/down/clockwise and generates the fixed-end settlement reactions", () => {
    const model = beamPreset("simple");
    model.loads = [];
    model.selfWeight.enabled = false;
    model.timoshenko = false;
    model.supports = [
      support(0, "fixed"),
      { ...support(8, "fixed"), dy: 0.01 },
    ];
    const result = solveBeam(model);
    expect(result.v.at(-1)).toBeCloseTo(0.01, 10);
    expect(Math.abs(result.reactions[0].Fy)).toBeCloseTo(
      (12 * EI * 0.01) / 8 ** 3,
      5,
    );
  });
});
