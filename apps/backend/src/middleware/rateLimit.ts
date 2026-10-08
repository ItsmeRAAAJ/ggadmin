import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

const tooMany = (minutes: number) => ({
  success: false,
  code: "RATE_LIMITED",
  message: `Too many attempts. Please try again in ${minutes} minutes.`,
});

function identifierKey(req: Request): string {
  const body = req.body as { identifier?: unknown } | undefined;
  const id = typeof body?.identifier === "string" ? body.identifier.trim().toLowerCase() : "";
  return id || `ip:${ipKeyGenerator(req.ip ?? "")}`;
}

/**
 * Per-IP ceiling for auth endpoints. Generous because a whole campus can sit behind one NAT IP.
 */
export const authIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: tooMany(15),
});

/** Per-account limiter for OTP send / verify flows. */
export const otpIdentifierLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => `otp:${identifierKey(req)}`,
  message: tooMany(15),
});

/** Per-account limiter for password login — slows brute force against one account. */
export const loginIdentifierLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `login:${identifierKey(req)}`,
  message: tooMany(15),
});
