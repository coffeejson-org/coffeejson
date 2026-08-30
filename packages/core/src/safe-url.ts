// Allowlist schemes before a value reaches an href. The coerced-and-trimmed form
// is both what the check inspects and what comes back: validating one value and
// returning another walks an unchecked string into an attribute.
export const safeUrl = (u?: string | null): string => {
  const url = String(u ?? "").trim();
  return /^(https?:|mailto:)/i.test(url) ? url : "";
};
