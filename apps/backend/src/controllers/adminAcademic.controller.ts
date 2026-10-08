/**
 * Admin: branches, subjects and teacher↔subject assignments.
 */
import { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import { audit } from "../services/audit.service.js";
import { conflict, created, notFound, ok, param, queryInt, queryString } from "../utils/http.js";

// ── Branches ────────────────────────────────────────────────────────────────

/** GET /admin/branches — available to every admin (used by filters) */
export async function listBranches(_req: Request, res: Response): Promise<void> {
  const branches = await prisma.branch.findMany({
    orderBy: { shortCode: "asc" },
    include: { _count: { select: { subjects: true, studentProfiles: true } } },
  });
  ok(res, branches);
}

/** POST /admin/branches */
export async function createBranch(req: Request, res: Response): Promise<void> {
  const { shortCode, name } = req.body as { shortCode: string; name: string };
  if (await prisma.branch.findUnique({ where: { shortCode } })) {
    throw conflict(`Branch code ${shortCode} already exists.`, "DUPLICATE");
  }
  const branch = await prisma.branch.create({ data: { shortCode, name } });
  await audit({ actorUserId: req.user!.userId, action: "CREATE_BRANCH", targetEntity: "Branch", targetId: branch.id, metadata: { shortCode, name } });
  created(res, branch);
}

/** PATCH /admin/branches/:id — rename only (the short code is referenced by seeding) */
export async function updateBranch(req: Request, res: Response): Promise<void> {
  const id = param(req.params["id"]);
  const { name } = req.body as { name: string };
  const branch = await prisma.branch.update({ where: { id }, data: { name } });
  await audit({ actorUserId: req.user!.userId, action: "UPDATE_BRANCH", targetEntity: "Branch", targetId: id, metadata: { name } });
  ok(res, branch);
}

// ── Subjects ────────────────────────────────────────────────────────────────

/** GET /admin/subjects?branchId=&semester=&search= */
export async function listSubjects(req: Request, res: Response): Promise<void> {
  const branchId = queryString(req.query, "branchId");
  const semester = queryInt(req.query, "semester");
  const search = queryString(req.query, "search");
  const where: Prisma.SubjectWhereInput = {
    ...(branchId ? { branchId } : {}),
    ...(semester ? { semester } : {}),
    ...(search
      ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { code: { contains: search, mode: "insensitive" } }] }
      : {}),
  };
  const subjects = await prisma.subject.findMany({
    where,
    include: {
      branch: { select: { id: true, shortCode: true, name: true } },
      assignments: { include: { teacherProfile: { select: { id: true, name: true } } } },
      _count: { select: { assignmentsModule: true, deadlines: true, resourceFolders: true } },
    },
    orderBy: [{ branch: { shortCode: "asc" } }, { semester: "asc" }, { code: "asc" }],
  });
  ok(res, subjects);
}

/** POST /admin/subjects */
export async function createSubject(req: Request, res: Response): Promise<void> {
  const body = req.body as { name: string; code: string; branchId: string; semester: number };
  if (!(await prisma.branch.findUnique({ where: { id: body.branchId } }))) throw notFound("Branch not found");
  if (await prisma.subject.findUnique({ where: { code: body.code } })) {
    throw conflict(`Subject code ${body.code} already exists.`, "DUPLICATE");
  }
  const subject = await prisma.subject.create({ data: body, include: { branch: { select: { id: true, shortCode: true, name: true } } } });
  await audit({ actorUserId: req.user!.userId, action: "CREATE_SUBJECT", targetEntity: "Subject", targetId: subject.id, metadata: body });
  created(res, subject);
}

/** PATCH /admin/subjects/:id */
export async function updateSubject(req: Request, res: Response): Promise<void> {
  const id = param(req.params["id"]);
  const body = req.body as { name?: string; semester?: number };
  const data: Prisma.SubjectUpdateInput = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.semester !== undefined) data.semester = body.semester;
  const subject = await prisma.subject.update({ where: { id }, data });
  await audit({ actorUserId: req.user!.userId, action: "UPDATE_SUBJECT", targetEntity: "Subject", targetId: id, metadata: body });
  ok(res, subject);
}

/** DELETE /admin/subjects/:id — only if nothing references it */
export async function deleteSubject(req: Request, res: Response): Promise<void> {
  const id = param(req.params["id"]);
  const s = await prisma.subject.findUnique({
    where: { id },
    include: { _count: { select: { assignmentsModule: true, assignments: true, deadlines: true, resourceFolders: true, peerResources: true } } },
  });
  if (!s) throw notFound("Subject not found");
  const c = s._count;
  if (c.assignmentsModule || c.assignments || c.deadlines || c.resourceFolders || c.peerResources) {
    throw conflict(
      "This subject has teachers, assignments, deadlines, resources or shared posts linked to it and can't be deleted.",
      "IN_USE"
    );
  }
  await prisma.subject.delete({ where: { id } });
  await audit({ actorUserId: req.user!.userId, action: "DELETE_SUBJECT", targetEntity: "Subject", targetId: id, metadata: { code: s.code } });
  ok(res, undefined, { message: "Subject deleted" });
}

// ── Teacher ↔ subject assignments ───────────────────────────────────────────

/** GET /admin/teacher-assignments?teacherProfileId=&subjectId=&branchId= */
export async function listTeacherAssignments(req: Request, res: Response): Promise<void> {
  const teacherProfileId = queryString(req.query, "teacherProfileId");
  const subjectId = queryString(req.query, "subjectId");
  const branchId = queryString(req.query, "branchId");
  const rows = await prisma.teacherSubjectAssignment.findMany({
    where: {
      ...(teacherProfileId ? { teacherProfileId } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(branchId ? { subject: { branchId } } : {}),
    },
    include: {
      teacherProfile: { select: { id: true, name: true, tier: true } },
      subject: { include: { branch: { select: { id: true, shortCode: true } } } },
    },
    orderBy: [{ academicYear: "desc" }, { subject: { code: "asc" } }],
  });
  ok(res, rows);
}

/** POST /admin/teacher-assignments */
export async function createTeacherAssignment(req: Request, res: Response): Promise<void> {
  const body = req.body as { teacherProfileId: string; subjectId: string; section?: string | null; academicYear: number };
  const section = body.section ?? null;
  const [teacher, subject] = await Promise.all([
    prisma.teacherProfile.findUnique({ where: { id: body.teacherProfileId } }),
    prisma.subject.findUnique({ where: { id: body.subjectId } }),
  ]);
  if (!teacher) throw notFound("Teacher not found");
  if (!subject) throw notFound("Subject not found");

  const dup = await prisma.teacherSubjectAssignment.findFirst({
    where: { teacherProfileId: teacher.id, subjectId: subject.id, section, academicYear: body.academicYear },
  });
  if (dup) throw conflict("This teacher is already assigned to that subject/section for the year.", "DUPLICATE");

  const row = await prisma.teacherSubjectAssignment.create({
    data: { teacherProfileId: teacher.id, subjectId: subject.id, section, academicYear: body.academicYear },
    include: {
      teacherProfile: { select: { id: true, name: true, tier: true } },
      subject: { include: { branch: { select: { id: true, shortCode: true } } } },
    },
  });
  await audit({
    actorUserId: req.user!.userId,
    action: "ASSIGN_TEACHER_SUBJECT",
    targetEntity: "TeacherSubjectAssignment",
    targetId: row.id,
    metadata: { teacher: teacher.name, subject: subject.code, section, academicYear: body.academicYear },
  });
  created(res, row);
}

/** DELETE /admin/teacher-assignments/:id */
export async function deleteTeacherAssignment(req: Request, res: Response): Promise<void> {
  const id = param(req.params["id"]);
  const row = await prisma.teacherSubjectAssignment.findUnique({ where: { id } });
  if (!row) throw notFound("Assignment not found");
  await prisma.teacherSubjectAssignment.delete({ where: { id } });
  await audit({
    actorUserId: req.user!.userId,
    action: "UNASSIGN_TEACHER_SUBJECT",
    targetEntity: "TeacherSubjectAssignment",
    targetId: id,
    metadata: { teacherProfileId: row.teacherProfileId, subjectId: row.subjectId },
  });
  ok(res, undefined, { message: "Removed" });
}
