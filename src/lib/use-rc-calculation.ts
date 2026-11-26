import { useEffect, useRef, useState } from "react";
import { calculateRC, type RCResult } from "./rc-engine";
import type { RCModel } from "@/domain/rc/model";
import { studyAction } from "./study-events";
export function useRCCalculation(model: RCModel) {
  const signature = JSON.stringify(model),
    latest = useRef(signature);
  latest.current = signature;
  const [snapshot, setSnapshot] = useState<{
      signature: string;
      result: RCResult;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [phase, setPhase] = useState("");
  const alive = useRef(true),
    running = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function run() {
    const invalid = document.querySelector<HTMLInputElement>("input:invalid");
    if (invalid) {
      invalid.reportValidity();
      return false;
    }
    if (running.current) return false;
    running.current = true;
    setBusy(true);
    setError(null);
    setPhase("Préparation du calcul…");
    const captured = structuredClone(model);
    try {
      // Give the real progress state a paint before requesting the worker.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      const result = await calculateRC(captured, (p) => {
        if (alive.current) setPhase(p);
      });
      if (!alive.current) return false;
      setSnapshot({ signature, result });
      if (latest.current !== signature) return false;
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
  }
  return {
    run,
    busy,
    error,
    phase,
    result: snapshot?.result,
    fresh: !!snapshot && snapshot.signature === signature,
  };
}
