import { z } from "zod";
import { profileShapes } from "./section-profile";
export const sectionTypesSchema = z
  .array(
    z.object({
      id: z.string(),
      name: z.string().min(1).max(100),
      kind: z.enum(["beam", "column", "slab", "wall"]),
      b: z.number().positive().max(1000),
      h: z.number().positive().max(1000),
      shape: z.enum(profileShapes).optional(),
      tw: z.number().positive().optional(),
      tf: z.number().positive().optional(),
      A: z.number().positive().optional(), // cm²
      I: z.number().positive().optional(), // cm⁴, strong axis
      catalogue: z.string().optional(),
      slab: z.enum(["cc12", "cc16", "cc20", "dp"]).optional(),
    }),
  )
  .max(100)
  .default([]);
export type SectionType = z.infer<typeof sectionTypesSchema>[number];

// IPE dimensions and strong-axis properties: ArcelorMittal Orange Book, standard IPE.
// https://orangebook.arcelormittal.com/node/6 (not IPE A/AA/O).
export const ipeCatalogue: SectionType[] = [
  [80, 46, 3.8, 5.2, 7.64, 80.1],
  [100, 55, 4.1, 5.7, 10.3, 171],
  [120, 64, 4.4, 6.3, 13.2, 318],
  [160, 82, 5, 7.4, 20.1, 869],
  [200, 100, 5.6, 8.5, 28.5, 1940],
  [240, 120, 6.2, 9.8, 39.1, 3890],
  [300, 150, 7.1, 10.7, 53.8, 8360],
  [400, 180, 8.6, 13.5, 84.5, 23100],
].map(([h, b, tw, tf, A, I]) => ({
  id: `ipe-${h}`,
  name: `IPE ${h}`,
  kind: "beam",
  shape: "I",
  catalogue: `IPE ${h}`,
  b: b / 10,
  h: h / 10,
  tw: tw / 10,
  tf: tf / 10,
  A,
  I,
}));
export function sectionCatalogue(profiles = false): SectionType[] {
  const sizes = [
    [20, 20],
    [20, 30],
    [25, 40],
    [30, 30],
    [30, 40],
    [30, 50],
    [30, 60],
    [40, 40],
  ];
  return [
    ...(["beam", "column"] as const).flatMap((kind) =>
      sizes.map(([b, h]) => ({
        id: `${kind}-${b}-${h}`,
        name: `${kind === "beam" ? "Poutre" : "Poteau"} ${b} × ${h}`,
        kind,
        b,
        h,
      })),
    ),
    ...[15, 20, 25].map((b) => ({
      id: `wall-${b}`,
      name: `Voile ${b} cm`,
      kind: "wall" as const,
      b,
      h: 300,
    })),
    ...[15, 20, 25].map((h) => ({
      id: `slab-${h}`,
      name: `Dalle ${h} cm`,
      kind: "slab" as const,
      b: 100,
      h,
      slab: "dp" as const,
    })),
    {
      id: "slab-cc16",
      name: "Plancher 16+4",
      kind: "slab",
      b: 100,
      h: 20,
      slab: "cc16",
    },
    ...(profiles ? structuredClone(ipeCatalogue) : []),
  ];
}
/** Convert catalogue dimensions (cm) and properties (cm²/cm⁴) to analysis units. */
export function analysisSectionType(t: SectionType, beam: boolean) {
  const scale = beam ? 0.01 : 1;
  return {
    shape: t.shape ?? "rect",
    ...(beam ? { b: t.b * scale } : { bw: t.b }),
    h: t.h * scale,
    tw: t.tw === undefined ? undefined : t.tw * scale,
    tf: t.tf === undefined ? undefined : t.tf * scale,
    catalogue: t.catalogue,
    A: t.A === undefined ? undefined : t.A / 1e4,
    I: t.I === undefined ? undefined : t.I / 1e8,
  };
}
