import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Copy,
  Download,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Panel, ProjectIcon, Choice, Empty } from "@/components/common";
import { useWorkspace } from "@/lib/workspace";
import { projectTypes, typeInfo } from "@/domain/projects";
import { exportJson, type Project } from "@/lib/storage";
import { importProjects } from "@/lib/project-io";
import { uid } from "@/lib/utils";
export function ProjectsPage() {
  const { workspace, saveProject, removeProject, update } = useWorkspace(),
    navigate = useNavigate(),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [sort, setSort] = useState("recent"),
    [deleting, setDeleting] = useState<Project | null>(null);
  const projects = workspace.projects
    .filter(
      (p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) &&
        (filter === "all" || p.type === filter),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : b.updatedAt.localeCompare(a.updatedAt),
    );
  const load = async () => {
    try {
      const next = await importProjects(workspace);
      if (next) {
        await update(next);
        toast.success("Import terminé.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import impossible.");
    }
  };
  return (
    <div className="page-content">
      <header className="page-title">
        <div>
          <span className="eyebrow">VOTRE BIBLIOTHÈQUE</span>
          <h1>Mes projets</h1>
          <p>Reprenez vos modèles et conservez vos études.</p>
        </div>
        <div className="row-actions">
          <Button variant="outline" onClick={() => void load()}>
            <Upload />
            Importer
          </Button>
          <Button asChild>
            <Link to="/">
              <Plus />
              Nouveau projet
            </Link>
          </Button>
        </div>
      </header>
      <Panel>
        <div className="project-filters">
          <div className="search-box">
            <Search size={16} />
            <Input
              aria-label="Rechercher un projet"
              placeholder="Rechercher un projet…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Choice
            label="Type de projet"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "Tous les types" },
              ...projectTypes.map((t) => ({ value: t.id, label: t.label })),
            ]}
          />
          <Choice
            label="Trier par"
            value={sort}
            onChange={setSort}
            options={[
              { value: "recent", label: "Plus récent" },
              { value: "name", label: "Nom du projet" },
            ]}
          />
        </div>
        {projects.length ? (
          <div className="project-list">
            {projects.map((p) => (
              <div key={p.id} className="saved-project">
                <button
                  className="saved-project-main"
                  onClick={() => navigate(`/project/${p.id}`)}
                >
                  <ProjectIcon type={p.type} size={52} />
                  <div>
                    <h3>{p.name}</h3>
                    <p>{typeInfo(p.type).label}</p>
                  </div>
                  <time>
                    {new Intl.DateTimeFormat("fr-FR", {
                      dateStyle: "medium",
                    }).format(new Date(p.updatedAt))}
                  </time>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Actions pour ${p.name}`}
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onSelect={() =>
                        void saveProject({
                          ...structuredClone(p),
                          id: uid(),
                          name: `Copie de ${p.name}`,
                          updatedAt: new Date().toISOString(),
                        })
                          .then(() => toast.success("Projet dupliqué."))
                          .catch(() => toast.error("Duplication impossible."))
                      }
                    >
                      <Copy />
                      Dupliquer
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        void exportJson(`${p.name}.structcalc.json`, {
                          format: "structcalc-project",
                          version: 1,
                          project: p,
                        }).catch(() => toast.error("Export impossible."))
                      }
                    >
                      <Download />
                      Exporter
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onSelect={() => setDeleting(p)}
                    >
                      <Trash2 />
                      Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title={
              workspace.projects.length
                ? "Aucun projet ne correspond"
                : "Aucun projet enregistré"
            }
          >
            Créez un projet depuis l’espace Calculs, puis utilisez « Enregistrer
            ».
          </Empty>
        )}
      </Panel>
      <Dialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer ce projet ?</DialogTitle>
            <DialogDescription>
              Le projet « {deleting?.name} » sera retiré de cet appareil. Vous
              pouvez l’exporter avant de le supprimer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Conserver
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!deleting) return;
                const p = deleting;
                void removeProject(p.id)
                  .then(() => {
                    setDeleting(null);
                    toast.success("Projet supprimé.", {
                      action: {
                        label: "Annuler",
                        onClick: () =>
                          void saveProject(p).catch(() =>
                            toast.error("Restauration impossible."),
                          ),
                      },
                    });
                  })
                  .catch(() => toast.error("Suppression impossible."));
              }}
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
