import { z } from "zod";
import { levelSchema } from "./levels";
import { newLevel } from "./engineering";
export const descentSchema = z
  .object({
    tributaryConvention: z.literal("full-spans").optional(),
    kind: z.enum(["column-load", "wall-load"]),
    system: z.enum(["beams", "slabs"]),
    code: z.enum(["ec2", "bael91"]),
    concrete: z.enum(["C20/25", "C25/30", "C30/37", "C35/45"]),
    spans: z.array(z.number().min(0).max(100)).length(4),
    wallLength: z.number().positive().max(100),
    levels: z.array(levelSchema).min(1).max(100),
    quasi: z.boolean(),
    zone: z.string(),
    region: z.string(),
    terrain: z.string(),
    direction: z.number(),
    primaryB: z.number().positive(),
    primaryH: z.number().positive(),
    secondaryB: z.number().positive(),
    secondaryH: z.number().positive(),
  })
  .transform((value) => ({
    ...value,
    // Older studies stored full centre-to-centre spans and used their halves.
    // Convert once to influence lengths, preserving their effective area.
    spans:
      value.kind === "column-load" && !value.tributaryConvention
        ? value.spans.map((v) => v / 2)
        : value.spans,
    tributaryConvention: "full-spans" as const,
  }));
export type DescentModel = z.infer<typeof descentSchema>;
export function descentDefaults(
  kind: "column-load" | "wall-load",
): DescentModel {
  return {
    kind,
    tributaryConvention: "full-spans",
    system: "beams",
    code: "ec2",
    concrete: "C25/30",
    spans: [3, 3, 3, 3],
    wallLength: 4,
    levels: [newLevel("R+1"), newLevel("RDC")],
    quasi: false,
    zone: "II",
    region: "Intérieure",
    terrain: "IIIb",
    direction: 0,
    primaryB: 25,
    primaryH: 40,
    secondaryB: 20,
    secondaryH: 35,
  };
}
export const descentArea = (model: DescentModel) =>
  model.kind === "wall-load"
    ? (model.wallLength * (model.spans[0] + model.spans[1])) / 2
    : (model.spans[0] + model.spans[1]) * (model.spans[2] + model.spans[3]);
