import { PASSWORD_MIN } from "./config";

export const passwordRules = [
  { key: "len", label: `At least ${PASSWORD_MIN} characters`, test: (p: string) => p.length >= PASSWORD_MIN && p.length <= 72 },
  { key: "upper", label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { key: "lower", label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { key: "digit", label: "One number", test: (p: string) => /\d/.test(p) },
] as const;

export const isStrongPassword = (p: string) => passwordRules.every((r) => r.test(p));

export const PHONE_RE = /^\+?[0-9]{10,15}$/;

export function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return (u.protocol === "http:" || u.protocol === "https:") && !!u.hostname && u.hostname.includes(".");
  } catch {
    return false;
  }
}
