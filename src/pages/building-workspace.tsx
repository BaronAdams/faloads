import { RoofEditor, RoofResults } from "@/components/roof-editor";
import { BuildingViewMenu } from "@/components/building-view-menu";
import { BuildingCriticalIcon } from "@/components/building-critical-icon";
import { BuildingDuplication } from "@/components/building-duplication";
import {
  defaultBuildingAnnotations,
  type OrbitAxis,
} from "@/domain/building-view";
import { toggleSelection, selectionFamily } from "@/domain/selection";
import { RibbonGroup } from "@/components/project-ribbon";
import { useDesktopCommands } from "@/lib/desktop-commands";
import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Copy,
  Undo2,
  Redo2,
  Trash2,
  Settings,
  Pencil,
  ChartNoAxesCombined,
  Calculator,
  X,
  Grid2X2,
  ArrowUp,
  ArrowDown,
  Layers,
  Square,
  Columns3,
  Minus,
  Focus,
  House,
} from "lucide-react";
import { toast } from "sonner";
import {
  buildingPlanGeometry,
  BuildingScene,
} from "@/components/building-scene";
import { Building3D, caseValue, type LoadCase } from "@/components/building-3d";
import {
  SceneMenu,
  DetailDialog,
  SectionTypes,
  ShortcutHelp,
  useEditorKeys,
  type MenuPoint,
  type EditorActions,
} from "@/components/desktop-tools";
import { EditorSheet, EditorFooter } from "@/components/editor-sheet";
import { Playground } from "@/components/playground";
import {
  ProjectHeader,
  Numeric,
  Choice,
  IconButton,
  Notice,
  FormGrid,
  Panel,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { LevelEditor } from "@/components/level-editor";
import {
  CalculationOverlay,
  CalculationStatus,
} from "@/components/calculation-state";
import {
  buildingSchema,
  buildingDefaults,
  buildingResults,
  buildingDescent,
  newFloor,
  resizeFloor,
  mergeNeighbors,
  mergePanels,
  floorWind,
  type BuildingModel,
  type Floor,
} from "@/domain/building";
import {
  buildingElements,
  buildingProperties,
  patchBuildingElements,
} from "@/domain/building-editing";
import { slabs, usages, type Level } from "@/domain/engineering";
import { reductionOptions, type Reduction } from "@/domain/load-reduction";
import { runtime } from "@/lib/runtime";
import { useCalculation } from "@/lib/use-calculation";
import { useWorkspace } from "@/lib/workspace";
import { studyAction } from "@/lib/study-events";
import { type Project } from "@/lib/storage";
import { fmt, uid } from "@/lib/utils";
import { WindFields } from "./descent-page";
export function BuildingPage({ project }: { project?: Project }) {
  const [annotations, setAnnotations] = useState(defaultBuildingAnnotations),
    [orbitAxis, setOrbitAxis] = useState<OrbitAxis>("auto"),
    [duplication, setDuplication] = useState<{ selection: boolean } | null>(
      null,
    ),
    [allLevels, setAllLevels] = useState(false);
  const desktop = runtime === "desktop",
    { drafts } = useWorkspace(),
    draftKey = project?.id ?? "building";
  const [model, setModel] = useState<BuildingModel>(() => {
    const r = buildingSchema.safeParse(drafts.get(draftKey) ?? project?.data);
    return r.success ? r.data : buildingDefaults();
  });
  const [name, setName] = useState(
      project?.name ?? "Bâtiment — nouveau projet",
    ),
    [active, setActive] = useState(0),
    [selection, setSelection] = useState<string | null>(null),
    [selectedKeys, setSelectedKeys] = useState<string[]>([]),
    [editor, setEditor] = useState<Floor | null>(null),
    [history, setHistory] = useState<BuildingModel[]>([]),
    [future, setFuture] = useState<BuildingModel[]>([]),
    [menu, setMenu] = useState<MenuPoint>(null),
    [clipboard, setClipboard] = useState<{
      family: string;
      props: Record<string, unknown>;
    } | null>(null);
  const [parameters, setParameters] = useState(false),
    [gridOpen, setGridOpen] = useState(false),
    [roofOpen, setRoofOpen] = useState(false),
    [focusAnnotations, setFocusAnnotations] = useState(false),
    [details, setDetails] = useState(false),
    [resultsOpen, setResultsOpen] = useState(false),
    [view, setView] = useState<"plan" | "3d">("plan"),
    [field, setField] = useState<LoadCase>("ELU"),
    [influence, setInfluence] = useState(true),
    [yaw, setYaw] = useState(35),
    [pitch, setPitch] = useState(28),
    [critical, setCritical] = useState<{
      floor: string;
      key: string;
      label: string;
      value: number;
      unit: string;
    } | null>(null);
  const dragModel = useRef<BuildingModel | null>(null);
  const floor = model.floors[Math.min(active, model.floors.length - 1)],
    working = editor ?? floor;
  const calculation = useCalculation<ReturnType<typeof buildingDescent>>(
    "building",
    model,
  );
  const current = calculation.fresh
    ? calculation.result?.find((r) => r.id === floor.id)
    : undefined;
  const activeRoof =
    floor.id === model.floors.at(-1)!.id ? model.roof : undefined;
  const preview = buildingResults(floor, activeRoof),
    results = current?.results ?? preview;
  useEffect(() => {
    drafts.set(draftKey, model);
  }, [drafts, draftKey, model]);
  useEffect(() => {
    setCritical(null);
  }, [model, field]);
  useEffect(() => {
    if (selectedKeys.length !== 1) setFocusAnnotations(false);
  }, [selectedKeys.length]);
  const openParameters = (open: boolean) => {
    setParameters(open);
    studyAction(open ? "parameters:open" : "parameters:close");
  };
  const openGrid = (open: boolean) => {
    setGridOpen(open);
    studyAction(open ? "grid:open" : "grid:close");
  };
  const clear = () => {
    setCritical(null);
    setFocusAnnotations(false);
    setSelection(null);
    setSelectedKeys([]);
    setEditor(null);
    setMenu(null);
  };
  const changeFloor = (i: number) => {
    setActive(i);
    clear();
  };
  const commit = (next: BuildingModel) => {
    const r = buildingSchema.safeParse(next);
    if (!r.success) {
      toast.error(r.error.issues[0].message);
      return false;
    }
    setHistory((h) => [...h.slice(-49), model]);
    setFuture([]);
    setModel(r.data);
    return true;
  };
  const patchFloor = (f: Floor) =>
    commit({
      ...model,
      floors: model.floors.map((v) => (v.id === f.id ? f : v)),
    });
  const dragElement = (
    key: string,
    delta: { x: number; y: number },
    phase: "start" | "move" | "end" | "cancel",
  ) => {
    if (phase === "start") {
      if (
        !key.startsWith("oblique|") ||
        !floor.obliques.some((o) => `oblique|${o.id}` === key)
      )
        return false;
      dragModel.current = structuredClone(model);
      setMenu(null);
      return true;
    }
    const initial = dragModel.current;
    if (!initial) return;
    if (phase === "cancel") {
      setModel(initial);
      dragModel.current = null;
      return;
    }
    const next = structuredClone(initial);
    const f = next.floors.find((f) => f.id === floor.id)!;
    const o = f.obliques.find((o) => `oblique|${o.id}` === key)!;
    const canvas = document.querySelector<HTMLElement>(
      ".building-page .playground",
    );
    const { scale } = buildingPlanGeometry(
      f,
      Number(canvas?.dataset.canvasUnits ?? 1),
      Number(canvas?.dataset.canvasHeight ?? 600),
    );
    const totalX = f.spanX.reduce((a, b) => a + b, 0),
      totalY = f.spanY.reduce((a, b) => a + b, 0);
    const xs = o.kind === "beam" ? [o.x1, o.x2] : [o.x1],
      ys = o.kind === "beam" ? [o.y1, o.y2] : [o.y1];
    const dx = Math.max(
      -Math.min(...xs),
      Math.min(totalX - Math.max(...xs), delta.x / scale),
    );
    const dy = Math.max(
      -Math.min(...ys),
      Math.min(totalY - Math.max(...ys), delta.y / scale),
    );
    const round = (n: number) => Math.round(n * 1000) / 1000;
    o.x1 = round(o.x1 + dx);
    o.y1 = round(o.y1 + dy);
    if (o.kind === "beam") {
      o.x2 = round(o.x2 + dx);
      o.y2 = round(o.y2 + dy);
    }
    setModel(next);
    if (phase === "end") {
      setHistory((h) => [...h.slice(-49), initial]);
      setFuture([]);
      dragModel.current = null;
      setSelection(key);
      setSelectedKeys([key]);
      setEditor(null);
    }
  };
  const undo = (redo = false) => {
    const list = redo ? future : history;
    if (!list.length) return;
    setModel(list.at(-1)!);
    if (redo) {
      setFuture(list.slice(0, -1));
      setHistory((h) => [...h, model]);
    } else {
      setHistory(list.slice(0, -1));
      setFuture((h) => [...h, model]);
    }
    clear();
    setActive(0);
  };
  const elements = buildingElements(floor).filter(
      (e) =>
        !(
          activeRoof?.enabled &&
          !activeRoof.keepSlab &&
          e.key.startsWith("panel|")
        ),
    ),
    mixedSelection =
      selectedKeys.length > 1 && !selectionFamily(elements, selectedKeys),
    selected = !mixedSelection
      ? elements.find((e) => e.key === selection)
      : undefined,
    [type, key] = (selection ?? "").split("|");
  const select = (key: string, additive = false) => {
    setCritical(null);
    if (!desktop) {
      setSelection(key);
      setSelectedKeys([key]);
      setEditor(calculation.fresh ? null : structuredClone(floor));
      return;
    }
    const keys = toggleSelection(selectedKeys, key, additive);
    setSelection(keys.at(-1) ?? null);
    setSelectedKeys(keys);
    setEditor(null);
  };
  const isolateAnnotations = (enabled: boolean) => setFocusAnnotations(enabled);
  const patchSelected = (patch: Record<string, unknown>, copyAll = false) => {
    // Direct edits change only the edited fields; pasting intentionally copies
    // all properties. Each recipient keeps its own loads and identity otherwise.
    if (!copyAll && selection?.startsWith("panel|") && patch.level) {
      const before = working.panels[selection.slice(6)].level;
      patch = {
        ...patch,
        level: Object.fromEntries(
          Object.entries(patch.level as Record<string, unknown>).filter(
            ([key, value]) =>
              JSON.stringify(value) !==
              JSON.stringify(before[key as keyof typeof before]),
          ),
        ),
      };
    }
    const next = patchBuildingElements(
      working,
      desktop ? selectedKeys : [selection!],
      patch,
    );
    if (desktop) {
      patchFloor(next);
      studyAction("element:applied");
    } else setEditor(next);
  };
  const addFree = (kind: "beam" | "column") => {
    const f = structuredClone(floor),
      id = uid();
    f.obliques.push({
      id,
      kind,
      x1: 0,
      y1: 0,
      x2: f.spanX[0],
      y2: f.spanY[0],
      b: 25,
      h: kind === "beam" ? 40 : 25,
      angle: 0,
      area: 6,
      g: 4,
      q: 1.5,
    });
    if (desktop) patchFloor(f);
    else setEditor(f);
    setSelection(`oblique|${id}`);
    setSelectedKeys([`oblique|${id}`]);
    studyAction("element:applied");
  };
  const actions: EditorActions = {
    modify: () => {
      if (mixedSelection) {
        toast.info(
          "Sélectionnez des éléments de même nature pour modifier leurs paramètres.",
        );
        return;
      }
      if (selection) {
        if (desktop) setDetails(true);
        else setEditor(structuredClone(floor));
        setMenu(null);
      }
    },
    duplicate: () => setDuplication({ selection: selectedKeys.length > 0 }),
    copy: () => {
      if (selected && selection) {
        setClipboard({
          family: selected.family,
          props: buildingProperties(floor, selection),
        });
        toast.success("Propriétés copiées.");
      }
    },
    paste: () => {
      if (clipboard && clipboard.family === selected?.family)
        patchSelected(clipboard.props, true);
      else toast.info("Sélectionnez des éléments de même nature.");
    },
    all: () => {
      if (selected)
        setSelectedKeys(
          elements
            .filter(
              (e) =>
                e.family === selected.family &&
                (!("exists" in e.value) || e.value.exists),
            )
            .map((e) => e.key),
        );
      else {
        setSelectedKeys(
          elements
            .filter((e) => !("exists" in e.value) || e.value.exists)
            .map((e) => e.key),
        );
        setSelection(null);
      }
    },
    remove: () => {
      if (!selectedKeys.length) return;
      const f = patchBuildingElements(
        floor,
        selectedKeys.filter((k) => !k.startsWith("oblique|")),
        { exists: false },
      );
      f.obliques = f.obliques.filter(
        (o) => !selectedKeys.includes(`oblique|${o.id}`),
      );
      patchFloor(f);
      clear();
    },
    clear,
    undo,
    add: () =>
      document.querySelector<HTMLButtonElement>('[data-tour="add"]')?.click(),
  };
  useEditorKeys(actions);
  const run = async () => {
    const invalid = document.querySelector<HTMLInputElement>("input:invalid");
    if (invalid) return invalid.reportValidity();
    setParameters(false);
    if (await calculation.run()) {
      setResultsOpen(true);
      studyAction("results:open");
    }
  };
  const highest = (kind: "column" | "beam") => {
    if (!calculation.fresh || !calculation.result) {
      toast.info(
        "Lancez d’abord le calcul pour identifier les éléments les plus chargés.",
      );
      return;
    }
    const candidates = calculation.result.flatMap((r) => [
      ...(kind === "column"
        ? r.results.columns.map((n) => ({
            floor: r.id,
            key: `node|${n.key}`,
            label: `${r.name} · Poteau ${n.label}`,
            value: caseValue(n.g, n.q, field),
            unit: "kN",
          }))
        : r.results.edges
            .filter((e) => e.kind === "beam")
            .map((e) => ({
              floor: r.id,
              key: `edge|${e.key}`,
              label: `${r.name} · ${e.label}`,
              value: caseValue(e.g, e.q, field),
              unit: "kN/m",
            }))),
      ...r.results.obliques
        .filter((o) => o.kind === kind)
        .map((o) => ({
          floor: r.id,
          key: `oblique|${o.id}`,
          label: `${r.name} · ${o.label}`,
          value: caseValue(o.g, o.q, field),
          unit: kind === "beam" ? "kN/m" : "kN",
        })),
    ]);
    const max = candidates.sort((a, b) => b.value - a.value)[0];
    if (!max) return toast.info("Aucun élément de ce type.");
    setActive(model.floors.findIndex((f) => f.id === max.floor));
    setSelection(max.key);
    setSelectedKeys([max.key]);
    setCritical(max);
    setEditor(null);
    setView("3d");
    setAnnotations((value) => ({
      ...value,
      [kind === "column" ? "columns" : "beams"]: { labels: true, values: true },
    }));
    setAllLevels(false);
  };
  const slot =
    type === "node" && !mixedSelection
      ? working.nodes[key]
      : type === "edge" && !mixedSelection
        ? working.edges[key]
        : null;
  const panel =
    type === "panel" && !mixedSelection ? working.panels[key] : null;
  const free =
    type === "oblique" && !mixedSelection
      ? working.obliques.find((o) => o.id === key)
      : null;
  const selectionFields = (full = false) => (
    <>
      {slot && (
        <>
          <Choice
            label="Nature"
            value={type === "node" ? "column" : slot.kind}
            options={
              type === "node"
                ? [{ value: "column", label: "Poteau" }]
                : [
                    { value: "beam", label: "Poutre" },
                    { value: "wall", label: "Voile" },
                  ]
            }
            onChange={(kind) => patchSelected({ kind })}
          />
          <div className="ribbon-field-pair">
            <Numeric
              label={slot.kind === "wall" ? "Épaisseur" : "Largeur b"}
              value={slot.b}
              min={1}
              max={1000}
              unit="cm"
              onChange={(b) => patchSelected({ b })}
            />
            <Numeric
              label="Hauteur h"
              value={slot.h}
              min={1}
              max={1000}
              unit="cm"
              onChange={(h) => patchSelected({ h })}
            />
          </div>
          <Label className="toggle">
            <Switch
              checked={slot.exists}
              onCheckedChange={(exists) => patchSelected({ exists })}
            />
            Présent
          </Label>
        </>
      )}
      {panel && (
        <>
          {full ? (
            <LevelEditor
              panel
              level={panel.level}
              sectionTypes={model.sectionTypes}
              onChange={(level) => {
                patchSelected({ level });
                studyAction("input:edited");
              }}
            />
          ) : (
            <>
              <Choice
                label="Plancher"
                value={panel.level.slab}
                options={slabs.map((s) => ({ value: s.id, label: s.label }))}
                onChange={(slab) =>
                  patchSelected({ level: { ...panel.level, slab } })
                }
              />
              {panel.level.slab === "dp" && (
                <Numeric
                  label="Épaisseur"
                  value={panel.level.thickness * 100}
                  min={1}
                  unit="cm"
                  onChange={(h) =>
                    patchSelected({
                      level: { ...panel.level, thickness: h / 100 },
                    })
                  }
                />
              )}
              <Choice
                label="Usage"
                value={panel.level.usage}
                options={usages.map((u) => ({ value: u.id, label: u.label }))}
                onChange={(usage) =>
                  patchSelected({
                    level: {
                      ...panel.level,
                      usage,
                      q: usages.find((u) => u.id === usage)!.q,
                    },
                  })
                }
              />
              <Numeric
                label="Exploitation Q"
                value={panel.level.q}
                min={0}
                max={1000}
                unit="kN/m²"
                onChange={(q) =>
                  patchSelected({ level: { ...panel.level, q } })
                }
              />
            </>
          )}
          {full && (
            <>
              <div className="field">
                <Label htmlFor="panel-name">Désignation</Label>
                <Input
                  id="panel-name"
                  value={panel.label}
                  onChange={(e) => patchSelected({ label: e.target.value })}
                />
              </div>
              <Choice
                label="Forme du panneau"
                value={panel.mode}
                options={[
                  { value: "full", label: "Rectangle entier" },
                  { value: "ne", label: "Triangle nord-est" },
                  { value: "sw", label: "Triangle sud-ouest" },
                ]}
                onChange={(mode) => patchSelected({ mode })}
              />
              <Label className="toggle">
                <Switch
                  checked={panel.exists}
                  onCheckedChange={(exists) => patchSelected({ exists })}
                />
                Panneau présent
              </Label>
              {mergeNeighbors(working, key).length > 0 && (
                <Choice
                  label="Regrouper sans poutre séparatrice"
                  value="none"
                  options={[
                    { value: "none", label: "Choisir un panneau adjacent" },
                    ...mergeNeighbors(working, key).map((k) => ({
                      value: k,
                      label: working.panels[k].label,
                    })),
                  ]}
                  onChange={(k) => {
                    if (k === "none") return;
                    const f = mergePanels(working, key, k);
                    if (desktop) patchFloor(f);
                    else setEditor(f);
                  }}
                />
              )}
            </>
          )}
        </>
      )}
      {free && (
        <>
          <Numeric
            label="Largeur b"
            value={free.b}
            min={1}
            max={1000}
            unit="cm"
            onChange={(b) => patchSelected({ b })}
          />
          <Numeric
            label="Hauteur h"
            value={free.h}
            min={1}
            max={1000}
            unit="cm"
            onChange={(h) => patchSelected({ h })}
          />
          {full && (
            <>
              {(
                ["x1", "y1", ...(free.kind === "beam" ? ["x2", "y2"] : [])] as (
                  "x1" | "y1" | "x2" | "y2"
                )[]
              ).map((axis) => (
                <Numeric
                  key={axis}
                  label={axis}
                  value={free[axis]}
                  min={-1000}
                  max={1000}
                  unit="m"
                  onChange={(v) => patchSelected({ [axis]: v })}
                />
              ))}
              {free.kind === "column" && (
                <>
                  <Numeric
                    label="Aire d’influence saisie"
                    value={free.area}
                    unit="m²"
                    onChange={(area) => patchSelected({ area })}
                  />
                  <Numeric
                    label="Rotation en plan"
                    value={free.angle}
                    min={-360}
                    max={360}
                    unit="°"
                    onChange={(angle) => patchSelected({ angle })}
                  />
                </>
              )}
            </>
          )}
          {(["g", "q"] as const).map((k) => (
            <Numeric
              key={k}
              label={k === "g" ? "Charge permanente G" : "Exploitation Q"}
              value={free[k]}
              min={0}
              unit={free.kind === "beam" ? "kN/m" : "kN/m²"}
              onChange={(v) => patchSelected({ [k]: v })}
            />
          ))}
        </>
      )}
      {selected && (
        <Choice
          label="Dimension type"
          value="custom"
          options={[
            { value: "custom", label: "Choisir une section" },
            ...model.sectionTypes
              .filter((t) => t.kind === selected.family.replace("free-", ""))
              .map((t) => ({ value: t.id, label: t.name })),
          ]}
          onChange={(id) => {
            const t = model.sectionTypes.find((t) => t.id === id);
            if (t)
              patchSelected(
                panel
                  ? {
                      level: {
                        ...panel.level,
                        slab: t.slab ?? "dp",
                        thickness: t.h / 100,
                      },
                    }
                  : { b: t.b, h: t.h },
              );
          }}
        />
      )}
    </>
  );
  const gridFields = (
    <>
      <div className="field">
        <Label htmlFor="floor-name">Nom du niveau</Label>
        <Input
          id="floor-name"
          value={floor.name}
          onChange={(e) => patchFloor({ ...floor, name: e.target.value })}
        />
      </div>
      <Numeric
        label="Hauteur d’étage"
        value={floor.height}
        min={0.1}
        max={100}
        unit="m"
        onChange={(height) => patchFloor({ ...floor, height })}
      />
      <FormGrid>
        {(["spanX", "spanY"] as const).map((axis) => (
          <Numeric
            key={axis}
            label={axis === "spanX" ? "Travées X" : "Travées Y"}
            value={floor[axis].length}
            min={1}
            max={12}
            step={1}
            onChange={(n) => {
              if (Number.isInteger(n)) {
                patchFloor(
                  resizeFloor(
                    floor,
                    axis === "spanX" ? n : floor.spanX.length,
                    axis === "spanY" ? n : floor.spanY.length,
                  ),
                );
                clear();
              }
            }}
          />
        ))}
      </FormGrid>
      <div data-tour="building-inputs">
        <FormGrid>
          {(["spanX", "spanY"] as const).flatMap((axis) =>
            floor[axis].map((value, i) => (
              <Numeric
                key={`${axis}${i}`}
                label={`${axis === "spanX" ? "X" : "Y"} · travée ${i + 1}`}
                value={value}
                min={0.1}
                max={100}
                unit="m"
                onChange={(v) =>
                  patchFloor({
                    ...floor,
                    [axis]: floor[axis].map((x, j) => (i === j ? v : x)),
                  })
                }
              />
            )),
          )}
        </FormGrid>
      </div>
    </>
  );
  const globalFields = (
    <>
      {gridFields}
      <Choice
        label="Dégression des charges Q"
        value={model.reduction}
        options={reductionOptions}
        onChange={(reduction) =>
          commit({ ...model, reduction: reduction as Reduction })
        }
      />
      <Notice>
        Ordre des niveaux : RDC en premier, toiture en dernier. Le calcul cumule
        les charges dans l’ordre inverse. La dégression concerne les porteurs
        verticaux ; les poutres conservent Q entier.
      </Notice>
      <WindFields value={model} onChange={(v) => commit({ ...model, ...v })} />
    </>
  );
  useDesktopCommands({
    "view:parameters": () => openParameters(true),
    "view:results": () => setResultsOpen(true),
    "study:calculate": () => void run(),
    "help:shortcuts": () =>
      document
        .querySelector<HTMLButtonElement>(
          '[aria-label="Raccourcis clavier et souris"]',
        )
        ?.click(),
  });
  const floorControls = (
    <div className="floor-toolbar">
      <div className="row-actions">
        <IconButton
          label="Dupliquer"
          onClick={() => setDuplication({ selection: false })}
        >
          <Copy />
        </IconButton>
        <IconButton
          label="Niveau"
          onClick={() => {
            commit({
              ...model,
              floors: [...model.floors, newFloor(`R+${model.floors.length}`)],
            });
            changeFloor(model.floors.length);
          }}
        >
          <Plus />
        </IconButton>
        <IconButton
          label="Monter le niveau"
          disabled={active >= model.floors.length - 1}
          onClick={() => {
            const floors = [...model.floors];
            [floors[active], floors[active + 1]] = [
              floors[active + 1],
              floors[active],
            ];
            commit({ ...model, floors });
            changeFloor(active + 1);
          }}
        >
          <ArrowUp />
        </IconButton>
        <IconButton
          label="Descendre le niveau"
          disabled={active <= 0}
          onClick={() => {
            const floors = [...model.floors];
            [floors[active], floors[active - 1]] = [
              floors[active - 1],
              floors[active],
            ];
            commit({ ...model, floors });
            changeFloor(active - 1);
          }}
        >
          <ArrowDown />
        </IconButton>
        <IconButton
          label="Supprimer le niveau actif"
          disabled={model.floors.length === 1}
          onClick={() => {
            commit({
              ...model,
              floors: model.floors.filter((f) => f.id !== floor.id),
            });
            changeFloor(0);
          }}
        >
          <Trash2 />
        </IconButton>
      </div>
    </div>
  );
  const contextualParameters = (
    <div className="desktop-parameter-bar">
      <Numeric
        compact
        shortLabel="H"
        label="Hauteur d’étage"
        value={floor.height}
        unit="m"
        min={0.1}
        max={100}
        onChange={(height) => patchFloor({ ...floor, height })}
      />
      <IconButton
        label="Grille du niveau actif"
        data-tour="building-grid"
        onClick={() => openGrid(true)}
      >
        <Grid2X2 />
      </IconButton>
    </div>
  );
  const compactSelection = (
    <div
      className="desktop-parameter-bar selection-summary"
      data-tour="parameters-inputs"
    >
      {mixedSelection ? (
        <span className="mixed-selection-note">Sélection mixte</span>
      ) : (
        <>
          <span className="selection-kind">
            {type === "node"
              ? "Poteau"
              : type === "edge"
                ? slot?.kind === "wall"
                  ? "Voile"
                  : "Poutre"
                : panel
                  ? "Plancher"
                  : "Élément libre"}
          </span>
          {desktop && (slot || free) && (
            <div className="ribbon-field-pair">
              <Numeric
                compact
                shortLabel={
                  type === "edge" && slot?.kind === "wall" ? "e" : "b"
                }
                label={
                  type === "edge" && slot?.kind === "wall"
                    ? "Épaisseur"
                    : "Largeur b"
                }
                value={(slot ?? free)!.b}
                unit="cm"
                min={1}
                max={1000}
                onChange={(b) => patchSelected({ b })}
              />
              {!(type === "edge" && slot?.kind === "wall") && (
                <Numeric
                  compact
                  shortLabel="h"
                  label="Hauteur h"
                  value={(slot ?? free)!.h}
                  unit="cm"
                  min={1}
                  max={1000}
                  onChange={(h) => patchSelected({ h })}
                />
              )}
            </div>
          )}
          {desktop && panel && (
            <>
              {panel.level.slab === "dp" ? (
                <Numeric
                  compact
                  shortLabel="e"
                  label="Épaisseur"
                  value={panel.level.thickness * 100}
                  unit="cm"
                  min={1}
                  max={1000}
                  onChange={(h) =>
                    patchSelected({
                      level: { ...panel.level, thickness: h / 100 },
                    })
                  }
                />
              ) : (
                <span
                  className="selection-kind"
                  aria-label="Type de plancher actuel"
                >
                  {
                    ({ cc12: "12+4", cc16: "16+4", cc20: "20+5" } as const)[
                      panel.level.slab
                    ]
                  }
                </span>
              )}
              <Numeric
                compact
                shortLabel="Q"
                label="Exploitation Q"
                value={panel.level.q}
                unit="kN/m²"
                min={0}
                max={1000}
                onChange={(q) =>
                  patchSelected({ level: { ...panel.level, q } })
                }
              />
            </>
          )}
          <IconButton
            label="Modifier la sélection"
            onClick={() => {
              if (desktop) setDetails(true);
              else setEditor(structuredClone(floor));
            }}
          >
            <Pencil />
          </IconButton>
        </>
      )}
      <IconButton label="Désélectionner" onClick={clear}>
        <X />
      </IconButton>
    </div>
  );
  const calculationTools = (
    <RibbonGroup label="Calcul">
      <IconButton
        variant="default"
        label="Calculer le bâtiment"
        data-tour="calculate"
        disabled={calculation.busy}
        onClick={() => void run()}
      >
        <Calculator />
      </IconButton>
      <IconButton
        label="Ouvrir les résultats"
        data-tour="results"
        onClick={() => {
          setResultsOpen(true);
          studyAction("results:open");
        }}
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
        onClick={() => openParameters(true)}
      >
        <Settings />
      </IconButton>
      <div className="project-auxiliary-tools">
        <ShortcutHelp />
      </div>
    </>
  );
  const ParametersContainer = desktop ? DetailDialog : EditorSheet;
  return (
    <div
      className={`project-page building-page analysis-page ${desktop ? "desktop-building-workspace" : ""} ${Object.entries(
        annotations,
      )
        .flatMap(([kind, flags]) =>
          typeof flags === "object"
            ? [
                !flags.labels ? `building-hide-${kind}-labels` : "",
                !flags.values ? `building-hide-${kind}-values` : "",
              ]
            : !flags
              ? `building-hide-${kind}`
              : "",
        )
        .join(" ")}`}
    >
      <ProjectHeader
        type="building"
        project={project}
        data={model}
        name={name}
        setName={setName}
        workbench
        hideBack
        flowActions
        trailingToolbar={
          selectedKeys.length > 0 ? (
            <RibbonGroup
              label={`Sélection · ${selectedKeys.length}`}
              className="ribbon-parameters selection-ribbon-group"
            >
              {compactSelection}
            </RibbonGroup>
          ) : undefined
        }
        toolbar={
          <>
            {!desktop && calculationTools}
            <RibbonGroup label="Édition">
              {" "}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <IconButton label="Ajouter" data-tour="add">
                    <Plus />
                  </IconButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={() => addFree("beam")}>
                    <Minus />
                    Poutre oblique
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => addFree("column")}>
                    <Columns3 />
                    Poteau libre
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      patchFloor(
                        resizeFloor(
                          floor,
                          Math.min(12, floor.spanX.length + 1),
                          floor.spanY.length,
                        ),
                      );
                      clear();
                    }}
                  >
                    <Grid2X2 />
                    Travée X
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      patchFloor(
                        resizeFloor(
                          floor,
                          floor.spanX.length,
                          Math.min(12, floor.spanY.length + 1),
                        ),
                      );
                      clear();
                    }}
                  >
                    <Square />
                    Travée Y
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
            <RibbonGroup label="Niveaux">{floorControls}</RibbonGroup>
            {contextualParameters && (
              <RibbonGroup
                label={`Niveau actif · ${floor.name}`}
                className="ribbon-parameters active-floor-group"
              >
                {contextualParameters}
              </RibbonGroup>
            )}
            <RibbonGroup label="Toiture">
              <IconButton
                label="Configurer la toiture"
                onClick={() => setRoofOpen(true)}
              >
                <House />
              </IconButton>
            </RibbonGroup>
            <RibbonGroup label="Vue">
              <Button
                size="sm"
                className="dimension-view-button"
                aria-pressed={view === "plan"}
                variant={view === "plan" ? "secondary" : "ghost"}
                onClick={() => setView("plan")}
              >
                2D
              </Button>
              <Button
                size="sm"
                className="dimension-view-button"
                aria-pressed={view === "3d"}
                variant={view === "3d" ? "secondary" : "ghost"}
                onClick={() => setView("3d")}
              >
                3D
              </Button>
              <Choice
                label="Cas de charges"
                value={field}
                options={["G", "Q", "ELS", "ELU"]}
                onChange={(v) => setField(v as LoadCase)}
              />
              <BuildingViewMenu
                annotations={annotations}
                is3D={view === "3d"}
                focused={focusAnnotations && !!selection}
                canFocus={selectedKeys.length === 1}
                onFocus={isolateAnnotations}
                onChange={setAnnotations}
                influence={influence}
                onInfluence={setInfluence}
                allLevels={allLevels}
                onAllLevels={setAllLevels}
                orbitAxis={orbitAxis}
                onOrbitAxis={setOrbitAxis}
              />
            </RibbonGroup>
            <RibbonGroup label="Charges critiques">
              <IconButton
                label="Poteau le plus chargé"
                onClick={() => highest("column")}
              >
                <BuildingCriticalIcon kind="column" />
              </IconButton>
              <IconButton
                label="Poutre la plus chargée"
                onClick={() => highest("beam")}
              >
                <BuildingCriticalIcon kind="beam" />
              </IconButton>
            </RibbonGroup>
            {desktop && calculationTools}
          </>
        }
        tools={headerTools}
        extra={
          <SectionTypes
            value={model.sectionTypes}
            onChange={(sectionTypes) => commit({ ...model, sectionTypes })}
          />
        }
      />
      {duplication && (
        <BuildingDuplication
          source={floor}
          keys={selectedKeys}
          initialSelection={duplication.selection}
          defaultName={`R+${model.floors.length}`}
          onClose={() => setDuplication(null)}
          onDuplicate={(copy, position) => {
            if (model.floors.length >= 60) {
              toast.error("Le bâtiment contient déjà 60 niveaux.");
              return;
            }
            if (model.floors.some((f) => f.name === copy.name)) {
              toast.error("Un niveau porte déjà ce nom.");
              return;
            }
            const floors = [...model.floors],
              index = position === "top" ? floors.length : active + 1;
            floors.splice(index, 0, copy);
            if (commit({ ...model, floors })) {
              changeFloor(index);
              setDuplication(null);
            }
          }}
        />
      )}
      <SceneMenu
        point={menu}
        onClose={() => setMenu(null)}
        actions={actions}
        canPaste={!!clipboard && selected?.family === clipboard.family}
      />
      <div className="analysis-canvas-workspace" aria-busy={calculation.busy}>
        <Playground
          immersive
          height={650}
          label={view === "plan" ? "Plan du niveau" : "Vue 3D du bâtiment"}
          selected={
            view === "plan"
              ? selection
              : selection
                ? `${floor.id}|${selection}`
                : null
          }
          selectedKeys={
            desktop
              ? view === "plan"
                ? selectedKeys
                : selectedKeys.map((k) => `${floor.id}|${k}`)
              : undefined
          }
          orbitAxis={orbitAxis}
          onSelect={
            view === "plan"
              ? select
              : (key, additive) => {
                  setCritical(null);
                  const [id, ...parts] = key.split("|");
                  const i = model.floors.findIndex((f) => f.id === id);
                  if (i < 0) return;
                  if (i === active) {
                    select(parts.join("|"), additive);
                    return;
                  }
                  setActive(i);
                  setSelection(parts.join("|"));
                  setSelectedKeys([parts.join("|")]);
                  if (!desktop && !calculation.fresh)
                    setEditor(structuredClone(model.floors[i]));
                }
          }
          onOrbit={
            view === "3d"
              ? (delta) => {
                  setYaw((value) =>
                    Number(
                      (
                        ((((value + delta.x * 0.35) % 360) + 540) % 360) -
                        180
                      ).toFixed(1),
                    ),
                  );
                  setPitch((value) =>
                    Number(
                      Math.max(
                        -80,
                        Math.min(80, value + delta.y * 0.3),
                      ).toFixed(1),
                    ),
                  );
                }
              : undefined
          }
          onReset={
            view === "3d"
              ? () => {
                  setYaw(35);
                  setPitch(28);
                }
              : undefined
          }
          onDeselect={clear}
          onElementDrag={view === "plan" ? dragElement : undefined}
          onElementContext={
            desktop
              ? (key, p) => {
                  if (view === "plan") {
                    if (!selectedKeys.includes(key)) select(key);
                  } else {
                    const [id, ...parts] = key.split("|"),
                      index = model.floors.findIndex((f) => f.id === id);
                    if (index < 0) return;
                    const element = parts.join("|");
                    if (index !== active) {
                      setActive(index);
                      setSelection(element);
                      setSelectedKeys([element]);
                    } else if (!selectedKeys.includes(element)) select(element);
                  }
                  setMenu(p);
                }
              : undefined
          }
          controls={
            <>
              <nav
                className="building-floor-nav"
                aria-label="Niveaux du bâtiment"
              >
                {[...model.floors].reverse().map((f, reverseIndex) => {
                  const index = model.floors.length - 1 - reverseIndex;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      aria-current={index === active ? "step" : undefined}
                      onClick={() => changeFloor(index)}
                    >
                      <Layers size={14} />
                      <span>{f.name}</span>
                    </button>
                  );
                })}
              </nav>
              <div className="canvas-result-status">
                <CalculationStatus
                  fresh={calculation.fresh}
                  hasResult={!!calculation.result}
                />
                {selectedKeys.length > 1 && (
                  <span className="selection-count">
                    {selectedKeys.length} sélectionnés · Shift + clic pour
                    retirer
                  </span>
                )}
              </div>
              {calculation.error && (
                <div className="canvas-error">
                  <Notice danger>{calculation.error}</Notice>
                </div>
              )}
              {selection && !mixedSelection && !critical && (
                <div
                  className="building-selection-summary"
                  data-testid="selected-building-result"
                >
                  <strong>
                    {type === "node"
                      ? `Poteau ${results.columns.find((n) => n.key === key)?.label ?? key}`
                      : type === "edge"
                        ? (results.edges.find((e) => e.key === key)?.label ??
                          "Élément absent")
                        : type === "panel"
                          ? `Panneau ${floor.panels[key]?.label}`
                          : "Élément libre"}
                  </strong>
                  {calculation.fresh &&
                    (type === "node" || type === "edge") && (
                      <span className="mono">
                        {field} ·{" "}
                        {fmt(
                          type === "node"
                            ? caseValue(
                                results.columns.find((n) => n.key === key)?.g ??
                                  0,
                                results.columns.find((n) => n.key === key)?.q ??
                                  0,
                                field,
                              )
                            : caseValue(
                                results.edges.find((e) => e.key === key)?.g ??
                                  0,
                                results.edges.find((e) => e.key === key)?.q ??
                                  0,
                                field,
                              ),
                        )}{" "}
                        {type === "node" ? "kN" : "kN/m"}
                      </span>
                    )}
                  {view === "3d" && (
                    <IconButton
                      label={
                        focusAnnotations
                          ? "Afficher les autres annotations"
                          : "Isoler les annotations de cet élément"
                      }
                      aria-pressed={focusAnnotations}
                      onClick={() => isolateAnnotations(!focusAnnotations)}
                    >
                      <Focus />
                    </IconButton>
                  )}
                  {!desktop && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditor(structuredClone(floor))}
                    >
                      Modifier l’élément
                    </Button>
                  )}
                </div>
              )}
              {critical && calculation.fresh && (
                <div className="critical-element" role="status">
                  <strong>{critical.label}</strong>
                  <span className="mono">
                    {field} · {fmt(critical.value)} {critical.unit}
                  </span>
                  <IconButton
                    label="Fermer le repère"
                    onClick={() => setCritical(null)}
                  >
                    <X />
                  </IconButton>
                </div>
              )}
            </>
          }
        >
          {view === "plan" ? (
            <BuildingScene
              floor={floor}
              roof={activeRoof}
              showInfluence={influence}
              selected={selection}
              results={results}
              showResults={calculation.fresh}
              field={field}
            />
          ) : (
            <Building3D
              model={model}
              rows={calculation.fresh ? calculation.result : undefined}
              activeFloor={floor.id}
              annotations={annotations}
              allLevels={allLevels}
              annotationTarget={
                focusAnnotations && selection
                  ? `${floor.id}|${selection}`
                  : undefined
              }
              field={field}
              yaw={yaw}
              pitch={pitch}
              selected={
                critical
                  ? `${critical.floor}|${critical.key}`
                  : selection
                    ? `${floor.id}|${selection}`
                    : undefined
              }
            />
          )}
        </Playground>
        <CalculationOverlay busy={calculation.busy} />
      </div>
      <RoofEditor
        open={roofOpen}
        onOpenChange={setRoofOpen}
        value={model.roof}
        floor={model.floors.at(-1)!}
        onApply={(roof) => {
          if (!commit({ ...model, roof })) return false;
          clear();
          setActive(model.floors.length - 1);
          if (roof.enabled) setView("3d");
          return true;
        }}
      />
      <ParametersContainer
        open={gridOpen}
        onOpenChange={openGrid}
        title={`Grille · ${floor.name}`}
        description="Toutes les travées et la hauteur du niveau actif. Les changements s’appliquent directement à ce niveau."
      >
        <div className="parameters-sheet-content">{gridFields}</div>
        <EditorFooter>
          <Button data-tour="grid-done" onClick={() => openGrid(false)}>
            Revenir au schéma
          </Button>
        </EditorFooter>
      </ParametersContainer>
      <ParametersContainer
        open={parameters}
        onOpenChange={openParameters}
        title="Paramètres du bâtiment"
      >
        <div className="parameters-sheet-content">{globalFields}</div>
        <EditorFooter>
          <Button
            data-tour="parameters-done"
            onClick={() => openParameters(false)}
          >
            Revenir au schéma
          </Button>
        </EditorFooter>
      </ParametersContainer>
      <DetailDialog
        open={details && !!selection}
        onOpenChange={setDetails}
        title="Détails de la sélection"
      >
        <div className="editor-fields">{selectionFields(true)}</div>
      </DetailDialog>
      <EditorSheet
        open={!!editor && !desktop}
        onOpenChange={(v) => {
          if (!v) setEditor(null);
        }}
        title={
          type === "panel"
            ? "Panneau de dalle"
            : type === "node"
              ? "Poteau de la grille"
              : type === "edge"
                ? "Élément porteur"
                : "Élément libre"
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (editor && patchFloor(editor)) {
              setEditor(null);
              studyAction("element:applied");
            }
          }}
        >
          <div className="editor-fields">{selectionFields(true)}</div>
          <EditorFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditor(null)}
            >
              Annuler
            </Button>
            <Button data-tour="element-apply" type="submit">
              Appliquer
            </Button>
          </EditorFooter>
        </form>
      </EditorSheet>
      <EditorSheet
        open={resultsOpen}
        onOpenChange={setResultsOpen}
        desktopSide="right"
        className="building-results-sheet"
        title="Résultats du bâtiment"
        description="Apports par étage et efforts cumulés du sommet vers les fondations."
      >
        <div className="numerical-results">
          <CalculationStatus
            fresh={calculation.fresh}
            hasResult={!!calculation.result}
          />
          {calculation.fresh && calculation.result ? (
            <>
              {calculation.result[0].local.roof && (
                <RoofResults roof={calculation.result[0].local.roof} />
              )}
              <Panel title="Cumul du haut vers le bas">
                <div className="table-wrap">
                  <table data-testid="building-cumulative">
                    <thead>
                      <tr>
                        <th>Niveau</th>
                        <th>G étage · kN</th>
                        <th>Q étage · kN</th>
                        <th>ΣG · kN</th>
                        <th>ΣQ réduit · kN</th>
                        <th>ELS · kN</th>
                        <th>ELU · kN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculation.result.map((r) => (
                        <tr key={r.id}>
                          <th>{r.name}</th>
                          {[
                            r.local.totalG,
                            r.local.totalQ,
                            r.cumulativeG,
                            r.cumulativeQ,
                            caseValue(r.cumulativeG, r.cumulativeQ, "ELS"),
                            caseValue(r.cumulativeG, r.cumulativeQ, "ELU"),
                          ].map((v, i) => (
                            <td key={i}>{fmt(v)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
              <Panel title={`Poteaux cumulés · ${floor.name}`}>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Poteau</th>
                        <th>ΣG · kN</th>
                        <th>ΣQ brut · kN</th>
                        <th>α effectif</th>
                        <th>ΣQ réduit · kN</th>
                        <th>ELS · kN</th>
                        <th>ELU · kN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {current?.results.columns.map((n) => {
                        const raw = n.live.reduce((s, l) => s + l.q, 0);
                        return (
                          <tr key={n.key}>
                            <th>{n.label}</th>
                            {[
                              n.g,
                              raw,
                              raw ? n.q / raw : 1,
                              n.q,
                              n.nEls,
                              n.nElu,
                            ].map((v, i) => (
                              <td key={i}>{fmt(v, i === 2 ? 3 : 2)}</td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Panel>
              <Panel title={`Poutres et voiles · ${floor.name}`}>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Élément</th>
                        <th>L · m</th>
                        <th>G · kN/m</th>
                        <th>Q · kN/m</th>
                        <th>ELS · kN/m</th>
                        <th>ELU · kN/m</th>
                      </tr>
                    </thead>
                    <tbody>
                      {current?.results.edges.map((e) => (
                        <tr key={e.key}>
                          <th>{e.label}</th>
                          {[e.length, e.g, e.q, e.els, e.elu].map((v, i) => (
                            <td key={i}>{fmt(v)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
              <Panel title="Vent par niveau">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Niveau</th>
                        <th>Vent simplifié · kN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculation.result.map((r) => (
                        <tr key={r.id}>
                          <th>{r.name}</th>
                          <td>{fmt(r.wind.force)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
              <Notice>
                Descente gravitaire par surfaces d’influence et réactions de
                poutres isostatiques. Poids propres des sections entières inclus
                (25 kN/m³). Les panneaux sans séparatrice redistribuent leur
                surface aux rives présentes. Les transferts entre porteurs non
                alignés et l’analyse globale de stabilité ne sont pas résolus.
                Les charges des éléments libres sont saisies explicitement ;
                leur Q n’est pas dégressé sans catégorie d’usage.
              </Notice>
            </>
          ) : (
            <div className="results-awaiting">
              <h3>Un calcul à jour est nécessaire</h3>
              <p>
                Calculez pour afficher les cumulés et repérer les porteurs les
                plus chargés.
              </p>
              <Button onClick={() => void run()}>Calculer le bâtiment</Button>
            </div>
          )}
        </div>
        <EditorFooter>
          <Button
            data-tour="results-done"
            onClick={() => {
              setResultsOpen(false);
              studyAction("results:close");
            }}
          >
            Revenir au schéma
          </Button>
        </EditorFooter>
      </EditorSheet>
    </div>
  );
}
