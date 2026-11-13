import { expect, type Page } from "@playwright/test";
export async function createStudy(
  page: Page,
  name = "Étude de vérification",
  skipGuide = true,
) {
  await page.getByLabel("Nom du projet", { exact: true }).fill(name);
  await page
    .getByRole("button", { name: "Créer l’étude", exact: true })
    .click();
  if (skipGuide) {
    await expect(page.locator(".guide-coach")).toBeVisible();
    await page
      .getByRole("button", { name: "Explorer librement", exact: true })
      .click();
  }
}
export async function parameters(page: Page) {
  await page
    .getByRole("button", { name: "Ouvrir les paramètres", exact: true })
    .click();
}
export async function calculate(page: Page, results = false) {
  // Observe the progress state before clicking: a fast native fallback can
  // complete before a touch click round-trip returns to the test runner.
  await page.evaluate(() => {
    const state = window as Window & { __calculationProgressSeen?: boolean };
    state.__calculationProgressSeen = false;
    const observer = new MutationObserver(() => {
      if (document.querySelector(".calculation-veil")) {
        state.__calculationProgressSeen = true;
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
  await page.getByRole("button", { name: "Calculer", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { __calculationProgressSeen?: boolean })
            .__calculationProgressSeen,
      ),
    )
    .toBe(true);
  await expect(page.locator(".calculation-veil")).toHaveCount(0);
  await expect(page.locator(".canvas-result-status")).toContainText(
    "Calcul actualisé",
  );
  if (results)
    await page
      .getByRole("button", { name: "Ouvrir les résultats", exact: true })
      .click();
}
