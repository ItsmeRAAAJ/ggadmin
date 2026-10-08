/**
 * Teacher workspace: dashboard, subjects, reporting hierarchy, team management.
 * Academic authoring lives in teacherAssignment / teacherDeadline / teacherResource controllers.
 */
import { Request, Response } from "express";
import prisma from "../db/prisma.js";
import { getTeacherProfileForUser, getTeacherSubjectIds, eligibleStudentsWhere } from "../services/teacher.service.js";
import {
  assertPermission,
  getPermissionId,
  getTeacherDescendantIds,
  hasPermission,
  isTeacherAncestorOf,
} from "../services/permission.service.js";
import { audit } from "../services/audit.service.js";
import { PERMISSIONS, TEACHER_GRANTABLE_CATEGORIES } from "../config/permissions.js";
import { badRequest, conflict, created, forbidden, notFound, ok, param } from "../utils/http.js";

const teacherSummarySelect = {
  id: true,
  name: true,
  department: true,
  tier: true,
  reportsToId: true,
  primaryBranch: { select: { id: true, shortCode: true, name: true } },
  user: { select: { email: true, status: true } },
} as const;

/** GET /teacher/dashboard */
export async function getDashboard(req: Request, res: Response): Promise<void> {
  const teacher = await getTeacherProfileForUser(req.user!.userId);
  const subjectIds = await getTeacherSubjectIds(teacher.id);
  const scope = { OR: [{ createdById: teacher.id }, { subjectId: { in: subjectIds } }] };
  const now = new Date();

  const [assignmentGroups, ungraded, upcoming, upcomingDeadlines, resourceFiles, teamSize] = await Promise.all([
    prisma.assignment.groupBy({ by: ["status"], where: scope, _count: { _all: true } }),
    prisma.assignmentSubmission.count({
      where: { assignment: scope, submittedAt: { not: null }, status: { not: "GRADED" } },
    }),
    prisma.assignment.findMany({
      where: { ...scope, status: "PUBLISHED", dueAt: { gte: now } },
      orderBy: { dueAt: "asc" },
      take: 5,
      select: { id: true, title: true, dueAt: true, subject: { select: { name: true, code: true } } },
    }),
    prisma.academicDeadline.findMany({
      where: { subjectId: { in: subjectIds }, dueAt: { gte: now } },
      orderBy: { dueAt: "asc" },
      take: 5,
      select: { id: true, title: true, dueAt: true, subject: { select: { name: true, code: true } } },
    }),
    prisma.resourceFile.count({ where: { folder: { subjectId: { in: subjectIds } } } }),
    getTeacherDescendantIds(teacher.id).then((ids) => ids.length),
  ]);

  const byStatus = (groups: { status: string; _count: { _all: number } }[]) =>
    Object.fromEntries(["DRAFT", "PUBLISHED", "CLOSED"].map((s) => [s, groups.find((g) => g.status === s)?._count._all ?? 0]));

  ok(res, {
    subjects: subjectIds.length,
    assignments: byStatus(assignmentGroups),
    ungradedSubmissions: ungraded,
    upcomingDeadlines: upcoming,
    academicDeadlines: upcomingDeadlines,
    resourceFiles,
    teamSize,
  });
}

/** GET /teacher/subjects — subjects I'm assigned to, with eligible student counts */
export async function getMySubjects(req: Request, res: Response): Promise<void> {
  const teacher = await getTeacherProfileForUser(req.user!.userId);
  const rows = await prisma.teacherSubjectAssignment.findMany({
    where: { teacherProfileId: teacher.id },
    include: { subject: { include: { branch: { select: { id: true, shortCode: true, name: true } } } } },
    orderBy: [{ academicYear: "desc" }, { subject: { semester: "asc" } }],
  });

  const counts = new Map<string, number>();
  await Promise.all(
    [...new Map(rows.map((r) => [r.subject.id, r.subject])).values()].map(async (s) => {
      counts.set(s.id, await prisma.studentProfile.count({ where: eligibleStudentsWhere(s) }));
    })
  );

  ok(
    res,
    rows.map((r) => ({
      id: r.id,
      section: r.section,
      academicYear: r.academicYear,
      subject: r.subject,
      studentCount: counts.get(r.subject.id) ?? 0,
    }))
  );
}

/** GET /teacher/hierarchy — my chain of command and direct reports */
export async function getHierarchy(req: Request, res: Response): Promise<void> {
  const teacher = await getTeacherProfileForUser(req.user!.userId);

  const chain: { id: string; name: string; tier: string }[] = [];
  let currentId = teacher.reportsToId;
  const seen = new Set<string>([teacher.id]);
  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const t: { id: string; name: string; tier: string; reportsToId: string | null } | null =
      await prisma.teacherProfile.findUnique({
        where: { id: currentId },
        select: { id: true, name: true, tier: true, reportsToId: true },
      });
    if (!t) break;
    chain.push({ id: t.id, name: t.name, tier: t.tier });
    currentId = t.reportsToId;
  }

  const [self, directReports] = await Promise.all([
    prisma.teacherProfile.findUniqueOrThrow({ where: { id: teacher.id }, select: teacherSummarySelect }),
    prisma.teacherProfile.findMany({ where: { reportsToId: teacher.id }, select: teacherSummarySelect, orderBy: { name: "asc" } }),
  ]);
  ok(res, { self, reportsToChain: chain, directReports });
}

/** GET /teacher/team — everyone below me, with their subjects and grants */
export async function getTeam(req: Request, res: Response): Promise<void> {
  const teacher = await getTeacherProfileForUser(req.user!.userId);
  const ids = await getTeacherDescendantIds(teacher.id);
  const team = await prisma.teacherProfile.findMany({
    where: { id: { in: ids } },
    select: {
      ...teacherSummarySelect,
      reportsTo: { select: { id: true, name: true } },
      assignments: {
        include: { subject: { select: { id: true, name: true, code: true, semester: true, branch: { select: { shortCode: true } } } } },
        orderBy: { academicYear: "desc" },
      },
      permissionGrants: { select: { permission: { select: { key: true, label: true } } } },
    },
    orderBy: [{ tier: "asc" }, { name: "asc" }],
  });
  ok(
    res,
    team.map((t) => ({ ...t, permissionGrants: undefined, permissions: t.permissionGrants.map((g) => g.permission) }))
  );
}

/** Subjects a teacher may assign others to: their primary branch's subjects plus subjects they teach. */
async function scopeSubjectWhere(teacher: { id: string; primaryBranchId: string | null }) {
  const taught = await getTeacherSubjectIds(teacher.id);
  return {
    OR: [
      ...(teacher.primaryBranchId ? [{ branchId: teacher.primaryBranchId }] : []),
      { id: { in: taught } },
    ],
  };
}

/** GET /teacher/scope-subjects */
export async function getScopeSubjects(req: Request, res: Response): Promise<void> {
  const teacher = await getTeacherProfileForUser(req.user!.userId);
  const subjects = await prisma.subject.findMany({
    where: await scopeSubjectWhere(teacher),
    include: { branch: { select: { id: true, shortCode: true, name: true } } },
    orderBy: [{ branch: { shortCode: "asc" } }, { semester: "asc" }, { name: "asc" }],
  });
  ok(res, subjects);
}

/** GET /teacher/permissions — my permissions and the ones I can pass down */
export async function getMyPermissions(req: Request, res: Response): Promise<void> {
  const teacher = await getTeacherProfileForUser(req.user!.userId);
  const grants = await prisma.teacherPermissionGrant.findMany({
    where: { teacherProfileId: teacher.id },
    include: { permission: true },
  });
  const mine = grants.map((g) => g.permission);
  ok(res, {
    permissions: mine,
    grantable: mine.filter((p) => TEACHER_GRANTABLE_CATEGORIES.includes(p.category)),
  });
}

async function assertCanManageTarget(actorTeacherId: string, targetTeacherId: string, allowSelf = false): Promise<void> {
  if (allowSelf && actorTeacherId === targetTeacherId) return;
  if (!(await isTeacherAncestorOf(actorTeacherId, targetTeacherId))) {
    throw forbidden("This teacher isn't in your team.", "NOT_IN_TEAM");
  }
}

/** POST /teacher/subject-assignments */
export async function createSubjectAssignment(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  await assertPermission(userId, PERMISSIONS.MANAGE_TEACHER_ASSIGNMENTS);
  const actor = await getTeacherProfileForUser(userId);
  const body = req.body as { teacherProfileId: string; subjectId: string; section?: string | null; academicYear: number };

  const target = await prisma.teacherProfile.findUnique({ where: { id: body.teacherProfileId }, select: { id: true } });
  if (!target) throw notFound("Teacher not found");
  await assertCanManageTarget(actor.id, target.id, true);

  const subject = await prisma.subject.findFirst({ where: { id: body.subjectId, ...(await scopeSubjectWhere(actor)) } });
  if (!subject) throw forbidden("This subject is outside your scope.", "OUT_OF_SCOPE");

  const section = body.section ?? null;
  const dup = await prisma.teacherSubjectAssignment.findFirst({
    where: { teacherProfileId: target.id, subjectId: subject.id, section, academicYear: body.academicYear },
  });
  if (dup) throw conflict("This teacher is already assigned to that subject/section for the year.", "DUPLICATE");

  const row = await prisma.teacherSubjectAssignment.create({
    data: { teacherProfileId: target.id, subjectId: subject.id, section, academicYear: body.academicYear },
    include: { subject: { select: { id: true, name: true, code: true } } },
  });
  await audit({
    actorUserId: userId,
    action: "ASSIGN_TEACHER_SUBJECT",
    targetEntity: "TeacherSubjectAssignment",
    targetId: row.id,
    metadata: { teacherProfileId: target.id, subjectId: subject.id, section, academicYear: body.academicYear },
  });
  created(res, row);
}

/** DELETE /teacher/subject-assignments/:id */
export async function removeSubjectAssignment(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  await assertPermission(userId, PERMISSIONS.MANAGE_TEACHER_ASSIGNMENTS);
  const actor = await getTeacherProfileForUser(userId);
  const row = await prisma.teacherSubjectAssignment.findUnique({ where: { id: param(req.params["id"]) } });
  if (!row) throw notFound("Assignment not found");
  await assertCanManageTarget(actor.id, row.teacherProfileId);

  const inScope = await prisma.subject.count({ where: { id: row.subjectId, ...(await scopeSubjectWhere(actor)) } });
  if (!inScope) throw forbidden("This subject is outside your scope.", "OUT_OF_SCOPE");

  await prisma.teacherSubjectAssignment.delete({ where: { id: row.id } });
  await audit({
    actorUserId: userId,
    action: "UNASSIGN_TEACHER_SUBJECT",
    targetEntity: "TeacherSubjectAssignment",
    targetId: row.id,
    metadata: { teacherProfileId: row.teacherProfileId, subjectId: row.subjectId },
  });
  ok(res, undefined, { message: "Removed" });
}

async function resolveGrantablePermission(actorUserId: string, permissionKey: string) {
  const permission = await prisma.permission.findUnique({ where: { key: permissionKey } });
  if (!permission) throw notFound("Permission not found");
  if (!TEACHER_GRANTABLE_CATEGORIES.includes(permission.category)) {
    throw badRequest("This permission can't be granted to teachers.", "NOT_GRANTABLE");
  }
  if (!(await hasPermission(actorUserId, permission.key))) {
    throw forbidden("You can only grant permissions you hold yourself.", "ESCALATION_DENIED");
  }
  return permission;
}

/** POST /teacher/team/:teacherId/permissions — body { permissionKey } */
export async function grantTeamPermission(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const actor = await getTeacherProfileForUser(userId);
  const targetId = param(req.params["teacherId"]);
  await assertCanManageTarget(actor.id, targetId);
  const permission = await resolveGrantablePermission(userId, (req.body as { permissionKey: string }).permissionKey);

  const grant = await prisma.teacherPermissionGrant.upsert({
    where: { teacherProfileId_permissionId: { teacherProfileId: targetId, permissionId: permission.id } },
    update: {},
    create: { teacherProfileId: targetId, permissionId: permission.id, grantedByUserId: userId },
  });
  await audit({
    actorUserId: userId,
    action: "GRANT_TEACHER_PERMISSION",
    targetEntity: "TeacherProfile",
    targetId,
    metadata: { permissionKey: permission.key },
  });
  created(res, grant);
}

/** DELETE /teacher/team/:teacherId/permissions/:permissionKey */
export async function revokeTeamPermission(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const actor = await getTeacherProfileForUser(userId);
  const targetId = param(req.params["teacherId"]);
  await assertCanManageTarget(actor.id, targetId);
  const permissionKey = param(req.params["permissionKey"]);
  await resolveGrantablePermission(userId, permissionKey);

  const permissionId = await getPermissionId(permissionKey);
  const res2 = await prisma.teacherPermissionGrant.deleteMany({ where: { teacherProfileId: targetId, permissionId: permissionId ?? "" } });
  if (res2.count === 0) throw notFound("Grant not found");
  await audit({
    actorUserId: userId,
    action: "REVOKE_TEACHER_PERMISSION",
    targetEntity: "TeacherProfile",
    targetId,
    metadata: { permissionKey },
  });
  ok(res, undefined, { message: "Permission revoked" });
}
