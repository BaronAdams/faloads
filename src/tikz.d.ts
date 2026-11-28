declare module "node-tikzjax/dist/library" {
  export const pages: number;
  export function deleteEverything(): void;
  export function writeFileSync(name: string, value: Uint8Array): void;
  export function readFileSync(name: string): Uint8Array;
  export function setMemory(buffer: ArrayBuffer): void;
  export function setInput(input: string): void;
  export function setFileLoader(
    loader: (name: string) => Promise<Uint8Array>,
  ): void;
  export function executeAsync(exports: WebAssembly.Exports): Promise<void>;
}
declare module "opentype.js" {
  export function parse(buffer: ArrayBuffer): {
    getPath(
      text: string,
      x: number,
      y: number,
      fontSize: number,
    ): { toPathData(precision: number): string };
  };
}
