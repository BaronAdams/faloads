import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Printer, BookmarkPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Panel,
  ProjectHeader,
  ProjectIcon,
  Numeric,
  Choice,
  FormGrid,
  Metric,
  Notice,
} from "@/components/common";
import {
  columnPredim,
  wallPredim,
  beamPredim,
  stairsPredim,
  balconyPredim,
  slabPredim,
  retainingPredim,
  footingPredim,
  concreteClasses,
  type SupportKind,
  type Code,
} from "@/domain/engineering";
import { typeInfo, type ProjectType } from "@/domain/projects";
import { useWorkspace } from "@/lib/workspace";
import { fmt, uid } from "@/lib/utils";
import { type Project } from "@/lib/storage";
export const predimSchema = z.object({
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
export function PredimPage({
  type,
  project,
}: {
  type: ProjectType;
  project?: Project;
}) {
  const { workspace, update, drafts } = useWorkspace(),
    key = project?.id ?? type;
  const [model, setModel] = useState<PredimModel>(() => {
      const p = predimSchema.safeParse(drafts.get(key) ?? project?.data);
      return p.success
        ? p.data
        : predimDefaults(
            type,
            workspace.preferences.code,
            workspace.preferences.concrete,
          );
    }),
    [name, setName] = useState(
      project?.name ?? `${typeInfo(type).label} — nouveau projet`,
    );
  useEffect(() => {
    drafts.set(key, model);
  }, [model, key, drafts]);
  const patch = (v: Partial<PredimModel>) => setModel({ ...model, ...v });
  const result = useMemo(() => {
    if (type === "column") {
      const r = columnPredim(model.n, model.concrete, model.code);
      return {
        big: `${r.side} × ${r.side}`,
        unit: "cm",
        formula: "N_ELU ≤ α × Ac × fcd",
        metrics: [["Aire minimale", r.area, "cm²"]],
        note: "Section carrée arrondie par pas de 5 cm ; côté minimal 20 cm.",
        section: { a: r.side, b: r.side },
      };
    }
    if (type === "wall") {
      const r = wallPredim(model.n, model.length, model.concrete, model.code);
      return {
        big: String(r.e),
        unit: "cm",
        formula: "Ac,min = N_ELU / (α × fcd) ; e = Ac,min / L",
        metrics: [["Aire minimale", r.area, "cm²"]],
        note: "Épaisseur arrondie par pas de 5 cm ; minimum 15 cm.",
        section: { a: r.e },
      };
    }
    if (type === "beam-size") {
      const r = beamPredim(model.length, model.q, model.support);
      return {
        big: `${r.b} × ${r.h}`,
        unit: "cm",
        formula: "h ≈ L/k ; b ≈ h/2 ; M = m × q_ELU × L²",
        metrics: [["Moment de prédimensionnement", r.moment, "kN·m"]],
        note: "Coefficients isostatique : k=12, m=1/8 ; continue : 16, 1/12 ; console : 6, 1/2.",
        section: { a: r.b, b: r.h },
      };
    }
    if (type === "stairs") {
      const r = stairsPredim(model.height, model.length);
      return {
        big: String(r.steps),
        unit: "marches",
        formula: "2h + g : 58 à 64 cm (Blondel)",
        metrics: [
          ["Hauteur de marche", r.riser, "cm"],
          ["Giron", r.tread, "cm"],
          ["Blondel", r.blondel, "cm"],
          ["Paillasse", r.e, "cm"],
        ],
        note:
          r.blondel >= 58 && r.blondel <= 64
            ? "La proportion de Blondel est respectée."
            : "Ajustez la longueur ou la hauteur pour respecter Blondel.",
        section: undefined,
      };
    }
    if (type === "balcony") {
      const r = balconyPredim(model.length, model.g, model.q);
      return {
        big: String(r.e),
        unit: "cm",
        formula: "e ≈ L/10 ; M_ELU = (1,35G + 1,5Q) × L²/2",
        metrics: [["Moment à l’encastrement", r.moment, "kN·m/ml"]],
        note: "Console : armatures principales en nappe supérieure. Épaisseur minimale 12 cm.",
        section: undefined,
      };
    }
    if (type === "slab") {
      const r = slabPredim(model.length, model.full);
      return {
        big: String(r.e),
        unit: "cm",
        formula: model.full
          ? "Dalle pleine : e ≈ L/25"
          : "Corps creux : abaque simplifié selon la portée",
        metrics: [],
        note: r.label,
        section: undefined,
      };
    }
    if (type === "retaining") {
      const r = retainingPredim(model.height, model.gamma, model.phi);
      return {
        big: String(r.width),
        unit: "cm de base",
        formula: "Ka = tan²(45° − φ/2) ; Pa = 0,5 × Ka × γ × H²",
        metrics: [
          ["Poussée active", r.thrust, "kN/ml"],
          ["Coefficient Ka", r.ka, ""],
          ["Épaisseur du voile", r.stem, "cm"],
        ],
        note: "Proportions indicatives B≈0,6H. Glissement, renversement et portance ne sont pas vérifiés ici.",
        section: undefined,
      };
    }
    const r = footingPredim(
      model.footing,
      model.n,
      model.soil,
      model.supportCm,
    );
    return {
      big:
        model.footing === "isolee"
          ? `${r.width} × ${r.width}`
          : String(r.width),
      unit: "cm",
      formula: "A = N_ELS / σ_sol ; d ≥ (B − support)/4",
      metrics: [
        ["Hauteur de semelle", r.depth, "cm"],
        [
          model.footing === "isolee" ? "Aire nécessaire" : "Largeur nécessaire",
          r.area,
          model.footing === "isolee" ? "m²" : "m",
        ],
      ],
      note: "Méthode des bielles ; dimensions arrondies au pas de 5 cm.",
      section: undefined,
    };
  }, [model, type]);
  return (
    <div className="project-page">
      <ProjectHeader
        type={type}
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
      <div className="two-columns">
        <Panel
          title="Données du projet"
          description="Unités indiquées à côté de chaque valeur."
        >
          <form className="form-stack" onSubmit={(e) => e.preventDefault()}>
            {(type === "column" || type === "wall" || type === "footing") && (
              <Numeric
                label={
                  type === "footing"
                    ? "Effort normal N_ELS"
                    : "Effort normal N_ELU"
                }
                value={model.n}
                unit={
                  type === "footing" && model.footing === "filante"
                    ? "kN/ml"
                    : "kN"
                }
                onChange={(n) => patch({ n })}
              />
            )}
            {(type === "column" || type === "wall") && (
              <>
                <Choice
                  label="Classe de béton"
                  value={model.concrete}
                  options={concreteClasses}
                  onChange={(concrete) =>
                    patch({ concrete: concrete as PredimModel["concrete"] })
                  }
                />
                <Choice
                  label="Règlement"
                  value={model.code}
                  options={[
                    { value: "ec2", label: "Eurocode 2" },
                    { value: "bael91", label: "BAEL 91" },
                  ]}
                  onChange={(code) => patch({ code: code as Code })}
                />
              </>
            )}
            {["wall", "beam-size", "stairs", "balcony", "slab"].includes(
              type,
            ) && (
              <Numeric
                label={
                  type === "stairs"
                    ? "Longueur projetée"
                    : type === "wall"
                      ? "Longueur du voile"
                      : "Portée L"
                }
                value={model.length}
                min={0.1}
                max={1000}
                unit="m"
                onChange={(length) => patch({ length })}
              />
            )}
            {type === "beam-size" && (
              <>
                <Numeric
                  label="Charge linéaire q_ELU"
                  value={model.q}
                  unit="kN/m"
                  onChange={(q) => patch({ q })}
                />
                <Choice
                  label="Schéma d’appui"
                  value={model.support}
                  options={[
                    { value: "isostatique", label: "Isostatique" },
                    { value: "continue_", label: "Continue" },
                    { value: "console", label: "Console" },
                  ]}
                  onChange={(support) =>
                    patch({ support: support as SupportKind })
                  }
                />
              </>
            )}
            {(type === "stairs" || type === "retaining") && (
              <Numeric
                label={
                  type === "stairs" ? "Hauteur à franchir" : "Hauteur retenue H"
                }
                value={model.height}
                min={0.1}
                max={1000}
                unit="m"
                onChange={(height) => patch({ height })}
              />
            )}
            {type === "stairs" && (
              <Numeric
                label="Largeur de l’escalier"
                value={model.width}
                min={0.1}
                unit="m"
                onChange={(width) => patch({ width })}
              />
            )}
            {type === "balcony" && (
              <FormGrid>
                <Numeric
                  label="Charge permanente G"
                  value={model.g}
                  unit="kN/m²"
                  onChange={(g) => patch({ g })}
                />
                <Numeric
                  label="Charge d’exploitation Q"
                  value={model.q}
                  unit="kN/m²"
                  onChange={(q) => patch({ q })}
                />
              </FormGrid>
            )}
            {type === "slab" && (
              <Label className="toggle">
                <Switch
                  checked={model.full}
                  onCheckedChange={(full) => patch({ full })}
                />
                Dalle pleine (sinon corps creux)
              </Label>
            )}
            {type === "retaining" && (
              <>
                <Numeric
                  label="Poids volumique du sol γ"
                  value={model.gamma}
                  min={0.1}
                  max={100}
                  unit="kN/m³"
                  onChange={(gamma) => patch({ gamma })}
                />
                <Numeric
                  label="Angle de frottement φ"
                  value={model.phi}
                  max={60}
                  unit="°"
                  onChange={(phi) => patch({ phi })}
                />
              </>
            )}
            {type === "footing" && (
              <>
                <Choice
                  label="Type de fondation"
                  value={model.footing}
                  options={[
                    { value: "isolee", label: "Semelle isolée" },
                    { value: "filante", label: "Semelle filante" },
                  ]}
                  onChange={(footing) =>
                    patch({ footing: footing as "isolee" | "filante" })
                  }
                />
                <Numeric
                  label="Contrainte admissible du sol"
                  value={model.soil}
                  min={0.1}
                  unit="kN/m²"
                  onChange={(soil) => patch({ soil })}
                />
                <Numeric
                  label="Dimension du support"
                  value={model.supportCm}
                  min={0.1}
                  unit="cm"
                  onChange={(supportCm) => patch({ supportCm })}
                />
              </>
            )}
          </form>
        </Panel>
        <div className="result-stack">
          <Panel className="predim-main">
            <div className="predim-illustration">
              <ProjectIcon type={type} size={128} />
              <span className="eyebrow">Estimation préliminaire</span>
            </div>
            <h2>
              {type === "column" || type === "beam-size"
                ? "Section recommandée"
                : type === "stairs"
                  ? "Nombre de marches"
                  : type === "wall" || type === "slab" || type === "balcony"
                    ? "Épaisseur recommandée"
                    : "Dimensions recommandées"}
            </h2>
            <div className="big-result">
              <strong className="mono" data-testid="predim-result">
                {result.big}
              </strong>
              <span>{result.unit}</span>
            </div>
            <p>{result.note}</p>
            <div className="formula mono">{result.formula}</div>
            {result.section && (
              <Button
                variant="outline"
                onClick={() => {
                  const invalid =
                    document.querySelector<HTMLInputElement>("input:invalid");
                  if (invalid) return invalid.reportValidity();
                  void update({
                    presets: [
                      ...workspace.presets,
                      {
                        id: uid(),
                        name: name || typeInfo(type).label,
                        category:
                          type === "beam-size"
                            ? "poutre"
                            : type === "wall"
                              ? "voile"
                              : "poteau",
                        ...result.section!,
                      },
                    ],
                  })
                    .then(() =>
                      toast.success("Section ajoutée aux préréglages."),
                    )
                    .catch(() => toast.error("Sauvegarde impossible."));
                }}
              >
                <BookmarkPlus />
                Conserver cette section
              </Button>
            )}
          </Panel>
          <div className="metrics-grid">
            {result.metrics.map(([label, value, unit]) => (
              <Metric
                key={label as string}
                label={label as string}
                value={value as number}
                unit={unit as string}
              />
            ))}
          </div>
          <Notice>
            Prédimensionnement indicatif selon les règles du logiciel d’origine.
            Le ferraillage et les vérifications réglementaires détaillées
            restent à effectuer.
          </Notice>
        </div>
      </div>
    </div>
  );
}
