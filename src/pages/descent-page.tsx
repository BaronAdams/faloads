import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { EditorSheet, EditorFooter } from "@/components/editor-sheet";
import {
  TributarySketch,
  DescentProfile,
  LoadEvolutionChart,
} from "@/components/descent-graphs";
import { ArrowLeft, ArrowRight, Check, Plus, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Panel,
  ProjectHeader,
  Numeric,
  Choice,
  FormGrid,
  Metric,
  Notice,
  ProjectIcon,
} from "@/components/common";
import { LevelEditor, levelSchema } from "@/components/level-editor";
import {
  newLevel,
  descent,
  columnPosition,
  columnPredim,
  wallPredim,
  concreteClasses,
  levelG,
  coatingG,
  type Code,
  type Level,
} from "@/domain/engineering";
import { useWorkspace } from "@/lib/workspace";
import { fmt } from "@/lib/utils";
import { type Project } from "@/lib/storage";
export const descentSchema = z.object({
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
});
export type DescentModel = z.infer<typeof descentSchema>;
export function descentDefaults(
  kind: "column-load" | "wall-load",
): DescentModel {
  return {
    kind,
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
export function DescentPage({
  kind,
  project,
}: {
  kind: "column-load" | "wall-load";
  project?: Project;
}) {
  const { drafts, workspace } = useWorkspace(),
    key = project?.id ?? kind,
    [model, setModel] = useState<DescentModel>(() => {
      const r = descentSchema.safeParse(drafts.get(key) ?? project?.data);
      return r.success
        ? r.data
        : {
            ...descentDefaults(kind),
            code: workspace.preferences.code,
            concrete: workspace.preferences
              .concrete as DescentModel["concrete"],
            quasi: workspace.preferences.quasi,
          };
    }),
    [name, setName] = useState(
      project?.name ??
        `${kind === "column-load" ? "Poteau" : "Voile"} — descente de charges`,
    ),
    [step, setStep] = useState(0),
    [visited, setVisited] = useState(0),
    [levelEditor, setLevelEditor] = useState<Level | null>(null);
  useEffect(() => {
    drafts.set(key, model);
  }, [model, key, drafts]);
  const wall = kind === "wall-load",
    area = wall
      ? (model.wallLength * (model.spans[0] + model.spans[1])) / 2
      : ((model.spans[0] + model.spans[1]) *
          (model.spans[2] + model.spans[3])) /
        4,
    rows = descent(
      model.levels,
      area,
      wall ? model.wallLength : 0,
      model.quasi,
    ),
    base = rows[rows.length - 1];
  const patch = (p: Partial<DescentModel>) => setModel({ ...model, ...p });
  const advance = (next: number) => {
    if (next > step) {
      const invalid = document.querySelector<HTMLInputElement>("input:invalid");
      if (invalid) {
        invalid.reportValidity();
        return;
      }
      if (step === 1 && area <= 0) return;
      setVisited(Math.max(visited, next));
    }
    setStep(next);
  };
  const swap = (i: number, j: number) => {
    const a = [...model.levels];
    [a[i], a[j]] = [a[j], a[i]];
    patch({ levels: a });
  };
  const steps = [
    "Système",
    wall ? "Aire tributaire" : "Nœud et portées",
    "Niveaux",
    "Récapitulatif",
    "Résultats",
  ];
  return (
    <div className="project-page">
      <ProjectHeader
        type={kind}
        project={project}
        data={model}
        name={name}
        setName={setName}
        extra={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Imprimer la fiche"
            onClick={() => window.print()}
          >
            <Printer />
          </Button>
        }
      />
      <nav className="stepper" aria-label="Étapes du projet">
        {steps.map((label, i) => (
          <button
            key={label}
            disabled={i > visited}
            className={i === step ? "active" : i < step ? "complete" : ""}
            onClick={() => advance(i)}
            aria-current={i === step ? "step" : undefined}
          >
            <span>{i < step ? <Check size={14} /> : i + 1}</span>
            <strong>{label}</strong>
          </button>
        ))}
      </nav>
      <div className="descent-content">
        {step === 0 && (
          <div className="two-columns">
            <Panel title="Système porteur">
              <div className="form-stack">
                <Choice
                  label="Cheminement des charges"
                  value={model.system}
                  onChange={(system) =>
                    patch({ system: system as "beams" | "slabs" })
                  }
                  options={[
                    { value: "beams", label: "Poutres et dalles" },
                    { value: "slabs", label: "Dalles seules" },
                  ]}
                />
                <Choice
                  label="Règlement"
                  value={model.code}
                  onChange={(code) => patch({ code: code as Code })}
                  options={[
                    { value: "ec2", label: "Eurocode 2" },
                    { value: "bael91", label: "BAEL 91" },
                  ]}
                />
                <Choice
                  label="Classe de béton"
                  value={model.concrete}
                  onChange={(concrete) =>
                    patch({ concrete: concrete as DescentModel["concrete"] })
                  }
                  options={concreteClasses}
                />
                <Choice
                  label="Combinaison ELS"
                  value={model.quasi ? "quasi" : "characteristic"}
                  onChange={(v) => patch({ quasi: v === "quasi" })}
                  options={[
                    {
                      value: "characteristic",
                      label: "Caractéristique · G + Q",
                    },
                    { value: "quasi", label: "Quasi permanente · G + 0,3Q" },
                  ]}
                />
              </div>
            </Panel>
            <div className="result-stack">
              <Panel className="system-preview">
                <ProjectIcon type={kind} size={160} />
                <h2>{wall ? "Voile porteur" : "Poteau porteur"}</h2>
                <p>
                  Des surfaces d’influence aux efforts cumulés, niveau par
                  niveau.
                </p>
              </Panel>
              <Notice>
                Les contributions de planchers sont cumulées du niveau le plus
                haut vers le RDC. Les paramètres du système servent à décrire le
                modèle ; le poids propre des poutres et poteaux n’est pas ajouté
                automatiquement.
              </Notice>
              {wall && <WindFields value={model} onChange={patch} />}
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="two-columns">
            <Panel
              title={
                wall
                  ? "Largeur d’influence du voile"
                  : "Portées autour du poteau"
              }
              description="Une portée nulle représente un côté sans plancher."
            >
              <div className="form-stack">
                {!wall && (
                  <Choice
                    label="Position du poteau"
                    value={columnPosition(model.spans)}
                    options={["Intérieur", "De rive", "D’angle"]}
                    onChange={(v) =>
                      patch({
                        spans:
                          v === "Intérieur"
                            ? [3, 3, 3, 3]
                            : v === "De rive"
                              ? [0, 3, 3, 3]
                              : [0, 3, 0, 3],
                      })
                    }
                  />
                )}
                {wall && (
                  <Numeric
                    label="Longueur du voile"
                    value={model.wallLength}
                    min={0.1}
                    max={100}
                    unit="m"
                    onChange={(wallLength) => patch({ wallLength })}
                  />
                )}
                <FormGrid>
                  {model.spans.slice(0, wall ? 2 : 4).map((v, i) => (
                    <Numeric
                      key={i}
                      label={
                        wall
                          ? i === 0
                            ? "Portée avant"
                            : "Portée arrière"
                          : [
                              "Portée gauche L₁",
                              "Portée droite L₂",
                              "Portée haute L₃",
                              "Portée basse L₄",
                            ][i]
                      }
                      value={v}
                      max={100}
                      unit="m"
                      onChange={(n) =>
                        patch({
                          spans: model.spans.map((s, j) => (i === j ? n : s)),
                        })
                      }
                    />
                  ))}
                </FormGrid>
                {!wall && model.system === "beams" && (
                  <>
                    <h3>Sections des poutres adjacentes</h3>
                    <FormGrid>
                      <Numeric
                        label="Poutre principale b"
                        value={model.primaryB}
                        min={1}
                        unit="cm"
                        onChange={(primaryB) => patch({ primaryB })}
                      />
                      <Numeric
                        label="Poutre principale h"
                        value={model.primaryH}
                        min={1}
                        unit="cm"
                        onChange={(primaryH) => patch({ primaryH })}
                      />
                      <Numeric
                        label="Poutre secondaire b"
                        value={model.secondaryB}
                        min={1}
                        unit="cm"
                        onChange={(secondaryB) => patch({ secondaryB })}
                      />
                      <Numeric
                        label="Poutre secondaire h"
                        value={model.secondaryH}
                        min={1}
                        unit="cm"
                        onChange={(secondaryH) => patch({ secondaryH })}
                      />
                    </FormGrid>
                  </>
                )}
              </div>
            </Panel>
            <div className="result-stack">
              <Panel title="Surface d’influence — vue 2D">
                <TributarySketch
                  spans={model.spans}
                  wall={wall}
                  wallLength={model.wallLength}
                  withBeams={model.system === "beams"}
                  primaryB={model.primaryB}
                  secondaryB={model.secondaryB}
                />
                <div className="formula mono">
                  {wall
                    ? "A = L × (L_av + L_ar)/2"
                    : "A = (L₁ + L₂)/2 × (L₃ + L₄)/2"}
                </div>
              </Panel>
              <Metric label="Aire tributaire" value={area} unit="m²" />
              {area === 0 && (
                <Notice danger>
                  Définissez au moins une portée dans chaque direction.
                </Notice>
              )}
            </div>
          </div>
        )}
        {step === 2 && (
          <>
            <div className="section-heading">
              <div>
                <h2>Les niveaux portés</h2>
                <p>
                  Ordre de calcul : du haut vers le bas. Déplacez les niveaux
                  avec les flèches.
                </p>
              </div>
              <Button
                onClick={() =>
                  setLevelEditor(newLevel(`Niveau ${model.levels.length + 1}`))
                }
              >
                <Plus /> Ajouter un niveau
              </Button>
            </div>
            <div className="level-layout">
              <div className="levels-grid">
                {model.levels.map((level, i) => (
                  <LevelEditor
                    key={level.id}
                    level={level}
                    wall={wall}
                    onEdit={() => setLevelEditor(structuredClone(level))}
                    onChange={(next) =>
                      patch({
                        levels: model.levels.map((l) =>
                          l.id === level.id ? next : l,
                        ),
                      })
                    }
                    onRemove={
                      model.levels.length > 1
                        ? () =>
                            patch({
                              levels: model.levels.filter(
                                (l) => l.id !== level.id,
                              ),
                            })
                        : undefined
                    }
                    onUp={i > 0 ? () => swap(i, i - 1) : undefined}
                    onDown={
                      i < model.levels.length - 1
                        ? () => swap(i, i + 1)
                        : undefined
                    }
                  />
                ))}
              </div>
              <Panel
                title="Coupe verticale"
                description="Hauteurs et sections, du haut vers le bas"
                className="profile-panel"
              >
                <DescentProfile
                  levels={model.levels}
                  wall={wall}
                  onEdit={(level) => setLevelEditor(structuredClone(level))}
                />
              </Panel>
            </div>
          </>
        )}
        {step === 3 && (
          <Panel title="Vérifier les données avant calcul">
            <div className="metrics-grid">
              <Metric label="Surface d’influence" value={area} unit="m²" />
              <Metric label="Nombre de niveaux" value={model.levels.length} />
              <Metric
                label="Hauteur totale"
                value={model.levels.reduce((s, l) => s + l.height, 0)}
                unit="m"
              />
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Niveau</th>
                    <th>h · m</th>
                    <th>G plancher · kN/m²</th>
                    <th>G revêt. · kN/m²</th>
                    <th>Q · kN/m²</th>
                  </tr>
                </thead>
                <tbody>
                  {model.levels.map((l) => (
                    <tr key={l.id}>
                      <th scope="row">{l.label}</th>
                      <td>{fmt(l.height)}</td>
                      <td>{fmt(levelG(l))}</td>
                      <td>{fmt(coatingG(l))}</td>
                      <td>{fmt(l.q)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Notice>
              ELU = 1,35G + 1,5Q · ELS = {model.quasi ? "G + 0,3Q" : "G + Q"}.
              L’accumulation suit l’ordre affiché.
            </Notice>
          </Panel>
        )}
        {step === 4 && (
          <>
            <div className="metrics-grid">
              <Metric
                label="Effort à la base N_ELU"
                value={base.nElu}
                unit="kN"
                tone="purple"
              />
              <Metric
                label="Effort à la base N_ELS"
                value={base.nEls}
                unit="kN"
              />
              {wall ? (
                <Metric
                  label="Vent cumulé à l’ELU"
                  value={base.windElu}
                  unit="kN"
                  tone="teal"
                />
              ) : (
                <Metric
                  label="Section de base recommandée"
                  value={`${columnPredim(base.nElu, model.concrete, model.code).side} × ${columnPredim(base.nElu, model.concrete, model.code).side}`}
                  unit="cm"
                />
              )}
            </div>
            <div className="descent-graphs">
              <Panel
                title="Efforts cumulés par niveau"
                description="Valeurs calculées en kN"
              >
                <LoadEvolutionChart rows={rows} />
              </Panel>
              <Panel
                title="Coupe du support"
                description="Sections saisies dans le modèle"
              >
                <DescentProfile levels={model.levels} wall={wall} />
              </Panel>
            </div>
            <Panel
              title="Descente de charges cumulée"
              description="Chaque ligne porte son propre niveau et tous ceux placés au-dessus."
            >
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Niveau</th>
                      <th>G dalle · kN</th>
                      <th>G revêt. · kN</th>
                      <th>Q niveau · kN</th>
                      <th>G cumulé · kN</th>
                      <th>Q cumulé · kN</th>
                      <th>N_ELU · kN</th>
                      <th>N_ELS · kN</th>
                      <th>
                        {wall ? "e recommandée · cm" : "Côté recommandé · cm"}
                      </th>
                      {wall && <th>Vent ELU · kN</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <th scope="row">{r.label}</th>
                        {[r.gs, r.gr, r.ql, r.g, r.q, r.nElu, r.nEls].map(
                          (v, i) => (
                            <td key={i}>{fmt(v)}</td>
                          ),
                        )}
                        <td>
                          {wall
                            ? wallPredim(
                                r.nElu,
                                model.wallLength,
                                model.concrete,
                                model.code,
                              ).e
                            : columnPredim(r.nElu, model.concrete, model.code)
                                .side}
                        </td>
                        {wall && (
                          <td>
                            {fmt(r.windElu)}
                            {r.windDominant ? " · dominant" : ""}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
            {wall && (
              <Notice>
                Vent simplifié : qp(z) = max(0,45 ; 0,55 + 0,032z) kN/m², à
                mi-hauteur de chaque niveau. Le seuil « dominant » vaut 15 % de
                N_ELU. Les efforts de vent sont présentés séparément des charges
                verticales.
              </Notice>
            )}
            <Notice>
              Les sections affichées sont des prédimensionnements. Les
              contributions de poids propre des éléments verticaux et les
              vérifications de flambement, flexion composée et ferraillage ne
              sont pas incluses.
            </Notice>
          </>
        )}
      </div>
      <EditorSheet
        open={!!levelEditor}
        title="Paramètres du niveau"
        onOpenChange={(open) => {
          if (!open) setLevelEditor(null);
        }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = levelSchema.safeParse(levelEditor);
            if (!parsed.success) {
              toast.error(parsed.error.issues[0].message);
              return;
            }
            const level = parsed.data;
            patch({
              levels: model.levels.some((item) => item.id === level.id)
                ? model.levels.map((item) =>
                    item.id === level.id ? level : item,
                  )
                : [level, ...model.levels],
            });
            setLevelEditor(null);
          }}
        >
          <div className="editor-fields">
            {levelEditor && (
              <LevelEditor
                level={levelEditor}
                wall={wall}
                onChange={setLevelEditor}
              />
            )}
          </div>
          <EditorFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLevelEditor(null)}
            >
              Annuler
            </Button>
            <Button type="submit">Appliquer</Button>
          </EditorFooter>
        </form>
      </EditorSheet>
      <footer className="step-footer">
        <Button
          variant="outline"
          onClick={() => advance(Math.max(0, step - 1))}
          disabled={step === 0}
        >
          <ArrowLeft />
          Précédent
        </Button>
        <span>
          Étape {step + 1} sur {steps.length}
        </span>
        {step < 4 ? (
          <Button onClick={() => advance(step + 1)}>
            {step === 3 ? "Calculer les efforts" : "Suivant"}
            <ArrowRight />
          </Button>
        ) : (
          <Button variant="outline" onClick={() => setStep(0)}>
            Modifier les données
          </Button>
        )}
      </footer>
    </div>
  );
}
export function WindFields({
  value,
  onChange,
}: {
  value: { zone: string; region: string; terrain: string; direction: number };
  onChange: (
    v: Partial<{
      zone: string;
      region: string;
      terrain: string;
      direction: number;
    }>,
  ) => void;
}) {
  return (
    <Panel title="Contexte du vent">
      <FormGrid>
        <Choice
          label="Zone"
          value={value.zone}
          options={["I", "II", "III", "IV"]}
          onChange={(zone) => onChange({ zone })}
        />
        <Choice
          label="Région"
          value={value.region}
          options={["Intérieure", "Littorale"]}
          onChange={(region) => onChange({ region })}
        />
        <Choice
          label="Terrain"
          value={value.terrain}
          options={["0", "II", "IIIa", "IIIb", "IV"]}
          onChange={(terrain) => onChange({ terrain })}
        />
        <Choice
          label="Direction"
          value={String(value.direction)}
          options={[
            { value: "0", label: "X" },
            { value: "90", label: "Y" },
          ]}
          onChange={(v) => onChange({ direction: Number(v) })}
        />
      </FormGrid>
      <p className="hint">
        Ces informations décrivent le contexte. Le modèle de vent simplifié
        conservé du logiciel d’origine dépend uniquement de la hauteur.
      </p>
    </Panel>
  );
}
