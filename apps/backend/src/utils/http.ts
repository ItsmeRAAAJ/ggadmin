import { Response } from "express";

/** Error with an HTTP status that the global error handler turns into a JSON response. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (message: string, code?: string) => new HttpError(400, message, code);
export const forbidden = (message = "You do not have access to this resource", code?: string) =>
  new HttpError(403, message, code);
export const notFound = (message = "Not found") => new HttpError(404, message, "NOT_FOUND");
export const conflict = (message: string, code?: string) => new HttpError(409, message, code);

export function ok(res: Response, data?: unknown, extra: Record<string, unknown> = {}): void {
  res.json({ success: true, ...(data !== undefined ? { data } : {}), ...extra });
}

export function created(res: Response, data?: unknown, extra: Record<string, unknown> = {}): void {
  res.status(201).json({ success: true, ...(data !== undefined ? { data } : {}), ...extra });
}

/** Read a string route param (Express 5 types params as string | string[]). */
export function param(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  throw badRequest("Invalid route parameter");
}

/** Parse pagination query params with sane caps. */
export function pagination(
  query: Record<string, unknown>,
  defaults: { limit: number; max: number }
): { page: number; limit: number; skip: number } {
  const rawPage = Number.parseInt(String(query["page"] ?? "1"), 10);
  const rawLimit = Number.parseInt(String(query["limit"] ?? defaults.limit), 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, defaults.max) : defaults.limit;
  return { page, limit, skip: (page - 1) * limit };
}

/** Read an optional string query param. */
export function queryString(query: Record<string, unknown>, key: string): string | undefined {
  const v = query[key];
  if (typeof v === "string" && v.trim() !== "") return v.trim();
  return undefined;
}

/** Read an optional integer query param. */
export function queryInt(query: Record<string, unknown>, key: string): number | undefined {
  const v = queryString(query, key);
  if (v === undefined) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}
