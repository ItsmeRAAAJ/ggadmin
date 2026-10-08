import { Request, Response, NextFunction } from "express";
import prisma from "../db/prisma.js";
import { verifyToken, TokenPayload, TokenType } from "../utils/jwt.js";

// Extend Express Request to carry the decoded JWT payload
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

function extractToken(req: Request, allowCookie: boolean): string | undefined {
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  if (allowCookie && req.cookies?.["__session"]) return req.cookies["__session"] as string;
  return undefined;
}

/**
 * Builds an auth middleware for a given token type. On every request it re-checks the
 * user row so disabled accounts and revoked tokens (tokenVersion bump) lose access immediately.
 */
function authenticateAs(type: TokenType, requiredStatus: "ACTIVE" | "PENDING_ACTIVATION") {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = extractToken(req, type === "session");
    if (!token) {
      res.status(401).json({ success: false, code: "UNAUTHENTICATED", message: "Authentication required" });
      return;
    }

    const payload = verifyToken(token);
    if (!payload || payload.type !== type) {
      res.status(401).json({ success: false, code: "INVALID_TOKEN", message: "Invalid or expired session. Please sign in again." });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { status: true, role: true, tokenVersion: true },
    });
    if (!user || user.tokenVersion !== payload.tv || user.status !== requiredStatus) {
      res.status(401).json({ success: false, code: "INVALID_TOKEN", message: "Invalid or expired session. Please sign in again." });
      return;
    }

    req.user = { ...payload, role: user.role };
    next();
  };
}

/** Full session (Authorization: Bearer or __session cookie). */
export const authenticate = authenticateAs("session", "ACTIVE");
/** Onboarding token — only for /auth/onboard. */
export const authenticateOnboarding = authenticateAs("onboarding", "PENDING_ACTIVATION");
/** Password-reset token — only for /auth/reset-password. */
export const authenticateReset = authenticateAs("reset", "ACTIVE");

/**
 * Role-based access control middleware factory.
 * Usage: requireRole("ADMIN") or requireRole("TEACHER", "ADMIN")
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, code: "FORBIDDEN", message: "You do not have access to this resource" });
      return;
    }
    next();
  };
}
