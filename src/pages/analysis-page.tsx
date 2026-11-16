import { RibbonGroup } from "@/components/project-ribbon";
import { useDesktopCommands } from "@/lib/desktop-commands";
import { runtime } from "@/lib/runtime";
import {
  ParameterGroup,
  SceneMenu,
  DetailDialog,
  SectionTypes,
  ShortcutHelp,
  useEditorKeys,
  type MenuPoint,
  type EditorActions,
} from "@/components/desktop-tools";
import {
  analysisElements,
  analysisProperties,
  patchAnalysis,
  deleteAnalysis,
  type AnalysisSelection,
} from "@/domain/analysis-editing";
import {
  StructuralDiagram,
  type DiagramCurve,
} from "@/components/structural-diagram";
import { frameDisplacement } from "@/domain/diagram";
import { useCalculation } from "@/lib/use-calculation";
import {
  CalculationOverlay,
  CalculationStatus,
} from "@/components/calculation-state";
import { studyAction } from "@/lib/study-events";
import { useEffect, useState, useRef } from "react";
import {
  Plus,
  Trash2,
  Undo2,
  Redo2,
  MoveRight,
  ChevronRight,
  Calculator,
  SlidersHorizontal,
  ChartNoAxesCombined,
  ArrowDown,
  ArrowDownWideNarrow,
  RotateCw,
  CircleDot,
  RectangleHorizontal,
  Waypoints,
  Minus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { EditorSheet, EditorFooter } from "@/components/editor-sheet";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import {
  Panel,
  Choice,
  Numeric,
  FormGrid,
  Disclosure,
  Metric,
  Notice,
  ProjectHeader,
  IconButton,
} from "@/components/common";
import { QuickAnalysis } from "@/components/quick-analysis";
import {
  Playground,
  Arrow,
  Support,
  useCanvasGeometry,
} from "@/components/playground";
import {
  beamPreset,
  framePreset,
  beamSchema,
  frameSchema,
  resizeBeam,
  section,
  support,
  load,
  removeFrameNode,
  frameSupportNames,
  type AnalysisModel,
  type BeamModel,
  type FrameModel,
  type BeamResult,
  type FrameResult,
} from "@/domain/analysis";
import { useWorkspace } from "@/lib/workspace";
import { fmt, uid } from "@/lib/utils";
import { type Project } from "@/lib/storage";
type View = "M" | "V" | "N" | "v" | "theta" | "structure";
type Selection = AnalysisSelection;
const fieldNames = {
  M: "Moment M",
  V: "Effort tranchant V",
  N: "Effort normal N",
  v: "Déformée",
  theta: "Rotation",
  structure: "Structure",
};
const seriesColors = {
  M: "var(--plot-m)",
  V: "var(--plot-v)",
  N: "var(--plot-n)",
  v: "var(--plot-displacement)",
  theta: "var(--plot-rotation)",
};
const supportType = (s: BeamModel["supports"][number]) =>
  s.rz === true && s.ux === true && s.uy === true
    ? "fixed"
    : typeof s.uy === "number"
      ? "spring"
      : s.uy === true && s.rz === false && s.ux === true
        ? "pin"
        : s.uy === true && s.rz === false && s.ux === false
          ? "roller"
          : "custom";
export function AnalysisPage({
  kind,
  project,
}: {
  kind: "beam" | "frame";
  project?: Project;
}) {
  const desktop = runtime === "desktop";
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]),
    [menu, setMenu] = useState<MenuPoint>(null),
    [clipboard, setClipboard] = useState<{
      family: string;
      props: Record<string, unknown>;
    } | null>(null);
  const dragModel = useRef<AnalysisModel | null>(null);
  const ParametersContainer = desktop ? DetailDialog : EditorSheet;
  const { drafts } = useWorkspace(),
    draftKey = project?.id ?? kind;
  const [model, setModel] = useState<AnalysisModel>(() => {
      const data = drafts.get(draftKey) ?? project?.data;
      try {
        return (kind === "beam" ? beamSchema : frameSchema).parse(data);
      } catch {
        return kind === "beam" ? beamPreset() : framePreset();
      }
    }),
    [name, setName] = useState(
      project?.name ??
        (kind === "beam"
          ? "Poutre — nouveau projet"
          : "Cadre — nouveau projet"),
    );
  const [parameters, setParameters] = useState(false),
    [resultsOpen, setResultsOpen] = useState(false),
    [view, setView] = useState<View>("structure"),
    [selection, setSelection] = useState<Selection | null>(null),
    [editor, setEditor] = useState<AnalysisModel | null>(null),
    [history, setHistory] = useState<AnalysisModel[]>([]),
    [future, setFuture] = useState<AnalysisModel[]>([]),
    [reactions, setReactions] = useState(true),
    [amplification, setAmplification] = useState(100),
    [quick, setQuick] = useState(false),
    [requestedDisplay, setRequestedDisplay] = useState<
      View | "reactions" | null
    >(null);
  useEffect(() => {
    drafts.set(draftKey, model);
  }, [model, draftKey, drafts]);
  const calculation = useCalculation<{
    beam?: BeamResult;
    frame?: FrameResult;
  }>("analysis", model);
  const analysis = { ...calculation.result, error: calculation.error };
  const displayView = calculation.fresh ? view : "structure";
  useEffect(() => {
    if (calculation.fresh) setRequestedDisplay(null);
  }, [calculation.fresh]);
  const prompt =
    requestedDisplay === "reactions"
      ? "Lancez d’abord le calcul pour afficher les réactions d’appui du modèle courant."
      : requestedDisplay
        ? `Lancez d’abord le calcul pour afficher le diagramme « ${fieldNames[requestedDisplay]} » du modèle courant.`
        : "";
  const requestView = (next: View) => {
    if (next !== "structure" && !calculation.fresh) {
      setRequestedDisplay(next);
      return;
    }
    setRequestedDisplay(null);
    setView(next);
  };
  const requestReactions = (enabled: boolean) => {
    if (enabled && !calculation.fresh) {
      setRequestedDisplay("reactions");
      return;
    }
    setRequestedDisplay(null);
    setReactions(enabled);
    if (enabled) setView("structure");
  };
  const runCalculation = async (display?: View | "reactions") => {
    const invalid = document.querySelector<HTMLInputElement>("input:invalid");
    if (invalid) {
      invalid.reportValidity();
      return;
    }
    setRequestedDisplay(null);
    setParameters(false);
    if (await calculation.run()) {
      if (display === "reactions") {
        setReactions(true);
        setView("structure");
      } else if (display) setView(display);
    }
  };
  const closeParameters = (open: boolean) => {
    setParameters(open);
    studyAction(open ? "parameters:open" : "parameters:close");
  };
  const closeResults = (open: boolean) => {
    setResultsOpen(open);
    studyAction(open ? "results:open" : "results:close");
  };
  const commit = (next: AnalysisModel) => {
    try {
      (next.kind === "beam" ? beamSchema : frameSchema).parse(next);
      setHistory((h) => [...h.slice(-29), model]);
      setFuture([]);
      setModel(next);
    } catch (e) {
      toast.error(
        e instanceof z.ZodError
          ? e.issues[0].message
          : "Vérifiez les paramètres.",
      );
    }
  };
  const undo = (redo = false) => {
    const from = redo ? future : history;
    if (!from.length) return;
    const last = from[from.length - 1];
    if (redo) {
      setHistory((h) => [...h, model]);
      setFuture((f) => f.slice(0, -1));
    } else {
      setFuture((f) => [...f, model]);
      setHistory((h) => h.slice(0, -1));
    }
    setModel(last);
    setSelection(null);
    setSelectedKeys([]);
    setEditor(null);
  };
  const open = (s: Selection, candidate = model) => {
    setParameters(false);
    setSelection(s);
    if (desktop) {
      if (candidate !== model) commit(candidate);
      setSelectedKeys([`${s.type}:${s.id}`]);
      setEditor(null);
      studyAction("element:applied");
    } else setEditor(structuredClone(candidate));
  };
  const select = (key: string, additive = false) => {
    const [type, id] = key.split(":");
    if (!desktop) return open({ type: type as Selection["type"], id });
    const elements = analysisElements(model),
      family = elements.find((v) => v.key === key)?.family;
    const compatible = selectedKeys.filter(
      (k) => elements.find((v) => v.key === k)?.family === family,
    );
    const keys = additive
      ? compatible.includes(key)
        ? compatible.filter((k) => k !== key)
        : [...compatible, key]
      : [key];
    setSelectedKeys(keys);
    const last = keys.at(-1)?.split(":");
    setSelection(
      last ? { type: last[0] as Selection["type"], id: last[1] } : null,
    );
  };
  const add = (type: Selection["type"], variant = "point") => {
    const next = structuredClone(model);
    const id = uid();
    if (next.kind === "beam") {
      if (type === "support")
        next.supports.push({ ...support(next.L / 2, "roller"), id });
      if (type === "load")
        next.loads.push({
          ...load(variant as "point" | "dist" | "moment", next.L),
          id,
        });
      if (type === "hinge") next.hinges.push({ id, x: next.L / 2 });
      if (type === "section") {
        const last = next.sections[next.sections.length - 1],
          mid = (last.x1 + last.x2) / 2;
        last.x2 = mid;
        next.sections.push({ ...section(mid, next.L, last.b, last.h), id });
      }
    } else {
      if (type === "node") next.nodes.push({ id, x: 3, y: 4, s: 0 });
      if (type === "member")
        next.mem.push({ id, a: 1, b: 2, bw: 30, h: 50, w: 10, q: 0 });
      if (type === "nodal") next.nl.push({ id, n: 2, fx: 10, fy: 0, m: 0 });
      if (type === "member-load")
        next.pl.push({ id, member: next.mem[0].id, t: 0.5, fx: 0, fy: -20 });
    }
    open({ type, id }, next);
  };
  const elements = analysisElements(model);
  const selectedElement = selection
    ? elements.find((v) => v.key === `${selection.type}:${selection.id}`)
    : undefined;
  const clear = () => {
    setSelection(null);
    setSelectedKeys([]);
    setMenu(null);
  };
  const applyDesktop = (next: AnalysisModel) => {
    if (!selectedElement || selectedKeys.length <= 1) return commit(next);
    const changed = analysisElements(next).find(
      (v) => v.key === selectedElement.key,
    );
    if (!changed) return;
    const delta = Object.fromEntries(
      Object.entries(analysisProperties(selection!.type, changed.value)).filter(
        ([k, v]) =>
          JSON.stringify(v) !== JSON.stringify(selectedElement.value[k]),
      ),
    );
    commit(patchAnalysis(model, selectedKeys, delta));
  };
  const actions: EditorActions = {
    copy: () => {
      if (selectedElement) {
        setClipboard({
          family: selectedElement.family,
          props: analysisProperties(selection!.type, selectedElement.value),
        });
        toast.success("Propriétés copiées.");
      }
    },
    paste: () => {
      if (clipboard && selectedElement?.family === clipboard.family)
        commit(patchAnalysis(model, selectedKeys, clipboard.props));
      else toast.info("Sélectionnez un élément de même nature.");
    },
    remove: () => {
      if (!selectedKeys.length) return;
      try {
        const next = deleteAnalysis(model, selectedKeys);
        (next.kind === "beam" ? beamSchema : frameSchema).parse(next);
        commit(next);
        clear();
      } catch (e) {
        toast.error(
          e instanceof z.ZodError ? e.issues[0].message : (e as Error).message,
        );
      }
    },
    all: () => {
      if (selectedElement)
        setSelectedKeys(
          elements
            .filter((v) => v.family === selectedElement.family)
            .map((v) => v.key),
        );
    },
    clear,
    undo,
    add: () =>
      document.querySelector<HTMLButtonElement>('[data-tour="add"]')?.click(),
  };
  useEditorKeys(actions);
  const dragElement = (
    key: string,
    delta: { x: number; y: number },
    phase: "start" | "move" | "end" | "cancel",
  ) => {
    if (phase === "start") {
      const type = key.split(":")[0];
      if (
        !(model.kind === "beam"
          ? ["support", "load", "hinge"].includes(type)
          : type === "member-load")
      )
        return false;
      dragModel.current = structuredClone(model);
      setMenu(null);
      return true;
    }
    if (phase === "cancel") {
      if (dragModel.current) setModel(dragModel.current);
      dragModel.current = null;
      return;
    }
    const initial = dragModel.current;
    if (!initial) return;
    const next = structuredClone(initial),
      [type, id] = key.split(":");
    const canvas = document.querySelector<HTMLElement>(
      ".analysis-canvas-workspace .playground",
    );
    const units = Number(canvas?.dataset.canvasUnits ?? 1),
      height = Number(canvas?.dataset.canvasHeight ?? 600);
    if (next.kind === "beam" && ["support", "load", "hinge"].includes(type)) {
      const element = analysisElements(next).find((v) => v.key === key)?.value;
      if (!element) return;
      const dx = (delta.x * next.L) / 840;
      if (type === "load" && element.type === "dist") {
        const length = Number(element.x2) - Number(element.x1);
        const x = Math.max(
          0,
          Math.min(next.L - length, Number(element.x1) + dx),
        );
        element.x1 = x;
        element.x2 = x + length;
      } else
        element.x =
          Math.round(
            Math.max(
              type === "hinge" ? 0.001 : 0,
              Math.min(
                next.L - (type === "hinge" ? 0.001 : 0),
                Number(element.x) + dx,
              ),
            ) * 1000,
          ) / 1000;
    } else if (next.kind === "frame" && type === "member-load") {
      const l = next.pl.find((v) => v.id === id)!;
      const m = next.mem.find((v) => v.id === l.member)!;
      const a = next.nodes[m.a - 1],
        b = next.nodes[m.b - 1];
      const minX = Math.min(...next.nodes.map((v) => v.x)),
        maxX = Math.max(...next.nodes.map((v) => v.x)),
        minY = Math.min(...next.nodes.map((v) => v.y)),
        maxY = Math.max(...next.nodes.map((v) => v.y));
      const scale = Math.min(
        Math.max(100, Math.min(760, 1000 - 170 * units)) /
          Math.max(1, maxX - minX),
        Math.max(60, height - 350 * units) / Math.max(1, maxY - minY),
      );
      const dx = b.x - a.x,
        dy = b.y - a.y;
      l.t = Math.max(
        0,
        Math.min(
          1,
          l.t + (delta.x * dx - delta.y * dy) / (scale * (dx * dx + dy * dy)),
        ),
      );
    } else return;
    if (phase === "end") {
      setHistory((h) => [...h.slice(-29), initial]);
      setFuture([]);
      setModel(next);
      dragModel.current = null;
      setSelection({ type: type as Selection["type"], id });
      setSelectedKeys([key]);
      setEditor(null);
    } else setModel(next);
  };
  const remove = () => {
    if (!editor || !selection) return;
    const next = structuredClone(editor),
      id = selection.id;
    if (next.kind === "beam") {
      if (selection.type === "support")
        next.supports = next.supports.filter((s) => s.id !== id);
      if (selection.type === "load")
        next.loads = next.loads.filter((l) => l.id !== id);
      if (selection.type === "hinge")
        next.hinges = next.hinges.filter((l) => l.id !== id);
      if (selection.type === "section") {
        const i = next.sections.findIndex((s) => s.id === id);
        if (next.sections.length === 1)
          return toast.error("Conservez au moins un tronçon.");
        const old = next.sections[i];
        if (i > 0) next.sections[i - 1].x2 = old.x2;
        else next.sections[1].x1 = old.x1;
        next.sections.splice(i, 1);
      }
      commit(next);
    } else {
      if (selection.type === "node") {
        const i = next.nodes.findIndex((n) => n.id === id);
        commit(removeFrameNode(next, i));
      } else {
        if (selection.type === "member")
          next.mem = next.mem.filter((m) => m.id !== id);
        if (selection.type === "nodal")
          next.nl = next.nl.filter((m) => m.id !== id);
        next.pl = next.pl.filter(
          (l) => l.id !== id && next.mem.some((m) => m.id === l.member),
        );
        commit(next);
      }
    }
    setEditor(null);
    setSelection(null);
  };
  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editor) return;
    try {
      (editor.kind === "beam" ? beamSchema : frameSchema).parse(editor);
      commit(editor);
      setEditor(null);
      studyAction("element:applied");
    } catch (e) {
      toast.error(
        e instanceof z.ZodError
          ? e.issues[0].message
          : "Vérifiez les paramètres.",
      );
    }
  };
  const addMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label="Ajouter" data-tour="add">
          <Plus />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {kind === "beam" ? (
          <>
            <DropdownMenuItem onSelect={() => add("support")}>
              <Waypoints size={16} /> Appui
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => add("load", "point")}>
              <ArrowDown size={16} /> Force ponctuelle
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => add("load", "dist")}>
              <ArrowDownWideNarrow size={16} /> Charge répartie
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => add("load", "moment")}>
              <RotateCw size={16} /> Moment
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => add("section")}>
              <RectangleHorizontal size={16} /> Tronçon de section
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => add("hinge")}>
              <CircleDot size={16} /> Rotule
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem onSelect={() => add("node")}>
              <CircleDot size={16} /> Nœud
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => add("member")}>
              <Minus size={16} /> Barre
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => add("member-load")}>
              <ArrowDown size={16} />
              Force sur une barre
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => add("nodal")}>
              <ArrowDown size={16} /> Charge nodale
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
  useDesktopCommands({
    "view:parameters": () => closeParameters(true),
    "view:results": () => closeResults(true),
    "study:calculate": () => void calculation.run(),
    "help:shortcuts": () =>
      document
        .querySelector<HTMLButtonElement>(
          '[aria-label="Raccourcis clavier et souris"]',
        )
        ?.click(),
  });
  const parameterToolbar = desktop ? (
    <div className="desktop-parameter-bar" data-tour="parameters-inputs">
      {selectedElement && selection ? (
        <ElementEditor
          key={selectedElement.key}
          model={model}
          selection={selection}
          onChange={applyDesktop}
          multiple={selectedKeys.length > 1}
        />
      ) : (
        <>
          {model.kind === "beam" && (
            <Numeric
              label="Longueur L"
              value={model.L}
              min={0.1}
              max={1000}
              unit="m"
              onChange={(L) => commit(resizeBeam(model, L))}
            />
          )}
          <Numeric
            label="Module E"
            value={model.kind === "beam" ? model.material.E / 1000 : model.E}
            min={0.001}
            max={10000}
            unit="GPa"
            onChange={(E) =>
              commit(
                model.kind === "beam"
                  ? {
                      ...model,
                      material: { ...model.material, E: E * 1000 },
                    }
                  : { ...model, E },
              )
            }
          />
        </>
      )}
      {selectedElement && ["section", "member"].includes(selection!.type) && (
        <Choice
          label="Dimension type"
          value="custom"
          options={[
            { value: "custom", label: "Choisir une section" },
            ...model.sectionTypes
              .filter((t) => t.kind === "beam" || t.kind === "column")
              .map((t) => ({ value: t.id, label: t.name })),
          ]}
          onChange={(id) => {
            const t = model.sectionTypes.find((t) => t.id === id);
            if (t)
              commit(
                patchAnalysis(
                  model,
                  selectedKeys,
                  model.kind === "beam"
                    ? {
                        shape: "rect",
                        b: t.b / 100,
                        h: t.h / 100,
                        A: (t.b * t.h) / 1e4,
                        I: (t.b * t.h ** 3) / 12 / 1e8,
                        As: (model.kappa * t.b * t.h) / 1e4,
                      }
                    : { bw: t.b, h: t.h },
                ),
              );
          }}
        />
      )}
      {selectedElement && (
        <IconButton label="Désélectionner" onClick={clear}>
          <X />
        </IconButton>
      )}
    </div>
  ) : undefined;
  const calculationTools = (
    <RibbonGroup label="Calcul">
      <IconButton
        variant="default"
        label="Calculer"
        data-tour="calculate"
        disabled={calculation.busy}
        onClick={() => void runCalculation()}
      >
        <Calculator />
      </IconButton>
      <IconButton
        label="Ouvrir les résultats"
        data-tour="results"
        onClick={() => closeResults(true)}
      >
        <ChartNoAxesCombined />
      </IconButton>
    </RibbonGroup>
  );
  const headerTools = (
    <>
      <IconButton
        label="Ouvrir les paramètres"
        data-tour="parameters"
        onClick={() => closeParameters(true)}
      >
        <SlidersHorizontal />
      </IconButton>
      <div className="project-auxiliary-tools">
        <SectionTypes
          value={model.sectionTypes}
          onChange={(sectionTypes) => commit({ ...model, sectionTypes })}
        />
        <ShortcutHelp />
      </div>
    </>
  );
  return (
    <div className="project-page analysis-page">
      <ProjectHeader
        type={kind}
        project={project}
        data={model}
        name={name}
        setName={setName}
        workbench
        toolbar={
          <>
            {!desktop && calculationTools}
            <RibbonGroup label="Édition">
              {addMenu}
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
            </RibbonGroup>
            {parameterToolbar && (
              <RibbonGroup
                label={
                  selectedElement
                    ? `Sélection · ${selectedKeys.length}`
                    : "Modèle"
                }
                className="ribbon-parameters"
              >
                {parameterToolbar}
              </RibbonGroup>
            )}
            <RibbonGroup label="Diagrammes" className="ribbon-diagrams">
              {(["structure", "M", "V", "N", "v", "theta"] as View[]).map(
                (v) => (
                  <IconButton
                    key={v}
                    label={fieldNames[v]}
                    data-requires-calculation={
                      v !== "structure" && !calculation.fresh ? true : undefined
                    }
                    variant={displayView === v ? "secondary" : "ghost"}
                    onClick={() => requestView(v)}
                    aria-pressed={displayView === v}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="diagram-icon"
                      style={{
                        color: v === "structure" ? undefined : seriesColors[v],
                      }}
                    >
                      <path
                        d="M3 19H21"
                        stroke="currentColor"
                        fill="none"
                        strokeWidth="1.5"
                      />
                      <path
                        d={
                          v === "structure"
                            ? "M3 10H21M5 10V16M19 10V16"
                            : v === "M"
                              ? "M3 17Q12 0 21 17"
                              : v === "V"
                                ? "M3 6H12V16H21"
                                : v === "N"
                                  ? "M3 8H21V17H3Z"
                                  : v === "v"
                                    ? "M3 9Q12 24 21 9"
                                    : "M3 16C8 2 16 22 21 6"
                        }
                        stroke="currentColor"
                        fill="none"
                        strokeWidth="2"
                      />
                    </svg>
                  </IconButton>
                ),
              )}
              <Toggle
                label="Afficher les réactions"
                checked={reactions && calculation.fresh}
                onChange={requestReactions}
              />
            </RibbonGroup>
            {desktop && calculationTools}
          </>
        }
        tools={headerTools}
        extra={
          <IconButton
            label="Calcul simplifié G/Q"
            onClick={() => setQuick(true)}
          >
            <Calculator />
          </IconButton>
        }
      />
      <SceneMenu
        point={menu}
        onClose={() => setMenu(null)}
        actions={actions}
        canPaste={!!clipboard && clipboard.family === selectedElement?.family}
      />
      <QuickAnalysis kind={kind} open={quick} onOpenChange={setQuick} />
      <div className="analysis-canvas-workspace" aria-busy={calculation.busy}>
        <Playground
          immersive
          height={600}
          onSelect={displayView === "structure" ? select : undefined}
          selected={
            displayView === "structure" && selection
              ? `${selection.type}:${selection.id}`
              : null
          }
          selectedKeys={
            desktop && displayView === "structure" ? selectedKeys : undefined
          }
          onElementContext={
            desktop && displayView === "structure"
              ? (key, point) => {
                  if (!selectedKeys.includes(key)) select(key);
                  setMenu(point);
                }
              : undefined
          }
          onElementDrag={displayView === "structure" ? dragElement : undefined}
          onDeselect={clear}
          controls={
            <>
              <div className="canvas-result-status">
                <CalculationStatus
                  fresh={calculation.fresh}
                  hasResult={!!calculation.result}
                />
              </div>
              {requestedDisplay && !parameters && (
                <div className="canvas-error calculation-request" role="alert">
                  <Notice>
                    <strong>Calcul nécessaire</strong>
                    <p>{prompt}</p>
                    <div className="calculation-request-actions">
                      <Button
                        size="sm"
                        disabled={calculation.busy}
                        onClick={() => void runCalculation(requestedDisplay)}
                      >
                        Calculer maintenant
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRequestedDisplay(null)}
                      >
                        Fermer
                      </Button>
                    </div>
                  </Notice>
                </div>
              )}
              {calculation.error && !requestedDisplay && (
                <div className="canvas-error">
                  <Notice danger>{calculation.error}</Notice>
                </div>
              )}
              {calculation.fresh && view === "v" && model.kind === "frame" && (
                <div className="canvas-amplification">
                  <Label>Amplification</Label>
                  <Slider
                    value={[amplification]}
                    onValueChange={(v) => setAmplification(v[0])}
                    min={1}
                    max={1000}
                  />
                  <span className="mono">×{amplification}</span>
                </div>
              )}
            </>
          }
        >
          {model.kind === "beam" ? (
            <BeamScene
              model={model}
              result={calculation.fresh ? analysis.beam : undefined}
              reactions={reactions}
              view={displayView}
            />
          ) : (
            <FrameScene
              model={model}
              result={calculation.fresh ? analysis.frame : undefined}
              reactions={reactions}
              view={displayView}
              amplification={amplification}
            />
          )}
        </Playground>
        <CalculationOverlay busy={calculation.busy} />
      </div>
      <ParametersContainer
        open={parameters}
        onOpenChange={closeParameters}
        title="Paramètres du modèle"
        description="Définissez la géométrie, les appuis et les charges. Relancez le calcul après vos modifications."
      >
        <div className="parameters-sheet-content" data-tour="parameters-inputs">
          <Choice
            label="Modèle prédéfini"
            value="current"
            onChange={(v) => {
              if (v !== "current") {
                clear();
                commit({
                  ...(kind === "beam" ? beamPreset(v) : framePreset(v)),
                  sectionTypes: model.sectionTypes,
                });
              }
            }}
            options={
              kind === "beam"
                ? [
                    { value: "current", label: "Modèle en cours" },
                    { value: "iso", label: "Poutre isostatique" },
                    { value: "continuous", label: "Deux travées" },
                    { value: "cantilever", label: "Console" },
                    { value: "gerber", label: "Poutre Gerber" },
                    { value: "blank", label: "Sans charge" },
                  ]
                : [
                    { value: "current", label: "Modèle en cours" },
                    { value: "portal", label: "Portique simple" },
                    { value: "two-storeys", label: "Portique à deux niveaux" },
                  ]
            }
          />
          <h2 className="section-caption">Paramètres du modèle</h2>
          {model.kind === "beam" ? (
            <>
              <Panel title="Géométrie">
                <Numeric
                  label="Longueur L"
                  value={model.L}
                  min={0.1}
                  max={1000}
                  unit="m"
                  onChange={(L) => commit(resizeBeam(model, L))}
                />
              </Panel>
              <Panel title="Matériau et section">
                <Numeric
                  label="Module E"
                  value={model.material.E / 1000}
                  min={0.001}
                  max={10000}
                  unit="GPa"
                  onChange={(E) =>
                    commit({
                      ...model,
                      material: { ...model.material, E: E * 1000 },
                    })
                  }
                />
                {model.sections.map((s, i) => (
                  <ElementRow
                    key={s.id}
                    label={`Tronçon S${i + 1}`}
                    detail={`${fmt(s.x1)} → ${fmt(s.x2)} m · ${fmt(s.b * 100, 0)} × ${fmt(s.h * 100, 0)} cm`}
                    onClick={() => open({ type: "section", id: s.id })}
                  />
                ))}
                <Button variant="ghost" onClick={() => add("section")}>
                  <Plus />
                  Ajouter un tronçon
                </Button>
              </Panel>
              <Panel>
                <Disclosure
                  title={`Appuis · ${model.supports.length}`}
                  defaultOpen
                >
                  {model.supports.map((s, i) => (
                    <ElementRow
                      key={s.id}
                      label={`Appui ${String.fromCharCode(65 + i)}`}
                      detail={`${fmt(s.x)} m · ${{ pin: "Articulé", roller: "Simple", fixed: "Encastrement", spring: "Ressort", custom: "Personnalisé" }[supportType(s)]}`}
                      onClick={() => open({ type: "support", id: s.id })}
                    />
                  ))}
                  <Button variant="ghost" onClick={() => add("support")}>
                    <Plus />
                    Ajouter un appui
                  </Button>
                </Disclosure>
              </Panel>
              <Panel>
                <Disclosure
                  title={`Charges · ${model.loads.length}`}
                  defaultOpen
                >
                  {model.loads.map((l, i) => (
                    <ElementRow
                      key={l.id}
                      label={`${l.type === "dist" ? "Charge répartie q" : l.type === "moment" ? "Moment M" : "Force F"}${i + 1}`}
                      detail={
                        l.type === "dist"
                          ? `${fmt(l.q1)} → ${fmt(l.q2)} kN/m`
                          : `${fmt(l.type === "point" ? l.Fy : l.M)} ${l.type === "moment" ? "kN·m" : "kN"} · x ${fmt(l.x)} m`
                      }
                      onClick={() => open({ type: "load", id: l.id })}
                    />
                  ))}
                  <Button variant="ghost" onClick={() => add("load", "point")}>
                    <Plus />
                    Ajouter une charge
                  </Button>
                </Disclosure>
              </Panel>
              <Panel>
                <Disclosure title="Options avancées">
                  <Numeric
                    label="Coefficient de Poisson ν"
                    value={model.material.nu}
                    min={-0.9}
                    max={0.49}
                    onChange={(nu) =>
                      commit({ ...model, material: { ...model.material, nu } })
                    }
                  />
                  <Numeric
                    label="Coefficient κ"
                    value={model.kappa}
                    min={0.01}
                    max={1}
                    onChange={(kappa) => commit({ ...model, kappa })}
                  />
                  <Toggle
                    label="Déformation de cisaillement (Timoshenko)"
                    checked={model.timoshenko}
                    onChange={(timoshenko) => commit({ ...model, timoshenko })}
                  />
                  <Toggle
                    label="Inclure le poids propre"
                    checked={model.selfWeight.enabled}
                    onChange={(enabled) =>
                      commit({
                        ...model,
                        selfWeight: { ...model.selfWeight, enabled },
                      })
                    }
                  />
                  {model.selfWeight.enabled && (
                    <Numeric
                      label="Poids volumique"
                      value={model.selfWeight.gamma}
                      unit="kN/m³"
                      onChange={(gamma) =>
                        commit({
                          ...model,
                          selfWeight: { ...model.selfWeight, gamma },
                        })
                      }
                    />
                  )}
                  <p className="hint">
                    La géométrie des appuis et charges suit proportionnellement
                    un changement de longueur.
                  </p>
                  {model.hinges.map((h, i) => (
                    <ElementRow
                      key={h.id}
                      label={`Rotule ${i + 1}`}
                      detail={`${fmt(h.x)} m`}
                      onClick={() => open({ type: "hinge", id: h.id })}
                    />
                  ))}
                  <Button variant="ghost" onClick={() => add("hinge")}>
                    <Plus />
                    Ajouter une rotule
                  </Button>
                </Disclosure>
              </Panel>
            </>
          ) : (
            <>
              <Panel title="Matériau">
                <Numeric
                  label="Module E"
                  value={model.E}
                  min={0.001}
                  unit="GPa"
                  onChange={(E) => commit({ ...model, E })}
                />
                <p className="hint">
                  Élasticité linéaire · éléments de portique plan
                  Euler–Bernoulli.
                </p>
              </Panel>
              <Panel title={`Nœuds · ${model.nodes.length}`}>
                {model.nodes.map((n, i) => (
                  <ElementRow
                    key={n.id}
                    label={`N${i + 1} · ${frameSupportNames[n.s]}`}
                    detail={`x ${fmt(n.x)} · y ${fmt(n.y)} m`}
                    onClick={() => open({ type: "node", id: n.id })}
                  />
                ))}
                <Button variant="ghost" onClick={() => add("node")}>
                  <Plus />
                  Ajouter un nœud
                </Button>
              </Panel>
              <Panel title={`Barres · ${model.mem.length}`}>
                {model.mem.map((m, i) => (
                  <ElementRow
                    key={m.id}
                    label={`B${i + 1} · N${m.a} → N${m.b}`}
                    detail={`${fmt(m.bw, 0)} × ${fmt(m.h, 0)} cm · ${fmt(m.w)} kN/m`}
                    onClick={() => {
                      open({ type: "member", id: m.id });
                    }}
                  />
                ))}
                <Button variant="ghost" onClick={() => add("member")}>
                  <Plus />
                  Ajouter une barre
                </Button>
              </Panel>
              <Panel>
                <Disclosure
                  title={`Charges nodales · ${model.nl.length}`}
                  defaultOpen
                >
                  {model.nl.map((l, i) => (
                    <ElementRow
                      key={l.id}
                      label={`Charge ${i + 1} · N${l.n}`}
                      detail={`Fx ${fmt(l.fx)} · Fy ${fmt(l.fy)} kN`}
                      onClick={() => open({ type: "nodal", id: l.id })}
                    />
                  ))}
                  <Button variant="ghost" onClick={() => add("nodal")}>
                    <Plus />
                    Ajouter une charge
                  </Button>
                </Disclosure>
              </Panel>
            </>
          )}
          <Notice>
            Modèle élastique linéaire. Les charges sont utilisées telles que
            saisies. Le calcul simplifié G/Q est accessible dans la barre
            supérieure. Aucune vérification complète du béton armé n’est
            effectuée.
          </Notice>

          {requestedDisplay && (
            <div role="alert" className="sheet-calculation-request">
              <Notice>
                <strong>Calcul nécessaire</strong>
                <p>{prompt}</p>
                <Button
                  size="sm"
                  onClick={() => void runCalculation(requestedDisplay)}
                >
                  Calculer maintenant
                </Button>
              </Notice>
            </div>
          )}
          <Toggle
            label="Afficher les réactions"
            checked={reactions && calculation.fresh}
            onChange={requestReactions}
          />
          <p className="reaction-display-note">
            Les réactions s’affichent en vue Structure après un calcul à jour.
            Elles sont masquées dans les vues de diagrammes.
          </p>
        </div>
        <EditorFooter>
          <Button
            data-tour="parameters-done"
            onClick={() => closeParameters(false)}
          >
            Revenir au schéma
            <X />
          </Button>
        </EditorFooter>
      </ParametersContainer>
      <EditorSheet
        open={resultsOpen}
        onOpenChange={closeResults}
        desktopSide="right"
        title="Résultats de l’analyse"
        description="Valeurs chiffrées. Choisissez les diagrammes directement sur le schéma."
      >
        <div className="numerical-results">
          <CalculationStatus
            fresh={calculation.fresh}
            hasResult={!!calculation.result}
          />
          {calculation.fresh ? (
            <>
              <div className="metrics-grid">
                {model.kind === "beam" ? (
                  <>
                    <Metric
                      label="Moment maximal |M|"
                      value={Math.max(
                        Math.abs(analysis.beam!.extrema.M.max.val),
                        Math.abs(analysis.beam!.extrema.M.min.val),
                      )}
                      unit="kN·m"
                      tone="purple"
                    />
                    <Metric
                      label="Flèche maximale |v|"
                      value={
                        analysis.beam!.caracteristiques.fleche_max_abs * 1000
                      }
                      unit="mm"
                    />
                    <Metric
                      label="Fermeture statique"
                      value={
                        Math.max(
                          ...Object.values(
                            analysis.beam!.caracteristiques.fermeture,
                          ).map(Math.abs),
                        ) < 1e-5
                          ? "Vérifiée"
                          : "À examiner"
                      }
                      tone="teal"
                    />
                  </>
                ) : (
                  <>
                    <Metric
                      label="Moment maximal |M|"
                      value={Math.max(
                        ...analysis.frame!.mem.flatMap((m) =>
                          m.pts.map((p) => Math.abs(p.M)),
                        ),
                      )}
                      unit="kN·m"
                      tone="purple"
                    />
                    <Metric
                      label="Déplacement nodal maximal"
                      value={
                        Math.max(
                          ...model.nodes.map((_, i) =>
                            Math.hypot(
                              analysis.frame!.u[3 * i],
                              analysis.frame!.u[3 * i + 1],
                            ),
                          ),
                        ) * 1000
                      }
                      unit="mm"
                    />
                    <Metric
                      label="Équilibre des forces"
                      value={
                        Math.max(
                          Math.abs(analysis.frame!.sx),
                          Math.abs(analysis.frame!.sy),
                        ) < 1e-6
                          ? "Vérifié"
                          : "À examiner"
                      }
                      tone="teal"
                    />
                  </>
                )}
              </div>
              <Panel>
                <Disclosure
                  title={
                    model.kind === "beam"
                      ? "Extrema des efforts et déplacements"
                      : "Extrema par barre"
                  }
                >
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>
                            {model.kind === "beam" ? "Grandeur" : "Barre"}
                          </th>
                          {model.kind === "beam" ? (
                            <>
                              <th>Minimum</th>
                              <th>Maximum</th>
                            </>
                          ) : (
                            <>
                              <th>|M| · kN·m</th>
                              <th>|V| · kN</th>
                              <th>|N| · kN</th>
                              <th>|v| · mm</th>
                              <th>|θ| · mrad</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {model.kind === "beam"
                          ? (["M", "V", "N", "v", "theta"] as const).map(
                              (field) => {
                                const e = analysis.beam!.extrema[field],
                                  factor =
                                    field === "v" || field === "theta"
                                      ? 1000
                                      : 1;
                                const unit =
                                  field === "M"
                                    ? "kN·m"
                                    : field === "v"
                                      ? "mm"
                                      : field === "theta"
                                        ? "mrad"
                                        : "kN";
                                return (
                                  <tr key={field}>
                                    <th>
                                      {fieldNames[field]} · {unit}
                                    </th>
                                    <td>
                                      {fmt(e.min.val * factor)}
                                      <small> à {fmt(e.min.x)} m</small>
                                    </td>
                                    <td>
                                      {fmt(e.max.val * factor)}
                                      <small> à {fmt(e.max.x)} m</small>
                                    </td>
                                  </tr>
                                );
                              },
                            )
                          : analysis.frame!.mem.map((m, i) => (
                              <tr key={i}>
                                <th>B{i + 1}</th>
                                {(["M", "V", "N", "v", "theta"] as const).map(
                                  (field) => (
                                    <td key={field}>
                                      {fmt(
                                        Math.max(
                                          ...m.pts.map((p) =>
                                            Math.abs(p[field]),
                                          ),
                                        ) *
                                          (field === "v" || field === "theta"
                                            ? 1000
                                            : 1),
                                      )}
                                    </td>
                                  ),
                                )}
                              </tr>
                            ))}
                      </tbody>
                    </table>
                  </div>
                </Disclosure>
              </Panel>
              <Panel>
                <Disclosure title="Réactions d’appui" defaultOpen>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Appui</th>
                          <th>Rx · kN</th>
                          <th>Ry · kN</th>
                          <th>Mz · kN·m</th>
                        </tr>
                      </thead>
                      <tbody>
                        {model.kind === "beam"
                          ? analysis.beam!.reactions.map((r, i) => (
                              <tr key={i}>
                                <th>
                                  {String.fromCharCode(65 + i)} · {fmt(r.x)} m
                                </th>
                                <td>{fmt(r.Fx)}</td>
                                <td>{fmt(r.Fy)}</td>
                                <td>{fmt(r.Mz)}</td>
                              </tr>
                            ))
                          : analysis.frame!.rea.map((r) => (
                              <tr key={r.i}>
                                <th>N{r.i + 1}</th>
                                {r.r.map((v, i) => (
                                  <td key={i}>{fmt(v)}</td>
                                ))}
                              </tr>
                            ))}
                      </tbody>
                    </table>
                  </div>
                </Disclosure>
              </Panel>
              {model.kind === "frame" && (
                <Panel>
                  <Disclosure title="Déplacements des nœuds">
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Nœud</th>
                            <th>ux · mm</th>
                            <th>uy · mm</th>
                            <th>θ · mrad</th>
                          </tr>
                        </thead>
                        <tbody>
                          {model.nodes.map((n, i) => (
                            <tr key={n.id}>
                              <th>N{i + 1}</th>
                              {[0, 1, 2].map((k) => (
                                <td key={k}>
                                  {fmt(analysis.frame!.u[3 * i + k] * 1000, 4)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Disclosure>
                </Panel>
              )}
            </>
          ) : (
            <div className="results-awaiting">
              <ChartNoAxesCombined size={36} />
              <h3>
                {calculation.result
                  ? "Le modèle a changé"
                  : "Votre modèle est prêt à être analysé"}
              </h3>
              <p>
                Lancez le calcul pour afficher les efforts, les déplacements et
                les réactions d’appui de ce modèle.
              </p>
              <Button
                onClick={() => {
                  setResultsOpen(false);
                  void calculation.run();
                }}
              >
                <Calculator />
                Calculer
              </Button>
            </div>
          )}
        </div>
        <EditorFooter>
          <Button data-tour="results-done" onClick={() => closeResults(false)}>
            Revenir au schéma
            <X />
          </Button>
        </EditorFooter>
      </EditorSheet>
      <EditorSheet
        open={!!editor && !desktop}
        title="Paramètres de l’élément"
        description="Les modifications s’appliquent après validation du formulaire."
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
      >
        <form onSubmit={apply}>
          {editor && selection && (
            <ElementEditor
              model={editor}
              selection={selection}
              onChange={setEditor}
            />
          )}
          <EditorFooter>
            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              onClick={remove}
            >
              <Trash2 />
              Supprimer
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditor(null);
              }}
            >
              Annuler
            </Button>
            <Button data-tour="element-apply" type="submit">
              Appliquer
            </Button>
          </EditorFooter>
        </form>
      </EditorSheet>
    </div>
  );
}
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Label className="toggle">
      <Switch checked={checked} onCheckedChange={onChange} />
      <span>{label}</span>
    </Label>
  );
}
function ElementRow({
  label,
  detail,
  onClick,
}: {
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="element-row" onClick={onClick}>
      <span className="element-dot" />
      <div>
        <strong>{label}</strong>
        <small className="mono">{detail}</small>
      </div>
      <ChevronRight size={15} />
    </button>
  );
}
function Signed({
  label,
  value,
  onChange,
  unit = "kN",
  positive = "Vers le bas ↓",
  negative = "Vers le haut ↑",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  positive?: string;
  negative?: string;
}) {
  const [sign, setSign] = useState(value < 0 ? -1 : 1);
  return (
    <FormGrid>
      <Numeric
        label={label}
        value={Math.abs(value)}
        unit={unit}
        onChange={(v) => onChange(v * sign)}
      />
      <Choice
        label="Sens"
        value={String(sign)}
        onChange={(v) => {
          const s = Number(v);
          setSign(s);
          onChange(Math.abs(value) * s);
        }}
        options={[
          { value: "1", label: positive },
          { value: "-1", label: negative },
        ]}
      />
    </FormGrid>
  );
}
function ElementEditor({
  model,
  selection,
  onChange,
  multiple = false,
}: {
  model: AnalysisModel;
  selection: Selection;
  onChange: (m: AnalysisModel) => void;
  multiple?: boolean;
}) {
  if (model.kind === "beam") {
    if (selection.type === "support") {
      const s = model.supports.find((s) => s.id === selection.id)!;
      const patch = (p: Partial<typeof s>) =>
        onChange({
          ...model,
          supports: model.supports.map((v) =>
            v.id === s.id ? { ...s, ...p } : v,
          ),
        });
      return (
        <div className="editor-fields">
          <Numeric
            disabled={multiple}
            label="Position x"
            value={s.x}
            max={model.L}
            unit="m"
            onChange={(x) => patch({ x })}
          />
          <Choice
            label="Type d’appui"
            value={supportType(s)}
            options={[
              { value: "pin", label: "Articulé" },
              { value: "roller", label: "Appui simple" },
              { value: "fixed", label: "Encastrement" },
              { value: "spring", label: "Ressort vertical" },
              { value: "custom", label: "Personnalisé" },
            ]}
            onChange={(v) => {
              if (v !== "custom")
                patch({
                  ux: v === "pin" || v === "fixed",
                  uy: v === "spring" ? 10000 : true,
                  rz: v === "fixed",
                });
            }}
          />
          {typeof s.uy === "number" && (
            <Numeric
              label="Raideur verticale kᵧ"
              value={s.uy}
              min={0.001}
              unit="kN/m"
              onChange={(uy) => patch({ uy })}
            />
          )}
          <ParameterGroup title="Liaisons et déplacements imposés">
            {(["ux", "uy", "rz"] as const).map((axis) => (
              <div key={axis}>
                <Choice
                  label={
                    {
                      ux: "Translation horizontale",
                      uy: "Translation verticale",
                      rz: "Rotation",
                    }[axis]
                  }
                  value={
                    s[axis] === true
                      ? "rigid"
                      : typeof s[axis] === "number"
                        ? "spring"
                        : "free"
                  }
                  options={[
                    { value: "free", label: "Libre" },
                    { value: "rigid", label: "Bloquée" },
                    { value: "spring", label: "Élastique" },
                  ]}
                  onChange={(v) =>
                    patch({
                      [axis]:
                        v === "rigid" ? true : v === "spring" ? 10000 : false,
                    })
                  }
                />
                {typeof s[axis] === "number" && (
                  <Numeric
                    label={`Rigidité ${axis}`}
                    value={s[axis] as number}
                    min={0.001}
                    unit={axis === "rz" ? "kN·m/rad" : "kN/m"}
                    onChange={(v) => patch({ [axis]: v })}
                  />
                )}
              </div>
            ))}
            <FormGrid>
              <Numeric
                label="Déplacement horizontal"
                value={s.dx * 1000}
                min={-1e6}
                unit="mm"
                onChange={(dx) => patch({ dx: dx / 1000 })}
              />
              <Numeric
                label="Tassement vertical"
                value={s.dy * 1000}
                min={-1e6}
                unit="mm"
                onChange={(dy) => patch({ dy: dy / 1000 })}
              />
            </FormGrid>
            <Numeric
              label="Rotation imposée"
              value={s.drz * 1000}
              min={-1e6}
              unit="mrad"
              onChange={(drz) => patch({ drz: drz / 1000 })}
            />
          </ParameterGroup>
        </div>
      );
    }
    if (selection.type === "section") {
      const s = model.sections.find((s) => s.id === selection.id)!;
      const patch = (p: Partial<typeof s>) => {
        const sections = model.sections.map((v) => ({ ...v })),
          index = sections.findIndex((v) => v.id === s.id);
        sections[index] = { ...s, ...p };
        if (p.x1 !== undefined && index > 0) sections[index - 1].x2 = p.x1;
        if (p.x2 !== undefined && index < sections.length - 1)
          sections[index + 1].x1 = p.x2;
        if (
          sections[index].shape === "rect" &&
          (p.b !== undefined || p.h !== undefined)
        ) {
          const { b, h } = sections[index];
          sections[index].A = b * h;
          sections[index].I = (b * h ** 3) / 12;
          sections[index].As = model.kappa * b * h;
        }
        onChange({ ...model, sections });
      };
      return (
        <div className="editor-fields">
          <FormGrid>
            <Numeric
              label="Début x₁"
              disabled={multiple || model.sections[0].id === s.id}
              value={s.x1}
              max={model.L}
              unit="m"
              onChange={(x1) => patch({ x1 })}
            />
            <Numeric
              label="Fin x₂"
              disabled={
                multiple ||
                model.sections[model.sections.length - 1].id === s.id
              }
              value={s.x2}
              max={model.L}
              unit="m"
              onChange={(x2) => patch({ x2 })}
            />
          </FormGrid>
          <Choice
            label="Section"
            value={s.shape}
            options={[
              { value: "rect", label: "Rectangulaire" },
              { value: "custom", label: "Propriétés personnalisées" },
            ]}
            onChange={(shape) => patch({ shape: shape as "rect" | "custom" })}
          />
          {s.shape === "rect" ? (
            <FormGrid>
              <Numeric
                label="Largeur b"
                value={s.b * 100}
                min={0.01}
                unit="cm"
                onChange={(b) => patch({ b: b / 100 })}
              />
              <Numeric
                label="Hauteur h"
                value={s.h * 100}
                min={0.01}
                unit="cm"
                onChange={(h) => patch({ h: h / 100 })}
              />
            </FormGrid>
          ) : (
            <>
              <Numeric
                label="Aire A"
                value={s.A * 1e4}
                min={0.001}
                unit="cm²"
                onChange={(A) => patch({ A: A / 1e4 })}
              />
              <Numeric
                label="Inertie I"
                value={s.I * 1e8}
                min={0.001}
                unit="cm⁴"
                onChange={(I) => patch({ I: I / 1e8 })}
              />
              <Numeric
                label="Aire de cisaillement As"
                value={s.As * 1e4}
                min={0.001}
                unit="cm²"
                onChange={(As) => patch({ As: As / 1e4 })}
              />
            </>
          )}
          <p className="hint">
            Les limites communes suivent vos modifications pour garder les
            tronçons contigus. Une suppression fusionne l’intervalle avec son
            voisin.
          </p>
        </div>
      );
    }
    if (selection.type === "hinge") {
      const h = model.hinges.find((h) => h.id === selection.id)!;
      return (
        <Numeric
          disabled={multiple}
          label="Position de la rotule"
          value={h.x}
          min={0.001}
          max={model.L - 0.001}
          unit="m"
          onChange={(x) =>
            onChange({
              ...model,
              hinges: model.hinges.map((v) =>
                v.id === h.id ? { ...h, x } : v,
              ),
            })
          }
        />
      );
    }
    const l = model.loads.find((l) => l.id === selection.id)!;
    if (!l) return null;
    const patch = (p: Partial<typeof l>) =>
      onChange({
        ...model,
        loads: model.loads.map((v) => (v.id === l.id ? { ...l, ...p } : v)),
      });
    return (
      <div className="editor-fields">
        <Choice
          label="Nature de la charge"
          value={l.type}
          options={[
            { value: "point", label: "Force ponctuelle" },
            { value: "dist", label: "Charge répartie linéaire" },
            { value: "moment", label: "Moment concentré" },
          ]}
          onChange={(type) => patch({ type: type as typeof l.type })}
        />
        {l.type === "dist" ? (
          <>
            <FormGrid>
              <Numeric
                disabled={multiple}
                label="Début x₁"
                value={l.x1}
                max={model.L}
                unit="m"
                onChange={(x1) => patch({ x1 })}
              />
              <Numeric
                disabled={multiple}
                label="Fin x₂"
                value={l.x2}
                max={model.L}
                unit="m"
                onChange={(x2) => patch({ x2 })}
              />
            </FormGrid>
            <Signed
              label="Intensité q₁"
              value={l.q1}
              unit="kN/m"
              onChange={(q1) => patch({ q1 })}
            />
            <Signed
              label="Intensité q₂"
              value={l.q2}
              unit="kN/m"
              onChange={(q2) => patch({ q2 })}
            />
            <p className="hint">
              q₁ = q₂ pour une charge uniforme ; des intensités différentes
              créent une charge triangulaire ou trapézoïdale.
            </p>
          </>
        ) : (
          <>
            <Numeric
              disabled={multiple}
              label="Position x"
              value={l.x}
              max={model.L}
              unit="m"
              onChange={(x) => patch({ x })}
            />
            {l.type === "point" ? (
              <>
                <Signed
                  label="Force verticale Fy"
                  value={l.Fy}
                  onChange={(Fy) => patch({ Fy })}
                />
                <Signed
                  label="Force horizontale Fx"
                  value={l.Fx}
                  onChange={(Fx) => patch({ Fx })}
                  positive="Vers la droite →"
                  negative="Vers la gauche ←"
                />
              </>
            ) : (
              <Signed
                label="Moment M"
                value={l.M}
                onChange={(M) => patch({ M })}
                unit="kN·m"
                positive="Horaire ↻"
                negative="Antihoraire ↺"
              />
            )}
          </>
        )}
      </div>
    );
  }
  if (model.kind === "frame" && selection.type === "member-load") {
    const l = model.pl.find((v) => v.id === selection.id);
    if (!l) return null;
    const patch = (p: Partial<typeof l>) =>
      onChange({
        ...model,
        pl: model.pl.map((v) => (v.id === l.id ? { ...v, ...p } : v)),
      });
    return (
      <div className="editor-fields">
        <Choice
          disabled={multiple}
          label="Barre porteuse"
          value={l.member}
          options={model.mem.map((m, i) => ({
            value: m.id,
            label: `B${i + 1}`,
          }))}
          onChange={(member) => patch({ member })}
        />
        <Numeric
          disabled={multiple}
          label="Position sur la barre"
          value={l.t * 100}
          min={0}
          max={100}
          unit="%"
          onChange={(t) => patch({ t: t / 100 })}
        />
        <Numeric
          label="Force horizontale Fx"
          value={l.fx}
          min={-1e6}
          unit="kN"
          onChange={(fx) => patch({ fx })}
        />
        <Numeric
          label="Force verticale Fy"
          value={l.fy}
          min={-1e6}
          unit="kN"
          onChange={(fy) => patch({ fy })}
        />
      </div>
    );
  }
  if (selection.type === "node") {
    const n = model.nodes.find((n) => n.id === selection.id)!;
    const patch = (p: Partial<typeof n>) =>
      onChange({
        ...model,
        nodes: model.nodes.map((v) => (v.id === n.id ? { ...n, ...p } : v)),
      });
    return (
      <div className="editor-fields">
        <FormGrid>
          <Numeric
            disabled={multiple}
            label="Abscisse x"
            value={n.x}
            min={-1000}
            max={1000}
            unit="m"
            onChange={(x) => patch({ x })}
          />
          <Numeric
            disabled={multiple}
            label="Ordonnée y"
            value={n.y}
            min={-1000}
            max={1000}
            unit="m"
            onChange={(y) => patch({ y })}
          />
        </FormGrid>
        <Choice
          label="Liaison au sol"
          value={String(n.s)}
          options={frameSupportNames.map((label, i) => ({
            label,
            value: String(i),
          }))}
          onChange={(s) => patch({ s: Number(s) })}
        />
        {n.s === 5 && (
          <Numeric
            label="Raideur verticale kᵧ"
            value={n.ky ?? 10000}
            min={0.001}
            max={1e12}
            unit="kN/m"
            onChange={(ky) => patch({ ky })}
          />
        )}
        <Notice>
          Supprimer ce nœud supprime aussi ses barres et ses charges nodales.
        </Notice>
      </div>
    );
  }
  if (selection.type === "member") {
    const b = model.mem.find((b) => b.id === selection.id)!;
    const patch = (p: Partial<typeof b>) =>
      onChange({
        ...model,
        mem: model.mem.map((v) => (v.id === b.id ? { ...b, ...p } : v)),
      });
    return (
      <div className="editor-fields">
        <FormGrid>
          {(["a", "b"] as const).map((axis) => (
            <Choice
              key={axis}
              disabled={multiple}
              label={axis === "a" ? "Nœud de départ" : "Nœud d’arrivée"}
              value={String(b[axis])}
              options={model.nodes.map((_, i) => ({
                value: String(i + 1),
                label: `N${i + 1}`,
              }))}
              onChange={(v) => patch({ [axis]: Number(v) })}
            />
          ))}
        </FormGrid>
        <FormGrid>
          <Numeric
            label="Largeur b"
            value={b.bw}
            min={0.01}
            unit="cm"
            onChange={(bw) => patch({ bw })}
          />
          <Numeric
            label="Hauteur h"
            value={b.h}
            min={0.01}
            unit="cm"
            onChange={(h) => patch({ h })}
          />
        </FormGrid>
        <Signed
          label="Charge verticale globale"
          value={b.w}
          unit="kN/m"
          onChange={(w) => patch({ w })}
        />
        <ParameterGroup title="Charge dans le repère local">
          <Numeric
            label="Charge locale qy"
            value={b.q}
            min={-1e6}
            unit="kN/m"
            onChange={(q) => patch({ q })}
          />
          <p className="hint">
            Le repère local x va du nœud de départ au nœud d’arrivée ; y est sa
            normale antihoraire.
          </p>
        </ParameterGroup>
      </div>
    );
  }
  const l = model.nl.find((l) => l.id === selection.id)!;
  if (!l) return null;
  const patch = (p: Partial<typeof l>) =>
    onChange({
      ...model,
      nl: model.nl.map((v) => (v.id === l.id ? { ...l, ...p } : v)),
    });
  return (
    <div className="editor-fields">
      <Choice
        disabled={multiple}
        label="Nœud chargé"
        value={String(l.n)}
        options={model.nodes.map((_, i) => ({
          value: String(i + 1),
          label: `N${i + 1}`,
        }))}
        onChange={(n) => patch({ n: Number(n) })}
      />
      <Signed
        label="Force horizontale Fx"
        value={l.fx}
        onChange={(fx) => patch({ fx })}
        positive="Vers la droite →"
        negative="Vers la gauche ←"
      />
      <Signed
        label="Force verticale Fy"
        value={l.fy}
        onChange={(fy) => patch({ fy })}
        positive="Vers le haut ↑"
        negative="Vers le bas ↓"
      />
      <Signed
        label="Moment"
        value={l.m}
        onChange={(m) => patch({ m })}
        unit="kN·m"
        positive="Antihoraire ↺"
        negative="Horaire ↻"
      />
    </div>
  );
}
function BeamScene({
  model,
  result,
  reactions,
  view,
}: {
  model: BeamModel;
  result?: BeamResult;
  reactions: boolean;
  view: View;
}) {
  const { units, height } = useCanvasGeometry();
  const X = (x: number) => 80 + (x / model.L) * 840,
    y = height / 2;
  if (result && view !== "structure") {
    const values = result[view],
      max = Math.max(1e-12, ...values.map(Math.abs));
    const curve: DiagramCurve = {
      id: "beam",
      a: { x: X(0), y },
      b: { x: X(model.L), y },
      points: result.x.map((x, i) => ({
        x: X(x),
        y: y + (values[i] / max) * 90 * units,
        station: x,
        value: values[i],
      })),
    };
    return (
      <>
        <StructuralDiagram
          curves={[curve]}
          field={view}
          color={seriesColors[view]}
        />
        <line
          data-testid="diagram-axis"
          x1={X(0)}
          y1={y}
          x2={X(model.L)}
          y2={y}
          stroke="var(--foreground)"
          strokeOpacity=".65"
          strokeWidth="1.1"
          vectorEffect="non-scaling-stroke"
        />
        {model.supports.map((s) => (
          <Support
            key={s.id}
            x={X(s.x)}
            y={y + 3}
            type={
              typeof s.uy === "number"
                ? 5
                : s.rz === true
                  ? 1
                  : s.ux === true
                    ? 2
                    : 3
            }
          />
        ))}
      </>
    );
  }
  return (
    <>
      {model.sections.map((s, i) => (
        <g
          key={s.id}
          data-element={`section:${s.id}`}
          className="svg-element"
          tabIndex={0}
          role="button"
        >
          <line
            x1={X(s.x1)}
            y1={y}
            x2={X(s.x2)}
            y2={y}
            stroke="var(--foreground)"
            data-selection-bounds="true"
            strokeWidth="7"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={X(s.x1)}
            y1={y}
            x2={X(s.x2)}
            y2={y}
            stroke="transparent"
            strokeWidth="32"
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={(X(s.x1) + X(s.x2)) / 2}
            y={y + 52 * units}
            fill="var(--muted-foreground)"
            fontSize="12"
            textAnchor="middle"
          >
            S{i + 1} · {fmt(s.b * 100, 0)} × {fmt(s.h * 100, 0)} cm
          </text>
        </g>
      ))}
      {model.loads.map((l, i) => (
        <g
          key={l.id}
          data-element={`load:${l.id}`}
          className="svg-element"
          tabIndex={0}
          role="button"
        >
          {l.type === "dist" ? (
            <>
              <rect
                x={X(l.x1) - 8}
                y={y - 115}
                width={X(l.x2) - X(l.x1) + 16}
                height="115"
                fill="transparent"
              />
              {Array.from(
                {
                  length: Math.max(
                    3,
                    Math.ceil(((l.x2 - l.x1) / model.L) * 25),
                  ),
                },
                (_, j) => {
                  const t =
                      j /
                      Math.max(
                        2,
                        Math.ceil(((l.x2 - l.x1) / model.L) * 25) - 1,
                      ),
                    q = l.q1 + (l.q2 - l.q1) * t,
                    h =
                      (Math.abs(q) /
                        Math.max(1, Math.abs(l.q1), Math.abs(l.q2))) *
                      65;
                  return (
                    <Arrow
                      key={j}
                      x={X(l.x1 + (l.x2 - l.x1) * t)}
                      y={q >= 0 ? y - h - 5 : y + h + 5}
                      dy={q >= 0 ? h : -h}
                    />
                  );
                },
              )}
              <line
                x1={X(l.x1)}
                y1={y - 70}
                x2={X(l.x2)}
                y2={y - 70}
                stroke="var(--orange)"
              />
              <text
                x={(X(l.x1) + X(l.x2)) / 2}
                y={y - 88}
                textAnchor="middle"
                className="numeric"
                fill="var(--orange)"
                fontSize="14"
              >
                q{i + 1} · {fmt(l.q1)}
                {l.q1 !== l.q2 ? ` → ${fmt(l.q2)}` : ""} kN/m
              </text>
            </>
          ) : l.type === "point" ? (
            <>
              <rect
                x={X(l.x) - 20}
                y={y - 130}
                width="45"
                height="160"
                fill="transparent"
              />
              {l.Fy !== 0 && (
                <Arrow
                  x={X(l.x)}
                  y={l.Fy > 0 ? y - 115 : y + 115}
                  dy={l.Fy > 0 ? 110 : -110}
                  label={`F${i + 1} · ${fmt(Math.abs(l.Fy))} kN`}
                />
              )}
              {l.Fx !== 0 && (
                <Arrow
                  x={X(l.x) - Math.sign(l.Fx) * 75}
                  y={y - 12}
                  dx={Math.sign(l.Fx) * 65}
                  dy={0}
                  label={`${fmt(Math.abs(l.Fx))} kN`}
                />
              )}
            </>
          ) : (
            <>
              <path
                d={`M${X(l.x) - 25} ${y - 45}a30 30 0 1 ${l.M >= 0 ? 1 : 0} 50 0`}
                stroke="var(--orange)"
                fill="none"
                strokeWidth="2.5"
              />
              <text
                x={X(l.x)}
                y={y - 87}
                textAnchor="middle"
                fill="var(--orange)"
                className="numeric"
                fontSize="13"
              >
                ↻ {fmt(l.M)} kN·m
              </text>
            </>
          )}
        </g>
      ))}
      {model.hinges.map((h) => (
        <circle
          key={h.id}
          data-element={`hinge:${h.id}`}
          cx={X(h.x)}
          cy={y}
          r="7"
          fill="var(--plot)"
          stroke="var(--primary)"
          strokeWidth="2"
        />
      ))}
      {model.supports.map((s, i) => (
        <g
          key={s.id}
          data-element={`support:${s.id}`}
          className="svg-element"
          tabIndex={0}
          role="button"
        >
          <rect
            x={X(s.x) - 20}
            y={y - 15}
            width="40"
            height="65"
            fill="transparent"
          />
          <Support
            x={X(s.x)}
            y={y + 3}
            type={
              typeof s.uy === "number"
                ? 5
                : s.rz === true
                  ? 1
                  : s.ux === true
                    ? 2
                    : 3
            }
          />
          <text
            x={X(s.x)}
            y={y - 13}
            textAnchor="middle"
            fontSize="14"
            fill="var(--foreground)"
          >
            {String.fromCharCode(65 + i)}
          </text>
        </g>
      ))}
      {reactions &&
        result?.reactions.map((r, i) => (
          <g key={i} data-testid="reaction" data-reaction-y={r.Fy}>
            {Math.abs(r.Fy) > 1e-6 && (
              <Arrow
                x={X(r.x)}
                y={y + 95 * units}
                dy={-Math.sign(r.Fy) * 34 * units}
                color="var(--teal)"
                label={`${fmt(r.Fy)} kN`}
              />
            )}
          </g>
        ))}
      <line
        x1="80"
        y1={height - 105 * units}
        x2="920"
        y2={height - 105 * units}
        stroke="var(--muted-foreground)"
      />
      {[80, 920].map((x) => (
        <line
          key={x}
          x1={x}
          x2={x}
          y1={height - 109 * units}
          y2={height - 101 * units}
          stroke="var(--muted-foreground)"
        />
      ))}
      <text
        x="500"
        y={height - 81 * units}
        textAnchor="middle"
        fill="var(--muted-foreground)"
        fontSize="14"
        className="numeric"
      >
        {fmt(model.L)} m
      </text>
    </>
  );
}
function FrameScene({
  model,
  result,
  reactions,
  view,
  amplification,
}: {
  model: FrameModel;
  result?: FrameResult;
  reactions: boolean;
  view: View;
  amplification: number;
}) {
  const { units, height } = useCanvasGeometry();
  const minX = Math.min(...model.nodes.map((n) => n.x)),
    maxX = Math.max(...model.nodes.map((n) => n.x)),
    minY = Math.min(...model.nodes.map((n) => n.y)),
    maxY = Math.max(...model.nodes.map((n) => n.y)),
    scale = Math.min(
      Math.max(100, Math.min(760, 1000 - 170 * units)) /
        Math.max(1, maxX - minX),
      Math.max(60, height - 350 * units) / Math.max(1, maxY - minY),
    ),
    X = (x: number) => (1000 - (maxX - minX) * scale) / 2 + (x - minX) * scale,
    Y = (y: number) =>
      210 * units +
      (Math.max(60, height - 350 * units) + (maxY - minY) * scale) / 2 -
      (y - minY) * scale;
  if (result && view !== "structure") {
    const max = Math.max(
      1e-12,
      ...result.mem.flatMap((m) => m.pts.map((p) => Math.abs(p[view]))),
    );
    const curves: DiagramCurve[] = result.mem.map((r, i) => ({
      id: model.mem[i].id,
      a: { x: X(r.g.A.x), y: Y(r.g.A.y) },
      b: { x: X(r.g.A.x + r.g.L * r.g.c), y: Y(r.g.A.y + r.g.L * r.g.s) },
      points: r.pts.map((p) => {
        const x = r.g.A.x + p.x * r.g.c,
          y = r.g.A.y + p.x * r.g.s;
        if (view === "v") {
          const displacement = frameDisplacement(r, p);
          return {
            x: X(x + amplification * displacement.dx),
            y: Y(y + amplification * displacement.dy),
            station: p.x,
            value: displacement.magnitude,
          };
        }
        return {
          x: X(x) + ((r.g.s * p[view]) / max) * 60 * units,
          y: Y(y) + ((r.g.c * p[view]) / max) * 60 * units,
          station: p.x,
          value: p[view],
        };
      }),
    }));
    return (
      <>
        <StructuralDiagram
          curves={curves}
          field={view}
          color={seriesColors[view]}
          resultant={view === "v"}
        />
        {curves.map((curve) => (
          <line
            key={curve.id}
            data-testid="diagram-axis"
            x1={curve.a.x}
            y1={curve.a.y}
            x2={curve.b.x}
            y2={curve.b.y}
            stroke="var(--foreground)"
            strokeOpacity=".65"
            strokeWidth="1.1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {model.nodes
          .filter((n) => n.s > 0)
          .map((n) => (
            <Support key={n.id} x={X(n.x)} y={Y(n.y) + 3} type={n.s} />
          ))}
      </>
    );
  }
  return (
    <>
      {model.mem.map((b, i) => {
        const a = model.nodes[b.a - 1],
          n = model.nodes[b.b - 1];
        if (!a || !n) return null;
        const x1 = X(a.x),
          y1 = Y(a.y),
          x2 = X(n.x),
          y2 = Y(n.y),
          memberLength = Math.max(1e-12, Math.hypot(n.x - a.x, n.y - a.y));
        return (
          <g
            key={b.id}
            data-element={`member:${b.id}`}
            className="svg-element"
            tabIndex={0}
            role="button"
          >
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="var(--primary)"
              data-selection-bounds="true"
              strokeWidth="3.5"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="transparent"
              strokeWidth="32"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={(x1 + x2) / 2 + 12}
              y={(y1 + y2) / 2 + 20}
              fontSize="12"
              fill="var(--muted-foreground)"
            >
              B{i + 1}
            </text>
            {b.w !== 0 &&
              Array.from({ length: 7 }, (_, j) => {
                const t = (j + 0.5) / 7;
                return (
                  <Arrow
                    key={j}
                    x={x1 + (x2 - x1) * t}
                    y={y1 + (y2 - y1) * t - Math.sign(b.w) * 48}
                    dy={Math.sign(b.w) * 44}
                  />
                );
              })}
            {b.w !== 0 && (
              <text
                x={(x1 + x2) / 2}
                y={(y1 + y2) / 2 - 65}
                textAnchor="middle"
                className="numeric"
                fontSize="13"
                fill="var(--orange)"
              >
                {fmt(b.w)} kN/m
              </text>
            )}
            {b.q !== 0 && (
              <Arrow
                x={(x1 + x2) / 2}
                y={(y1 + y2) / 2}
                dx={-Math.sign(b.q) * ((n.y - a.y) / memberLength) * 45}
                dy={-Math.sign(b.q) * ((n.x - a.x) / memberLength) * 45}
                label={`qᵧ ${fmt(b.q)}`}
              />
            )}
          </g>
        );
      })}
      {model.nodes.map((n, i) => (
        <g
          key={n.id}
          data-element={`node:${n.id}`}
          className="svg-element"
          tabIndex={0}
          role="button"
        >
          {n.s > 0 && <Support x={X(n.x)} y={Y(n.y) + 3} type={n.s} />}
          <circle
            cx={X(n.x)}
            cy={Y(n.y)}
            r={6 * units}
            fill="var(--plot)"
            stroke="var(--primary)"
            strokeWidth="2"
          />
          <circle cx={X(n.x)} cy={Y(n.y)} r="15" fill="transparent" />
          <text
            x={X(n.x) - 25}
            y={Y(n.y) - 13}
            fontSize="13"
            fill="var(--foreground)"
          >
            N{i + 1}
          </text>
        </g>
      ))}
      {model.pl.map((l) => {
        const m = model.mem.find((m) => m.id === l.member);
        if (!m) return null;
        const a = model.nodes[m.a - 1],
          b = model.nodes[m.b - 1],
          x = X(a.x + l.t * (b.x - a.x)),
          y = Y(a.y + l.t * (b.y - a.y));
        return (
          <g
            key={l.id}
            data-element={`member-load:${l.id}`}
            tabIndex={0}
            role="button"
            className="svg-element"
          >
            {l.fy !== 0 && (
              <Arrow
                x={x}
                y={y - 55 * units * Math.sign(-l.fy)}
                dy={55 * units * Math.sign(-l.fy)}
                label={`${fmt(l.fy)} kN`}
              />
            )}
            {l.fx !== 0 && (
              <Arrow
                x={x - 55 * units * Math.sign(l.fx)}
                y={y}
                dx={55 * units * Math.sign(l.fx)}
                dy={0}
                label={`${fmt(l.fx)} kN`}
              />
            )}
            <circle
              cx={x}
              cy={y - 35 * units * Math.sign(-l.fy || 1)}
              r={16 * units}
              fill="transparent"
            />
          </g>
        );
      })}
      {model.nl.map((l) => {
        const n = model.nodes[l.n - 1];
        if (!n) return null;
        return (
          <g
            key={l.id}
            data-element={`nodal:${l.id}`}
            className="svg-element"
            tabIndex={0}
            role="button"
          >
            {l.fx !== 0 && (
              <Arrow
                x={X(n.x) - Math.sign(l.fx) * 95}
                y={Y(n.y) - 17}
                dx={Math.sign(l.fx) * 85}
                dy={0}
                label={`${fmt(Math.abs(l.fx))} kN`}
              />
            )}
            {l.fy !== 0 && (
              <Arrow
                x={X(n.x) + 15}
                y={Y(n.y) + Math.sign(l.fy) * 80}
                dy={-Math.sign(l.fy) * 70}
                label={`${fmt(Math.abs(l.fy))} kN`}
              />
            )}
            {l.m !== 0 && (
              <text
                x={X(n.x) + 18}
                y={Y(n.y) + 35}
                fontSize="13"
                fill="var(--orange)"
              >
                ↺ {fmt(l.m)} kN·m
              </text>
            )}
          </g>
        );
      })}
      {reactions &&
        result?.rea.map((r) => {
          const n = model.nodes[r.i];
          return (
            <g key={r.i} data-testid="reaction" data-reaction-y={r.r[1]}>
              {Math.abs(r.r[1]) > 0.001 && (
                <Arrow
                  x={X(n.x)}
                  y={Y(n.y) + 70}
                  dy={-40 * Math.sign(r.r[1])}
                  color="var(--teal)"
                  label={`${fmt(r.r[1])} kN`}
                />
              )}
            </g>
          );
        })}
      <text
        x="500"
        y={height - 80 * units}
        textAnchor="middle"
        fill="var(--muted-foreground)"
        fontSize="13"
        className="numeric"
      >
        {fmt(maxX - minX)} m × {fmt(maxY - minY)} m
      </text>
    </>
  );
}
