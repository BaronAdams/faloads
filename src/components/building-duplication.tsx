import { useState } from "react";
import { DetailDialog } from "./desktop-tools";
import { EditorSheet, EditorFooter } from "./editor-sheet";
import { Choice } from "./common";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Button } from "./ui/button";
import { runtime } from "@/lib/runtime";
import {
  duplicateFloor,
  type DuplicationKind,
} from "@/domain/building-duplication";
import type { Floor } from "@/domain/building";
export function BuildingDuplication({
  source,
  keys,
  onClose,
  onDuplicate,
  initialSelection,
  defaultName,
}: {
  source: Floor;
  keys: string[];
  onClose: () => void;
  onDuplicate: (copy: Floor, position: "above" | "top") => void;
  initialSelection: boolean;
  defaultName: string;
}) {
  const [name, setName] = useState(defaultName),
    [scope, setScope] = useState<"all" | "selection">(
      initialSelection ? "selection" : "all",
    ),
    [kinds, setKinds] = useState<DuplicationKind[]>([
      "columns",
      "beams",
      "walls",
      "slabs",
    ]),
    [loads, setLoads] = useState(true),
    [position, setPosition] = useState<"above" | "top">("above"),
    [error, setError] = useState("");
  const Container = runtime === "desktop" ? DetailDialog : EditorSheet;
  return (
    <Container
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title="Dupliquer un étage"
      description={`Copier ${source.name} vers un nouveau niveau, en conservant sa grille et ses sections.`}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            onDuplicate(
              duplicateFloor(source, { name, scope, keys, kinds, loads }),
              position,
            );
          } catch (error) {
            setError((error as Error).message);
          }
        }}
      >
        <div className="form-stack">
          <div className="field">
            <Label htmlFor="duplicate-floor-name">Nom du nouveau niveau</Label>
            <Input
              id="duplicate-floor-name"
              value={name}
              maxLength={100}
              required
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Choice
            label="Éléments à copier"
            value={scope}
            options={[
              { value: "all", label: "Tout le niveau" },
              {
                value: "selection",
                label: `Sélection courante · ${keys.length} éléments`,
              },
            ]}
            onChange={(v) => setScope(v as typeof scope)}
          />
          <fieldset className="duplication-families">
            <legend>Familles d’éléments</legend>
            {(
              [
                ["columns", "Poteaux"],
                ["beams", "Poutres"],
                ["walls", "Voiles"],
                ["slabs", "Planchers"],
              ] as const
            ).map(([kind, label]) => (
              <Label key={kind} className="toggle">
                <Switch
                  checked={kinds.includes(kind)}
                  onCheckedChange={(checked) =>
                    setKinds(
                      checked
                        ? [...kinds, kind]
                        : kinds.filter((k) => k !== kind),
                    )
                  }
                />
                {label}
              </Label>
            ))}
          </fieldset>
          <Label className="toggle">
            <Switch checked={loads} onCheckedChange={setLoads} />
            Copier les charges ajoutées
          </Label>
          <p className="hint">
            Si désactivé : Q, revêtements et charges saisies sur les éléments
            libres sont remis à zéro. Le poids propre des éléments conservés
            reste calculé.
          </p>
          <Choice
            label="Position du nouveau niveau"
            value={position}
            options={[
              { value: "above", label: "Au-dessus du niveau courant" },
              { value: "top", label: "Au sommet du bâtiment" },
            ]}
            onChange={(v) => setPosition(v as typeof position)}
          />
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <EditorFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="submit"
            disabled={!kinds.length || (scope === "selection" && !keys.length)}
          >
            Dupliquer le niveau
          </Button>
        </EditorFooter>
      </form>
    </Container>
  );
}
