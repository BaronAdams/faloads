import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./lib/theme";
import { WorkspaceProvider } from "./lib/workspace";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "./components/ui/sonner";
import { diagnostic } from "./lib/storage";
import { Button } from "./components/ui/button";
import "./index.css";
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error(error);
    diagnostic("render.error");
  }
  render() {
    return this.state.failed ? (
      <div className="boot-screen">
        <div className="brand-mark">σ</div>
        <h1>L’interface a rencontré une erreur</h1>
        <p>
          Les données enregistrées sont conservées. Rechargez l’accueil pour
          reprendre votre travail.
        </p>
        <Button
          onClick={() => {
            location.hash = "/";
            location.reload();
          }}
        >
          Revenir à l’accueil
        </Button>
      </div>
    ) : (
      this.props.children
    );
  }
}
(
  window as Window & { __STRUCTCALC_BOOTSTRAPPED__?: boolean }
).__STRUCTCALC_BOOTSTRAPPED__ = true;
window.addEventListener("error", () => diagnostic("javascript.error"));
window.addEventListener("unhandledrejection", () =>
  diagnostic("promise.error"),
);
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <TooltipProvider>
          <WorkspaceProvider>
            <App />
            <Toaster richColors position="bottom-right" />
          </WorkspaceProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
