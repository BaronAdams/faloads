/** Package the pinned Python/WASM runtime locally; never fetch a CDN at runtime. */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules/pyodide");
const destination = join(root, "public/ec2-runtime");
const metadata = JSON.parse(readFileSync(join(source, "package.json"), "utf8"));
if (metadata.version !== "0.27.7")
  throw Error("Unexpected EC2 runtime version");
mkdirSync(destination, { recursive: true });
for (const file of [
  "pyodide.mjs",
  "pyodide.asm.js",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide-lock.json",
])
  copyFileSync(join(source, file), join(destination, file));
writeFileSync(
  join(destination, "NOTICE.txt"),
  `Pyodide ${metadata.version} (${metadata.license}).\nSource: https://github.com/pyodide/pyodide/tree/0.27.7\nIncludes CPython (PSF license) and Emscripten runtime components.\n`,
);
