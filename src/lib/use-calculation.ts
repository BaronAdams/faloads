import { useEffect, useRef, useState } from "react";
import { studyAction } from "./study-events";
class WorkerUnavailable extends Error {}
/** Results belong to the captured model, never to uncomputed edits. */
export function useCalculation<R>(kind: string, model: unknown) {
  const signature = JSON.stringify(model);
  const [snapshot, setSnapshot] = useState<{
    signature: string;
    result: R;
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const currentSignature = useRef(signature);
  currentSignature.current = signature;
  const running = useRef(false),
    worker = useRef<Worker | null>(null),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      worker.current?.terminate();
    };
  }, []);
  const run = async () => {
    const invalid = document.querySelector<HTMLInputElement>("input:invalid");
    if (invalid) {
      invalid.reportValidity();
      return false;
    }
    if (running.current) return false;
    running.current = true;
    setBusy(true);
    setError(null);
    const captured = structuredClone(model),
      started = performance.now();
    try {
      const result = await new Promise<R>((resolve, reject) => {
        let w: Worker;
        try {
          w = new Worker(
            new URL("../workers/calculation-worker.ts", import.meta.url),
            { type: "module" },
          );
        } catch {
          reject(new WorkerUnavailable());
          return;
        }
        worker.current = w;
        w.onmessage = (e) => {
          w.terminate();
          worker.current = null;
          e.data.error
            ? reject(Error(e.data.error))
            : resolve(e.data.result as R);
        };
        w.onerror = () => {
          w.terminate();
          worker.current = null;
          reject(new WorkerUnavailable());
        };
        w.postMessage({ kind, model: captured });
      }).catch(async (error) => {
        if (!(error instanceof WorkerUnavailable)) throw error;
        // Some native WebKit/custom-scheme combinations cannot load module workers.
        // Paint the real progress state before using the same engine on the UI thread.
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        await new Promise((resolve) => setTimeout(resolve, 260));
        const { calculate } = await import("../workers/calculation");
        return calculate(kind, captured) as R;
      });
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, 450 - (performance.now() - started))),
      );
      if (!alive.current) return false;
      setSnapshot({ signature, result });
      if (currentSignature.current !== signature) return false;
      studyAction("calculation:complete");
      return true;
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : "Calcul impossible.");
      return false;
    } finally {
      running.current = false;
      if (alive.current) setBusy(false);
    }
  };
  return {
    result: snapshot?.result,
    fresh: snapshot?.signature === signature,
    busy,
    error,
    run,
  };
}
