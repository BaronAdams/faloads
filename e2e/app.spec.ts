import { test, expect, type Page } from "@playwright/test";
const ready = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Passer la présentation" }).click();
  await expect(
    page.getByRole("heading", { name: "Concevez avec clarté." }),
  ).toBeVisible();
};
test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});
test("the original 13 icons, typography, theme and project search are retained", async ({
  page,
}) => {
  await ready(page);
  await expect(page.locator(".project-type-card")).toHaveCount(13);
  for (const img of await page.locator(".project-type-card img").all()) {
    await expect(img).toHaveJSProperty("naturalWidth", 352);
  }
  expect(
    await page
      .locator("body")
      .evaluate((el) => getComputedStyle(el).fontFamily),
  ).toContain("DM Sans");
  await page
    .getByRole("textbox", { name: "Rechercher un type de projet" })
    .fill("semelle");
  await expect(page.locator(".project-type-card")).toHaveCount(1);
  await page.goto("/#/settings");
  await page.getByRole("button", { name: "Clair", exact: true }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});
test("beam parameters apply, actual results change, undo works, and saving survives reload", async ({
  page,
}, info) => {
  await ready(page);
  await page.goto("/#/new/beam");
  await expect(
    page.getByRole("heading", { name: "Calculateur de poutres", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Nom du projet").fill("Poutre test");
  await page.getByRole("button", { name: /Force F2/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Force verticale Fy", { exact: true }).fill("50,5");
  await dialog.getByRole("button", { name: "Appliquer", exact: true }).click();
  if (info.project.name === "mobile")
    await page.getByRole("tab", { name: "Résultats", exact: true }).click();
  await expect(page.locator(".metric").first()).not.toContainText("111,00");
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(page.locator(".metric").first()).toContainText("111,00");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page).toHaveURL(/project\//);
  await page.reload();
  await expect(page.getByLabel("Nom du projet")).toHaveValue("Poutre test");
  await page.goto("/#/projects");
  await expect(
    page.getByRole("heading", { name: "Poutre test" }),
  ).toBeVisible();
});
test("canvas supports zoom, mouse pan and reset without changing the model", async ({
  page,
}, info) => {
  await ready(page);
  await page.goto("/#/new/beam");
  if (info.project.name === "mobile")
    await page.getByRole("tab", { name: "Schéma", exact: true }).click();
  await page.getByRole("button", { name: "Augmenter le zoom" }).click();
  await expect(page.getByTestId("zoom-level")).toHaveText("120 %");
  const canvas = page.getByTestId("playground");
  await page.getByRole("button", { name: "Déplacer", exact: true }).click();
  const box = await canvas.boundingBox();
  if (!box) throw Error("Canvas not found");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 45,
    box.y + box.height / 2 + 15,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect(page.getByTestId("camera")).not.toHaveAttribute(
    "transform",
    "translate(0 0) scale(1.2)",
  );
  await page.getByRole("button", { name: "Recentrer", exact: true }).click();
  await expect(page.getByTestId("camera")).toHaveAttribute(
    "transform",
    "translate(0 0) scale(1)",
  );
});
test("frame node edits and force results work", async ({ page }, info) => {
  await ready(page);
  await page.goto("/#/new/frame");
  await page.getByRole("button", { name: /N3 · Libre/ }).click();
  await page.getByRole("dialog").getByLabel("Abscisse x").fill("7");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Appliquer", exact: true })
    .click();
  if (info.project.name === "mobile")
    await page.getByRole("tab", { name: "Résultats", exact: true }).click();
  await expect(page.locator(".metric").first()).not.toContainText("67,02");
  await expect(page.locator(".metric").last()).toContainText("Vérifié");
});
test("load descent reaches cumulative results and adds independent coatings", async ({
  page,
}) => {
  await ready(page);
  await page.goto("/#/new/column-load");
  await page.getByRole("button", { name: "Suivant", exact: true }).click();
  await page.getByRole("button", { name: "Suivant", exact: true }).click();
  await page
    .getByRole("button", { name: "Ajouter un revêtement" })
    .first()
    .click();
  await page.getByLabel("Nom du revêtement").fill("Carrelage");
  await page.getByRole("button", { name: "Suivant", exact: true }).click();
  await page.getByRole("button", { name: "Calculer les efforts" }).click();
  await expect(
    page.getByRole("heading", { name: "Descente de charges cumulée" }),
  ).toBeVisible();
  await expect(
    page.getByRole("rowheader", { name: "RDC", exact: true }),
  ).toBeVisible();
});
test("building editing, deleted segments, floor duplication and results work", async ({
  page,
}) => {
  await ready(page);
  await page.goto("/#/new/building");
  await page
    .getByTestId("playground")
    .locator('[data-element="edge|h:0:0"]')
    .locator("line")
    .last()
    .click({ force: true });
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("switch").click();
  await page.getByRole("button", { name: "Appliquer", exact: true }).click();
  await page.getByRole("button", { name: "Dupliquer", exact: true }).click();
  await expect(page.getByLabel("Nom du niveau")).toHaveValue("Copie de RDC");
  await page.getByRole("tab", { name: "Résultats", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Résultats du niveau" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Poutres", exact: true }).click();
  await expect(page.locator("table")).toContainText("q_ELU");
});
test("all eight predimensioning projects expose editable inputs and computed results", async ({
  page,
}) => {
  await ready(page);
  for (const type of [
    "column",
    "beam-size",
    "wall",
    "stairs",
    "balcony",
    "slab",
    "retaining",
    "footing",
  ]) {
    await page.goto(`/#/new/${type}`);
    await expect(page.getByTestId("predim-result")).toBeVisible();
    expect(
      (await page.getByTestId("predim-result").innerText()).length,
    ).toBeGreaterThan(0);
  }
});
test("small viewport and enlarged text retain navigation without horizontal overflow", async ({
  page,
}) => {
  await ready(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.addStyleTag({ content: "html{font-size:22px}" });
  await page.goto("/#/new/column");
  await expect(page.getByTestId("predim-result")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});

test("simplified G/Q calculation responds to load edits in the mobile sheet", async ({
  page,
}) => {
  await ready(page);
  await page.goto("/#/new/beam");
  await page
    .getByRole("button", { name: "Calcul simplifié G/Q", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Calcul simplifié G/Q" }),
  ).toBeVisible();
  const initial = await dialog.locator(".metric").first().innerText();
  await dialog.getByLabel("Charge permanente G", { exact: true }).fill("24");
  await expect(dialog.locator(".metric").first()).not.toHaveText(initial);
  const box = await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width + 1,
  );
});

test("corrupt saved data remains intact in a temporary session", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem("structcalc.workspace.v1", "{invalid"),
  );
  await page.reload();
  await page.getByRole("button", { name: "Continuer sans sauvegarde" }).click();
  await page.getByRole("button", { name: "Passer la présentation" }).click();
  await page.goto("/#/new/column");
  await expect(
    page.getByRole("button", { name: "Enregistrer", exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(() => localStorage.getItem("structcalc.workspace.v1")),
  ).toBe("{invalid");
});
