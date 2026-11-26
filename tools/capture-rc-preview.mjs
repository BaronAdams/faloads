import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const dir = "docs/ec2-preview";
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
for (const mobile of [false, true]) {
  const page = await browser.newPage({
    viewport: mobile
      ? { width: 390, height: 844 }
      : { width: 1440, height: 1000 },
    isMobile: mobile,
    hasTouch: mobile,
  });
  if (!mobile)
    await page.addInitScript(() =>
      Object.assign(window, {
        isTauri: true,
        __TAURI_INTERNALS__: {
          invoke: async (command, args) => {
            if (command === "read_workspace")
              return JSON.parse(
                localStorage.getItem("structcalc.workspace.v1") ?? "null",
              );
            if (command === "write_workspace")
              localStorage.setItem(
                "structcalc.workspace.v1",
                JSON.stringify(args.value),
              );
            return null;
          },
        },
      }),
    );
  page.on("pageerror", (e) => {
    throw e;
  });
  await page.goto("http://127.0.0.1:1420/");
  await page.getByRole("button", { name: "Passer la présentation" }).click();
  for (const type of ["column", "beam-size"]) {
    await page.goto(`http://127.0.0.1:1420/#/new/${type}`);
    await page
      .getByLabel("Nom du projet", { exact: true })
      .fill(
        type === "column"
          ? "Poteau P1 — Hall principal"
          : "Poutre B1 — Plancher haut",
      );
    await page
      .getByRole("button", { name: "Créer l’étude", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Explorer librement", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Ouvrir les paramètres", exact: true })
      .click();
    let dialog = page.getByRole("dialog");
    if (type === "beam-size") {
      await dialog
        .getByRole("button", { name: "Méthode", exact: true })
        .click();
      await dialog
        .getByRole("combobox", {
          name: "Liaison de la poutre aux appuis",
          exact: true,
        })
        .click();
      await page
        .getByRole("option", { name: "Poutre posée", exact: true })
        .click();
    }
    await dialog
      .getByRole("button", { name: "Appliquer les paramètres", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Calculer le dimensionnement", exact: true })
      .click();
    await page
      .locator(".rc-workspace-status")
      .getByText("Calcul actualisé", { exact: true })
      .waitFor({ timeout: 120000 });
    await page
      .locator(".rc-view-controls")
      .getByRole("button", { name: "Armatures", exact: true, pressed: true })
      .waitFor();
    await page.screenshot({
      path: `${dir}/${type}-${mobile ? "mobile" : "desktop"}.png`,
    });
    await page
      .getByRole("button", { name: "Ouvrir les résultats", exact: true })
      .click();
    await page.getByTestId("rc-results").waitFor({ state: "visible" });
    await page.waitForTimeout(550);
    await page.screenshot({
      path: `${dir}/${type}-results-${mobile ? "mobile" : "desktop"}.png`,
    });
    await page
      .getByRole("button", { name: "Revenir au schéma", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Ouvrir les paramètres", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Actions", exact: true }).click();
    await page.waitForTimeout(250);
    await page.screenshot({
      path: `${dir}/${type}-parameters-${mobile ? "mobile" : "desktop"}.png`,
    });
    await dialog.getByRole("button", { name: "Annuler", exact: true }).click();
    if (!mobile) {
      // Generate actual application PDFs (same current model and engine as the UI).
      const bytes = await page.evaluate(async () => {
        const m = JSON.parse(localStorage.getItem("structcalc.workspace.v1"))
          .projects[0];
        const { prepareReport } = await import("/src/lib/report-export.ts");
        const { reportSteps } = await import("/src/domain/report.ts");
        const { generateReportPdf } = await import("/src/lib/report-pdf.ts");
        const report = await prepareReport(
          m,
          Object.fromEntries(
            reportSteps(m.type, m.data).map((s) => [s.id, "full"]),
          ),
          "CaliSigma Structural — étude de vérification",
        );
        return Array.from(await generateReportPdf(report));
      });
      writeFileSync(`${dir}/${type}-note.pdf`, new Uint8Array(bytes));
    }
  }
  await page.close();
}
await browser.close();
