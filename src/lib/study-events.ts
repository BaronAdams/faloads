export const studyAction = (action: string) =>
  window.dispatchEvent(new CustomEvent("study-action", { detail: action }));
