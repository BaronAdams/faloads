import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, X } from "lucide-react";
import { Button } from "./ui/button";
import { useWorkspace } from "@/lib/workspace";
import { type ProjectType } from "@/domain/projects";
import { studyAction } from "@/lib/study-events";
const GuideContext = createContext<{ active: boolean; instruction?: string }>({
  active: false,
});
export const useStudyGuide = () => useContext(GuideContext);
type Step = { target: string; title: string; text: string; action: string };
const stepsFor = (type: ProjectType): Step[] => {
  const save: Step = {
    target: "save",
    title: "Conservez votre étude",
    text: "Enregistrez ce modèle pour le retrouver dans vos projets. Vous pourrez continuer à le modifier.",
    action: "project:saved",
  };
  if (type === "beam" || type === "frame")
    return [
      {
        target: "parameters",
        title: "Commencez par le modèle",
        text: "Ouvrez les paramètres. Le schéma restera votre espace de travail principal.",
        action: "parameters:open",
      },
      {
        target: "parameters-inputs",
        title: "Adaptez la géométrie",
        text: "Modifiez une valeur pour adapter le modèle à votre étude.",
        action: "input:edited",
      },
      {
        target: "parameters-done",
        title: "Revenez au schéma",
        text: "Fermez les paramètres pour construire votre modèle sur le dessin.",
        action: "parameters:close",
      },
      {
        target: "add",
        title: "Ajoutez un élément",
        text: "Ouvrez Ajouter, choisissez un élément, renseignez ses valeurs puis appliquez.",
        action: "element:applied",
      },
      {
        target: "calculate",
        title: "Lancez l’analyse",
        text: "Calculez le modèle. Les efforts et déplacements seront disponibles après cette étape.",
        action: "calculation:complete",
      },
      {
        target: "results",
        title: "Consultez les valeurs",
        text: "Ouvrez les résultats chiffrés. Les diagrammes se choisissent directement sur le schéma.",
        action: "results:open",
      },
      {
        target: "results-done",
        title: "Retrouvez votre espace",
        text: "Fermez le panneau. Vous pourrez le rouvrir à tout moment.",
        action: "results:close",
      },
      save,
    ];
  if (type === "column-load" || type === "wall-load")
    return [
      {
        target: "next",
        title: "Définissez le système porteur",
        text: "Choisissez le règlement et le cheminement des charges, puis passez aux portées.",
        action: "descent:1",
      },
      {
        target: "next",
        title: "Délimitez la surface d’influence",
        text: "Renseignez les longueurs indiquées sur le schéma, puis continuez.",
        action: "descent:2",
      },
      {
        target: "level-edit",
        title: "Renseignez les charges par niveau",
        text: "Ouvrez un niveau, adaptez ses charges, puis appliquez les changements.",
        action: "level:applied",
      },
      {
        target: "next",
        title: "Vérifiez le récapitulatif",
        text: "Passez à la vérification du modèle avant de lancer le calcul.",
        action: "descent:3",
      },
      {
        target: "next",
        title: "Calculez la descente de charges",
        text: "Lancez le calcul. La fiche de résultats s’ouvrira une fois les efforts déterminés.",
        action: "calculation:complete",
      },
      save,
    ];
  if (type === "building")
    return [
      {
        target: "building-inputs",
        title: "Adaptez votre trame",
        text: "Modifiez une portée pour définir la géométrie du bâtiment. Les éléments du plan sont ensuite éditables au clic.",
        action: "input:edited",
      },
      {
        target: "calculate",
        title: "Calculez le bâtiment",
        text: "Lancez le calcul des niveaux. Vous serez ensuite dirigé vers les résultats.",
        action: "calculation:complete",
      },
      save,
    ];
  return [
    {
      target: "predim-inputs",
      title: "Renseignez votre élément",
      text: "Adaptez une valeur aux données de votre étude. La proposition de section se met à jour à côté du formulaire.",
      action: "input:edited",
    },
    save,
  ];
};
export function ProjectGuide({
  type,
  existing,
  children,
}: {
  type: ProjectType;
  existing: boolean;
  children: ReactNode;
}) {
  const { workspace, update, temporary } = useWorkspace();
  const progress = workspace.guides[type];
  const [started, setStarted] = useState(existing),
    [step, setStep] = useState(0),
    [done, setDone] = useState(progress?.completed ?? false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const steps = stepsFor(type),
    active = started && !done && step < steps.length;
  const current = steps[step],
    latest = useRef(workspace.guides);
  latest.current = workspace.guides;
  const persist = (next: number, completed: boolean) => {
    setStep(next);
    setDone(completed);
    if (!temporary)
      void update({
        guides: { ...latest.current, [type]: { step: next, completed } },
      }).catch(() => {});
  };
  useEffect(() => {
    const listener = (event: Event) => {
      const action = (event as CustomEvent<string>).detail;
      if (action === "name:created") setStarted(true);
      if (action === "guide:replay") {
        setStarted(true);
        persist(0, false);
      }
      if (action === "guide:skip") persist(steps.length, true);
      if (active && current?.action === action)
        persist(step + 1, step + 1 >= steps.length);
    };
    window.addEventListener("study-action", listener);
    return () => window.removeEventListener("study-action", listener);
  });
  useEffect(() => {
    if (!active) {
      setRect(null);
      return;
    }
    let first = true;
    const locate = () => {
      let el = document.querySelector<HTMLElement>(
        `[data-tour="${current.target}"]`,
      );
      if (
        ["parameters-inputs", "predim-inputs", "building-inputs"].includes(
          current.target,
        )
      )
        el = el?.querySelector<HTMLElement>(".field") ?? el;
      if (["add", "level-edit"].includes(current.target))
        el =
          document.querySelector<HTMLElement>('[data-tour="element-apply"]') ??
          (current.target === "add"
            ? document.querySelector<HTMLElement>('[role="menu"]')
            : null) ??
          el;
      let r = el?.getBoundingClientRect();
      if (first && el && r && (r.top < 0 || r.bottom > innerHeight)) {
        el.scrollIntoView({
          block: "center",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
        });
        r = el.getBoundingClientRect();
      }
      first = false;
      setRect((prev) =>
        !r || r.width === 0 || r.height === 0
          ? null
          : prev &&
              Math.abs(prev.x - r.x) < 1 &&
              Math.abs(prev.y - r.y) < 1 &&
              prev.width === r.width &&
              prev.height === r.height
            ? prev
            : r,
      );
    };
    locate();
    const timer = window.setInterval(locate, 150);
    return () => clearInterval(timer);
  }, [active, current?.target]);
  const width = Math.min(310, window.innerWidth - 24);
  const x = rect
    ? Math.max(12, Math.min(window.innerWidth - width - 12, rect.x))
    : 12;
  const top = rect
    ? rect.bottom + 12 + 185 < window.innerHeight
      ? rect.bottom + 12
      : Math.max(12, rect.top - 190)
    : 12;
  return (
    <GuideContext
      value={{ active, instruction: active ? current?.text : undefined }}
    >
      {children}
      {active &&
        rect &&
        createPortal(
          <div
            className="study-guide"
            aria-label="Guide de première utilisation"
          >
            <div
              className="guide-spotlight"
              aria-hidden="true"
              style={{
                left: rect.x - 5,
                top: rect.y - 5,
                width: rect.width + 10,
                height: rect.height + 10,
              }}
            />
            <aside
              className="guide-coach"
              key={step}
              style={{ left: x, top, width }}
              aria-live="polite"
            >
              <div className="guide-coach-top">
                <span>
                  <ArrowUpRight size={15} /> PREMIERS PAS · {step + 1}/
                  {steps.length}
                </span>
                <button
                  aria-label="Passer le guide"
                  onClick={() => studyAction("guide:skip")}
                >
                  <X size={16} />
                </button>
              </div>
              <strong>{current.title}</strong>
              <p>{current.text}</p>
              <div className="guide-progress">
                {steps.map((_, i) => (
                  <i key={i} className={i <= step ? "active" : ""} />
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => studyAction("guide:skip")}
              >
                Explorer librement
              </Button>
            </aside>
          </div>,
          document.body,
        )}
    </GuideContext>
  );
}
