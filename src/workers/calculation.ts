import { solveBeam, solveFrame, type AnalysisModel } from "@/domain/analysis";
import {
  buildingResults,
  floorWind,
  type BuildingModel,
} from "@/domain/building";
import { descent, type Level } from "@/domain/engineering";
export function calculate(kind: string, model: unknown): unknown {
  if (kind === "analysis") {
    const m = model as AnalysisModel;
    return m.kind === "beam"
      ? { beam: solveBeam(m) }
      : { frame: solveFrame(m) };
  }
  if (kind === "building") {
    const m = model as BuildingModel;
    return m.floors.map((floor, i) => ({
      id: floor.id,
      results: buildingResults(floor),
      wind: floorWind(m, i),
    }));
  }
  const m = model as {
    levels: Level[];
    area: number;
    wallLength: number;
    quasi: boolean;
  };
  return descent(m.levels, m.area, m.wallLength, m.quasi);
}
