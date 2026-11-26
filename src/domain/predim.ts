import { z } from "zod";
import { sectionTypesSchema, sectionCatalogue } from "./section-types";
import type { ProjectType } from "./projects";
import type { Code } from "./engineering";
export const predimSchema = z.object({
  sectionTypes: sectionTypesSchema,
  n: z.number().nonnegative().max(1e8),
  length: z.number().positive().max(1000),
  height: z.number().positive().max(1000),
  g: z.number().nonnegative().max(1e6),
  q: z.number().nonnegative().max(1e6),
  concrete: z.enum(["C20/25", "C25/30", "C30/37", "C35/45"]),
  code: z.enum(["ec2", "bael91"]),
  support: z.enum(["isostatique", "continue_", "console"]),
  full: z.boolean(),
  soil: z.number().positive().max(1e6),
  supportCm: z.number().positive().max(1000),
  footing: z.enum(["isolee", "filante"]),
  gamma: z.number().positive().max(100),
  phi: z.number().min(0).max(60),
  width: z.number().positive().max(1000),
});
export type PredimModel = z.infer<typeof predimSchema>;
export function predimDefaults(
  type: ProjectType,
  code: Code = "ec2",
  concrete = "C25/30",
): PredimModel {
  return {
    sectionTypes: sectionCatalogue(),
    n: type === "column" ? 800 : 500,
    length:
      type === "wall"
        ? 2.5
        : type === "balcony"
          ? 1.2
          : type === "stairs"
            ? 4.2
            : 4.5,
    height: type === "stairs" ? 2.7 : 2.5,
    g: 3,
    q: type === "beam-size" ? 25 : 1.5,
    concrete: concrete as PredimModel["concrete"],
    code,
    support: "isostatique",
    full: false,
    soil: 200,
    supportCm: 30,
    footing: "isolee",
    gamma: 18,
    phi: 30,
    width: 1,
  };
}
