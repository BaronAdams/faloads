import { test, expect } from "@playwright/test";
import { createStudy, calculate } from "./helpers";
test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Passer la présentation" }).click();
  await page.goto("/#/new/beam");
  await createStudy(page);
});
test("a WebView without module workers uses the same solver after painting progress", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.Worker = class {
      constructor() {
        throw Error("Module workers unavailable");
      }
    } as unknown as typeof Worker;
  });
  await calculate(page, true);
  await expect(page.locator(".metric").first()).toContainText("111,00");
});
test("a late calculation never marks a changed model as current", async ({
  page,
}) => {
  await page.evaluate(() => {
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      postMessage(data: unknown) {
        setTimeout(() => super.postMessage(data), 1200);
      }
    };
  });
  await page.getByRole("button", { name: "Calculer", exact: true }).click();
  await expect(page.locator(".calculation-veil")).toBeVisible();
  // Model changes can also come from keyboard commands while work is pending.
  await page
    .locator('[data-tour="parameters"]')
    .evaluate((el) => (el as HTMLButtonElement).click());
  await page.getByLabel("Longueur L", { exact: true }).fill("9");
  await page
    .getByRole("button", { name: "Revenir au schéma", exact: true })
    .click();
  await expect(page.locator(".calculation-veil")).toHaveCount(0);
  await expect(page.locator(".canvas-result-status")).toContainText(
    "Calcul non actualisé",
  );
  await expect(
    page.getByRole("button", { name: "Moment M", exact: true }),
  ).toBeDisabled();
});
