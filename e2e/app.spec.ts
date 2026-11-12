import { test, expect, type Page } from "@playwright/test";
const ready = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Passer la présentation" }).click();
  await expect(
    page.getByRole("heading", { name: "Vos calculs de structure" }),
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

test("pinch and touch pan move the camera without opening an element editor", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "mobile",
    "Touch input is checked in the mobile browser project.",
  );
  await ready(page);
  await page.goto("/#/new/beam");
  await page.getByRole("tab", { name: "Schéma", exact: true }).click();
  const canvas = page.getByTestId("playground");
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: x - 40, y, id: 1 },
      { x: x + 40, y, id: 2 },
    ],
  });
  for (let i = 1; i <= 6; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: x - 40 - 5 * i, y, id: 1 },
        { x: x + 40 + 5 * i, y, id: 2 },
      ],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page.getByTestId("zoom-level")).toHaveText("175 %");
  const previous = await page.getByTestId("camera").getAttribute("transform");
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, id: 1 }],
  });
  for (let i = 1; i <= 6; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + i * 5, y: y + i * 3, id: 1 }],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page.getByTestId("camera")).not.toHaveAttribute(
    "transform",
    previous!,
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("onboarding demonstrates a real calculation and retains it between steps", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Calculez vos structures" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Voir un calcul", exact: true })
    .click();
  await expect(page.getByTestId("onboarding-moment")).toContainText("75,60");
  await page.getByLabel("Portée de l’exemple", { exact: true }).fill("4");
  await expect(page.getByTestId("onboarding-moment")).toContainText("33,60");
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await expect(
    page.getByText("StructCalc-projet.json", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".export-document-title")).toContainText("4,00 m");
  await page.getByRole("button", { name: "Retour", exact: true }).click();
  await expect(
    page.getByLabel("Portée de l’exemple", { exact: true }),
  ).toHaveValue("4");
  await page
    .getByRole("button", { name: "Présentation 3 — Conserver" })
    .click();
  await page
    .getByRole("button", { name: "Accéder aux calculs", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Vos calculs de structure" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".onboarding")).toHaveCount(0);
});

test("dashboard family filters, search reset and project picker work together", async ({
  page,
}) => {
  await ready(page);
  const filters = page.getByRole("group", {
    name: "Filtrer les types de projets",
  });
  await filters
    .getByRole("button", { name: "Descente de charges", exact: true })
    .click();
  await expect(page.locator(".project-type-card")).toHaveCount(3);
  const search = page.getByRole("textbox", {
    name: "Rechercher un type de projet",
  });
  await search.fill("poteau");
  await expect(page.locator(".project-type-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Effacer la recherche" }).click();
  await expect(page.locator(".project-type-card")).toHaveCount(3);
  await page.keyboard.press("Control+k");
  await expect(search).toBeFocused();
  await search.fill("semelle");
  await expect(
    page.getByRole("heading", { name: "Aucun type de projet trouvé" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Réinitialiser les filtres" }).click();
  await expect(page.locator(".project-type-card")).toHaveCount(13);
  await page
    .getByRole("button", { name: "Nouveau projet", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Semelle de fondation/ })
    .click();
  await expect(page).toHaveURL(/new\/footing/);
});

test("dashboard resumes real projects in date order and displays their actual count", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(async () => {
    const current = JSON.parse(
      localStorage.getItem("structcalc.workspace.v1")!,
    );
    const { beamPreset } = await import("/src/domain/analysis.ts");
    current.profile.name = "Bureau d’études";
    current.projects = [
      {
        id: "older-beam",
        name: "Poutre ancienne",
        type: "beam",
        updatedAt: "2026-11-01T10:00:00Z",
        data: beamPreset(),
      },
      {
        id: "recent-beam",
        name: "Poutre récente",
        type: "beam",
        updatedAt: "2026-11-12T10:00:00Z",
        data: beamPreset(),
      },
    ];
    localStorage.setItem("structcalc.workspace.v1", JSON.stringify(current));
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Vos calculs de structure" }),
  ).toBeVisible();
  await expect(page.locator(".dashboard-summary")).toContainText(
    "2 projets enregistrés",
  );
  await expect(page.locator(".recent-project").first()).toContainText(
    "Poutre récente",
  );
  await page.locator(".recent-project").first().click();
  await expect(page.getByLabel("Nom du projet")).toHaveValue("Poutre récente");
});

test("onboarding and catalogue remain usable at 320 pixels", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  for (const label of [
    "Présentation 1 — Choisir",
    "Présentation 2 — Paramétrer",
    "Présentation 3 — Conserver",
  ]) {
    await page.getByRole("button", { name: label }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Passer la présentation" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  for (const card of await page.locator(".project-type-card").all()) {
    const box = (await card.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(321);
  }
});
