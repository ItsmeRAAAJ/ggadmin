import crypto from "crypto";
import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { OTP_DIGITS, OTP_EXPIRY_MINUTES } from "../config/validation.js";

/** Generate a cryptographically random N-digit OTP string. */
export function generateOtp(): string {
  const max = Math.pow(10, OTP_DIGITS);
  return crypto.randomInt(0, max).toString().padStart(OTP_DIGITS, "0");
}

/** Hash an OTP with a server-side pepper + bcrypt. Never store OTPs in plaintext. */
export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp + env.OTP_PEPPER, 10);
}

/** Verify an OTP against its stored hash. */
export async function verifyOtp(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp + env.OTP_PEPPER, hash);
}

/** A Date that is OTP_EXPIRY_MINUTES from now. */
export function otpExpiryDate(): Date {
  return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
}
