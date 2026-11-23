import { useEffect, useState } from "react";
import { Menubar } from "radix-ui";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { desktopCommand, useDesktopCommands } from "@/lib/desktop-commands";
import { useWorkspace } from "@/lib/workspace";
import { importProjects } from "@/lib/project-io";
import { projectTypes } from "@/domain/projects";
import { requestNewStudy } from "./new-study-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { ProjectIcon } from "./common";

const menus = [
  [
    "Fichier",
    [
      ["file:new", "Nouveau projet…"],
      ["file:open", "Ouvrir un projet…"],
      ["file:import", "Importer…"],
      ["file:save", "Enregistrer"],
      ["file:export", "Exporter le projet…"],
      ["file:rename", "Renommer…"],
      ["app:settings", "Paramètres…"],
      ["window:close", "Quitter"],
    ],
  ],
  [
    "Édition",
    [
      ["edit:undo", "Annuler"],
      ["edit:redo", "Rétablir"],
      ["edit:copy", "Copier les propriétés"],
      ["edit:paste", "Coller les propriétés"],
      ["edit:select-all", "Tout sélectionner"],
      ["edit:delete", "Supprimer la sélection"],
      ["edit:add", "Ajouter un élément…"],
    ],
  ],
  [
    "Affichage",
    [
      ["view:zoom-in", "Agrandir"],
      ["view:zoom-out", "Réduire"],
      ["view:reset", "Recentrer"],
      ["view:parameters", "Paramètres du projet…"],
      ["view:results", "Résultats…"],
    ],
  ],
  ["Calcul", [["study:calculate", "Lancer le calcul"]]],
  [
    "Fenêtre",
    [
      ["window:minimize", "Réduire la fenêtre"],
      ["window:fullscreen", "Plein écran"],
      ["window:close", "Fermer la fenêtre"],
    ],
  ],
  [
    "Aide",
    [
      ["help:guide", "Guide de prise en main"],
      ["help:shortcuts", "Raccourcis clavier…"],
      ["app:about", "À propos de KaliSigma"],
    ],
  ],
] as const;
const projectOnly = (id: string) =>
  /^(edit:|view:|study:|help:)/.test(id) ||
  ["file:save", "file:export", "file:rename"].includes(id);

/** Themed application menus on Windows/Linux; system-wide native menus on macOS. */
export function DesktopMenu({
  projectActive,
  editorActive,
}: {
  projectActive: boolean;
  editorActive: boolean;
}) {
  const [native, setNative] = useState(false),
    [picker, setPicker] = useState(false);
  const navigate = useNavigate(),
    { workspace, update } = useWorkspace();
  useEffect(() => {
    let disposed = false,
      unlisten: (() => void) | undefined;
    void (async () => {
      try {
        const ready = await invoke<boolean>("desktop_menu_ready");
        if (!ready || disposed) return;
        const stop = await listen<string>("desktop-menu", (event) =>
          desktopCommand(event.payload),
        );
        if (disposed) {
          stop();
          return;
        }
        unlisten = stop;
        setNative(true);
      } catch {
        /* A preview without a native menu keeps the keyboard-accessible fallback. */
      }
    })();
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.nativeMenu = String(native);
    if (native)
      void invoke("set_menu_context", {
        project: projectActive,
        editor: editorActive,
      }).catch(() => {});
    return () => {
      delete document.documentElement.dataset.nativeMenu;
    };
  }, [native, projectActive, editorActive]);
  useEffect(() => {
    if (native) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const key = event.key.toLowerCase();
      if (
        document.querySelector('[role="dialog"]:not([data-state="closed"])')
      ) {
        if (key === "f5" || ((event.ctrlKey || event.metaKey) && key === "s"))
          event.preventDefault();
        return;
      }
      if (key === "f10" || (event.altKey && key === "f")) {
        event.preventDefault();
        document.querySelector<HTMLElement>(".desktop-menu-trigger")?.focus();
        return;
      }
      const command = event.ctrlKey || event.metaKey;
      const id =
        command && !event.altKey
          ? key === "s"
            ? event.shiftKey
              ? "file:export"
              : "file:save"
            : key === "o"
              ? "file:open"
              : key === "n" && event.shiftKey
                ? "file:new"
                : undefined
          : key === "f5"
            ? "study:calculate"
            : undefined;
      if (!id) return;
      event.preventDefault();
      if (
        !projectOnly(id) ||
        (projectActive && (id !== "study:calculate" || editorActive))
      )
        desktopCommand(id);
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [native, projectActive, editorActive]);
  useDesktopCommands({
    "file:new": () => setPicker(true),
    "file:open": () => navigate("/projects"),
    "file:import": () => {
      void importProjects(workspace)
        .then((next) => next && update(next))
        .catch(() => toast.error("Import impossible."));
    },
    "app:settings": () => navigate("/settings"),
    ...Object.fromEntries(
      ["minimize", "fullscreen", "close"].map((action) => [
        `window:${action}`,
        () => {
          void invoke("desktop_window_action", { action }).catch(() =>
            toast.error("La commande de fenêtre n’a pas abouti."),
          );
        },
      ]),
    ),
    "app:about": () =>
      toast.info("KaliSigma · Atelier de structure · Version 0.2.0"),
  });
  return (
    <>
      {!native && (
        <Menubar.Root
          className="desktop-commandbar desktop-menubar"
          aria-label="Menus de l’application"
        >
          {menus.map(([label, items]) => (
            <Menubar.Menu key={label}>
              <Menubar.Trigger className="desktop-menu-trigger">
                {label}
              </Menubar.Trigger>
              <Menubar.Portal>
                <Menubar.Content
                  className="desktop-menu-content"
                  sideOffset={2}
                >
                  {items.map(([id, name]) => (
                    <Menubar.Item
                      className="desktop-menu-item"
                      key={id}
                      disabled={
                        (projectOnly(id) && !projectActive) ||
                        (/^(edit:|view:|study:|help:shortcuts)/.test(id) &&
                          !editorActive)
                      }
                      onSelect={() => desktopCommand(id)}
                    >
                      {name}
                    </Menubar.Item>
                  ))}
                </Menubar.Content>
              </Menubar.Portal>
            </Menubar.Menu>
          ))}
        </Menubar.Root>
      )}
      <Dialog open={picker} onOpenChange={setPicker}>
        <DialogContent className="desktop-project-picker">
          <DialogHeader>
            <DialogTitle>Nouveau projet</DialogTitle>
            <DialogDescription>
              Choisissez le type d’étude à créer.
            </DialogDescription>
          </DialogHeader>
          <div className="picker-list">
            {projectTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => {
                  setPicker(false);
                  requestNewStudy(type.id);
                }}
              >
                <ProjectIcon type={type.id} size={32} />
                <span>{type.label}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
