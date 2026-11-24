import { describe, it, expect } from "vitest";
import { roofDefault, roofAnalysis, roofGeometry, type Roof } from "./roof";
import {
  newFloor,
  resizeFloor,
  buildingDefaults,
  buildingDescent,
  buildingResults,
  buildingSchema,
} from "./building";
function fixture(shape: Roof["shape"] = "gable") {
  const floor = resizeFloor(newFloor(), 2, 2);
  floor.spanX = [6, 6];
  floor.spanY = [4, 4];
  const roof: Roof = {
    ...roofDefault(),
    enabled: true,
    shape,
    rise: 4,
    spacing: 3,
    loads: [
      {
        id: "g",
        name: "G",
        value: 1,
        basis: "plan" as const,
        face: 0,
        action: "G" as const,
      },
      {
        id: "q",
        name: "Q",
        value: 2,
        basis: "plan" as const,
        face: 0,
        action: "maintenance" as const,
      },
    ],
  };
  return { floor, roof };
}
describe("Roof gravity model", () => {
  for (const shape of ["mono", "gable", "hip"] as const)
    it(`${shape}: preserves total force and plan moments through purlins and trusses`, () => {
      const { floor, roof } = fixture(shape),
        r = roofAnalysis(floor, roof);
      expect(r.planArea).toBe(96);
      expect(r.G).toBeCloseTo(96, 9);
      expect(r.Q).toBeCloseTo(192, 9);
      expect(r.supports.reduce((s, p) => s + p.g, 0)).toBeCloseTo(96, 8);
      expect(r.supports.reduce((s, p) => s + p.g * p.x, 0)).toBeCloseTo(
        96 * 6,
        7,
      );
      expect(r.supports.reduce((s, p) => s + p.g * p.y, 0)).toBeCloseTo(
        96 * 4,
        7,
      );
      expect(r.balanceG).toBeCloseTo(0, 8);
    });
  it("distinguishes sloped surface from horizontal projection", () => {
    const { floor, roof } = fixture("mono");
    roof.loads[0].basis = "slope";
    expect(roofAnalysis(floor, roof).G).toBeCloseTo(
      96 * Math.sqrt(1 + (4 / 8) ** 2),
      8,
    );
    expect(roofGeometry(floor, roof).area).toBeCloseTo(96 * Math.sqrt(1.25), 8);
  });
  it("retains asymmetric slope loads and rotated support geometry", () => {
    const { floor, roof } = fixture();
    roof.loads[0].face = 1;
    roof.loads[0].value = 2;
    const r = roofAnalysis(floor, roof);
    expect(r.G).toBeCloseTo(96, 8);
    expect(
      r.supports.filter((p) => p.v === 0).reduce((s, p) => s + p.g, 0),
    ).toBeCloseTo(72, 8);
    expect(
      r.supports.filter((p) => p.v === 8).reduce((s, p) => s + p.g, 0),
    ).toBeCloseTo(24, 8);
    roof.axis = "y";
    const rotated = roofAnalysis(floor, roof);
    expect(
      rotated.supports.filter((p) => p.x === 0).reduce((s, p) => s + p.g, 0),
    ).toBeCloseTo(72, 8);
  });
  it("uses the selected variable case without adding maintenance and snow together", () => {
    const { floor, roof } = fixture();
    roof.loads.push({
      id: "s",
      name: "Snow",
      action: "snow",
      face: 0,
      value: 4,
      basis: "plan",
    });
    expect(roofAnalysis(floor, roof).Q).toBeCloseTo(192, 8);
    roof.variable = "snow";
    expect(roofAnalysis(floor, roof).Q).toBeCloseTo(384, 8);
  });
  it("integrates a hip end-face load at its actual centroid", () => {
    const { floor, roof } = fixture("hip");
    roof.loads[0].face = 2;
    const r = roofAnalysis(floor, roof),
      f = r.facets[1];
    expect(r.G).toBeCloseTo(f.plan, 8);
    expect(r.supports.reduce((s, p) => s + p.g * p.x, 0)).toBeCloseTo(
      f.plan * (12 - 4 / 3),
      7,
    );
  });
  it("transfers reactions to eaves beams with the correct lever arm, and then to the ground once", () => {
    const model = buildingDefaults(),
      { floor, roof } = fixture();
    model.floors = [floor, structuredClone(floor)];
    model.floors[1].id = "top";
    model.floors[1].name = "Toit";
    const before = buildingDescent(model);
    model.roof = roof;
    const after = buildingDescent(model);
    expect(() => structuredClone(after)).not.toThrow();
    expect(after[0].cumulativeG - before[0].cumulativeG).toBeCloseTo(96, 7);
    expect(after.at(-1)!.cumulativeG - before.at(-1)!.cumulativeG).toBeCloseTo(
      96,
      7,
    );
    expect(after.at(-1)!.cumulativeQ - before.at(-1)!.cumulativeQ).toBeCloseTo(
      192,
      7,
    );
    expect(
      after[0].local.roof!.routes.some((r) => r.target.startsWith("Poutre")),
    ).toBe(true);
    const force =
      after[0].results.columns.reduce((s, n) => s + n.g, 0) -
      before[0].results.columns.reduce((s, n) => s + n.g, 0);
    expect(force).toBeCloseTo(96, 7);
  });
  it("can remove the under-roof slab without discarding beams or columns", () => {
    const { floor, roof } = fixture();
    roof.keepSlab = false;
    const r = buildingResults(floor, roof);
    expect(r.area).toBe(0);
    expect(r.edges.length).toBeGreaterThan(0);
    expect(r.roof!.G).toBeCloseTo(96, 8);
  });
  it("refuses a missing eaves carrier and a roof with no permanent loads before calculation", () => {
    const { floor, roof } = fixture();
    floor.edges["h:0:0"].exists = false;
    const model = { ...buildingDefaults(), floors: [floor], roof };
    expect(() => buildingDescent(model)).toThrow(/rive/);
    floor.edges["h:0:0"].exists = true;
    roof.loads[0].value = 0;
    expect(() => buildingDescent(model)).toThrow(/poids propres/);
  });
  it("keeps legacy projects valid and rejects orphaned face loads or excessive frame counts", () => {
    expect(buildingSchema.safeParse(buildingDefaults()).success).toBe(true);
    const { floor, roof } = fixture("mono");
    roof.loads[0].face = 4;
    expect(
      buildingSchema.safeParse({ ...buildingDefaults(), floors: [floor], roof })
        .success,
    ).toBe(false);
    roof.loads[0].face = 0;
    floor.spanX = [1000, 1000];
    expect(() => roofAnalysis(floor, roof)).toThrow(/120/);
  });
});
