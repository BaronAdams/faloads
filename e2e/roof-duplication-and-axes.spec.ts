import { test, expect, type Page } from "@playwright/test";
import { createStudy, calculate, duplicateLevel } from "./helpers";
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
for (const kind of ["beam", "frame"] as const)
  test(`${kind}: signed N V M ordinates follow the counterclockwise local normal`, async ({
    page,
  }) => {
    await page.goto(`/#/new/${kind}`);
    await createStudy(page);
    await calculate(page);
    for (const name of ["Moment M", "Effort tranchant V", "Effort normal N"]) {
      await page.getByRole("button", { name, exact: true }).click();
      const checks = await page.getByTestId("playground").evaluate((el) => {
        const axes = [...el.querySelectorAll('[data-testid="diagram-axis"]')],
          members = [...el.querySelectorAll("[data-diagram-member]")].map((n) =>
            n.getAttribute("data-diagram-member"),
          );
        return [...el.querySelectorAll('[data-testid="diagram-value"]')].map(
          (node) => {
            const axis =
                axes[members.indexOf(node.getAttribute("data-member"))],
              circle = node.parentElement!.querySelector("circle")!;
            const number = (e: Element, name: string) =>
              Number(e.getAttribute(name));
            const dx = number(axis, "x2") - number(axis, "x1"),
              dy = number(axis, "y2") - number(axis, "y1"),
              L = Math.hypot(dx, dy);
            return {
              value: number(node, "data-value"),
              side:
                ((number(circle, "cx") - number(axis, "x1")) * dy) / L -
                ((number(circle, "cy") - number(axis, "y1")) * dx) / L,
            };
          },
        );
      });
      expect(checks.length).toBeGreaterThan(0);
      for (const r of checks)
        if (Math.abs(r.value) > 1e-8)
          expect(r.side * Math.sign(r.value)).toBeGreaterThan(0);
        else expect(Math.abs(r.side)).toBeLessThan(0.0001);
    }
  });
async function saveData(page: Page) {
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page).toHaveURL(/project\//);
  return page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("structcalc.workspace.v1")!).projects[0]
        .data,
  );
}
test("Ctrl D and the context menu place independent beam copies at the mouse abscissa after zoom and pan", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Desktop cursor shortcuts");
  await page.goto("/#/new/beam");
  await createStudy(page);
  await calculate(page);
  const load = page.locator('[data-element^="load:"]').last();
  await load.press("Enter");
  await page
    .getByRole("button", { name: "Augmenter le zoom", exact: true })
    .click();
  await page.getByRole("button", { name: "Déplacer", exact: true }).click();
  const canvas = (await page.getByTestId("playground").boundingBox())!;
  await page.mouse.move(
    canvas.x + canvas.width * 0.65,
    canvas.y + canvas.height * 0.8,
  );
  await page.mouse.down();
  await page.mouse.move(
    canvas.x + canvas.width * 0.68,
    canvas.y + canvas.height * 0.82,
    { steps: 5 },
  );
  await page.mouse.up();
  await page.getByRole("button", { name: "Sélection", exact: true }).click();
  const line = page
      .locator('[data-element^="section:"]')
      .first()
      .locator("line")
      .first(),
    box = (await line.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.4, box.y - 25);
  await page.keyboard.press("Control+d");
  await expect(page.locator('[data-element^="load:"]')).toHaveCount(3);
  await expect(page.locator(".canvas-result-status")).toContainText(
    "Calcul non actualisé",
  );
  const copy = page.locator('[data-element^="load:"]').last();
  await copy.locator("rect").first().click({ button: "right", force: true });
  await expect(
    page.getByRole("menuitem", { name: /^Dupliquer/ }),
  ).toBeVisible();
  const menu = page.getByRole("menuitem", { name: /^Dupliquer/ });
  // Measure after the entrance animation, then click the measured screen point.
  await menu.click({ trial: true });
  const m = (await menu.boundingBox())!,
    clickX = Math.round(m.x + m.width / 2),
    clickY = Math.round(m.y + m.height / 2);
  const axis = (await line.boundingBox())!,
    expected = Math.max(0, Math.min(8, ((clickX - axis.x) / axis.width) * 8));
  await page.mouse.click(clickX, clickY);
  await expect(page.locator('[data-element^="load:"]')).toHaveCount(4);
  await expect(page.locator('[role="menu"]')).toHaveCount(0);
  await page.locator('[data-element^="section:"]').first().press("Enter");
  await page.getByTestId("playground").focus();
  await page.keyboard.press("Control+d");
  await expect(
    page.getByText(
      "Sélectionnez un élément à dupliquer. Les tronçons de section ne se dupliquent pas.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.locator('[data-element^="load:"]')).toHaveCount(4);
  const model = await saveData(page);
  expect(model.loads[2].x).toBeCloseTo(3.2, 2);
  // The browser rounds the menu click to a CSS pixel; compare in that space.
  expect(Math.abs(model.loads.at(-1).x - expected)).toBeLessThanOrEqual(
    8 / axis.width,
  );
  expect(new Set(model.loads.map((l: any) => l.id)).size).toBe(4);
});
test("a duplicated frame distribution can be edited, calculated and deleted independently", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Desktop duplication");
  await page.goto("/#/new/frame");
  await createStudy(page);
  const dist = page.locator('[data-element^="member-dist:"]');
  await dist.press("Enter");
  await page
    .getByTestId("project-workbench-header")
    .getByLabel("Fin de la charge", { exact: true })
    .fill("50");
  const bar = page
      .locator('[data-element^="member:"]')
      .nth(1)
      .locator("line")
      .first(),
    box = (await bar.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.75, box.y - 15);
  await page.getByTestId("playground").focus();
  await page.keyboard.press("Control+d");
  await expect(page.locator('[data-element^="member-dist:"]')).toHaveCount(2);
  await page
    .getByTestId("project-workbench-header")
    .getByLabel("Intensité initiale w₁", { exact: true })
    .fill("5");
  await page
    .getByTestId("project-workbench-header")
    .getByLabel("Intensité finale w₂", { exact: true })
    .fill("5");
  let data = await saveData(page);
  expect(data.dl).toHaveLength(1);
  expect(data.dl[0].w).toBe(5);
  expect(data.mem[1].w).toBe(20);
  expect(data.dl[0].loadStart).toBeCloseTo(0.5, 3);
  await calculate(page);
  await page
    .locator(`[data-element="member-dist:${data.dl[0].id}"]`)
    .press("Enter");
  await page.getByTestId("playground").focus();
  await page.keyboard.press("Delete");
  await expect(page.locator('[data-element^="member-dist:"]')).toHaveCount(1);
  data = await saveData(page);
  expect(data.dl).toHaveLength(0);
  expect(data.mem[1].w).toBe(20);
});
test("a configurable roof draws in 3D, conserves its reactions to the ground and persists", async ({
  page,
}, info) => {
  await page.goto("/#/new/building");
  await createStudy(page);
  await duplicateLevel(page);
  await duplicateLevel(page);
  async function run() {
    await page
      .getByRole("button", { name: "Calculer le bâtiment", exact: true })
      .click();
    await expect(page.getByTestId("building-cumulative")).toBeVisible();
  }
  await run();
  const baseline = await page
    .getByTestId("building-cumulative")
    .locator("tbody tr")
    .last()
    .locator("td")
    .nth(2)
    .textContent();
  await page
    .getByRole("button", { name: "Fermer le panneau", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const header = page.getByTestId("project-workbench-header"),
    height = (await header.boundingBox())!.height;
  await page
    .getByRole("button", { name: "Configurer la toiture", exact: true })
    .click();
  const editor = page.getByRole("dialog");
  await editor
    .getByRole("switch", { name: "Ajouter une toiture au bâtiment" })
    .click();
  await editor
    .getByRole("button", { name: "Quatre pans", exact: true })
    .click();
  await editor.getByLabel("Intensité de charge 1", { exact: true }).fill("0,4");
  await editor.getByLabel("Intensité de charge 2", { exact: true }).fill("0,2");
  await editor
    .getByLabel("Intensité de charge 3", { exact: true })
    .fill("0,75");
  await editor
    .getByRole("button", { name: "Appliquer la toiture", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("roof-facet")).toHaveCount(4);
  await expect(page.getByTestId("roof-truss")).toHaveCount(5);
  expect((await header.boundingBox())!.height).toBe(height);
  await run();
  await expect(
    page.getByTestId("roof-reactions").locator("tbody tr"),
  ).toHaveCount(10);
  await expect(page.getByTestId("roof-balance")).toContainText("0,000000");
  const parse = (s: string) =>
    Number(s.replace(/[\s\u202f]/g, "").replace(",", "."));
  const after = await page
    .getByTestId("building-cumulative")
    .locator("tbody tr")
    .last()
    .locator("td")
    .nth(2)
    .textContent();
  expect(parse(after!) - parse(baseline!)).toBeGreaterThan(50);
  await page
    .getByRole("button", { name: "Fermer le panneau", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const data = await saveData(page);
  expect(data.roof.shape).toBe("hip");
  expect(data.roof.loads[0].value).toBe(0.4);
  await page.reload();
  await page
    .getByTestId("project-workbench-header")
    .getByRole("button", { name: "3D", exact: true })
    .click();
  await expect(page.getByTestId("roof-facet")).toHaveCount(4);
  await page
    .getByRole("button", { name: "Configurer la toiture", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Hauteur de toiture", { exact: true })
    .fill("6");
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  const unchanged = await saveData(page);
  expect(unchanged.roof.rise).toBe(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
