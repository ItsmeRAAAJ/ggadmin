export function fmtDate(
  value?: string | Date | null,
  opts: Intl.DateTimeFormatOptions = {},
) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    ...opts,
  }).format(d);
}
export function dateInput(value?: string | Date | null) {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
export function isoFromInput(value: string) {
  return value ? new Date(value).toISOString() : null;
}
export function initials(name?: string | null) {
  return (
    (name || "My GGITS")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "G"
  );
}
