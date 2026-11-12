import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  Plus,
  Search,
  Upload,
  X,
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
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const families = [
  "Analyse structurale",
  "Descente de charges",
  "Prédimensionnement",
] as const;
const descriptions = [
  "Appuis, charges, efforts et déplacements",
  "Des planchers aux éléments porteurs",
  "Les dimensions de vos éléments en béton",
];

export function Dashboard() {
  const { workspace, update } = useWorkspace(),
    [search, setSearch] = useState(""),
    [family, setFamily] = useState("Tous"),
    [picker, setPicker] = useState(false),
    searchInput = useRef<HTMLInputElement>(null),
    navigate = useNavigate();
  const filtered = useMemo(
    () =>
      projectTypes.filter(
        (type) =>
          (family === "Tous" || type.family === family) &&
          normalize(
            `${type.label} ${type.description} ${type.family}`,
          ).includes(normalize(search)),
      ),
    [search, family],
  );
  const recent = useMemo(
    () =>
      [...workspace.projects]
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
        .slice(0, 5),
    [workspace.projects],
  );
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (
        !picker &&
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        searchInput.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, [picker]);
  const load = async () => {
    try {
      const imported = await importProjects(workspace);
      if (imported) {
        await update(imported);
        toast.success("Projets importés dans votre espace.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Import impossible.",
      );
    }
  };
  return (
    <div className="dashboard page-content">
      <header className="page-title">
        <div>
          <p className="dashboard-context">Votre atelier de calcul</p>
          <h1>Vos calculs de structure</h1>
          <p>
            Analysez un modèle, suivez les charges ou dimensionnez un élément.
          </p>
        </div>
        <div className="dashboard-actions">
          <Button variant="outline" onClick={() => void load()}>
            <Upload size={16} />
            Importer
          </Button>
          <Button className="dashboard-create" onClick={() => setPicker(true)}>
            <Plus size={16} />
            Nouveau projet
          </Button>
        </div>
      </header>
      <div className="dashboard-summary">
        <span>
          <strong className="mono">{projectTypes.length}</strong> types de
          projet
        </span>
        <span>
          <strong className="mono">{workspace.projects.length}</strong> projet
          {workspace.projects.length > 1 ? "s" : ""} enregistré
          {workspace.projects.length > 1 ? "s" : ""}
        </span>
        <span className="workspace-local">Espace local</span>
      </div>
      <div className="dashboard-sections">
        <main className="dashboard-catalog" aria-label="Catalogue des calculs">
          <div className="search-box">
            <Search size={18} />
            <Input
              ref={searchInput}
              aria-label="Rechercher un type de projet"
              aria-keyshortcuts="Control+k Meta+k"
              placeholder="Rechercher un calcul"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="search-suffix">
              {search ? (
                <button
                  type="button"
                  aria-label="Effacer la recherche"
                  onClick={() => {
                    setSearch("");
                    searchInput.current?.focus();
                  }}
                >
                  <X size={16} />
                </button>
              ) : (
                <kbd>
                  {/Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl"} K
                </kbd>
              )}
            </div>
          </div>
          <div
            className="catalog-filters"
            role="group"
            aria-label="Filtrer les types de projets"
          >
            {["Tous", ...families].map((item) => (
              <button
                type="button"
                key={item}
                aria-pressed={family === item}
                onClick={() => setFamily(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <span className="sr-only" role="status">
            {filtered.length} type{filtered.length > 1 ? "s" : ""} de projet
            disponible{filtered.length > 1 ? "s" : ""}
          </span>
          {families.map((item, index) => {
            const types = filtered.filter((type) => type.family === item);
            if (!types.length) return null;
            return (
              <section
                key={item}
                className={`project-family${item === "Analyse structurale" ? " analysis-family" : ""}`}
                aria-labelledby={`family-${index}`}
              >
                <div className="section-heading">
                  <div>
                    <h2 id={`family-${index}`}>{item}</h2>
                    <p>{descriptions[index]}</p>
                  </div>
                  <span className="family-count mono">
                    {types.length} calcul{types.length > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="project-type-grid">
                  {types.map((type) => (
                    <ProjectCard key={type.id} type={type.id} />
                  ))}
                </div>
              </section>
            );
          })}
          {!filtered.length && (
            <div className="catalog-empty">
              <Empty title="Aucun type de projet trouvé">
                Essayez « poutre », « charges » ou « semelle ».
              </Empty>
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setFamily("Tous");
                }}
              >
                Réinitialiser les filtres
              </Button>
            </div>
          )}
        </main>
        <aside className="dashboard-aside">
          <Panel
            title="Reprendre une étude"
            action={
              <Link to="/projects" className="recent-all">
                Tout voir
                <ArrowUpRight size={14} />
              </Link>
            }
          >
            {recent.length ? (
              <div className="recent-projects">
                {recent.map((project) => (
                  <Link
                    to={`/project/${project.id}`}
                    className="recent-project"
                    key={project.id}
                  >
                    <ProjectIcon type={project.type} size={44} />
                    <div>
                      <strong>{project.name}</strong>
                      <small>{typeInfo(project.type).label}</small>
                    </div>
                    <ChevronRight size={16} />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="recent-empty">
                <div className="empty-study" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <h3>Votre première étude</h3>
                <p>
                  Choisissez un calcul, puis enregistrez votre modèle. Vous le
                  retrouverez ici.
                </p>
                <Button variant="ghost" onClick={() => setPicker(true)}>
                  Choisir un calcul
                  <ArrowRight size={16} />
                </Button>
              </div>
            )}
          </Panel>
          <section className="dashboard-guide" aria-labelledby="guide-title">
            <h2 id="guide-title">Du modèle aux résultats</h2>
            <ol>
              {[
                ["Définir", "Géométrie, matériaux et unités"],
                ["Charger", "Appuis et actions sur la structure"],
                ["Lire", "Efforts, déplacements et sections"],
              ].map(([title, description], index) => (
                <li key={title}>
                  <span className="mono">{index + 1}</span>
                  <div>
                    <strong>{title}</strong>
                    <p>{description}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link to="/settings">
              Vos réglages de calcul
              <ArrowUpRight size={16} />
            </Link>
          </section>
        </aside>
      </div>
      <Dialog open={picker} onOpenChange={setPicker}>
        <DialogContent className="project-picker dashboard-picker">
          <DialogHeader>
            <DialogTitle>Quel projet voulez-vous créer ?</DialogTitle>
            <DialogDescription>
              Choisissez votre système ou votre élément de structure.
            </DialogDescription>
          </DialogHeader>
          <div className="picker-list">
            {projectTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => {
                  setPicker(false);
                  navigate(`/new/${type.id}`);
                }}
              >
                <ProjectIcon type={type.id} size={44} />
                <div>
                  <strong>{type.label}</strong>
                  <small>{type.family}</small>
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
  const info = typeInfo(type);
  return (
    <Link to={`/new/${type}`} className="project-type-card">
      <ProjectIcon
        type={type}
        size={type === "beam" || type === "frame" ? 80 : 64}
      />
      <div className="project-card-copy">
        <h3>{info.label}</h3>
        <p>{info.description}</p>
      </div>
      <ArrowUpRight className="project-card-arrow" size={18} />
    </Link>
  );
}
