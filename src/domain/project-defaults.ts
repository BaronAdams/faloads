import { beamPreset, framePreset } from "./analysis";
import { buildingDefaults } from "./building";
import { descentDefaults } from "./descent";
import { predimDefaults } from "./predim";
import type { Workspace } from "@/lib/storage";
import type { ProjectType } from "./projects";

export function projectDefaults(
  type: ProjectType,
  preferences: Workspace["preferences"],
) {
  if (type === "beam") return beamPreset();
  if (type === "frame") return framePreset();
  if (type === "building") return buildingDefaults();
  if (type === "column-load" || type === "wall-load")
    return { ...descentDefaults(type), ...preferences };
  return predimDefaults(type, preferences.code, preferences.concrete);
}
