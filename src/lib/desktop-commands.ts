import { useEffect, useRef } from "react";

export function desktopCommand(command: string) {
  window.dispatchEvent(
    new CustomEvent("desktop:command", { detail: command, cancelable: true }),
  );
}

/** Native menus and their accessible preview use the same project actions. */
export function useDesktopCommands(
  handlers: Record<string, (() => void) | undefined>,
) {
  const latest = useRef(handlers);
  latest.current = handlers;
  useEffect(() => {
    const run = (event: Event) => {
      if (event.defaultPrevented) return;
      const handler = latest.current[(event as CustomEvent<string>).detail];
      if (handler) {
        event.preventDefault();
        handler();
      }
    };
    window.addEventListener("desktop:command", run);
    return () => window.removeEventListener("desktop:command", run);
  }, []);
}
