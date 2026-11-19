/** Exercise the packaged Tauri release, real WebView2 and Rust IPC, not Vite. */
import { spawn, execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
if (process.platform !== "win32" || process.env.CI !== "true")
  throw Error("This script runs only on an isolated Windows CI runner.");
const executable = resolve(process.argv[2]);
mkdirSync("native-test-results", { recursive: true });
let savedId;
async function checkWorkbenchLayout(page) {
  await page
    .getByRole("button", { name: "Enregistrer", exact: true })
    .scrollIntoViewIfNeeded();
  const layout = await page.evaluate(() => {
    const rect = (selector) => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    return {
      width: innerWidth,
      height: innerHeight,
      header: rect(".project-header"),
      menubar: rect(".desktop-menubar"),
      footer: rect(".desktop-statusbar"),
      save: rect('[data-tour="save"]'),
    };
  });
  expect(layout.header.height).toBe(layout.width > 1000 ? 104 : 128);
  expect(layout.menubar.height).toBe(28);
  expect(layout.header.y).toBe(28);
  expect(layout.save.x + layout.save.width).toBeLessThanOrEqual(
    layout.width + 1,
  );
  if (layout.width > 1000) {
    expect(layout.footer.height).toBe(28);
    expect(
      Math.abs(layout.footer.y + layout.footer.height - layout.height),
    ).toBeLessThanOrEqual(2);
  }
  return layout;
}
for (const [i, mode] of ["default", "compatibility"].entries()) {
  const port = 9432 + i,
    errors = [],
    processHandle = spawn(
      executable,
      [
        `--ci-smoke-port=${port}`,
        ...(mode === "compatibility" ? ["--compatibility"] : []),
      ],
      {
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  let spawnError;
  processHandle.on("error", (error) => {
    spawnError = error;
  });
  for (const [name, stream] of [
    ["stdout", processHandle.stdout],
    ["stderr", processHandle.stderr],
  ]) {
    stream.on("data", (data) =>
      appendFileSync(`native-test-results/${mode}-${name}.txt`, data),
    );
  }
  let browser, layout, buildingLayout;
  try {
    let ready = false;
    for (let retry = 0; retry < 120; retry++) {
      if (spawnError) throw spawnError;
      if (processHandle.exitCode !== null)
        throw Error(`Native process exited: ${processHandle.exitCode}`);
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
          signal: AbortSignal.timeout(1000),
        });
        if (response.ok && (await response.json()).webSocketDebuggerUrl) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!ready)
      throw Error(
        `WebView2 did not expose its CI diagnostic endpoint on 127.0.0.1:${port}. See the native process and stderr diagnostics.`,
      );
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const context = browser.contexts()[0];
    let page = context.pages().find((p) => !p.url().startsWith("devtools:"));
    if (!page) page = await context.waitForEvent("page");
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await expect(page.locator("html")).toHaveAttribute(
      "data-app-ready",
      "true",
      { timeout: 30000 },
    );
    expect(await page.evaluate(() => Boolean(window.__TAURI_INTERNALS__))).toBe(
      true,
    );
    expect(
      await page.evaluate(() =>
        window.__TAURI_INTERNALS__.invoke("desktop_menu_ready"),
      ),
    ).toBe(false);
    if (mode === "compatibility") {
      await expect(page.locator(".desktop-menubar")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute(
        "data-native-menu",
        "false",
      );
    }
    if (mode === "default") {
      await page
        .getByRole("button", { name: "Passer la présentation" })
        .click();
      await page.getByRole("link", { name: /Analyse de poutres/ }).click();
      await page
        .getByLabel("Nom du projet", { exact: true })
        .fill("Verification native Windows");
      await page
        .getByRole("button", { name: "Créer l’étude", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Explorer librement", exact: true })
        .click();
      await expect(page.locator(".desktop-menubar")).toBeVisible();
      layout = await checkWorkbenchLayout(page);
      const analysisHeader = page.getByTestId("project-workbench-header");
      await expect(
        analysisHeader.getByRole("button", {
          name: "Retour aux calculs",
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(analysisHeader.getByRole("switch")).toHaveCount(0);
      await expect(
        analysisHeader.getByRole("button", {
          name: "Calcul simplifié G/Q",
          exact: true,
        }),
      ).toHaveCount(0);

      // Exercise the visible, themed menu in the real packaged EXE.
      await page
        .getByRole("menubar")
        .getByRole("menuitem", { name: "Calcul", exact: true })
        .click();
      await page
        .getByRole("menuitem", { name: "Lancer le calcul", exact: true })
        .click();
      await expect(page.locator(".canvas-result-status")).toContainText(
        "Calcul actualisé",
      );
      await page
        .getByRole("button", { name: "Ouvrir les paramètres", exact: true })
        .click();
      expect(
        (await page.getByRole("dialog").boundingBox()).width,
      ).toBeLessThanOrEqual(600);
      await page
        .getByRole("button", { name: "Revenir au schéma", exact: true })
        .click();
      await expect(page.locator(".canvas-result-status")).toContainText(
        "Calcul actualisé",
      );
      await page
        .getByRole("button", { name: "Ouvrir les résultats", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toContainText("Flèche admissible");
      await expect(page.getByTestId("deflection-check")).toContainText(
        "Critère respecté",
      );
      await page.screenshot({
        path: "native-test-results/windows-deflection.png",
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Fermer le panneau", exact: true })
        .click();
      await page.getByRole("button", { name: "Moment M", exact: true }).click();
      const axis = await page.getByTestId("diagram-axis").boundingBox();
      await page.mouse.move(axis.x + axis.width * 0.5, axis.y - 50);
      await expect(page.getByTestId("structure-probe")).toContainText("kN·m");
      await expect(page.getByTestId("probe-guide")).toHaveAttribute(
        "stroke",
        "white",
      );
      await page.screenshot({
        path: "native-test-results/windows-probe.png",
        fullPage: true,
      });
      const station = Number(
        await page.getByTestId("structure-probe").getAttribute("data-station"),
      );
      await page.keyboard.press("3");
      const stationInput = page.getByLabel("Position · m", { exact: true });
      await expect(stationInput).toBeFocused();
      await page.keyboard.type(",5");
      expect(
        Number(
          await page
            .getByTestId("structure-probe")
            .getAttribute("data-station"),
        ),
      ).toBeCloseTo(station, 5);
      await page.keyboard.press("Enter");
      expect(
        Number(
          await page
            .getByTestId("structure-probe")
            .getAttribute("data-station"),
        ),
      ).toBeCloseTo(3.5, 5);
      await page
        .getByRole("button", { name: "Fermer la lecture", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Structure", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Enregistrer", exact: true })
        .click();
      await expect(page).toHaveURL(/project\//);
      savedId = page.url().split("/project/")[1];
      await page.screenshot({
        path: "native-test-results/windows-beam.png",
        fullPage: true,
      });
      await page.evaluate(() => (location.hash = "/new/building"));
      await page
        .getByLabel("Nom du projet", { exact: true })
        .fill("Verification du ruban bâtiment");
      await page
        .getByRole("button", { name: "Créer l’étude", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Explorer librement", exact: true })
        .click();
      const header = page.getByTestId("project-workbench-header");
      await expect(
        page.getByRole("navigation", { name: "Niveaux du bâtiment" }),
      ).toContainText("RDC");
      await expect(header.getByRole("switch")).toHaveCount(0);
      await expect(header.locator("[data-critical-icon=column]")).toHaveCount(
        1,
      );
      await expect(header.locator("[data-critical-icon=beam]")).toHaveCount(1);
      await expect(page.locator(".project-page > header")).toHaveCount(1);
      await expect(
        page.locator(
          ".canvas-field-controls, .canvas-tools-left, .canvas-tools-right",
        ),
      ).toHaveCount(0);
      await expect(header.locator(".study-name-button")).toHaveCount(0);
      await expect(
        header.getByRole("button", {
          name: "Poteau le plus chargé",
          exact: true,
        }),
      ).toHaveText("max");
      buildingLayout = await checkWorkbenchLayout(page);
      await header.getByRole("button", { name: "3D", exact: true }).click();
      await expect(
        header.getByRole("button", { name: "Options de vue", exact: true }),
      ).toHaveCount(1);
      await expect(page.getByLabel("Rotation 3D", { exact: true })).toHaveCount(
        0,
      );
      await expect(
        page.getByLabel("Inclinaison 3D", { exact: true }),
      ).toHaveCount(0);
      const scene = page.getByTestId("building-3d");
      await expect(scene).toBeVisible();
      await expect(
        header.getByRole("group", { name: "Niveau actif · RDC", exact: true }),
      ).toBeVisible();
      await header
        .getByRole("button", { name: "Grille du niveau actif", exact: true })
        .click();
      const grid = page.getByRole("dialog", {
        name: "Grille · RDC",
        exact: true,
      });
      await expect(
        grid.getByLabel("X · travée 3", { exact: true }),
      ).toBeVisible();
      await grid
        .getByRole("button", { name: "Revenir au schéma", exact: true })
        .click();
      const yaw = await scene.getAttribute("data-yaw");
      const canvas = await page.getByTestId("playground").boundingBox();
      await page.mouse.move(
        canvas.x + canvas.width * 0.5,
        canvas.y + canvas.height * 0.6,
      );
      await page.mouse.down();
      await page.mouse.move(
        canvas.x + canvas.width * 0.6,
        canvas.y + canvas.height * 0.65,
        { steps: 8 },
      );
      await page.mouse.up();
      await expect(scene).not.toHaveAttribute("data-yaw", yaw);
      expect((await header.boundingBox()).height).toBe(
        buildingLayout.header.height,
      );
      await page.screenshot({
        path: "native-test-results/windows-building.png",
        fullPage: true,
      });
      await header
        .getByRole("button", { name: "Calculer le bâtiment", exact: true })
        .click();
      await expect(page.getByTestId("building-cumulative")).toBeVisible();
      await page
        .getByRole("button", { name: "Fermer le panneau", exact: true })
        .click();
      await expect(page.locator('[role="dialog"]')).toHaveCount(0);
      const column = scene.locator('[data-element*="|node|1,1"]');
      await column.press("Enter");
      await page
        .getByRole("button", {
          name: "Isoler les annotations de cet élément",
          exact: true,
        })
        .click();
      await expect(scene.getByTestId("building-annotation")).toHaveCount(1);
      await expect(scene.getByTestId("building-annotation")).toContainText(
        "kN",
      );
      await expect(
        scene.locator(".building-annotation-layer"),
      ).not.toContainText(/Poutre|Poteau/);
      await page.screenshot({
        path: "native-test-results/windows-building-focus.png",
        fullPage: true,
      });
    } else {
      await page.evaluate((id) => (location.hash = `/project/${id}`), savedId);
      await expect(
        page.getByRole("heading", {
          name: "Verification native Windows",
          exact: true,
        }),
      ).toHaveCount(1);
      layout = await checkWorkbenchLayout(page);
      await page.getByRole("button", { name: "Calculer", exact: true }).click();
      await expect(page.locator(".canvas-result-status")).toContainText(
        "Calcul actualisé",
      );
      await page
        .getByRole("button", { name: "Ouvrir les résultats", exact: true })
        .click();
      await expect(page.locator(".metric").first()).toContainText("111,00");
      await expect(page.getByTestId("deflection-check")).toContainText(
        "Critère respecté",
      );
      await expect
        .poll(async () => {
          const box = await page.getByRole("dialog").boundingBox();
          return box.x + box.width;
        })
        .toBeLessThanOrEqual((await page.evaluate(() => innerWidth)) + 1);
      await page.screenshot({
        path: "native-test-results/windows-compatibility.png",
        fullPage: true,
      });
    }
    await page.evaluate(() => document.fonts.ready);
    if (errors.length) throw Error(errors.join("\n"));
    writeFileSync(
      `native-test-results/${mode}.json`,
      JSON.stringify(
        {
          mode,
          success: true,
          url: page.url(),
          nativeStorageRestored: mode === "compatibility",
          layout,
          buildingLayout,
        },
        null,
        2,
      ),
    );
    console.log(
      `PASS ${mode}: native Tauri window, WebView2 content, working solver and Rust persistence.`,
    );
  } catch (error) {
    writeFileSync(
      `native-test-results/${mode}-error.txt`,
      String(error) + "\n" + errors.join("\n"),
    );
    try {
      const processes = execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "Get-Process StructCalc,msedgewebview2 -ErrorAction SilentlyContinue | Select-Object Id,ProcessName,MainWindowTitle | ConvertTo-Json",
        ],
        { encoding: "utf8", timeout: 10000 },
      );
      writeFileSync(`native-test-results/${mode}-processes.json`, processes);
    } catch {}
    if (browser) {
      const p = browser.contexts()[0]?.pages()[0];
      if (p)
        await p
          .screenshot({ path: `native-test-results/${mode}-failure.png` })
          .catch(() => {});
    }
    throw error;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (processHandle.pid)
      try {
        execFileSync("taskkill", [
          "/PID",
          String(processHandle.pid),
          "/T",
          "/F",
        ]);
      } catch {}
  }
}
