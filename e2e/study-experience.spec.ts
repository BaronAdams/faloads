import { test, expect } from "@playwright/test";
import { createStudy, calculate, parameters } from "./helpers";
test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Passer la présentation" }).click();
});
test("explicit naming and action-driven guide complete, persist and replay", async ({
  page,
}) => {
  await page.goto("/#/new/beam");
  await expect(page.getByRole("dialog")).toContainText(
    "Comment s’appelle votre étude",
  );
  await expect(
    page.getByRole("button", { name: "Créer l’étude", exact: true }),
  ).toBeDisabled();
  await createStudy(page, "Résidence Horizon — R+1", false);
  test.setTimeout(90000);
  const coach = page.locator(".guide-coach");
  await expect(coach).toContainText("Commencez par le modèle");
  await parameters(page);
  await expect(coach).toContainText("Adaptez la géométrie");
  await page
    .getByRole("dialog")
    .getByLabel("Longueur L", { exact: true })
    .fill("9");
  await expect(coach).toContainText("Revenez au schéma");
  await page
    .getByRole("button", { name: "Revenir au schéma", exact: true })
    .click();
  await expect(coach).toContainText("Ajoutez un élément");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Force ponctuelle", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Force verticale Fy", { exact: true })
    .fill("25");
  await page.getByRole("button", { name: "Appliquer", exact: true }).click();
  await expect(coach).toContainText("Lancez l’analyse");
  await calculate(page);
  await expect(coach).toContainText("Consultez les valeurs");
  await page
    .getByRole("button", { name: "Ouvrir les résultats", exact: true })
    .click();
  await expect(coach).toContainText("Retrouvez votre espace");
  await page
    .getByRole("button", { name: "Revenir au schéma", exact: true })
    .click();
  await expect(coach).toContainText("Conservez votre étude");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page).toHaveURL(/project\//);
  await expect(coach).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Résidence Horizon — R+1", exact: true }),
  ).toBeVisible();
  await expect(coach).toHaveCount(0);
  const guides = await page.evaluate(
    () => JSON.parse(localStorage.getItem("structcalc.workspace.v1")!).guides,
  );
  expect(guides.beam.completed).toBe(true);
  expect(guides.frame).toBeUndefined();
  await page
    .getByRole("button", { name: "Rejouer le guide", exact: true })
    .click();
  await expect(coach).toContainText("Commencez par le modèle");
  await page
    .getByRole("button", { name: "Explorer librement", exact: true })
    .click();
  await expect(coach).toHaveCount(0);
});
test("manual analysis invalidates diagrams and cannot label a failed calculation as current", async ({
  page,
}) => {
  await page.goto("/#/new/beam");
  await createStudy(page);
  await expect(page.getByTestId("diagram-curve")).toHaveCount(0);
  await calculate(page);
  await page.getByRole("button", { name: "Moment M", exact: true }).click();
  await expect(page.getByTestId("diagram-curve")).toHaveCount(1);
  await parameters(page);
  await page.getByLabel("Longueur L", { exact: true }).fill("9");
  await page
    .getByRole("button", { name: "Revenir au schéma", exact: true })
    .click();
  await expect(page.locator(".canvas-result-status")).toContainText(
    "Calcul non actualisé",
  );
  await expect(page.getByTestId("diagram-curve")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Moment M", exact: true }),
  ).toBeDisabled();
  await page.evaluate(() => {
    window.Worker = class {
      onmessage?: (event: { data: { error: string } }) => void;
      postMessage() {
        setTimeout(
          () => this.onmessage?.({ data: { error: "Moteur indisponible" } }),
          10,
        );
      }
      terminate() {}
    } as unknown as typeof Worker;
  });
  await page.getByRole("button", { name: "Calculer", exact: true }).click();
  await expect(page.locator(".canvas-error")).toContainText(
    "Moteur indisponible",
  );
  await expect(page.locator(".canvas-result-status")).toContainText(
    "Calcul non actualisé",
  );
});
test("frame diagrams cover every member and results contain no per-member chart selector", async ({
  page,
}) => {
  await page.goto("/#/new/frame");
  await createStudy(page);
  await calculate(page);
  const bars = page.locator(
    '[data-element^="member:"] > [data-selection-bounds]',
  );
  const count = await bars.count();
  expect(count).toBeGreaterThan(1);
  await expect(bars.first()).toHaveAttribute("stroke-width", "3.5");
  for (const name of [
    "Moment M",
    "Effort tranchant V",
    "Effort normal N",
    "Déformée",
    "Rotation",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.getByTestId("diagram-curve")).toHaveCount(count);
  }
  await page
    .getByRole("button", { name: "Ouvrir les résultats", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").locator('svg[data-testid="diagram-curve"]'),
  ).toHaveCount(0);
  await expect(page.getByLabel("Barre analysée")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Déplacements des nœuds", exact: true })
    .click();
  await expect(page.getByRole("dialog").locator("table")).toHaveCount(2);
});
test("column uses full influence lengths, matching beam colour keys, and redirects only after calculation", async ({
  page,
}) => {
  await page.goto("/#/new/column-load");
  await createStudy(page);
  await page.getByRole("button", { name: "Suivant", exact: true }).click();
  await expect(page.locator(".formula")).toContainText(
    "A = (L₁ + L₂) × (L₃ + L₄)",
  );
  await expect(page.locator(".metric")).toContainText("36,00");
  await expect(page.getByTestId("playground")).toContainText("9,00 m²");
  const swatches = page.locator(".field-swatch");
  await expect(swatches).toHaveCount(4);
  const colors = await swatches.evaluateAll((els) =>
    els.map((e) => getComputedStyle(e).backgroundColor),
  );
  expect(colors[0]).toBe(colors[1]);
  expect(colors[2]).toBe(colors[3]);
  expect(colors[0]).not.toBe(colors[2]);
  await page.getByRole("button", { name: "Suivant", exact: true }).click();
  await page.getByRole("button", { name: "Suivant", exact: true }).click();
  await page
    .getByRole("button", { name: "Calculer les efforts", exact: true })
    .click();
  await expect(page.locator(".calculation-veil")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Descente de charges cumulée",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(page.locator(".calculation-veil")).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      name: "Descente de charges cumulée",
      exact: true,
    }),
  ).toBeVisible();
});
