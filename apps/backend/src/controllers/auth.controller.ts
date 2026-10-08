import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import type { OtpPurpose, User } from "@prisma/client";
import prisma from "../db/prisma.js";
import { generateOtp, hashOtp, verifyOtp, otpExpiryDate } from "../utils/otp.js";
import { signSessionToken, signOnboardingToken, signResetToken } from "../utils/jwt.js";
import { sendEmail, buildOtpEmail } from "../utils/email.js";
import { findUserByIdentifier } from "../utils/identity.js";
import { HttpError, badRequest } from "../utils/http.js";
import { getActorContext } from "../services/permission.service.js";
import { env } from "../config/env.js";
import {
  OTP_MAX_ATTEMPTS,
  OTP_MAX_PER_HOUR,
  OTP_RESEND_COOLDOWN_SECONDS,
} from "../config/validation.js";

const BCRYPT_ROUNDS = 12;
// Pre-computed hash used to keep login timing uniform when the account does not exist.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", BCRYPT_ROUNDS);

const ACCOUNT_NOT_FOUND = new HttpError(
  404,
  "We couldn't find an account with that enrollment number or email. Please check it, or contact your department office.",
  "ACCOUNT_NOT_FOUND"
);
const ACCOUNT_DISABLED = new HttpError(
  403,
  "This account has been disabled. Please contact your department office.",
  "ACCOUNT_DISABLED"
);

function displayName(role: User["role"]): string {
  return role === "STUDENT" ? "Student" : role === "TEACHER" ? "Faculty member" : "Administrator";
}

function secondsUntilResend(createdAt: Date): number {
  const elapsed = (Date.now() - createdAt.getTime()) / 1000;
  return Math.max(0, Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsed));
}

/** Latest OTP that can still be verified for this user + purpose. */
async function findActiveOtp(userId: string, purpose: OtpPurpose) {
  return prisma.otpVerification.findFirst({
    where: {
      userId,
      purpose,
      consumedAt: null,
      expiresAt: { gt: new Date() },
      attempts: { lt: OTP_MAX_ATTEMPTS },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Issue (or re-issue) an OTP. Enforces a resend cooldown and an hourly cap, invalidates any
 * previous OTPs for the same purpose, and rolls back if the email could not be delivered.
 */
async function issueOtp(user: User, purpose: OtpPurpose): Promise<{ resendAvailableInSeconds: number }> {
  const latest = await prisma.otpVerification.findFirst({
    where: { userId: user.id, purpose },
    orderBy: { createdAt: "desc" },
  });
  if (latest) {
    const wait = secondsUntilResend(latest.createdAt);
    if (wait > 0) {
      throw new HttpError(429, `Please wait ${wait}s before requesting another code.`, "OTP_COOLDOWN", {
        resendAvailableInSeconds: wait,
      });
    }
  }

  const sentLastHour = await prisma.otpVerification.count({
    where: { userId: user.id, purpose, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (sentLastHour >= OTP_MAX_PER_HOUR) {
    throw new HttpError(429, "Too many codes requested. Please try again in an hour.", "OTP_LIMIT");
  }

  const otp = generateOtp();
  const codeHash = await hashOtp(otp);

  const record = await prisma.$transaction(async (tx) => {
    await tx.otpVerification.updateMany({
      where: { userId: user.id, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    return tx.otpVerification.create({
      data: { userId: user.id, codeHash, purpose, expiresAt: otpExpiryDate() },
    });
  });

  try {
    await sendEmail({
      to: [{ email: user.email }],
      subject:
        purpose === "FIRST_LOGIN"
          ? `Your ${env.APP_NAME} activation code`
          : `Your ${env.APP_NAME} password reset code`,
      htmlContent: buildOtpEmail(otp, purpose, displayName(user.role)),
    });
  } catch (error) {
    console.error("[AUTH] Failed to send OTP email:", error);
    await prisma.otpVerification.delete({ where: { id: record.id } }).catch(() => undefined);
    throw new HttpError(502, "We couldn't send the verification email. Please try again shortly.", "EMAIL_FAILED");
  }

  return { resendAvailableInSeconds: OTP_RESEND_COOLDOWN_SECONDS };
}

function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  const visible = local.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(1, local.length - 2))}@${domain}`;
}

/**
 * POST /auth/lookup
 * First step of sign-in. Tells the client whether to ask for a password (active account)
 * or an OTP (first-time activation — an OTP is emailed if one isn't already pending).
 */
export async function lookup(req: Request, res: Response): Promise<void> {
  const { identifier } = req.body as { identifier: string };
  const user = await findUserByIdentifier(identifier);

  if (!user) throw ACCOUNT_NOT_FOUND;
  if (user.status === "DISABLED") throw ACCOUNT_DISABLED;

  if (user.status === "ACTIVE") {
    res.json({
      success: true,
      next: "PASSWORD",
      requirePassword: true,
      role: user.role,
      message: "Enter your password to continue",
    });
    return;
  }

  // PENDING_ACTIVATION — reuse a still-valid OTP instead of spamming the inbox.
  const existing = await findActiveOtp(user.id, "FIRST_LOGIN");
  let resendAvailableInSeconds: number;
  let message: string;
  if (existing) {
    resendAvailableInSeconds = secondsUntilResend(existing.createdAt);
    message = "We've already sent a code to your email. Enter it below.";
  } else {
    ({ resendAvailableInSeconds } = await issueOtp(user, "FIRST_LOGIN"));
    message = "We've sent a 6-digit code to your email.";
  }

  res.json({
    success: true,
    next: "OTP",
    requireOtp: true,
    role: user.role,
    maskedEmail: maskEmail(user.email),
    resendAvailableInSeconds,
    message,
  });
}

/**
 * POST /auth/resend-otp
 * Explicit resend (subject to cooldown). purpose defaults to FIRST_LOGIN.
 */
export async function resendOtp(req: Request, res: Response): Promise<void> {
  const { identifier, purpose } = req.body as { identifier: string; purpose: OtpPurpose };
  const user = await findUserByIdentifier(identifier);
  if (!user) throw ACCOUNT_NOT_FOUND;
  if (user.status === "DISABLED") throw ACCOUNT_DISABLED;

  if (purpose === "FIRST_LOGIN" && user.status !== "PENDING_ACTIVATION") {
    throw badRequest("This account is already activated. Sign in with your password.", "ALREADY_ACTIVE");
  }
  if (purpose === "PASSWORD_RESET" && user.status !== "ACTIVE") {
    throw badRequest("This account isn't activated yet. Use first-time sign in instead.", "NOT_ACTIVATED");
  }

  const { resendAvailableInSeconds } = await issueOtp(user, purpose);
  res.json({
    success: true,
    maskedEmail: maskEmail(user.email),
    resendAvailableInSeconds,
    message: "A new code has been sent to your email.",
  });
}

/**
 * POST /auth/verify-otp
 * FIRST_LOGIN → returns an onboarding token (use it to set a password via /auth/onboard).
 * PASSWORD_RESET → returns a reset token (use it with /auth/reset-password).
 */
export async function verifyOtpHandler(req: Request, res: Response): Promise<void> {
  const { identifier, otp, purpose } = req.body as { identifier: string; otp: string; purpose: OtpPurpose };

  const user = await findUserByIdentifier(identifier);
  if (!user) throw ACCOUNT_NOT_FOUND;
  if (user.status === "DISABLED") throw ACCOUNT_DISABLED;

  const expectedStatus = purpose === "FIRST_LOGIN" ? "PENDING_ACTIVATION" : "ACTIVE";
  if (user.status !== expectedStatus) {
    throw badRequest(
      purpose === "FIRST_LOGIN"
        ? "This account is already activated. Sign in with your password."
        : "This account isn't activated yet. Use first-time sign in instead.",
      "INVALID_STATE"
    );
  }

  const record = await findActiveOtp(user.id, purpose);
  if (!record) {
    throw badRequest("This code has expired. Please request a new one.", "OTP_EXPIRED");
  }

  const valid = await verifyOtp(otp, record.codeHash);
  if (!valid) {
    const updated = await prisma.otpVerification.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    const remaining = Math.max(0, OTP_MAX_ATTEMPTS - updated.attempts);
    throw new HttpError(
      400,
      remaining > 0
        ? `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} left.`
        : "Too many incorrect attempts. Please request a new code.",
      remaining > 0 ? "INVALID_OTP" : "OTP_EXPIRED",
      { attemptsRemaining: remaining }
    );
  }

  // Atomically consume — protects against two concurrent verifications of the same code.
  const consumed = await prisma.otpVerification.updateMany({
    where: { id: record.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count !== 1) {
    throw badRequest("This code has already been used. Please request a new one.", "OTP_EXPIRED");
  }

  if (purpose === "FIRST_LOGIN") {
    res.json({
      success: true,
      type: "ONBOARDING",
      onboardingToken: signOnboardingToken(user.id, user.role, user.tokenVersion),
      message: "Code verified. Please set your password.",
    });
    return;
  }

  res.json({
    success: true,
    type: "RESET",
    resetToken: signResetToken(user.id, user.role, user.tokenVersion),
    message: "Code verified. Choose a new password.",
  });
}

/**
 * POST /auth/onboard  (onboarding token)
 * Sets the first password and activates the account.
 */
export async function onboard(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { password } = req.body as { password: string };

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const result = await prisma.user.updateMany({
    where: { id: userId, status: "PENDING_ACTIVATION" },
    data: { passwordHash, status: "ACTIVE", tokenVersion: { increment: 1 } },
  });
  if (result.count !== 1) {
    throw badRequest("Account already activated or not found", "INVALID_STATE");
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  res.json({
    success: true,
    token: signSessionToken(user.id, user.role, user.tokenVersion),
    role: user.role,
    message: "Account activated successfully.",
  });
}

/**
 * POST /auth/login
 * expectedCategory:
 *   "STUDENT"  → mobile app; account must be a student
 *   "TEACHER"  → panel; account must be a teacher
 *   <AdminRole.key> → panel; account must be an admin holding that role
 */
export async function login(req: Request, res: Response): Promise<void> {
  const { identifier, password, expectedCategory } = req.body as {
    identifier: string;
    password: string;
    expectedCategory?: string;
  };

  const user = await findUserByIdentifier(identifier);
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user) throw new HttpError(401, "Invalid credentials", "INVALID_CREDENTIALS");
  if (user.status === "PENDING_ACTIVATION" || !user.passwordHash) {
    throw new HttpError(403, "Your account isn't activated yet. Use first-time sign in to set your password.", "ACCOUNT_NOT_ACTIVATED");
  }
  if (!passwordOk) throw new HttpError(401, "Invalid credentials", "INVALID_CREDENTIALS");
  if (user.status === "DISABLED") throw ACCOUNT_DISABLED;

  if (expectedCategory) {
    if (expectedCategory === "STUDENT" || expectedCategory === "TEACHER") {
      if (user.role !== expectedCategory) {
        throw new HttpError(
          403,
          expectedCategory === "STUDENT"
            ? "This app is for students. Faculty and admins should use the web panel."
            : "You selected 'Teacher' but this is not a teacher account.",
          "ROLE_MISMATCH"
        );
      }
    } else {
      if (user.role !== "ADMIN") {
        throw new HttpError(403, "This is not an admin account. Pick the correct category.", "ROLE_MISMATCH");
      }
      const hasRole = await prisma.adminRoleAssignment.findFirst({
        where: { adminProfile: { userId: user.id }, adminRole: { key: expectedCategory } },
        select: { id: true },
      });
      if (!hasRole) {
        throw new HttpError(403, "Your account doesn't have the selected role. Pick the correct category.", "ROLE_MISMATCH");
      }
    }
  }

  res.json({
    success: true,
    token: signSessionToken(user.id, user.role, user.tokenVersion),
    role: user.role,
  });
}

/** POST /auth/logout — clears the cookie (JWTs are stateless; clients drop their token). */
export async function logout(_req: Request, res: Response): Promise<void> {
  res.clearCookie("__session");
  res.json({ success: true, message: "Logged out" });
}

/** POST /auth/logout-all (session) — revokes every issued token for this user. */
export async function logoutAll(req: Request, res: Response): Promise<void> {
  await prisma.user.update({ where: { id: req.user!.userId }, data: { tokenVersion: { increment: 1 } } });
  res.clearCookie("__session");
  res.json({ success: true, message: "Signed out from all devices" });
}

/**
 * POST /auth/request-password-reset
 * Emails a PASSWORD_RESET OTP to an active account.
 */
export async function requestPasswordReset(req: Request, res: Response): Promise<void> {
  const { identifier } = req.body as { identifier: string };
  const user = await findUserByIdentifier(identifier);
  if (!user) throw ACCOUNT_NOT_FOUND;
  if (user.status === "DISABLED") throw ACCOUNT_DISABLED;
  if (user.status !== "ACTIVE") {
    throw badRequest("This account isn't activated yet. Use first-time sign in instead.", "NOT_ACTIVATED");
  }

  const existing = await findActiveOtp(user.id, "PASSWORD_RESET");
  let resendAvailableInSeconds: number;
  if (existing && secondsUntilResend(existing.createdAt) > 0) {
    resendAvailableInSeconds = secondsUntilResend(existing.createdAt);
  } else {
    ({ resendAvailableInSeconds } = await issueOtp(user, "PASSWORD_RESET"));
  }

  res.json({
    success: true,
    maskedEmail: maskEmail(user.email),
    resendAvailableInSeconds,
    message: "We've sent a password reset code to your email.",
  });
}

/**
 * POST /auth/reset-password  (reset token)
 * Sets a new password and revokes all existing sessions. Returns a fresh session token.
 */
export async function resetPassword(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { password } = req.body as { password: string };

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, tokenVersion: { increment: 1 } },
  });

  res.json({
    success: true,
    token: signSessionToken(user.id, user.role, user.tokenVersion),
    role: user.role,
    message: "Password updated successfully.",
  });
}

/**
 * POST /auth/change-password  (session)
 * Requires the current password. Revokes other sessions and returns a new token.
 */
export async function changePassword(req: Request, res: Response): Promise<void> {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.userId } });

  if (!user.passwordHash || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw badRequest("Your current password is incorrect.", "INVALID_PASSWORD");
  }
  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    throw badRequest("New password must be different from the current one.", "SAME_PASSWORD");
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, tokenVersion: { increment: 1 } },
  });

  res.json({
    success: true,
    token: signSessionToken(updated.id, updated.role, updated.tokenVersion),
    message: "Password changed.",
  });
}

/**
 * GET /auth/me  (session)
 * Identity + effective permissions for the current user. Used by both clients to shape UI.
 */
export async function me(req: Request, res: Response): Promise<void> {
  const ctx = await getActorContext(req.user!.userId);
  res.json({ success: true, data: ctx });
}

/**
 * GET /auth/login-categories
 * Admin role categories + TEACHER for the panel login dropdown (built from AdminRole table).
 */
export async function loginCategories(_req: Request, res: Response): Promise<void> {
  const adminRoles = await prisma.adminRole.findMany({ orderBy: { label: "asc" } });
  res.json({
    success: true,
    data: [
      ...adminRoles.map((r) => ({ key: r.key, label: r.label })),
      { key: "TEACHER", label: "Teacher" },
    ],
  });
}
