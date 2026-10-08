/**
 * Teacher-facing assignment endpoints (/teacher/assignments).
 */
import { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import {
  assertTeachesSubject,
  eligibleStudentsWhere,
  getTeacherProfileForUser,
  getTeacherSubjectIds,
  studentDisplayName,
  teachesSubject,
} from "../services/teacher.service.js";
import { signFileUrl } from "../utils/s3.js";
import { badRequest, conflict, created, forbidden, notFound, ok, param, queryString } from "../utils/http.js";

async function loadForTeacher(userId: string, assignmentId: string, opts: { mustOwn?: boolean } = {}) {
  const teacher = await getTeacherProfileForUser(userId);
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId }, include: { subject: true } });
  if (!assignment) throw notFound("Assignment not found");
  const owns = assignment.createdById === teacher.id;
  if (!owns && !(await teachesSubject(teacher.id, assignment.subjectId))) throw notFound("Assignment not found");
  if (opts.mustOwn && !owns) throw forbidden("Only the teacher who created this assignment can change it", "NOT_OWNER");
  return { teacher, assignment, owns };
}

const isLate = (s: { submittedAt: Date | null }, dueAt: Date) => !!s.submittedAt && s.submittedAt > dueAt;

/** GET /teacher/assignments?subjectId=&status= */
export async function listAssignments(req: Request, res: Response): Promise<void> {
  const teacher = await getTeacherProfileForUser(req.user!.userId);
  const subjectIds = await getTeacherSubjectIds(teacher.id);
  const subjectId = queryString(req.query, "subjectId");
  const status = queryString(req.query, "status");

  const assignments = await prisma.assignment.findMany({
    where: {
      OR: [{ createdById: teacher.id }, { subjectId: { in: subjectIds } }],
      ...(subjectId ? { subjectId } : {}),
      ...(status && ["DRAFT", "PUBLISHED", "CLOSED"].includes(status) ? { status: status as "DRAFT" } : {}),
    },
    include: {
      subject: { select: { id: true, name: true, code: true, semester: true, branchId: true, branch: { select: { shortCode: true } } } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { submissions: { where: { submittedAt: { not: null } } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Eligible-student counts per (branch, semester), computed once per distinct pair.
  const pairKey = (s: { branchId: string; semester: number }) => `${s.branchId}:${s.semester}`;
  const pairs = new Map(assignments.map((a) => [pairKey(a.subject), a.subject]));
  const counts = new Map<string, number>();
  await Promise.all(
    [...pairs.entries()].map(async ([key, s]) => {
      counts.set(key, await prisma.studentProfile.count({ where: eligibleStudentsWhere(s) }));
    })
  );

  ok(
    res,
    assignments.map((a) => ({
      ...a,
      isOwner: a.createdById === teacher.id,
      eligibleCount: counts.get(pairKey(a.subject)) ?? 0,
      submittedCount: a._count.submissions,
    }))
  );
}

/** POST /teacher/assignments */
export async function createAssignment(req: Request, res: Response): Promise<void> {
  const teacher = await getTeacherProfileForUser(req.user!.userId);
  const body = req.body as { subjectId: string; title: string; description?: string | null; dueAt: string; maxMarks?: number | null };
  await assertTeachesSubject(teacher.id, body.subjectId);
  const dueAt = new Date(body.dueAt);
  if (dueAt <= new Date()) throw badRequest("Due date must be in the future.");

  const assignment = await prisma.assignment.create({
    data: {
      subjectId: body.subjectId,
      createdById: teacher.id,
      title: body.title,
      description: body.description ?? null,
      dueAt,
      maxMarks: body.maxMarks ?? null,
    },
  });
  created(res, assignment);
}

/** GET /teacher/assignments/:id */
export async function getAssignment(req: Request, res: Response): Promise<void> {
  const { teacher, assignment } = await loadForTeacher(req.user!.userId, param(req.params["id"]));
  const [full, summary] = await Promise.all([
    prisma.assignment.findUniqueOrThrow({
      where: { id: assignment.id },
      include: {
        subject: { include: { branch: { select: { id: true, shortCode: true, name: true } } } },
        createdBy: { select: { id: true, name: true } },
      },
    }),
    submissionSummary(assignment),
  ]);
  ok(res, { ...full, isOwner: full.createdById === teacher.id, summary });
}

/** GET /teacher/assignments/:id/summary — pending / submitted / late counts at a glance. */
export async function getAssignmentSummary(req: Request, res: Response): Promise<void> {
  const { assignment } = await loadForTeacher(req.user!.userId, param(req.params["id"]));
  ok(res, await submissionSummary(assignment));
}

async function submissionSummary(assignment: { id: string; dueAt: Date; subject: { branchId: string; semester: number } }) {
  const [eligible, subs] = await Promise.all([
    prisma.studentProfile.count({ where: eligibleStudentsWhere(assignment.subject) }),
    prisma.assignmentSubmission.findMany({
      where: { assignmentId: assignment.id, submittedAt: { not: null } },
      select: { status: true, submittedAt: true },
    }),
  ]);
  const late = subs.filter((s) => isLate(s, assignment.dueAt)).length;
  const graded = subs.filter((s) => s.status === "GRADED").length;
  return {
    eligible,
    submitted: subs.length,
    pending: Math.max(eligible - subs.length, 0),
    late,
    onTime: subs.length - late,
    graded,
    ungraded: subs.length - graded,
  };
}

/** PATCH /teacher/assignments/:id */
export async function updateAssignment(req: Request, res: Response): Promise<void> {
  const { assignment } = await loadForTeacher(req.user!.userId, param(req.params["id"]), { mustOwn: true });
  if (assignment.status === "CLOSED") throw conflict("Closed assignments can't be edited.", "CLOSED");
  const body = req.body as { title?: string; description?: string | null; dueAt?: string; maxMarks?: number | null };

  if (body.maxMarks !== undefined && body.maxMarks !== null) {
    const over = await prisma.assignmentSubmission.count({
      where: { assignmentId: assignment.id, marksAwarded: { gt: body.maxMarks } },
    });
    if (over > 0) throw badRequest("Some submissions were already graded above this maximum.");
  }

  const data: Prisma.AssignmentUpdateInput = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.description !== undefined) data.description = body.description;
  if (body.dueAt !== undefined) data.dueAt = new Date(body.dueAt);
  if (body.maxMarks !== undefined) data.maxMarks = body.maxMarks;

  ok(res, await prisma.assignment.update({ where: { id: assignment.id }, data }));
}

/** DELETE /teacher/assignments/:id — drafts only */
export async function deleteAssignment(req: Request, res: Response): Promise<void> {
  const { assignment } = await loadForTeacher(req.user!.userId, param(req.params["id"]), { mustOwn: true });
  if (assignment.status !== "DRAFT") throw conflict("Only draft assignments can be deleted.", "NOT_DRAFT");
  await prisma.assignment.delete({ where: { id: assignment.id } });
  ok(res, undefined, { message: "Assignment deleted" });
}

/** PATCH /teacher/assignments/:id/publish */
export async function publishAssignment(req: Request, res: Response): Promise<void> {
  const { assignment } = await loadForTeacher(req.user!.userId, param(req.params["id"]), { mustOwn: true });
  if (assignment.status !== "DRAFT") throw conflict("Assignment is already published.", "NOT_DRAFT");
  if (assignment.dueAt <= new Date()) throw badRequest("Due date is in the past. Update it before publishing.");
  ok(res, await prisma.assignment.update({ where: { id: assignment.id }, data: { status: "PUBLISHED" } }), {
    message: "Assignment published",
  });
}

/** PATCH /teacher/assignments/:id/close */
export async function closeAssignment(req: Request, res: Response): Promise<void> {
  const { assignment } = await loadForTeacher(req.user!.userId, param(req.params["id"]), { mustOwn: true });
  if (assignment.status !== "PUBLISHED") throw conflict("Only published assignments can be closed.", "NOT_PUBLISHED");
  ok(res, await prisma.assignment.update({ where: { id: assignment.id }, data: { status: "CLOSED" } }), {
    message: "Assignment closed",
  });
}

/**
 * GET /teacher/assignments/:id/submissions?status=PENDING|SUBMITTED|LATE|GRADED|UNGRADED&search=
 * PENDING lists eligible students who haven't submitted.
 */
export async function getSubmissions(req: Request, res: Response): Promise<void> {
  const { assignment } = await loadForTeacher(req.user!.userId, param(req.params["id"]));
  const status = queryString(req.query, "status")?.toUpperCase();
  const search = queryString(req.query, "search")?.toLowerCase();

  const studentSelect = {
    id: true,
    firstName: true,
    lastName: true,
    section: true,
    user: { select: { enrollmentNumber: true } },
  } as const;

  const [eligible, subs] = await Promise.all([
    prisma.studentProfile.findMany({
      where: eligibleStudentsWhere(assignment.subject),
      select: studentSelect,
      orderBy: { user: { enrollmentNumber: "asc" } },
    }),
    prisma.assignmentSubmission.findMany({
      where: { assignmentId: assignment.id, submittedAt: { not: null } },
      include: { studentProfile: { select: studentSelect } },
      orderBy: { submittedAt: "asc" },
    }),
  ]);

  const submittedIds = new Set(subs.map((s) => s.studentProfileId));
  const mapStudent = (s: (typeof eligible)[number]) => ({
    id: s.id,
    name: studentDisplayName(s, s.user.enrollmentNumber),
    enrollmentNumber: s.user.enrollmentNumber,
    section: s.section,
  });

  const submissionRows = await Promise.all(
    subs.map(async (s) => ({
      id: s.id,
      student: mapStudent(s.studentProfile),
      status: s.status === "GRADED" ? "GRADED" : isLate(s, assignment.dueAt) ? "LATE" : "SUBMITTED",
      isLate: isLate(s, assignment.dueAt),
      submittedAt: s.submittedAt,
      fileUrl: await signFileUrl(s.fileUrl),
      marksAwarded: s.marksAwarded,
      feedback: s.feedback,
    }))
  );
  const pendingRows = eligible
    .filter((s) => !submittedIds.has(s.id))
    .map((s) => ({
      id: null,
      student: mapStudent(s),
      status: "PENDING",
      isLate: false,
      submittedAt: null,
      fileUrl: null,
      marksAwarded: null,
      feedback: null,
    }));

  let rows = [...submissionRows, ...pendingRows];
  if (status === "PENDING") rows = pendingRows;
  else if (status === "LATE") rows = submissionRows.filter((r) => r.isLate);
  else if (status === "GRADED") rows = submissionRows.filter((r) => r.status === "GRADED");
  else if (status === "UNGRADED") rows = submissionRows.filter((r) => r.status !== "GRADED");
  else if (status === "SUBMITTED") rows = submissionRows;

  if (search) {
    rows = rows.filter(
      (r) => r.student.name.toLowerCase().includes(search) || (r.student.enrollmentNumber ?? "").toLowerCase().includes(search)
    );
  }

  ok(res, {
    assignment: { id: assignment.id, title: assignment.title, dueAt: assignment.dueAt, maxMarks: assignment.maxMarks, status: assignment.status },
    summary: await submissionSummary(assignment),
    rows,
  });
}

/** PATCH /teacher/assignments/:id/submissions/:submissionId/grade */
export async function gradeSubmission(req: Request, res: Response): Promise<void> {
  const { assignment } = await loadForTeacher(req.user!.userId, param(req.params["id"]));
  const submissionId = param(req.params["submissionId"]);
  const { marksAwarded, feedback } = req.body as { marksAwarded: number; feedback?: string | null };

  const sub = await prisma.assignmentSubmission.findFirst({ where: { id: submissionId, assignmentId: assignment.id } });
  if (!sub || !sub.submittedAt) throw notFound("Submission not found");
  if (assignment.maxMarks !== null && marksAwarded > assignment.maxMarks) {
    throw badRequest(`Marks can't exceed the maximum of ${assignment.maxMarks}.`, "MARKS_EXCEED_MAX");
  }

  const updated = await prisma.assignmentSubmission.update({
    where: { id: sub.id },
    data: { marksAwarded, feedback: feedback ?? null, status: "GRADED" },
  });
  ok(res, updated, { message: "Grade saved" });
}
