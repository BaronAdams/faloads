import { isRCModel, rcModelSchema } from "@/domain/rc/model";
import { isTauri } from "@tauri-apps/api/core";
import type { Project } from "./storage";
import type { ReportSelection, CalculationReport } from "@/domain/report";
export async function prepareReport(
  project: Project,
  selection: ReportSelection,
  author: string,
): Promise<CalculationReport> {
  const generatedAt = new Date().toISOString();
  if (isRCModel(project.data)) {
    const model = rcModelSchema.parse(project.data);
    const { calculateRC } = await import("./rc-engine");
    const { buildRCReport } = await import("@/domain/rc/report");
    const result = await calculateRC(model);
    return buildRCReport(
      project,
      model,
      result,
      selection,
      author,
      generatedAt,
    );
  }
  try {
    return await new Promise<CalculationReport>((resolve, reject) => {
      let worker: Worker;
      try {
        worker = new Worker(
          new URL("../workers/report-worker.ts", import.meta.url),
          { type: "module" },
        );
      } catch {
        reject(new TypeError("Worker indisponible"));
        return;
      }
      const timer = setTimeout(() => {
        worker.terminate();
        reject(
          Error(
            "Le calcul de la note prend trop de temps. Réduisez le modèle ou réessayez.",
          ),
        );
      }, 60000);
      worker.onmessage = (event) => {
        clearTimeout(timer);
        worker.terminate();
        event.data.error
          ? reject(Error(event.data.error))
          : resolve(event.data.result);
      };
      worker.onerror = () => {
        clearTimeout(timer);
        worker.terminate();
        reject(new TypeError("Worker indisponible"));
      };
      worker.postMessage({ project, selection, author, generatedAt });
    });
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    const { buildCalculationReport } = await import("@/domain/report");
    return buildCalculationReport(project, selection, author, generatedAt);
  }
}
export async function saveReportPdf(name: string, bytes: Uint8Array) {
  const filename = `${name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").slice(0, 140)}-note-de-calcul.pdf`;
  if (isTauri()) {
    const [{ save }, { writeFile }] = await Promise.all([
      import("@tauri-apps/plugin-dialog"),
      import("@tauri-apps/plugin-fs"),
    ]);
    const path = await save({
      defaultPath: filename,
      filters: [{ name: "Note de calcul PDF", extensions: ["pdf"] }],
    });
    if (!path) return false;
    await writeFile(path, bytes);
    return true;
  }
  const url = URL.createObjectURL(
    new Blob([bytes.slice().buffer], { type: "application/pdf" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}
