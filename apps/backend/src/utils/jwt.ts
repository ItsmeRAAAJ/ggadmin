import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { JWT_RESET_EXPIRES_IN } from "../config/validation.js";

export type TokenType = "session" | "onboarding" | "reset";

export type TokenPayload = {
  userId: string;
  role: string;
  type: TokenType;
  /** User.tokenVersion at issue time — a mismatch means the token was revoked. */
  tv: number;
};

function sign(payload: TokenPayload, expiresIn: string): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn,
    issuer: env.APP_NAME,
  } as jwt.SignOptions);
}

/** Full session JWT (7 days by default). */
export function signSessionToken(userId: string, role: string, tokenVersion: number): string {
  return sign({ userId, role, type: "session", tv: tokenVersion }, env.JWT_EXPIRES_IN);
}

/** Short-lived onboarding JWT — only valid between OTP verification and password setup. */
export function signOnboardingToken(userId: string, role: string, tokenVersion: number): string {
  return sign({ userId, role, type: "onboarding", tv: tokenVersion }, env.JWT_ONBOARDING_EXPIRES_IN);
}

/** Short-lived password-reset JWT — single use because reset bumps tokenVersion. */
export function signResetToken(userId: string, role: string, tokenVersion: number): string {
  return sign({ userId, role, type: "reset", tv: tokenVersion }, JWT_RESET_EXPIRES_IN);
}

/** Verify and decode a JWT. Returns null on failure. */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { issuer: env.APP_NAME });
    if (typeof decoded !== "object" || decoded === null) return null;
    const p = decoded as Partial<TokenPayload>;
    if (typeof p.userId !== "string" || typeof p.role !== "string" || typeof p.type !== "string") {
      return null;
    }
    return { userId: p.userId, role: p.role, type: p.type as TokenType, tv: typeof p.tv === "number" ? p.tv : 0 };
  } catch {
    return null;
  }
}
