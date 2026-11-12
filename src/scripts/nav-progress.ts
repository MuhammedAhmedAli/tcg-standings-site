/**
 * Faster page-to-page loads, and a loading bar for the ones that are still slow.
 *
 * Prefetch: hovering or touching a link fetches that page in the background. Pages serves HTML
 * with a 10 minute max-age, so by the time the click lands the page is usually already cached.
 * (Astro's own prefetch ships as a separate hashed file, which a 10-minute-cached old page would
 * look for after a deploy and not find; this stays inline in each page.)
 *
 * Loading bar: a thin bronze line along the top of the window. It waits 150ms after a click before
 * showing, so fast loads never flash it, creeps across while the next page loads, and is gone
 * when that page paints. Anything else that navigates (the format select) fires "nav:start".
 */

const DELAY_MS = 150;
const HOVER_MS = 65;
const bar = document.querySelector<HTMLElement>(".nav-progress");
let timer: number | undefined;

function start() {
  if (!bar || timer !== undefined) return;
  timer = window.setTimeout(() => bar.classList.add("is-on"), DELAY_MS);
}

function reset() {
  window.clearTimeout(timer);
  timer = undefined;
  bar?.classList.remove("is-on");
}

/** Same-site link to another page, followed in this tab. */
function pageLink(target: EventTarget | null): HTMLAnchorElement | null {
  const a = (target as Element | null)?.closest?.("a");
  if (!a || !a.href || a.target || a.hasAttribute("download")) return null;
  const to = new URL(a.href);
  if (to.origin !== location.origin) return null;
  if (to.pathname === location.pathname && to.search === location.search) return null;
  return a;
}

const fetched = new Set<string>();
const linkPrefetch = document.createElement("link").relList?.supports?.("prefetch");
const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;

function prefetch(url: string) {
  url = url.split("#")[0]!;
  if (fetched.has(url) || conn?.saveData) return;
  fetched.add(url);
  if (linkPrefetch) {
    const l = document.createElement("link");
    l.rel = "prefetch";
    l.href = url;
    document.head.append(l);
  } else {
    // Safari has no <link rel="prefetch">; a plain fetch fills the HTTP cache the same way.
    fetch(url, { credentials: "same-origin" }).catch(() => fetched.delete(url));
  }
}

let hover: number | undefined;
document.addEventListener("pointerover", (e) => {
  const a = pageLink(e.target);
  if (!a || e.pointerType !== "mouse") return;
  window.clearTimeout(hover);
  hover = window.setTimeout(() => prefetch(a.href), HOVER_MS);
});
document.addEventListener("pointerout", () => window.clearTimeout(hover));
// Touch: the finger is down ~100ms before the click fires, enough to get the request going.
document.addEventListener("touchstart", (e) => {
  const a = pageLink(e.target);
  if (a) prefetch(a.href);
}, { passive: true });

document.addEventListener("click", (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (pageLink(e.target)) start();
});
document.addEventListener("nav:start", start);

// Coming back with the back button restores this page from memory, bar and all: clear it.
window.addEventListener("pageshow", reset);
