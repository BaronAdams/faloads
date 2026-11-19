import { test, expect, type Page } from "@playwright/test";
import { createStudy, calculate } from "./helpers";
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
async function focusCanvas(page: Page) {
  await expect
    .poll(async () => {
      await page.getByTestId("playground").focus();
      return page
        .getByTestId("playground")
        .evaluate((el) => document.activeElement === el);
    })
    .toBe(true);
}
test("Desktop station input freezes the guide until Enter, validates bounds and reads the diagram", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Keyboard hover");
  await page.goto("/#/new/beam");
  await createStudy(page);
  await calculate(page);
  await page.getByRole("button", { name: "Moment M", exact: true }).click();
  const axis = (await page.getByTestId("diagram-axis").boundingBox())!;
  await focusCanvas(page);
  await page.mouse.move(axis.x + axis.width * 0.25, axis.y - 40);
  const probe = page.getByTestId("structure-probe"),
    start = Number(await probe.getAttribute("data-station"));
  await page.keyboard.press("3");
  await expect(page.getByLabel("Position · m", { exact: true })).toBeFocused();
  await page.keyboard.type(",5");
  expect(Number(await probe.getAttribute("data-station"))).toBeCloseTo(
    start,
    5,
  );
  await expect(probe).toContainText("3,5 m");
  await page.keyboard.press("Enter");
  expect(Number(await probe.getAttribute("data-station"))).toBeCloseTo(3.5, 6);
  expect(Number(await probe.getAttribute("data-value"))).toBeCloseTo(105, 2);
  await page.getByLabel("Position · m", { exact: true }).fill("9");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alert")).toContainText(
    "comprise entre 0 et 8 m",
  );
  expect(Number(await probe.getAttribute("data-station"))).toBeCloseTo(3.5, 6);
  await page.getByLabel("Position · m", { exact: true }).fill("0");
  await page.keyboard.press("Enter");
  expect(Number(await probe.getAttribute("data-station"))).toBe(0);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("form", { name: "Lecture précise de position" }),
  ).toHaveCount(0);
});
test("Mobile reads a chosen frame member with a decimal keyboard and keeps editing separate", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile", "Touch inspection");
  await page.goto("/#/new/frame");
  await createStudy(page);
  await calculate(page);
  await page.getByRole("button", { name: "Rotation", exact: true }).click();
  await page
    .getByRole("button", { name: "Lire une position", exact: true })
    .click();
  await page.getByLabel("Barre à lire").selectOption({ label: "B2 · 6,000 m" });
  const probe = page.getByTestId("structure-probe");
  await expect(probe).toHaveAttribute("data-member", "B2");
  const input = page.getByLabel("Position · m", { exact: true });
  await expect(input).toHaveAttribute("inputmode", "decimal");
  await input.fill("7");
  await page.getByRole("button", { name: "Aller", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("0 et 6 m");
  await input.fill("1,25");
  await page.getByRole("button", { name: "Aller", exact: true }).click();
  expect(Number(await probe.getAttribute("data-station"))).toBeCloseTo(1.25, 6);
  await expect(probe).toContainText("mrad");
  const axis = (await page.getByTestId("diagram-axis").first().boundingBox())!;
  await page.touchscreen.tap(axis.x + 12, axis.y + axis.height / 2);
  await expect(probe).toHaveAttribute("data-member", "B1");
  const station = Number(await probe.getAttribute("data-station"));
  await page
    .getByRole("button", { name: "Augmenter le zoom", exact: true })
    .click();
  expect(Number(await probe.getAttribute("data-station"))).toBeCloseTo(
    station,
    6,
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Fermer la lecture", exact: true })
    .click();
  await expect(
    page.getByRole("form", { name: "Lecture précise de position" }),
  ).toHaveCount(0);
});
for (const kind of ["beam", "frame", "building"] as const)
  test(`${kind}: unanchored Ctrl A selects every family, Shift removes exactly one`, async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "desktop", "Desktop selection");
    await page.goto(`/#/new/${kind}`);
    await createStudy(page);
    await focusCanvas(page);
    await page.keyboard.press("Control+a");
    const count = await page.getByTestId("selection-highlight").count();
    expect(count).toBeGreaterThan(4);
    const target =
      kind === "building"
        ? page.locator('[data-element="node|1,1"]').locator("rect")
        : kind === "beam"
          ? page.locator('[data-element^="support:"]').first().locator("rect")
          : page
              .locator('[data-element^="node:"]')
              .first()
              .locator("circle")
              .first();
    await page.keyboard.down("Shift");
    await target.click({ force: true });
    await page.keyboard.up("Shift");
    await expect(page.getByTestId("selection-highlight")).toHaveCount(
      count - 1,
    );
  });
test("Building duplication filters the selection and floor navigation is ordered top to bottom", async ({
  page,
}, info) => {
  await page.goto("/#/new/building");
  await createStudy(page);
  const nav = page.getByRole("navigation", { name: "Niveaux du bâtiment" });
  const panel = page
    .locator('[data-element="panel|0,0"]')
    .locator("polygon,rect")
    .first();
  await panel.click({ force: true });
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Annuler", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Dupliquer", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Dupliquer un étage" });
  await dialog
    .getByRole("combobox", { name: "Éléments à copier", exact: true })
    .click();
  await page.getByRole("option", { name: /Sélection courante/ }).click();
  await dialog
    .getByRole("switch", { name: "Copier les charges ajoutées" })
    .click();
  await dialog
    .getByRole("button", { name: "Dupliquer le niveau", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(nav.getByRole("button")).toHaveText(["R+1", "RDC"]);
  await expect(
    nav.getByRole("button", { name: "R+1", exact: true }),
  ).toHaveAttribute("aria-current", "step");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page).toHaveURL(/project\//);
  const model = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("structcalc.workspace.v1")!).projects[0]
        .data,
  );
  expect(
    Object.values(model.floors[1].panels).filter((p: any) => p.exists),
  ).toHaveLength(1);
  expect(
    Object.values(model.floors[1].nodes).filter((n: any) => n.exists),
  ).toHaveLength(0);
  expect(model.floors[1].panels["0,0"].level.q).toBe(0);
});
test("Building ribbon is compact, 3D orbit is rigid and crowded labels do not overlap", async ({
  page,
}, info) => {
  await page.goto("/#/new/building");
  await createStudy(page);
  const header = page.getByTestId("project-workbench-header");
  await expect(header.getByRole("switch")).toHaveCount(0);
  await expect(
    header.getByRole("button", { name: "Retour aux calculs", exact: true }),
  ).toHaveCount(0);
  await expect(header.locator('[data-critical-icon="column"]')).toHaveCount(1);
  await expect(header.locator('[data-critical-icon="beam"]')).toHaveCount(1);
  await header.getByRole("button", { name: "3D", exact: true }).click();
  await expect(
    header.getByRole("button", { name: "3D", exact: true }),
  ).toHaveText("3D");
  const scene = page.getByTestId("building-3d"),
    scale = await scene.getAttribute("data-scale"),
    pitch = await scene.getAttribute("data-pitch");
  const box = (await page.getByTestId("playground").boundingBox())!;
  const x = box.x + box.width * 0.6,
    y = box.y + box.height * 0.6;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 50, y + 10, { steps: 5 });
  await page.mouse.up();
  await expect(scene).not.toHaveAttribute("data-yaw", "35");
  await expect(scene).toHaveAttribute("data-pitch", pitch!);
  await expect(scene).toHaveAttribute("data-scale", scale!);
  await header
    .getByRole("button", { name: "Options de vue", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Annotations", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Tous les éléments", exact: true })
    .click();
  const labels = await page
    .getByTestId("building-annotation")
    .locator("rect")
    .evaluateAll((rects) =>
      rects.map((r) => {
        const b = r.getBoundingClientRect();
        return { x: b.x, y: b.y, w: b.width, h: b.height };
      }),
    );
  expect(labels.length).toBeGreaterThan(8);
  for (const [i, a] of labels.entries())
    for (const b of labels.slice(i + 1))
      expect(
        a.x < b.x + b.w &&
          a.x + a.w > b.x &&
          a.y < b.y + b.h &&
          a.y + a.h > b.y,
      ).toBe(false);
  expect((await header.boundingBox())!.height).toBe(
    info.project.name === "desktop" ? 104 : 128,
  );
});
