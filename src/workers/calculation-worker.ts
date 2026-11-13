import { calculate } from "./calculation";
self.onmessage = (event: MessageEvent<{ kind: string; model: unknown }>) => {
  try {
    self.postMessage({ result: calculate(event.data.kind, event.data.model) });
  } catch (e) {
    self.postMessage({
      error:
        e instanceof Error
          ? e.message
          : "Calcul impossible. Vérifiez le modèle.",
    });
  }
};
