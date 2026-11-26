import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Pencil,
  Copy,
  ClipboardPaste,
  Trash2,
  ListChecks,
  X,
  BookOpen,
  Plus,
  Keyboard,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Choice, Numeric, IconButton, Disclosure } from "./common";
import { useDesktopCommands } from "@/lib/desktop-commands";
import { runtime } from "@/lib/runtime";
import { uid } from "@/lib/utils";
import { type SectionType, sectionCatalogue } from "@/domain/section-types";
import { SectionSketch } from "./section-profile";
export type MenuPoint = { x: number; y: number } | null;
export type EditorActions = {
  copy: () => void;
  paste: () => void;
  remove: () => void;
  all: () => void;
  clear: () => void;
  undo: (redo?: boolean) => void;
  add: () => void;
  duplicate?: () => void;
  modify?: () => void;
};
export function useEditorKeys(
  actions: EditorActions,
  enabled = runtime === "desktop",
) {
  useDesktopCommands(
    enabled
      ? {
          "edit:copy": actions.copy,
          "edit:paste": actions.paste,
          "edit:delete": actions.remove,
          "edit:select-all": actions.all,
          "edit:undo": () => actions.undo(),
          "edit:redo": () => actions.undo(true),
          "edit:add": actions.add,
        }
      : {},
  );
  const latest = useRef(actions);
  latest.current = actions;
  useEffect(() => {
    if (!enabled) return;
    const handle = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (
        (e.target as Element).closest(
          "input, textarea, [contenteditable=true], [role=combobox], [role=dialog], [role=menu]",
        )
      )
        return;
      const a = latest.current,
        command = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      let fn: (() => void) | undefined;
      if (command)
        fn =
          key === "a"
            ? a.all
            : key === "c"
              ? a.copy
              : key === "v"
                ? a.paste
                : key === "z"
                  ? () => a.undo(e.shiftKey)
                  : key === "y"
                    ? () => a.undo(true)
                    : key === "d"
                      ? a.duplicate
                      : key === "n"
                        ? a.add
                        : undefined;
      else
        fn =
          key === "delete" || key === "backspace"
            ? a.remove
            : key === "escape"
              ? a.clear
              : key === "insert"
                ? a.add
                : undefined;
      if (fn) {
        e.preventDefault();
        fn();
      }
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [enabled]);
}
export function SceneMenu({
  point,
  onClose,
  actions,
  canPaste,
  canDuplicate = true,
}: {
  point: MenuPoint;
  onClose: () => void;
  actions: EditorActions;
  canPaste: boolean;
  canDuplicate?: boolean;
}) {
  return (
    <DropdownMenu
      open={!!point}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      modal={false}
    >
      <DropdownMenuTrigger asChild>
        <button
          className="context-anchor"
          tabIndex={-1}
          aria-label="Menu de sélection"
          style={{ left: point?.x ?? 0, top: point?.y ?? 0 }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="bottom"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          if (document.querySelector('[role="dialog"][data-state="open"]'))
            return;
          document
            .querySelector<SVGSVGElement>(".playground svg[tabindex]")
            ?.focus();
        }}
      >
        {actions.modify && (
          <DropdownMenuItem onSelect={actions.modify}>
            <Pencil />
            Modifier
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={actions.copy}>
          <Copy />
          Copier les propriétés<kbd>Ctrl C</kbd>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!canPaste} onSelect={actions.paste}>
          <ClipboardPaste />
          Coller les propriétés<kbd>Ctrl V</kbd>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={actions.all}>
          <ListChecks />
          Tout sélectionner<kbd>Ctrl A</kbd>
        </DropdownMenuItem>
        {actions.duplicate && (
          <DropdownMenuItem
            onSelect={actions.duplicate}
            disabled={!canDuplicate}
          >
            <Copy />
            Dupliquer<kbd>Ctrl D</kbd>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={actions.clear}>
          <X />
          Désélectionner<kbd>Échap</kbd>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive"
          onSelect={actions.remove}
        >
          <Trash2 />
          Supprimer<kbd>Suppr</kbd>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
export function DetailDialog({
  open,
  onOpenChange,
  title,
  children,
  description,
  confirmation = false,
  confirmLabel = "Valider et fermer",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  children: ReactNode;
  description?: string;
  confirmation?: boolean;
  confirmLabel?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="desktop-detail-dialog"
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onOpenChange(false);
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ??
              "Paramètres du projet courant. Les changements mettent le calcul en attente d’actualisation."}
          </DialogDescription>
        </DialogHeader>
        {children}
        {confirmation && (
          <DialogFooter>
            <Button
              onClick={(event) => {
                const invalid = event.currentTarget
                  .closest('[role="dialog"]')
                  ?.querySelector<HTMLInputElement>("input:invalid");
                if (invalid) {
                  invalid.reportValidity();
                  return;
                }
                onOpenChange(false);
              }}
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
export function SectionTypes({
  value,
  onChange,
  profiles = false,
}: {
  value: SectionType[];
  onChange: (value: SectionType[]) => void;
  profiles?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [catalogue, setCatalogue] = useState("beam"),
    [editing, setEditing] = useState("");
  return (
    <>
      <IconButton
        label="Dimensions types du projet"
        onClick={() => setOpen(true)}
      >
        <BookOpen />
      </IconButton>
      <DetailDialog
        open={open}
        onOpenChange={setOpen}
        title="Dimensions types du projet"
        confirmation
      >
        <p className="hint">
          Ces sections appartiennent uniquement à cette étude. Sélectionnez
          plusieurs éléments pour appliquer une même dimension type.
        </p>
        <Disclosure title="Parcourir le catalogue">
          <Choice
            label="Catalogue prêt à utiliser"
            value={catalogue}
            onChange={setCatalogue}
            options={[
              { value: "beam", label: "Poutres béton" },
              { value: "column", label: "Poteaux béton" },
              { value: "slab", label: "Planchers" },
              { value: "wall", label: "Voiles" },
              ...(profiles ? [{ value: "ipe", label: "Profilés IPE" }] : []),
            ]}
          />
          <div className="section-catalogue" aria-label="Sections du catalogue">
            {sectionCatalogue(profiles)
              .filter((t) =>
                catalogue === "ipe"
                  ? !!t.catalogue
                  : t.kind === catalogue && !t.catalogue,
              )
              .map((t) => {
                const exists = value.some((s) => s.id === t.id);
                return (
                  <Button
                    type="button"
                    key={t.id}
                    variant={editing === t.id ? "secondary" : "outline"}
                    aria-pressed={editing === t.id}
                    disabled={!exists && value.length >= 100}
                    onClick={() => {
                      setEditing(t.id);
                      if (!exists) onChange([...value, structuredClone(t)]);
                    }}
                  >
                    {!exists && "+ "}
                    {t.name}
                  </Button>
                );
              })}
          </div>
        </Disclosure>
        {value.length > 0 && (
          <Choice
            label="Dimension à modifier"
            value={value.some((s) => s.id === editing) ? editing : value[0].id}
            options={value.map((s) => ({ value: s.id, label: s.name }))}
            onChange={setEditing}
          />
        )}
        <div className="section-type-list">
          {value.map((s) => {
            if (
              s.id !==
              (value.some((v) => v.id === editing) ? editing : value[0]?.id)
            )
              return null;
            const patch = (p: Partial<SectionType>) =>
              onChange(value.map((v) => (v.id === s.id ? { ...s, ...p } : v)));
            return (
              <div className="section-type-row" key={s.id}>
                <div className="field">
                  <Label htmlFor={`section-name-${s.id}`}>
                    Nom de la dimension
                  </Label>
                  <Input
                    id={`section-name-${s.id}`}
                    value={s.name}
                    onChange={(e) => {
                      if (e.target.value.trim())
                        patch({ name: e.target.value });
                    }}
                  />
                </div>
                <Choice
                  label="Élément"
                  disabled={!!s.catalogue}
                  value={s.kind}
                  options={[
                    { value: "beam", label: "Poutre / barre" },
                    { value: "column", label: "Poteau" },
                    { value: "slab", label: "Dalle" },
                    { value: "wall", label: "Voile" },
                  ]}
                  onChange={(kind) =>
                    patch({ kind: kind as SectionType["kind"] })
                  }
                />
                {s.catalogue ? (
                  <span className="hint">
                    Profil tabulé · A {s.A} cm² · I {s.I} cm⁴
                  </span>
                ) : s.kind === "slab" ? (
                  <Choice
                    label="Plancher"
                    value={s.slab ?? "dp"}
                    options={[
                      { value: "dp", label: "Dalle pleine" },
                      { value: "cc16", label: "16+4 · 2,85 kN/m²" },
                      { value: "cc12", label: "12+4" },
                      { value: "cc20", label: "20+5" },
                    ]}
                    onChange={(slab) =>
                      patch({ slab: slab as SectionType["slab"] })
                    }
                  />
                ) : (
                  <Numeric
                    label="Largeur / épaisseur"
                    unit="cm"
                    value={s.b}
                    min={1}
                    max={1000}
                    onChange={(b) => patch({ b })}
                  />
                )}
                <Numeric
                  disabled={!!s.catalogue}
                  label={
                    s.kind === "slab" ? "Épaisseur dalle pleine" : "Hauteur"
                  }
                  value={s.h}
                  min={1}
                  max={1000}
                  unit="cm"
                  onChange={(h) => patch({ h })}
                />
                <IconButton
                  label={`Supprimer la dimension ${s.name}`}
                  onClick={() => onChange(value.filter((v) => v.id !== s.id))}
                >
                  <Trash2 />
                </IconButton>
                {s.kind !== "slab" && <SectionSketch value={s} />}
              </div>
            );
          })}
        </div>
        <Button
          variant="outline"
          disabled={value.length >= 100}
          onClick={() => {
            const id = uid();
            setEditing(id);
            onChange([
              ...value,
              {
                id,
                name: `Section ${value.length + 1}`,
                kind: "beam",
                b: 25,
                h: 40,
              },
            ]);
          }}
        >
          <Plus />
          Ajouter une dimension type
        </Button>
      </DetailDialog>
    </>
  );
}
export function ShortcutHelp() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton
        label="Raccourcis clavier et souris"
        onClick={() => setOpen(true)}
      >
        <Keyboard />
      </IconButton>
      <DetailDialog
        open={open}
        onOpenChange={setOpen}
        title="Souris et raccourcis"
        confirmation
        confirmLabel="Fermer"
      >
        <dl className="shortcut-list">
          {[
            ["Clic gauche", "Sélectionner"],
            ["Glisser dans la vue 3D", "Pivoter le bâtiment"],
            ["Un doigt dans la vue 3D", "Pivoter"],
            ["Appui long + glisser", "Déplacer un appui ou une charge"],
            ["Deux doigts", "Zoomer et déplacer la vue 3D"],
            ["0 · Recentrer", "Restaurer le cadrage et les angles 3D"],
            ["Shift + clic", "Ajouter / retirer de la sélection"],
            ["Clic droit", "Actions de l’élément"],
            [
              "Clic gauche maintenu + glisser",
              "Déplacer appuis / charges sur leur support",
            ],
            [
              "Ctrl / Cmd A",
              "Tout sélectionner ; avec présélection, sélectionner le même type",
            ],
            ["Ctrl / Cmd C · V", "Copier / appliquer les propriétés"],
            ["Suppr", "Supprimer la sélection"],
            ["Inser / Ctrl N", "Ajouter un élément"],
            ["Ctrl / Cmd Z · Shift Z", "Annuler / rétablir"],
            ["Échap", "Désélectionner"],
            ["Espace + glisser", "Déplacer la vue"],
            ["Molette · + · − · 0", "Zoom / recentrer"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt>
                <kbd>{k}</kbd>
              </dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </DetailDialog>
    </>
  );
}

export function ParameterGroup({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (runtime !== "desktop")
    return (
      <Disclosure title={title} defaultOpen={defaultOpen}>
        {children}
      </Disclosure>
    );
  return (
    <>
      <IconButton label={title} onClick={() => setOpen(true)}>
        <BookOpen />
      </IconButton>
      <DetailDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        confirmation
      >
        {children}
      </DetailDialog>
    </>
  );
}
