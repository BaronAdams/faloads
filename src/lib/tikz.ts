import { dvi2html } from "@prinsss/dvi2html";
import { Buffer } from "buffer";
import { parse } from "opentype.js";
const fonts = new Map<string, Promise<ReturnType<typeof parse>>>();
// Convert the actual TeX glyphs to paths, so PDF/CAD viewers need no TeX fonts.
async function outlines(svg: string) {
  const document = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (document.querySelector("parsererror"))
    throw Error("Le plan LaTeX n’a pas pu être lu.");
  for (const text of document.querySelectorAll("text")) {
    const family = text.getAttribute("font-family") ?? "cmr10";
    if (!/^[a-z0-9]+$/.test(family)) throw Error("Police LaTeX inconnue.");
    if (!fonts.has(family))
      fonts.set(
        family,
        fetch(`/tikz-runtime/fonts/${family}.ttf`).then(async (r) => {
          if (!r.ok) throw Error(`Police du plan indisponible : ${family}.`);
          return parse(await r.arrayBuffer());
        }),
      );
    const font = await fonts.get(family)!;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    // BaKoMa maps TeX's soft hyphen slot to the visible not-sign slot.
    path.setAttribute(
      "d",
      font
        .getPath(
          (text.textContent ?? "").replaceAll("\u00ad", "\u00ac"),
          Number(text.getAttribute("x")),
          Number(text.getAttribute("y")),
          Number(text.getAttribute("font-size")),
        )
        .toPathData(3),
    );
    for (const attr of ["fill", "transform"])
      if (text.hasAttribute(attr))
        path.setAttribute(attr, text.getAttribute(attr)!);
    text.replaceWith(path);
  }
  return new XMLSerializer().serializeToString(document.documentElement);
}
let queue: Promise<unknown> = Promise.resolve();
let texWorker: Worker | undefined;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
const cache = new Map<string, Promise<string>>();
export function renderTikz(source: string): Promise<string> {
  if (cache.has(source)) return cache.get(source)!;
  const job = queue
    .catch(() => {})
    .then(async () => {
      const dvi = await new Promise<Uint8Array>((resolve, reject) => {
        clearTimeout(idleTimer);
        let worker: Worker;
        try {
          if (typeof Worker === "undefined") throw new TypeError();
          worker = texWorker ??= new Worker(
            new URL("../workers/tikz-worker.ts", import.meta.url),
            { type: "module" },
          );
        } catch {
          reject(new TypeError("Worker LaTeX indisponible"));
          return;
        }
        const timer = setTimeout(() => {
          worker.terminate();
          texWorker = undefined;
          reject(
            Error(
              "La composition du plan dépasse 90 secondes. Réessayez avec moins de travées.",
            ),
          );
        }, 90000);
        const finish = () => {
          clearTimeout(timer);
          idleTimer = setTimeout(() => {
            worker.terminate();
            if (texWorker === worker) texWorker = undefined;
          }, 30000);
        };
        worker.onmessage = ({ data }) => {
          finish();
          if (data.error) {
            worker.terminate();
            texWorker = undefined;
            reject(Error(data.error));
          } else if (/(?:^|\n)! /.test(data.log ?? "")) {
            reject(
              Error(
                "La composition LaTeX du plan a échoué. " +
                  data.log.match(/(?:^|\n)! ([^\n]+)/)?.[1],
              ),
            );
          } else resolve(data.dvi);
        };
        worker.onerror = () => {
          finish();
          worker.terminate();
          texWorker = undefined;
          reject(new TypeError("Worker LaTeX indisponible"));
        };
        worker.postMessage({ source });
      }).catch(async (error) => {
        if (!(error instanceof TypeError)) throw error;
        // WKWebView and locked-down WebViews may disallow module workers.
        // Compile with the identical local WASM engine in the current context.
        const { compileTikz } = await import("./tikz-engine");
        const { dvi, log } = await compileTikz(source);
        if (/(?:^|\n)! /.test(log))
          throw Error(
            "La composition LaTeX du plan a échoué. " +
              log.match(/(?:^|\n)! ([^\n]+)/)?.[1],
          );
        return dvi;
      });
      let html = "";
      await dvi2html(
        (async function* () {
          yield Buffer.from(dvi);
        })(),
        {
          write(chunk: { toString(): string }) {
            html += chunk.toString();
          },
        },
      );
      const svg = new DOMParser()
        .parseFromString(html, "text/html")
        .querySelector("svg")?.outerHTML;
      if (!svg)
        throw Error(
          "LaTeX n’a produit aucun plan. Aucun dessin de remplacement n’a été exporté.",
        );
      return outlines(svg);
    });
  queue = job;
  if (cache.size >= 16) cache.delete(cache.keys().next().value!);
  cache.set(source, job);
  void job.catch(() => cache.delete(source));
  return job;
}
