// Names the conformance case under the pointer, in the line under its own
// corpus. The cells are small and a native tooltip is slow; the line is neither.

for (const tally of document.querySelectorAll<HTMLElement>(".tally")) {
  const caption = tally.querySelector<HTMLElement>("[data-cell-caption]");
  if (!caption) continue;
  const rest = caption.textContent;
  tally.addEventListener("pointerover", (ev) => {
    const cell = (ev.target as HTMLElement).closest<HTMLElement>(".cell");
    if (!cell) return;
    caption.textContent = `${cell.classList.contains("accept") ? "Accept" : "Refuse"}: ${cell.title}`;
  });
  tally.addEventListener("pointerleave", () => {
    caption.textContent = rest;
  });
}
