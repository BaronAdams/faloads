import { test, expect, type Page } from "@playwright/test";

async function native(page: Page, mobile: boolean) {
  await page.addInitScript((phone) => {
    // Exercise the native layout using the real IPC boundary, with storage
    // isolated in this browser context. Windows CI also tests the real EXE.
    Object.assign(window, {
      isTauri: true,
      __TAURI_INTERNALS__: {
        invoke: async (command: string, args: Record<string, unknown>) => {
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
    });
    if (phone)
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Mobile",
      });
  }, mobile);
}
async function ready(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Passer la présentation" }).click();
  await expect(
    page.getByRole("heading", { name: "Vos calculs de structure" }),
  ).toBeVisible();
}
test.beforeEach(({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("native desktop has its own workbench while the browser keeps its sidebar", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Native desktop only");
  await ready(page);
  await expect(page.locator("html")).toHaveAttribute("data-runtime", "web");
  expect(
    (await page.locator(".app-sidebar").boundingBox())!.width,
  ).toBeGreaterThan(200);
  await native(page, false);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-runtime", "desktop");
  await expect(page.locator(".desktop-commandbar")).toBeVisible();
  expect((await page.locator(".app-sidebar").boundingBox())!.width).toBe(76);
  await page.goto("/#/new/beam");
  const scene = (await page.locator(".scene-area").boundingBox())!;
  const results = (await page.locator(".results-area").boundingBox())!;
  expect(results.x).toBeGreaterThan(scene.x + scene.width);
  await page.getByRole("button", { name: /Force F2/ }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toHaveAttribute("data-editor-side", "left");
  await expect
    .poll(async () => Math.round((await sheet.boundingBox())!.x))
    .toBe(0);
  await sheet.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(page.getByTestId("selection-highlight")).toBeVisible();
  expect(
    await page
      .getByTestId("selection-highlight")
      .evaluate((el) => getComputedStyle(el).fillOpacity),
  ).toBe("0.12");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    1440,
  );
});

test("mobile header respects the safe area while scrolling and uses a bottom editor", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile", "Phone layout only");
  await native(page, true);
  await ready(page);
  await page.evaluate(() =>
    document.documentElement.style.setProperty("--safe-top", "24px"),
  );
  await page.goto("/#/new/building");
  await page.getByTestId("playground").scrollIntoViewIfNeeded();
  await expect
    .poll(async () =>
      Math.round((await page.locator(".mobile-app-header").boundingBox())!.y),
    )
    .toBe(24);
  await page
    .getByTestId("playground")
    .locator('[data-element="node|1,1"]')
    .locator("rect")
    .click({ force: true });
  const sheet = page.getByRole("dialog");
  await expect(sheet).toHaveAttribute("data-editor-side", "bottom");
  await sheet.getByLabel("Largeur b", { exact: true }).fill("35");
  // A shorter viewport models the space available while a software keyboard
  // is visible; the validation action must remain reachable.
  await page.setViewportSize({ width: 390, height: 480 });
  await expect
    .poll(async () => {
      const actionBox = (await sheet
        .getByRole("button", { name: "Appliquer", exact: true })
        .boundingBox())!;
      return actionBox.y + actionBox.height;
    })
    .toBeLessThanOrEqual(481);
  await sheet.getByRole("button", { name: "Appliquer", exact: true }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByTestId("selection-highlight")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Modifier l’élément", exact: true })
    .click();
  const grip = page.getByRole("button", {
    name: "Fermer le panneau en glissant",
  });
  await expect
    .poll(async () =>
      Math.round(
        (await page.getByRole("dialog").boundingBox())!.y +
          (await page.getByRole("dialog").boundingBox())!.height,
      ),
    )
    .toBe(844);
  const handle = (await grip.boundingBox())!;
  await page.mouse.move(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2 + 100,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("beam and frame vertical springs render, retain stiffness and change actual results", async ({
  page,
}, info) => {
  await ready(page);
  await page.goto("/#/new/beam");
  await page.getByRole("button", { name: /Appui B/ }).click();
  let sheet = page.getByRole("dialog");
  await sheet.getByLabel("Type d’appui", { exact: true }).click();
  await page
    .getByRole("option", { name: "Ressort vertical", exact: true })
    .click();
  await sheet.getByLabel("Raideur verticale kᵧ").fill("2000");
  await sheet.getByRole("button", { name: "Appliquer", exact: true }).click();
  if (info.project.name === "mobile")
    await page.getByRole("tab", { name: "Schéma", exact: true }).click();
  await expect(page.locator('[data-support-type="spring"]')).toHaveCount(1);
  await expect(page.getByTestId("selection-highlight")).toBeVisible();
  await page.goto("/#/new/frame");
  await page.getByRole("button", { name: /N1 · Encastrement/ }).click();
  sheet = page.getByRole("dialog");
  await sheet.getByLabel("Liaison au sol").click();
  await page
    .getByRole("option", { name: "Ressort vertical", exact: true })
    .click();
  await sheet.getByLabel("Raideur verticale kᵧ").fill("5000");
  await sheet.getByRole("button", { name: "Appliquer", exact: true }).click();
  if (info.project.name === "mobile")
    await page.getByRole("tab", { name: "Schéma", exact: true }).click();
  await expect(page.locator('[data-support-type="spring"]')).toHaveCount(1);
  if (info.project.name === "mobile")
    await page.getByRole("tab", { name: "Résultats", exact: true }).click();
  await expect(page.locator(".metric").last()).toContainText("Vérifié");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: /N1 · Ressort vertical/ }).click();
  await expect(
    page.getByRole("dialog").getByLabel("Raideur verticale kᵧ"),
  ).toHaveValue("5000");
});

test("each internal force, displacement and rotation has its own consistent colour", async ({
  page,
}, info) => {
  await ready(page);
  await page.goto("/#/new/beam");
  if (info.project.name === "mobile")
    await page.getByRole("tab", { name: "Résultats", exact: true }).click();
  const colours = [];
  for (const name of [
    "Moment M",
    "Effort tranchant V",
    "Effort normal N",
    "Déformée",
    "Rotation",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    const curve = page.getByTestId("diagram-curve");
    await expect(page.locator(".diagram-caption strong")).toHaveText(name);
    // A zero axial-force curve is a horizontal SVG path: its DOM bounding
    // box has zero height even though the coloured stroke is rendered.
    await expect(page.locator(".diagram > svg")).toBeVisible();
    colours.push(await curve.evaluate((el) => getComputedStyle(el).stroke));
  }
  expect(new Set(colours).size).toBe(5);
});

test("load descent profiles and graphs reflect validated level edits, not cancelled changes", async ({
  page,
}) => {
  await ready(page);
  await page.goto("/#/new/wall-load");
  await page.getByRole("button", { name: "Suivant", exact: true }).click();
  await expect(page.getByTestId("playground")).toContainText("6,00 m²");
  await page.getByRole("button", { name: "Suivant", exact: true }).click();
  await page
    .locator(".level-summary")
    .first()
    .getByRole("button", { name: /Modifier le niveau/ })
    .click();
  let sheet = page.getByRole("dialog");
  await sheet.getByLabel("Hauteur d’étage").fill("4");
  await sheet.getByRole("button", { name: "Appliquer", exact: true }).click();
  await expect(page.getByTestId("descent-profile")).toContainText("4,00 m");
  await page
    .locator(".level-summary")
    .first()
    .getByRole("button", { name: /Modifier le niveau/ })
    .click();
  sheet = page.getByRole("dialog");
  await sheet.getByLabel("Hauteur d’étage").fill("9");
  await sheet.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(page.getByTestId("descent-profile")).not.toContainText("9,00 m");
  await page.getByRole("button", { name: "Suivant", exact: true }).click();
  await page
    .getByRole("button", { name: "Calculer les efforts", exact: true })
    .click();
  await expect(page.getByTestId("load-evolution-chart")).toBeVisible();
  await expect(page.getByTestId("descent-profile")).toContainText("4,00 m");
});

test("building influence selection highlights only real contributors without opening an editor in results", async ({
  page,
}) => {
  await ready(page);
  await page.goto("/#/new/building");
  await page.getByRole("tab", { name: "Résultats", exact: true }).click();
  const canvas = page.getByTestId("playground");
  await canvas
    .locator('[data-element="edge|h:0:0"]')
    .locator("line")
    .last()
    .click({ force: true });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator('[data-influence-active="true"]')).toHaveCount(1);
  await expect(page.getByTestId("selection-highlight")).toBeVisible();
  await canvas
    .locator('[data-element="node|1,1"]')
    .locator("rect")
    .click({ force: true });
  await expect(page.getByTestId("node-influence")).toHaveCount(4);
  await expect(page.getByTestId("selected-building-result")).toContainText(
    "Poteau 2B",
  );
  // The frame surrounds the node itself, rather than its result annotation.
  expect(
    (await page.getByTestId("selection-highlight").boundingBox())!.width,
  ).toBeLessThan(35);
  await page
    .getByRole("button", { name: "Modifier l’élément", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("switch").click();
  await page.getByRole("button", { name: "Appliquer", exact: true }).click();
  await expect(page.getByTestId("node-influence")).toHaveCount(0);
});
