import { z } from "zod";
export const sectionTypesSchema = z
  .array(
    z.object({
      id: z.string(),
      name: z.string().min(1).max(100),
      kind: z.enum(["beam", "column", "slab", "wall"]),
      b: z.number().positive().max(1000),
      h: z.number().positive().max(1000),
      slab: z.enum(["cc12", "cc16", "cc20", "dp"]).optional(),
    }),
  )
  .max(100)
  .default([]);
export type SectionType = z.infer<typeof sectionTypesSchema>[number];
