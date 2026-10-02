import {
  decodePayload,
  encodePayload,
  fmtClock,
  fmtMeasurement,
} from "@coffeejson/core";
import type { CurvePoint, PourSeries } from "./pour-curve.mjs";
import { axisHtml, curveParts } from "./pour-curve.mjs";

// The landing page's document, live. It plays: the curve fills, the clock runs,
// and the line of the file being poured is lit. And it edits: drag a pour and
// the file beside it changes, because the picture and the file are one thing.
// Everything it shows is read back out of the markup the build wrote, so it
// cannot disagree with it. It plays once and stops — a loop would pull the eye
// for as long as the page is open.

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

/** A step as it travels, as far as an edit touches it. */
interface WireStep {
  at_s?: number;
  to_water?: { value?: number };
}

/** Seconds and grams a drag or an arrow key moves a pour by. */
const SNAP = 5;

const snap = (n: number): number => Math.round(n / SNAP) * SNAP;
const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, n));

/** A measurement with its unit in a span, so the unit can be set smaller. */
function unitTail(text: string): string {
  const cut = text.lastIndexOf(" ");
  if (cut < 0) return text;
  return `${text.slice(0, cut)}<span class="unit">${text.slice(cut + 1)}</span>`;
}

function play(root: HTMLElement): void {
  const figure = root.querySelector<HTMLElement>(".curve")!;
  const plot = figure.querySelector<HTMLElement>(".curve-plot")!;
  const axis = figure.querySelector<HTMLElement>(".curve-axis")!;
  const clock = root.querySelector<HTMLElement>("[data-live-clock]")!;
  const water = root.querySelector<HTMLElement>("[data-live-water]")!;
  const controls = root.querySelector<HTMLElement>("[data-live-controls]")!;
  const toggle = root.querySelector<HTMLButtonElement>("[data-live-toggle]")!;
  const reset = root.querySelector<HTMLButtonElement>("[data-live-reset]")!;
  const scrub = root.querySelector<HTMLInputElement>("[data-live-scrub]")!;
  const json = root.querySelector<HTMLElement>(".live-json")!;
  const open = root.querySelector<HTMLAnchorElement>("[data-live-open]")!;
  const state = root.querySelector<HTMLElement>("[data-live-state]")!;

  const end = Number(figure.dataset["end"]);
  const unit = figure.dataset["unit"]!;
  const speed = Number(root.dataset["speed"]);
  const published = root.dataset["payload"]!;
  const dots = [...figure.querySelectorAll<HTMLElement>(".curve-pt")];
  const lines = dots.map((el) =>
    json.querySelector<HTMLElement>(`.ln[data-step="${el.dataset["step"]}"]`),
  );
  const original: CurvePoint[] = dots.map((el) => [
    Number(el.dataset["t"]),
    Number(el.dataset["w"]),
    Number(el.dataset["step"]),
  ]);
  const series: PourSeries = {
    points: original.map((p) => [...p] as CurvePoint),
    end,
    unit,
  };
  const top = Math.max(...original.map(([, w]) => w));
  const fmt = (w: number): string => fmtMeasurement({ value: w, unit });

  let t = end;
  let running = false;
  let last = 0;
  let active = -2;

  // ── Playback ─────────────────────────────────────────────────────────────

  const light = (index: number | null): void => {
    dots.forEach((el, i) => {
      el.classList.toggle("is-active", i === index);
      lines[i]?.classList.toggle("is-active", i === index);
    });
    const line = index === null ? null : lines[index];
    // Scrolls the pane, never the page: `scrollIntoView` would move both. The
    // pane is positioned, so it is the line's offset parent and `offsetTop` is
    // measured inside it.
    if (line)
      json.scrollTo({
        top: line.offsetTop - json.clientHeight / 2 + line.clientHeight / 2,
        behavior: reducedMotion.matches ? "auto" : "smooth",
      });
  };

  const show = (): void => {
    figure.style.setProperty("--p", String(t / end));
    clock.textContent = fmtClock(t);
    let current = -1;
    series.points.forEach(([at], i) => {
      if (at <= t) current = i;
    });
    const level = current < 0 ? 0 : series.points[current]![1];
    figure.style.setProperty("--h", String(level / top));
    water.innerHTML = unitTail(fmt(level));
    scrub.value = String(Math.round(t));
    scrub.setAttribute("aria-valuetext", `${fmtClock(t)}, ${fmt(level)}`);
    // The last frame lights nothing: the brew is over, not on its fifth pour.
    const key = t >= end ? series.points.length : current;
    if (key === active) return;
    active = key;
    dots.forEach((el, i) => {
      el.classList.toggle("is-pending", i > current);
    });
    light(t < end && current >= 0 ? current : null);
  };

  const label = (): void => {
    toggle.textContent = running ? "Pause" : t >= end ? "Replay" : "Play";
  };

  const frame = (now: number): void => {
    if (!running) return;
    t = Math.min(end, t + ((now - last) / 1000) * speed);
    last = now;
    show();
    if (t >= end) stop();
    else requestAnimationFrame(frame);
  };

  const start = (): void => {
    if (running) return;
    if (t >= end) t = 0;
    running = true;
    figure.dataset["playing"] = "";
    last = performance.now();
    label();
    requestAnimationFrame(frame);
  };

  function stop(): void {
    running = false;
    if (t >= end) {
      delete figure.dataset["playing"];
      // Read by the sheet: after the first full playback one pour nudges, once.
      root.dataset["played"] = "";
    }
    label();
  }

  toggle.addEventListener("click", () => (running ? stop() : start()));
  scrub.addEventListener("input", () => {
    stop();
    t = Number(scrub.value);
    figure.dataset["playing"] = "";
    show();
    label();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
  });

  // ── Editing ──────────────────────────────────────────────────────────────

  // A pour can move in time between its neighbors and in weight between theirs,
  // and stays a step short of each: cumulative water rises, and a pour that adds
  // nothing is not a pour. The last pour keeps its weight, because that is the
  // recipe's total and the file states it elsewhere too.
  const bounds = (i: number): { t: [number, number]; w: [number, number] } => {
    const prev = series.points[i - 1];
    const next = series.points[i + 1];
    const own = series.points[i]![1];
    return {
      t: [prev ? prev[0] + SNAP : 0, next ? next[0] - SNAP : end - SNAP],
      w: next ? [(prev ? prev[1] : 0) + SNAP, next[1] - SNAP] : [own, own],
    };
  };

  const describe = (i: number): void => {
    const [at, w] = series.points[i]!;
    const b = bounds(i);
    const el = dots[i]!;
    el.setAttribute("aria-valuenow", String(w));
    el.setAttribute("aria-valuemin", String(b.w[0]));
    el.setAttribute("aria-valuemax", String(b.w[1]));
    el.setAttribute("aria-valuetext", `${fmt(w)} at ${fmtClock(at)}`);
  };

  // The figure is patched in place, never rebuilt: the element being dragged
  // holds the pointer, and a rebuilt one would drop it mid-drag.
  // `editing` is the pour whose axis tick stays whatever it crowds.
  const redraw = (editing = -1): void => {
    const parts = curveParts(series, { keepTick: editing });
    for (const path of figure.querySelectorAll(".curve-area"))
      path.setAttribute("d", parts.area);
    for (const path of figure.querySelectorAll(".curve-line"))
      path.setAttribute("d", parts.line);
    parts.points.forEach((p, i) => {
      const el = dots[i]!;
      el.style.setProperty("--x", `${p.x}%`);
      el.style.setProperty("--y", `${p.up}%`);
      el.classList.toggle("curve-pt--left", p.side === "left");
      // Every pour carries its weight, shown or not: the one being edited
      // shows it whatever the room, because that is the number being changed.
      let tag = el.querySelector<HTMLElement>(".curve-pt-w");
      if (!tag) {
        tag = document.createElement("span");
        tag.className = "curve-pt-w";
        el.append(tag);
      }
      tag.classList.toggle("is-off", !p.side);
      tag.classList.toggle("curve-pt-w--wide", p.wideOnly);
      tag.textContent = p.label;
      // The file's own numbers: `at_s` first, then the `to_water` value, in the
      // order the step's line states them.
      const [atS, value] = lines[i]?.querySelectorAll(".n") ?? [];
      if (atS) atS.textContent = String(p.t);
      if (value) value.textContent = String(p.w);
      describe(i);
    });
    axis.innerHTML = axisHtml(parts.ticks);
  };

  const edited = (): boolean =>
    series.points.some(
      ([at, w], i) => at !== original[i]![0] || w !== original[i]![1],
    );

  // The link carries the document, so an edited curve is an edited link: the
  // published file with these steps' numbers, encoded the way any share is.
  const relink = (): void => {
    const isEdited = edited();
    root.toggleAttribute("data-edited", isEdited);
    reset.hidden = !isEdited;
    let payload = published;
    if (isEdited) {
      const decoded = decodePayload(published);
      // The payload is this site's own, so the shape is known; it is read
      // through a narrow type rather than trusted wholesale.
      const recipe = decoded.ok
        ? (decoded.document.recipes?.[0] as { steps?: WireStep[] } | undefined)
        : undefined;
      if (decoded.ok && recipe?.steps) {
        for (const [at, w, step] of series.points) {
          const s = recipe.steps[step];
          if (!s) continue;
          s.at_s = at;
          if (s.to_water) s.to_water.value = w;
        }
        payload = encodePayload(decoded.document);
      }
    }
    open.href = `/r/?d=${payload}`;
    open.textContent = isEdited ? "open your version" : "brew it at real speed";
    state.textContent = isEdited ? "edited here · " : "the whole file · ";
  };

  const move = (i: number, at: number, w: number): void => {
    const b = bounds(i);
    const point = series.points[i]!;
    const nextT = clamp(snap(at), b.t[0], b.t[1]);
    const nextW = clamp(snap(w), b.w[0], b.w[1]);
    if (nextT === point[0] && nextW === point[1]) return;
    point[0] = nextT;
    point[1] = nextW;
    redraw(i);
    relink();
    show();
  };

  // An edit shows the whole schedule, with the pour being edited lit in both
  // the picture and the file.
  const beginEdit = (i: number): void => {
    stop();
    t = end;
    delete figure.dataset["playing"];
    active = -2;
    show();
    label();
    light(i);
  };

  const KEYS: Record<string, readonly [number, number]> = {
    ArrowLeft: [-SNAP, 0],
    ArrowRight: [SNAP, 0],
    ArrowUp: [0, SNAP],
    ArrowDown: [0, -SNAP],
  };

  dots.forEach((el, i) => {
    el.tabIndex = 0;
    el.setAttribute("role", "slider");
    el.setAttribute(
      "aria-label",
      `Pour ${i + 1}. Up and down change the water, left and right the time.`,
    );
    describe(i);

    el.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      el.setPointerCapture(ev.pointerId);
      el.focus({ preventScroll: true });
      beginEdit(i);
    });
    el.addEventListener("pointermove", (ev) => {
      if (!el.hasPointerCapture(ev.pointerId)) return;
      const box = plot.getBoundingClientRect();
      move(
        i,
        ((ev.clientX - box.left) / box.width) * end,
        (1 - (ev.clientY - box.top) / box.height) * top,
      );
    });
    el.addEventListener("focus", () => {
      if (el.matches(":focus-visible")) beginEdit(i);
    });
    el.addEventListener("blur", () => light(null));
    el.addEventListener("keydown", (ev) => {
      const delta = KEYS[ev.key];
      if (!delta) return;
      ev.preventDefault();
      const [at, w] = series.points[i]! as [number, number, number];
      beginEdit(i);
      move(i, at + delta[0], w + delta[1]);
    });
  });

  reset.addEventListener("click", () => {
    series.points.forEach((p, i) => {
      p[0] = original[i]![0];
      p[1] = original[i]![1];
    });
    redraw();
    relink();
    active = -2;
    show();
    toggle.focus();
  });

  root.dataset["ready"] = "";
  controls.hidden = false;
  label();

  // Autoplays once, the first time the plot itself is on screen, and only for a
  // reader who has not asked for less motion. Scrolled away, it pauses where it
  // is. Watching the plot rather than the whole panel matters on a phone, where
  // the panel's top edge is in view long before its curve is.
  let played = false;
  new IntersectionObserver(
    ([entry]) => {
      if (!entry) return;
      if (!entry.isIntersecting) stop();
      else if (!played && !reducedMotion.matches) {
        played = true;
        start();
      }
    },
    { threshold: 0.9 },
  ).observe(plot);
}

document.querySelectorAll<HTMLElement>("[data-live]").forEach(play);
