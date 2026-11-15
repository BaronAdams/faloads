import { useEffect, useRef, useState, type ReactNode } from "react";
import {
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
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Choice, Numeric, IconButton, Disclosure } from "./common";
import { useDesktopCommands } from "@/lib/desktop-commands";
import { runtime } from "@/lib/runtime";
import { uid } from "@/lib/utils";
import { type SectionType } from "@/domain/section-types";
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
}: {
  point: MenuPoint;
  onClose: () => void;
  actions: EditorActions;
  canPaste: boolean;
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
          document
            .querySelector<SVGSVGElement>(".playground svg[tabindex]")
            ?.focus();
        }}
      >
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
          Tout sélectionner du même type<kbd>Ctrl A</kbd>
        </DropdownMenuItem>
        {actions.duplicate && (
          <DropdownMenuItem onSelect={actions.duplicate}>
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
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="desktop-detail-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Paramètres du projet courant. Les changements mettent le calcul en
            attente d’actualisation.
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function SectionTypes({
  value,
  onChange,
}: {
  value: SectionType[];
  onChange: (value: SectionType[]) => void;
}) {
  const [open, setOpen] = useState(false);
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
      >
        <p className="hint">
          Ces sections appartiennent uniquement à cette étude. Sélectionnez
          plusieurs éléments pour appliquer une même dimension type.
        </p>
        <div className="section-type-list">
          {value.map((s, i) => {
            const patch = (p: Partial<SectionType>) =>
              onChange(value.map((v) => (v.id === s.id ? { ...s, ...p } : v)));
            return (
              <div className="section-type-row" key={s.id}>
                <div className="field">
                  <Label htmlFor={`section-name-${s.id}`}>Nom {i + 1}</Label>
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
                {s.kind === "slab" ? (
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
              </div>
            );
          })}
        </div>
        <Button
          variant="outline"
          onClick={() =>
            onChange([
              ...value,
              {
                id: uid(),
                name: `Section ${value.length + 1}`,
                kind: "beam",
                b: 25,
                h: 40,
              },
            ])
          }
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
      >
        <dl className="shortcut-list">
          {[
            ["Clic gauche", "Sélectionner"],
            ["Glisser dans la vue 3D", "Pivoter le bâtiment"],
            ["Un doigt dans la vue 3D", "Pivoter"],
            ["Deux doigts", "Zoomer et déplacer la vue 3D"],
            ["0 · Recentrer", "Restaurer le cadrage et les angles 3D"],
            ["Shift + clic", "Ajouter / retirer de la sélection"],
            ["Clic droit", "Actions de l’élément"],
            [
              "Clic droit + glisser",
              "Déplacer appuis / charges sur leur support",
            ],
            ["Ctrl / Cmd A", "Sélectionner le même type"],
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
      <DetailDialog open={open} onOpenChange={setOpen} title={title}>
        {children}
      </DetailDialog>
    </>
  );
}
