/** Test the actual bundle with the Tauri CSP, including local WASM and PDFs. */
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { resolve, extname } from "node:path";
import { chromium, expect } from "@playwright/test";
const root = resolve("dist"),
  config = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
const csp = config.app.security.csp;
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".wasm": "application/wasm",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".zip": "application/zip",
};
const server = createServer((req, res) => {
  const relative = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    ),
    path = resolve(root, relative === "/" ? "index.html" : "." + relative);
  if (!path.startsWith(root + "/") || !existsSync(path)) {
    res.writeHead(404);
    res.end("Missing asset");
    return;
  }
  res.writeHead(200, {
    "Content-Type": mime[extname(path)] || "text/plain",
    "Content-Security-Policy": csp,
  });
  res.end(readFileSync(path));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(url);
  await page.getByRole("button", { name: "Passer la présentation" }).click();
  for (const type of ["column", "beam-size"]) {
    await page.goto(`${url}/#/new/${type}`);
    await page
      .getByLabel("Nom du projet", { exact: true })
      .fill(`Production EC2 ${type}`);
    await page
      .getByRole("button", { name: "Créer l’étude", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Explorer librement", exact: true })
      .click();
    if (type === "beam-size") {
      await page
        .getByRole("button", { name: "Ouvrir les paramètres", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog
        .getByRole("button", { name: "Méthode", exact: true })
        .click();
      await dialog
        .getByRole("combobox", {
          name: "Liaison de la poutre aux appuis",
          exact: true,
        })
        .click();
      await page
        .getByRole("option", { name: "Poutre posée", exact: true })
        .click();
      await dialog
        .getByRole("button", { name: "Appliquer les paramètres", exact: true })
        .click();
    }
    await page
      .getByRole("button", { name: "Calculer le dimensionnement", exact: true })
      .click();
    await expect(page.locator(".rc-workspace-status")).toContainText(
      "Calcul actualisé",
      { timeout: 120000 },
    );
    await page
      .getByRole("button", { name: "Ouvrir les résultats", exact: true })
      .click();
    await expect(page.getByTestId("rc-results")).toContainText(
      type === "column" ? "4 HA12" : "2 HA16",
    );
    await page
      .getByRole("button", { name: "Revenir au schéma", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Préparer la note de calcul", exact: true })
      .click();
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Générer le PDF", exact: true })
      .click();
    const pdf = await download;
    expect(await pdf.failure()).toBeNull();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    console.log("PASS packaged CSP, offline WASM and PDF:", type);
  }
  expect(errors).toEqual([]);
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
