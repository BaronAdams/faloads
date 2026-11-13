import { isTauri } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

export function detectRuntime(native = isTauri(), agent = navigator.userAgent) {
  return native
    ? /Android|iPhone|iPad|iPod|Mobile/i.test(agent)
      ? "mobile"
      : "desktop"
    : "web";
}
export const runtime = detectRuntime();

export function useCompactViewport() {
  const [compact, setCompact] = useState(
    () => matchMedia("(max-width: 1000px)").matches,
  );
  useEffect(() => {
    const query = matchMedia("(max-width: 1000px)");
    const update = () => setCompact(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return compact;
}
