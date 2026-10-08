/**
 * Teacher-facing academic deadlines (/teacher/deadlines).
 * Any teacher assigned to the subject can create, edit or delete its deadlines.
 */
import { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import { assertTeachesSubject, getTeacherProfileForUser, getTeacherSubjectIds, teachesSubject } from "../services/teacher.service.js";
import { badRequest, created, notFound, ok, param, queryString } from "../utils/http.js";

const deadlineInclude = {
  subject: { select: { id: true, name: true, code: true, semester: true, branch: { select: { id: true, shortCode: true } } } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.AcademicDeadlineInclude;

function assertFuture(dueAt: Date): void {
  if (Number.isNaN(dueAt.getTime())) throw badRequest("Invalid due date.");
  if (dueAt <= new Date()) throw badRequest("Due date must be in the future.", "DUE_IN_PAST");
}

async function loadForTeacher(userId: string, deadlineId: string) {
  const teacher = await getTeacherProfileForUser(userId);
  const deadline = await prisma.academicDeadline.findUnique({ where: { id: deadlineId } });
  if (!deadline || !(await teachesSubject(teacher.id, deadline.subjectId))) throw notFound("Deadline not found");
  return { teacher, deadline };
}

/** GET /teacher/deadlines?subjectId=&when=upcoming|past|all (default upcoming) */
export async function listDeadlines(req: Request, res: Response): Promise<void> {
  const teacher = await getTeacherProfileForUser(req.user!.userId);
  const subjectIds = await getTeacherSubjectIds(teacher.id);
  const subjectId = queryString(req.query, "subjectId");
  const when = queryString(req.query, "when") ?? "upcoming";
  const now = new Date();

  const where: Prisma.AcademicDeadlineWhereInput = {
    subjectId: { in: subjectId ? subjectIds.filter((s) => s === subjectId) : subjectIds },
  };
  if (when === "upcoming") where.dueAt = { gte: now };
  else if (when === "past") where.dueAt = { lt: now };

  const deadlines = await prisma.academicDeadline.findMany({
    where,
    include: deadlineInclude,
    orderBy: { dueAt: when === "past" ? "desc" : "asc" },
    take: 500,
  });
  ok(res, deadlines.map((d) => ({ ...d, isOwner: d.createdById === teacher.id })));
}

/** POST /teacher/deadlines */
export async function createDeadline(req: Request, res: Response): Promise<void> {
  const teacher = await getTeacherProfileForUser(req.user!.userId);
  const body = req.body as { subjectId: string; title: string; description?: string | null; dueAt: string };
  await assertTeachesSubject(teacher.id, body.subjectId);
  const dueAt = new Date(body.dueAt);
  assertFuture(dueAt);

  const deadline = await prisma.academicDeadline.create({
    data: { subjectId: body.subjectId, createdById: teacher.id, title: body.title, description: body.description ?? null, dueAt },
    include: deadlineInclude,
  });
  created(res, { ...deadline, isOwner: true }, { message: "Deadline posted" });
}

/** PATCH /teacher/deadlines/:id */
export async function updateDeadline(req: Request, res: Response): Promise<void> {
  const { teacher, deadline } = await loadForTeacher(req.user!.userId, param(req.params["id"]));
  const body = req.body as { title?: string; description?: string | null; dueAt?: string };

  const data: Prisma.AcademicDeadlineUpdateInput = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.description !== undefined) data.description = body.description;
  if (body.dueAt !== undefined) {
    const dueAt = new Date(body.dueAt);
    if (dueAt.getTime() !== deadline.dueAt.getTime()) assertFuture(dueAt);
    data.dueAt = dueAt;
  }

  const updated = await prisma.academicDeadline.update({ where: { id: deadline.id }, data, include: deadlineInclude });
  ok(res, { ...updated, isOwner: updated.createdById === teacher.id }, { message: "Deadline updated" });
}

/** DELETE /teacher/deadlines/:id */
export async function deleteDeadline(req: Request, res: Response): Promise<void> {
  const { deadline } = await loadForTeacher(req.user!.userId, param(req.params["id"]));
  await prisma.academicDeadline.delete({ where: { id: deadline.id } });
  ok(res, undefined, { message: "Deadline deleted" });
}
