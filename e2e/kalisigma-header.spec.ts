import { test, expect } from "@playwright/test";
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
  page.on("pageerror", (e) => {
    throw e;
  });
  await page.goto("/");
  await expect(page).toHaveTitle("CaliSigma Structural");
  await expect(page.locator(".onboarding .brand strong")).toHaveText(
    "CaliSigma Structural",
  );
  await expect(page.locator(".onboarding .brand img")).toHaveAttribute(
    "src",
    "/app-icon.svg",
  );
  await page.getByRole("button", { name: "Passer la présentation" }).click();
});
for (const kind of ["beam", "frame", "building"] as const) {
  test(`${kind}: report icon and row-aware tooltips remain readable without covering header buttons`, async ({
    page,
  }) => {
    await page.goto(`/#/new/${kind}`);
    await createStudy(page);
    const header = page.getByTestId("project-workbench-header");
    const result = header.getByRole("button", {
      name: "Ouvrir les résultats",
      exact: true,
    });
    await expect(result.locator("svg.lucide-file-chart-column")).toHaveCount(1);
    const height = (await header.boundingBox())!.height;
    for (const [name, side] of [
      [kind === "building" ? "Calculer le bâtiment" : "Calculer", "top"],
      ["Ouvrir les résultats", "bottom"],
      ["Ouvrir les paramètres", "top"],
    ] as const) {
      const button = header.getByRole("button", { name, exact: true });
      await button.scrollIntoViewIfNeeded();
      await button.hover();
      const tooltip = page.locator('[data-slot="tooltip-content"]');
      await expect(tooltip).toBeVisible();
      await expect(tooltip).toHaveAttribute("data-side", side);
      await tooltip.evaluate((el) =>
        Promise.all(el.getAnimations().map((animation) => animation.finished)),
      );
      const box = (await tooltip.boundingBox())!,
        target = (await button.boundingBox())!;
      if (side === "top")
        expect(box.y + box.height).toBeLessThanOrEqual(target.y - 2);
      else expect(box.y).toBeGreaterThanOrEqual(target.y + target.height + 2);
      expect(box.x).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width).toBeLessThanOrEqual(
        (await page.evaluate(() => innerWidth)) + 1,
      );
      expect(box.y).toBeGreaterThanOrEqual(-1);
      const covered = await header.locator("button").evaluateAll(
        (buttons, tip) =>
          buttons
            .filter((button) => {
              const r = button.getBoundingClientRect();
              return (
                r.width > 0 &&
                r.height > 0 &&
                r.left < tip.x + tip.width &&
                r.right > tip.x &&
                r.top < tip.y + tip.height &&
                r.bottom > tip.y
              );
            })
            .map((button) => button.getAttribute("aria-label")),
        box,
      );
      expect(covered).toEqual([]);
      expect((await header.boundingBox())!.height).toBe(height);
      await page.mouse.move(2, (await page.evaluate(() => innerHeight)) - 4);
      await expect(tooltip).toHaveCount(0);
    }
    await result.scrollIntoViewIfNeeded();
    await result.focus();
    await expect(page.locator('[data-slot="tooltip-content"]')).toHaveAttribute(
      "data-side",
      "bottom",
    );
  });
}
