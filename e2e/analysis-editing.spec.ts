import { test, expect, type Page } from "@playwright/test";
import { createStudy, calculate } from "./helpers";
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
async function selectLoad(page: Page, mobile: boolean) {
  await page.locator(".distributed-load").first().click();
  if (mobile) {
    await page.getByRole("button", { name: "Annuler", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
}
async function save(page: Page) {
  const old = page.url().includes("/new/")
    ? await page.getByTestId("playground").elementHandle()
    : null;
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page).toHaveURL(/project\//);
  if (old)
    await expect.poll(() => old.evaluate((e) => e.isConnected)).toBe(false);
  return page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("structcalc.workspace.v1")!).projects[0]
        .data,
  );
}
for (const kind of ["beam", "frame"] as const) {
  test(`${kind}: ribbon actions flow before the final selection and complete parameters open in a dialog`, async ({
    page,
  }, info) => {
    await page.goto(`/#/new/${kind}`);
    await createStudy(page);
    const header = page.getByTestId("project-workbench-header");
    await expect(
      header.getByRole("button", { name: "Retour aux calculs", exact: true }),
    ).toHaveCount(0);
    await expect(header.getByRole("switch")).toHaveCount(0);
    await expect(
      header.getByRole("button", { name: "Calcul simplifié G/Q", exact: true }),
    ).toHaveCount(0);
    await expect(
      header
        .getByRole("button", { name: "Ouvrir les paramètres", exact: true })
        .locator(".lucide-settings"),
    ).toHaveCount(1);
    const before = (await header.boundingBox())!.height;
    await selectLoad(page, info.project.name === "mobile");
    const groups = await header
      .locator(".project-header-toolbar > [role=group]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
    expect(groups.at(-1)).toMatch(/^Sélection/);
    expect(groups.indexOf("Projet")).toBeLessThan(groups.length - 1);
    expect((await header.boundingBox())!.height).toBe(before);
    const field = header.getByLabel(
      kind === "beam" ? "Intensité q₁" : "Intensité initiale w₁",
      { exact: true },
    );
    await field.fill("1234.5678");
    await field.press("Tab");
    expect((await field.inputValue()).length).toBeLessThanOrEqual(5);
    await expect(field).toHaveAttribute("title", /1234.5678/);
    await header
      .getByRole("button", { name: "Modifier la sélection", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Paramètres de l’élément",
    });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByLabel(
        kind === "beam" ? "Intensité q₁" : "Intensité initiale w₁",
        { exact: true },
      ),
    ).toHaveValue("1234,5678");
    await dialog.getByRole("button", { name: "Annuler", exact: true }).click();
    const model = await save(page);
    expect(kind === "beam" ? model.loads[0].q1 : model.mem[1].w).toBe(
      1234.5678,
    );
  });
  test(`${kind}: distributed load handles stretch actual limits and preserve a trapezoidal envelope`, async ({
    page,
  }, info) => {
    await page.goto(`/#/new/${kind}`);
    await createStudy(page);
    await selectLoad(page, info.project.name === "mobile");
    const header = page.getByTestId("project-workbench-header");
    await header
      .getByLabel(kind === "beam" ? "Intensité q₁" : "Intensité initiale w₁", {
        exact: true,
      })
      .fill("10");
    await header
      .getByLabel(kind === "beam" ? "Intensité q₂" : "Intensité finale w₂", {
        exact: true,
      })
      .fill("30");
    await expect(page.getByTestId("distributed-handle-start")).toHaveCount(1);
    await expect(page.getByTestId("distributed-handle-end")).toHaveCount(1);
    const last = page.getByTestId("distributed-handle-end"),
      b = (await last.boundingBox())!;
    if (info.project.name === "mobile") {
      const client = await page.context().newCDPSession(page),
        x = b.x + b.width / 2,
        y = b.y + b.height / 2;
      await client.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y, id: 1 }],
      });
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x - 40, y, id: 1 }],
      });
      await client.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    } else {
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2 - 80, b.y + b.height / 2, {
        steps: 8,
      });
      await page.mouse.up();
    }
    const end = header.getByLabel(
      kind === "beam" ? "Fin x₂" : "Fin de la charge",
      { exact: true },
    );
    expect(Number((await end.inputValue()).replace(",", "."))).toBeLessThan(
      kind === "beam" ? 4 : 100,
    );
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const load = page.locator(".distributed-load").first();
    const geometry = await load.evaluate((el) => {
      const path = el
        .querySelector('[data-testid="load-envelope"]')!
        .getAttribute("d")!;
      const v = path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g)!.map(Number),
        [x1, y1, x2, y2] = v;
      return [
        ...el.querySelectorAll('[data-testid="distributed-arrow"] line'),
      ].every((line) => {
        const x = Number(line.getAttribute("x1")),
          y = Number(line.getAttribute("y1"));
        return Math.abs(y - (y1 + ((y2 - y1) * (x - x1)) / (x2 - x1))) < 1e-6;
      });
    });
    expect(geometry).toBe(true);
    const model = await save(page);
    expect(
      kind === "beam" ? model.loads[0].x2 : model.mem[1].loadEnd,
    ).toBeLessThan(kind === "beam" ? 4 : 1);
  });
}
test("View menus hide annotation families independently and require fresh reactions", async ({
  page,
}) => {
  await page.goto("/#/new/beam");
  await createStudy(page);
  await page
    .getByRole("button", { name: "Options de vue", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Réactions", exact: true }).click();
  await page
    .getByRole("menuitemcheckbox", {
      name: "Afficher les réactions",
      exact: true,
    })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Lancez d’abord le calcul",
  );
  await expect(page.getByTestId("reaction")).toHaveCount(0);
  await page.getByRole("button", { name: "Fermer", exact: true }).click();
  await calculate(page);
  await page
    .getByRole("button", { name: "Options de vue", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Annotations", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Charges", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Charges réparties", exact: true })
    .click();
  await page
    .getByRole("menuitemcheckbox", { name: "Valeurs", exact: true })
    .last()
    .click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(
    page.locator('.distributed-load [data-annotation="loads-values"]'),
  ).not.toBeVisible();
  await expect(
    page
      .locator('[data-load-kind="point"] [data-annotation="loads-values"]')
      .first(),
  ).toBeVisible();
  await expect(page.getByTestId("reaction")).toHaveCount(2);
});
test("profile icons change actual section properties and right-click Modifier preserves cancellation", async ({
  page,
}, info) => {
  await page.goto("/#/new/beam");
  await createStudy(page);
  const sectionLine = page
    .locator('[data-element^="section:"]')
    .first()
    .locator("line")
    .last();
  const point = (await sectionLine.boundingBox())!;
  await page.mouse.click(point.x + point.width * 0.75, point.y);
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Annuler", exact: true }).click();
  const header = page.getByTestId("project-workbench-header");
  await expect(
    header.getByRole("group", { name: "Profil de section", exact: true }),
  ).toBeVisible();
  await header
    .getByRole("button", { name: "Section Circulaire", exact: true })
    .click();
  await expect(header.getByLabel("Diamètre D", { exact: true })).toBeVisible();
  await header
    .getByRole("button", { name: "Section En T", exact: true })
    .click();
  if (info.project.name === "desktop") {
    const hit = (await sectionLine.boundingBox())!;
    await page.mouse.click(hit.x + hit.width * 0.75, hit.y, {
      button: "right",
    });
    await page.getByRole("menuitem", { name: "Modifier", exact: true }).click();
  } else
    await header
      .getByRole("button", { name: "Modifier la sélection", exact: true })
      .click();
  const dialog = page.getByRole("dialog", { name: "Paramètres de l’élément" });
  await dialog
    .getByLabel("Épaisseur de l’âme tᵥ", { exact: true })
    .fill("0.04");
  await dialog.getByRole("button", { name: "Annuler", exact: true }).click();
  const m = await save(page);
  expect(m.sections[0].shape).toBe("T");
  expect(m.sections[0].tw).toBeUndefined();
  expect(m.sections[0].I).not.toBeCloseTo(
    (m.sections[0].b * m.sections[0].h ** 3) / 12,
    7,
  );
});

test("adding distributed frame loads preserves existing loads", async ({
  page,
}, info) => {
  await page.goto("/#/new/frame");
  await createStudy(page);
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    await page
      .getByRole("menuitem", {
        name: "Charge répartie sur une barre",
        exact: true,
      })
      .click();
    if (info.project.name === "mobile") {
      await page
        .getByRole("dialog", { name: "Paramètres de l’élément" })
        .getByRole("button", { name: "Appliquer", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
  }
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page
    .getByRole("menuitem", {
      name: "Charge répartie sur une barre",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Toutes les barres ont déjà une charge répartie.", {
      exact: false,
    }),
  ).toBeVisible();
  const model = await save(page);
  expect(model.mem.map((m: any) => m.w)).toEqual([10, 20, 10]);
});
