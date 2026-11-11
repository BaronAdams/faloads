import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  ChevronRight,
  FolderOpen,
  Plus,
  Search,
  Upload,
  Clock3,
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
} from "@/components/ui/dialog";
import { Panel, ProjectIcon, Empty } from "@/components/common";
import { projectTypes, type ProjectType, typeInfo } from "@/domain/projects";
import { useWorkspace } from "@/lib/workspace";
import { importProjects } from "@/lib/project-io";
const normalize = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function Dashboard() {
  const { workspace, update } = useWorkspace(),
    [search, setSearch] = useState(""),
    [picker, setPicker] = useState(false),
    navigate = useNavigate();
  const filtered = useMemo(
    () =>
      projectTypes.filter((t) =>
        normalize(`${t.label} ${t.description} ${t.family}`).includes(
          normalize(search),
        ),
      ),
    [search],
  );
  const load = async () => {
    try {
      const imported = await importProjects(workspace);
      if (imported) {
        await update(imported);
        toast.success("Projets importés dans votre espace.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import impossible.");
    }
  };
  return (
    <div className="dashboard page-content">
      <header className="page-title">
        <div>
          <span className="eyebrow">VOTRE ESPACE DE TRAVAIL</span>
          <h1>
            {workspace.profile.name
              ? `Bonjour ${workspace.profile.name}.`
              : "Concevez avec clarté."}
          </h1>
          <p>Vos structures, vos calculs, un espace pour avancer.</p>
        </div>
        <Button onClick={() => setPicker(true)}>
          <Plus />
          Nouveau projet
        </Button>
      </header>
      <div className="dashboard-overview">
        <div>
          <span className="overview-icon">
            <FolderOpen size={20} />
          </span>
          <div>
            <strong className="mono">{workspace.projects.length}</strong>
            <span>
              projet{workspace.projects.length > 1 ? "s" : ""} enregistré
              {workspace.projects.length > 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <div>
          <span className="overview-icon">
            <svg
              width="21"
              height="21"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M3 20V5h18v15M3 12h18M9 5v15M15 5v15" />
            </svg>
          </span>
          <div>
            <strong className="mono">13</strong>
            <span>types de projet</span>
          </div>
        </div>
        <div className="overview-action">
          <span>Un projet existant ?</span>
          <Button variant="ghost" onClick={() => void load()}>
            <Upload size={15} />
            Importer un fichier
          </Button>
        </div>
      </div>
      <div className="dashboard-sections">
        <main>
          <div className="search-box">
            <Search size={17} />
            <Input
              aria-label="Rechercher un type de projet"
              placeholder="Rechercher un type de projet…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd>⌕</kbd>
          </div>
          {[
            "Analyse structurale",
            "Descente de charges",
            "Prédimensionnement",
          ].map((family) => {
            const types = filtered.filter((t) => t.family === family);
            if (!types.length) return null;
            return (
              <section key={family} className="project-family">
                <div className="section-heading">
                  <div>
                    <h2>{family}</h2>
                    <p>
                      {family === "Analyse structurale"
                        ? "Explorez les efforts et les déplacements."
                        : family === "Descente de charges"
                          ? "Suivez les charges jusqu’aux éléments porteurs."
                          : "Estimez les dimensions de vos éléments en béton."}
                    </p>
                  </div>
                  <span className="count-badge mono">{types.length}</span>
                </div>
                <div className="project-type-grid">
                  {types.map((t) => (
                    <ProjectCard key={t.id} type={t.id} />
                  ))}
                </div>
              </section>
            );
          })}
          {!filtered.length && (
            <Empty title="Aucun type de projet trouvé">
              Essayez « poutre », « charges » ou « semelle ».
            </Empty>
          )}
        </main>
        <aside className="dashboard-aside">
          <Panel
            title="Reprendre un projet"
            action={
              <Link to="/projects" className="text-primary text-xs">
                Tout voir
              </Link>
            }
          >
            {workspace.projects.length ? (
              workspace.projects.slice(0, 5).map((p) => (
                <button
                  key={p.id}
                  className="recent-project"
                  onClick={() => navigate(`/project/${p.id}`)}
                >
                  <ProjectIcon type={p.type} size={42} />
                  <div>
                    <strong>{p.name}</strong>
                    <small>{typeInfo(p.type).label}</small>
                  </div>
                  <ChevronRight size={15} />
                </button>
              ))
            ) : (
              <Empty title="Votre prochain projet commence ici">
                Choisissez un calcul, puis enregistrez-le pour le retrouver sur
                cet appareil.
              </Empty>
            )}
          </Panel>
          <div className="dashboard-note">
            <span className="eyebrow">UNE MÉTHODE CLAIRE</span>
            <h3>
              Modéliser.
              <br />
              Comprendre.
              <br />
              Vérifier.
            </h3>
            <p>
              Les unités et les hypothèses restent visibles, à chaque étape du
              calcul.
            </p>
            <Link to="/settings">
              Personnaliser mes réglages <ArrowUpRight size={14} />
            </Link>
          </div>
        </aside>
      </div>
      <Dialog open={picker} onOpenChange={setPicker}>
        <DialogContent className="project-picker">
          <DialogHeader>
            <DialogTitle>Quel projet voulez-vous créer ?</DialogTitle>
            <DialogDescription>
              Choisissez votre système ou votre élément de structure.
            </DialogDescription>
          </DialogHeader>
          <div className="picker-list">
            {projectTypes.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setPicker(false);
                  navigate(`/new/${t.id}`);
                }}
              >
                <ProjectIcon type={t.id} size={42} />
                <div>
                  <strong>{t.label}</strong>
                  <small>{t.family}</small>
                </div>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function ProjectCard({ type }: { type: ProjectType }) {
  const t = typeInfo(type);
  return (
    <Link to={`/new/${type}`} className="project-type-card">
      <div className="project-card-top">
        <ProjectIcon type={type} size={64} />
        <ArrowUpRight size={16} />
      </div>
      <div>
        <h3>{t.label}</h3>
        <p>{t.description}</p>
      </div>
      <span className="card-open">
        Ouvrir le projet <ChevronRight size={13} />
      </span>
    </Link>
  );
}
