import { useLayoutEffect, useRef } from "react";
import { LoaderCircle, CircleCheck, CircleAlert } from "lucide-react";
export function CalculationOverlay({ busy }: { busy: boolean }) {
  const overlay = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!busy || !overlay.current) return;
    const place = () => {
      const el = overlay.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const top = Math.max(r.top, 0),
        bottom = Math.min(
          r.bottom,
          window.visualViewport?.height ?? innerHeight,
        );
      el.style.setProperty("--progress-y", `${(top + bottom) / 2 - r.top}px`);
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.visualViewport?.removeEventListener("resize", place);
    };
  }, [busy]);
  return busy ? (
    <div className="calculation-veil" role="status" aria-live="polite">
      <div className="calculation-message">
        <LoaderCircle className="animate-spin" size={30} />
        <strong>Calcul en cours</strong>
        <span>Analyse du modèle et préparation des résultats…</span>
      </div>
    </div>
  ) : null;
}
export function CalculationStatus({
  fresh,
  hasResult,
}: {
  fresh: boolean;
  hasResult: boolean;
}) {
  return (
    <span
      role="status"
      className={`calculation-status ${fresh ? "current" : "stale"}`}
    >
      {fresh ? <CircleCheck size={14} /> : <CircleAlert size={14} />}{" "}
      {fresh
        ? "Calcul actualisé"
        : hasResult
          ? "Calcul non actualisé"
          : "Calcul à lancer"}
    </span>
  );
}
