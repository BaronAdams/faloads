import { useEffect, useState, useRef, useLayoutEffect } from "react";
import {
  Calculator,
  Settings,
  FileChartColumn,
  Ruler,
  Layers,
  ArrowDown,
  Component,
  SlidersHorizontal,
  Undo2,
  Redo2,
  Eye,
  Plus,
  X,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { RCScene, type RCView } from "@/components/rc/scene";
import { RCParameters, rcTabs, type RCTab } from "@/components/rc/parameters";
import { RCPlanExport } from "@/components/rc/plan-export";
import { RCResults } from "@/components/rc/results";
import { ProjectHeader, IconButton, Numeric } from "@/components/common";
import { RibbonGroup } from "@/components/project-ribbon";
import { Playground } from "@/components/playground";
import {
  CalculationOverlay,
  CalculationStatus,
} from "@/components/calculation-state";
import { EditorSheet, EditorFooter } from "@/components/editor-sheet";
import {
  DetailDialog,
  SectionTypes,
  ShortcutHelp,
  SceneMenu,
  useEditorKeys,
  type EditorActions,
  type MenuPoint,
} from "@/components/desktop-tools";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { runtime, useCompactViewport } from "@/lib/runtime";
import { useWorkspace } from "@/lib/workspace";
import { useDesktopCommands } from "@/lib/desktop-commands";
import { useRCCalculation } from "@/lib/use-rc-calculation";
import { studyAction } from "@/lib/study-events";
import {
  rcModelSchema,
  rcColumnDefaults,
  rcBeamDefaults,
  type RCModel,
} from "@/domain/rc/model";
import type { Project } from "@/lib/storage";
import { uid } from "@/lib/utils";
const tabIcons = {
  geometry: Ruler,
  materials: Layers,
  loads: ArrowDown,
  detailing: Component,
  analysis: SlidersHorizontal,
};
export function RCProjectPage({
  type,
  project,
}: {
  type: "column" | "beam-size";
  project?: Project;
}) {
  const { drafts } = useWorkspace(),
    compact = useCompactViewport(),
    mobileEditor = runtime === "mobile" || (runtime === "web" && compact),
    key = project?.id ?? type;
  const [model, setModel] = useState<RCModel>(() => {
    const p = rcModelSchema.safeParse(drafts.get(key) ?? project?.data);
    return p.success
      ? p.data
      : type === "column"
        ? rcColumnDefaults()
        : rcBeamDefaults();
  });
  const [name, setName] = useState(
      project?.name ?? (type === "column" ? "Poteau BA" : "Poutre BA"),
    ),
    [editor, setEditor] = useState<RCModel | null>(null),
    [tab, setTab] = useState<RCTab>("geometry"),
    [results, setResults] = useState(false),
    [view, setView] = useState<RCView>("structure"),
    [annotations, setAnnotations] = useState(true),
    [selected, setSelected] = useState<string[]>([]),
    [point, setPoint] = useState<MenuPoint>(null),
    [clipboard, setClipboard] = useState<{ family: string; value: any } | null>(
      null,
    ),
    [history, setHistory] = useState<RCModel[]>([]),
    [future, setFuture] = useState<RCModel[]>([]);
  const calculation = useRCCalculation(model),
    result = calculation.fresh ? calculation.result : undefined;
  useEffect(() => {
    drafts.set(key, model);
  }, [model, key, drafts]);
  const commit = (next: RCModel) => {
    if (JSON.stringify(next) === JSON.stringify(model)) return;
    setHistory((h) => [...h.slice(-39), model]);
    setFuture([]);
    setModel(next);
    studyAction("input:edited");
  };
  const undo = (redo = false) => {
    const from = redo ? future : history;
    if (!from.length) return;
    const next = from.at(-1)!;
    if (redo) {
      setFuture(from.slice(0, -1));
      setHistory((h) => [...h, model]);
    } else {
      setHistory(from.slice(0, -1));
      setFuture((f) => [...f, model]);
    }
    setModel(next);
  };
  const open = (next: RCTab = "geometry") => {
    setTab(next);
    setEditor(structuredClone(model));
    studyAction("parameters:open");
  };
  const closeEditor = () => {
    setEditor(null);
    studyAction("parameters:close");
  };
  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const p = rcModelSchema.safeParse(editor);
    if (!p.success) {
      toast.error(p.error.issues[0].message);
      return;
    }
    commit(p.data);
    closeEditor();
  };
  const showResults = (v: boolean) => {
    setResults(v);
    studyAction(v ? "results:open" : "results:close");
  };
  const run = async () => {
    if (await calculation.run()) setView("steel");
  };
  const display = (v: RCView) => {
    if (v !== "structure" && !calculation.fresh) {
      toast.info(
        "Lancez le calcul pour afficher le ferraillage et les diagrammes actualisés.",
      );
      return;
    }
    setView(v);
  };
  const select = (id: string, add = false) =>
    setSelected((old) =>
      add
        ? old.includes(id)
          ? old.filter((v) => v !== id)
          : [...old, id]
        : [id],
    );
  const first = selected[0],
    family = first?.split(":")[0],
    index = Number(first?.split(":")[1] ?? 0),
    span = model.kind === "rc-beam" ? model.spans[index] : undefined;
  const modifySelection = (values: Record<string, unknown>) => {
    if (model.kind !== "rc-beam") return;
    const next = structuredClone(model);
    for (const id of selected) {
      const [f, i] = id.split(":");
      if (f === family) {
        const obj =
          f === "span" ? next.spans[Number(i)] : next.supports[Number(i)];
        if (obj) Object.assign(obj, values);
      }
    }
    commit(next);
  };
  const addSpan = () => {
    if (model.kind !== "rc-beam" || model.spans.length >= 8) return;
    const next = structuredClone(model);
    next.spans.push({
      ...next.spans[
        family === "span"
          ? Math.min(index, next.spans.length - 1)
          : next.spans.length - 1
      ],
      id: uid(),
      name: `Travée ${next.spans.length + 1}`,
    });
    next.supports.push({
      id: uid(),
      width_m: 0.3,
      condition: next.supports.at(-1)!.condition,
    });
    next.supports[next.supports.length - 2].condition = "simple";
    commit(next);
    select(`span:${next.spans.length - 1}`);
  };
  const actions: EditorActions = {
    copy: () => {
      if (model.kind !== "rc-beam" || !first) return;
      setClipboard({
        family: family!,
        value: structuredClone(
          family === "span" ? model.spans[index] : model.supports[index],
        ),
      });
    },
    paste: () => {
      if (!clipboard || clipboard.family !== family) return;
      const { id, name, ...value } = clipboard.value;
      modifySelection(
        family === "support" ? { width_m: value.width_m } : value,
      );
    },
    remove: () => {
      if (model.kind !== "rc-beam" || family !== "span") return;
      const indices = selected
          .filter((v) => v.startsWith("span:"))
          .map((v) => Number(v.split(":")[1]))
          .sort((a, b) => b - a),
        next = structuredClone(model);
      for (const i of indices)
        if (next.spans.length > 1) {
          next.spans.splice(i, 1);
          next.supports.splice(i + 1, 1);
        }
      commit(next);
      setSelected([]);
    },
    all: () =>
      setSelected(
        model.kind === "rc-column"
          ? ["column"]
          : first
            ? Array.from(
                {
                  length:
                    family === "span"
                      ? model.spans.length
                      : model.supports.length,
                },
                (_, i) => `${family}:${i}`,
              )
            : [
                ...model.spans.map((_, i) => `span:${i}`),
                ...model.supports.map((_, i) => `support:${i}`),
              ],
      ),
    clear: () => setSelected([]),
    undo,
    add: () => (model.kind === "rc-beam" ? addSpan() : open("loads")),
    duplicate:
      model.kind === "rc-beam" && family === "span" ? addSpan : undefined,
    modify: () => open(family === "span" ? "loads" : "geometry"),
  };
  useEditorKeys(
    actions,
    !editor && !results && (runtime === "desktop" || !compact),
  );
  useDesktopCommands({
    "view:parameters": () => open(),
    "view:results": () => showResults(true),
    "study:calculate": () => void run(),
  });
  const parameterBody = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!editor) return;
    const reset = () => {
      let node: HTMLElement | null = parameterBody.current;
      while (node && node !== document.body) {
        node.scrollTop = 0;
        node = node.parentElement;
      }
    };
    reset();
    const frame = requestAnimationFrame(reset);
    return () => cancelAnimationFrame(frame);
  }, [tab, !!editor]);
  const parameterForm = editor && (
    <form onSubmit={apply} className="rc-parameter-form">
      <nav className="rc-form-tabs" aria-label="Paramètres béton armé">
        {rcTabs.map((t) => (
          <Button
            type="button"
            key={t.id}
            variant={tab === t.id ? "secondary" : "ghost"}
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </nav>
      <div
        key={tab}
        ref={parameterBody}
        className="rc-parameter-body"
        data-tour="parameters-inputs"
      >
        <RCParameters model={editor} onChange={setEditor} tab={tab} />
      </div>
      <div className="rc-form-footer" data-tour="parameters-done">
        <Button type="button" variant="outline" onClick={closeEditor}>
          Annuler
        </Button>
        <Button type="submit">Appliquer les paramètres</Button>
      </div>
    </form>
  );
  return (
    <div
      className="project-page analysis-page focused-analysis-page rc-page"
      data-testid="rc-project"
    >
      <ProjectHeader
        type={type}
        project={project}
        name={name}
        setName={setName}
        data={model}
        workbench
        hideBack
        flowActions
        tools={
          <>
            <IconButton
              label="Ouvrir les paramètres"
              data-tour="parameters"
              onClick={() => open()}
            >
              <Settings />
            </IconButton>
            <RCPlanExport model={model} result={result} name={name} />
            <div className="project-auxiliary-tools">
              <SectionTypes
                value={model.sectionTypes}
                onChange={(sectionTypes) => commit({ ...model, sectionTypes })}
              />
              <ShortcutHelp />
            </div>
          </>
        }
        toolbar={
          <>
            <RibbonGroup label="Édition">
              <IconButton
                label="Annuler"
                disabled={!history.length}
                onClick={() => undo()}
              >
                <Undo2 />
              </IconButton>
              <IconButton
                label="Rétablir"
                disabled={!future.length}
                onClick={() => undo(true)}
              >
                <Redo2 />
              </IconButton>
              {model.kind === "rc-beam" && (
                <IconButton
                  label="Ajouter une travée"
                  data-tour="add"
                  disabled={model.spans.length >= 8}
                  onClick={addSpan}
                >
                  <Plus />
                </IconButton>
              )}
            </RibbonGroup>
            <RibbonGroup
              label="Section"
              className="ribbon-parameters rc-ribbon-geometry"
            >
              {model.kind === "rc-column" ? (
                <>
                  <Numeric
                    compact
                    label="Largeur b"
                    shortLabel={model.section.type === "circ" ? "Ø" : "b"}
                    value={
                      model.section.type === "circ"
                        ? model.section.a_cm
                        : model.section.b_cm
                    }
                    unit="cm"
                    min={10}
                    max={300}
                    onChange={(v) =>
                      commit({
                        ...model,
                        section: {
                          ...model.section,
                          [model.section.type === "circ" ? "a_cm" : "b_cm"]: v,
                        },
                      })
                    }
                  />
                  <Numeric
                    compact
                    label="Hauteur du poteau"
                    shortLabel="l"
                    value={model.geometry.l_m}
                    unit="m"
                    min={0.3}
                    max={100}
                    onChange={(v) =>
                      commit({
                        ...model,
                        geometry: { ...model.geometry, l_m: v },
                      })
                    }
                  />
                </>
              ) : (
                <>
                  <Numeric
                    compact
                    label="Largeur de l’âme bw"
                    shortLabel="bw"
                    value={model.section.bw_cm}
                    unit="cm"
                    min={10}
                    max={200}
                    onChange={(v) =>
                      commit({
                        ...model,
                        section: { ...model.section, bw_cm: v },
                      })
                    }
                  />
                  <Numeric
                    compact
                    label="Hauteur totale h"
                    shortLabel="h"
                    value={model.section.h_cm}
                    unit="cm"
                    min={15}
                    max={300}
                    onChange={(v) =>
                      commit({
                        ...model,
                        section: { ...model.section, h_cm: v },
                      })
                    }
                  />
                </>
              )}
            </RibbonGroup>
            <RibbonGroup label="Définition">
              {rcTabs.slice(1).map((t) => {
                const Icon = tabIcons[t.id];
                return (
                  <IconButton
                    key={t.id}
                    label={t.label}
                    onClick={() => open(t.id)}
                  >
                    <Icon />
                  </IconButton>
                );
              })}
            </RibbonGroup>
            <RibbonGroup label="Vue">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <IconButton label="Options de vue">
                    <Eye />
                  </IconButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={() => display("structure")}>
                    Structure et actions
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => display("steel")}>
                    Ferraillage calculé
                  </DropdownMenuItem>
                  {model.kind === "rc-beam" && (
                    <>
                      <DropdownMenuItem onSelect={() => display("M")}>
                        Enveloppe des moments M
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => display("V")}>
                        Enveloppe des efforts tranchants V
                      </DropdownMenuItem>
                      {result?.redistributed_cases?.length > 0 && (
                        <DropdownMenuItem
                          onSelect={() => display("redistributed")}
                        >
                          Moments après redistribution
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onSelect={() => display("cutoff")}>
                        Épure d’arrêt des barres
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={annotations}
                    onCheckedChange={setAnnotations}
                  >
                    Annotations du dessin
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </RibbonGroup>
            <RibbonGroup label="Calcul">
              <IconButton
                label="Calculer le dimensionnement"
                data-tour="calculate"
                disabled={calculation.busy || !!editor}
                onClick={() => void run()}
              >
                <Calculator />
              </IconButton>
              <IconButton
                label="Ouvrir les résultats"
                data-tour="results"
                onClick={() => showResults(true)}
              >
                <FileChartColumn />
              </IconButton>
            </RibbonGroup>
          </>
        }
        trailingToolbar={
          selected.length > 0 ? (
            <RibbonGroup
              label={`Sélection · ${selected.length}`}
              className="ribbon-parameters selection-ribbon-group"
            >
              {model.kind === "rc-beam" &&
              selected.every((v) => v.startsWith("span:")) &&
              span ? (
                <>
                  <Numeric
                    compact
                    label="Portée de la sélection"
                    shortLabel="L"
                    value={span.ln_m}
                    unit="m"
                    min={0.2}
                    max={50}
                    onChange={(ln_m) => modifySelection({ ln_m })}
                  />
                  <Numeric
                    compact
                    label="Charge G de la sélection"
                    shortLabel="G"
                    value={span.g_kN_m}
                    unit="kN/m"
                    onChange={(g_kN_m) => modifySelection({ g_kN_m })}
                  />
                </>
              ) : (
                <span className="mixed-selection-note">
                  {model.kind === "rc-column"
                    ? "Poteau BA"
                    : selected.every((v) => v.startsWith("support:"))
                      ? "Appuis"
                      : "Sélection mixte"}
                </span>
              )}
              <IconButton
                label="Modifier la sélection"
                onClick={actions.modify}
              >
                <Pencil />
              </IconButton>
              <IconButton label="Désélectionner" onClick={actions.clear}>
                <X />
              </IconButton>
            </RibbonGroup>
          ) : undefined
        }
      />
      <SceneMenu
        point={point}
        onClose={() => setPoint(null)}
        actions={actions}
        canPaste={!!clipboard && clipboard.family === family}
        canDuplicate={
          model.kind === "rc-beam" &&
          family === "span" &&
          model.spans.length < 8
        }
      />
      <div
        className="analysis-canvas-workspace rc-workspace"
        aria-busy={calculation.busy}
      >
        <Playground
          immersive
          height={650}
          label={
            model.kind === "rc-column"
              ? "Poteau en béton armé — coupe et élévation"
              : "Poutre en béton armé — travées et ferraillage"
          }
          selectedKeys={selected}
          onSelect={select}
          onDeselect={() => setSelected([])}
          onElementContext={(id, p) => {
            select(id);
            setPoint(p);
          }}
          controls={
            <>
              <div className="rc-canvas-heading">
                <span>Dimensionnement béton armé</span>
                <strong>
                  {model.kind === "rc-column" ? "Poteau" : "Poutre"}{" "}
                  <small>EC2</small>
                </strong>
              </div>
              <div
                className="rc-view-controls"
                role="group"
                aria-label="Affichage du modèle"
              >
                <Button
                  size="sm"
                  aria-pressed={view === "structure"}
                  variant={view === "structure" ? "secondary" : "ghost"}
                  onClick={() => display("structure")}
                >
                  Structure
                </Button>
                <Button
                  size="sm"
                  aria-pressed={view === "steel"}
                  variant={view === "steel" ? "secondary" : "ghost"}
                  onClick={() => display("steel")}
                >
                  Armatures
                </Button>
                {model.kind === "rc-beam" && (
                  <>
                    <Button
                      size="sm"
                      aria-pressed={view === "M"}
                      variant={view === "M" ? "secondary" : "ghost"}
                      onClick={() => display("M")}
                    >
                      M
                    </Button>
                    <Button
                      size="sm"
                      aria-pressed={view === "V"}
                      variant={view === "V" ? "secondary" : "ghost"}
                      onClick={() => display("V")}
                    >
                      V
                    </Button>
                    {result?.redistributed_cases?.length > 0 && (
                      <Button
                        size="sm"
                        aria-pressed={view === "redistributed"}
                        variant={
                          view === "redistributed" ? "secondary" : "ghost"
                        }
                        onClick={() => display("redistributed")}
                      >
                        M redistrib.
                      </Button>
                    )}
                    <Button
                      size="sm"
                      aria-pressed={view === "cutoff"}
                      variant={view === "cutoff" ? "secondary" : "ghost"}
                      onClick={() => display("cutoff")}
                    >
                      Épure
                    </Button>
                  </>
                )}
              </div>
              <div className="rc-workspace-status">
                <CalculationStatus
                  fresh={calculation.fresh}
                  hasResult={!!calculation.result}
                />
                {!result && (
                  <button
                    onClick={() =>
                      open(model.kind === "rc-beam" ? "analysis" : "loads")
                    }
                  >
                    {model.kind === "rc-beam" &&
                    model.analysis.construction === "unspecified"
                      ? "Précisez la liaison aux appuis"
                      : "Vérifiez vos données, puis calculez"}
                  </button>
                )}
                {result && (
                  <span>
                    {result.checks.filter((c) => !c.ok).length
                      ? "Des contrôles demandent une correction"
                      : !result.scope_complete
                        ? "Vérifications complémentaires requises"
                        : "Contrôles calculés satisfaits"}
                  </span>
                )}
              </div>
            </>
          }
        >
          <RCScene
            model={model}
            result={result}
            view={result ? view : "structure"}
            selection={first ?? null}
            annotations={annotations}
          />
        </Playground>
        <CalculationOverlay
          busy={calculation.busy}
          description={calculation.phase}
        />
        {calculation.error && (
          <div className="rc-error" role="alert">
            <strong>Calcul impossible</strong>
            <p>{calculation.error}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => open("analysis")}
            >
              Vérifier les paramètres
            </Button>
          </div>
        )}
      </div>
      {mobileEditor ? (
        <EditorSheet
          open={!!editor}
          onOpenChange={(v) => {
            if (!v) closeEditor();
          }}
          title={`Paramètres — ${model.kind === "rc-column" ? "poteau" : "poutre"} BA`}
          description="Adaptez les données, puis appliquez pour relancer le dimensionnement."
          className="rc-parameter-sheet"
        >
          {parameterForm}
        </EditorSheet>
      ) : (
        <DetailDialog
          open={!!editor}
          onOpenChange={(v) => {
            if (!v) closeEditor();
          }}
          title={`Paramètres — ${model.kind === "rc-column" ? "poteau" : "poutre"} BA`}
          description="Les paramètres sont appliqués ensemble. Annuler conserve les données précédentes."
        >
          {parameterForm}
        </DetailDialog>
      )}
      <EditorSheet
        open={results}
        onOpenChange={showResults}
        title={`Résultats — ${model.kind === "rc-column" ? "poteau" : "poutre"} BA`}
        description="Sollicitations, armatures et contrôles du modèle courant."
        desktopSide="right"
        className="rc-results-sheet"
      >
        <div className="rc-result-body">
          {result ? (
            <RCResults
              model={model}
              result={result}
              onAlternative={(bars) => {
                if (model.kind !== "rc-column") return;
                const next = structuredClone(model);
                next.detailing.mode = "verify";
                next.detailing.bars = {
                  ...next.detailing.bars,
                  phi: bars.phi,
                  phi_i: bars.phi_i,
                  k: bars.k,
                  m: bars.m,
                };
                commit(next);
                showResults(false);
                toast.info(
                  "Alternative appliquée. Relancez le calcul pour la vérifier.",
                );
              }}
            />
          ) : (
            <div className="rc-empty-results">
              <FileChartColumn size={32} />
              <h3>
                {calculation.result
                  ? "Calcul non actualisé"
                  : "Dimensionnez votre élément"}
              </h3>
              <p>
                {calculation.result
                  ? "Les données ont changé. Relancez le calcul pour consulter les résultats correspondants."
                  : "Vérifiez la géométrie, les actions et la méthode, puis lancez le calcul."}
              </p>
              <Button
                onClick={() => {
                  showResults(false);
                  void run();
                }}
                disabled={calculation.busy}
              >
                <Calculator />
                Lancer le calcul
              </Button>
            </div>
          )}
        </div>
        <EditorFooter>
          <Button data-tour="results-done" onClick={() => showResults(false)}>
            Revenir au schéma
          </Button>
        </EditorFooter>
      </EditorSheet>
    </div>
  );
}
