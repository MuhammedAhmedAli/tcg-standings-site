/*
 * Theme state after load. The first paint is handled by the inline script in Base.astro, which
 * reads the same "theme" key; this module flips the theme and keeps it in step with the system
 * setting (until someone picks one) and with other open tabs.
 */
export type Theme = "light" | "dark";

const KEY = "theme";
const root = document.documentElement;
const light = matchMedia("(prefers-color-scheme: light)");

export const currentTheme = (): Theme => (root.dataset.theme === "light" ? "light" : "dark");

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

export function applyTheme(theme: Theme, remember = false) {
  if (remember) {
    try {
      localStorage.setItem(KEY, theme);
    } catch {}
  }
  if (theme === currentTheme()) return;
  // Swap every colour in one frame; without this each link and button fades on its own timer.
  root.classList.add("theme-swap");
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#f4f3f1" : "#111111");
  root.offsetWidth; // flush styles before transitions come back
  requestAnimationFrame(() => root.classList.remove("theme-swap"));
  document.dispatchEvent(new CustomEvent("themechange"));
}

light.addEventListener("change", () => {
  if (!stored()) applyTheme(light.matches ? "light" : "dark");
});
addEventListener("storage", (e) => {
  if (e.key === KEY) applyTheme(stored() ?? (light.matches ? "light" : "dark"));
});
