import { useEffect, useState } from "react";
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
export function requestNewStudy(type: ProjectType) {
  window.dispatchEvent(new CustomEvent("study:new", { detail: type }));
}
export function NewStudyDialog() {
  const location = useLocation(),
    navigate = useNavigate(),
    { drafts } = useWorkspace();
  const direct =
    location.pathname.startsWith("/new/") && !location.state?.newStudyName
      ? (location.pathname.split("/")[2] as ProjectType)
      : null;
  const [requested, setRequested] = useState<ProjectType | null>(null),
    [name, setName] = useState("");
  const type =
    requested ?? (projectTypes.some((p) => p.id === direct) ? direct : null);
  useEffect(() => {
    const request = (e: Event) => {
      setRequested((e as CustomEvent<ProjectType>).detail);
      setName("");
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
    if (direct) navigate("/");
  };
  return (
    <Dialog
      open={!!type}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="name-study-dialog">
        <DialogHeader>
          <DialogTitle>Comment s’appelle votre étude ?</DialogTitle>
          <DialogDescription>
            {type ? typeInfo(type).label : ""} · Le modèle s’ouvrira après
            validation du nom.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || !type) return;
            drafts.delete(type);
            setRequested(null);
            setName("");
            navigate(`/new/${type}`, {
              replace: !!direct,
              state: {
                newStudyName: name.trim(),
                creationToken: crypto.randomUUID(),
              },
            });
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
          <div className="name-actions">
            <Button type="button" variant="ghost" onClick={close}>
              Annuler
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Créer l’étude
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
