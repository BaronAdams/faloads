import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const main = join(root, "src-tauri/gen/android/app/src/main");
async function activities(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await activities(path)));
    else if (entry.name === "MainActivity.kt") files.push(path);
  }
  return files;
}
const files = await activities(main);
if (files.length !== 1)
  throw Error(`Expected one generated MainActivity.kt; found ${files.length}`);
const generated = await readFile(files[0], "utf8");
const packageLine = generated.match(/^package .+$/m)?.[0];
if (!packageLine || !generated.includes("TauriActivity"))
  throw Error("Unexpected Tauri Android activity template");
const template = await readFile(
  join(root, "src-tauri/mobile/android/MainActivity.kt"),
  "utf8",
);
await writeFile(files[0], template.replace("__PACKAGE__", packageLine));
console.log("Configured Android system-bar and display-cutout insets");
