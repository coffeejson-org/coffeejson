import type { ReactNode } from "react";
import type { CoffeeJSONConfig } from "./config.js";
import { cx, resolveConfig } from "./config.js";
import type { BrewAlongState } from "./useBrewAlong.js";

const PauseIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    aria-hidden="true"
    fill="currentColor"
  >
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
);
const PlayIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    aria-hidden="true"
    fill="currentColor"
  >
    <path d="M8 5v14l11-7z" />
  </svg>
);
const ResetIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v4h4" />
  </svg>
);
const NextIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export interface BrewControlsProps {
  brew: BrewAlongState;
  /**
   * `icons` (default): square icon buttons named by aria-label. `text`: the same
   * controls with visible labels. One component, because the conditions, handlers
   * and classes are the same — only the contents differ.
   */
  variant?: "icons" | "text";
  config?: CoffeeJSONConfig;
}

// Each SVG is aria-hidden and the accessible name comes from the label, so both
// variants read the same to assistive technology. "Next step" is the primary
// control, not pause: while a tap is awaited it is the action being asked for.
export function BrewControls({
  brew,
  variant = "icons",
  config,
}: BrewControlsProps) {
  const rc = resolveConfig(config);
  const { running, state } = brew;
  const control = (
    label: string,
    icon: ReactNode,
    onClick: () => void,
    className: string,
  ) => (
    <button
      type="button"
      className={className}
      // Visible text is already the accessible name; a duplicate could only diverge.
      aria-label={variant === "icons" ? label : undefined}
      onClick={onClick}
    >
      {variant === "icons" ? icon : label}
    </button>
  );
  return (
    <div className={cx("brewControls", rc)}>
      {!state.finished
        ? control(
            running ? rc.labels.brew.pause : rc.labels.brew.resume,
            running ? <PauseIcon /> : <PlayIcon />,
            running ? brew.pause : brew.resume,
            cx("brewBtn", rc),
          )
        : null}
      {state.awaitingTap
        ? control(
            rc.labels.brew.next,
            <NextIcon />,
            brew.tapDone,
            `${cx("brewBtn", rc)} ${cx("brewBtnPrimary", rc)}`,
          )
        : null}
      {control(
        rc.labels.brew.reset,
        <ResetIcon />,
        brew.reset,
        `${cx("brewBtn", rc)} ${cx("brewBtnGhost", rc)}`,
      )}
    </div>
  );
}
