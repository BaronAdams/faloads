import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  type Roof,
  roofDefault,
  roofSchema,
  roofAnalysis,
  roofNames,
} from "@/domain/roof";
import type { Floor, buildingResults } from "@/domain/building";
import { runtime } from "@/lib/runtime";
import { fmt, uid } from "@/lib/utils";
import { DetailDialog } from "./desktop-tools";
import { EditorSheet, EditorFooter } from "./editor-sheet";
import {
  Numeric,
  Choice,
  FormGrid,
  IconButton,
  Notice,
  Disclosure,
  Panel,
} from "./common";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
const actionNames = {
  G: "Permanent G",
  maintenance: "Entretien",
  snow: "Neige",
  other: "Autre action verticale",
};
export function RoofEditor({
  open,
  onOpenChange,
  value,
  floor,
  onApply,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value?: Roof;
  floor: Floor;
  onApply: (v: Roof) => boolean;
}) {
  const [draft, setDraft] = useState<Roof>(() => value ?? roofDefault()),
    [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setDraft(structuredClone(value ?? roofDefault()));
      setError("");
    }
  }, [open]);
  const patch = (p: Partial<Roof>) => {
    setDraft((d) => ({ ...d, ...p }));
    setError("");
  };
  let preview: ReturnType<typeof roofAnalysis> | undefined;
  try {
    preview = roofAnalysis(floor, draft);
  } catch {}
  const Container = runtime === "desktop" ? DetailDialog : EditorSheet;
  const changeLoad = (id: string, p: Partial<Roof["loads"][number]>) =>
    patch({
      loads: draft.loads.map((l) => (l.id === id ? { ...l, ...p } : l)),
    });
  return (
    <Container
      open={open}
      onOpenChange={onOpenChange}
      title={`Toiture · ${floor.name}`}
      description="Géométrie, charpente équivalente et charges verticales sur le dernier niveau."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const parsed = roofSchema.parse(draft);
            if (parsed.enabled) roofAnalysis(floor, parsed);
            if (onApply(parsed)) onOpenChange(false);
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <div className="editor-fields roof-editor">
          <div className="roof-switch-row">
            <Label htmlFor="roof-enabled">
              Ajouter une toiture au bâtiment
            </Label>
            <Switch
              id="roof-enabled"
              checked={draft.enabled}
              onCheckedChange={(enabled) => patch({ enabled })}
            />
          </div>
          {draft.enabled && (
            <>
              <div
                className="roof-shape-options"
                role="group"
                aria-label="Modèle de toiture"
              >
                {(["mono", "gable", "hip"] as const).map((shape) => (
                  <Button
                    key={shape}
                    type="button"
                    variant={draft.shape === shape ? "secondary" : "outline"}
                    aria-pressed={draft.shape === shape}
                    onClick={() => patch({ shape })}
                  >
                    {roofNames[shape]}
                  </Button>
                ))}
              </div>
              <FormGrid>
                <Choice
                  label="Direction des pannes / faîtage"
                  value={draft.axis}
                  options={[
                    { value: "x", label: "Suivant X" },
                    { value: "y", label: "Suivant Y" },
                  ]}
                  onChange={(axis) => patch({ axis: axis as "x" | "y" })}
                />
                <Numeric
                  label="Hauteur de toiture"
                  value={draft.rise}
                  min={0.05}
                  max={100}
                  unit="m"
                  onChange={(rise) => patch({ rise })}
                />
                <Numeric
                  label="Entraxe maximal des fermes"
                  value={draft.spacing}
                  min={0.5}
                  max={100}
                  unit="m"
                  onChange={(spacing) => patch({ spacing })}
                />
                <Numeric
                  label="Entraxe des pannes"
                  value={draft.purlinSpacing}
                  min={0.3}
                  max={10}
                  unit="m"
                  onChange={(purlinSpacing) => patch({ purlinSpacing })}
                />
              </FormGrid>
              {preview && (
                <div
                  className="roof-preview-data"
                  aria-label="Géométrie de toiture"
                >
                  <span>
                    Projection : <b>{fmt(preview.planArea)} m²</b>
                  </span>
                  <span>
                    Surface inclinée : <b>{fmt(preview.area)} m²</b>
                  </span>
                  <span>
                    {preview.frames.length} fermes · entraxe réel{" "}
                    {fmt(preview.actualSpacing)} m
                  </span>
                </div>
              )}
              <div className="roof-switch-row">
                <Label htmlFor="roof-floor">
                  Conserver les dalles du dernier niveau
                </Label>
                <Switch
                  id="roof-floor"
                  checked={draft.keepSlab}
                  onCheckedChange={(keepSlab) => patch({ keepSlab })}
                />
              </div>
              <Choice
                label="Cas variable de toiture à calculer"
                value={draft.variable}
                options={(["maintenance", "snow", "other"] as const).map(
                  (value) => ({ value, label: actionNames[value] }),
                )}
                onChange={(variable) =>
                  patch({ variable: variable as Roof["variable"] })
                }
              />
              <p className="hint">
                Les poids G s’appliquent toujours. Un seul cas variable de
                toiture est actif à la fois ; il n’est pas dégressé avec les
                étages.
              </p>
              <div className="roof-load-list">
                {draft.loads.map((l, i) => (
                  <fieldset className="roof-load-editor" key={l.id}>
                    <legend>Charge {i + 1}</legend>
                    <div className="roof-load-heading">
                      <Input
                        aria-label={`Nom de charge ${i + 1}`}
                        value={l.name}
                        onChange={(e) =>
                          changeLoad(l.id, { name: e.target.value })
                        }
                      />
                      <IconButton
                        label={`Supprimer la charge ${i + 1}`}
                        onClick={() =>
                          patch({
                            loads: draft.loads.filter((v) => v.id !== l.id),
                          })
                        }
                      >
                        <Trash2 />
                      </IconButton>
                    </div>
                    <FormGrid>
                      <Choice
                        label={`Action de charge ${i + 1}`}
                        value={l.action}
                        options={Object.entries(actionNames).map(
                          ([value, label]) => ({ value, label }),
                        )}
                        onChange={(action) =>
                          changeLoad(l.id, {
                            action: action as typeof l.action,
                          })
                        }
                      />
                      <Numeric
                        label={`Intensité de charge ${i + 1}`}
                        value={l.value}
                        min={0}
                        max={10000}
                        unit="kN/m²"
                        onChange={(value) => changeLoad(l.id, { value })}
                      />
                      <Choice
                        label={`Surface de référence ${i + 1}`}
                        value={l.basis}
                        options={[
                          { value: "slope", label: "Surface inclinée" },
                          { value: "plan", label: "Projection horizontale" },
                        ]}
                        onChange={(basis) =>
                          changeLoad(l.id, { basis: basis as typeof l.basis })
                        }
                      />
                      <Choice
                        label={`Pan chargé ${i + 1}`}
                        value={String(l.face)}
                        options={[
                          { value: "0", label: "Tous les pans" },
                          ...Array.from(
                            {
                              length:
                                preview?.facets.length ??
                                (draft.shape === "mono"
                                  ? 1
                                  : draft.shape === "gable"
                                    ? 2
                                    : 4),
                            },
                            (_, k) => ({
                              value: String(k + 1),
                              label: `Pan ${k + 1}`,
                            }),
                          ),
                          ...(l.face >
                          (draft.shape === "mono"
                            ? 1
                            : draft.shape === "gable"
                              ? 2
                              : 4)
                            ? [
                                {
                                  value: String(l.face),
                                  label: `Pan ${l.face} · à réaffecter`,
                                },
                              ]
                            : []),
                        ]}
                        onChange={(face) =>
                          changeLoad(l.id, { face: Number(face) })
                        }
                      />
                    </FormGrid>
                  </fieldset>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={draft.loads.length >= 40}
                onClick={() =>
                  patch({
                    loads: [
                      ...draft.loads,
                      {
                        id: uid(),
                        name: "Charge personnalisée",
                        action: "G",
                        basis: "plan",
                        face: 0,
                        value: 0,
                      },
                    ],
                  })
                }
              >
                <Plus />
                Ajouter une charge
              </Button>
              <Disclosure title="Cheminement et hypothèses">
                <p className="hint">
                  Couverture → pannes simplement appuyées → fermes à deux appuis
                  avec entrait → poutres ou voiles de rive → poteaux. Les
                  charges dissymétriques par pan conservent leurs moments et
                  leurs réactions propres. Le poids de la charpente est une
                  charge surfacique équivalente à renseigner. Le modèle calcule
                  la descente verticale gravitaire ; le dimensionnement des
                  barres et la stabilité sous vent nécessitent une analyse de
                  charpente.
                </p>
                <p className="hint">
                  Neige et autres valeurs climatiques : renseignez les actions
                  caractéristiques adaptées au site. Les combinaisons
                  gravitaires du bâtiment restent G+Q et 1,35G+1,5Q.
                </p>
              </Disclosure>
            </>
          )}
          {error && (
            <div role="alert">
              <Notice danger>{error}</Notice>
            </div>
          )}
        </div>
        <EditorFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>
          <Button type="submit">Appliquer la toiture</Button>
        </EditorFooter>
      </form>
    </Container>
  );
}
export function RoofResults({
  roof,
}: {
  roof: NonNullable<ReturnType<typeof buildingResults>["roof"]>;
}) {
  return (
    <Panel title="Descente de charges de la toiture">
      <div className="roof-preview-data">
        <span>
          G : <b>{fmt(roof.G)} kN</b>
        </span>
        <span>
          Q toiture : <b>{fmt(roof.Q)} kN</b>
        </span>
        <span>
          {fmt(roof.area)} m² inclinés · {fmt(roof.planArea)} m² en plan
        </span>
      </div>
      <p className="hint" data-testid="roof-balance">
        Équilibre G : {fmt(roof.balanceG, 6)} kN · Q : {fmt(roof.balanceQ, 6)}{" "}
        kN
      </p>
      <div className="table-wrap">
        <table data-testid="roof-reactions">
          <thead>
            <tr>
              <th>Ferme</th>
              <th>Rive</th>
              <th>Porteur</th>
              <th>G · kN</th>
              <th>Q · kN</th>
              <th>ELS · kN</th>
              <th>ELU · kN</th>
            </tr>
          </thead>
          <tbody>
            {roof.routes.map((r, i) => (
              <tr key={i}>
                <th>F{r.frame + 1}</th>
                <td>{r.side + 1}</td>
                <td>{r.target}</td>
                {[r.g, r.q, r.g + r.q, 1.35 * r.g + 1.5 * r.q].map((v, k) => (
                  <td key={k}>{fmt(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
