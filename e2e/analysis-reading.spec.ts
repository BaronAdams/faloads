import { test, expect, type Page } from "@playwright/test";
import { createStudy, calculate, parameters } from "./helpers";
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
async function moveWorld(page: Page, x: number, y: number) {
  const p = await page
    .getByTestId("camera")
    .evaluate(
      (g, p) => new DOMPoint(p.x, p.y).matrixTransform(g.getScreenCTM()!),
      { x, y },
    );
  await page.mouse.move(p.x, p.y);
}
async function basePoint(page: Page, kind: "beam" | "frame", diagram = false) {
  const line = diagram
    ? page.getByTestId("diagram-axis").first()
    : page
        .locator(`[data-element^="${kind === "beam" ? "section" : "member"}:"]`)
        .first()
        .locator("line")
        .first();
  return line.evaluate((el) => ({
    x: (Number(el.getAttribute("x1")) + Number(el.getAttribute("x2"))) / 2,
    y: (Number(el.getAttribute("y1")) + Number(el.getAttribute("y2"))) / 2,
  }));
}
test("Windows/Linux themed menus work with keyboard shortcuts and compact dialogs", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Desktop menus");
  await page.goto("/#/new/frame");
  await createStudy(page);
  await expect(page.getByRole("menubar")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute(
    "data-native-menu",
    "false",
  );
  await page.keyboard.press("F10");
  await expect(
    page
      .getByRole("menubar")
      .getByRole("menuitem", { name: "Fichier", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await parameters(page);
  expect(
    (await page.getByRole("dialog").boundingBox())!.width,
  ).toBeLessThanOrEqual(600);
  await page
    .getByRole("button", { name: "Revenir au schéma", exact: true })
    .click();
  await page.getByTestId("playground").focus();
  await page.keyboard.press("F5");
  await expect(page.locator(".canvas-result-status")).toContainText(
    "Calcul actualisé",
  );
  await page.keyboard.press("Control+s");
  await expect(page).toHaveURL(/project\//);
});
for (const kind of ["beam", "frame"] as const) {
  test(`${kind}: pointer projection and diagram values follow camera transforms`, async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "desktop", "Mouse cursor interaction");
    await page.goto(`/#/new/${kind}`);
    await createStudy(page);
    const p = await basePoint(page, kind);
    await moveWorld(
      page,
      p.x + (kind === "frame" ? 25 : 0),
      p.y + (kind === "beam" ? -60 : 0),
    );
    const probe = page.getByTestId("structure-probe"),
      guide = page.getByTestId("probe-guide");
    await expect(probe).toBeVisible();
    const station = Number(await probe.getAttribute("data-station"));
    expect(station).toBeCloseTo(kind === "beam" ? 4 : 2, 5);
    const line = await guide.evaluate((l) => ({
      x1: Number(l.getAttribute("x1")),
      x2: Number(l.getAttribute("x2")),
      y1: Number(l.getAttribute("y1")),
      y2: Number(l.getAttribute("y2")),
    }));
    if (kind === "beam") expect(line.x1).toBeCloseTo(line.x2);
    else expect(line.y1).toBeCloseTo(line.y2);
    await page
      .getByRole("button", { name: "Augmenter le zoom", exact: true })
      .click();
    await moveWorld(
      page,
      p.x + (kind === "frame" ? 25 : 0),
      p.y + (kind === "beam" ? -60 : 0),
    );
    expect(Number(await probe.getAttribute("data-station"))).toBeCloseTo(
      station,
      5,
    );
    await page.getByTestId("playground").focus();
    const cursor = await page
      .getByTestId("camera")
      .evaluate(
        (g, p) => new DOMPoint(p.x, p.y).matrixTransform(g.getScreenCTM()!),
        p,
      );
    await page.mouse.move(cursor.x, cursor.y);
    await page.keyboard.down("Space");
    await page.mouse.down();
    await page.mouse.move(cursor.x + 30, cursor.y + 20);
    await page.mouse.up();
    await page.keyboard.up("Space");
    await moveWorld(
      page,
      p.x + (kind === "frame" ? 25 : 0),
      p.y + (kind === "beam" ? -60 : 0),
    );
    expect(Number(await probe.getAttribute("data-station"))).toBeCloseTo(
      station,
      5,
    );
    await page.getByRole("button", { name: "Recentrer", exact: true }).click();
    await calculate(page);
    await page.getByRole("button", { name: "Moment M", exact: true }).click();
    const d = await basePoint(page, kind, true);
    await moveWorld(
      page,
      d.x + (kind === "frame" ? 25 : 0),
      d.y + (kind === "beam" ? -50 : 0),
    );
    await expect(probe).toContainText("kN·m");
    expect(
      Number.isFinite(Number(await probe.getAttribute("data-value"))),
    ).toBe(true);
    if (kind === "beam")
      expect(Number(await probe.getAttribute("data-value"))).toBeCloseTo(
        108,
        5,
      );
    await expect(page.getByTestId("probe-curve-point")).toBeVisible();
    await page.getByRole("button", { name: "Déformée", exact: true }).click();
    await moveWorld(
      page,
      d.x + (kind === "frame" ? 26 : 1),
      d.y + (kind === "beam" ? -50 : 0),
    );
    await expect(probe).toContainText("mm");
    await page.getByRole("button", { name: "Rotation", exact: true }).click();
    await moveWorld(
      page,
      d.x + (kind === "frame" ? 27 : 2),
      d.y + (kind === "beam" ? -50 : 0),
    );
    await expect(probe).toContainText("mrad");
    await page.mouse.move(0, 0);
    await expect(probe).toHaveCount(0);
  });
  test(`${kind}: allowable deflection, comparison and reading units persist without invalidating mechanics`, async ({
    page,
  }) => {
    await page.goto(`/#/new/${kind}`);
    await createStudy(page);
    await calculate(page, true);
    const results = page.getByRole("dialog", {
      name: "Résultats de l’analyse",
    });
    const verdict = page.getByTestId("deflection-check");
    await expect(results).toContainText("Flèche admissible");
    await expect(verdict).toContainText("Critère respecté");
    await results
      .getByRole("button", { name: "Fermer le panneau", exact: true })
      .click();
    await parameters(page);
    const settings = page.getByRole("dialog");
    await settings
      .getByRole("combobox", {
        name: "Unité des positions au curseur",
        exact: true,
      })
      .click();
    await page
      .getByRole("option", { name: "Centimètres · cm", exact: true })
      .click();
    await settings
      .getByRole("combobox", { name: "Flèche admissible", exact: true })
      .click();
    await page
      .getByRole("option", { name: "Valeur en mm", exact: true })
      .click();
    await settings
      .getByLabel("Limite de déplacement", { exact: true })
      .fill("0.001");
    await settings
      .getByRole("button", { name: "Revenir au schéma", exact: true })
      .click();
    await expect(page.locator(".canvas-result-status")).toContainText(
      "Calcul actualisé",
    );
    await page
      .getByRole("button", { name: "Ouvrir les résultats", exact: true })
      .click();
    await expect(verdict).toContainText("Limite dépassée");
    await results
      .getByRole("button", { name: "Fermer le panneau", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Enregistrer", exact: true })
      .click();
    await expect(page).toHaveURL(/project\//);
    await page.reload();
    await parameters(page);
    await expect(
      page
        .getByRole("dialog")
        .getByLabel("Limite de déplacement", { exact: true }),
    ).toHaveValue("0,001");
    await expect(
      page.getByRole("dialog").getByRole("combobox", {
        name: "Unité des positions au curseur",
        exact: true,
      }),
    ).toContainText("Centimètres");
  });
}
