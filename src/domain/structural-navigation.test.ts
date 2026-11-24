import { describe, it, expect } from "vitest";
import { parseReadingPosition } from "./analysis-reading";
import { newFloor, floorSchema } from "./building";
import { levelG } from "./engineering";
import { duplicateFloor } from "./building-duplication";
import { buildingProjection, arrangeBuildingLabels } from "./building-view";
import { toggleSelection, selectionFamily } from "./selection";
describe("Precise station input", () => {
  it("accepts decimal comma and bounds in the selected unit", () => {
    expect(parseReadingPosition("125,5", 4, "cm").station).toBeCloseTo(1.255);
    expect(parseReadingPosition("4000", 4, "mm").station).toBe(4);
    expect(parseReadingPosition("0", 4, "m").station).toBe(0);
    expect(parseReadingPosition("6.708204", Math.sqrt(45), "m").station).toBe(
      Math.sqrt(45),
    );
    for (const value of ["-1", "4.01", "", "NaN", "1e2", "2,3,4", "Infinity"])
      expect(parseReadingPosition(value, 4, "m").error).toBeTruthy();
  });
});
describe("Floor duplication", () => {
  it("copies only selected families and creates independent identities", () => {
    const source = newFloor();
    source.panels["0,0"].level.coatings = [
      { id: "finish", name: "Carrelage", load: 1 },
    ];
    const copy = duplicateFloor(source, {
      name: "R+1",
      scope: "selection",
      keys: ["panel|0,0", "node|1,1"],
      kinds: ["slabs", "columns"],
      loads: true,
    });
    expect(floorSchema.safeParse(copy).success).toBe(true);
    expect(Object.values(copy.nodes).filter((n) => n.exists)).toHaveLength(1);
    expect(Object.values(copy.panels).filter((p) => p.exists)).toHaveLength(1);
    expect(Object.values(copy.edges).some((e) => e.exists)).toBe(false);
    expect(copy.id).not.toBe(source.id);
    expect(copy.panels["0,0"].level.id).not.toBe(source.panels["0,0"].level.id);
    copy.panels["0,0"].level.coatings[0].load = 9;
    expect(source.panels["0,0"].level.coatings[0].load).toBe(1);
  });
  it("can omit added loads while preserving structural self weight and geometry", () => {
    const source = newFloor();
    source.obliques = [
      {
        id: "free",
        kind: "beam",
        x1: 0,
        y1: 0,
        x2: 4,
        y2: 4,
        b: 25,
        h: 40,
        area: 0,
        angle: 0,
        g: 10,
        q: 5,
      },
    ];
    const copy = duplicateFloor(source, {
      name: "R+1",
      scope: "all",
      keys: [],
      kinds: ["slabs", "beams"],
      loads: false,
    });
    expect(copy.spanX).toEqual(source.spanX);
    expect(copy.panels["0,0"].level.q).toBe(0);
    expect(copy.panels["0,0"].level.coatings).toEqual([]);
    expect(copy.obliques[0].g).toBe(0);
    expect(copy.obliques[0].id).not.toBe("free");
    expect(levelG(copy.panels["0,0"].level)).toBeGreaterThan(0);
    expect(() =>
      duplicateFloor(source, {
        name: "R+2",
        scope: "selection",
        keys: [],
        kinds: ["slabs"],
        loads: true,
      }),
    ).toThrow(/Aucun élément/);
  });
});
describe("Rigid building orbit and annotations", () => {
  it("keeps the centre and scale fixed for every orientation", () => {
    for (const [yaw, pitch] of [
      [35, 28],
      [125, 28],
      [35, -42],
      [0, 80],
    ]) {
      const projection = buildingProjection(12, 8, 9, yaw, pitch, 700, 1);
      expect(projection.project(6, 4, 4.5)).toMatchObject({
        x: 500,
        y: 350,
        depth: 0,
      });
      expect(projection.scale).toBe(
        buildingProjection(12, 8, 9, 0, 0, 700, 1).scale,
      );
      const a = projection.project(0, 0, 0),
        b = projection.project(12, 8, 9);
      expect(
        Math.hypot(
          (a.x - b.x) / projection.scale,
          (a.y - b.y) / projection.scale,
          a.depth - b.depth,
        ),
      ).toBeCloseTo(Math.hypot(12, 8, 9));
    }
  });
  it("separates crowded labels, prioritizes selection and reports hidden labels", () => {
    const labels = Array.from({ length: 100 }, (_, i) => ({
      id: String(i),
      x: 150,
      y: 120,
      text: `Poteau ${i} · 1234 kN`,
      color: "white",
      priority: i === 99 ? 100 : 0,
    }));
    const layout = arrangeBuildingLabels(
      labels,
      { left: 0, right: 300, top: 0, bottom: 240 },
      1,
    );
    expect(layout.placed[0].id).toBe("99");
    expect(layout.hidden).toBeGreaterThan(0);
    for (const [i, a] of layout.placed.entries())
      for (const b of layout.placed.slice(i + 1))
        expect(
          Math.abs(a.labelX - b.labelX) < (a.w + b.w) / 2 &&
            Math.abs(a.labelY - b.labelY) < (a.h + b.h) / 2,
        ).toBe(false);
  });
});
it("retains mixed selections when Shift removes one element", () => {
  const elements = [
    { key: "a", family: "beam" },
    { key: "b", family: "column" },
    { key: "c", family: "beam" },
  ];
  expect(selectionFamily(elements, ["a", "b", "c"])).toBeUndefined();
  const remaining = toggleSelection(["a", "b", "c"], "b", true);
  expect(remaining).toEqual(["a", "c"]);
  expect(selectionFamily(elements, remaining)).toBe("beam");
});
