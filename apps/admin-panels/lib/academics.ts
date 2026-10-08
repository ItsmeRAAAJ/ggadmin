export const RESOURCE_MAX_BYTES = 25 * 1024 * 1024;

export const RESOURCE_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/heic",
  "image/heif",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export const RESOURCE_ACCEPT = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".heic",
  ".pptx",
  ".docx",
  ".xlsx",
].join(",");

const RESOURCE_EXTENSIONS = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "heic",
  "pptx",
  "docx",
  "xlsx",
]);

export function fileExtension(name?: string | null) {
  const ext = (name || "").split(".").pop()?.toLowerCase();
  return ext && ext !== name?.toLowerCase() ? ext : "file";
}

export function isAllowedResourceFile(file: File) {
  const ext = fileExtension(file.name);
  return RESOURCE_MIME_TYPES.has(file.type) || RESOURCE_EXTENSIONS.has(ext);
}

export function formatBytes(value?: number | null) {
  if (!value || value <= 0) return "—";
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB"];
  let size = value / 1024;
  let unit = units[0];
  for (let i = 1; i < units.length && size >= 1024; i += 1) {
    size /= 1024;
    unit = units[i];
  }
  return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${unit}`;
}

export function dueInLabel(value?: string | null) {
  if (!value) return "—";
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return "—";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(target);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  if (diff > 1) return `Due in ${diff} days`;
  if (diff === -1) return "Due yesterday";
  return `${Math.abs(diff)} days overdue`;
}

export const PEER_CATEGORIES = [
  "PREVIOUS_YEAR_PAPER",
  "LAB_MANUAL",
  "REFERENCE_MATERIAL",
  "USEFUL_LINK",
  "CHEATSHEET",
  "OTHER",
] as const;

export const PEER_SCOPES = ["CLASS", "BRANCH", "SEMESTER"] as const;

export function labelize(value?: string | null) {
  return (value || "—")
    .toLowerCase()
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}
