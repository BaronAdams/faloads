import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import "mathjax-full/js/input/tex/ams/AmsConfiguration.js";
import type { CalculationReport, ReportBlock } from "@/domain/report";

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const mathDocument = mathjax.document("", {
  InputJax: new TeX({
    packages: ["base", "ams"],
    formatError: (_jax: unknown, error: { message: string }) => {
      throw Error(`Expression LaTeX invalide : ${error.message}`);
    },
  }),
  OutputJax: new SVG({ fontCache: "none" }),
});
export function latexSvg(latex: string) {
  const node = mathDocument.convert(latex, { display: true }),
    rendered = adaptor.outerHTML(node),
    svg = rendered.match(/<svg[\s\S]*<\/svg>/)?.[0];
  if (!svg || /data-mml-node="merror"/.test(svg))
    throw Error("La formule n’a pas pu être mise en page.");
  const box = svg
    .match(/viewBox="([^"]+)"/)?.[1]
    .split(/\s+/)
    .map(Number);
  if (!box || box.length !== 4 || !box.every(Number.isFinite))
    throw Error("Dimensions de la formule invalides.");
  const width = Math.max(1, Math.min(490, (box[2] / 1000) * 10)),
    height = (width * box[3]) / box[2];
  return {
    svg: svg
      .replace(/currentColor/g, "#17243f")
      .replace(/width="[^"]*"/, `width="${width}"`)
      .replace(/height="[^"]*"/, `height="${height}"`),
    width,
    height,
  };
}
// Mathematical expressions use MathJax. Plain-text labels use the existing
// text fonts, which do not contain all Unicode Greek/subscript glyphs.
const plainSymbols: Record<string, string> = {
  ν: "nu",
  γ: "gamma",
  θ: "theta",
  κ: "kappa",
  α: "alpha",
  Σ: "Somme ",
  ψ: "psi",
  φ: "phi",
  σ: "sigma",
  "₁": "1",
  "₂": "2",
  ₓ: "x",
  ᵧ: "y",
  "→": " -> ",
  "≈": "~",
};
const wrap = (s: string) =>
  s
    .replace(/[νγθκαΣψφσ₁₂ₓᵧ→≈]/g, (c) => plainSymbols[c])
    .replace(/[\u202f\u00a0]/g, " ")
    .replace(/\S{24}/g, "$&\u200b");
function blockContent(block: ReportBlock): Content {
  if (block.kind === "text")
    return { text: wrap(block.text), margin: [0, 4, 0, 8] };
  if (block.kind === "formula") {
    const math = latexSvg(block.latex);
    return {
      svg: math.svg,
      width: math.width,
      height: math.height,
      margin: [0, 6, 0, 10],
    };
  }
  if (block.kind === "svg")
    return {
      svg: block.svg,
      width: 430,
      alignment: "center",
      margin: [0, 8, 0, 12],
    };
  if (!block.rows.length)
    return {
      text: "Aucun élément de cette catégorie dans le modèle.",
      color: "#56637a",
      margin: [0, 4, 0, 8],
    };
  return {
    table: {
      headerRows: 1,
      dontBreakRows: true,
      widths: block.headers.map(() => "*"),
      body: [
        block.headers.map((text) => ({
          text: wrap(text),
          bold: true,
          fillColor: "#e8edf5",
          color: "#17243f",
        })),
        ...block.rows.map((row) =>
          row.map((text) => ({
            text: wrap(text),
            font: /^[\d\s.,+−×%Ee-]+$/.test(text) ? "JetBrains" : "DMSans",
          })),
        ),
      ],
    },
    fontSize: block.headers.length >= 7 ? 7 : 8,
    margin: [0, 6, 0, 12],
    layout: {
      hLineColor: () => "#d6dce6",
      vLineWidth: () => 0,
      hLineWidth: (i: number) => (i === 1 ? 0.8 : 0.35),
      paddingTop: () => 5,
      paddingBottom: () => 5,
      paddingLeft: () => 4,
      paddingRight: () => 4,
    },
  };
}
export function reportDocument(
  report: CalculationReport,
): TDocumentDefinitions {
  const date = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(report.generatedAt));
  const content: Content[] = [
    { text: "CaliSigma Structural", style: "brand" },
    { text: "Note de calcul", style: "documentTitle" },
    { text: wrap(report.project), style: "projectTitle" },
    { text: report.type, style: "subtitle" },
    {
      text: `Auteur / agence : ${report.author.trim() || "Non renseigné"}`,
      margin: [0, 10, 0, 3],
    },
    { text: `Établie le ${date}`, color: "#56637a", margin: [0, 0, 0, 10] },
    { text: report.method, style: "method" },
    {
      text: "Contenu de la note",
      style: "sectionTitle",
      margin: [0, 15, 0, 8],
    },
    {
      ol: report.sections.map(
        (s) =>
          `${s.title} · ${s.detail === "full" ? "démarche complète" : "synthèse"}`,
      ),
      margin: [0, 0, 0, 18],
    },
  ];
  for (const [i, s] of report.sections.entries())
    content.push(
      { text: `${i + 1}. ${s.title}`, style: "sectionTitle", headlineLevel: 1 },
      ...s.blocks.map(blockContent),
    );
  return {
    pageSize: "A4",
    pageMargins: [42, 45, 42, 48],
    info: {
      title: `${report.project} — Note de calcul`,
      author: report.author || "CaliSigma Structural",
      creator: "CaliSigma Structural",
      subject: report.type,
      creationDate: new Date(report.generatedAt),
    },
    defaultStyle: {
      font: "DMSans",
      fontSize: 9,
      lineHeight: 1.2,
      color: "#26354e",
    },
    styles: {
      brand: { fontSize: 11, color: "#3e6fce", margin: [0, 0, 0, 12] },
      documentTitle: { fontSize: 24, margin: [0, 0, 0, 6] },
      projectTitle: { fontSize: 16, margin: [0, 0, 0, 4] },
      subtitle: { fontSize: 11, color: "#56637a" },
      method: { fontSize: 9, color: "#3e4c63", margin: [0, 4, 0, 8] },
      sectionTitle: {
        fontSize: 13,
        bold: true,
        color: "#17243f",
        margin: [0, 14, 0, 6],
      },
    },
    footer: (page, total) => ({
      margin: [42, 12, 42, 0],
      fontSize: 7,
      color: "#56637a",
      columns: [
        { text: "CaliSigma Structural", width: 115 },
        { text: `Générée le ${date}`, alignment: "center", width: "*" },
        { text: `Page ${page} / ${total}`, alignment: "right", width: 70 },
      ],
    }),
    pageBreakBefore: (current, following) =>
      current.headlineLevel === 1 && following.length === 0,
    content,
  };
}
let fontsPromise: Promise<Record<string, string>> | undefined;
async function fontVfs() {
  return (fontsPromise ??= (async () => {
    const entries = await Promise.all(
      [
        ["DMSans", "/fonts/DMSans-Variable.ttf"],
        ["DMSansItalic", "/fonts/DMSans-Italic-Variable.ttf"],
        ["JetBrains", "/fonts/JetBrainsMono-Variable.ttf"],
      ].map(async ([name, path]) => {
        const response = await fetch(path);
        if (!response.ok)
          throw Error("Chargement des polices du PDF impossible.");
        const bytes = new Uint8Array(await response.arrayBuffer());
        let binary = "";
        for (let i = 0; i < bytes.length; i += 8192)
          binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        return [`${name}.ttf`, btoa(binary)];
      }),
    );
    return Object.fromEntries(entries);
  })().catch((error) => {
    fontsPromise = undefined;
    throw error;
  }));
}
export async function generateReportPdf(
  report: CalculationReport,
): Promise<Uint8Array> {
  const [module, vfs] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    fontVfs(),
  ]);
  const pdfMake = module.default;
  const fonts = {
    DMSans: {
      normal: "DMSans.ttf",
      bold: "DMSans.ttf",
      italics: "DMSansItalic.ttf",
      bolditalics: "DMSansItalic.ttf",
    },
    JetBrains: {
      normal: "JetBrains.ttf",
      bold: "JetBrains.ttf",
      italics: "JetBrains.ttf",
      bolditalics: "JetBrains.ttf",
    },
  };
  const pdf = pdfMake.createPdf(reportDocument(report), undefined, fonts, vfs);
  return new Promise((resolve, reject) => {
    try {
      const stream = pdf.getStream();
      const chunks: Uint8Array[] = [];
      stream.on("data", (data: Uint8Array) => chunks.push(data));
      stream.on("error", reject);
      stream.on("end", () => {
        const out = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0));
        let offset = 0;
        for (const c of chunks) {
          out.set(c, offset);
          offset += c.length;
        }
        resolve(out);
      });
      stream.end();
    } catch (e) {
      reject(e);
    }
  });
}
