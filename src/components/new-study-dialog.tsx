import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import { projectTypes, type ProjectType, typeInfo } from "@/domain/projects";
import { useWorkspace } from "@/lib/workspace";
import { projectDefaults } from "@/domain/project-defaults";
import { ProjectIcon } from "./common";
import { ChevronRight } from "lucide-react";
import { uid } from "@/lib/utils";
export function requestNewStudy(type?: ProjectType) {
  window.dispatchEvent(new CustomEvent("study:new", { detail: type }));
}
export function NewStudyDialog() {
  const location = useLocation(),
    navigate = useNavigate(),
    { drafts, workspace, saveProject, temporary } = useWorkspace();
  const direct =
    location.pathname.startsWith("/new/") && !location.state?.newStudyName
      ? (location.pathname.split("/")[2] as ProjectType)
      : null;
  const [requested, setRequested] = useState<ProjectType | null>(null),
    [name, setName] = useState(""),
    [picker, setPicker] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const creationId = useRef<string | null>(null);
  const type =
    requested ?? (projectTypes.some((p) => p.id === direct) ? direct : null);
  useEffect(() => {
    const request = (e: Event) => {
      const next = (e as CustomEvent<ProjectType | undefined>).detail;
      setPicker(!next);
      setRequested(next ?? null);
      setError("");
      setName("");
      creationId.current = null;
    };
    const click = (e: MouseEvent) => {
      if (e.button || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest("a");
      const match = a?.getAttribute("href")?.match(/^#?\/new\/([^/?]+)/);
      if (match && projectTypes.some((p) => p.id === match[1])) {
        e.preventDefault();
        e.stopPropagation();
        requestNewStudy(match[1] as ProjectType);
      }
    };
    window.addEventListener("study:new", request);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("study:new", request);
      document.removeEventListener("click", click, true);
    };
  }, []);
  const close = () => {
    setRequested(null);
    setName("");
    creationId.current = null;
    if (direct) navigate("/");
  };
  return (
    <>
      <Dialog open={picker} onOpenChange={setPicker}>
        <DialogContent className="project-picker dashboard-picker">
          <DialogHeader>
            <DialogTitle>Quel projet voulez-vous créer ?</DialogTitle>
            <DialogDescription>
              Choisissez un projet type, puis donnez un nom à votre étude.
            </DialogDescription>
          </DialogHeader>
          <div className="picker-list">
            {projectTypes.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setPicker(false);
                  setRequested(t.id);
                  setName("");
                  creationId.current = null;
                }}
              >
                <ProjectIcon type={t.id} size={44} />
                <div>
                  <strong>{t.label}</strong>
                  <small>{t.family}</small>
                </div>
                <ChevronRight />
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={() => setPicker(false)}>
            Annuler
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!type}
        onOpenChange={(open) => {
          if (!open && !busy) close();
        }}
      >
        <DialogContent className="name-study-dialog">
          <DialogHeader>
            <DialogTitle>Comment s’appelle votre étude ?</DialogTitle>
            <DialogDescription>
              {type ? typeInfo(type).label : ""} · Le modèle s’ouvrira après
              validation du nom.{" "}
              {temporary
                ? "Session temporaire sans sauvegarde."
                : "Il sera enregistré automatiquement sur cet appareil."}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim() || !type) return;
              if (busy) return;
              setBusy(true);
              setError("");
              try {
                const id = (creationId.current ??= uid()),
                  data = projectDefaults(type, workspace.preferences);
                if (!temporary)
                  await saveProject({
                    id,
                    type,
                    name: name.trim(),
                    data,
                    updatedAt: new Date().toISOString(),
                  });
                drafts.delete(type);
                if (temporary) drafts.set(type, data);
                creationId.current = null;
                setRequested(null);
                setName("");
                navigate(temporary ? `/new/${type}` : `/project/${id}`, {
                  replace: !!direct,
                  state: {
                    newStudyName: name.trim(),
                    creationToken: crypto.randomUUID(),
                    createdStudy: true,
                  },
                });
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Création impossible : vos données n’ont pas été enregistrées.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <Label htmlFor="new-study-name">Nom du projet</Label>
            <Input
              id="new-study-name"
              autoFocus
              required
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Résidence Horizon — structure"
            />
            {error && (
              <p role="alert" className="field-error">
                {error}
              </p>
            )}
            <div className="name-actions">
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={close}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={!name.trim() || busy}>
                {busy ? "Création en cours…" : "Créer l’étude"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
