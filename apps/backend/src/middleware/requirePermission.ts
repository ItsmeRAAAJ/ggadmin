import { Request, Response, NextFunction } from "express";
import { hasPermission } from "../services/permission.service.js";

function deny(res: Response, keys: string[]): void {
  res.status(403).json({
    success: false,
    code: "MISSING_PERMISSION",
    message:
      keys.length === 1
        ? `This action requires the "${keys[0]}" permission`
        : `This action requires one of: ${keys.join(", ")}`,
  });
}

/** Requires a specific permission (Super Admin always passes). Use after `authenticate`. */
export function requirePermission(permissionKey: string) {
  return requireAnyPermission(permissionKey);
}

/** Requires at least one of the given permissions. */
export function requireAnyPermission(...permissionKeys: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, code: "UNAUTHENTICATED", message: "Authentication required" });
      return;
    }
    for (const key of permissionKeys) {
      if (await hasPermission(req.user.userId, key)) return next();
    }
    deny(res, permissionKeys);
  };
}
