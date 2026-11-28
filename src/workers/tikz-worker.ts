/// <reference lib="webworker" />
import { compileTikz } from "../lib/tikz-engine";
self.onmessage = async ({ data: { source } }) => {
  try {
    const { dvi, log } = await compileTikz(source);
    self.postMessage({ dvi, log }, [dvi.buffer]);
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error
          ? error.message
          : "Compilation LaTeX impossible.",
    });
  }
};
