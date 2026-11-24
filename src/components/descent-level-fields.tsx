import { type DescentModel, levelTributary } from "@/domain/descent";
import type { Level } from "@/domain/engineering";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { Numeric, FormGrid, Choice } from "./common";

export function DescentLevelFields({
  model,
  level,
  onChange,
}: {
  model: DescentModel;
  level: Level;
  onChange: (level: Level) => void;
}) {
  const value = levelTributary(model, level),
    wall = model.kind === "wall-load";
  const patch = (p: Partial<typeof value>) =>
    onChange({ ...level, tributary: { ...value, ...p } });
  return (
    <section className="form-stack" aria-label="Influence et poutres du niveau">
      <Label className="toggle">
        <Switch
          checked={!!level.tributary}
          onCheckedChange={(checked) =>
            onChange({
              ...level,
              tributary: checked ? { ...value } : undefined,
            })
          }
        />
        Paramètres propres à cet étage
      </Label>
      <p className="hint">
        {level.tributary
          ? "Ces valeurs remplacent celles du projet pour ce niveau uniquement."
          : "Ce niveau utilise l’aire et les poutres définies dans le projet."}
      </p>
      {level.tributary && (
        <>
          <FormGrid>
            <Numeric
              label="Aire tributaire du niveau"
              value={value.area}
              min={0.01}
              max={1e6}
              unit="m²"
              onChange={(area) => patch({ area })}
            />
            {wall && (
              <Numeric
                label="Longueur du voile au niveau"
                value={value.wallLength ?? model.wallLength}
                min={0.1}
                max={100}
                unit="m"
                onChange={(wallLength) => patch({ wallLength })}
              />
            )}
          </FormGrid>
          {!wall &&
            model.system === "beams" &&
            (["primary", "secondary"] as const).map((family) => {
              const primary = family === "primary",
                title = primary ? "Poutres principales" : "Poutres secondaires",
                b = primary ? "primaryB" : "secondaryB",
                h = primary ? "primaryH" : "secondaryH",
                length = primary ? "primaryLength" : "secondaryLength";
              return (
                <section className="form-stack" key={family}>
                  <h3>{title}</h3>
                  <Choice
                    label={`Dimension type · ${title.toLowerCase()}`}
                    value="custom"
                    options={[
                      { value: "custom", label: "Section personnalisée" },
                      ...model.sectionTypes
                        .filter((t) => t.kind === "beam" && !t.catalogue)
                        .map((t) => ({ value: t.id, label: t.name })),
                    ]}
                    onChange={(id) => {
                      const t = model.sectionTypes.find((s) => s.id === id);
                      if (t) patch({ [b]: t.b, [h]: t.h });
                    }}
                  />
                  <FormGrid>
                    <Numeric
                      label={`${title} · b`}
                      labelColor={primary ? "var(--orange)" : "var(--teal)"}
                      value={value[b]}
                      min={1}
                      max={1000}
                      unit="cm"
                      onChange={(v) => patch({ [b]: v })}
                    />
                    <Numeric
                      label={`${title} · h`}
                      value={value[h]}
                      min={1}
                      max={1000}
                      unit="cm"
                      onChange={(v) => patch({ [h]: v })}
                    />
                    <Numeric
                      label={`${title} · longueur d’influence totale`}
                      value={value[length]}
                      min={0}
                      max={200}
                      unit="m"
                      onChange={(v) => patch({ [length]: v })}
                    />
                  </FormGrid>
                </section>
              );
            })}
        </>
      )}
    </section>
  );
}
