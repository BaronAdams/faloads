import { describe, it, expect } from "vitest";
import {
  characteristicIndices,
  frameDisplacement,
  placeDiagramLabels,
  diagramFactor,
  isForceDiagram,
} from "./diagram";
import { framePreset, solveFrame } from "./analysis";
describe("Structural plot values", () => {
  it("retains member ends and both signed extrema exactly once", () => {
    expect(characteristicIndices([0, -8, 3, 9, 0])).toEqual([0, 1, 3, 4]);
    expect(characteristicIndices([-12, -12, -12])).toEqual([0, 2]);
    expect(characteristicIndices([5])).toEqual([0]);
    expect(characteristicIndices([])).toEqual([]);
  });
  it("reports true, unamplified frame translation at both ends", () => {
    const model = framePreset(),
      result = solveFrame(model);
    result.mem.forEach((member, i) => {
      const first = frameDisplacement(member, member.pts[0]);
      const last = frameDisplacement(member, member.pts[member.pts.length - 1]);
      const a = (model.mem[i].a - 1) * 3,
        b = (model.mem[i].b - 1) * 3;
      expect(first.dx).toBeCloseTo(result.u[a], 10);
      expect(first.dy).toBeCloseTo(result.u[a + 1], 10);
      expect(last.dx).toBeCloseTo(result.u[b], 10);
      expect(last.dy).toBeCloseTo(result.u[b + 1], 10);
      expect(last.magnitude).toBeCloseTo(
        Math.hypot(result.u[b], result.u[b + 1]),
        10,
      );
    });
  });
  it("separates shared-node labels without losing or clipping them", () => {
    const labels = placeDiagramLabels(
      Array.from({ length: 4 }, () => ({
        x: 500,
        y: 200,
        nx: 0,
        ny: 1,
        text: "M = 45,00 kN·m",
      })),
      1,
      500,
    );
    expect(labels).toHaveLength(4);
    expect(new Set(labels.map((p) => `${p.x}:${p.y}`)).size).toBe(4);
    for (const p of labels) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(1000);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(500);
    }
  });
  it("fills internal-force fields and converts displacement and rotation units only", () => {
    for (const field of ["M", "V", "N"] as const) {
      expect(isForceDiagram(field)).toBe(true);
      expect(diagramFactor(field)).toBe(1);
    }
    for (const field of ["v", "theta"] as const) {
      expect(isForceDiagram(field)).toBe(false);
      expect(diagramFactor(field)).toBe(1000);
    }
  });
});
