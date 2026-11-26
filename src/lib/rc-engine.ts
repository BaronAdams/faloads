import { rcModelSchema, type RCModel } from "@/domain/rc/model";
export type RCCheck = {
  name: string;
  ok: boolean;
  value?: unknown;
  limit?: unknown;
  unit?: string;
  element?: string;
};
export interface RCResult {
  kind: "rc-column" | "rc-beam";
  all_ok: boolean;
  scope_complete: boolean;
  checks: RCCheck[];
  warnings: string[];
  notes: string[];
  limits: string[];
  // Keep the complete numerical trace for method-specific result sheets/reports.
  [key: string]: any;
}
let worker: Worker | undefined,
  unavailable = false,
  nextId = 0;
const pending = new Map<
  number,
  {
    model: RCModel;
    resolve: (r: RCResult) => void;
    reject: (e: Error) => void;
    phase?: (p: string) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();
async function fallback(
  model: RCModel,
  phase?: (p: string) => void,
): Promise<RCResult> {
  const { runLocalRC, rcError } = await import("./rc-runtime");
  try {
    return await runLocalRC(model, phase);
  } catch (e) {
    throw Error(rcError(e));
  }
}
function bootFailure() {
  worker?.terminate();
  worker = undefined;
  unavailable = true;
  for (const p of pending.values()) {
    clearTimeout(p.timer);
    void fallback(p.model, p.phase).then(p.resolve, p.reject);
  }
  pending.clear();
}
export async function calculateRC(
  input: RCModel,
  onPhase?: (phase: string) => void,
): Promise<RCResult> {
  const parsed = rcModelSchema.safeParse(input);
  if (!parsed.success)
    throw Error(parsed.error.issues[0]?.message ?? "Données EC2 invalides.");
  const model = parsed.data;
  if (model.kind === "rc-beam" && model.analysis.construction === "unspecified")
    throw Error(
      "Précisez si la poutre est posée ou solidaire de ses appuis dans l’onglet Méthode.",
    );
  if (unavailable) return fallback(model, onPhase);
  return new Promise((resolve, reject) => {
    if (!worker) {
      try {
        worker = new Worker(
          new URL("../workers/rc-worker.ts", import.meta.url),
          { type: "module" },
        );
      } catch {
        unavailable = true;
        void fallback(model, onPhase).then(resolve, reject);
        return;
      }
      worker.onmessage = (event) => {
        const { id, phase, result, error, bootError } = event.data,
          p = pending.get(id);
        if (!p) return;
        if (bootError) {
          bootFailure();
          return;
        }
        if (phase) {
          p.phase?.(phase);
          return;
        }
        clearTimeout(p.timer);
        pending.delete(id);
        if (error) p.reject(Error(error));
        else if (!result || !Array.isArray(result.checks))
          p.reject(Error("Résultat EC2 incomplet."));
        else p.resolve(result);
      };
      worker.onerror = bootFailure;
    }
    const id = ++nextId,
      timer = setTimeout(() => {
        worker?.terminate();
        worker = undefined;
        for (const p of pending.values()) {
          clearTimeout(p.timer);
          p.reject(
            Error(
              "Le calcul EC2 prend trop de temps. Réduisez le modèle ou réessayez.",
            ),
          );
        }
        pending.clear();
      }, 120000);
    pending.set(id, { model, resolve, reject, phase: onPhase, timer });
    worker.postMessage({ id, model });
  });
}
