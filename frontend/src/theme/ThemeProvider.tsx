import { createContext, useContext, type ReactNode } from "react";
import { useTheme as useSharedTheme, type Theme } from "../viewmodels/theme/useTheme";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/** Legacy pages share the studio's theme store (key `studio_theme`, default dark) so both UIs always agree. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { theme, toggle } = useSharedTheme();
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme: toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
