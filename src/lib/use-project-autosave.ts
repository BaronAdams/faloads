import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "./storage";
import { useWorkspace } from "./workspace";
import { studyAction } from "./study-events";
import { runtime } from "./runtime";

type Snapshot = {
  project?: Project;
  name: string;
  data: unknown;
  signature: string;
};
export function useProjectAutosave(
  project: Project | undefined,
  name: string,
  data: unknown,
) {
  const { saveProject, temporary } = useWorkspace();
  const signature = JSON.stringify({ name: name.trim(), data });
  const persisted = useRef(
    project ? JSON.stringify({ name: project.name, data: project.data }) : "",
  );
  const latest = useRef<Snapshot>({ project, name, data, signature });
  latest.current = { project, name, data, signature };
  const alive = useRef(true),
    inFlight = useRef<{ signature: string; promise: Promise<boolean> } | null>(
      null,
    );
  const [status, setStatus] = useState<
    "saved" | "pending" | "saving" | "error"
  >(project ? "saved" : "pending");
  const persist = useCallback(
    (snapshot = latest.current, silent = false): Promise<boolean> => {
      if (!snapshot.project || !snapshot.name.trim() || temporary)
        return Promise.resolve(false);
      if (snapshot.signature === persisted.current && !inFlight.current) {
        if (alive.current) setStatus("saved");
        studyAction("project:saved");
        return Promise.resolve(true);
      }
      if (inFlight.current?.signature === snapshot.signature)
        return inFlight.current.promise;
      if (alive.current && !silent) setStatus("saving");
      const promise = saveProject({
        ...snapshot.project,
        name: snapshot.name.trim(),
        data: snapshot.data,
        updatedAt: new Date().toISOString(),
      })
        .then(() => {
          persisted.current = snapshot.signature;
          if (alive.current && latest.current.signature === snapshot.signature)
            setStatus("saved");
          studyAction("project:saved");
          return true;
        })
        .catch(() => {
          if (alive.current && latest.current.signature === snapshot.signature)
            setStatus("error");
          return false;
        })
        .finally(() => {
          if (inFlight.current?.signature === snapshot.signature)
            inFlight.current = null;
        });
      inFlight.current = { signature: snapshot.signature, promise };
      return promise;
    },
    [saveProject, temporary],
  );
  useEffect(() => {
    if (!project || temporary) return;
    if (signature === persisted.current && !inFlight.current) {
      setStatus("saved");
      return;
    }
    setStatus("pending");
    const timer = setTimeout(() => void persist(), 400);
    return () => clearTimeout(timer);
  }, [project?.id, signature, persist, temporary]);
  useEffect(() => {
    if (runtime !== "desktop" || !project || temporary) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/window")
      .then(async ({ getCurrentWindow }) => {
        const stop = await getCurrentWindow().onCloseRequested(
          async (event) => {
            // Tauri waits for this handler before destroying its WebView. Keep the
            // editor open if the last write fails, with the persistence error visible.
            if (!(await persist(latest.current, true))) event.preventDefault();
          },
        );
        if (disposed) stop();
        else unlisten = stop;
      })
      .catch(() => {});
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [project?.id, temporary, persist]);
  useEffect(() => {
    alive.current = true;
    const flush = () => {
      if (latest.current.signature !== persisted.current)
        void persist(latest.current, true);
    };
    window.addEventListener("pagehide", flush);
    const hidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      alive.current = false;
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", hidden);
      flush();
    };
  }, [persist]);
  return { status, save: () => persist() };
}
