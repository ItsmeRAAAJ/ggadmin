import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import { seedStudentSchema } from "../schemas/index.js";

export type SeedOutcome = "inserted" | "updated" | "skipped-protected" | "invalid";
export type SeedRowResult = {
  line: number;
  enrollmentNumber: string | null;
  outcome: SeedOutcome;
  reason?: string;
};
export type SeedSummary = {
  totalRows: number;
  inserted: number;
  updated: number;
  skippedProtected: number;
  invalidFormat: number;
  rows: SeedRowResult[];
};

export const MAX_SEED_ROWS = 5000;

/**
 * Shared seeding logic for bulk upload and single add.
 * - New enrollment → create User (PENDING_ACTIVATION) + StudentProfile.
 * - Existing PENDING_ACTIVATION → correct seed-level fields.
 * - Existing ACTIVE/DISABLED → never touched.
 */
export async function seedStudents(rawRows: unknown[]): Promise<SeedSummary> {
  const branches = new Map((await prisma.branch.findMany()).map((b) => [b.shortCode, b.id]));
  const results: SeedRowResult[] = [];

  for (const [index, raw] of rawRows.entries()) {
    const line = index + 1;
    const rawEnrollment =
      raw && typeof raw === "object" && "enrollmentNumber" in raw ? String((raw as Record<string, unknown>)["enrollmentNumber"] ?? "") : "";

    const parsed = seedStudentSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      results.push({
        line,
        enrollmentNumber: rawEnrollment.trim().toUpperCase() || null,
        outcome: "invalid",
        reason: issue ? `${issue.path.join(".") || "row"}: ${issue.message}` : "Invalid row",
      });
      continue;
    }
    const row = parsed.data;
    const branchId = branches.get(row.branchCode);
    if (!branchId) {
      results.push({ line, enrollmentNumber: row.enrollmentNumber, outcome: "invalid", reason: `Unknown branch code '${row.branchCode}'` });
      continue;
    }
    const passoutYear = row.passoutYear ?? row.admissionYear + 4;

    try {
      const existing = await prisma.user.findUnique({
        where: { enrollmentNumber: row.enrollmentNumber },
        include: { studentProfile: { select: { id: true } } },
      });

      if (existing && (existing.status !== "PENDING_ACTIVATION" || existing.role !== "STUDENT")) {
        results.push({ line, enrollmentNumber: row.enrollmentNumber, outcome: "skipped-protected", reason: "Account already activated" });
        continue;
      }

      const emailOwner = await prisma.user.findUnique({ where: { email: row.email }, select: { id: true, enrollmentNumber: true } });
      if (emailOwner && emailOwner.id !== existing?.id) {
        results.push({
          line,
          enrollmentNumber: row.enrollmentNumber,
          outcome: "invalid",
          reason: `Email already used by ${emailOwner.enrollmentNumber ?? "another account"}`,
        });
        continue;
      }

      const profileData = {
        branchId,
        admissionYear: row.admissionYear,
        passoutYear,
        ...(row.currentSemester !== undefined ? { currentSemester: row.currentSemester } : {}),
        ...(row.section !== undefined ? { section: row.section } : {}),
      };

      if (!existing) {
        await prisma.user.create({
          data: {
            enrollmentNumber: row.enrollmentNumber,
            email: row.email,
            role: "STUDENT",
            status: "PENDING_ACTIVATION",
            studentProfile: { create: profileData },
          },
        });
        results.push({ line, enrollmentNumber: row.enrollmentNumber, outcome: "inserted" });
      } else {
        await prisma.$transaction([
          prisma.user.update({ where: { id: existing.id }, data: { email: row.email } }),
          existing.studentProfile
            ? prisma.studentProfile.update({ where: { id: existing.studentProfile.id }, data: profileData })
            : prisma.studentProfile.create({ data: { ...profileData, userId: existing.id } }),
        ]);
        results.push({ line, enrollmentNumber: row.enrollmentNumber, outcome: "updated" });
      }
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        results.push({ line, enrollmentNumber: row.enrollmentNumber, outcome: "invalid", reason: "Duplicate enrollment number or email" });
        continue;
      }
      throw err;
    }
  }

  return {
    totalRows: rawRows.length,
    inserted: results.filter((r) => r.outcome === "inserted").length,
    updated: results.filter((r) => r.outcome === "updated").length,
    skippedProtected: results.filter((r) => r.outcome === "skipped-protected").length,
    invalidFormat: results.filter((r) => r.outcome === "invalid").length,
    rows: results,
  };
}
