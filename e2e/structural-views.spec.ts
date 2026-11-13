import { test, expect } from "@playwright/test";
import { createStudy, calculate, parameters } from "./helpers";
test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Passer la présentation" }).click();
});
for (const kind of ["beam", "frame"] as const) {
  test(`${kind}: reactions and plots require a current calculation and refresh together`, async ({
    page,
  }) => {
    await page.goto(`/#/new/${kind}`);
    await createStudy(page);
    await page.getByRole("button", { name: "Moment M", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Lancez d’abord le calcul",
    );
    await expect(page.getByTestId("reaction")).toHaveCount(0);
    await expect(page.getByTestId("diagram-curve")).toHaveCount(0);
    await page.getByRole("button", { name: "Fermer", exact: true }).click();
    await parameters(page);
    const switcher = page.getByRole("switch", {
      name: "Afficher les réactions",
      exact: true,
    });
    await expect(switcher).not.toBeChecked();
    await switcher.click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      "Lancez d’abord le calcul",
    );
    await expect(switcher).not.toBeChecked();
    await page
      .getByRole("button", { name: "Calculer maintenant", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".canvas-result-status")).toContainText(
      "Calcul actualisé",
    );
    await expect(page.getByTestId("reaction")).toHaveCount(2);
    const before = await page
      .getByTestId("reaction")
      .evaluateAll((els) =>
        els.map((e) => Number(e.getAttribute("data-reaction-y"))),
      );
    if (kind === "beam") {
      expect(before[0]).toBeCloseTo(51, 5);
      expect(before[1]).toBeCloseTo(37, 5);
    }
    await parameters(page);
    await expect(switcher).toBeChecked();
    await page
      .getByRole("button", {
        name: kind === "beam" ? /Force F2/ : /Charge 1 · N2/,
      })
      .click();
    const editor = page.getByRole("dialog");
    await editor
      .getByLabel(
        kind === "beam" ? "Force verticale Fy" : "Force horizontale Fx",
        {
          exact: true,
        },
      )
      .fill(kind === "beam" ? "80" : "30");
    await editor
      .getByRole("button", { name: "Appliquer", exact: true })
      .click();
    await expect(page.getByTestId("reaction")).toHaveCount(0);
    await expect(page.locator(".canvas-result-status")).toContainText(
      "Calcul non actualisé",
    );
    await parameters(page);
    await expect(switcher).not.toBeChecked();
    await page
      .getByRole("button", { name: "Revenir au schéma", exact: true })
      .click();
    await page.getByRole("button", { name: "Rotation", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Lancez d’abord le calcul",
    );
    await page.getByRole("button", { name: "Fermer", exact: true }).click();
    await calculate(page);
    await expect(page.getByTestId("reaction")).toHaveCount(2);
    const after = await page
      .getByTestId("reaction")
      .evaluateAll((els) =>
        els.map((e) => Number(e.getAttribute("data-reaction-y"))),
      );
    expect(after).not.toEqual(before);
    if (kind === "beam") {
      expect(after[0]).toBeCloseTo(66, 5);
      expect(after[1]).toBeCloseTo(62, 5);
    }
  });
  test(`${kind}: plot scenes contain only supports, thin axes and annotated fields`, async ({
    page,
  }) => {
    await page.goto(`/#/new/${kind}`);
    await createStudy(page);
    await calculate(page);
    const count = kind === "beam" ? 1 : 3;
    for (const [name, field] of [
      ["Moment M", "M"],
      ["Effort tranchant V", "V"],
      ["Effort normal N", "N"],
      ["Déformée", "v"],
      ["Rotation", "theta"],
    ]) {
      await page.getByRole("button", { name, exact: true }).click();
      await expect(page.getByTestId("diagram-curve")).toHaveCount(count);
      await expect(page.getByTestId("diagram-axis")).toHaveCount(count);
      await expect(page.getByTestId("diagram-axis").first()).toHaveAttribute(
        "stroke-width",
        "1.1",
      );
      await expect(page.getByTestId("diagram-fill")).toHaveCount(
        ["M", "V", "N"].includes(field) ? count : 0,
      );
      await expect(page.getByTestId("reaction")).toHaveCount(0);
      await expect(page.getByTestId("selection-highlight")).toHaveCount(0);
      await expect(
        page.getByTestId("playground").locator("[data-element]"),
      ).toHaveCount(0);
      await expect(page.locator("[data-support-type]")).toHaveCount(2);
      await expect(page.getByTestId("playground")).not.toContainText(
        kind === "beam" ? "S1 ·" : "B1",
      );
      await expect(page.getByTestId("playground")).not.toContainText("kN/m");
      const labels = page.getByTestId("diagram-value");
      expect(await labels.count()).toBeGreaterThanOrEqual(count * 2);
      await expect(
        labels.filter({
          hasText:
            field === "v"
              ? "mm"
              : field === "theta"
                ? "mrad"
                : field === "M"
                  ? "kN·m"
                  : "kN",
        }),
      ).toHaveCount(await labels.count());
      expect(
        await labels.evaluateAll((els) =>
          els.every((e) =>
            Number.isFinite(Number(e.getAttribute("data-value"))),
          ),
        ),
      ).toBe(true);
      await expect(
        page.locator('[data-testid="diagram-value"][data-endpoint="true"]'),
      ).toHaveCount(count * 2);
    }
    await page.getByRole("button", { name: "Structure", exact: true }).click();
    await expect(page.getByTestId("reaction")).toHaveCount(2);
    await expect(
      page.getByTestId("playground").locator("[data-element]"),
    ).not.toHaveCount(0);
  });
}
test("reinforced concrete design is named consistently and retains honest method descriptions", async ({
  page,
}) => {
  await page
    .getByRole("group", { name: "Filtrer les types de projets" })
    .getByRole("button", { name: "Dimensionnement Béton Armé", exact: true })
    .click();
  await expect(page.locator(".project-type-card")).toHaveCount(8);
  await expect(
    page.getByRole("heading", {
      name: "Dimensionnement Béton Armé",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".project-family")).toContainText(
    "Sections et dimensions de vos éléments en béton armé",
  );
  await expect(page.locator(".dashboard")).not.toContainText(
    "Prédimensionnement",
  );
  await page.goto("/#/new/beam-size");
  await createStudy(page);
  await expect(page.locator(".predim-illustration")).toContainText(
    "Dimensionnement Béton Armé",
  );
  await expect(page.getByTestId("predim-result")).toBeVisible();
  await expect(page.locator(".notice")).toContainText(
    "Le ferraillage et les vérifications réglementaires détaillées restent à effectuer",
  );
});
