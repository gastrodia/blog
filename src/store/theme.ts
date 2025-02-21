import { atom, onMount } from "nanostores";
export type Theme = "light" | "dark";
export const theme = atom<Theme>("light");

onMount(theme, () => {
  const applyTheme = (value: Theme) => {
    document.firstElementChild?.setAttribute("data-theme", value);
    localStorage.setItem("theme", value);
  };
  const htmlTheme = document.firstElementChild?.getAttribute("data-theme");
  const realTheme = htmlTheme === "dark" ? "dark" : "light";
  theme.set(realTheme);

  // 可选：监听系统主题变化
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const listener = (e: MediaQueryListEvent) =>
    theme.set(e.matches ? "dark" : "light");

  mediaQuery.addEventListener("change", listener);

  const unsubscribe = theme.listen(applyTheme);
  return () => {
    unsubscribe();
    mediaQuery.removeEventListener("change", listener);
  };
});
