// Curves below the first screen draw when they are scrolled to — once, on a
// clock, so a reader who stops scrolling never sees one half-drawn. Without
// this module, or for a reader who has asked for less motion, they are simply
// drawn.

if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const seen = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).dataset["draw"] = "in";
        seen.unobserve(entry.target);
      }
    },
    { threshold: 0.2 },
  );
  for (const el of document.querySelectorAll<HTMLElement>("[data-draw]")) {
    // Already on screen at load: leave it drawn rather than blank it to redraw.
    if (el.getBoundingClientRect().top < innerHeight) continue;
    el.dataset["draw"] = "wait";
    seen.observe(el);
  }
}
