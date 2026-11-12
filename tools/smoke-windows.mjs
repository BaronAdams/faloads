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
  let browser;
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
    if (mode === "default") {
      await page
        .getByRole("button", { name: "Passer la présentation" })
        .click();
      await page.getByRole("link", { name: /Calculateur de poutres/ }).click();
      await expect(
        page.getByRole("heading", {
          name: "Calculateur de poutres",
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByLabel("Nom du projet")
        .fill("Verification native Windows");
      await page
        .getByRole("button", { name: "Enregistrer", exact: true })
        .click();
      await expect(page).toHaveURL(/project\//);
      savedId = page.url().split("/project/")[1];
      await page.screenshot({
        path: "native-test-results/windows-beam.png",
        fullPage: true,
      });
    } else {
      await page.evaluate((id) => (location.hash = `/project/${id}`), savedId);
      await expect(page.getByLabel("Nom du projet")).toHaveValue(
        "Verification native Windows",
      );
      await expect(page.locator(".metric").first()).toContainText("111,00");
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
