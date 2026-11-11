import { z } from "zod";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Panel,
  Choice,
  Numeric,
  FormGrid,
  Disclosure,
  IconButton,
} from "./common";
import { slabs, usages, type Level } from "@/domain/engineering";
import { uid } from "@/lib/utils";
export { levelSchema } from "@/domain/levels";
export function LevelEditor({
  level,
  onChange,
  onRemove,
  onUp,
  onDown,
  wall = false,
  panel = false,
}: {
  level: Level;
  onChange: (v: Level) => void;
  onRemove?: () => void;
  onUp?: () => void;
  onDown?: () => void;
  wall?: boolean;
  panel?: boolean;
}) {
  const patch = (v: Partial<Level>) => onChange({ ...level, ...v });
  return (
    <Panel
      title={panel ? "Charges du panneau" : level.label}
      action={
        !panel && (
          <div className="row-actions">
            {onUp && (
              <IconButton label="Monter le niveau" onClick={onUp}>
                <ArrowUp size={14} />
              </IconButton>
            )}
            {onDown && (
              <IconButton label="Descendre le niveau" onClick={onDown}>
                <ArrowDown size={14} />
              </IconButton>
            )}
            {onRemove && (
              <IconButton label="Supprimer ce niveau" onClick={onRemove}>
                <Trash2 size={14} />
              </IconButton>
            )}
          </div>
        )
      }
    >
      <div className="form-stack">
        {!panel && (
          <FormGrid>
            <div className="field">
              <Label htmlFor={`level-${level.id}`}>Nom du niveau</Label>
              <Input
                id={`level-${level.id}`}
                value={level.label}
                maxLength={100}
                onChange={(e) => patch({ label: e.target.value })}
              />
            </div>
            <Numeric
              label="Hauteur d’étage"
              value={level.height}
              min={0.1}
              max={100}
              unit="m"
              onChange={(height) => patch({ height })}
            />
          </FormGrid>
        )}
        <FormGrid>
          <Choice
            label="Type de plancher"
            value={level.slab}
            options={slabs.map((s) => ({ value: s.id, label: s.label }))}
            onChange={(slab) => patch({ slab: slab as Level["slab"] })}
          />
          {level.slab === "dp" ? (
            <Numeric
              label="Épaisseur de dalle"
              value={level.thickness * 100}
              min={1}
              max={1000}
              unit="cm"
              onChange={(v) => patch({ thickness: v / 100 })}
            />
          ) : (
            <div className="field">
              <Label>Poids propre</Label>
              <div className="static-field mono">
                {slabs.find((s) => s.id === level.slab)?.g} kN/m²
              </div>
            </div>
          )}
        </FormGrid>
        <FormGrid>
          <Choice
            label="Usage du plancher"
            value={level.usage}
            options={usages.map((u) => ({
              value: u.id,
              label: `${u.id} · ${u.label}`,
            }))}
            onChange={(usage) =>
              patch({
                usage: usage as Level["usage"],
                q: usages.find((u) => u.id === usage)!.q,
              })
            }
          />
          <Numeric
            label="Charge d’exploitation Q"
            value={level.q}
            max={1000}
            unit="kN/m²"
            onChange={(q) => patch({ q })}
          />
        </FormGrid>
        <Disclosure
          title={`Revêtements et charges permanentes · ${level.coatings.length}`}
          defaultOpen
        >
          {level.coatings.map((c) => (
            <div className="coating-row" key={c.id}>
              <Input
                aria-label="Nom du revêtement"
                placeholder="Chape, carrelage…"
                value={c.name}
                onChange={(e) =>
                  patch({
                    coatings: level.coatings.map((v) =>
                      v.id === c.id ? { ...c, name: e.target.value } : v,
                    ),
                  })
                }
              />
              <Numeric
                label="Charge G"
                value={c.load}
                max={1000}
                unit="kN/m²"
                onChange={(load) =>
                  patch({
                    coatings: level.coatings.map((v) =>
                      v.id === c.id ? { ...c, load } : v,
                    ),
                  })
                }
              />
              <IconButton
                label="Supprimer le revêtement"
                onClick={() =>
                  patch({
                    coatings: level.coatings.filter((v) => v.id !== c.id),
                  })
                }
              >
                <Trash2 size={14} />
              </IconButton>
            </div>
          ))}
          <Button
            variant="ghost"
            onClick={() =>
              patch({
                coatings: [
                  ...level.coatings,
                  { id: uid(), name: "Revêtement", load: 0.5 },
                ],
              })
            }
          >
            <Plus />
            Ajouter un revêtement
          </Button>
        </Disclosure>
        {!panel && (
          <Disclosure title="Section porteuse du niveau">
            {wall ? (
              <Numeric
                label="Épaisseur du voile"
                value={level.e}
                min={1}
                max={1000}
                unit="cm"
                onChange={(e) => patch({ e })}
              />
            ) : (
              <FormGrid>
                <Numeric
                  label="Largeur b"
                  value={level.b}
                  min={1}
                  max={1000}
                  unit="cm"
                  onChange={(b) => patch({ b })}
                />
                <Numeric
                  label="Hauteur h"
                  value={level.h}
                  min={1}
                  max={1000}
                  unit="cm"
                  onChange={(h) => patch({ h })}
                />
              </FormGrid>
            )}
          </Disclosure>
        )}
      </div>
    </Panel>
  );
}
