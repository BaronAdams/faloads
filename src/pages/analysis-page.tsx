import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Undo2,
  Redo2,
  MoveRight,
  ChevronRight,
  Calculator,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Playground, Arrow, Support } from "@/components/playground";
import {
  beamPreset,
  framePreset,
  beamSchema,
  frameSchema,
  resizeBeam,
  solveBeam,
  solveFrame,
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
type Selection = {
  type: "support" | "load" | "section" | "hinge" | "node" | "member" | "nodal";
  id: string;
};
const fieldNames = {
  M: "Moment M",
  V: "Effort tranchant V",
  N: "Effort normal N",
  v: "Déformée",
  theta: "Rotation",
  structure: "Structure",
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
  const [tab, setTab] = useState("model"),
    [view, setView] = useState<View>(kind === "beam" ? "M" : "structure"),
    [selection, setSelection] = useState<Selection | null>(null),
    [editor, setEditor] = useState<AnalysisModel | null>(null),
    [history, setHistory] = useState<AnalysisModel[]>([]),
    [future, setFuture] = useState<AnalysisModel[]>([]),
    [reactions, setReactions] = useState(true),
    [member, setMember] = useState(1),
    [amplification, setAmplification] = useState(100),
    [quick, setQuick] = useState(false);
  useEffect(() => {
    drafts.set(draftKey, model);
  }, [model, draftKey, drafts]);
  const analysis = useMemo(() => {
    try {
      if (model.kind === "beam") return { beam: solveBeam(model), error: null };
      return { frame: solveFrame(model), error: null };
    } catch (e) {
      return {
        error:
          e instanceof z.ZodError
            ? e.issues[0].message
            : e instanceof Error
              ? e.message
              : "Analyse impossible",
      };
    }
  }, [model]);
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
  };
  const open = (s: Selection, candidate = model) => {
    setSelection(s);
    setEditor(structuredClone(candidate));
  };
  const select = (key: string) => {
    const [type, id] = key.split(":");
    if (type === "member") {
      const i =
        model.kind === "frame" ? model.mem.findIndex((m) => m.id === id) : 0;
      setMember(Math.max(0, i));
    }
    open({ type: type as Selection["type"], id });
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
    }
    open({ type, id }, next);
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
      setSelection(null);
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
        <Button variant="outline" size="sm">
          <Plus />
          Ajouter
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {kind === "beam" ? (
          <>
            <DropdownMenuItem onSelect={() => add("support")}>
              Appui
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => add("load", "point")}>
              Force ponctuelle
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => add("load", "dist")}>
              Charge répartie
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => add("load", "moment")}>
              Moment
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => add("section")}>
              Tronçon de section
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => add("hinge")}>
              Rotule
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem onSelect={() => add("node")}>
              Nœud
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => add("member")}>
              Barre
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => add("nodal")}>
              Charge nodale
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
  return (
    <div className="project-page analysis-page">
      <ProjectHeader
        type={kind}
        project={project}
        data={model}
        name={name}
        setName={setName}
        extra={
          <IconButton
            label="Calcul simplifié G/Q"
            onClick={() => setQuick(true)}
          >
            <Calculator />
          </IconButton>
        }
      />
      <QuickAnalysis kind={kind} open={quick} onOpenChange={setQuick} />
      <div className="analysis-subbar">
        <Choice
          label="Modèle prédéfini"
          value="current"
          onChange={(v) => {
            if (v !== "current")
              commit(kind === "beam" ? beamPreset(v) : framePreset(v));
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
          {addMenu}
        </div>
      </div>
      <Tabs value={tab} onValueChange={setTab} className="mobile-tabs">
        <TabsList>
          <TabsTrigger value="model">Modèle</TabsTrigger>
          <TabsTrigger value="scene">Schéma</TabsTrigger>
          <TabsTrigger value="results">Résultats</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="analysis-layout">
        <aside
          className={`inspector ${tab === "model" ? "mobile-active" : ""}`}
        >
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
                      setMember(i);
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
        </aside>
        <main className="analysis-workspace">
          <div
            className={`scene-area ${tab === "scene" ? "mobile-active" : ""}`}
          >
            <div className="scene-options">
              <h2>Schéma interactif</h2>
              <Toggle
                label="Réactions"
                checked={reactions}
                onChange={setReactions}
              />
            </div>
            {model.kind === "frame" && (
              <div className="view-chips">
                {(["structure", "M", "V", "N", "v"] as View[]).map((v) => (
                  <Button
                    key={v}
                    size="sm"
                    variant={view === v ? "secondary" : "outline"}
                    onClick={() => setView(v)}
                  >
                    {fieldNames[v]}
                  </Button>
                ))}
              </div>
            )}
            <Playground
              onSelect={select}
              height={model.kind === "beam" ? 300 : 380}
            >
              {model.kind === "beam" ? (
                <BeamScene
                  model={model}
                  result={analysis.beam}
                  reactions={reactions}
                />
              ) : (
                <FrameScene
                  model={model}
                  result={analysis.frame}
                  reactions={reactions}
                  view={view}
                  amplification={amplification}
                />
              )}
            </Playground>
            {model.kind === "frame" && view === "v" && (
              <div className="amplification">
                <Label>Amplification de la déformée</Label>
                <Slider
                  value={[amplification]}
                  onValueChange={(v) => setAmplification(v[0])}
                  min={1}
                  max={1000}
                  step={10}
                />
                <span className="mono">×{amplification}</span>
              </div>
            )}
          </div>
          <div
            className={`results-area ${tab === "results" ? "mobile-active" : ""}`}
          >
            {analysis.error ? (
              <Notice danger>
                {analysis.error} Corrigez le modèle pour obtenir des résultats
                actualisés.
              </Notice>
            ) : (
              <>
                <Panel
                  title="Efforts et déplacements"
                  action={
                    <span className="live-badge">
                      <span />
                      Calcul actualisé
                    </span>
                  }
                >
                  {model.kind === "beam" ? (
                    <>
                      <div className="view-chips">
                        {(["M", "V", "N", "v", "theta"] as View[]).map((v) => (
                          <Button
                            key={v}
                            size="sm"
                            variant={view === v ? "secondary" : "outline"}
                            onClick={() => setView(v)}
                          >
                            {fieldNames[v]}
                          </Button>
                        ))}
                      </div>
                      <Diagram
                        x={analysis.beam!.x}
                        values={
                          analysis.beam![view === "structure" ? "M" : view]
                        }
                        title={fieldNames[view === "structure" ? "M" : view]}
                        unit={
                          view === "v"
                            ? "mm"
                            : view === "theta"
                              ? "mrad"
                              : view === "M"
                                ? "kN·m"
                                : "kN"
                        }
                        factor={view === "v" || view === "theta" ? 1000 : 1}
                      />
                    </>
                  ) : (
                    <>
                      <Choice
                        label="Barre analysée"
                        value={String(Math.min(member, model.mem.length - 1))}
                        onChange={(v) => setMember(Number(v))}
                        options={model.mem.map((m, i) => ({
                          value: String(i),
                          label: `B${i + 1} · N${m.a} → N${m.b}`,
                        }))}
                      />
                      <div className="view-chips">
                        {(["M", "V", "N"] as View[]).map((v) => (
                          <Button
                            key={v}
                            size="sm"
                            variant={view === v ? "secondary" : "outline"}
                            onClick={() => setView(v)}
                          >
                            {fieldNames[v]}
                          </Button>
                        ))}
                      </div>
                      {(() => {
                        const pts =
                          analysis.frame!.mem[
                            Math.min(member, model.mem.length - 1)
                          ].pts;
                        const which =
                          view === "V" ? "V" : view === "N" ? "N" : "M";
                        return (
                          <Diagram
                            x={pts.map((p) => p.x)}
                            values={pts.map((p) => p[which])}
                            title={fieldNames[which]}
                            unit={which === "M" ? "kN·m" : "kN"}
                          />
                        );
                      })()}
                    </>
                  )}
                </Panel>
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
                                    {fmt(
                                      analysis.frame!.u[3 * i + k] * 1000,
                                      4,
                                    )}
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
            )}
          </div>
        </main>
      </div>
      <Dialog
        open={!!editor}
        onOpenChange={(o) => {
          if (!o) {
            setEditor(null);
            setSelection(null);
          }
        }}
      >
        <DialogContent className="element-editor">
          <DialogHeader>
            <DialogTitle>Paramètres de l’élément</DialogTitle>
            <DialogDescription>
              Les modifications s’appliquent après validation du formulaire.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={apply}>
            {editor && selection && (
              <ElementEditor
                model={editor}
                selection={selection}
                onChange={setEditor}
              />
            )}
            <DialogFooter>
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
                  setSelection(null);
                }}
              >
                Annuler
              </Button>
              <Button type="submit">Appliquer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
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
}: {
  model: AnalysisModel;
  selection: Selection;
  onChange: (m: AnalysisModel) => void;
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
          <Disclosure title="Liaisons et déplacements imposés">
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
          </Disclosure>
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
              disabled={model.sections[0].id === s.id}
              value={s.x1}
              max={model.L}
              unit="m"
              onChange={(x1) => patch({ x1 })}
            />
            <Numeric
              label="Fin x₂"
              disabled={model.sections[model.sections.length - 1].id === s.id}
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
                label="Début x₁"
                value={l.x1}
                max={model.L}
                unit="m"
                onChange={(x1) => patch({ x1 })}
              />
              <Numeric
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
            label="Abscisse x"
            value={n.x}
            min={-1000}
            max={1000}
            unit="m"
            onChange={(x) => patch({ x })}
          />
          <Numeric
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
        <Disclosure title="Charge dans le repère local">
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
        </Disclosure>
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
}: {
  model: BeamModel;
  result?: BeamResult;
  reactions: boolean;
}) {
  const X = (x: number) => 80 + (x / model.L) * 840,
    y = 210;
  return (
    <>
      {model.sections.map((s, i) => (
        <g key={s.id} data-element={`section:${s.id}`} className="svg-element">
          <line
            x1={X(s.x1)}
            y1={y}
            x2={X(s.x2)}
            y2={y}
            stroke="var(--foreground)"
            strokeWidth="5"
          />
          <line
            x1={X(s.x1)}
            y1={y}
            x2={X(s.x2)}
            y2={y}
            stroke="transparent"
            strokeWidth="24"
          />
          <text
            x={(X(s.x1) + X(s.x2)) / 2}
            y={y + 47}
            fill="var(--muted-foreground)"
            fontSize="12"
            textAnchor="middle"
          >
            S{i + 1} · {fmt(s.b * 100, 0)} × {fmt(s.h * 100, 0)} cm
          </text>
        </g>
      ))}
      {model.loads.map((l, i) => (
        <g key={l.id} data-element={`load:${l.id}`} className="svg-element">
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
        <g key={s.id} data-element={`support:${s.id}`} className="svg-element">
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
            type={s.rz === true ? 1 : s.ux === true ? 2 : 3}
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
          <g key={i}>
            {Math.abs(r.Fy) > 1e-6 && (
              <Arrow
                x={X(r.x)}
                y={y + 107}
                dy={-Math.sign(r.Fy) * 48}
                color="var(--teal)"
                label={`${fmt(r.Fy)} kN`}
              />
            )}
          </g>
        ))}
      <line
        x1="80"
        y1="365"
        x2="920"
        y2="365"
        stroke="var(--muted-foreground)"
      />
      {[80, 920].map((x) => (
        <line
          key={x}
          x1={x}
          x2={x}
          y1="359"
          y2="371"
          stroke="var(--muted-foreground)"
        />
      ))}
      <text
        x="500"
        y="390"
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
  const minX = Math.min(...model.nodes.map((n) => n.x)),
    maxX = Math.max(...model.nodes.map((n) => n.x)),
    minY = Math.min(...model.nodes.map((n) => n.y)),
    maxY = Math.max(...model.nodes.map((n) => n.y)),
    scale = Math.min(
      760 / Math.max(1, maxX - minX),
      230 / Math.max(1, maxY - minY),
    ),
    X = (x: number) => (1000 - (maxX - minX) * scale) / 2 + (x - minX) * scale,
    Y = (y: number) => 335 - (y - minY) * scale;
  const diagram = view === "M" || view === "V" || view === "N" ? view : null,
    max =
      diagram && result
        ? Math.max(
            1,
            ...result.mem.flatMap((m) =>
              m.pts.map((p) => Math.abs(p[diagram])),
            ),
          )
        : 1;
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
          r = result?.mem[i];
        let path = "";
        if (r && diagram)
          path = r.pts
            .map(
              (p, j) =>
                `${j ? "L" : "M"}${X(a.x + p.x * r.g.c) + ((r.g.s * p[diagram]) / max) * 60} ${Y(a.y + p.x * r.g.s) + ((r.g.c * p[diagram]) / max) * 60}`,
            )
            .join(" ");
        if (r && view === "v") {
          const ei = (model.E * 1e6 * b.bw * b.h ** 3) / 12 / 1e8,
            L = r.g.L;
          path = Array.from({ length: 31 }, (_, j) => {
            const t = j / 30,
              x = t * L,
              u = r.ul[0] * (1 - t) + r.ul[3] * t,
              v =
                (1 - 3 * t * t + 2 * t ** 3) * r.ul[1] +
                L * (t - 2 * t * t + t ** 3) * r.ul[2] +
                (3 * t * t - 2 * t ** 3) * r.ul[4] +
                L * (-t * t + t ** 3) * r.ul[5] +
                (r.g.qy * x * x * (L - x) ** 2) / (24 * ei);
            return `${j ? "L" : "M"}${X(a.x + x * r.g.c + amplification * (u * r.g.c - v * r.g.s))} ${Y(a.y + x * r.g.s + amplification * (u * r.g.s + v * r.g.c))}`;
          }).join(" ");
        }
        return (
          <g key={b.id} data-element={`member:${b.id}`} className="svg-element">
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="var(--primary)"
              strokeWidth="5"
            />
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="transparent"
              strokeWidth="25"
            />
            {path && (
              <path
                d={path}
                stroke="var(--purple)"
                strokeWidth="2.2"
                fill="none"
              />
            )}
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
                dx={-Math.sign(b.q) * (r?.g.s ?? 0) * 45}
                dy={-Math.sign(b.q) * (r?.g.c ?? 1) * 45}
                label={`qᵧ ${fmt(b.q)}`}
              />
            )}
          </g>
        );
      })}
      {model.nodes.map((n, i) => (
        <g key={n.id} data-element={`node:${n.id}`} className="svg-element">
          {n.s > 0 && (
            <Support
              x={X(n.x)}
              y={Y(n.y) + 3}
              type={n.s === 1 ? 1 : n.s === 2 ? 2 : 3}
            />
          )}
          <circle
            cx={X(n.x)}
            cy={Y(n.y)}
            r="6"
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
      {model.nl.map((l) => {
        const n = model.nodes[l.n - 1];
        if (!n) return null;
        return (
          <g key={l.id} data-element={`nodal:${l.id}`} className="svg-element">
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
            <g key={r.i}>
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
        y="405"
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
function Diagram({
  x,
  values,
  title,
  unit,
  factor = 1,
}: {
  x: number[];
  values: number[];
  title: string;
  unit: string;
  factor?: number;
}) {
  const [read, setRead] = useState(0.5),
    min = Math.min(...values.map((v) => v * factor), 0),
    max = Math.max(...values.map((v) => v * factor), 0),
    range = Math.max(0.0001, max - min),
    X = (v: number) => 48 + (v / x[x.length - 1]) * 884,
    Y = (v: number) => 30 + ((v - min) / range) * 110,
    index = x.reduce(
      (best, v, i) =>
        Math.abs(v - read * x[x.length - 1]) <
        Math.abs(x[best] - read * x[x.length - 1])
          ? i
          : best,
      0,
    ),
    baseline = Y(0),
    path = x
      .map((v, i) => `${i ? "L" : "M"}${X(v)} ${Y(values[i] * factor)}`)
      .join(" ");
  return (
    <div className="diagram">
      <div className="diagram-caption">
        <strong>{title}</strong>
        <span>{unit}</span>
      </div>
      <svg
        viewBox="0 0 980 188"
        role="img"
        aria-label={`${title}, valeurs calculées`}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setRead(
            Math.max(
              0,
              Math.min(1, (((e.clientX - r.left) / r.width) * 980 - 48) / 884),
            ),
          );
        }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line
              x1="48"
              x2="932"
              y1={30 + t * 110}
              y2={30 + t * 110}
              stroke="var(--border)"
              strokeOpacity=".5"
            />
            <text
              x="35"
              y={34 + t * 110}
              textAnchor="end"
              fill="var(--muted-foreground)"
              fontSize="10"
              className="numeric"
            >
              {fmt(min + t * range, 1)}
            </text>
          </g>
        ))}
        <path
          d={`${path}L${X(x[x.length - 1])} ${baseline}L48 ${baseline}Z`}
          fill="var(--purple)"
          fillOpacity=".12"
        />
        <line
          x1="48"
          x2="932"
          y1={baseline}
          y2={baseline}
          stroke="var(--muted-foreground)"
        />
        <path d={path} fill="none" stroke="var(--purple)" strokeWidth="2.2" />
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <text
            key={t}
            x={48 + t * 884}
            y="174"
            textAnchor="middle"
            fill="var(--muted-foreground)"
            fontSize="11"
            className="numeric"
          >
            {fmt(t * x[x.length - 1])}
          </text>
        ))}
        <line
          x1={X(x[index])}
          x2={X(x[index])}
          y1="18"
          y2="147"
          stroke="var(--purple)"
          strokeDasharray="4 5"
        />
        <circle
          cx={X(x[index])}
          cy={Y(values[index] * factor)}
          r="4"
          fill="var(--purple)"
        />
      </svg>
      <div className="diagram-readout mono">
        <span>x = {fmt(x[index])} m</span>
        <strong>
          {fmt(values[index] * factor, 3)} {unit}
        </strong>
      </div>
      <Slider
        aria-label="Abscisse de lecture"
        min={0}
        max={1000}
        step={1}
        value={[read * 1000]}
        onValueChange={(v) => setRead(v[0] / 1000)}
      />
    </div>
  );
}
