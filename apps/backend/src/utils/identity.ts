import prisma from "../db/prisma.js";

/** Normalize a login identifier: emails are lowercased, enrollment numbers uppercased. */
export function normalizeIdentifier(identifier: string): { email?: string; enrollmentNumber?: string } {
  const trimmed = identifier.trim();
  if (trimmed.includes("@")) return { email: trimmed.toLowerCase() };
  return { enrollmentNumber: trimmed.toUpperCase() };
}

/** Find a user by enrollment number or email (case-insensitive by normalization). */
export async function findUserByIdentifier(identifier: string) {
  const { email, enrollmentNumber } = normalizeIdentifier(identifier);
  if (email) return prisma.user.findUnique({ where: { email } });
  if (enrollmentNumber) return prisma.user.findUnique({ where: { enrollmentNumber } });
  return null;
}
