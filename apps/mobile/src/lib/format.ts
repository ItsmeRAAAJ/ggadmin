const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Calendar-only values (DOB, project dates…) are stored as UTC midnight so they never shift across time zones. */
export function dateOnlyToIso(d: { year: number; month: number; day: number }): string {
  return new Date(Date.UTC(d.year, d.month, d.day)).toISOString();
}

export function isoToDateOnly(iso: string | null | undefined): { year: number; month: number; day: number } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate() };
}

export function formatDateOnly(iso: string | null | undefined, fallback = "—"): string {
  const d = isoToDateOnly(iso);
  if (!d) return fallback;
  return `${d.day} ${MONTHS[d.month]} ${d.year}`;
}

export function formatMonthYear(iso: string | null | undefined): string | null {
  const d = isoToDateOnly(iso);
  return d ? `${MONTHS[d.month]} ${d.year}` : null;
}

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export function formatTime(date: Date): string {
  let h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${pad(m)} ${ampm}`;
}

/** Local date-time for real instants (deadlines, submissions). */
export function formatDateTime(iso: string | null | undefined, fallback = "—"): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  let day: string;
  if (sameDay) day = "Today";
  else if (d.toDateString() === tomorrow.toDateString()) day = "Tomorrow";
  else if (d.toDateString() === yesterday.toDateString()) day = "Yesterday";
  else day = `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : ""}`;
  return `${day}, ${formatTime(d)}`;
}

/** "in 3h 20m", "2 days left", "ended 5m ago" */
export function relativeTo(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  const min = Math.round(abs / 60_000);
  let span: string;
  if (min < 1) span = "less than a minute";
  else if (min < 60) span = `${min} min`;
  else if (min < 60 * 24) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    span = m ? `${h}h ${m}m` : `${h}h`;
  } else {
    const days = Math.round(min / (60 * 24));
    span = `${days} day${days === 1 ? "" : "s"}`;
  }
  return diff >= 0 ? `in ${span}` : `${span} ago`;
}

export function fullName(p: { firstName: string | null; lastName: string | null }): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
}

export function initials(name: string, fallback = "?"): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return fallback;
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase();
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export function hostOf(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
}

export function normaliseUrl(input: string): string {
  const v = input.trim();
  if (!v) return v;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Today" / "Tomorrow" / "Yesterday" / "Mon, 6 Oct" for a YYYY-MM-DD calendar day (already in the college timezone). */
export function formatDayKey(key: string, daysLeft: number): string {
  if (daysLeft === 0) return "Today";
  if (daysLeft === 1) return "Tomorrow";
  if (daysLeft === -1) return "Yesterday";
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  const sameYear = y === new Date().getFullYear();
  return `${WEEKDAYS[date.getUTCDay()]}, ${d} ${MONTHS[m - 1]}${sameYear ? "" : ` ${y}`}`;
}

/** "Due today" / "Due tomorrow" / "Due in 5 days" / "2 days ago" */
export function formatDaysLeft(daysLeft: number): string {
  if (daysLeft === 0) return "Due today";
  if (daysLeft === 1) return "Due tomorrow";
  if (daysLeft > 1) return `Due in ${daysLeft} days`;
  if (daysLeft === -1) return "Yesterday";
  return `${-daysLeft} days ago`;
}

/** "2.4 MB", "820 KB" */
export function formatBytes(bytes: number | null | undefined): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

/** Compact past time for feeds: "just now", "5m", "3h", "2d", "6 Oct" */
export function timeAgo(iso: string, now = Date.now()): string {
  const d = new Date(iso);
  const diff = Math.max(0, now - d.getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== new Date(now).getFullYear() ? ` ${d.getFullYear()}` : ""}`;
}

/** Today's local calendar date (for DateField maxDate). */
export function todayYmd() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}
