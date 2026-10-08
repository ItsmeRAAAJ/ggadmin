import { Request, Response, NextFunction } from "express";
import type { ZodType, ZodError } from "zod";

/**
 * Validates req.body against a zod schema; replaces it with the parsed value.
 * 422 with a field → message map on failure; `message` is the first issue for simple clients.
 */
export function validate(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      res.status(422).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: Object.values(errors)[0] ?? "Validation failed",
        errors,
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

function formatZodErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "root";
    if (!out[path]) out[path] = issue.message;
  }
  return out;
}
