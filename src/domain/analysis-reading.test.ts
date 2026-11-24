import { describe, it, expect } from "vitest";
import {
  projectReading,
  interpolateReading,
  beamDeflectionChecks,
  frameDeflectionChecks,
  lengthFactor,
} from "./analysis-reading";
import {
  beamPreset,
  framePreset,
  solveBeam,
  solveFrame,
  beamSchema,
} from "./analysis";

describe("Structural cursor reading", () => {
  it("projects along horizontal, vertical and inclined axes without extending a member", () => {
    const member = {
      id: "m",
      label: "B1",
      a: { x: 10, y: 20 },
      b: { x: 110, y: 20 },
      length: 8,
    };
    expect(projectReading({ x: 35, y: 400 }, [member])?.station).toBe(2);
    expect(projectReading({ x: 111, y: 20 }, [member])).toBeUndefined();
    const vertical = { ...member, b: { x: 10, y: 120 } };
    expect(projectReading({ x: 300, y: 45 }, [vertical])?.point).toEqual({
      x: 10,
      y: 45,
    });
    expect(projectReading({ x: 10, y: 120 }, [vertical])?.station).toBe(8);
    const diagonal = { ...member, a: { x: 0, y: 0 }, b: { x: 100, y: 100 } };
    expect(projectReading({ x: 40, y: 60 }, [diagonal])?.station).toBe(4);
  });
  it("chooses the closest eligible bar and excludes zero-length axes", () => {
    const bar = {
      id: "a",
      label: "B1",
      length: 4,
      a: { x: 0, y: 0 },
      b: { x: 100, y: 0 },
    };
    expect(
      projectReading({ x: 50, y: 40 }, [
        bar,
        { ...bar, id: "b", a: { x: 0, y: 50 }, b: { x: 100, y: 50 } },
      ])?.member.id,
    ).toBe("b");
    expect(
      projectReading({ x: 0, y: 0 }, [{ ...bar, b: bar.a }]),
    ).toBeUndefined();
  });
  it("interpolates the rendered curve and takes the right-hand value at a jump", () => {
    const points = [
      { station: 0, x: 0, y: 0, value: 0 },
      { station: 2, x: 50, y: 30, value: 12 },
      { station: 2, x: 50, y: 5, value: 2 },
      { station: 4, x: 100, y: 0, value: 0 },
    ];
    expect(interpolateReading(points, 1)).toEqual({
      station: 1,
      x: 25,
      y: 15,
      value: 6,
    });
    expect(interpolateReading(points, 2)?.value).toBe(2);
    expect(interpolateReading(points, 3)?.value).toBe(1);
    expect(interpolateReading(points, 4)?.value).toBe(0);
    expect(interpolateReading([], 1)).toBeUndefined();
  });
  it("converts position units independently of the calculation units", () => {
    expect(
      [undefined, "m", "cm", "mm"].map((u) => lengthFactor(u as "m")),
    ).toEqual([1, 1, 100, 1000]);
  });
});
describe("Project deflection criterion", () => {
  it("compares a simply-supported beam against its actual span, in mm", () => {
    const model = beamPreset();
    model.timoshenko = false;
    model.loads = [{ ...model.loads[0], x2: model.L, q1: 20, q2: 20 }];
    const result = solveBeam(model),
      [check] = beamDeflectionChecks(model, result);
    const expected =
      ((5 * 20 * model.L ** 4) /
        (384 * model.material.E * 1000 * model.sections[0].I)) *
      1000;
    expect(check.actualMm).toBeCloseTo(expected, 2);
    expect(check.allowableMm).toBe(32);
    expect(check.utilization).toBeCloseTo(expected / 32, 4);
  });
  it("uses separate continuous spans, and the actual overhang length", () => {
    const model = beamPreset("continuous");
    expect(
      beamDeflectionChecks(model, solveBeam(model)).map((c) => c.allowableMm),
    ).toEqual([20, 16]);
    const cantilever = beamPreset("cantilever");
    const [c] = beamDeflectionChecks(cantilever, solveBeam(cantilever));
    expect(c.label).toBe("Console 1");
    expect(c.allowableMm).toBe(16);
  });
  it("supports an absolute project limit and ignores section subdivision as span limits", () => {
    const model = beamPreset("continuous");
    model.deflectionLimit = { mode: "absolute", ratio: 500, mm: 0.1 };
    const checks = beamDeflectionChecks(model, solveBeam(model));
    expect(checks.every((c) => c.allowableMm === 0.1)).toBe(true);
    expect(Math.max(...checks.map((c) => c.utilization))).toBeGreaterThan(1);
  });
  it("includes cantilever tip deflection and separates axial movement in a frame", () => {
    const model = framePreset();
    model.nodes = [
      { id: "a", x: 0, y: 0, s: 1 },
      { id: "b", x: 4, y: 0, s: 0 },
    ];
    model.mem = [{ id: "m", a: 1, b: 2, bw: 30, h: 50, w: 0, q: 0 }];
    model.nl = [{ id: "p", n: 2, fx: 0, fy: -10, m: 0 }];
    const [c] = frameDeflectionChecks(model, solveFrame(model));
    const inertia = (0.3 * 0.5 ** 3) / 12;
    expect(c.actualMm).toBeCloseTo(
      ((10 * 4 ** 3) / (3 * 30e6 * inertia)) * 1000,
      3,
    );
    expect(c.allowableMm).toBe(16);
    model.nl = [{ id: "p", n: 2, fx: 10, fy: 0, m: 0 }];
    expect(
      frameDeflectionChecks(model, solveFrame(model))[0].actualMm,
    ).toBeLessThan(1e-8);
  });
  it("keeps existing projects readable and persists per-project reading settings", () => {
    const model = beamPreset();
    expect(beamSchema.parse(model).probeUnit).toBeUndefined();
    expect(
      beamSchema.parse({
        ...model,
        probeUnit: "cm",
        deflectionLimit: { mode: "ratio", ratio: 500, mm: 10 },
      }).deflectionLimit?.ratio,
    ).toBe(500);
  });
});
