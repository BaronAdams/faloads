import { chromium, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const out = "docs/ec2-preview";
const base = process.env.RC_DEV_URL || "http://127.0.0.1:1422";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "info") console.log(m.text());
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(base);
  await page.getByRole("button", { name: "Passer la présentation" }).click();
  await page
    .getByRole("link", { name: "Ouvrir un projet", exact: true })
    .waitFor();
  const data = await page.evaluate(async () => {
    const { rcBeamDefaults, rcColumnDefaults } =
      await import("/src/domain/rc/model.ts");
    const { calculateRC } = await import("/src/lib/rc-engine.ts");
    const { rcPlans, planTikz } = await import("/src/domain/rc/plans.ts");
    const { renderTikz } = await import("/src/lib/tikz.ts");
    const { planDxf } = await import("/src/domain/rc/plan-dxf.ts");
    const { generateReportPdf } = await import("/src/lib/report-pdf.ts");
    const { buildRCReport } = await import("/src/domain/rc/report.ts");
    const { defaultReportSelection } = await import("/src/domain/report.ts");
    const result = [];
    for (const kind of ["column", "beam"]) {
      const model = kind === "column" ? rcColumnDefaults() : rcBeamDefaults();
      if (kind === "beam") {
        model.analysis.construction = "monolithic";
        model.analysis.redistribution = true;
        model.spans.push({
          ...model.spans[0],
          id: "t2",
          name: "Travée 2",
          ln_m: 4,
        });
        model.supports.push({ ...model.supports[0], id: "s3" });
      }
      const r = await calculateRC(model);
      const plans = rcPlans(model, r, {
        project: "Hall principal — Étude béton armé",
        author: "Bureau d’études",
        date: "28/11/2026",
      });
      const plan = plans[0];
      console.info("COMPOSING", kind);
      const svg = await renderTikz(planTikz(plan));
      const report = buildRCReport(
        {
          id: kind,
          name: "Hall principal — Étude béton armé",
          type: kind === "column" ? "column" : "beam-size",
          updatedAt: new Date().toISOString(),
          data: model,
        },
        model,
        r,
        defaultReportSelection(
          kind === "column" ? "column" : "beam-size",
          model,
        ),
        "Bureau d’études",
        new Date().toISOString(),
      );
      console.info("MAKING NOTE", kind);
      const pdf = await generateReportPdf(report),
        single = await generateReportPdf(
          {
            ...report,
            sections: [
              {
                id: "drawing",
                title: "Plan",
                detail: "full",
                blocks: [{ kind: "plan", plan }],
              },
            ],
          },
          true,
        );
      result.push({
        kind,
        model,
        svg,
        tex: planTikz(plan, true),
        dxf: planDxf(plan),
        pdf: Array.from(pdf),
        single: Array.from(single),
        plans: plans.map((p) => ({ number: p.number, title: p.title })),
        redistributions: r.redistribution?.length,
      });
    }
    return result;
  });
  for (const item of data) {
    for (const ext of ["svg", "tex", "dxf"])
      writeFileSync(`${out}/${item.kind}-plan.${ext}`, item[ext]);
    writeFileSync(
      `${out}/${item.kind === "beam" ? "beam-size" : item.kind}-note.pdf`,
      Buffer.from(item.pdf),
    );
    writeFileSync(`${out}/${item.kind}-plan.pdf`, Buffer.from(item.single));
    writeFileSync(
      `/tmp/rc-${item.kind}-example.json`,
      JSON.stringify(item.model),
    );
    console.log({
      kind: item.kind,
      pdf: item.pdf.length,
      single: item.single.length,
      plans: item.plans,
      redistribution: item.redistributions,
    });
  }
  expect(errors).toEqual([]);
} finally {
  await browser.close();
}
