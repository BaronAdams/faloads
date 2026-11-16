import { descentBeamWeights, type DescentModel } from "@/domain/descent";
import { solveBeam, solveFrame, type AnalysisModel } from "@/domain/analysis";
import { buildingDescent, type BuildingModel } from "@/domain/building";
import { descent } from "@/domain/engineering";
export function calculate(kind: string, model: unknown): unknown {
  if (kind === "analysis") {
    const m = model as AnalysisModel;
    return m.kind === "beam"
      ? { beam: solveBeam(m) }
      : { frame: solveFrame(m) };
  }
  if (kind === "building") {
    const m = model as BuildingModel;
    return buildingDescent(m);
  }
  const m = model as DescentModel & { area: number };
  return descent(
    m.levels,
    m.area,
    m.kind === "wall-load" ? m.wallLength : 0,
    m.quasi,
    { ...descentBeamWeights(m), reduction: m.reduction, selfWeight: true },
  );
}
