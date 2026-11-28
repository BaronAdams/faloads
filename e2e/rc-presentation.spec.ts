import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createStudy, parameters } from "./helpers";
async function open(page: any, type = "column") {
  await page.goto("/");
  await page.getByRole("button", { name: "Passer la présentation" }).click();
  await page.goto(`/#/new/${type}`);
  await createStudy(page, "Étude de présentation BA");
}
async function calculate(page: any) {
  await page
    .getByRole("button", { name: "Calculer le dimensionnement", exact: true })
    .click();
  await expect(page.locator(".rc-workspace-status")).toContainText(
    "Calcul actualisé",
    { timeout: 120000 },
  );
}
test("BA categories reveal distinct results and parameter pages always start at the top", async ({
  page,
}) => {
  test.setTimeout(120000);
  await open(page);
  await calculate(page);
  await page
    .getByRole("button", { name: "Ouvrir les résultats", exact: true })
    .click();
  const results = page.getByTestId("rc-results");
  await expect(results).toContainText("Armatures retenues");
  await expect(results).not.toContainText("Combinaisons dimensionnantes");
  await results.getByRole("button", { name: "Analyse", exact: true }).click();
  await expect(results).toContainText("Combinaisons dimensionnantes");
  await expect(results).not.toContainText("Armatures retenues");
  await results.getByRole("button", { name: "Cadres", exact: true }).click();
  await expect(results).toContainText("Pas courant");
  await results
    .getByRole("button", { name: "Vérifications", exact: false })
    .click();
  await expect(results).toContainText(
    "Domaine et vérifications complémentaires",
  );
  await page
    .getByRole("button", { name: "Revenir au schéma", exact: true })
    .click();
  await parameters(page);
  const dialog = page.getByRole("dialog"),
    body = page.locator(".rc-parameter-body");
  await dialog.getByRole("button", { name: "Armatures", exact: true }).click();
  await body.evaluate((el: any) => (el.scrollTop = el.scrollHeight));
  await dialog.getByRole("button", { name: "Matériaux", exact: true }).click();
  expect(await body.evaluate((el: any) => el.scrollTop)).toBe(0);
  await dialog.getByRole("button", { name: "Armatures", exact: true }).click();
  expect(await body.evaluate((el: any) => el.scrollTop)).toBe(0);
  await dialog.getByRole("button", { name: "Annuler", exact: true }).click();
  const gap = page.locator("[data-spacing-mm]").nth(7);
  await gap.scrollIntoViewIfNeeded();
  if (test.info().project.name === "mobile") await gap.tap();
  else await gap.hover();
  await expect(page.getByTestId("rc-spacing-label")).toContainText("mm · HA8");
});
test("continuous beams show both envelopes, cutoff curves and actual spacing, and export an A4 CAD plan", async ({
  page,
}) => {
  test.setTimeout(180000);
  await open(page, "beam-size");
  await parameters(page);
  const form = page.getByRole("dialog");
  await form.getByRole("button", { name: "Section en T", exact: true }).click();
  await expect(form).toBeVisible();
  await form
    .getByRole("button", { name: "Section rectangulaire", exact: true })
    .click();
  await form
    .getByRole("button", { name: "Ajouter une travée", exact: true })
    .click();
  await expect(form.getByLabel("Portée nue L2", { exact: true })).toBeVisible();
  await form.getByLabel("Portée nue L2", { exact: true }).fill("4");
  await form.getByRole("button", { name: "Méthode", exact: true }).click();
  await form
    .getByRole("combobox", {
      name: "Liaison de la poutre aux appuis",
      exact: true,
    })
    .click();
  await page
    .getByRole("option", { name: "Poutre solidaire des appuis", exact: true })
    .click();
  await form
    .getByRole("checkbox", {
      name: "Autoriser la redistribution limitée des moments ELU",
      exact: true,
    })
    .check();
  await form
    .getByRole("button", { name: "Appliquer les paramètres", exact: true })
    .click();
  await calculate(page);
  const gap = page.locator("[data-spacing-mm]").nth(3);
  if (test.info().project.name === "mobile") await gap.tap();
  else await gap.hover();
  await expect(page.getByTestId("rc-spacing-label")).toContainText("mm · HA8");
  await page.getByRole("button", { name: "M", exact: true }).click();
  await expect(page.getByTestId("playground")).toContainText(
    "avant redistribution",
  );
  const elastic = await page.locator("polyline").first().getAttribute("points");
  await page.getByRole("button", { name: "M redistrib.", exact: true }).click();
  await expect(page.getByTestId("playground")).toContainText(
    "après redistribution",
  );
  expect(
    await page.locator("polyline").first().getAttribute("points"),
  ).not.toBe(elastic);
  await page.getByRole("button", { name: "Épure", exact: true }).click();
  await expect(page.locator("polyline")).toHaveCount(8);
  await page
    .getByRole("button", {
      name: "Exporter le plan de ferraillage",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("radio", { name: "DXF · dessin modifiable", exact: true })
    .check();
  const download = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "Exporter DXF", exact: true })
    .click();
  const file = await download;
  const dxf = readFileSync((await file.path())!, "utf8");
  expect(dxf).toContain("A4 Landscape");
  expect(dxf).toContain("CaliSigma Structural");
  expect(dxf).toContain("297");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
