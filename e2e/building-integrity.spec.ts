import { test, expect } from "@playwright/test";
import { createStudy, duplicateLevel } from "./helpers";
test.beforeEach(async ({ page }, info) => {
  await page.addInitScript((phone) => {
    Object.assign(window, {
      isTauri: true,
      __TAURI_EVENT_PLUGIN_INTERNALS__: { unregisterListener: () => {} },
      __TAURI_INTERNALS__: {
        transformCallback: () => 1,
        unregisterCallback: () => {},
        invoke: async (cmd: string, args: any) => {
          if (cmd === "desktop_menu_ready") return false;
          if (cmd === "plugin:event|listen") return 1;
          if (cmd === "read_workspace")
            return JSON.parse(
              localStorage.getItem("structcalc.workspace.v1") ?? "null",
            );
          if (cmd === "write_workspace")
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
        value: "Mozilla/5.0 (Linux; Android 15) Mobile",
      });
  }, info.project.name === "mobile");
  page.on("pageerror", (e) => {
    throw e;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Passer la présentation" }).click();
});
test("building view menu only shows controls that apply to the current view", async ({
  page,
}) => {
  await page.goto("/#/new/building");
  await createStudy(page);
  await page
    .getByRole("button", { name: "Options de vue", exact: true })
    .click();
  await expect(
    page.getByRole("menuitemcheckbox", {
      name: "Surfaces d’influence",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "Rotation 3D", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("menuitemcheckbox", {
      name: "Tous les niveaux",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page
    .getByTestId("project-workbench-header")
    .getByRole("button", { name: "3D", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Options de vue", exact: true })
    .click();
  await expect(
    page.getByRole("menuitemcheckbox", {
      name: "Surfaces d’influence",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("menuitem", { name: "Annotations", exact: true })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Toiture", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Poteaux", exact: true }).click();
  await expect(
    page.getByRole("menuitemcheckbox", { name: "Valeurs", exact: true }).last(),
  ).toBeVisible();
  await expect(
    page.getByRole("menuitemcheckbox", { name: /Repères/ }),
  ).toHaveCount(0);
});
test("building numeric values and units have separate visible space in the fixed ribbon", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Inline section fields are Desktop controls",
  );
  await page.goto("/#/new/building");
  await createStudy(page);
  const header = page.getByTestId("project-workbench-header"),
    height = (await header.boundingBox())!.height;
  await page.locator('[data-element="node|1,1"] rect').click();
  const field = header.getByLabel("Largeur b", { exact: true });
  await field.fill("123,4");
  await field.press("Tab");
  const space = await field.evaluate((input) => {
    const style = getComputedStyle(input),
      context = document.createElement("canvas").getContext("2d")!;
    context.font = style.font;
    return {
      available:
        input.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight),
      text: context.measureText((input as HTMLInputElement).value).width,
      inputRight: input.getBoundingClientRect().right,
      unitLeft: input.nextElementSibling!.getBoundingClientRect().left,
    };
  });
  expect(space.available).toBeGreaterThanOrEqual(space.text);
  expect(space.inputRight).toBeLessThanOrEqual(space.unitLeft + 1);
  expect((await header.boundingBox())!.height).toBe(height);
});
test("column results expose local and upper contributions at every storey", async ({
  page,
}) => {
  await page.goto("/#/new/building");
  await createStudy(page);
  await duplicateLevel(page);
  await page
    .getByRole("button", { name: "Calculer le bâtiment", exact: true })
    .click();
  const table = page.getByTestId("column-cumulative");
  await expect(table).toBeVisible();
  const rows = table.locator("tbody tr");
  await expect(rows).toHaveCount(24);
  const top = rows.first(),
    bottom = rows.nth(12);
  const numeric = async (row: typeof top, index: number) =>
    Number(
      (await row.locator("td").nth(index).innerText())
        .replace(/\s/g, "")
        .replace(",", "."),
    );
  expect(await numeric(top, 2)).toBe(0);
  expect(await numeric(bottom, 2)).toBeCloseTo(await numeric(top, 1), 1);
  expect(await numeric(bottom, 3)).toBeCloseTo(2 * (await numeric(top, 1)), 1);
  await bottom.locator("summary").click();
  await expect(bottom.locator("details p")).toHaveCount(2);
});
test("invalid building connections are located before the calculation starts", async ({
  page,
}, info) => {
  await page.goto("/#/new/building");
  await createStudy(page);
  await page.locator('[data-element="node|0,0"] rect').click();
  if (info.project.name === "mobile") {
    const editor = page.getByRole("dialog", {
      name: "Poteau de la grille",
      exact: true,
    });
    await editor.getByRole("switch", { name: "Présent", exact: true }).click();
    await editor
      .getByRole("button", { name: "Appliquer", exact: true })
      .click();
  } else {
    await page.getByTestId("playground").focus();
    await page.keyboard.press("Delete");
  }
  await page
    .getByRole("button", { name: "Calculer le bâtiment", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Cohérence des liaisons du modèle",
  });
  await expect(dialog).toBeVisible();
  await expect(page.locator(".calculation-veil")).toHaveCount(0);
  await expect(dialog).toContainText("Appui de poutre absent");
  await dialog.getByRole("listitem").first().click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("selection-highlight")).toHaveCount(1);
});
test("level overrides drive the isolated column calculation and remain editable", async ({
  page,
}) => {
  await page.goto("/#/new/column-load");
  await createStudy(page);
  await page.getByRole("button", { name: "Suivant", exact: true }).click();
  await page.getByRole("button", { name: "Suivant", exact: true }).click();
  await page
    .locator(".level-summary")
    .getByRole("button", { name: "Modifier le niveau R+1", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Paramètres du niveau" });
  await dialog
    .getByRole("switch", { name: "Paramètres propres à cet étage" })
    .click();
  await dialog
    .getByLabel("Aire tributaire du niveau", { exact: true })
    .fill("12");
  await dialog
    .getByLabel("Poutres principales · b", { exact: true })
    .fill("20");
  await dialog
    .getByLabel("Poutres principales · h", { exact: true })
    .fill("30");
  await dialog
    .getByLabel("Poutres principales · longueur d’influence totale", {
      exact: true,
    })
    .fill("4");
  await dialog.getByRole("button", { name: "Appliquer", exact: true }).click();
  await page.getByRole("button", { name: "Suivant", exact: true }).click();
  await page
    .getByRole("button", { name: "Calculer les efforts", exact: true })
    .click();
  const row = page.getByRole("table").locator("tbody tr").first();
  await expect(row).toContainText("12,00");
  await expect(row.locator("td").nth(3)).toHaveText("6,00");
});
