import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { HttpError } from "../utils/http.js";

/**
 * Global error handler — must be last middleware registered.
 * Maps known error types to proper HTTP statuses; never leaks internals in production.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (res.headersSent) return;

  if (err instanceof HttpError) {
    res.status(err.status).json({
      success: false,
      message: err.message,
      ...(err.code ? { code: err.code } : {}),
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({ success: false, code: "CONFLICT", message: "A record with these details already exists" });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ success: false, code: "NOT_FOUND", message: "Record not found" });
      return;
    }
    if (err.code === "P2003") {
      res.status(409).json({ success: false, code: "IN_USE", message: "This record is referenced by other data and cannot be changed" });
      return;
    }
  }

  // Malformed JSON body from express.json()
  const maybeHttp = err as { type?: string; status?: number };
  if (maybeHttp?.type === "entity.parse.failed") {
    res.status(400).json({ success: false, message: "Malformed JSON body" });
    return;
  }
  if (maybeHttp?.type === "entity.too.large") {
    res.status(413).json({ success: false, message: "Request body too large" });
    return;
  }

  console.error(`[ERROR] ${req.method} ${req.originalUrl}`, err);
  const message =
    process.env["NODE_ENV"] !== "production" && err instanceof Error ? err.message : "Internal server error";
  res.status(500).json({ success: false, message });
}

/** 404 handler — catches routes that didn't match. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
}
