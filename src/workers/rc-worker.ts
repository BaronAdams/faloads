import { runLocalRC, rcError } from "../lib/rc-runtime";
self.onmessage = async (event) => {
  const { id, model } = event.data;
  let calculating = false;
  try {
    const result = await runLocalRC(model, (phase) => {
      calculating ||= phase.startsWith("Dimensionnement");
      self.postMessage({ id, phase });
    });
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: rcError(error), bootError: !calculating });
  }
};
