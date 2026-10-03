// The card rules of `@coffeejson/react`'s default skin, with the custom
// properties moved to `:host`. A rule the page writes for the element then
// overrides them, which a declaration inside the shadow tree would prevent.
export const ELEMENT_STYLES = `:host {
  display: block;
  --cj-accent: #7f5539;
  --cj-fg: #1f1a17;
  --cj-muted: #6f6259;
  --cj-bg: #fffdfa;
  --cj-border: #e7ddd3;
  --cj-radius: 12px;
  --cj-space: 1rem;
  --cj-font: system-ui, -apple-system, "Segoe UI", sans-serif;
}
:host([hidden]) {
  display: none;
}
.cj-view {
  display: grid;
  gap: var(--cj-space);
  font-family: var(--cj-font);
  color: var(--cj-fg);
}
.cj-card {
  background: var(--cj-bg);
  border: 1px solid var(--cj-border);
  border-radius: var(--cj-radius);
  padding: var(--cj-space);
}
.cj-title {
  margin: 0 0 0.25rem;
  font-size: 1.15rem;
  line-height: 1.3;
}
.cj-badge {
  margin-left: 0.5rem;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: var(--cj-accent);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 600;
  vertical-align: middle;
}
.cj-subtitle {
  margin: 0 0 0.75rem;
  color: var(--cj-muted);
  font-size: 0.9rem;
}
.cj-fact {
  margin: 0.2rem 0;
  font-size: 0.95rem;
}
.cj-fact-label {
  color: var(--cj-muted);
  margin-right: 0.35rem;
}
.cj-origin-item {
  display: block;
}
.cj-steps {
  margin: 0.75rem 0 0;
  padding-left: 1.5rem;
  display: grid;
  gap: 0.35rem;
}
.cj-step-time {
  display: inline-block;
  min-width: 3ch;
  margin-right: 0.5rem;
  font-variant-numeric: tabular-nums;
  color: var(--cj-muted);
}
.cj-step-delta {
  color: var(--cj-muted);
  font-variant-numeric: tabular-nums;
}
.cj-step-body ~ .cj-step-target,
.cj-step-body ~ .cj-step-delta {
  margin-left: 0.35rem;
}
.cj-description {
  margin: 0.75rem 0 0;
  color: var(--cj-muted);
  font-size: 0.85rem;
}
.cj-notes {
  color: var(--cj-fg);
}
.cj-generator {
  margin: 0;
  color: var(--cj-muted);
  font-size: 0.85rem;
}
.cj-actions {
  display: flex;
  gap: 0.75rem;
  margin: 0.75rem 0 0;
  font-family: var(--cj-font);
  font-size: 0.9rem;
}
.cj-actions a,
.cj-actions button {
  font: inherit;
  color: var(--cj-accent);
  background: none;
  border: 0;
  padding: 0;
  text-decoration: underline;
  cursor: pointer;
}
`;
