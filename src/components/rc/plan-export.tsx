import { useState } from "react";
import { DraftingCompass, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import type { RCModel } from "@/domain/rc/model";
import type { RCResult } from "@/lib/rc-engine";
import { rcPlans, planTikz } from "@/domain/rc/plans";
import { useWorkspace } from "@/lib/workspace";
import { IconButton } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
export function RCPlanExport({
  model,
  result,
  name,
}: {
  model: RCModel;
  result?: RCResult;
  name: string;
}) {
  const { workspace } = useWorkspace();
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState(0),
    [format, setFormat] = useState<"pdf" | "dxf" | "tex">("pdf"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const plans = result
    ? rcPlans(model, result, {
        project: name,
        author: workspace.profile.name,
        date: new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(
          new Date(),
        ),
      })
    : [];
  const plan = plans[selected] ?? plans[0];
  const generate = async () => {
    if (!plan || busy) return;
    setBusy(true);
    setError("");
    try {
      let bytes: Uint8Array;
      if (format === "dxf") {
        const { planDxf } = await import("@/domain/rc/plan-dxf");
        bytes = new TextEncoder().encode(planDxf(plan));
      } else if (format === "tex")
        bytes = new TextEncoder().encode(planTikz(plan, true));
      else {
        const { generateReportPdf } = await import("@/lib/report-pdf");
        bytes = await generateReportPdf(
          {
            project: name,
            type: model.kind === "rc-column" ? "Poteau BA" : "Poutre BA",
            author: workspace.profile.name,
            generatedAt: new Date().toISOString(),
            method: "EN 1992-1-1",
            sections: [
              {
                id: "plan",
                title: plan.title,
                detail: "full",
                blocks: [{ kind: "plan", plan }],
              },
            ],
          },
          true,
        );
      }
      const { saveArtifact } = await import("@/lib/report-export");
      if (
        await saveArtifact(
          `${name}-${plan.number}.${format}`,
          bytes,
          format === "pdf" ? "application/pdf" : "text/plain",
          `Plan ${format.toUpperCase()}`,
        )
      ) {
        toast.success("Plan exporté.");
        setOpen(false);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Le plan n’a pas pu être exporté.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <IconButton
        label="Exporter le plan de ferraillage"
        onClick={() => {
          if (!result) {
            toast.info(
              "Lancez le calcul pour exporter le plan correspondant aux données actuelles.",
            );
            return;
          }
          setSelected(0);
          setError("");
          setOpen(true);
        }}
      >
        <DraftingCompass />
      </IconButton>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!busy) setOpen(v);
        }}
      >
        <DialogContent
          className="desktop-detail-dialog rc-export-dialog"
          onEscapeKeyDown={(e) => {
            if (busy) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (busy) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Exporter le plan de ferraillage</DialogTitle>
            <DialogDescription>
              A4 paysage avec cartouche, cotes et repères d’aciers. Sélectionnez
              la planche à exporter.
            </DialogDescription>
          </DialogHeader>
          <div
            className="rc-plan-list"
            role="group"
            aria-label="Planche à exporter"
          >
            {plans.map((p, i) => (
              <Button
                key={p.number}
                variant={i === selected ? "secondary" : "ghost"}
                aria-pressed={i === selected}
                onClick={() => setSelected(i)}
                disabled={busy}
              >
                <span>{p.number}</span>
                {p.title}
              </Button>
            ))}
          </div>
          <fieldset className="rc-export-formats">
            <legend>Format du fichier</legend>
            {(["pdf", "dxf", "tex"] as const).map((f) => (
              <label key={f}>
                <input
                  type="radio"
                  name="plan-format"
                  value={f}
                  checked={format === f}
                  onChange={() => setFormat(f)}
                  disabled={busy}
                />
                {f === "pdf"
                  ? "PDF vectoriel"
                  : f === "dxf"
                    ? "DXF · dessin modifiable"
                    : "Source LaTeX / TikZ"}
              </label>
            ))}
          </fieldset>
          <p className="hint">
            {plan?.scale}. Dimensions et longueurs en mm. Les plans restent des
            plans de principe ; les détails d’exécution sont à confirmer.
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
            <Button onClick={() => void generate()} disabled={busy || !plan}>
              {busy && <LoaderCircle className="animate-spin" />}
              {busy
                ? "Composition du plan…"
                : `Exporter ${format.toUpperCase()}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
