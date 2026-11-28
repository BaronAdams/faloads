import { chromium, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
const dir = "docs/ec2-preview";
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
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
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:1420");
    await page.getByRole("button", { name: "Passer la présentation" }).click();
    for (const type of ["column", "beam-size"]) {
      await page.goto(`http://127.0.0.1:1420/#/new/${type}`);
      await page
        .getByLabel("Nom du projet", { exact: true })
        .fill(
          type === "column"
            ? "Poteau P1 — Hall"
            : "Poutre continue — Plancher haut",
        );
      await page
        .getByRole("button", { name: "Créer l’étude", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Explorer librement", exact: true })
        .click();
      if (type === "beam-size") {
        await page
          .getByRole("button", { name: "Ouvrir les paramètres", exact: true })
          .click();
        const dialog = page.getByRole("dialog");
        await dialog
          .getByRole("button", { name: "Ajouter une travée", exact: true })
          .click();
        await dialog.getByLabel("Portée nue L2", { exact: true }).fill("4");
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
          .getByRole("option", {
            name: "Poutre solidaire des appuis",
            exact: true,
          })
          .click();
        await dialog
          .getByRole("checkbox", {
            name: "Autoriser la redistribution limitée des moments ELU",
            exact: true,
          })
          .check();
        await dialog
          .getByRole("button", {
            name: "Appliquer les paramètres",
            exact: true,
          })
          .click();
      }
      console.log("CAPTURE", type, mobile ? "mobile" : "desktop");
      await page
        .getByRole("button", {
          name: "Calculer le dimensionnement",
          exact: true,
        })
        .click();
      await expect(page.locator(".rc-workspace-status")).toContainText(
        "Calcul actualisé",
        { timeout: 120000 },
      );
      const base = `${dir}/${type}-${mobile ? "mobile" : "desktop"}`;
      await page.screenshot({ path: base + ".png" });
      const gap = page.locator("[data-spacing-mm]").nth(6);
      mobile ? await gap.tap() : await gap.hover();
      await expect(page.getByTestId("rc-spacing-label")).toBeVisible();
      await page.screenshot({ path: base + "-spacing.png" });
      if (type === "beam-size")
        for (const [label, suffix] of [
          ["M", "envelope"],
          ["M redistrib.", "redistributed"],
          ["Épure", "cutoff"],
        ]) {
          await page.getByRole("button", { name: label, exact: true }).click();
          await expect(
            page.getByRole("button", { name: label, exact: true }),
          ).toHaveAttribute("aria-pressed", "true");
          await page.waitForTimeout(120);
          await page.screenshot({ path: base + "-" + suffix + ".png" });
        }
      await page
        .getByRole("button", { name: "Ouvrir les résultats", exact: true })
        .click();
      await expect(page.getByTestId("rc-results")).toBeVisible();
      await page.waitForTimeout(250);
      await page.screenshot({
        path: `${dir}/${type}-results-${mobile ? "mobile" : "desktop"}.png`,
      });
      await page
        .getByTestId("rc-results")
        .getByRole("button", { name: "Cadres", exact: true })
        .click();
      await page.screenshot({ path: base + "-category.png" });
      await page
        .getByRole("button", { name: "Revenir au schéma", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Ouvrir les paramètres", exact: true })
        .click();
      await page.waitForTimeout(250);
      await page.screenshot({
        path: `${dir}/${type}-parameters-${mobile ? "mobile" : "desktop"}.png`,
      });
      await page.getByRole("button", { name: "Annuler", exact: true }).click();
    }
    expect(errors).toEqual([]);
    await page.close();
  }
} finally {
  await browser.close();
}
