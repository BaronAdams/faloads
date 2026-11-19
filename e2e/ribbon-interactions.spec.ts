import { test, expect, type Page } from "@playwright/test";
import { createStudy } from "./helpers";

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
  await page.goto("/");
  await page.getByRole("button", { name: "Passer la présentation" }).click();
});

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

test("building controls share one ribbon, keep section dimensions stacked, and overflow within it", async ({
  page,
}, info) => {
  await page.goto("/#/new/building");
  await createStudy(page);
  const header = page.getByTestId("project-workbench-header");
  await expect(
    page.locator(
      ".canvas-field-controls, .canvas-tools-left, .canvas-tools-right",
    ),
  ).toHaveCount(0);
  await expect(header.locator(".study-name-button")).toHaveCount(0);
  await expect(
    header.getByRole("group", { name: "Charges critiques", exact: true }),
  ).toHaveCount(1);
  await expect(
    header.getByRole("button", { name: "Poteau le plus chargé", exact: true }),
  ).toHaveText("max");
  const before = (await header.boundingBox())!;
  if (info.project.name === "desktop") {
    await page.locator('[data-element="node|1,1"]').locator("rect").click();
    const width = (await header
      .getByLabel("Largeur b", { exact: true })
      .boundingBox())!;
    const height = (await header
      .getByLabel("Hauteur h", { exact: true })
      .boundingBox())!;
    expect(Math.abs(width.x - height.x)).toBeLessThan(1);
    expect(height.y).toBeGreaterThan(width.y + width.height);
  }
  await header.getByRole("button", { name: "3D", exact: true }).click();
  await expect(
    header.getByRole("button", { name: "Options de vue", exact: true }),
  ).toHaveCount(1);
  await expect(page.getByLabel("Rotation 3D", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Inclinaison 3D", { exact: true })).toHaveCount(
    0,
  );
  expect((await header.boundingBox())!.height).toBe(before.height);
  await page.setViewportSize({ width: 320, height: 760 });
  const scroller = header.locator(".project-header-toolbar");
  expect(await scroller.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
    true,
  );
  await header
    .getByRole("button", { name: "Options de vue", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Annotations", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Tous les éléments", exact: true })
    .click();
  await header
    .getByRole("button", { name: "Enregistrer", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    header.getByRole("button", { name: "Enregistrer", exact: true }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("right-drag leaves a beam load in place and a cancelled left-drag restores it", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Mouse interaction");
  await page.goto("/#/new/beam");
  await createStudy(page);
  const force = page
    .locator('[data-element^="load:"]')
    .last()
    .locator("rect")
    .first();
  await force.click();
  const b = (await force.boundingBox())!,
    x = b.x + b.width / 2,
    y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(x + 90, y, { steps: 6 });
  await page.mouse.up({ button: "right" });
  await expect(page.getByLabel("Position x", { exact: true })).toHaveValue("5");
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 90, y, { steps: 6 });
  await expect(page.getByLabel("Position x", { exact: true })).not.toHaveValue(
    "5",
  );
  await page
    .getByTestId("playground")
    .dispatchEvent("pointercancel", { pointerId: 1 });
  await page.mouse.up();
  await expect(page.getByLabel("Position x", { exact: true })).toHaveValue("5");
  await expect(
    page.getByRole("button", { name: "Annuler", exact: true }),
  ).toBeDisabled();
});

test("a held left click translates a free building beam and undo restores both endpoints", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Desktop free element editing");
  await page.goto("/#/new/building");
  await createStudy(page);
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Poutre oblique", exact: true })
    .click();
  const beam = page
      .locator('[data-element^="oblique|"]')
      .locator("line")
      .last(),
    b = (await beam.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  const initialLine = await beam.evaluate((el) => el.outerHTML);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 55, b.y + b.height / 2 + 25, {
    steps: 6,
  });
  await page.mouse.up();
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  expect(await beam.evaluate((el) => el.outerHTML)).toBe(initialLine);
  await page.getByRole("button", { name: "Rétablir", exact: true }).click();
  const moved = await saved(page);
  expect(moved.floors[0].obliques[0].x1).toBeGreaterThan(0);
  expect(moved.floors[0].obliques[0].y1).toBeGreaterThan(0);
  expect(
    moved.floors[0].obliques[0].x2 - moved.floors[0].obliques[0].x1,
  ).toBeCloseTo(4, 3);
  // Saving remounts the workspace; verify the persisted geometry survives too.
  await page.reload();
  await expect(page.locator('[data-element^="oblique|"]')).toHaveCount(1);
});

test("phone long-press drags a load while a short swipe pans without changing its position", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile", "Synthesized Chromium touch");
  await page.goto("/#/new/beam");
  await createStudy(page);
  const client = await page.context().newCDPSession(page);
  const force = page
    .locator('[data-element^="load:"]')
    .last()
    .locator("rect")
    .first();
  const b = (await force.boundingBox())!,
    x = b.x + b.width / 2,
    y = b.y + b.height / 2;
  const touch = async (type: string, px: number, py: number) =>
    client.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x: px, y: py, id: 1 }],
    });
  await touch("touchStart", x, y);
  await page.waitForTimeout(80);
  await touch("touchMove", x + 2, y); // Normal finger jitter stays below the 4 px threshold.
  await page.waitForTimeout(340); // The product's deliberate long-press threshold.
  await touch("touchMove", x + 45, y);
  await touch("touchEnd", x + 45, y);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const moved = await saved(page);
  expect(moved.loads[1].x).toBeGreaterThan(5.2);
  await expect(force).toBeVisible();
  const next = (await force.boundingBox())!,
    sx = next.x + next.width / 2,
    sy = next.y + next.height / 2;
  const cameraBefore = await page
    .getByTestId("camera")
    .getAttribute("transform");
  await touch("touchStart", sx, sy);
  await touch("touchMove", sx - 35, sy);
  await touch("touchEnd", sx - 35, sy);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("camera")).not.toHaveAttribute(
    "transform",
    cameraBefore!,
  );
  const afterPan = await saved(page);
  expect(afterPan.loads[1].x).toBe(moved.loads[1].x);
});
