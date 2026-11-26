import { test, expect, type Page } from "@playwright/test";
import { duplicateLevel, createStudy } from "./helpers";
async function native(page: Page) {
  await page.addInitScript(() =>
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
    }),
  );
}
async function saved(page: Page) {
  const previous = page.url().includes("/new/")
    ? await page.getByTestId("playground").elementHandle()
    : null;
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page).toHaveURL(/project\//);
  if (previous)
    await expect
      .poll(() => previous.evaluate((el) => el.isConnected))
      .toBe(false);
  await expect(page.getByTestId("playground")).toBeVisible();
  return page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("structcalc.workspace.v1")!).projects[0]
        .data,
  );
}
async function clickLine(page: Page, line: import("@playwright/test").Locator) {
  const b = (await line.boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}
async function canvasFocus(page: Page) {
  await expect(page.getByRole("listbox")).toHaveCount(0);
  const canvas = page.getByTestId("playground");
  await expect
    .poll(async () => {
      await canvas.focus();
      return canvas.evaluate((el) => document.activeElement === el);
    })
    .toBe(true);
}
test.beforeEach(async ({ page }, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Native pointer and keyboard interactions",
  );
  page.on("pageerror", (e) => {
    throw e;
  });
  await native(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Passer la présentation" }).click();
});
test("asks for a name before navigation and preserves editable text controls", async ({
  page,
}) => {
  await page.locator('a[href="#/new/beam"]').click();
  await expect(page).not.toHaveURL(/new\/beam/);
  await expect(page.getByTestId("playground")).toHaveCount(0);
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(page).not.toHaveURL(/new\/beam/);
  await page.locator('a[href="#/new/beam"]').click();
  await page
    .getByLabel("Nom du projet", { exact: true })
    .fill("Étude avant navigation");
  await page.getByLabel("Nom du projet", { exact: true }).press("Enter");
  await page
    .getByRole("button", { name: "Explorer librement", exact: true })
    .click();
  await expect(page).toHaveURL(/project\//);
  expect(
    await page.locator("h1").evaluate((e) => getComputedStyle(e).userSelect),
  ).toBe("none");
  const input = page.getByLabel("Longueur L", { exact: true });
  expect(await input.evaluate((e) => getComputedStyle(e).userSelect)).toBe(
    "text",
  );
  await input.focus();
  await page.keyboard.press("Control+a");
  await expect(input).toHaveJSProperty("selectionStart", 0);
  expect(
    await page
      .locator("h1")
      .evaluate(
        (e) =>
          !e.dispatchEvent(
            new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
          ),
      ),
  ).toBe(true);
});
test("edits a beam in the header, opens a professional context menu, and drags its force with the left button", async ({
  page,
}) => {
  await page.goto("/#/new/beam");
  await createStudy(page);
  const force = page
    .locator('[data-element^="load:"]')
    .last()
    .locator("rect")
    .first();
  await force.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page
      .getByTestId("project-workbench-header")
      .getByLabel("Force verticale Fy", { exact: true }),
  ).toBeVisible();
  expect(
    (await page.getByTestId("project-workbench-header").boundingBox())!.height,
  ).toBeLessThan(150);
  await page.getByLabel("Force verticale Fy", { exact: true }).fill("60");
  await force.click({ button: "right" });
  await expect(
    page.getByRole("menuitem", { name: /Copier les propriétés/ }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  const before = Number(
    (await page.getByLabel("Position x", { exact: true }).inputValue()).replace(
      ",",
      ".",
    ),
  );
  const rect = (await force.boundingBox())!;
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down({ button: "left" });
  await page.mouse.move(
    rect.x + rect.width / 2 + 100,
    rect.y + rect.height / 2,
    { steps: 8 },
  );
  await page.mouse.up({ button: "left" });
  await expect(page.getByRole("menu")).toHaveCount(0);
  const after = Number(
    (await page.getByLabel("Position x", { exact: true }).inputValue()).replace(
      ",",
      ".",
    ),
  );
  expect(after).toBeGreaterThan(before + 0.4);
  // Drag a support after zooming: coordinate conversion must follow the camera.
  await page
    .getByRole("button", { name: "Réduire le zoom", exact: true })
    .click();
  const support = page
    .locator('[data-element^="support:"]')
    .first()
    .locator("rect");
  const sb = (await support.boundingBox())!;
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down({ button: "left" });
  await page.mouse.move(sb.x + sb.width / 2 + 100, sb.y + sb.height / 2, {
    steps: 8,
  });
  await page.mouse.up({ button: "left" });
  expect(
    Number(
      (
        await page.getByLabel("Position x", { exact: true }).inputValue()
      ).replace(",", "."),
    ),
  ).toBeGreaterThan(0.3);
  await canvasFocus(page);
  await page.keyboard.press("Control+z");
  const model = await saved(page);
  expect(model.supports[0].x).toBe(0);
  expect(model.loads[1].Fy).toBe(60);
  expect(model.loads[1].x).toBeGreaterThan(5.4);
});
test("supports select-all by nature, Shift exclusion, batch property paste and undo in the building", async ({
  page,
}) => {
  await page.goto("/#/new/building");
  await createStudy(page);
  const edge = (key: string) =>
    page.locator(`[data-element="edge|${key}"]`).locator("line").last();
  await clickLine(page, edge("h:0:0"));
  await page.getByLabel("Largeur b", { exact: true }).fill("35");
  await canvasFocus(page);
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+a");
  await expect(page.getByTestId("selection-highlight")).toHaveCount(17);
  await page.keyboard.down("Shift");
  await clickLine(page, edge("h:0:1"));
  await page.keyboard.up("Shift");
  await expect(page.getByTestId("selection-highlight")).toHaveCount(16);
  await canvasFocus(page);
  await page.keyboard.press("Control+v");
  let model = await saved(page);
  expect(model.floors[0].edges["h:0:1"].b).toBe(25);
  expect(
    Object.values(model.floors[0].edges).filter((e: any) => e.b === 35),
  ).toHaveLength(16);
  // Saved study remounts. Select all columns, change together, undo and verify the restored sections.
  const node = page.locator('[data-element="node|1,1"]').locator("rect");
  await node.click();
  await canvasFocus(page);
  await page.keyboard.press("Control+a");
  await expect(page.getByTestId("selection-highlight")).toHaveCount(12);
  await page.getByLabel("Largeur b", { exact: true }).fill("40");
  await canvasFocus(page);
  await page.keyboard.press("Control+z");
  await node.click();
  await expect(page.getByLabel("Largeur b", { exact: true })).toHaveValue("25");
});
test("cumulates from roof to ground, displays 3D load cases and selects the critical column", async ({
  page,
}) => {
  await page.goto("/#/new/building");
  await createStudy(page);
  await duplicateLevel(page);
  await duplicateLevel(page);
  await page
    .getByRole("button", { name: "Calculer le bâtiment", exact: true })
    .click();
  const table = page.getByTestId("building-cumulative");
  await expect(table).toBeVisible();
  expect(
    (await page
      .getByRole("dialog", { name: "Résultats du bâtiment" })
      .boundingBox())!.width,
  ).toBeGreaterThan(750);
  const rows = table.locator("tbody tr");
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText("R+2");
  await expect(rows.last()).toContainText("RDC");
  await expect(rows.last()).toContainText("1 499,55");
  await page
    .getByRole("button", {
      name: /^(Revenir au schéma|Valider les paramètres|Valider la grille)$/,
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Poteau le plus chargé", exact: true })
    .click();
  await expect(page.getByTestId("building-3d")).toBeVisible();
  await expect(page.locator(".critical-element")).toContainText("RDC");
  await page
    .getByRole("combobox", { name: "Cas de charges", exact: true })
    .click();
  await page.getByRole("option", { name: "Q", exact: true }).click();
  await page
    .getByRole("button", { name: "Poutre la plus chargée", exact: true })
    .click();
  await expect(page.locator(".critical-element")).toContainText("Q ·");
  await page.getByLabel("Largeur b", { exact: true }).fill("40");
  await expect(page.locator(".canvas-result-status")).toContainText(
    "Calcul non actualisé",
  );
  await expect(page.locator(".critical-element")).toHaveCount(0);
});
test("keeps section libraries inside each study and supports point forces on frame members", async ({
  page,
}) => {
  await page.goto("/#/new/frame");
  await createStudy(page);
  await page
    .getByRole("button", { name: "Dimensions types du projet" })
    .click();
  await page
    .getByRole("button", { name: "Ajouter une dimension type" })
    .click();
  await page
    .locator('.section-type-row input[id^="section-name-"]')
    .fill("Section privée 25 × 40");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Force sur une barre", exact: true })
    .click();
  await expect(
    page.getByLabel("Position sur la barre", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Position sur la barre", { exact: true }).fill("30");
  const loadHandle = page
    .locator('[data-element^="member-load:"]')
    .locator("circle");
  await page.getByLabel("Position sur la barre", { exact: true }).press("Tab");
  await loadHandle.hover();
  const hit = (await loadHandle.boundingBox())!;
  await page.mouse.move(hit.x + hit.width / 2, hit.y + hit.height / 2);
  await page.mouse.down({ button: "left" });
  await page.mouse.move(hit.x + hit.width / 2, hit.y + hit.height / 2 - 65, {
    steps: 8,
  });
  await page.mouse.up({ button: "left" });
  await expect
    .poll(async () =>
      Number(
        (
          await page
            .getByLabel("Position sur la barre", { exact: true })
            .inputValue()
        ).replace(",", "."),
      ),
    )
    .toBeGreaterThan(40);
  const moved = Number(
    (
      await page
        .getByLabel("Position sur la barre", { exact: true })
        .inputValue()
    ).replace(",", "."),
  );
  expect(moved).toBeGreaterThan(40);
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.getByRole("button", { name: "Calculer", exact: true }).click();
  await expect(page.locator(".canvas-result-status")).toContainText(
    "Calcul actualisé",
  );
  const model = await saved(page);
  expect(model.pl[0].t).toBeCloseTo(moved / 100, 3);
  expect(model.sectionTypes.at(-1).name).toBe("Section privée 25 × 40");
  await page.goto("/#/new/beam");
  await createStudy(page, "Autre étude", true);
  await page
    .getByRole("button", { name: "Dimensions types du projet" })
    .click();
  await expect(page.locator(".section-type-row")).toHaveCount(1);
  await page.getByLabel("Dimension à modifier", { exact: true }).click();
  await expect(
    page.getByRole("option", { name: "Section privée 25 × 40", exact: true }),
  ).toHaveCount(0);
});

test("changes slab thickness in bulk without overwriting individual live loads", async ({
  page,
}) => {
  await page.goto("/#/new/building");
  await createStudy(page);
  const slab = (key: string) =>
    page.locator(`[data-element="panel|${key}"]`).locator("rect").first();
  await slab("0,0").click();
  await expect(
    page
      .getByTestId("project-workbench-header")
      .getByLabel("Épaisseur", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Type de plancher actuel")).toHaveText("16+4");
  await page.getByLabel("Exploitation Q", { exact: true }).fill("4");
  await slab("1,0").click();
  await page
    .getByRole("button", { name: "Modifier la sélection", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Type de plancher", exact: true })
    .click();
  await page.getByRole("option", { name: "Dalle pleine", exact: true }).click();
  await expect(page.locator('[role="listbox"]')).toHaveCount(0);
  await page.locator('[role="dialog"]').press("Escape");
  await expect(page.locator('[role="dialog"]')).toHaveCount(0);
  await canvasFocus(page);
  await page.keyboard.press("Control+a");
  await expect(page.getByTestId("selection-highlight")).toHaveCount(6);
  await page.getByLabel("Épaisseur", { exact: true }).fill("22");
  const model = await saved(page);
  expect(model.floors[0].panels["0,0"].level.q).toBe(4);
  expect(model.floors[0].panels["1,0"].level.q).toBe(1.5);
  expect(
    Object.values(model.floors[0].panels).every(
      (p: any) => p.level.thickness === 0.22,
    ),
  ).toBe(true);
});

test("keeps the native first-use guide on the active parameter dialog", async ({
  page,
}) => {
  await page.goto("/#/new/beam");
  await createStudy(page, "Guide Desktop", false);
  await page
    .getByRole("button", { name: "Ouvrir les paramètres", exact: true })
    .click();
  await expect(page.locator(".guide-coach")).toContainText(
    "Adaptez la géométrie",
  );
  const field = page
    .getByRole("dialog")
    .getByRole("combobox", { name: "Modèle prédéfini", exact: true });
  await expect(field).toBeVisible();
  await expect
    .poll(async () => {
      const spot = (await page.locator(".guide-spotlight").boundingBox())!;
      const f = (await field.boundingBox())!;
      return Math.abs(spot.x - (f.x - 5));
    })
    .toBeLessThan(2);
  await page
    .getByRole("dialog")
    .getByLabel("Longueur L", { exact: true })
    .fill("9");
  await expect(page.locator(".guide-coach")).toContainText("Revenez au schéma");
});
