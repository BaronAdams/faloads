import { useState } from "react";
import {
  ArrowRight,
  Check,
  Layers3,
  SlidersHorizontal,
  FolderCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProjectIcon } from "@/components/common";
import { useWorkspace } from "@/lib/workspace";
export function Onboarding() {
  const [step, setStep] = useState(0),
    { update } = useWorkspace();
  const finish = () =>
    void update({ onboarding: true }).catch(() =>
      toast.error(
        "La présentation ne pourra pas être mémorisée pendant cette session.",
      ),
    );
  const steps = [
    {
      title: "Vos structures prennent forme.",
      description:
        "Poutres, cadres, descentes de charges et prédimensionnement : un espace clair pour vos projets de structure.",
      Icon: Layers3,
    },
    {
      title: "Chaque paramètre à sa place.",
      description:
        "Définissez la géométrie et les charges, sélectionnez un élément sur le plan, puis explorez les efforts et les déplacements.",
      Icon: SlidersHorizontal,
    },
    {
      title: "Vos études vous accompagnent.",
      description:
        "Enregistrez vos modèles sur cet appareil. Exportez une sauvegarde pour les transférer et les reprendre ailleurs.",
      Icon: FolderCheck,
    },
  ];
  const s = steps[step];
  return (
    <main className="onboarding">
      <header>
        <div className="brand">
          <span className="brand-mark">σ</span>
          <strong>StructCalc</strong>
        </div>
        <Button variant="ghost" onClick={finish}>
          Passer la présentation
        </Button>
      </header>
      <div className="onboarding-content">
        <div className="onboarding-visual">
          <div className="icon-orbit">
            <ProjectIcon type="building" size={170} />
            <div className="orbit-icon one">
              <ProjectIcon type="beam" size={68} />
            </div>
            <div className="orbit-icon two">
              <ProjectIcon type="column" size={72} />
            </div>
            <div className="orbit-icon three">
              <ProjectIcon type="footing" size={65} />
            </div>
          </div>
          <span className="eyebrow">DU MODÈLE À LA DÉCISION</span>
        </div>
        <div className="onboarding-copy">
          <span className="step-pill">
            <s.Icon size={14} /> {step + 1} / 3
          </span>
          <h1>{s.title}</h1>
          <p>{s.description}</p>
          <Button
            size="lg"
            onClick={() => (step < 2 ? setStep(step + 1) : finish())}
          >
            {step === 0
              ? "Commencer"
              : step === 2
                ? "Accéder aux calculs"
                : "Continuer"}
            {step === 2 ? <Check /> : <ArrowRight />}
          </Button>
          <div className="onboarding-dots">
            {steps.map((_, i) => (
              <button
                key={i}
                aria-label={`Présentation ${i + 1}`}
                aria-current={i === step ? "step" : undefined}
                className={i === step ? "active" : ""}
                onClick={() => setStep(i)}
              />
            ))}
          </div>
        </div>
      </div>
      <footer>
        Un espace de calcul local · Des modèles et des hypothèses explicites
      </footer>
    </main>
  );
}
