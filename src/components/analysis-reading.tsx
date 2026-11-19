import { CheckCircle2, TriangleAlert } from "lucide-react";
import { Panel, Choice, Numeric, FormGrid, Disclosure } from "./common";
import type { AnalysisModel, BeamResult, FrameResult } from "@/domain/analysis";
import {
  beamDeflectionChecks,
  frameDeflectionChecks,
  defaultDeflectionLimit,
  lengthFactor,
} from "@/domain/analysis-reading";
import { fmt } from "@/lib/utils";

export function AnalysisReadingSettings({
  model,
  onChange,
}: {
  model: AnalysisModel;
  onChange: (value: AnalysisModel) => void;
}) {
  const limit = model.deflectionLimit ?? defaultDeflectionLimit;
  return (
    <Panel title="Lecture et flèche admissible">
      <div className="form-stack">
        <Choice
          label="Unité des positions au curseur"
          value={model.probeUnit ?? "m"}
          options={[
            { value: "m", label: "Mètres · m" },
            { value: "cm", label: "Centimètres · cm" },
            { value: "mm", label: "Millimètres · mm" },
          ]}
          onChange={(unit) =>
            onChange({
              ...model,
              probeUnit: unit as AnalysisModel["probeUnit"],
            })
          }
        />
        <FormGrid>
          <Choice
            label="Flèche admissible"
            value={limit.mode}
            options={[
              { value: "ratio", label: "Portée / n" },
              { value: "absolute", label: "Valeur en mm" },
            ]}
            onChange={(mode) =>
              onChange({
                ...model,
                deflectionLimit: { ...limit, mode: mode as typeof limit.mode },
              })
            }
          />
          {limit.mode === "ratio" ? (
            <Numeric
              label="Diviseur n · L/n"
              value={limit.ratio}
              min={1}
              max={100000}
              onChange={(ratio) =>
                onChange({ ...model, deflectionLimit: { ...limit, ratio } })
              }
            />
          ) : (
            <Numeric
              label="Limite de déplacement"
              unit="mm"
              value={limit.mm}
              min={0.001}
              max={100000}
              onChange={(mm) =>
                onChange({ ...model, deflectionLimit: { ...limit, mm } })
              }
            />
          )}
        </FormGrid>
        <p className="hint">
          Critère de projet réglable, initialement L/250. L est la distance
          entre appuis ou la longueur de console pour une poutre, et la longueur
          de chaque barre pour un cadre. Les calculs conservent leurs unités
          internes.
        </p>
      </div>
    </Panel>
  );
}

export function DeflectionResults({
  model,
  beam,
  frame,
}: {
  model: AnalysisModel;
  beam?: BeamResult;
  frame?: FrameResult;
}) {
  const checks =
    model.kind === "beam" && beam
      ? beamDeflectionChecks(model, beam)
      : model.kind === "frame" && frame
        ? frameDeflectionChecks(model, frame)
        : [];
  if (!checks.length) return null;
  const worst = checks.reduce((a, b) =>
    a.utilization >= b.utilization ? a : b,
  );
  const passed = worst.utilization <= 1 + 1e-9;
  const Icon = passed ? CheckCircle2 : TriangleAlert;
  const limit = model.deflectionLimit ?? defaultDeflectionLimit;
  const unit = model.probeUnit ?? "m";
  return (
    <Panel title="Contrôle de flèche">
      <div
        className={`deflection-verdict ${passed ? "within-limit" : "over-limit"}`}
        data-testid="deflection-check"
        data-utilization={worst.utilization}
      >
        <Icon aria-hidden="true" size={18} />
        <div>
          <strong>{passed ? "Critère respecté" : "Limite dépassée"}</strong>
          <p>
            {worst.label} · {fmt(worst.utilization * 100, 1)} % de la limite
          </p>
        </div>
      </div>
      <dl className="deflection-values">
        <div>
          <dt>Flèche maximale sur {worst.label.toLowerCase()}</dt>
          <dd>
            {fmt(worst.actualMm, 3)} <small>mm</small>
          </dd>
        </div>
        <div>
          <dt>
            Flèche admissible
            {limit.mode === "ratio" ? ` · L/${fmt(limit.ratio, 0)}` : ""}
          </dt>
          <dd>
            {fmt(worst.allowableMm, 3)} <small>mm</small>
          </dd>
        </div>
      </dl>
      <p className="hint">
        {fmt(worst.actualMm, 3)} mm {passed ? "≤" : ">"}{" "}
        {fmt(worst.allowableMm, 3)} mm. Le tronçon affiché est celui dont le
        rapport flèche / limite est le plus élevé.
      </p>
      <Disclosure
        title={
          model.kind === "beam"
            ? "Comparaison par travée / console"
            : "Comparaison par barre"
        }
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Élément</th>
                <th>L · {unit}</th>
                <th>Flèche · mm</th>
                <th>Admissible · mm</th>
                <th>État</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => (
                <tr key={c.label}>
                  <th>{c.label}</th>
                  <td>{fmt(c.length * lengthFactor(unit))}</td>
                  <td>{fmt(c.actualMm, 3)}</td>
                  <td>{fmt(c.allowableMm, 3)}</td>
                  <td>{c.utilization <= 1 + 1e-9 ? "Respecté" : "Dépassé"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Disclosure>
      <p className="hint deflection-scope">
        Critère de projet sur le déplacement transversal élastique par rapport à
        l’axe initial, déplacements d’appui inclus. Ne vaut pas vérification
        réglementaire de flèche en béton armé.
        {model.kind === "frame" &&
          " Le déplacement global du cadre est indiqué séparément."}
      </p>
    </Panel>
  );
}
