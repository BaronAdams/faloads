import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createStudy, parameters } from "./helpers";
async function study(page: Page, type = "column") {
  await page.goto("/");
  await page.getByRole("button", { name: "Passer la présentation" }).click();
  await page.goto(`/#/new/${type}`);
  await createStudy(page, `EC2 ${type}`);
}
async function run(page: Page) {
  await page
    .getByRole("button", { name: "Calculer le dimensionnement", exact: true })
    .click();
  await expect(page.locator(".rc-workspace-status")).toContainText(
    "Calcul actualisé",
    { timeout: 120000 },
  );
  await expect(page.locator(".calculation-veil")).toHaveCount(0);
}
async function results(page: Page) {
  await page
    .getByRole("button", { name: "Ouvrir les résultats", exact: true })
    .click();
  await expect(page.getByTestId("rc-results")).toBeVisible();
}
test("EC2 column calculates offline, matches the original Python engine and hides stale results", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await study(page);
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await run(page);
  await results(page);
  await expect(page.getByTestId("rc-results")).toContainText("Second ordre");
  await expect(page.getByTestId("rc-results")).toContainText("4 HA12");
  expect(
    requests.every(
      (u) =>
        u.startsWith("http://127.0.0.1:1420") ||
        u.startsWith("data:") ||
        u.startsWith("blob:"),
    ),
  ).toBe(true);
  const model = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("structcalc.workspace.v1")!).projects[0]
        .data,
  );
  const expected = JSON.parse(
    execFileSync("python3", ["public/ec2-engine/bridge.py"], {
      input: JSON.stringify(model),
      encoding: "utf8",
    }),
  );
  await expect(page.getByTestId("rc-results")).toContainText(
    expected.reinforcement.layout.As_prov.toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  );
  await page
    .getByRole("button", { name: "Revenir au schéma", exact: true })
    .click();
  await parameters(page);
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Hauteur libre l", { exact: true }).fill("3,5");
  await dialog
    .getByRole("button", { name: "Appliquer les paramètres", exact: true })
    .click();
  await expect(page.locator(".rc-workspace-status")).toContainText(
    "Calcul non actualisé",
  );
  await page
    .getByRole("button", { name: "Ouvrir les résultats", exact: true })
    .click();
  await expect(page.getByTestId("rc-results")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toContainText(
    "Les données ont changé",
  );
  await page
    .getByRole("button", { name: "Revenir au schéma", exact: true })
    .click();
  await page.reload();
  await expect(page.getByTestId("rc-project")).toBeVisible();
  await parameters(page);
  await expect(
    page.getByRole("dialog").getByLabel("Hauteur libre l", { exact: true }),
  ).toHaveValue("3,5");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
test("EC2 beam requires construction, applies a transaction, computes bars and exports selected PDF chapters", async ({
  page,
}) => {
  test.setTimeout(120000);
  await study(page, "beam-size");
  await page
    .getByRole("button", { name: "Calculer le dimensionnement", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Calcul impossible" }),
  ).toContainText("Précisez");
  await parameters(page);
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Méthode", exact: true }).click();
  await dialog
    .getByRole("combobox", {
      name: "Liaison de la poutre aux appuis",
      exact: true,
    })
    .click();
  await page.getByRole("option", { name: "Poutre posée", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Appliquer les paramètres", exact: true })
    .click();
  await run(page);
  await results(page);
  await expect(page.getByTestId("rc-results")).toContainText("66,07");
  await expect(page.getByTestId("rc-results")).toContainText("2 HA16");
  await expect(page.getByTestId("rc-results")).toContainText(
    "Contrôles calculés satisfaits",
  );
  await page
    .getByRole("button", { name: "Revenir au schéma", exact: true })
    .click();
  await parameters(page);
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Hauteur totale h", { exact: true }).fill("65");
  await dialog.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(page.locator(".rc-workspace-status")).toContainText(
    "Calcul actualisé",
  );
  await page.getByRole("button", { name: "M", exact: true }).click();
  await expect(page.getByTestId("playground").locator("polyline")).toHaveCount(
    2,
  );
  await page
    .getByRole("button", { name: "Préparer la note de calcul", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "Préparer la note de calcul" });
  await expect(dialog.getByRole("checkbox")).toHaveCount(7);
  await dialog
    .getByRole("button", { name: "Tout retirer", exact: true })
    .click();
  await dialog
    .getByRole("checkbox", { name: "Armatures longitudinales", exact: false })
    .check();
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: /Générer le PDF/ }).click();
  const pdf = await download;
  expect(pdf.suggestedFilename()).toContain("note-de-calcul.pdf");
  expect(await pdf.failure()).toBeNull();
});
test("RC calculations also work in a native WebView without module workers", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.addInitScript(() => {
    Object.defineProperty(window, "Worker", {
      configurable: true,
      value: class {
        constructor() {
          throw new TypeError("Module workers unavailable");
        }
      },
    });
  });
  await study(page);
  await run(page);
  await results(page);
  await expect(page.getByTestId("rc-results")).toContainText("4 HA12");
});
test("BA forms retain confirmations and fit the mobile viewport", async ({
  page,
}) => {
  await study(page, "beam-size");
  await parameters(page);
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", {
      name: "Appliquer les paramètres",
      exact: true,
    }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Actions", exact: true }).click();
  await dialog.getByLabel("Charge Q — travée 1", { exact: true }).fill("7,5");
  await dialog
    .getByRole("button", { name: "Appliquer les paramètres", exact: true })
    .click();
  await page.reload();
  await parameters(page);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Actions", exact: true })
    .click();
  await expect(
    page.getByLabel("Charge Q — travée 1", { exact: true }),
  ).toHaveValue("7,5");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});

test("the new EC2 guide remains available after an older estimate guide was completed", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Passer la présentation" }).click();
  await page.evaluate(() => {
    const w = JSON.parse(localStorage.getItem("structcalc.workspace.v1")!);
    w.guides.column = { step: 2, completed: true };
    localStorage.setItem("structcalc.workspace.v1", JSON.stringify(w));
  });
  await page.reload();
  await page.goto("/#/new/column");
  await createStudy(page, "Premier poteau EC2", false);
  await expect(page.locator(".guide-coach")).toContainText(
    "Définissez votre élément BA",
  );
  await parameters(page);
  await expect(page.locator(".guide-coach")).toContainText(
    "Adaptez les données",
  );
  await page
    .getByRole("dialog")
    .getByLabel("Hauteur libre l", { exact: true })
    .fill("3,4");
  await expect(page.locator(".guide-coach")).toContainText(
    "Appliquez vos paramètres",
  );
  await page
    .getByRole("button", { name: "Appliquer les paramètres", exact: true })
    .click();
  await expect(page.locator(".guide-coach")).toContainText(
    "Lancez le dimensionnement",
  );
  await page
    .getByRole("button", { name: "Explorer librement", exact: true })
    .click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("structcalc.workspace.v1")!).guides[
          "column:ec2-v1"
        ].completed,
    ),
  ).toBe(true);
});
