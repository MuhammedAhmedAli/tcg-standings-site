/**
 * Pinned header row for long tables.
 *
 * Tables sit in a sideways-scrolling frame (overflow-x: auto), which stops `position: sticky` from
 * pinning the header to the window. So once a long table's real header scrolls out of view, show a
 * copy of it fixed to the top of the window, sized to the real columns and scrolled sideways with
 * the frame. Clicks on the copy go to the real header (for sorting); screen readers skip the copy.
 */

const MIN_ROWS = 12;

function pin(frame: HTMLElement) {
  const table = frame.querySelector("table");
  const head = table?.tHead;
  if (!table || !head || table.tBodies[0]!.rows.length < MIN_ROWS) return;

  const bar = document.createElement("div");
  bar.className = "pinned-head";
  bar.setAttribute("aria-hidden", "true");
  bar.hidden = true;
  const copy = document.createElement("table");
  copy.id = table.id ? `${table.id}-pinned` : "";
  bar.append(copy);
  frame.after(bar);

  const rebuild = () => {
    copy.replaceChildren(head.cloneNode(true));
    copy.querySelectorAll("button, a").forEach((el) => el.setAttribute("tabindex", "-1"));
    copy.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
    if (!bar.hidden) layout();
  };

  const layout = () => {
    const frameBox = frame.getBoundingClientRect();
    bar.style.left = `${frameBox.left}px`;
    bar.style.width = `${frame.clientWidth}px`;
    copy.style.width = `${table.offsetWidth}px`;
    const real = head.rows[0]!.cells;
    const copied = copy.tHead!.rows[0]!.cells;
    for (let i = 0; i < real.length; i++) {
      // Match columns hidden by CSS (e.g. the phone column set).
      copied[i]!.style.display = getComputedStyle(real[i]!).display === "none" ? "none" : "";
      const w = `${real[i]!.getBoundingClientRect().width}px`;
      copied[i]!.style.width = w;
      copied[i]!.style.minWidth = w;
      copied[i]!.style.maxWidth = w;
    }
    bar.scrollLeft = frame.scrollLeft;
  };

  const update = () => {
    const box = table.getBoundingClientRect();
    const headHeight = head.offsetHeight;
    // Show once the real header is gone, and hide again before the last rows leave the screen.
    const show = box.top < 0 && box.bottom > headHeight * 2 && frame.offsetParent !== null;
    if (show && bar.hidden) {
      bar.hidden = false;
      layout();
    } else if (!show && !bar.hidden) {
      bar.hidden = true;
    }
  };

  // Forward clicks on the copy to the matching real header button.
  copy.addEventListener("click", (e) => {
    const th = (e.target as Element).closest("th");
    if (!th) return;
    const i = Array.from(th.parentElement!.children).indexOf(th);
    head.rows[0]!.cells[i]?.querySelector("button")?.click();
  });

  new MutationObserver(rebuild).observe(head, { attributes: true, subtree: true, childList: true });
  new ResizeObserver(() => !bar.hidden && layout()).observe(table);
  frame.addEventListener("scroll", () => (bar.scrollLeft = frame.scrollLeft), { passive: true });
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", () => {
    update();
    if (!bar.hidden) layout();
  });
  rebuild();
  update();
}

document.querySelectorAll<HTMLElement>(".table-frame").forEach(pin);
