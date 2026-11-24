import { describe, it, expect } from "vitest";
import {
  duplicateAnalysis,
  frameCanvas,
  frameBounds,
} from "./analysis-duplication";
import { beamPreset, framePreset, solveFrame, solveBeam } from "./analysis";
import { deleteAnalysis, patchAnalysis } from "./analysis-editing";
import { diagramNormal } from "./diagram";
describe("Directed positive diagram ordinate", () => {
  it("is +90° in physical space for both orientations of horizontal, vertical and inclined members", () => {
    for (const b of [
      { x: 10, y: 0 },
      { x: -10, y: 0 },
      { x: 0, y: -10 },
      { x: 0, y: 10 },
      { x: 3, y: -4 },
    ]) {
      const n = diagramNormal({ x: 0, y: 0 }, b);
      expect(b.x * n.x + b.y * n.y).toBeCloseTo(0, 10);
      // In SVG, a physical counterclockwise rotation has a negative signed screen cross product.
      expect(b.x * n.y - b.y * n.x).toBeLessThan(0);
    }
    expect(diagramNormal({ x: 0, y: 0 }, { x: 1, y: 0 })).toEqual({
      x: 0,
      y: -1,
    });
  });
});
describe("Independent copies at the cursor", () => {
  it("copies a beam point load at the chosen abscissa without changing its source", () => {
    const model = beamPreset(),
      source = model.loads.find((l) => l.type === "point")!;
    const result = duplicateAnalysis(model, [`load:${source.id}`], {
      x: 3.25,
      y: 50,
    });
    expect(result.model.kind).toBe("beam");
    if (result.model.kind !== "beam") return;
    const copy = result.model.loads.at(-1)!;
    expect(copy.x).toBe(3.25);
    expect(copy.Fy).toBe(source.Fy);
    expect(copy.id).not.toBe(source.id);
    expect(model.loads).toHaveLength(result.model.loads.length - 1);
    const before = solveBeam(model).reactions.reduce((s, r) => s + r.Fy, 0),
      after = solveBeam(result.model).reactions.reduce((s, r) => s + r.Fy, 0);
    expect(after - before).toBeCloseTo(source.Fy, 6);
  });
  it("keeps distributed beam length and bounds, and excludes sections", () => {
    const model = beamPreset(),
      source = model.loads.find((l) => l.type === "dist")!;
    const result = duplicateAnalysis(
      model,
      [`section:${model.sections[0].id}`, `load:${source.id}`],
      { x: model.L + 10, y: 0 },
    );
    if (result.model.kind !== "beam") throw Error("Wrong project");
    const copy = result.model.loads.at(-1)!;
    expect(copy.x2).toBe(model.L);
    expect(copy.x2 - copy.x1).toBeCloseTo(source.x2 - source.x1, 10);
    expect(result.keys).toHaveLength(1);
    expect(() =>
      duplicateAnalysis(model, [`section:${model.sections[0].id}`], {
        x: 2,
        y: 0,
      }),
    ).toThrow(/section/);
  });
  it("copies beam supports and hinges with fresh IDs and scalar placement", () => {
    const model = beamPreset("gerber"),
      s = model.supports[0];
    const copy = duplicateAnalysis(model, [`support:${s.id}`], {
      x: 1.5,
      y: 0,
    });
    if (copy.model.kind !== "beam") throw Error("Wrong project");
    expect(copy.model.supports.at(-1)!.x).toBe(1.5);
    expect(copy.model.supports.at(-1)!.uy).toBe(s.uy);
    const h = model.hinges[0];
    if (h) {
      const r = duplicateAnalysis(model, [`hinge:${h.id}`], { x: 4, y: 0 });
      if (r.model.kind === "beam") expect(r.model.hinges.at(-1)!.x).toBe(4);
    }
  });
  it("projects a copied frame point force onto its assigned inclined bar", () => {
    const model = framePreset();
    model.pl = [{ id: "p", member: model.mem[0].id, t: 0.2, fx: 7, fy: -12 }];
    const r = duplicateAnalysis(model, ["member-load:p"], { x: 3, y: 3 });
    if (r.model.kind !== "frame") throw Error("Wrong project");
    expect(r.model.pl.at(-1)!.t).toBeCloseTo(0.75, 10);
    expect(r.model.pl.at(-1)!.member).toBe(model.mem[0].id);
    expect(r.model.pl.at(-1)!.fx).toBe(7);
  });
  it("retains connectivity and bar loads when a bar is copied, with a stable physical cursor mapping", () => {
    const model = framePreset(),
      bar = model.mem[1];
    model.pl = [{ id: "p", member: bar.id, t: 0.3, fx: 2, fy: -4 }];
    const bounds = frameBounds(model),
      canvas = frameCanvas(model, 600, 1, bounds),
      point = { x: 2, y: 3 };
    expect(
      canvas.inverse({ x: canvas.X(point.x), y: canvas.Y(point.y) }).x,
    ).toBeCloseTo(2, 10);
    const result = duplicateAnalysis(model, [`member:${bar.id}`], point);
    if (result.model.kind !== "frame") throw Error("Wrong project");
    const b = result.model.mem.at(-1)!,
      a = result.model.nodes[b.a - 1],
      z = result.model.nodes[b.b - 1];
    expect(a.x).toBe(2);
    expect(a.y).toBe(3);
    expect(z.x - a.x).toBe(6);
    expect(b.w).toBe(bar.w);
    expect(result.model.pl.at(-1)!.member).toBe(b.id);
    const after = frameCanvas(result.model, 600, 1, bounds);
    expect(after.X(a.x)).toBeCloseTo(canvas.X(point.x), 10);
    expect(after.Y(a.y)).toBeCloseTo(canvas.Y(point.y), 10);
  });
  it("stores a duplicated distribution independently and preserves exact load equilibrium on edit and delete", () => {
    const model = framePreset();
    model.nodes = [
      { id: "a", x: 0, y: 0, s: 2 },
      { id: "b", x: 8, y: 0, s: 3 },
    ];
    model.mem = [
      {
        id: "m",
        a: 1,
        b: 2,
        bw: 30,
        h: 50,
        w: 10,
        w2: 20,
        q: 0,
        loadStart: 0,
        loadEnd: 0.5,
      },
    ];
    model.pl = [];
    model.nl = [];
    const result = duplicateAnalysis(model, ["member-dist:m"], { x: 6, y: 0 });
    if (result.model.kind !== "frame") throw Error("Wrong project");
    expect(result.model.dl).toHaveLength(1);
    expect(result.model.dl![0].loadStart).toBe(0.5);
    expect(
      solveFrame(result.model).rea.reduce((s, r) => s + r.r[1], 0),
    ).toBeCloseTo(120, 7);
    const edited = patchAnalysis(result.model, result.keys, { w: 5, w2: 5 });
    if (edited.kind !== "frame") throw Error("Wrong project");
    expect(edited.mem[0].w).toBe(10);
    expect(solveFrame(edited).rea.reduce((s, r) => s + r.r[1], 0)).toBeCloseTo(
      80,
      7,
    );
    const removed = deleteAnalysis(edited, result.keys);
    if (removed.kind !== "frame") throw Error("Wrong project");
    expect(removed.dl).toHaveLength(0);
    expect(solveFrame(removed).rea.reduce((s, r) => s + r.r[1], 0)).toBeCloseTo(
      60,
      7,
    );
  });
});
