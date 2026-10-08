import prisma from "../db/prisma.js";
import { notFound } from "../utils/http.js";

/** Resolve the calling student's profile (with branch) or 404. */
export async function getStudentProfileForUser(userId: string) {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    include: { branch: true },
  });
  if (!profile) throw notFound("Student profile not found");
  return profile;
}

/** Prisma filter for subjects a student is currently enrolled in (branch + current semester). */
export function studentSubjectFilter(profile: { branchId: string; currentSemester: number }) {
  return { branchId: profile.branchId, semester: profile.currentSemester };
}

/** Whether a student is eligible for work set on a given subject. */
export function isEligibleForSubject(
  profile: { branchId: string; currentSemester: number },
  subject: { branchId: string; semester: number }
): boolean {
  return profile.branchId === subject.branchId && profile.currentSemester === subject.semester;
}
