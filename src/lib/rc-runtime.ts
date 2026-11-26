/** Offline runtime shared by the worker and the native WebView fallback. */
let initialized: Promise<any> | undefined;
const files = [
  "bridge.py",
  "beam_sections.py",
  "beam_design.py",
  "skills/ec2-poteau-complet/scripts/poteau_complet_ec2.py",
  "skills/ec2-flexion-composee/scripts/flexion_composee_ec2.py",
  "skills/ec2-compression-simple/scripts/compression_ec2.py",
];
async function runtime() {
  if (!initialized)
    initialized = (async () => {
      // Use href: custom native schemes can report an origin of "null".
      const root = new URL("/ec2-runtime/", globalThis.location.href).href;
      const { loadPyodide } = await import(
        /* @vite-ignore */ root + "pyodide.mjs"
      );
      const py = await loadPyodide({
        indexURL: root,
        stdout: () => {},
        stderr: () => {},
      });
      const sources = await Promise.all(
        files.map(async (file) => {
          const response = await fetch(
            new URL("/ec2-engine/" + file, globalThis.location.href),
          );
          if (!response.ok)
            throw Error(
              "Le moteur EC2 local est incomplet. Réinstallez l’application.",
            );
          return { file, source: await response.text() };
        }),
      );
      for (const { file, source } of sources) {
        const path = "/ec2/" + file;
        py.FS.mkdirTree(path.substring(0, path.lastIndexOf("/")));
        py.FS.writeFile(path, source, { encoding: "utf8" });
      }
      await py.runPythonAsync(
        "import sys\nsys.path.insert(0, '/ec2')\nfrom bridge import compute_json",
      );
      return py;
    })().catch((error) => {
      initialized = undefined;
      throw error;
    });
  return initialized;
}
let queue: Promise<unknown> = Promise.resolve();
export function runLocalRC(model: unknown, phase?: (phase: string) => void) {
  const job = queue
    .catch(() => {})
    .then(async () => {
      phase?.("Préparation du moteur de calcul…");
      const py = await runtime();
      phase?.("Dimensionnement et vérifications EC2…");
      // Allow progress to paint when module workers are unavailable in a WebView.
      await new Promise((resolve) => setTimeout(resolve, 0));
      py.globals.set("_calisigma_input", JSON.stringify(model));
      try {
        return JSON.parse(
          await py.runPythonAsync("compute_json(_calisigma_input)"),
        );
      } finally {
        py.globals.delete("_calisigma_input");
      }
    });
  queue = job;
  return job;
}
export function rcError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message
      .trim()
      .split("\n")
      .at(-1)
      ?.replace(/^(ValueError|RuntimeError|Exception):\s*/, "") ||
    "Calcul EC2 impossible."
  );
}
