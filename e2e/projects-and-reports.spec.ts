import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createStudy, parameters } from "./helpers";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Passer la présentation" }).click();
});

test("creates from the project catalogue, autosaves edits and restores model previews without Save", async ({
  page,
}) => {
  await expect(
    page.getByRole("link", { name: "Ouvrir un projet", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Nouveau projet", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Ouvrir un projet", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Nouveau projet", exact: true })
    .click();
  const picker = page.getByRole("dialog", {
    name: "Quel projet voulez-vous créer ?",
  });
  await expect(picker.locator(".picker-list > button")).toHaveCount(13);
  await picker.getByRole("button", { name: /Analyse de poutres/ }).click();
  await expect(page).toHaveURL(/projects/);
  await createStudy(page, "Horizon — poutre principale");
  await expect(page).toHaveURL(/project\//);
  const url = page.url();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("structcalc.workspace.v1")!).projects
          .length,
    ),
  ).toBe(1);
  await page.goto("/#/projects");
  const preview = page.getByTestId("project-preview");
  await expect(preview).toHaveJSProperty("naturalWidth", 480);
  const before = await preview.getAttribute("src");
  await page.locator(".saved-project-main").click();
  await parameters(page);
  await page
    .getByRole("dialog")
    .getByLabel("Longueur L", { exact: true })
    .fill("10");
  await page
    .getByRole("button", { name: "Valider les paramètres", exact: true })
    .click();
  // Leave before the debounce: route teardown must flush the latest model.
  await page.locator('a[href="#/projects"]:visible').first().click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("structcalc.workspace.v1")!)
            .projects[0].data.L,
      ),
    )
    .toBe(10);
  await expect(preview).not.toHaveAttribute("src", before!);
  await page.reload();
  await expect(preview).toHaveJSProperty("naturalWidth", 480);
  await page.goto(url);
  await parameters(page);
  await expect(
    page.getByRole("dialog").getByLabel("Longueur L", { exact: true }),
  ).toHaveValue("10");
});

test("chooses report steps and detail independently and downloads a real PDF", async ({
  page,
}) => {
  await page.goto("/#/new/beam");
  await createStudy(page, "Note — poutre A");
  await page
    .getByRole("button", { name: "Préparer la note de calcul", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Préparer la note de calcul",
    exact: true,
  });
  await expect(dialog.getByRole("checkbox")).toHaveCount(7);
  await dialog.getByRole("button", { name: "Tout retirer" }).click();
  await expect(
    dialog.getByRole("button", { name: "Générer le PDF" }),
  ).toBeDisabled();
  await dialog.getByRole("checkbox", { name: /Réactions d’appui/ }).check();
  await dialog
    .getByRole("group", { name: "Détail · Réactions d’appui", exact: true })
    .getByRole("radio", { name: "Démarche complète" })
    .check();
  await expect(dialog.getByRole("checkbox", { checked: true })).toHaveCount(1);
  const b = (await dialog.boundingBox())!;
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  const downloadEvent = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Générer le PDF" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toContain("note-de-calcul.pdf");
  const bytes = await readFile((await download.path())!);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(10000);
  await expect(dialog).toHaveCount(0);
});

test("successive direct creations preserve two independent saved studies", async ({
  page,
}) => {
  await page.goto("/#/new/beam");
  await createStudy(page, "Poutre conservée");
  const first = page.url();
  await parameters(page);
  await page
    .getByRole("dialog")
    .getByLabel("Longueur L", { exact: true })
    .fill("9");
  await page
    .getByRole("button", { name: "Valider les paramètres", exact: true })
    .click();
  await page.goto("/#/new/frame");
  await createStudy(page, "Portique indépendant");
  expect(page.url()).not.toBe(first);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("structcalc.workspace.v1")!).projects
            .length,
      ),
    )
    .toBe(2);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Portique indépendant", exact: true }),
  ).toHaveCount(1);
  await page.goto(first);
  await expect(
    page.getByRole("heading", { name: "Poutre conservée", exact: true }),
  ).toHaveCount(1);
  await parameters(page);
  await expect(
    page.getByRole("dialog").getByLabel("Longueur L", { exact: true }),
  ).toHaveValue("9");
});

test("keeps report choices and explains an invalid structural model instead of exporting", async ({
  page,
}) => {
  await page.goto("/#/new/beam");
  await createStudy(page);
  await page.evaluate(() => {
    const workspace = JSON.parse(
      localStorage.getItem("structcalc.workspace.v1")!,
    );
    workspace.projects[0].data.supports = [];
    localStorage.setItem("structcalc.workspace.v1", JSON.stringify(workspace));
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Préparer la note de calcul", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Préparer la note de calcul",
    exact: true,
  });
  await dialog.getByRole("button", { name: "Générer le PDF" }).click();
  await expect(dialog.getByRole("alert")).not.toBeEmpty();
  await expect(
    dialog.getByRole("button", { name: "Générer le PDF" }),
  ).toBeEnabled();
  await dialog.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test("provides explicit profile and preference confirmations", async ({
  page,
}) => {
  await page.goto("/#/profile");
  await page
    .getByRole("button", { name: "Valider le profil", exact: true })
    .click();
  await expect(
    page.getByText("Profil enregistré.", { exact: true }),
  ).toBeVisible();
  await page.goto("/#/settings");
  await page
    .getByRole("button", { name: "Valider les paramètres", exact: true })
    .click();
  await expect(
    page.getByText("Paramètres enregistrés.", { exact: true }),
  ).toBeVisible();
});

test("an undo during a slow native write persists the reverted model", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Native save queue");
  await page.addInitScript(() => {
    Object.assign(window, {
      isTauri: true,
      __TAURI_INTERNALS__: {
        invoke: async (command: string, args: any) => {
          if (command === "read_workspace")
            return JSON.parse(
              localStorage.getItem("structcalc.workspace.v1") ?? "null",
            );
          if (command === "write_workspace") {
            if (args.value.projects[0]?.data.L === 9)
              await new Promise<void>((resolve) => {
                (window as any).__releaseSave = resolve;
              });
            localStorage.setItem(
              "structcalc.workspace.v1",
              JSON.stringify(args.value),
            );
          }
          return null;
        },
      },
    });
  });
  await page.reload();
  await page.goto("/#/new/beam");
  await createStudy(page);
  await page.getByLabel("Longueur L", { exact: true }).fill("9");
  await expect
    .poll(() => page.evaluate(() => typeof (window as any).__releaseSave))
    .toBe("function");
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(page.getByLabel("Longueur L", { exact: true })).toHaveValue("8");
  await expect(page.locator("[data-autosave-status]")).toHaveAttribute(
    "data-autosave-status",
    "pending",
  );
  await expect(page.locator("[data-autosave-status]")).toHaveAttribute(
    "data-autosave-status",
    "saving",
  );
  await page.evaluate(() => (window as any).__releaseSave());
  await expect(page.locator("[data-autosave-status]")).toHaveAttribute(
    "data-autosave-status",
    "saved",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("structcalc.workspace.v1")!).projects[0]
          .data.L,
    ),
  ).toBe(8);
  await page.reload();
  await expect(page.getByLabel("Longueur L", { exact: true })).toHaveValue("8");
  // A second undo happens before the debounce can start any write. The model
  // is already persisted, so its status must return to saved without a timer.
  await page.clock.install({ time: new Date("2026-11-26T10:00:00Z") });
  await page.clock.pauseAt(new Date("2026-11-26T10:00:01Z"));
  await page.getByLabel("Longueur L", { exact: true }).fill("10");
  await expect(page.locator("[data-autosave-status]")).toHaveAttribute(
    "data-autosave-status",
    "pending",
  );
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(page.getByLabel("Longueur L", { exact: true })).toHaveValue("8");
  await expect(page.locator("[data-autosave-status]")).toHaveAttribute(
    "data-autosave-status",
    "saved",
  );
});
