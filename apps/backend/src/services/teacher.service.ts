import prisma from "../db/prisma.js";
import { forbidden, notFound } from "../utils/http.js";

export async function getTeacherProfileForUser(userId: string) {
  const profile = await prisma.teacherProfile.findUnique({ where: { userId } });
  if (!profile) throw notFound("Teacher profile not found");
  return profile;
}

/** Distinct subject ids the teacher is assigned to (any section / academic year). */
export async function getTeacherSubjectIds(teacherProfileId: string): Promise<string[]> {
  const rows = await prisma.teacherSubjectAssignment.findMany({
    where: { teacherProfileId },
    select: { subjectId: true },
    distinct: ["subjectId"],
  });
  return rows.map((r) => r.subjectId);
}

export async function teachesSubject(teacherProfileId: string, subjectId: string): Promise<boolean> {
  const count = await prisma.teacherSubjectAssignment.count({ where: { teacherProfileId, subjectId } });
  return count > 0;
}

export async function assertTeachesSubject(teacherProfileId: string, subjectId: string): Promise<void> {
  if (!(await teachesSubject(teacherProfileId, subjectId))) {
    throw forbidden("You are not assigned to this subject", "NOT_ASSIGNED_TO_SUBJECT");
  }
}

/** Students expected to do work set on this subject: same branch, currently in that semester. */
export function eligibleStudentsWhere(subject: { branchId: string; semester: number }) {
  return {
    branchId: subject.branchId,
    currentSemester: subject.semester,
    user: { status: { not: "DISABLED" as const } },
  };
}

export function studentDisplayName(p: { firstName: string | null; lastName: string | null }, fallback: string | null) {
  const name = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
  return name || fallback || "Student";
}
