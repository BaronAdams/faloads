// Pinned offline TeX/PGF runtime. No CDN, subprocess or TeX installation at runtime.
import {
  mkdirSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
  createReadStream,
  readdirSync,
  rmSync,
} from "node:fs";
import { createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import tar from "tar-fs";
const source = "node_modules/node-tikzjax",
  dest = "public/tikz-runtime";
if (JSON.parse(readFileSync(`${source}/package.json`)).version !== "1.0.5")
  throw Error("Unexpected TikZ runtime");
mkdirSync(dest, { recursive: true });
for (const file of ["core.dump.gz", "tex.wasm.gz"])
  rmSync(`${dest}/${file}`, { force: true });
for (const file of ["GPL-3.0.txt", "LPPL-1.3c.txt"])
  copyFileSync(`tools/licenses/${file}`, `${dest}/${file}`);
for (const name of ["core.dump.gz", "tex.wasm.gz"])
  copyFileSync(
    `${source}/tex/${name}`,
    `${dest}/${name.replace(".gz", ".bin")}`,
  );
await pipeline(
  createReadStream(`${source}/tex/tex_files.tar.gz`),
  createGunzip(),
  tar.extract(`${dest}/tex_files`),
);
mkdirSync(`${dest}/fonts`, { recursive: true });
for (const name of readdirSync(`${source}/css/bakoma/ttf`))
  copyFileSync(`${source}/css/bakoma/ttf/${name}`, `${dest}/fonts/${name}`);
copyFileSync(`${source}/css/bakoma/LICENCE`, `${dest}/FONT-LICENCE.txt`);
writeFileSync(
  `${dest}/NOTICE.txt`,
  "TikZJax / node-tikzjax 1.0.5 (LPPL-1.3c), https://github.com/prinsss/node-tikzjax.\nDVI converter @prinsss/dvi2html 0.0.1 (GPL-3.0), https://github.com/artisticat1/dvi2html.\nBaKoMa Computer Modern fonts: see FONT-LICENCE.txt.\nBrowser integration and generated plans: CaliSigma Structural.\n",
);
