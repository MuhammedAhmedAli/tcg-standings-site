/*
 * Page-to-page transitions, using cross-document view transitions (CSS `@view-transition` in
 * global.css). Browsers without them, and anyone who asks for reduced motion, get plain loads.
 *
 * The whole page crossfades. When a player's name is clicked (or the row it sits in), that name
 * also slides and grows into the heading of the player page. This half tags the clicked name on
 * the way out; the inline script in Base.astro tags the heading on the way in.
 */
import { slugify } from "../data/stats";

const NAME = "player-name";
let clicked: HTMLAnchorElement | null = null;

// Row presses arrive here too: nav-progress.ts follows them by clicking the row's link, and that
// inner click lands before the outer one (whose target is the cell), so only links overwrite it.
document.addEventListener("click", (e) => {
  const a = (e.target as Element | null)?.closest?.("a");
  if (a) clicked = a;
});

/** The player slug a link points at, if it is a link to a player page. */
function playerSlug(url: string): string | null {
  return new URL(url, location.href).pathname.match(/\/players\/([^/]+)\/?$/)?.[1] ?? null;
}

type SwapEvent = Event & { viewTransition: { finished: Promise<void> } | null; activation: { entry: { url: string } } | null };

window.addEventListener("pageswap", (event) => {
  const e = event as SwapEvent;
  if (!e.viewTransition || !e.activation || !clicked) return;
  const slug = playerSlug(e.activation.entry.url);
  // Only the player's own name morphs: not "Compare with…" or other links to the same page.
  if (!slug || playerSlug(clicked.href) !== slug || slugify(clicked.textContent ?? "") !== slug) return;
  // A player page already names its heading; hand the name to the clicked link instead.
  document.querySelectorAll<HTMLElement>("[style*='view-transition-name']").forEach((el) => (el.style.viewTransitionName = ""));
  clicked.style.viewTransitionName = NAME;
});

// Back/forward restores this page as it was left, name tag included: clear it.
window.addEventListener("pageshow", () => {
  if (clicked) clicked.style.viewTransitionName = "";
  clicked = null;
});
