import { useEffect, useMemo, useState } from "react";
import { Copy, Plus, Trash2, Undo2, Redo2, Printer } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EditorSheet, EditorFooter } from "@/components/editor-sheet";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Panel,
  ProjectHeader,
  Numeric,
  Choice,
  FormGrid,
  Metric,
  Notice,
  IconButton,
  Disclosure,
} from "@/components/common";
import { Playground, useCanvasGeometry } from "@/components/playground";
import { LevelEditor } from "@/components/level-editor";
import { WindFields } from "./descent-page";
import {
  buildingSchema,
  buildingDefaults,
  newFloor,
  resizeFloor,
  buildingResults,
  floorWind,
  floorSchema,
  nodeName,
  edgeKey,
  mergeNeighbors,
  mergePanels,
  splitPanelRect,
  type BuildingModel,
  type Floor,
} from "@/domain/building";
import { levelG, coatingG, elu } from "@/domain/engineering";
import { type Project } from "@/lib/storage";
import { useWorkspace } from "@/lib/workspace";
import { fmt, uid } from "@/lib/utils";
export function BuildingPage({ project }: { project?: Project }) {
  const { drafts, workspace } = useWorkspace(),
    key = project?.id ?? "building",
    [model, setModel] = useState<BuildingModel>(() => {
      const r = buildingSchema.safeParse(drafts.get(key) ?? project?.data);
      return r.success ? r.data : buildingDefaults();
    }),
    [name, setName] = useState(project?.name ?? "Bâtiment — nouveau projet"),
    [active, setActive] = useState(0),
    [tab, setTab] = useState("model"),
    [resultTab, setResultTab] = useState("columns"),
    [history, setHistory] = useState<BuildingModel[]>([]),
    [future, setFuture] = useState<BuildingModel[]>([]),
    [selection, setSelection] = useState<string | null>(null),
    [editor, setEditor] = useState<Floor | null>(null),
    [influence, setInfluence] = useState(true);
  const floor = model.floors[Math.min(active, model.floors.length - 1)],
    results = useMemo(() => buildingResults(floor), [floor]),
    wind = floorWind(model, Math.min(active, model.floors.length - 1));
  useEffect(() => {
    setSelection(null);
    setEditor(null);
  }, [floor.id]);
  useEffect(() => {
    drafts.set(key, model);
  }, [model, key, drafts]);
  const commit = (next: BuildingModel) => {
    const parsed = buildingSchema.safeParse(next);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setHistory((h) => [...h.slice(-29), model]);
    setFuture([]);
    setModel(parsed.data);
  };
  const patchFloor = (next: Floor) =>
    commit({
      ...model,
      floors: model.floors.map((f) => (f.id === floor.id ? next : f)),
    });
  const undo = (redo = false) => {
    const source = redo ? future : history;
    if (!source.length) return;
    setModel(source[source.length - 1]);
    if (redo) {
      setFuture((h) => h.slice(0, -1));
      setHistory((h) => [...h, model]);
    } else {
      setHistory((h) => h.slice(0, -1));
      setFuture((h) => [...h, model]);
    }
    setActive(0);
  };
  const select = (s: string, candidate = floor) => {
    setSelection(s);
    setEditor(structuredClone(candidate));
  };
  const addFree = (kind: "beam" | "column") => {
    const next = structuredClone(floor),
      id = uid();
    next.obliques.push({
      id,
      kind,
      x1: 1,
      y1: 1,
      x2: 5,
      y2: 4,
      b: 25,
      h: 40,
      angle: 0,
      area: 6,
      g: 4,
      q: 1.5,
    });
    select(`oblique|${id}`, next);
  };
  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editor) return;
    const parsed = floorSchema.safeParse(editor);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    patchFloor(parsed.data);
    setEditor(null);
  };
  const [selectedType, selectedKey] = (selection ?? "").split("|");
  const slot = editor
      ? selectedType === "node"
        ? editor.nodes[selectedKey]
        : selectedType === "edge"
          ? editor.edges[selectedKey]
          : null
      : null,
    panel =
      editor && selectedType === "panel" ? editor.panels[selectedKey] : null,
    oblique =
      editor && selectedType === "oblique"
        ? editor.obliques.find((o) => o.id === selectedKey)
        : null;
  const patchSlot = (v: Partial<NonNullable<typeof slot>>) => {
    if (!editor || !slot) return;
    const collection = selectedType === "node" ? "nodes" : "edges";
    setEditor({
      ...editor,
      [collection]: { ...editor[collection], [selectedKey]: { ...slot, ...v } },
    });
  };
  return (
    <div className="project-page building-page">
      <ProjectHeader
        type="building"
        project={project}
        data={model}
        name={name}
        setName={setName}
        extra={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Imprimer les résultats"
            onClick={() => window.print()}
          >
            <Printer />
          </Button>
        }
      />
      <Tabs
        value={tab}
        onValueChange={(v) => {
          const invalid =
            document.querySelector<HTMLInputElement>("input:invalid");
          if (invalid) return invalid.reportValidity();
          setTab(v);
        }}
      >
        <TabsList className="building-tabs">
          <TabsTrigger value="model">Modélisation</TabsTrigger>
          <TabsTrigger value="wind">Vent</TabsTrigger>
          <TabsTrigger value="results">Résultats</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="floor-toolbar">
        <Choice
          label="Niveau actif"
          value={floor.id}
          options={model.floors.map((f) => ({ value: f.id, label: f.name }))}
          onChange={(id) =>
            setActive(model.floors.findIndex((f) => f.id === id))
          }
        />
        <div className="row-actions">
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const copy = {
                ...structuredClone(floor),
                id: uid(),
                name: `Copie de ${floor.name}`,
              };
              commit({ ...model, floors: [...model.floors, copy] });
              setActive(model.floors.length);
            }}
          >
            <Copy />
            <span>Dupliquer</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              commit({
                ...model,
                floors: [...model.floors, newFloor(`R+${model.floors.length}`)],
              });
              setActive(model.floors.length);
            }}
          >
            <Plus />
            <span>Niveau</span>
          </Button>
          <IconButton
            label="Supprimer le niveau actif"
            disabled={model.floors.length === 1}
            onClick={() => {
              commit({
                ...model,
                floors: model.floors.filter((f) => f.id !== floor.id),
              });
              setActive(0);
            }}
          >
            <Trash2 />
          </IconButton>
        </div>
      </div>
      {tab === "wind" ? (
        <div className="two-columns">
          <WindFields
            value={model}
            onChange={(v) => commit({ ...model, ...v })}
          />
          <Panel title="Vent par niveau">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Niveau</th>
                    <th>z milieu · m</th>
                    <th>qp · kN/m²</th>
                    <th>F vent ELU · kN</th>
                  </tr>
                </thead>
                <tbody>
                  {model.floors.map((f, i) => {
                    const w = floorWind(model, i);
                    return (
                      <tr key={f.id}>
                        <th>{f.name}</th>
                        <td>{fmt(w.z)}</td>
                        <td>{fmt(w.pressure)}</td>
                        <td>{fmt(w.force)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Notice>
              Vent simplifié conservé du logiciel d’origine, sans analyse de
              stabilité globale ni redistribution des efforts horizontaux.
            </Notice>
          </Panel>
        </div>
      ) : (
        <div
          className={`building-layout ${tab === "results" ? "show-results" : ""}`}
        >
          {tab === "model" && (
            <aside className="inspector">
              <Panel title="Grille de l’étage">
                <div className="field">
                  <Label htmlFor="floor-name">Nom du niveau</Label>
                  <Input
                    id="floor-name"
                    value={floor.name}
                    onChange={(e) =>
                      patchFloor({ ...floor, name: e.target.value })
                    }
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
                  <Numeric
                    label="Travées X"
                    value={floor.spanX.length}
                    min={1}
                    max={12}
                    step={1}
                    onChange={(nx) => {
                      if (Number.isInteger(nx))
                        patchFloor(resizeFloor(floor, nx, floor.spanY.length));
                    }}
                  />
                  <Numeric
                    label="Travées Y"
                    value={floor.spanY.length}
                    min={1}
                    max={12}
                    step={1}
                    onChange={(ny) => {
                      if (Number.isInteger(ny))
                        patchFloor(resizeFloor(floor, floor.spanX.length, ny));
                    }}
                  />
                </FormGrid>
                <Disclosure title="Portées des travées" defaultOpen>
                  {(["spanX", "spanY"] as const).map((axis) => (
                    <div key={axis} className="form-grid">
                      {floor[axis].map((v, i) => (
                        <Numeric
                          key={i}
                          label={`${axis === "spanX" ? "X" : "Y"} · travée ${i + 1}`}
                          value={v}
                          min={0.1}
                          max={100}
                          unit="m"
                          onChange={(v) =>
                            patchFloor({
                              ...floor,
                              [axis]: floor[axis].map((x, j) =>
                                j === i ? v : x,
                              ),
                            })
                          }
                        />
                      ))}
                    </div>
                  ))}
                </Disclosure>
              </Panel>
              <Panel title="Éléments hors grille">
                <p className="hint">
                  Poutres obliques et poteaux libres. Leurs charges sont
                  renseignées explicitement ; elles ne modifient pas la
                  répartition automatique de la grille.
                </p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <Plus />
                      Ajouter un élément
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => addFree("beam")}>
                      Poutre oblique
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => addFree("column")}>
                      Poteau libre
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {floor.obliques.map((o, i) => (
                  <button
                    className="element-row"
                    key={o.id}
                    onClick={() => select(`oblique|${o.id}`)}
                  >
                    <div>
                      <strong>
                        {o.kind === "beam" ? "Poutre" : "Poteau"} libre {i + 1}
                      </strong>
                      <small>
                        {fmt(o.b, 0)} × {fmt(o.h, 0)} cm
                      </small>
                    </div>
                  </button>
                ))}
              </Panel>
              <Notice>
                Sélectionnez un poteau, une poutre ou un panneau sur le plan
                pour modifier ses propriétés. Les éléments supprimés restent
                accessibles en pointillés.
              </Notice>
            </aside>
          )}
          <main className="building-workspace">
            <Panel
              title={`Plan de ${floor.name}`}
              action={
                <Label className="toggle">
                  <Switch checked={influence} onCheckedChange={setInfluence} />
                  Influences
                </Label>
              }
            >
              <Playground
                height={440}
                onSelect={(key) =>
                  tab === "results" ? setSelection(key) : select(key)
                }
                selected={selection}
                onDeselect={() => setSelection(null)}
                label="Plan 2D du niveau"
              >
                <BuildingScene
                  floor={floor}
                  showInfluence={influence}
                  selected={selection}
                  results={results}
                  showResults={tab === "results"}
                />
              </Playground>
              {selection && (
                <div
                  className="selected-result"
                  data-testid="selected-building-result"
                >
                  <strong>
                    {selection.startsWith("node|")
                      ? `Poteau ${(() => {
                          const [c, r] = selection
                            .slice(5)
                            .split(",")
                            .map(Number);
                          return nodeName(c, r);
                        })()}`
                      : selection.startsWith("edge|")
                        ? "Élément porteur sélectionné"
                        : selection.startsWith("panel|")
                          ? `Panneau ${floor.panels[selection.slice(6)]?.label ?? ""}`
                          : "Élément libre sélectionné"}
                  </strong>
                  {selection.startsWith("node|") &&
                    (() => {
                      const [c, r] = selection.slice(5).split(",").map(Number);
                      const result = results.columns.find(
                        (item) => item.label === nodeName(c, r),
                      );
                      return (
                        <span className="mono">
                          {result
                            ? `N_ELU ${fmt(result.nElu)} kN · A ${fmt(result.area)} m²`
                            : "Élément absent ou sans contribution"}
                        </span>
                      );
                    })()}
                  {selection.startsWith("edge|") &&
                    (() => {
                      const result = results.edges.find(
                        (item) => item.key === selection.slice(5),
                      );
                      return (
                        <span className="mono">
                          {result
                            ? `q_ELU ${fmt(result.elu)} kN/m · L ${fmt(result.length)} m`
                            : "Élément absent ou sans contribution"}
                        </span>
                      );
                    })()}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => select(selection)}
                  >
                    Modifier l’élément
                  </Button>
                </div>
              )}
              <div className="plan-legend">
                <span>
                  <i className="legend-node" />
                  Poteau
                </span>
                <span>
                  <i className="legend-beam" />
                  Poutre
                </span>
                <span>
                  <i className="legend-wall" />
                  Voile
                </span>
                <span>— — Élément supprimé</span>
                <span>
                  {tab === "results"
                    ? "Panneaux : kN/m² · porteurs : kN/m"
                    : "Sections : cm · panneaux : kN/m²"}
                </span>
              </div>
            </Panel>
            <div className="metrics-grid">
              <Metric
                label="Surface des panneaux actifs"
                value={results.area}
                unit="m²"
              />
              <Metric
                label="Charges ELU des panneaux"
                value={results.totalElu}
                unit="kN"
                tone="purple"
              />
              <Metric
                label="Vent sur cet étage · ELU"
                value={wind.force}
                unit="kN"
                tone="teal"
              />
            </div>
            {tab === "results" && (
              <>
                <Notice>
                  Résultats du niveau actif, indépendants des autres étages,
                  comme dans la version précédente. Les descentes cumulées se
                  trouvent dans les projets « Poteau isolé » et « Voile isolé ».
                </Notice>
                <Panel title="Résultats du niveau">
                  <Tabs value={resultTab} onValueChange={setResultTab}>
                    <TabsList className="results-tabs">
                      <TabsTrigger value="columns">Poteaux</TabsTrigger>
                      <TabsTrigger value="beams">Poutres</TabsTrigger>
                      <TabsTrigger value="walls">Voiles</TabsTrigger>
                      <TabsTrigger value="free">Éléments libres</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <div className="table-wrap">
                    {resultTab === "columns" ? (
                      <table>
                        <thead>
                          <tr>
                            <th>Poteau</th>
                            <th>Aire · m²</th>
                            <th>G · kN</th>
                            <th>Q · kN</th>
                            <th>N_ELU · kN</th>
                            <th>N_ELS · kN</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.columns.map((r) => (
                            <tr key={r.label}>
                              <th>{r.label}</th>
                              {[r.area, r.g, r.q, r.nElu, r.nEls].map(
                                (v, i) => (
                                  <td key={i}>{fmt(v)}</td>
                                ),
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : resultTab === "free" ? (
                      <table>
                        <thead>
                          <tr>
                            <th>Élément</th>
                            <th>Longueur · m</th>
                            <th>Effort ELU</th>
                            <th>Unité</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.obliques.map((o) => (
                            <tr key={o.id}>
                              <th>{o.label}</th>
                              <td>{o.kind === "beam" ? fmt(o.length) : "—"}</td>
                              <td>{fmt(o.elu)}</td>
                              <td>{o.kind === "beam" ? "kN/m" : "kN"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <table>
                        <thead>
                          <tr>
                            <th>Élément</th>
                            <th>L · m</th>
                            <th>q_ELU · kN/m</th>
                            <th>q_ELS · kN/m</th>
                            <th>M isost. · kN·m</th>
                            <th>Panneaux</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.edges
                            .filter(
                              (e) =>
                                e.kind ===
                                (resultTab === "beams" ? "beam" : "wall"),
                            )
                            .map((e) => (
                              <tr key={e.label}>
                                <th>{e.label}</th>
                                <td>{fmt(e.length)}</td>
                                <td>{fmt(e.elu)}</td>
                                <td>{fmt(e.els)}</td>
                                <td>
                                  {resultTab === "beams" ? fmt(e.moment) : "—"}
                                </td>
                                <td>{e.contributions.join(", ")}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </Panel>
                <Notice>
                  Répartition par bissectrices pour les poutres ; aires
                  géométriques et moyenne des panneaux adjacents pour les
                  poteaux. Les groupes de panneaux décrivent la modélisation ;
                  aucune résolution globale de dalle n’est effectuée.
                </Notice>
              </>
            )}
          </main>
        </div>
      )}
      <EditorSheet
        open={!!editor}
        title={
          selectedType === "panel"
            ? "Panneau de dalle"
            : selectedType === "node"
              ? "Poteau de la grille"
              : selectedType === "edge"
                ? "Élément porteur"
                : "Élément libre"
        }
        description="Modifiez les données, puis appliquez les changements au niveau actif."
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
      >
        <form onSubmit={apply}>
          <div className="editor-fields">
            {slot && (
              <>
                <Label className="toggle">
                  <Switch
                    checked={slot.exists}
                    onCheckedChange={(exists) => patchSlot({ exists })}
                  />
                  Élément présent
                </Label>
                {selectedType === "edge" && (
                  <Choice
                    label="Nature de l’élément"
                    value={slot.kind}
                    options={[
                      { value: "beam", label: "Poutre" },
                      { value: "wall", label: "Voile" },
                    ]}
                    onChange={(kind) =>
                      patchSlot({ kind: kind as "beam" | "wall" })
                    }
                  />
                )}
                <Choice
                  label="Préréglage de section"
                  value={
                    workspace.presets.find(
                      (p) => p.a === slot.b && (!p.b || p.b === slot.h),
                    )?.id ?? "custom"
                  }
                  options={[
                    { value: "custom", label: "Personnalisée" },
                    ...workspace.presets.map((p) => ({
                      value: p.id,
                      label: p.name,
                    })),
                  ]}
                  onChange={(id) => {
                    const p = workspace.presets.find((p) => p.id === id);
                    if (p) patchSlot({ b: p.a, h: p.b ?? slot.h });
                  }}
                />
                <FormGrid>
                  <Numeric
                    label={slot.kind === "wall" ? "Épaisseur" : "Largeur b"}
                    value={slot.b}
                    min={1}
                    max={1000}
                    unit="cm"
                    onChange={(b) => patchSlot({ b })}
                  />
                  <Numeric
                    label="Hauteur h"
                    value={slot.h}
                    min={1}
                    max={1000}
                    unit="cm"
                    onChange={(h) => patchSlot({ h })}
                  />
                </FormGrid>
              </>
            )}
            {panel && editor && (
              <>
                <Label className="toggle">
                  <Switch
                    checked={panel.exists}
                    onCheckedChange={(exists) =>
                      setEditor({
                        ...editor,
                        panels: {
                          ...editor.panels,
                          [selectedKey]: { ...panel, exists },
                        },
                      })
                    }
                  />
                  Panneau présent
                </Label>
                <div className="field">
                  <Label htmlFor="panel-name">Désignation</Label>
                  <Input
                    id="panel-name"
                    value={panel.label}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        panels: {
                          ...editor.panels,
                          [selectedKey]: { ...panel, label: e.target.value },
                        },
                      })
                    }
                  />
                </div>
                <LevelEditor
                  panel
                  level={panel.level}
                  onChange={(level) => {
                    const next = structuredClone(editor);
                    for (const [key, p] of Object.entries(next.panels))
                      if (
                        key === selectedKey ||
                        (panel.group && p.group === panel.group)
                      )
                        p.level = structuredClone(level);
                    setEditor(next);
                  }}
                />
                {mergeNeighbors(editor, selectedKey).length > 0 && (
                  <Choice
                    label="Regrouper sans poutre séparatrice"
                    value="none"
                    options={[
                      { value: "none", label: "Choisir un panneau adjacent" },
                      ...mergeNeighbors(editor, selectedKey).map((key) => ({
                        value: key,
                        label: editor.panels[key].label,
                      })),
                    ]}
                    onChange={(key) => {
                      if (key !== "none")
                        setEditor(mergePanels(editor, selectedKey, key));
                    }}
                  />
                )}
                {panel.group && (
                  <>
                    <p className="hint">
                      Les changements de charges s’appliquent à tous les
                      panneaux de ce groupe.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const next = structuredClone(editor);
                        next.panels[selectedKey].group = null;
                        setEditor(next);
                      }}
                    >
                      Dissocier ce panneau
                    </Button>
                  </>
                )}
              </>
            )}
            {oblique && editor && (
              <>
                <FormGrid>
                  {(
                    [
                      "x1",
                      "y1",
                      ...(oblique.kind === "beam" ? ["x2", "y2"] : []),
                    ] as ("x1" | "y1" | "x2" | "y2")[]
                  ).map((axis) => (
                    <Numeric
                      key={axis}
                      label={axis}
                      value={oblique[axis]}
                      min={-1000}
                      max={1000}
                      unit="m"
                      onChange={(v) =>
                        setEditor({
                          ...editor,
                          obliques: editor.obliques.map((o) =>
                            o.id === oblique.id ? { ...o, [axis]: v } : o,
                          ),
                        })
                      }
                    />
                  ))}
                </FormGrid>
                <FormGrid>
                  {(["b", "h"] as const).map((axis) => (
                    <Numeric
                      key={axis}
                      label={axis === "b" ? "Largeur b" : "Hauteur h"}
                      value={oblique[axis]}
                      min={1}
                      unit="cm"
                      onChange={(v) =>
                        setEditor({
                          ...editor,
                          obliques: editor.obliques.map((o) =>
                            o.id === oblique.id ? { ...o, [axis]: v } : o,
                          ),
                        })
                      }
                    />
                  ))}
                </FormGrid>
                {oblique.kind === "column" && (
                  <>
                    <Numeric
                      label="Rotation en plan"
                      value={oblique.angle}
                      min={-360}
                      max={360}
                      unit="°"
                      onChange={(angle) =>
                        setEditor({
                          ...editor,
                          obliques: editor.obliques.map((o) =>
                            o.id === oblique.id ? { ...o, angle } : o,
                          ),
                        })
                      }
                    />
                    <Numeric
                      label="Aire d’influence saisie"
                      value={oblique.area}
                      unit="m²"
                      onChange={(area) =>
                        setEditor({
                          ...editor,
                          obliques: editor.obliques.map((o) =>
                            o.id === oblique.id ? { ...o, area } : o,
                          ),
                        })
                      }
                    />
                  </>
                )}
                <FormGrid>
                  {(["g", "q"] as const).map((axis) => (
                    <Numeric
                      key={axis}
                      label={
                        axis === "g" ? "Charge permanente G" : "Exploitation Q"
                      }
                      value={oblique[axis]}
                      unit={oblique.kind === "beam" ? "kN/m" : "kN/m²"}
                      onChange={(v) =>
                        setEditor({
                          ...editor,
                          obliques: editor.obliques.map((o) =>
                            o.id === oblique.id ? { ...o, [axis]: v } : o,
                          ),
                        })
                      }
                    />
                  ))}
                </FormGrid>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    patchFloor({
                      ...editor,
                      obliques: editor.obliques.filter(
                        (o) => o.id !== oblique.id,
                      ),
                    });
                    setEditor(null);
                    setSelection(null);
                  }}
                >
                  Supprimer cet élément
                </Button>
              </>
            )}
          </div>
          <EditorFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditor(null);
              }}
            >
              Annuler
            </Button>
            <Button type="submit">Appliquer</Button>
          </EditorFooter>
        </form>
      </EditorSheet>
    </div>
  );
}
function BuildingScene({
  floor,
  showInfluence,
  selected,
  results,
  showResults,
}: {
  floor: Floor;
  showInfluence: boolean;
  selected: string | null;
  results: ReturnType<typeof buildingResults>;
  showResults: boolean;
}) {
  const { units, height } = useCanvasGeometry();
  const xs = [0],
    ys = [0];
  for (const n of floor.spanX) xs.push(xs[xs.length - 1] + n);
  for (const n of floor.spanY) ys.push(ys[ys.length - 1] + n);
  const scale = Math.min(
      (1000 - 80 * units) / xs[xs.length - 1],
      Math.max(100, height - 110 * units) / ys[ys.length - 1],
    ),
    ox = (1000 - xs[xs.length - 1] * scale) / 2,
    oy = 42 * units,
    X = (x: number) => ox + x * scale,
    Y = (y: number) => oy + y * scale;
  return (
    <>
      {xs.map((x, c) => (
        <g key={c}>
          <line
            x1={X(x)}
            x2={X(x)}
            y1={oy - 18 * units}
            y2={Y(ys[ys.length - 1]) + 30}
            stroke="var(--border)"
            strokeDasharray="5 5"
          />
          <circle
            cx={X(x)}
            cy={oy - 24 * units}
            r={9 * units}
            fill="var(--card)"
            stroke="var(--border)"
          />
          <text
            x={X(x)}
            y={oy - 20 * units}
            textAnchor="middle"
            fill="var(--muted-foreground)"
            fontSize="12"
          >
            {String.fromCharCode(65 + c)}
          </text>
        </g>
      ))}
      {ys.map((y, r) => (
        <g key={r}>
          <line
            x1={ox - 24 * units}
            x2={X(xs[xs.length - 1]) + 24 * units}
            y1={Y(y)}
            y2={Y(y)}
            stroke="var(--border)"
            strokeDasharray="5 5"
          />
          <text
            x={ox - 34 * units}
            y={Y(y) + 4}
            fill="var(--muted-foreground)"
            fontSize="12"
          >
            {r + 1}
          </text>
        </g>
      ))}
      {Object.entries(floor.panels).map(([key, p]) => {
        const [c, r] = key.split(",").map(Number),
          x = X(xs[c]),
          y = Y(ys[r]),
          w = floor.spanX[c] * scale,
          h = floor.spanY[r] * scale;
        return (
          <g
            key={key}
            data-element={`panel|${key}`}
            className="svg-element"
            tabIndex={0}
            role="button"
          >
            <rect
              x={x + 5}
              y={y + 5}
              width={Math.max(1, w - 10)}
              height={Math.max(1, h - 10)}
              fill={
                p.exists
                  ? p.group
                    ? "var(--purple)"
                    : "var(--primary)"
                  : "transparent"
              }
              fillOpacity={selected === `panel|${key}` ? 0.24 : 0.08}
              stroke={p.exists ? "var(--border)" : "var(--muted-foreground)"}
              strokeDasharray={p.exists ? undefined : "4 6"}
            />
            {showInfluence &&
              p.exists &&
              Object.entries(splitPanelRect(x, y, w, h)).map(
                ([side, points]) => {
                  const edge =
                    side === "top"
                      ? edgeKey(true, r, c)
                      : side === "bottom"
                        ? edgeKey(true, r + 1, c)
                        : side === "left"
                          ? edgeKey(false, c, r)
                          : edgeKey(false, c + 1, r);
                  const support = floor.edges[edge];
                  const picked =
                    selected?.startsWith("edge|") &&
                    floor.edges[selected.slice(5)]?.exists;
                  const highlighted =
                    selected === `edge|${edge}` && support?.exists;
                  return (
                    <polygon
                      key={side}
                      data-influence-side={side}
                      data-influence-edge={edge}
                      data-influence-active={!!highlighted}
                      points={points.map((point) => point.join(",")).join(" ")}
                      fill={
                        !support?.exists
                          ? "var(--muted-foreground)"
                          : support.kind === "wall"
                            ? "var(--teal)"
                            : "var(--orange)"
                      }
                      fillOpacity={highlighted ? 0.3 : picked ? 0.035 : 0.1}
                      stroke={highlighted ? "var(--orange)" : "var(--border)"}
                      strokeWidth={highlighted ? 2 : 0.75}
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                },
              )}
            {showInfluence &&
              p.exists &&
              selected?.startsWith("node|") &&
              (() => {
                const [sc, sr] = selected.slice(5).split(",").map(Number);
                if (
                  !floor.nodes[`${sc},${sr}`]?.exists ||
                  (sc !== c && sc !== c + 1) ||
                  (sr !== r && sr !== r + 1)
                )
                  return null;
                return (
                  <rect
                    data-testid="node-influence"
                    x={sc === c ? x : x + w / 2}
                    y={sr === r ? y : y + h / 2}
                    width={w / 2}
                    height={h / 2}
                    fill="var(--primary)"
                    fillOpacity=".3"
                    stroke="var(--primary)"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })()}
            <text
              x={x + w / 2}
              y={y + h / 2 - 6 * units}
              textAnchor="middle"
              fill="var(--foreground)"
              fontSize="14"
            >
              {p.exists ? p.label : "Vide"}
            </text>
            {p.exists && (
              <text
                x={x + w / 2}
                y={y + h / 2 + 12 * units}
                textAnchor="middle"
                fill="var(--muted-foreground)"
                fontSize="10"
                className="numeric"
              >
                {fmt(elu(levelG(p.level) + coatingG(p.level), p.level.q))}
              </text>
            )}
          </g>
        );
      })}
      {Object.entries(floor.edges).map(([key, e]) => {
        const [orientation, l, s] = key.split(":"),
          line = Number(l),
          segment = Number(s),
          horizontal = orientation === "h",
          x1 = X(horizontal ? xs[segment] : xs[line]),
          y1 = Y(horizontal ? ys[line] : ys[segment]),
          x2 = X(horizontal ? xs[segment + 1] : xs[line]),
          y2 = Y(horizontal ? ys[line] : ys[segment + 1]);
        return (
          <g
            key={key}
            data-element={`edge|${key}`}
            className="svg-element"
            tabIndex={0}
            role="button"
          >
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={
                e.exists
                  ? e.kind === "wall"
                    ? "var(--teal)"
                    : "var(--primary)"
                  : "var(--muted-foreground)"
              }
              data-selection-bounds="true"
              strokeWidth={e.exists ? (e.kind === "wall" ? 9 : 5) : 1.5}
              vectorEffect="non-scaling-stroke"
              strokeDasharray={e.exists ? undefined : "5 6"}
            />
            {e.exists && (
              <text
                x={(x1 + x2) / 2 + (horizontal ? 0 : -10 * units)}
                y={(y1 + y2) / 2 - (horizontal ? 10 * units : 0)}
                textAnchor="middle"
                transform={
                  horizontal
                    ? undefined
                    : `rotate(-90 ${(x1 + x2) / 2 - 10 * units} ${(y1 + y2) / 2})`
                }
                className="numeric"
                style={{ fontSize: `${10 * units}px` }}
              >
                {showResults
                  ? `${fmt(results.edges.find((item) => item.key === key)?.elu ?? 0, 1)} kN/m`
                  : `${fmt(e.b, 0)}×${fmt(e.h, 0)}`}
              </text>
            )}
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="transparent"
              strokeWidth="28"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
      {Object.entries(floor.nodes).map(([key, n]) => {
        const [c, r] = key.split(",").map(Number);
        return (
          <g
            key={key}
            data-element={`node|${key}`}
            className="svg-element"
            tabIndex={0}
            role="button"
          >
            <rect
              data-selection-bounds="true"
              x={X(xs[c]) - 7 * units}
              y={Y(ys[r]) - 7 * units}
              width={14 * units}
              height={14 * units}
              fill={n.exists ? "var(--primary)" : "var(--plot)"}
              stroke="var(--primary)"
              strokeDasharray={n.exists ? undefined : "2 2"}
            />
            <circle
              cx={X(xs[c])}
              cy={Y(ys[r])}
              r={18 * units}
              fill="transparent"
            />
            <text
              x={X(xs[c]) + 10 * units}
              y={Y(ys[r]) + 17 * units}
              className="numeric"
            >
              {nodeName(c, r)}
            </text>
          </g>
        );
      })}
      {floor.obliques.map((o, i) => (
        <g
          key={o.id}
          data-element={`oblique|${o.id}`}
          className="svg-element"
          tabIndex={0}
          role="button"
        >
          {o.kind === "beam" ? (
            <>
              <line
                x1={X(o.x1)}
                y1={Y(o.y1)}
                x2={X(o.x2)}
                y2={Y(o.y2)}
                stroke="var(--orange)"
                strokeWidth="6"
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={X(o.x1)}
                y1={Y(o.y1)}
                x2={X(o.x2)}
                y2={Y(o.y2)}
                stroke="transparent"
                strokeWidth="28"
                vectorEffect="non-scaling-stroke"
              />
            </>
          ) : (
            <rect
              x={X(o.x1) - 7 * units}
              y={Y(o.y1) - 7 * units}
              width={14 * units}
              height={14 * units}
              fill="var(--orange)"
              transform={`rotate(${o.angle} ${X(o.x1)} ${Y(o.y1)})`}
            />
          )}
          <text
            x={X(o.x1) + 10}
            y={Y(o.y1) - 10}
            fontSize="12"
            fill="var(--orange)"
          >
            L{i + 1}
          </text>
        </g>
      ))}
      {floor.spanX.map((v, i) => (
        <text
          key={i}
          x={X((xs[i] + xs[i + 1]) / 2)}
          y={Y(ys[ys.length - 1]) + 30 * units}
          textAnchor="middle"
          fontSize="12"
          fill="var(--muted-foreground)"
          className="numeric"
        >
          {fmt(v)} m
        </text>
      ))}
      {floor.spanY.map((v, i) => (
        <text
          key={i}
          x={X(xs[xs.length - 1]) + 12 * units}
          y={Y((ys[i] + ys[i + 1]) / 2)}
          fontSize="12"
          fill="var(--muted-foreground)"
          className="numeric"
        >
          {fmt(v)} m
        </text>
      ))}
    </>
  );
}
