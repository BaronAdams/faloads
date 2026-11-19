import { Numeric, IconButton } from "./common";
import { ProfilePicker, ProfileDimensions } from "./section-profile";
import { Pencil, X } from "lucide-react";
import {
  analysisElements,
  patchAnalysis,
  type AnalysisSelection,
} from "@/domain/analysis-editing";
import { type AnalysisModel } from "@/domain/analysis";
import { profileProperties, type ProfileShape } from "@/domain/section-profile";
export function AnalysisSelectionSummary({
  model,
  selection,
  multiple,
  onChange,
  onDetails,
  onClear,
}: {
  model: AnalysisModel;
  selection: AnalysisSelection;
  multiple: boolean;
  onChange: (m: AnalysisModel) => void;
  onDetails: () => void;
  onClear: () => void;
}) {
  const key = `${selection.type}:${selection.id}`,
    v = analysisElements(model).find((e) => e.key === key)?.value;
  if (!v) return null;
  const patch = (p: Record<string, unknown>) =>
    onChange(patchAnalysis(model, [key], p));
  const field = (
    prop: string,
    label: string,
    shortLabel: string,
    unit: string,
    min = -1e9,
    max = 1e9,
    factor = 1,
    disabled = false,
  ) => (
    <Numeric
      key={prop}
      compact
      shortLabel={shortLabel}
      label={label}
      value={Number(v[prop] ?? 0) * factor}
      min={min}
      max={max}
      unit={unit}
      disabled={disabled}
      onChange={(value) => patch({ [prop]: value / factor })}
    />
  );
  const profile = selection.type === "section" || selection.type === "member";
  const shape = (v.shape ?? "rect") as ProfileShape;
  return (
    <div
      className="desktop-parameter-bar selection-summary"
      data-tour="parameters-inputs"
    >
      {profile ? (
        <>
          <ProfilePicker
            value={shape}
            onChange={(shape) =>
              patch({
                shape,
                ...(shape === "circle"
                  ? { h: Number(model.kind === "beam" ? v.b : v.bw) }
                  : {}),
              })
            }
          />
          {shape !== "custom" ? (
            <ProfileDimensions
              compact
              value={{
                shape,
                b: Number(model.kind === "beam" ? v.b : v.bw),
                h: Number(v.h),
                tw: v.tw as number | undefined,
                tf: v.tf as number | undefined,
              }}
              unit={model.kind === "beam" ? "m" : "cm"}
              onChange={({ b, ...p }) =>
                patch({
                  ...p,
                  ...(b === undefined
                    ? {}
                    : { [model.kind === "beam" ? "b" : "bw"]: b }),
                })
              }
            />
          ) : (
            <>
              <Numeric
                compact
                shortLabel="A"
                label="Aire A"
                value={Number(v.A ?? (Number(v.bw) * Number(v.h)) / 1e4) * 1e4}
                min={0.001}
                unit="cm²"
                onChange={(A) => patch({ A: A / 1e4 })}
              />
              <Numeric
                compact
                shortLabel="I"
                label="Inertie I"
                value={
                  Number(
                    v.I ??
                      profileProperties({
                        b: Number(v.bw) / 100,
                        h: Number(v.h) / 100,
                      }).I,
                  ) * 1e8
                }
                min={0.001}
                unit="cm⁴"
                onChange={(I) => patch({ I: I / 1e8 })}
              />
            </>
          )}
        </>
      ) : selection.type === "support" ? (
        <>
          {field(
            "x",
            "Position x",
            "x",
            "m",
            0,
            model.kind === "beam" ? model.L : 1000,
            1,
            multiple,
          )}
          {typeof v.uy === "number" &&
            field("uy", "Raideur verticale kᵧ", "kᵧ", "kN/m", 0.001)}
        </>
      ) : selection.type === "hinge" ? (
        field(
          "x",
          "Position x",
          "x",
          "m",
          0.001,
          model.kind === "beam" ? model.L - 0.001 : 1000,
          1,
          multiple,
        )
      ) : selection.type === "load" ? (
        <>
          {v.type === "dist" ? (
            <>
              {field(
                "x1",
                "Début x₁",
                "x₁",
                "m",
                0,
                Number(v.x2) - 0.001,
                1,
                multiple,
              )}
              {field(
                "x2",
                "Fin x₂",
                "x₂",
                "m",
                Number(v.x1) + 0.001,
                model.kind === "beam" ? model.L : 1000,
                1,
                multiple,
              )}
              {field("q1", "Intensité q₁", "q₁", "kN/m")}
              {field("q2", "Intensité q₂", "q₂", "kN/m")}
            </>
          ) : (
            <>
              {field(
                "x",
                "Position x",
                "x",
                "m",
                0,
                model.kind === "beam" ? model.L : 1000,
                1,
                multiple,
              )}
              {v.type === "moment" ? (
                field("M", "Moment M", "M", "kN·m")
              ) : (
                <>
                  {Number(v.Fx) !== 0 &&
                    field("Fx", "Force horizontale Fx", "Fx", "kN")}
                  {(Number(v.Fy) !== 0 || Number(v.Fx) === 0) &&
                    field("Fy", "Force verticale Fy", "Fy", "kN")}
                </>
              )}
            </>
          )}
        </>
      ) : selection.type === "node" ? (
        <>
          {field("x", "Position x", "x", "m", -1000, 1000, 1, multiple)}
          {field("y", "Position y", "y", "m", -1000, 1000, 1, multiple)}
        </>
      ) : selection.type === "member-load" ? (
        <>
          {field("t", "Position sur la barre", "x", "%", 0, 100, 100, multiple)}
          {field("fy", "Force verticale Fy", "Fy", "kN")}
        </>
      ) : selection.type === "member-dist" ? (
        <>
          <Numeric
            compact
            shortLabel="x₁"
            label="Début de la charge"
            value={Number(v.loadStart ?? 0) * 100}
            min={0}
            max={Number(v.loadEnd ?? 1) * 100 - 0.01}
            unit="%"
            disabled={multiple}
            onChange={(t) => patch({ loadStart: t / 100 })}
          />
          <Numeric
            compact
            shortLabel="x₂"
            label="Fin de la charge"
            value={Number(v.loadEnd ?? 1) * 100}
            min={Number(v.loadStart ?? 0) * 100 + 0.01}
            max={100}
            unit="%"
            disabled={multiple}
            onChange={(t) => patch({ loadEnd: t / 100 })}
          />
          {Number(v.w) !== 0 || Number(v.w2 ?? v.w) !== 0 ? (
            <>
              {field("w", "Intensité initiale w₁", "w₁", "kN/m")}
              <Numeric
                compact
                shortLabel="w₂"
                label="Intensité finale w₂"
                value={Number(v.w2 ?? v.w)}
                min={-1e6}
                unit="kN/m"
                onChange={(w2) => patch({ w2 })}
              />
            </>
          ) : (
            <>
              {field("q", "Charge locale initiale qᵧ₁", "qᵧ₁", "kN/m")}
              <Numeric
                compact
                shortLabel="qᵧ₂"
                label="Charge locale finale qᵧ₂"
                value={Number(v.q2 ?? v.q)}
                min={-1e6}
                unit="kN/m"
                onChange={(q2) => patch({ q2 })}
              />
            </>
          )}
        </>
      ) : (
        <>
          {field("fx", "Force horizontale Fx", "Fx", "kN")}
          {field("fy", "Force verticale Fy", "Fy", "kN")}
        </>
      )}
      <IconButton label="Modifier la sélection" onClick={onDetails}>
        <Pencil />
      </IconButton>
      <IconButton label="Désélectionner" onClick={onClear}>
        <X />
      </IconButton>
    </div>
  );
}
