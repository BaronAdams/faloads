import { useState } from "react";
import { FileDown, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import {
  reportSteps,
  defaultReportSelection,
  type ReportSelection,
  type ReportDetail,
} from "@/domain/report";
import type { Project } from "@/lib/storage";
import { useWorkspace } from "@/lib/workspace";
import { useDesktopCommands } from "@/lib/desktop-commands";
import { studyAction } from "@/lib/study-events";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { IconButton } from "./common";

export function ReportButton({ project }: { project: Project }) {
  const { workspace } = useWorkspace(),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [phase, setPhase] = useState("");
  const [selection, setSelection] = useState<ReportSelection>(() =>
    defaultReportSelection(project.type),
  );
  const definitions = reportSteps(project.type),
    selected = definitions.filter((s) => selection[s.id]);
  const show = () => {
    if (document.querySelector('[role="dialog"][data-state="open"]')) {
      toast.info(
        "Validez ou fermez le formulaire ouvert avant de préparer la note.",
      );
      return;
    }
    setOpen(true);
    studyAction("report:open");
  };
  useDesktopCommands({ "file:report": show });
  const generate = async () => {
    if (busy || !selected.length) return;
    const invalid = document.querySelector<HTMLInputElement>("input:invalid");
    if (invalid) {
      invalid.reportValidity();
      return;
    }
    setBusy(true);
    setError("");
    setPhase("Actualisation des calculs…");
    try {
      const snapshot = structuredClone(project),
        choices = { ...selection };
      const { prepareReport, saveReportPdf } =
        await import("@/lib/report-export");
      const report = await prepareReport(
        snapshot,
        choices,
        workspace.profile.name,
      );
      setPhase("Mise en page des expressions et des tableaux…");
      const { generateReportPdf } = await import("@/lib/report-pdf");
      const bytes = await generateReportPdf(report);
      setPhase("Enregistrement du PDF…");
      if (await saveReportPdf(snapshot.name, bytes)) {
        toast.success("Note de calcul PDF générée.");
        setOpen(false);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "La note n’a pas pu être générée.",
      );
    } finally {
      setBusy(false);
      setPhase("");
    }
  };
  return (
    <>
      <IconButton
        label="Préparer la note de calcul"
        data-tour="report"
        onClick={show}
      >
        <FileDown />
      </IconButton>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!busy) setOpen(v);
        }}
      >
        <DialogContent
          className="report-dialog"
          onEscapeKeyDown={(e) => {
            if (busy) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (busy) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Préparer la note de calcul</DialogTitle>
            <DialogDescription>
              Choisissez les étapes à inclure et leur niveau de détail. Les
              calculs seront refaits à partir des paramètres courants.
            </DialogDescription>
          </DialogHeader>
          <div className="report-controls">
            <strong>{selected.length} étape(s) sélectionnée(s)</strong>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => setSelection(defaultReportSelection(project.type))}
            >
              Tout inclure
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => setSelection({})}
            >
              Tout retirer
            </Button>
          </div>
          <div className="report-steps">
            {definitions.map((s) => (
              <div className="report-step" key={s.id}>
                <label className="report-step-choice">
                  <input
                    type="checkbox"
                    checked={!!selection[s.id]}
                    disabled={busy}
                    onChange={(e) =>
                      setSelection({
                        ...selection,
                        [s.id]: e.target.checked ? "summary" : false,
                      })
                    }
                  />
                  <span>
                    <strong>{s.title}</strong>
                    <small>{s.description}</small>
                  </span>
                </label>
                <fieldset
                  className="report-detail"
                  disabled={busy || !selection[s.id]}
                  aria-label={`Détail · ${s.title}`}
                >
                  {(
                    [
                      ["summary", "Synthèse"],
                      ["full", "Démarche complète"],
                    ] as const
                  ).map(([value, label]) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name={`detail-${s.id}`}
                        value={value}
                        checked={selection[s.id] === value}
                        onChange={() =>
                          setSelection({
                            ...selection,
                            [s.id]: value as ReportDetail,
                          })
                        }
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
              </div>
            ))}
          </div>
          <p className="hint">
            PDF A4 · expressions LaTeX · tableaux paginés · date et heure de
            génération et numéros de page. Les méthodes simplifiées restent
            identifiées comme telles.
          </p>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          {busy && (
            <div className="report-progress" role="status">
              <LoaderCircle className="animate-spin" />
              {phase}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
            <Button
              disabled={busy || !selected.length}
              onClick={() => void generate()}
            >
              {busy ? "Génération en cours…" : "Générer le PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
