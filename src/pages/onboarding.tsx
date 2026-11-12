import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  FileJson,
  FolderCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Numeric, ProjectIcon } from "@/components/common";
import { useWorkspace } from "@/lib/workspace";
import { quickBeam } from "@/domain/engineering";
import { projectTypes } from "@/domain/projects";
import { fmt } from "@/lib/utils";

const steps = [
  {
    label: "Choisir",
    title: "Calculez vos\nstructures",
    description:
      "Analysez une poutre ou un cadre, suivez une descente de charges et prédimensionnez vos éléments en béton.",
    detail: "Un point de départ adapté à chaque étude",
  },
  {
    label: "Paramétrer",
    title: "Des paramètres\naux efforts",
    description:
      "Renseignez la géométrie, les appuis et les charges. Le schéma et les résultats vous aident à comprendre votre modèle.",
    detail: "Essayez : modifiez la portée de la poutre",
  },
  {
    label: "Conserver",
    title: "Vos études,\nbien conservées",
    description:
      "Enregistrez vos projets sur cet appareil. Exportez un fichier JSON pour les transférer et les reprendre ailleurs.",
    detail: "Vos modèles restent à votre disposition",
  },
];

export function Onboarding() {
  const [step, setStep] = useState(0),
    { update } = useWorkspace();
  const finish = () =>
    void update({ onboarding: true }).catch(() =>
      toast.error(
        "La présentation ne pourra pas être mémorisée pendant cette session.",
      ),
    );
  const current = steps[step];
  return (
    <main className="onboarding">
      <header>
        <div className="brand">
          <span className="brand-mark">σ</span>
          <strong>StructCalc</strong>
        </div>
        <Button
          variant="ghost"
          onClick={finish}
          aria-label="Passer la présentation"
        >
          Passer<span className="skip-detail"> la présentation</span>
          <ArrowRight size={16} />
        </Button>
      </header>
      <div className="onboarding-content">
        <div className="onboarding-copy">
          <nav
            className="onboarding-steps"
            aria-label="Étapes de la présentation"
          >
            {steps.map((item, index) => (
              <button
                key={item.label}
                type="button"
                aria-label={`Présentation ${index + 1} — ${item.label}`}
                aria-current={index === step ? "step" : undefined}
                onClick={() => setStep(index)}
                className={
                  index === step ? "active" : index < step ? "complete" : ""
                }
              >
                <span className="step-index mono">
                  {index < step ? <Check size={13} /> : index + 1}
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <p className="onboarding-context">
            Calcul de structures · {step + 1} / {steps.length}
          </p>
          <div
            className="onboarding-message"
            aria-live="polite"
            aria-atomic="true"
          >
            <h1>{current.title}</h1>
            <p>{current.description}</p>
          </div>
          <div className="onboarding-actions">
            <Button
              size="lg"
              className="onboarding-primary"
              onClick={() =>
                step < steps.length - 1 ? setStep(step + 1) : finish()
              }
            >
              {step === 0
                ? "Voir un calcul"
                : step === steps.length - 1
                  ? "Accéder aux calculs"
                  : "Continuer"}
              <ArrowRight size={18} />
            </Button>
            {step > 0 && (
              <Button variant="ghost" onClick={() => setStep(step - 1)}>
                <ArrowLeft size={16} />
                Retour
              </Button>
            )}
          </div>
          <p className="onboarding-detail">
            <span aria-hidden="true" />
            {current.detail}
          </p>
        </div>
        <OnboardingPreview step={step} />
      </div>
      <footer>
        <span>
          <FolderCheck size={16} />
          Vos projets restent sur cet appareil
        </span>
        <span className="mono">m · kN · cm</span>
      </footer>
    </main>
  );
}

function OnboardingPreview({ step }: { step: number }) {
  const [length, setLength] = useState(6);
  const result = quickBeam(length, 8, 4, 25, 45, "C25/30");
  return (
    <section
      className="onboarding-preview"
      aria-label={
        step === 0
          ? "Aperçu des types de projets"
          : step === 1
            ? "Exemple interactif de calcul de poutre"
            : "Aperçu d’un fichier de projet"
      }
    >
      <header className="preview-heading">
        <span className="preview-caption">
          {step === 0
            ? "Votre espace de calcul"
            : step === 1
              ? "Poutre sur deux appuis"
              : "Une étude, un fichier"}
        </span>
        <span className="preview-meta mono">
          {step === 0
            ? `${projectTypes.length} outils`
            : step === 1
              ? "Exemple · ELU"
              : "JSON"}
        </span>
      </header>
      {step === 0 ? (
        <>
          <div className="preview-catalog">
            {(["beam", "frame", "building", "column"] as const).map((type) => {
              const info = projectTypes.find((t) => t.id === type)!;
              return (
                <div className="preview-project" key={type}>
                  <ProjectIcon type={type} size={80} />
                  <div>
                    <strong>{info.label}</strong>
                    <span>{info.family}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="preview-catalog-footer">
            <span>Du modèle à la section</span>
            <span className="mono">m · kN · cm</span>
          </div>
        </>
      ) : step === 1 ? (
        <>
          <div className="preview-inputs">
            <Numeric
              label="Portée de l’exemple"
              value={length}
              min={1}
              max={12}
              unit="m"
              onChange={setLength}
            />
            <div className="preview-load">
              <span>Charges de l’exemple</span>
              <strong className="mono">
                G = 8 · Q = 4 <small>kN/m</small>
              </strong>
            </div>
          </div>
          <BeamPreview length={length} load={result.wElu} />
          <div className="preview-results">
            <div>
              <span>Moment maximal ELU</span>
              <strong className="mono" data-testid="onboarding-moment">
                {fmt(result.moment)}
                <small>kN·m</small>
              </strong>
            </div>
            <div>
              <span>Réaction par appui</span>
              <strong className="mono">
                {fmt(result.reaction)}
                <small>kN</small>
              </strong>
            </div>
          </div>
          <p className="preview-footnote">
            Charge uniforme · 1,35G + 1,5Q · Exemple non enregistré
          </p>
        </>
      ) : (
        <>
          <div className="export-document">
            <div className="export-document-title">
              <ProjectIcon type="beam" size={72} />
              <div>
                <span>Exemple d’étude</span>
                <strong>Poutre sur deux appuis</strong>
                <span className="mono">L = {fmt(length)} m</span>
              </div>
            </div>
            <dl>
              {[
                ["Géométrie", "Portée et section"],
                ["Modèle", "Appuis et charges"],
                ["Étude", "Paramètres de calcul"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>
                    <CheckCheck size={16} />
                    {label}
                  </dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <div className="export-file">
              <FileJson size={22} />
              <span className="mono">StructCalc-projet.json</span>
            </div>
          </div>
          <p className="export-explanation">
            Un export pour transférer votre modèle.
            <br />
            Une sauvegarde de l’espace pour conserver tous vos projets.
          </p>
        </>
      )}
    </section>
  );
}

function BeamPreview({ length, load }: { length: number; load: number }) {
  return (
    <svg
      className="study-drawing"
      viewBox="0 0 560 232"
      role="img"
      aria-label={`Poutre de ${fmt(length)} mètres sur deux appuis, charge ELU de ${fmt(load)} kilonewtons par mètre`}
    >
      <text x="280" y="36" textAnchor="middle" className="numeric load-label">
        q = {fmt(load)} kN/m
      </text>
      <line x1="70" y1="64" x2="490" y2="64" className="study-load" />
      {Array.from({ length: 13 }, (_, i) => {
        const x = 70 + i * 35;
        return (
          <g key={i} className="study-load">
            <line x1={x} y1="64" x2={x} y2="106" />
            <path d={`M${x - 4} 99 L${x} 107 L${x + 4} 99`} />
          </g>
        );
      })}
      <line x1="70" y1="118" x2="490" y2="118" className="study-beam" />
      <g className="study-support">
        <path d="M70 122 l-14 23 h28 Z M48 151 h44 M490 122 l-14 23 h28 Z M468 158 h44" />
        <circle cx="481" cy="151" r="4" />
        <circle cx="499" cy="151" r="4" />
      </g>
      <g className="study-dimension">
        <line x1="70" y1="183" x2="490" y2="183" />
        <line x1="70" y1="175" x2="70" y2="191" />
        <line x1="490" y1="175" x2="490" y2="191" />
      </g>
      <text x="280" y="216" textAnchor="middle" className="numeric">
        L = {fmt(length)} m
      </text>
    </svg>
  );
}
