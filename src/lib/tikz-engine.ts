import * as library from "node-tikzjax/dist/library";
const base = "/tikz-runtime/";
let resources: Promise<[Uint8Array, Uint8Array]> | undefined;
async function unzip(path: string) {
  const response = await fetch(base + path);
  if (!response.ok || !response.body)
    throw Error("Moteur LaTeX local indisponible.");
  return new Uint8Array(
    await new Response(
      response.body.pipeThrough(new DecompressionStream("gzip")),
    ).arrayBuffer(),
  );
}
export async function compileTikz(source: string) {
  try {
    const [core, code] = await (resources ??= Promise.all([
      unzip("core.dump.bin"),
      unzip("tex.wasm.bin"),
    ]));
    library.deleteEverything();
    library.writeFileSync("input.tex", new TextEncoder().encode("\n" + source));
    const memory = new WebAssembly.Memory({
      initial: library.pages,
      maximum: library.pages,
    });
    new Uint8Array(memory.buffer).set(core);
    library.setMemory(memory.buffer);
    library.setInput(" input.tex \n\\end\n");
    library.setFileLoader(async (path: string) => {
      const file = path.replace(/^\/tex_files\//, "");
      if (file.includes("..")) throw Error("Invalid TeX path");
      const response = await fetch(base + "tex_files/" + file);
      if (!response.ok) throw Error("TeX file not found");
      return new Uint8Array(await response.arrayBuffer());
    });
    const module = await WebAssembly.compile(code as BufferSource);
    const wasm = await WebAssembly.instantiate(module, {
      library,
      env: { memory },
    });
    await library.executeAsync(wasm.exports);
    const dvi = new Uint8Array(library.readFileSync("input.dvi"));
    const log = new TextDecoder().decode(library.readFileSync("input.log"));
    library.deleteEverything();
    return { dvi, log };
  } finally {
    library.deleteEverything();
  }
}
