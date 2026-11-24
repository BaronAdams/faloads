import { test, expect, type Page } from "@playwright/test";
import { createStudy, calculate, parameters, duplicateLevel } from "./helpers";
test.setTimeout(90000);

test.beforeEach(async ({ page }, info) => {
  await page.addInitScript((phone) => {
    Object.assign(window, {
      isTauri: true,
      __TAURI_INTERNALS__: {
        invoke: async (cmd: string, args: any) => {
          if (cmd === "desktop_menu_ready") return false;
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

test("The active storey owns the full grid in 2D and 3D, with a stable ribbon", async ({
  page,
}, info) => {
  await page.goto("/#/new/building");
  await createStudy(page);
  const header = page.getByTestId("project-workbench-header");
  await expect(
    header.getByRole("group", { name: "Modèle", exact: true }),
  ).toHaveCount(0);
  await expect(
    header.getByRole("group", { name: "Niveau actif · RDC", exact: true }),
  ).toBeVisible();
  await expect(header.getByLabel("X · travée 1", { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByRole("button", { name: "Grille du niveau actif", exact: true })
    .click();
  const grid = page.getByRole("dialog", { name: "Grille · RDC", exact: true });
  await expect(grid.getByLabel("X · travée 3", { exact: true })).toBeVisible();
  await expect(grid.getByLabel("Y · travée 2", { exact: true })).toBeVisible();
  await grid.getByLabel("X · travée 2", { exact: true }).fill("6,5");
  await grid
    .getByRole("button", { name: "Revenir au schéma", exact: true })
    .click();
  await duplicateLevel(page);
  await expect(
    header.getByRole("group", { name: "Niveau actif · R+1", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Grille du niveau actif", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("X · travée 2", { exact: true })
    .fill("7");
  await page
    .getByRole("button", { name: "Revenir au schéma", exact: true })
    .click();
  await header.getByRole("button", { name: "3D", exact: true }).click();
  const scene = page.getByTestId("building-3d");
  expect(
    await scene.locator('[data-active-floor="true"]').count(),
  ).toBeGreaterThan(0);
  expect(
    await scene.locator('[data-active-floor="false"]').count(),
  ).toBeGreaterThan(0);
  const upper = await scene
    .locator('[data-active-floor="true"]')
    .first()
    .getAttribute("data-floor");
  await page
    .getByRole("navigation", { name: "Niveaux du bâtiment" })
    .getByRole("button", { name: "RDC", exact: true })
    .click();
  await expect(
    scene.locator(`[data-floor="${upper}"]`).first(),
  ).toHaveAttribute("data-active-floor", "false");
  await page
    .getByRole("button", { name: "Grille du niveau actif", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("X · travée 2", { exact: true }),
  ).toHaveValue("6,5");
  await page
    .getByRole("button", { name: "Revenir au schéma", exact: true })
    .click();
  expect((await header.boundingBox())!.height).toBe(
    info.project.name === "desktop" ? 104 : 128,
  );
});

async function showAllAnnotations(page: Page) {
  await page
    .getByRole("button", { name: "Options de vue", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Annotations", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Tous les éléments", exact: true })
    .click();
}
test("3D keeps loads readable and can isolate one column or slab without hiding geometry", async ({
  page,
}) => {
  await page.goto("/#/new/building");
  await createStudy(page);
  await duplicateLevel(page);
  await page
    .getByRole("button", { name: "Calculer le bâtiment", exact: true })
    .click();
  await expect(page.getByTestId("building-cumulative")).toBeVisible();
  await page
    .getByRole("button", { name: "Fermer le panneau", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByTestId("project-workbench-header")
    .getByRole("button", { name: "3D", exact: true })
    .click();
  await showAllAnnotations(page);
  const scene = page.getByTestId("building-3d");
  await expect(scene.getByTestId("building-annotation")).not.toHaveCount(0);
  await expect(scene.locator(".building-annotation-layer")).not.toContainText(
    /Poutre|Poteau|Voile/,
  );
  const geometryCount = await scene.locator("[data-element]").count();
  const column = scene.locator(
    '[data-active-floor="true"][data-element*="|node|1,1"]',
  );
  const owner = await column.getAttribute("data-element");
  await column.press("Enter");
  await page
    .getByRole("button", {
      name: "Isoler les annotations de cet élément",
      exact: true,
    })
    .click();
  await expect(scene.getByTestId("building-annotation")).toHaveCount(1);
  await expect(scene.getByTestId("building-annotation")).toHaveAttribute(
    "data-building-element",
    owner!,
  );
  await expect(scene.getByTestId("building-annotation")).toContainText("kN");
  expect(await scene.locator("[data-element]").count()).toBe(geometryCount);
  const old = await scene.getByTestId("building-annotation").textContent();
  await page
    .getByRole("combobox", { name: "Cas de charges", exact: true })
    .click();
  await page.getByRole("option", { name: "G", exact: true }).click();
  await expect(scene.getByTestId("building-annotation")).not.toHaveText(old!);
  const slab = scene.locator(
    '[data-active-floor="true"][data-element*="|panel|0,0"]',
  );
  const slabOwner = await slab.getAttribute("data-element");
  await slab.press("Enter");
  await expect(scene.getByTestId("building-annotation")).toHaveCount(2);
  for (const label of await scene.getByTestId("building-annotation").all())
    await expect(label).toHaveAttribute("data-building-element", slabOwner!);
  await page
    .getByRole("button", { name: "Options de vue", exact: true })
    .click();
  await expect(
    page.getByRole("menuitemcheckbox", {
      name: "Annotations de l’élément sélectionné",
      exact: true,
    }),
  ).toBeChecked();
  await page
    .getByRole("menuitemcheckbox", {
      name: "Annotations de l’élément sélectionné",
      exact: true,
    })
    .click();
  await page.keyboard.press("Escape");
  expect(
    await scene.getByTestId("building-annotation").count(),
  ).toBeGreaterThan(2);
});

for (const kind of ["beam", "frame"] as const)
  test(`${kind}: prescribed translations and rotations draw their values, persist, and invalidate results`, async ({
    page,
  }, info) => {
    await page.goto(`/#/new/${kind}`);
    await createStudy(page);
    async function editSupport() {
      await parameters(page);
      await page
        .getByRole("button", {
          name: kind === "beam" ? /^Appui A / : /^N1 · Encastrement /,
        })
        .click();
      if (info.project.name === "desktop")
        await page
          .getByRole("button", { name: "Modifier la sélection", exact: true })
          .click();
    }
    await editSupport();
    const editor = page.getByRole("dialog");
    if (kind === "beam") {
      await editor
        .getByRole("combobox", { name: "Type d’appui", exact: true })
        .click();
      await page
        .getByRole("option", { name: "Encastrement", exact: true })
        .click();
    }
    await editor
      .getByLabel("Déplacement horizontal", { exact: true })
      .fill("4");
    await editor
      .getByLabel(
        kind === "beam" ? "Tassement vertical" : "Déplacement vertical",
        { exact: true },
      )
      .fill("-6");
    await editor.getByLabel("Rotation imposée", { exact: true }).fill("2");
    await editor
      .getByRole("button", { name: "Appliquer", exact: true })
      .click();
    await expect(page.getByTestId("imposed-x")).toHaveAttribute(
      "data-value",
      "0.004",
    );
    await expect(page.getByTestId("imposed-y")).toHaveAttribute(
      "data-value",
      "-0.006",
    );
    await expect(page.getByTestId("imposed-rotation")).toContainText(
      "2,00 mrad",
    );
    const labels = await page
      .getByTestId("support-motion")
      .locator("text")
      .evaluateAll((texts) =>
        texts.map((el) => {
          const box = el.getBoundingClientRect();
          return {
            x: box.x,
            right: box.right,
            size: getComputedStyle(el).fontSize,
          };
        }),
      );
    for (const label of labels) {
      expect(label.size).toBe("11px");
      expect(label.x).toBeGreaterThanOrEqual(0);
      expect(label.right).toBeLessThanOrEqual(
        (await page.viewportSize())!.width,
      );
    }
    for (let i = 1; i < labels.length; i++)
      expect(labels[i].x).toBeGreaterThan(labels[i - 1].right);
    const arrow = page.getByTestId("imposed-y").locator("line");
    const y1 = Number(await arrow.getAttribute("y1")),
      y2 = Number(await arrow.getAttribute("y2"));
    expect(kind === "beam" ? y2 < y1 : y2 > y1).toBe(true);
    await page
      .getByRole("button", { name: "Options de vue", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "Annotations", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "Appuis", exact: true }).click();
    const motionToggle = page.getByRole("menuitemcheckbox", {
      name: "Déplacements imposés",
      exact: true,
    });
    await motionToggle.click();
    await expect(page.getByTestId("support-motion")).toBeHidden();
    await motionToggle.click();
    await expect(page.getByTestId("support-motion")).toBeVisible();
    await page.keyboard.press("Escape");
    await calculate(page);
    await expect(page.getByTestId("reaction")).toHaveCount(2);
    await page.getByRole("button", { name: "Moment M", exact: true }).click();
    await expect(page.getByTestId("support-motion")).toHaveCount(0);
    await expect(page.getByTestId("diagram-curve")).not.toHaveCount(0);
    await page.getByRole("button", { name: "Structure", exact: true }).click();
    await expect(page.getByTestId("imposed-rotation")).toBeVisible();
    await editSupport();
    await editor.getByLabel("Rotation imposée", { exact: true }).fill("-3");
    await editor
      .getByRole("button", { name: "Appliquer", exact: true })
      .click();
    await expect(page.getByTestId("reaction")).toHaveCount(0);
    await expect(page.locator(".canvas-result-status")).toContainText(
      "Calcul non actualisé",
    );
    await page.getByRole("button", { name: "Rotation", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Lancez d’abord le calcul",
    );
    await page.getByRole("button", { name: "Fermer", exact: true }).click();
    await page
      .getByRole("button", { name: "Enregistrer", exact: true })
      .click();
    await expect(page).toHaveURL(/project\//);
    await page.reload();
    await expect(page.getByTestId("imposed-rotation")).toHaveAttribute(
      "data-value",
      "-0.003",
    );
  });

test("The first building guide leads through its complete active-floor grid", async ({
  page,
}, info) => {
  await page.goto("/#/new/building");
  await createStudy(page, "Premier bâtiment", false);
  const coach = page.locator(".guide-coach");
  if (info.project.name === "desktop") {
    await expect(coach).toContainText("Définissez le niveau actif");
    await page
      .getByRole("button", { name: "Grille du niveau actif", exact: true })
      .click();
  } else {
    await expect(coach).toContainText("Définissez le bâtiment");
    await parameters(page);
  }
  await expect(coach).toContainText("Adaptez votre trame");
  await page
    .getByRole("dialog")
    .getByLabel("X · travée 1", { exact: true })
    .fill("4,5");
  await expect(coach).toContainText(
    info.project.name === "desktop"
      ? "Revenez à la structure"
      : "Revenez au plan",
  );
  await page
    .getByRole("button", { name: "Revenir au schéma", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(coach).toContainText("Calculez le bâtiment");
});
