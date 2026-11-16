import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
type Theme = "dark" | "light" | "system";
const ThemeContext = createContext<{
  theme: Theme;
  resolvedTheme: "dark" | "light";
  setTheme: (v: Theme) => void;
}>({ theme: "dark", resolvedTheme: "dark", setTheme: () => {} });
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark"),
    [system, setSystem] = useState<"dark" | "light">(() =>
      matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    );
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)"),
      change = () => setSystem(media.matches ? "dark" : "light");
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  const resolvedTheme = theme === "system" ? system : theme;
  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);
  return (
    <ThemeContext value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext>
  );
}
export const useAppTheme = () => useContext(ThemeContext);
