import { test, expect, type Page } from "@playwright/test";
import { createStudy } from "./helpers";

async function native(page: Page, phone: boolean) {
  await page.addInitScript((mobile) => {
    Object.assign(window, {
      isTauri: true,
      __TAURI_EVENT_PLUGIN_INTERNALS__: { unregisterListener: () => {} },
      __TAURI_INTERNALS__: {
        transformCallback: () => 1,
        unregisterCallback: () => {},
        invoke: async (cmd: string, args: any) => {
          if (cmd === "desktop_menu_ready")
            return localStorage.getItem("preview.native-menu") === "true";
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
    if (mobile)
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (Linux; Android 15) Mobile",
      });
  }, phone);
}
test.beforeEach(async ({ page }, info) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await native(page, info.project.name === "mobile");
  await page.goto("/");
  await page.getByRole("button", { name: "Passer la présentation" }).click();
});
for (const type of ["beam", "frame", "building"] as const) {
  test(`${type}: one fixed header keeps the drawing stable through selection and detailed parameters`, async ({
    page,
  }, info) => {
    await page.goto(`/#/new/${type}`);
    await createStudy(page, "Résidence Horizon — structure du dernier niveau");
    const header = page.getByTestId("project-workbench-header"),
      canvas = page.getByTestId("playground");
    await expect(page.locator(".project-page > header")).toHaveCount(1);
    await expect(page.locator(".mobile-app-header")).not.toBeVisible();
    const before = (await header.boundingBox())!,
      drawing = (await canvas.boundingBox())!;
    expect(before.height).toBe(
      info.project.name === "desktop" ? 64 : type === "building" ? 108 : 56,
    );
    const target =
      type === "beam"
        ? canvas
            .locator('[data-element^="load:"]')
            .last()
            .locator("rect")
            .first()
        : type === "frame"
          ? canvas
              .locator('[data-element^="member:"]')
              .first()
              .locator("line")
              .last()
          : canvas.locator('[data-element="node|1,1"]').locator("rect");
    const b = (await target.boundingBox())!;
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    if (info.project.name === "mobile") {
      await expect(page.getByRole("dialog")).toHaveAttribute(
        "data-editor-side",
        "bottom",
      );
      await page.getByRole("button", { name: "Annuler", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    } else {
      await expect(
        header.getByLabel(
          type === "beam" ? "Force verticale Fy" : "Largeur b",
          { exact: true },
        ),
      ).toBeVisible();
    }
    expect((await header.boundingBox())!.height).toBe(before.height);
    expect((await canvas.boundingBox())!.y).toBe(drawing.y);
    await page
      .getByRole("button", { name: "Ouvrir les paramètres", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect((await header.boundingBox())!.height).toBe(before.height);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
test("the system menu leaves no empty web row and keeps the status bar below the drawing", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Native menu layout");
  await page.setViewportSize({ width: 1028, height: 730 });
  await page.evaluate(() =>
    localStorage.setItem("preview.native-menu", "true"),
  );
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-native-menu",
    "true",
  );
  await expect(page.locator(".desktop-menubar")).toHaveCount(0);
  await page.goto("/#/new/beam");
  await createStudy(page);
  const header = (await page
    .getByTestId("project-workbench-header")
    .boundingBox())!;
  const footer = (await page.locator(".desktop-statusbar").boundingBox())!;
  const canvas = (await page.getByTestId("playground").boundingBox())!;
  const save = (await page
    .getByRole("button", { name: "Enregistrer", exact: true })
    .boundingBox())!;
  expect(header.y).toBe(0);
  expect(header.height).toBe(64);
  expect(footer.height).toBe(28);
  expect(footer.y + footer.height).toBe(730);
  expect(canvas.y + canvas.height).toBeLessThanOrEqual(footer.y + 1);
  expect(save.x + save.width).toBeLessThanOrEqual(1028);
});
test("Desktop menus save the active project and control its drawing", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "No menu bar on a phone");
  const bar = page.getByRole("menubar", { name: "Menus de l’application" });
  await bar.getByRole("menuitem", { name: "Fichier", exact: true }).click();
  await expect(
    page.getByRole("menuitem", { name: "Enregistrer", exact: true }),
  ).toHaveAttribute("data-disabled", "");
  await page.keyboard.press("Escape");
  await page.goto("/#/new/beam");
  await createStudy(page, "Menus natifs");
  await bar.getByRole("menuitem", { name: "Affichage", exact: true }).click();
  await page.getByRole("menuitem", { name: "Agrandir", exact: true }).click();
  await expect(page.getByTestId("zoom-level")).toHaveText("120 %");
  await bar.getByRole("menuitem", { name: "Calcul", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Lancer le calcul", exact: true })
    .click();
  await expect(page.locator(".canvas-result-status")).toContainText(
    "Calcul actualisé",
  );
  await bar.getByRole("menuitem", { name: "Fichier", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Enregistrer", exact: true })
    .click();
  await expect(page).toHaveURL(/project\//);
  await page.reload();
  await expect(page.locator("h1")).toHaveText("Menus natifs");
  await bar.getByRole("menuitem", { name: "Fichier", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Nouveau projet…", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Nouveau projet", exact: true })
    .getByRole("button", { name: "Semelle de fondation", exact: true })
    .click();
  await expect(page).toHaveURL(/project\//);
  await expect(page.getByRole("dialog")).toContainText(
    "Comment s’appelle votre étude",
  );
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(page.locator("h1")).toHaveText("Menus natifs");
});
test("a narrow desktop scrolls long parameter groups without resizing the header or hiding Save", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Desktop ribbon");
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/#/new/beam");
  await createStudy(
    page,
    "Une étude avec un nom très long qui ne doit jamais élargir la fenêtre",
  );
  const header = page.getByTestId("project-workbench-header"),
    canvas = page.getByTestId("playground");
  const y = (await canvas.boundingBox())!.y;
  const load = canvas
    .locator('[data-element^="load:"]')
    .first()
    .locator("rect")
    .first();
  await load.click();
  await header.getByLabel("Intensité q₂", { exact: true }).fill("18");
  expect((await header.boundingBox())!.height).toBe(64);
  expect((await canvas.boundingBox())!.y).toBe(y);
  expect(
    await header
      .locator(".project-header-toolbar")
      .evaluate((el) => el.scrollWidth > el.clientWidth),
  ).toBe(true);
  await expect(
    header.getByRole("button", { name: "Enregistrer", exact: true }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await canvas
    .locator('[data-element^="support:"]')
    .first()
    .locator("rect")
    .click();
  await header
    .getByRole("combobox", { name: "Type d’appui", exact: true })
    .click();
  await page
    .getByRole("option", { name: "Ressort vertical", exact: true })
    .click();
  const stiffness = header.getByLabel("Raideur verticale kᵧ", { exact: true });
  await expect(stiffness).toBeVisible();
  const field = (await stiffness.boundingBox())!,
    bounds = (await header.boundingBox())!;
  expect(field.y + field.height).toBeLessThanOrEqual(bounds.y + bounds.height);
  expect(bounds.height).toBe(64);
});
test("the compact project menu opens project dimensions on a phone", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile", "Phone overflow actions");
  await page.goto("/#/new/beam");
  await createStudy(page);
  await page
    .getByRole("button", { name: "Autres actions du projet", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Dimensions types du projet", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", {
      name: "Dimensions types du projet",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    (await page.getByTestId("project-workbench-header").boundingBox())!.height,
  ).toBe(56);
});
test("3D mouse rotation stays independent from pan, zoom, selection and saved model data", async ({
  page,
}, info) => {
  await page.goto("/#/new/building");
  await createStudy(page);
  await page.getByRole("button", { name: "Dupliquer", exact: true }).click();
  await page
    .locator(".canvas-tools-left")
    .getByRole("button", { name: "3D", exact: true })
    .click();
  const scene = page.getByTestId("building-3d"),
    canvas = page.getByTestId("playground"),
    camera = page.getByTestId("camera");
  await expect(scene).toHaveAttribute("data-yaw", "35");
  const box = (await canvas.boundingBox())!,
    headerHeight = (await page
      .getByTestId("project-workbench-header")
      .boundingBox())!.height;
  const x = box.x + box.width * 0.45,
    y = box.y + box.height * 0.62;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 70, y + 30, { steps: 10 });
  await page.mouse.up();
  await expect(scene).not.toHaveAttribute("data-yaw", "35");
  await expect(scene).not.toHaveAttribute("data-pitch", "28");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const angle = await scene.getAttribute("data-yaw"),
    position = await camera.getAttribute("transform");
  await page.getByRole("button", { name: "Déplacer", exact: true }).click();
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 40, y, { steps: 6 });
  await page.mouse.up();
  await expect(scene).toHaveAttribute("data-yaw", angle!);
  await expect(camera).not.toHaveAttribute("transform", position!);
  await page
    .getByRole("button", { name: "Augmenter le zoom", exact: true })
    .click();
  await expect(page.getByTestId("zoom-level")).toHaveText("120 %");
  await page.getByRole("button", { name: "Recentrer", exact: true }).click();
  await expect(scene).toHaveAttribute("data-yaw", "35");
  await expect(scene).toHaveAttribute("data-pitch", "28");
  await expect(page.getByTestId("zoom-level")).toHaveText("100 %");
  expect(
    (await page.getByTestId("project-workbench-header").boundingBox())!.height,
  ).toBe(headerHeight);
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page).toHaveURL(/project\//);
  const model = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("structcalc.workspace.v1")!).projects[0]
        .data,
  );
  expect(model.floors).toHaveLength(2);
  expect(model.floors[0].nodes["1,1"].b).toBe(25);
  if (info.project.name === "mobile")
    await expect(page.getByRole("menubar")).toHaveCount(0);
});
test("a phone rotates with one finger and zooms with two without editing an element", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile", "Touch gesture");
  await page.goto("/#/new/building");
  await createStudy(page);
  await page
    .locator(".canvas-tools-left")
    .getByRole("button", { name: "3D", exact: true })
    .click();
  const box = (await page.getByTestId("playground").boundingBox())!,
    scene = page.getByTestId("building-3d");
  const client = await page.context().newCDPSession(page),
    x = box.x + box.width / 2,
    y = box.y + box.height * 0.6;
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, id: 1 }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: x + 60, y: y + 20, id: 1 }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(scene).not.toHaveAttribute("data-yaw", "35");
  const yaw = await scene.getAttribute("data-yaw");
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: x - 35, y, id: 1 },
      { x: x + 35, y, id: 2 },
    ],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: x - 65, y, id: 1 },
      { x: x + 65, y, id: 2 },
    ],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(scene).toHaveAttribute("data-yaw", yaw!);
  await expect(page.getByTestId("zoom-level")).not.toHaveText("100 %");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 760 });
  await page.getByLabel("Rotation 3D", { exact: true }).fill("60");
  await expect(scene).toHaveAttribute("data-yaw", "60");
  const toolbar = (await page.locator(".building-view-tools").boundingBox())!;
  expect(toolbar.x + toolbar.width).toBeLessThanOrEqual(320);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
