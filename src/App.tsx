import { useEffect } from "react";
import {
  HashRouter,
  Routes,
  Route,
  NavLink,
  Link,
  useParams,
  useLocation,
} from "react-router-dom";
import {
  Calculator,
  FolderOpen,
  Settings2,
  UserRound,
  ChevronRight,
  FolderCheck,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/common";
import { useWorkspace } from "@/lib/workspace";
import { diagnostic, exportJson } from "@/lib/storage";
import { validateProject } from "@/lib/project-io";
import { projectTypes, type ProjectType } from "@/domain/projects";
import { Dashboard } from "@/pages/dashboard";
import { ProjectsPage } from "@/pages/projects-page";
import { SettingsPage } from "@/pages/settings-page";
import { Onboarding } from "@/pages/onboarding";
import { AnalysisPage } from "@/pages/analysis-page";
import { DescentPage } from "@/pages/descent-page";
import { PredimPage } from "@/pages/predim-page";
import { BuildingPage } from "@/pages/building-page";
const navigation = [
  { to: "/", label: "Calculs", Icon: Calculator },
  { to: "/projects", label: "Mes projets", Icon: FolderOpen },
  { to: "/settings", label: "Paramètres", Icon: Settings2 },
  { to: "/profile", label: "Mon profil", Icon: UserRound },
];
export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}
function Shell() {
  const { workspace, temporary } = useWorkspace(),
    location = useLocation();
  useEffect(() => {
    diagnostic("ui.ready");
    document.documentElement.dataset.appReady = "true";
  }, []);
  if (!workspace.onboarding) return <Onboarding />;
  return (
    <div className="app-shell" data-testid="app-shell">
      <aside className="app-sidebar">
        <Link to="/" className="brand">
          <span className="brand-mark">σ</span>
          <div>
            <strong>StructCalc</strong>
            <small>Votre atelier de structure</small>
          </div>
        </Link>
        <span className="nav-caption">ESPACE DE TRAVAIL</span>
        <nav>
          {navigation.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} end={to === "/"}>
              <Icon size={18} />
              <span>{label}</span>
              <ChevronRight className="nav-chevron" size={14} />
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <FolderCheck size={18} />
          <div>
            <strong>
              {temporary ? "Session temporaire" : "Votre espace local"}
            </strong>
            <span>
              {temporary
                ? "Sauvegarde désactivée"
                : "Projets conservés sur cet appareil"}
            </span>
          </div>
        </div>
        <div className="sidebar-profile">
          <span>{workspace.profile.name.slice(0, 1).toUpperCase() || "S"}</span>
          <div>
            <strong>{workspace.profile.name || "Mon espace"}</strong>
            <small>{workspace.profile.profession}</small>
          </div>
          <Link to="/profile" aria-label="Modifier mon profil">
            <Settings2 size={15} />
          </Link>
        </div>
      </aside>
      <div className="main-column">
        <header className="mobile-app-header">
          <Link to="/" className="brand">
            <span className="brand-mark small">σ</span>
            <strong>StructCalc</strong>
          </Link>
          <Link to="/profile" aria-label="Mon profil">
            <UserRound size={20} />
          </Link>
        </header>
        <div className="route-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/profile" element={<SettingsPage profile />} />
            <Route
              path="/new/:type"
              element={<ProjectRoute key={location.pathname} />}
            />
            <Route
              path="/project/:id"
              element={<ProjectRoute key={location.pathname} />}
            />
            <Route
              path="*"
              element={
                <div className="page-content">
                  <h1>Page introuvable</h1>
                  <Button asChild>
                    <Link to="/">Retour aux calculs</Link>
                  </Button>
                </div>
              }
            />
          </Routes>
        </div>
        <nav className="mobile-navigation">
          {navigation.slice(0, 3).map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} end={to === "/"}>
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
function ProjectRoute() {
  const { type, id } = useParams(),
    { workspace } = useWorkspace(),
    project = id ? workspace.projects.find((p) => p.id === id) : undefined;
  const actual = (project?.type ?? type) as ProjectType;
  if ((id && !project) || !projectTypes.some((t) => t.id === actual))
    return (
      <div className="page-content">
        <h1>Projet introuvable</h1>
        <Button asChild>
          <Link to="/projects">Revenir aux projets</Link>
        </Button>
      </div>
    );
  if (project) {
    try {
      validateProject(project);
    } catch {
      return (
        <div className="page-content">
          <h1>Ce projet ne peut pas être ouvert</h1>
          <Notice danger>
            Le format des paramètres est invalide ou provient d’une version
            différente. Le fichier original est conservé.
          </Notice>
          <Button
            onClick={() =>
              void exportJson(`${project.name}-original.json`, project)
            }
          >
            Exporter les données originales
          </Button>
          <Button asChild variant="outline">
            <Link to="/projects">Retour aux projets</Link>
          </Button>
        </div>
      );
    }
  }
  if (actual === "beam" || actual === "frame")
    return <AnalysisPage kind={actual} project={project} />;
  if (actual === "column-load" || actual === "wall-load")
    return <DescentPage kind={actual} project={project} />;
  if (actual === "building") return <BuildingPage project={project} />;
  return <PredimPage type={actual} project={project} />;
}
