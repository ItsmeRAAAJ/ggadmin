/**
 * Student-facing assignment endpoints (/me/assignments).
 * Students see whether they've submitted (and if it was late) — never marks or feedback.
 */
import { Request, Response } from "express";
import prisma from "../db/prisma.js";
import { getStudentProfileForUser, isEligibleForSubject, studentSubjectFilter } from "../services/student.service.js";
import { assertOwnedUploadedFile, deleteS3Object, generatePresignedUploadUrl, signFileUrl } from "../utils/s3.js";
import { badRequest, conflict, notFound, ok, param } from "../utils/http.js";

type StudentSubmissionStatus = "NOT_SUBMITTED" | "SUBMITTED" | "LATE";

function studentStatus(sub: { status: string; submittedAt: Date | null } | undefined, dueAt: Date): StudentSubmissionStatus {
  if (!sub || !sub.submittedAt || sub.status === "PENDING") return "NOT_SUBMITTED";
  return sub.submittedAt > dueAt ? "LATE" : "SUBMITTED";
}

async function loadVisibleAssignment(assignmentId: string, profile: { id: string; branchId: string; currentSemester: number }) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      subject: { select: { id: true, name: true, code: true, branchId: true, semester: true } },
      createdBy: { select: { name: true } },
      submissions: { where: { studentProfileId: profile.id } },
    },
  });
  if (!assignment || assignment.status === "DRAFT" || !isEligibleForSubject(profile, assignment.subject)) {
    throw notFound("Assignment not found");
  }
  return assignment;
}

/** GET /me/assignments */
export async function getMyAssignments(req: Request, res: Response): Promise<void> {
  const profile = await getStudentProfileForUser(req.user!.userId);
  const assignments = await prisma.assignment.findMany({
    where: { status: { in: ["PUBLISHED", "CLOSED"] }, subject: studentSubjectFilter(profile) },
    include: {
      subject: { select: { id: true, name: true, code: true } },
      submissions: { where: { studentProfileId: profile.id }, select: { status: true, submittedAt: true } },
    },
    orderBy: { dueAt: "asc" },
  });

  const now = new Date();
  const items = assignments.map((a) => {
    const submissionStatus = studentStatus(a.submissions[0], a.dueAt);
    return {
      id: a.id,
      title: a.title,
      subject: a.subject,
      dueAt: a.dueAt,
      status: a.status,
      isOverdue: submissionStatus === "NOT_SUBMITTED" && a.dueAt < now,
      canSubmit: a.status === "PUBLISHED" && a.submissions[0]?.status !== "GRADED",
      submissionStatus,
      submittedAt: a.submissions[0]?.submittedAt ?? null,
    };
  });

  // Pending first (soonest due), then the rest by most recent due date.
  const pending = items.filter((i) => i.submissionStatus === "NOT_SUBMITTED" && i.canSubmit);
  const rest = items.filter((i) => !pending.includes(i)).sort((x, y) => y.dueAt.getTime() - x.dueAt.getTime());
  ok(res, [...pending, ...rest]);
}

/** GET /me/assignments/:id */
export async function getAssignmentDetail(req: Request, res: Response): Promise<void> {
  const profile = await getStudentProfileForUser(req.user!.userId);
  const a = await loadVisibleAssignment(param(req.params["id"]), profile);
  const sub = a.submissions[0];
  const submissionStatus = studentStatus(sub, a.dueAt);

  ok(res, {
    id: a.id,
    title: a.title,
    description: a.description,
    subject: { id: a.subject.id, name: a.subject.name, code: a.subject.code },
    teacherName: a.createdBy.name,
    dueAt: a.dueAt,
    status: a.status,
    isOverdue: submissionStatus === "NOT_SUBMITTED" && a.dueAt < new Date(),
    canSubmit: a.status === "PUBLISHED" && sub?.status !== "GRADED",
    submission:
      sub && sub.submittedAt
        ? { status: submissionStatus, submittedAt: sub.submittedAt, fileUrl: await signFileUrl(sub.fileUrl) }
        : null,
  });
}

async function assertCanSubmit(assignmentId: string, profile: { id: string; branchId: string; currentSemester: number }) {
  const a = await loadVisibleAssignment(assignmentId, profile);
  if (a.status !== "PUBLISHED") throw conflict("This assignment is closed for submissions.", "ASSIGNMENT_CLOSED");
  if (a.submissions[0]?.status === "GRADED") {
    throw conflict("This submission has already been reviewed and can't be changed.", "ALREADY_GRADED");
  }
  return a;
}

/** POST /me/assignments/:id/upload-url — presigned PUT for the submission file */
export async function requestSubmissionUpload(req: Request, res: Response): Promise<void> {
  const profile = await getStudentProfileForUser(req.user!.userId);
  const a = await assertCanSubmit(param(req.params["id"]), profile);
  const { fileName, fileType, fileSize } = req.body as { fileName: string; fileType: string; fileSize: number };
  ok(res, await generatePresignedUploadUrl("assignment", profile.id, fileType, fileSize, a.id, fileName));
}

/** POST /me/assignments/:id/submit — body { fileUrl } after the upload succeeded. Re-submission replaces the file. */
export async function submitAssignment(req: Request, res: Response): Promise<void> {
  const profile = await getStudentProfileForUser(req.user!.userId);
  const a = await assertCanSubmit(param(req.params["id"]), profile);
  const { fileUrl } = req.body as { fileUrl: string };
  if (!fileUrl) throw badRequest("fileUrl is required");

  const canonical = await assertOwnedUploadedFile(fileUrl, "assignment", profile.id, a.id);
  const now = new Date();
  const status = now > a.dueAt ? "LATE" : "SUBMITTED";
  const previous = a.submissions[0]?.fileUrl ?? null;

  if (previous && previous !== canonical) await deleteS3Object(previous);
  const sub = await prisma.assignmentSubmission.upsert({
    where: { assignmentId_studentProfileId: { assignmentId: a.id, studentProfileId: profile.id } },
    update: { fileUrl: canonical, submittedAt: now, status },
    create: { assignmentId: a.id, studentProfileId: profile.id, fileUrl: canonical, submittedAt: now, status },
  });
  ok(
    res,
    { status, submittedAt: sub.submittedAt },
    { message: status === "LATE" ? "Submitted after the due date." : "Assignment submitted." }
  );
}
