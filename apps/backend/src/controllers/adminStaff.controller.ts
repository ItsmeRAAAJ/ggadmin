/**
 * Admin: dashboard, teachers, admins (hierarchy + grants), permission master list, admin roles, audit log.
 */
import { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import {
  getActorContext,
  getAdminDescendantIds,
  getPermissionId,
  getTeacherDescendantIds,
  hasPermission,
  invalidatePermissionCache,
  isAdminAncestorOf,
} from "../services/permission.service.js";
import { audit } from "../services/audit.service.js";
import {
  DEFAULT_TEACHER_GRANTS,
  PERMISSIONS,
  SUPERADMIN_ROLE_KEY,
  TEACHER_GRANTABLE_CATEGORIES,
} from "../config/permissions.js";
import { PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT } from "../config/validation.js";
import {
  HttpError,
  badRequest,
  conflict,
  created,
  forbidden,
  notFound,
  ok,
  pagination,
  param,
  queryString,
} from "../utils/http.js";

async function actorAdmin(userId: string) {
  const ctx = await getActorContext(userId);
  if (!ctx.admin) throw forbidden("Admin profile required");
  return { ...ctx, admin: ctx.admin };
}

async function assertEmailFree(email: string): Promise<void> {
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    throw conflict("An account with this email already exists.", "EMAIL_TAKEN");
  }
}

// ── Dashboard ───────────────────────────────────────────────────────────────

/** GET /admin/dashboard */
export async function getDashboard(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const [statusGroups, teachers, admins, branches, subjects, perBranch, canSeeAudit] = await Promise.all([
    prisma.user.groupBy({ by: ["status"], where: { role: "STUDENT" }, _count: { _all: true } }),
    prisma.teacherProfile.count(),
    prisma.adminProfile.count(),
    prisma.branch.findMany({ select: { id: true } }).then((b) => b.length),
    prisma.subject.count(),
    prisma.branch.findMany({
      select: { id: true, shortCode: true, name: true, _count: { select: { studentProfiles: true } } },
      orderBy: { shortCode: "asc" },
    }),
    hasPermission(userId, PERMISSIONS.VIEW_AUDIT_LOGS),
  ]);
  const count = (s: string) => statusGroups.find((g) => g.status === s)?._count._all ?? 0;
  const recentActivity = canSeeAudit
    ? await prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { actor: { select: { email: true } } },
      })
    : null;

  ok(res, {
    students: {
      total: count("ACTIVE") + count("PENDING_ACTIVATION") + count("DISABLED"),
      active: count("ACTIVE"),
      pending: count("PENDING_ACTIVATION"),
      disabled: count("DISABLED"),
    },
    teachers,
    admins,
    branches,
    subjects,
    studentsPerBranch: perBranch.map((b) => ({ id: b.id, shortCode: b.shortCode, name: b.name, count: b._count.studentProfiles })),
    recentActivity,
  });
}

// ── Teachers ────────────────────────────────────────────────────────────────

const teacherListInclude = {
  user: { select: { id: true, email: true, status: true } },
  primaryBranch: { select: { id: true, shortCode: true, name: true } },
  reportsTo: { select: { id: true, name: true, tier: true } },
  _count: { select: { assignments: true, manages: true } },
} as const;

/** GET /admin/teachers?search=&tier=&branchId= */
export async function listTeachers(req: Request, res: Response): Promise<void> {
  const search = queryString(req.query, "search");
  const tier = queryString(req.query, "tier");
  const branchId = queryString(req.query, "branchId");
  const where: Prisma.TeacherProfileWhereInput = {
    ...(tier && ["HOD", "INCHARGE", "SUBJECT_TEACHER"].includes(tier) ? { tier: tier as "HOD" } : {}),
    ...(branchId ? { primaryBranchId: branchId } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { user: { email: { contains: search, mode: "insensitive" } } },
            { department: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const teachers = await prisma.teacherProfile.findMany({ where, include: teacherListInclude, orderBy: [{ tier: "asc" }, { name: "asc" }] });
  ok(res, teachers);
}

/** GET /admin/teachers/:id */
export async function getTeacher(req: Request, res: Response): Promise<void> {
  const t = await prisma.teacherProfile.findUnique({
    where: { id: param(req.params["id"]) },
    include: {
      ...teacherListInclude,
      manages: { select: { id: true, name: true, tier: true } },
      assignments: {
        include: { subject: { include: { branch: { select: { id: true, shortCode: true } } } } },
        orderBy: { academicYear: "desc" },
      },
      permissionGrants: {
        include: { permission: true, grantedBy: { select: { email: true } } },
        orderBy: { grantedAt: "asc" },
      },
    },
  });
  if (!t) throw notFound("Teacher not found");
  ok(res, t);
}

async function assertReportsToValid(teacherId: string | null, reportsToId: string | null | undefined): Promise<void> {
  if (!reportsToId) return;
  if (teacherId && reportsToId === teacherId) throw badRequest("A teacher can't report to themselves.", "INVALID_HIERARCHY");
  const manager = await prisma.teacherProfile.findUnique({ where: { id: reportsToId }, select: { id: true } });
  if (!manager) throw notFound("Reporting teacher not found");
  if (teacherId && (await getTeacherDescendantIds(teacherId)).includes(reportsToId)) {
    throw badRequest("That would create a reporting loop.", "INVALID_HIERARCHY");
  }
}

async function assertBranch(branchId: string | null | undefined): Promise<void> {
  if (branchId && !(await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true } }))) {
    throw notFound("Branch not found");
  }
}

/** POST /admin/teachers — creates a PENDING_ACTIVATION teacher with tier default grants */
export async function createTeacher(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const body = req.body as {
    email: string;
    name: string;
    department?: string | null;
    tier: "HOD" | "INCHARGE" | "SUBJECT_TEACHER";
    primaryBranchId?: string | null;
    reportsToId?: string | null;
  };
  await assertEmailFree(body.email);
  await assertBranch(body.primaryBranchId);
  await assertReportsToValid(null, body.reportsToId);

  const defaultKeys = DEFAULT_TEACHER_GRANTS[body.tier];
  const permissionIds = (await Promise.all(defaultKeys.map((k) => getPermissionId(k)))).filter((x): x is string => !!x);

  const teacher = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: body.email,
        role: "TEACHER",
        status: "PENDING_ACTIVATION",
        teacherProfile: {
          create: {
            name: body.name,
            department: body.department ?? null,
            tier: body.tier,
            primaryBranchId: body.primaryBranchId ?? null,
            reportsToId: body.reportsToId ?? null,
          },
        },
      },
      include: { teacherProfile: true },
    });
    const profile = user.teacherProfile!;
    if (permissionIds.length) {
      await tx.teacherPermissionGrant.createMany({
        data: permissionIds.map((permissionId) => ({ teacherProfileId: profile.id, permissionId, grantedByUserId: userId })),
      });
    }
    await audit(
      {
        actorUserId: userId,
        action: "CREATE_TEACHER",
        targetEntity: "TeacherProfile",
        targetId: profile.id,
        metadata: { email: body.email, tier: body.tier, defaultGrants: defaultKeys },
      },
      tx
    );
    return profile;
  });
  created(res, teacher, { message: "Teacher created. They can activate their account by signing in with this email." });
}

/** PATCH /admin/teachers/:id */
export async function updateTeacher(req: Request, res: Response): Promise<void> {
  const id = param(req.params["id"]);
  const body = req.body as {
    name?: string;
    department?: string | null;
    tier?: "HOD" | "INCHARGE" | "SUBJECT_TEACHER";
    primaryBranchId?: string | null;
    reportsToId?: string | null;
    status?: "ACTIVE" | "DISABLED";
  };
  const t = await prisma.teacherProfile.findUnique({ where: { id }, include: { user: true } });
  if (!t) throw notFound("Teacher not found");
  await assertBranch(body.primaryBranchId);
  await assertReportsToValid(id, body.reportsToId);
  if (body.status === "ACTIVE" && !t.user.passwordHash) {
    throw badRequest("This teacher hasn't activated their account yet.", "NOT_ONBOARDED");
  }

  await prisma.$transaction(async (tx) => {
    const data: Prisma.TeacherProfileUncheckedUpdateInput = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.department !== undefined) data.department = body.department;
    if (body.tier !== undefined) data.tier = body.tier;
    if (body.primaryBranchId !== undefined) data.primaryBranchId = body.primaryBranchId;
    if (body.reportsToId !== undefined) data.reportsToId = body.reportsToId;
    if (Object.keys(data).length) await tx.teacherProfile.update({ where: { id }, data });
    if (body.status && body.status !== t.user.status) {
      await tx.user.update({
        where: { id: t.userId },
        data: { status: body.status, ...(body.status === "DISABLED" ? { tokenVersion: { increment: 1 } } : {}) },
      });
    }
    await audit({ actorUserId: req.user!.userId, action: "UPDATE_TEACHER", targetEntity: "TeacherProfile", targetId: id, metadata: body }, tx);
  });
  ok(res, undefined, { message: "Teacher updated" });
}

/** POST /admin/teachers/:id/permissions — body { permissionKey } */
export async function grantTeacherPermission(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const id = param(req.params["id"]);
  const { permissionKey } = req.body as { permissionKey: string };
  if (!(await prisma.teacherProfile.findUnique({ where: { id }, select: { id: true } }))) throw notFound("Teacher not found");
  const permission = await prisma.permission.findUnique({ where: { key: permissionKey } });
  if (!permission) throw notFound("Permission not found");
  if (!TEACHER_GRANTABLE_CATEGORIES.includes(permission.category)) {
    throw badRequest("Admin-management permissions can't be granted to teachers.", "NOT_GRANTABLE");
  }
  if (!(await hasPermission(userId, permission.key))) {
    throw forbidden("You can only grant permissions you hold yourself.", "ESCALATION_DENIED");
  }
  const grant = await prisma.teacherPermissionGrant.upsert({
    where: { teacherProfileId_permissionId: { teacherProfileId: id, permissionId: permission.id } },
    update: {},
    create: { teacherProfileId: id, permissionId: permission.id, grantedByUserId: userId },
  });
  await audit({ actorUserId: userId, action: "GRANT_TEACHER_PERMISSION", targetEntity: "TeacherProfile", targetId: id, metadata: { permissionKey } });
  created(res, grant);
}

/** DELETE /admin/teachers/:id/permissions/:permissionKey */
export async function revokeTeacherPermission(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const id = param(req.params["id"]);
  const permissionKey = param(req.params["permissionKey"]);
  if (!(await hasPermission(userId, permissionKey))) {
    throw forbidden("You can only revoke permissions you hold yourself.", "ESCALATION_DENIED");
  }
  const permissionId = await getPermissionId(permissionKey);
  if (!permissionId) throw notFound("Permission not found");
  const result = await prisma.teacherPermissionGrant.deleteMany({ where: { teacherProfileId: id, permissionId } });
  if (result.count === 0) throw notFound("Grant not found");
  await audit({ actorUserId: userId, action: "REVOKE_TEACHER_PERMISSION", targetEntity: "TeacherProfile", targetId: id, metadata: { permissionKey } });
  ok(res, undefined, { message: "Permission revoked" });
}

// ── Admins ──────────────────────────────────────────────────────────────────

const adminInclude = {
  user: { select: { id: true, email: true, status: true } },
  parentAdmin: { select: { id: true, name: true } },
  roleAssignments: { include: { adminRole: { select: { id: true, key: true, label: true } } } },
  _count: { select: { managedAdmins: true, permissionGrantsReceived: true } },
} as const;

/** Throws unless the actor may manage the target admin (super admin, or strict ancestor). */
async function assertManagesAdmin(actor: { isSuperAdmin: boolean; admin: { profileId: string } }, targetId: string): Promise<void> {
  if (actor.admin.profileId === targetId) throw forbidden("You can't change your own access.", "SELF_MANAGEMENT");
  if (actor.isSuperAdmin) return;
  if (!(await isAdminAncestorOf(actor.admin.profileId, targetId))) {
    throw forbidden("You can only manage admins below you.", "NOT_ANCESTOR");
  }
}

/** GET /admin/admins — me + everyone below me (super admin sees all) */
export async function listAdmins(req: Request, res: Response): Promise<void> {
  const actor = await actorAdmin(req.user!.userId);
  const where: Prisma.AdminProfileWhereInput = actor.isSuperAdmin
    ? {}
    : { id: { in: [actor.admin.profileId, ...(await getAdminDescendantIds(actor.admin.profileId))] } };
  const admins = await prisma.adminProfile.findMany({ where, include: adminInclude, orderBy: { createdAt: "asc" } });
  ok(
    res,
    admins.map((a) => ({
      ...a,
      isSelf: a.id === actor.admin.profileId,
      isSuperAdmin: a.roleAssignments.some((r) => r.adminRole.key === SUPERADMIN_ROLE_KEY),
    }))
  );
}

/** GET /admin/admins/:id */
export async function getAdmin(req: Request, res: Response): Promise<void> {
  const actor = await actorAdmin(req.user!.userId);
  const id = param(req.params["id"]);
  if (!actor.isSuperAdmin && id !== actor.admin.profileId && !(await isAdminAncestorOf(actor.admin.profileId, id))) {
    throw notFound("Admin not found");
  }
  const a = await prisma.adminProfile.findUnique({
    where: { id },
    include: {
      ...adminInclude,
      managedAdmins: { select: { id: true, name: true, user: { select: { email: true } } } },
      permissionGrantsReceived: {
        include: { permission: true, grantedBy: { select: { email: true } } },
        orderBy: { grantedAt: "asc" },
      },
    },
  });
  if (!a) throw notFound("Admin not found");
  const isSuper = a.roleAssignments.some((r) => r.adminRole.key === SUPERADMIN_ROLE_KEY);
  ok(res, {
    ...a,
    isSelf: a.id === actor.admin.profileId,
    isSuperAdmin: isSuper,
    canManage: a.id !== actor.admin.profileId && (actor.isSuperAdmin || !isSuper),
  });
}

async function resolveRoles(keys: string[], actorIsSuper: boolean) {
  const roles = await prisma.adminRole.findMany({ where: { key: { in: keys } } });
  const missing = keys.filter((k) => !roles.some((r) => r.key === k));
  if (missing.length) throw notFound(`Unknown admin role: ${missing.join(", ")}`);
  if (!actorIsSuper && roles.some((r) => r.key === SUPERADMIN_ROLE_KEY)) {
    throw forbidden("Only a Super Admin can assign the Super Admin role.", "ESCALATION_DENIED");
  }
  return roles;
}

/** POST /admin/admins — create an admin below me */
export async function createAdmin(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const actor = await actorAdmin(userId);
  const body = req.body as { email: string; name: string; adminRoleKey: string };
  await assertEmailFree(body.email);
  const [role] = await resolveRoles([body.adminRoleKey], actor.isSuperAdmin);

  const admin = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: body.email,
        role: "ADMIN",
        status: "PENDING_ACTIVATION",
        adminProfile: {
          create: {
            name: body.name,
            parentAdminId: actor.admin.profileId,
            roleAssignments: { create: { adminRoleId: role!.id } },
          },
        },
      },
      include: { adminProfile: true },
    });
    await audit(
      {
        actorUserId: userId,
        action: "CREATE_ADMIN",
        targetEntity: "AdminProfile",
        targetId: user.adminProfile!.id,
        metadata: { email: body.email, role: role!.key },
      },
      tx
    );
    return user.adminProfile!;
  });
  created(res, admin, { message: "Admin created. They can activate their account by signing in with this email." });
}

/** PATCH /admin/admins/:id — name / status / roles */
export async function updateAdmin(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const actor = await actorAdmin(userId);
  const id = param(req.params["id"]);
  const body = req.body as { name?: string; status?: "ACTIVE" | "DISABLED"; adminRoleKeys?: string[] };

  const target = await prisma.adminProfile.findUnique({ where: { id }, include: { user: true, roleAssignments: { include: { adminRole: true } } } });
  if (!target) throw notFound("Admin not found");
  const isSelfNameOnly = id === actor.admin.profileId && Object.keys(body).every((k) => k === "name");
  if (!isSelfNameOnly) await assertManagesAdmin(actor, id);

  const targetIsSuper = target.roleAssignments.some((r) => r.adminRole.key === SUPERADMIN_ROLE_KEY);
  if (targetIsSuper && !actor.isSuperAdmin) throw forbidden("Only a Super Admin can change another Super Admin.", "ESCALATION_DENIED");
  const roles = body.adminRoleKeys ? await resolveRoles(body.adminRoleKeys, actor.isSuperAdmin) : null;
  if (body.status === "ACTIVE" && !target.user.passwordHash) {
    throw badRequest("This admin hasn't activated their account yet.", "NOT_ONBOARDED");
  }

  await prisma.$transaction(async (tx) => {
    if (body.name !== undefined) await tx.adminProfile.update({ where: { id }, data: { name: body.name } });
    if (roles) {
      await tx.adminRoleAssignment.deleteMany({ where: { adminProfileId: id } });
      await tx.adminRoleAssignment.createMany({ data: roles.map((r) => ({ adminProfileId: id, adminRoleId: r.id })) });
    }
    if (body.status && body.status !== target.user.status) {
      await tx.user.update({
        where: { id: target.userId },
        data: { status: body.status, ...(body.status === "DISABLED" ? { tokenVersion: { increment: 1 } } : {}) },
      });
    }
    await audit({ actorUserId: userId, action: "UPDATE_ADMIN", targetEntity: "AdminProfile", targetId: id, metadata: body }, tx);
  });
  ok(res, undefined, { message: "Admin updated" });
}

async function assertCanGrantToAdmin(userId: string, targetId: string, permissionKey: string) {
  const actor = await actorAdmin(userId);
  if (!(await hasPermission(userId, PERMISSIONS.MANAGE_ADMIN_HIERARCHY))) {
    throw forbidden(`This action requires the "${PERMISSIONS.MANAGE_ADMIN_HIERARCHY}" permission`, "MISSING_PERMISSION");
  }
  await assertManagesAdmin(actor, targetId);
  const permission = await prisma.permission.findUnique({ where: { key: permissionKey } });
  if (!permission) throw notFound("Permission not found");
  if (!(await hasPermission(userId, permission.key))) {
    throw forbidden("You can only grant or revoke permissions you hold yourself.", "ESCALATION_DENIED");
  }
  return permission;
}

/** POST /admin/admins/:id/permissions — body { permissionKey } */
export async function grantAdminPermission(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const id = param(req.params["id"]);
  const permission = await assertCanGrantToAdmin(userId, id, (req.body as { permissionKey: string }).permissionKey);
  const grant = await prisma.adminPermissionGrant.upsert({
    where: { adminProfileId_permissionId: { adminProfileId: id, permissionId: permission.id } },
    update: {},
    create: { adminProfileId: id, permissionId: permission.id, grantedByUserId: userId },
  });
  await audit({ actorUserId: userId, action: "GRANT_ADMIN_PERMISSION", targetEntity: "AdminProfile", targetId: id, metadata: { permissionKey: permission.key } });
  created(res, grant);
}

/** DELETE /admin/admins/:id/permissions/:permissionKey */
export async function revokeAdminPermission(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const id = param(req.params["id"]);
  const permission = await assertCanGrantToAdmin(userId, id, param(req.params["permissionKey"]));
  const result = await prisma.adminPermissionGrant.deleteMany({ where: { adminProfileId: id, permissionId: permission.id } });
  if (result.count === 0) throw notFound("Grant not found");
  await audit({ actorUserId: userId, action: "REVOKE_ADMIN_PERMISSION", targetEntity: "AdminProfile", targetId: id, metadata: { permissionKey: permission.key } });
  ok(res, undefined, { message: "Permission revoked" });
}

// ── Permission master list ──────────────────────────────────────────────────

/** GET /admin/permissions */
export async function listPermissions(_req: Request, res: Response): Promise<void> {
  const permissions = await prisma.permission.findMany({
    orderBy: [{ category: "asc" }, { key: "asc" }],
    include: { _count: { select: { adminGrants: true, teacherGrants: true } } },
  });
  ok(res, permissions);
}

/** POST /admin/permissions */
export async function createPermission(req: Request, res: Response): Promise<void> {
  const body = req.body as { key: string; label: string; description?: string | null; category: "ADMIN_MANAGEMENT" };
  if (await prisma.permission.findUnique({ where: { key: body.key } })) throw conflict("A permission with this key already exists.", "DUPLICATE");
  const permission = await prisma.permission.create({
    data: { key: body.key, label: body.label, description: body.description ?? null, category: body.category },
  });
  invalidatePermissionCache();
  await audit({ actorUserId: req.user!.userId, action: "CREATE_PERMISSION", targetEntity: "Permission", targetId: permission.id, metadata: body });
  created(res, permission);
}

/** PATCH /admin/permissions/:id — label/description only; keys are immutable */
export async function updatePermission(req: Request, res: Response): Promise<void> {
  const id = param(req.params["id"]);
  const body = req.body as { label?: string; description?: string | null };
  const data: Prisma.PermissionUpdateInput = {};
  if (body.label !== undefined) data.label = body.label;
  if (body.description !== undefined) data.description = body.description;
  const permission = await prisma.permission.update({ where: { id }, data });
  await audit({ actorUserId: req.user!.userId, action: "UPDATE_PERMISSION", targetEntity: "Permission", targetId: id, metadata: body });
  ok(res, permission);
}

// ── Admin roles ─────────────────────────────────────────────────────────────

async function assertSuperAdmin(userId: string): Promise<void> {
  const ctx = await getActorContext(userId);
  if (!ctx.isSuperAdmin) throw new HttpError(403, "Only a Super Admin can manage role types.", "SUPERADMIN_ONLY");
}

/** GET /admin/admin-roles */
export async function listAdminRoles(_req: Request, res: Response): Promise<void> {
  const roles = await prisma.adminRole.findMany({ orderBy: { createdAt: "asc" }, include: { _count: { select: { assignments: true } } } });
  ok(res, roles);
}

/** POST /admin/admin-roles */
export async function createAdminRole(req: Request, res: Response): Promise<void> {
  await assertSuperAdmin(req.user!.userId);
  const body = req.body as { key: string; label: string };
  if (await prisma.adminRole.findUnique({ where: { key: body.key } })) throw conflict("A role with this key already exists.", "DUPLICATE");
  const role = await prisma.adminRole.create({ data: body });
  await audit({ actorUserId: req.user!.userId, action: "CREATE_ADMIN_ROLE", targetEntity: "AdminRole", targetId: role.id, metadata: body });
  created(res, role);
}

/** PATCH /admin/admin-roles/:id */
export async function updateAdminRole(req: Request, res: Response): Promise<void> {
  await assertSuperAdmin(req.user!.userId);
  const id = param(req.params["id"]);
  const { label } = req.body as { label: string };
  const role = await prisma.adminRole.update({ where: { id }, data: { label } });
  await audit({ actorUserId: req.user!.userId, action: "UPDATE_ADMIN_ROLE", targetEntity: "AdminRole", targetId: id, metadata: { label } });
  ok(res, role);
}

// ── Audit log ───────────────────────────────────────────────────────────────

/** GET /admin/audit-logs?action=&actor=&from=&to=&page=&limit= */
export async function listAuditLogs(req: Request, res: Response): Promise<void> {
  const { page, limit, skip } = pagination(req.query, { limit: PAGINATION_DEFAULT_LIMIT, max: PAGINATION_MAX_LIMIT });
  const action = queryString(req.query, "action");
  const actor = queryString(req.query, "actor");
  const from = queryString(req.query, "from");
  const to = queryString(req.query, "to");

  const createdAt: Prisma.DateTimeFilter = {};
  if (from && !Number.isNaN(Date.parse(from))) createdAt.gte = new Date(from);
  if (to && !Number.isNaN(Date.parse(to))) createdAt.lte = new Date(to);

  const where: Prisma.AuditLogWhereInput = {
    ...(action ? { action } : {}),
    ...(actor ? { actor: { email: { contains: actor, mode: "insensitive" } } } : {}),
    ...(Object.keys(createdAt).length ? { createdAt } : {}),
  };

  const [total, items, actions] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { id: true, email: true, role: true } } },
    }),
    prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
  ]);

  ok(res, {
    items: items.map((i) => {
      let metadata: unknown = i.metadata;
      try {
        metadata = i.metadata ? JSON.parse(i.metadata) : null;
      } catch {
        /* keep raw string */
      }
      return { ...i, metadata };
    }),
    total,
    page,
    limit,
    totalPages: Math.max(Math.ceil(total / limit), 1),
    actions: actions.map((a) => a.action),
  });
}
