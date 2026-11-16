import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAppTheme as useTheme } from "@/lib/theme";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertTriangle, LoaderCircle, RotateCcw } from "lucide-react";
import {
  freshWorkspace,
  readWorkspace,
  writeWorkspace,
  diagnostic,
  type Workspace,
  type Project,
} from "./storage";
interface Context {
  workspace: Workspace;
  temporary: boolean;
  update: (patch: Partial<Workspace>) => Promise<void>;
  saveProject: (project: Project) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  drafts: Map<string, unknown>;
}
const WorkspaceContext = createContext<Context | null>(null);
export const useWorkspace = () => {
  const c = useContext(WorkspaceContext);
  if (!c) throw Error("Espace non initialisé");
  return c;
};
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null),
    [error, setError] = useState(false),
    [temporary, setTemporary] = useState(false),
    [writeError, setWriteError] = useState(false);
  const value = useRef<Workspace>(freshWorkspace()),
    queue = useRef(Promise.resolve()),
    generation = useRef(0),
    drafts = useRef(new Map<string, unknown>());
  const { setTheme } = useTheme();
  const load = useCallback(async () => {
    const token = ++generation.current;
    setError(false);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const next = await Promise.race([
        readWorkspace(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(Error("timeout")), 8000);
        }),
      ]);
      if (token === generation.current) {
        value.current = next;
        setWorkspace(next);
        diagnostic("workspace.ready");
      }
    } catch {
      if (token === generation.current) setError(true);
      diagnostic("workspace.read_error");
    } finally {
      clearTimeout(timeout);
    }
  }, []);
  useEffect(() => {
    void load();
    return () => {
      generation.current++;
    };
  }, [load]);
  useEffect(() => {
    if (workspace) setTheme(workspace.theme);
  }, [workspace?.theme, setTheme]);
  const update = useCallback(
    async (patch: Partial<Workspace>) => {
      const next = { ...value.current, ...patch };
      value.current = next;
      setWorkspace(next);
      if (temporary)
        throw Error(
          "La sauvegarde est désactivée pendant la session temporaire.",
        );
      const operation = queue.current
        .catch(() => {})
        .then(() => writeWorkspace(next));
      queue.current = operation;
      try {
        await operation;
        setWriteError(false);
      } catch (e) {
        setWriteError(true);
        throw e;
      }
    },
    [temporary],
  );
  if (!workspace)
    return (
      <div className="boot-screen">
        <div className="brand-mark">σ</div>
        <h1>
          {error
            ? "Vos données n’ont pas pu être ouvertes"
            : "Ouverture de StructCalc"}
        </h1>
        {error ? (
          <>
            <p>
              Votre sauvegarde est conservée. Réessayez ou continuez dans une
              session temporaire sans sauvegarde.
            </p>
            <Button onClick={() => void load()}>
              <RotateCcw />
              Réessayer
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                generation.current++;
                const next = freshWorkspace();
                value.current = next;
                setWorkspace(next);
                setTemporary(true);
              }}
            >
              Continuer sans sauvegarde
            </Button>
          </>
        ) : (
          <>
            <LoaderCircle className="animate-spin" />
            <p>Préparation de votre espace de travail…</p>
          </>
        )}
      </div>
    );
  const saveProject = async (project: Project) => {
    if (temporary)
      throw Error("Sauvegarde désactivée dans cette session temporaire.");
    await update({
      projects: [
        project,
        ...value.current.projects.filter((p) => p.id !== project.id),
      ],
    });
  };
  const removeProject = async (id: string) => {
    if (temporary)
      throw Error("Sauvegarde désactivée dans cette session temporaire.");
    await update({
      projects: value.current.projects.filter((p) => p.id !== id),
    });
  };
  return (
    <WorkspaceContext
      value={{
        workspace,
        temporary,
        update,
        saveProject,
        removeProject,
        drafts: drafts.current,
      }}
    >
      {(temporary || writeError) && (
        <div className="persistence-banner" role="status">
          <AlertTriangle size={16} />
          {temporary
            ? "Session temporaire · sauvegarde désactivée"
            : "Les dernières modifications n’ont pas pu être sauvegardées."}
          {writeError && !temporary && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void update({}).catch(() =>
                  toast.error("Sauvegarde toujours indisponible."),
                )
              }
            >
              Réessayer
            </Button>
          )}
        </div>
      )}
      {children}
    </WorkspaceContext>
  );
}
