import { z } from "zod";
export const levelSchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(100),
  height: z.number().positive().max(100),
  slab: z.enum(["cc12", "cc16", "cc20", "dp"]),
  thickness: z.number().positive().max(10),
  usage: z.enum(["A", "B", "C", "D", "E", "H"]),
  q: z.number().nonnegative().max(1000),
  coatings: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().max(100),
        load: z.number().nonnegative().max(1000),
      }),
    )
    .max(100),
  b: z.number().positive().max(1000),
  h: z.number().positive().max(1000),
  e: z.number().positive().max(1000),
});
