import prisma from "../db/prisma.js";
import { SUPERADMIN_ROLE_KEY } from "../config/permissions.js";
import { forbidden, notFound } from "../utils/http.js";

/**
 * In-memory cache of Permission.key → Permission.id. Tiny dataset, rarely changes;
 * invalidated whenever the master list is edited.
 */
let permissionCache: Map<string, string> | null = null;

export async function loadPermissionCache(): Promise<void> {
  const perms = await prisma.permission.findMany({ select: { id: true, key: true } });
  permissionCache = new Map(perms.map((p) => [p.key, p.id]));
}

export function invalidatePermissionCache(): void {
  permissionCache = null;
}

export async function getPermissionId(key: string): Promise<string | null> {
  if (!permissionCache) await loadPermissionCache();
  return permissionCache!.get(key) ?? null;
}

/** Whether a user holds a permission. Super Admin always does. */
export async function hasPermission(userId: string, permissionKey: string): Promise<boolean> {
  const permissionId = await getPermissionId(permissionKey);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      adminProfile: {
        select: {
          id: true,
          roleAssignments: { where: { adminRole: { key: SUPERADMIN_ROLE_KEY } }, select: { id: true } },
        },
      },
      teacherProfile: { select: { id: true } },
    },
  });
  if (!user) return false;

  if (user.adminProfile) {
    if (user.adminProfile.roleAssignments.length > 0) return true;
    if (!permissionId) return false;
    const grant = await prisma.adminPermissionGrant.findUnique({
      where: { adminProfileId_permissionId: { adminProfileId: user.adminProfile.id, permissionId } },
      select: { id: true },
    });
    return grant !== null;
  }

  if (user.teacherProfile && permissionId) {
    const grant = await prisma.teacherPermissionGrant.findUnique({
      where: { teacherProfileId_permissionId: { teacherProfileId: user.teacherProfile.id, permissionId } },
      select: { id: true },
    });
    return grant !== null;
  }

  return false;
}

export async function isSuperAdmin(userId: string): Promise<boolean> {
  const count = await prisma.adminRoleAssignment.count({
    where: { adminProfile: { userId }, adminRole: { key: SUPERADMIN_ROLE_KEY } },
  });
  return count > 0;
}

/** Identity + effective permissions, used by GET /auth/me and authorization helpers. */
export async function getActorContext(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      adminProfile: {
        include: {
          roleAssignments: { include: { adminRole: true } },
          permissionGrantsReceived: { include: { permission: { select: { key: true } } } },
        },
      },
      teacherProfile: {
        include: {
          primaryBranch: true,
          reportsTo: { select: { id: true, name: true, tier: true } },
          permissionGrants: { include: { permission: { select: { key: true } } } },
        },
      },
      studentProfile: { select: { id: true } },
    },
  });
  if (!user) throw notFound("User not found");

  const superAdmin =
    user.adminProfile?.roleAssignments.some((ra) => ra.adminRole.key === SUPERADMIN_ROLE_KEY) ?? false;

  let permissions: string[] = [];
  if (superAdmin) {
    permissions = (await prisma.permission.findMany({ select: { key: true } })).map((p) => p.key);
  } else if (user.adminProfile) {
    permissions = user.adminProfile.permissionGrantsReceived.map((g) => g.permission.key);
  } else if (user.teacherProfile) {
    permissions = user.teacherProfile.permissionGrants.map((g) => g.permission.key);
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    enrollmentNumber: user.enrollmentNumber,
    isSuperAdmin: superAdmin,
    permissions: permissions.sort(),
    admin: user.adminProfile
      ? {
          profileId: user.adminProfile.id,
          name: user.adminProfile.name,
          parentAdminId: user.adminProfile.parentAdminId,
          roles: user.adminProfile.roleAssignments.map((ra) => ({ key: ra.adminRole.key, label: ra.adminRole.label })),
        }
      : null,
    teacher: user.teacherProfile
      ? {
          profileId: user.teacherProfile.id,
          name: user.teacherProfile.name,
          department: user.teacherProfile.department,
          tier: user.teacherProfile.tier,
          primaryBranch: user.teacherProfile.primaryBranch,
          reportsTo: user.teacherProfile.reportsTo,
        }
      : null,
    studentProfileId: user.studentProfile?.id ?? null,
  };
}

/** Walks up targetAdmin's parent chain looking for actorAdmin. */
export async function isAdminAncestorOf(actorAdminProfileId: string, targetAdminProfileId: string): Promise<boolean> {
  let currentId: string | null = targetAdminProfileId;
  const visited = new Set<string>();
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const profile: { parentAdminId: string | null } | null = await prisma.adminProfile.findUnique({
      where: { id: currentId },
      select: { parentAdminId: true },
    });
    if (!profile) return false;
    if (profile.parentAdminId === actorAdminProfileId) return true;
    currentId = profile.parentAdminId;
  }
  return false;
}

/** Walks up targetTeacher's reportsTo chain looking for actorTeacher. */
export async function isTeacherAncestorOf(actorTeacherProfileId: string, targetTeacherProfileId: string): Promise<boolean> {
  let currentId: string | null = targetTeacherProfileId;
  const visited = new Set<string>();
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const profile: { reportsToId: string | null } | null = await prisma.teacherProfile.findUnique({
      where: { id: currentId },
      select: { reportsToId: true },
    });
    if (!profile) return false;
    if (profile.reportsToId === actorTeacherProfileId) return true;
    currentId = profile.reportsToId;
  }
  return false;
}

/** All admin profile ids below the given admin (breadth-first). */
export async function getAdminDescendantIds(adminProfileId: string): Promise<string[]> {
  const result: string[] = [];
  let frontier = [adminProfileId];
  const seen = new Set(frontier);
  while (frontier.length > 0) {
    const children = await prisma.adminProfile.findMany({
      where: { parentAdminId: { in: frontier } },
      select: { id: true },
    });
    frontier = children.map((c) => c.id).filter((id) => !seen.has(id));
    frontier.forEach((id) => seen.add(id));
    result.push(...frontier);
  }
  return result;
}

/** All teacher profile ids reporting (directly or indirectly) to the given teacher. */
export async function getTeacherDescendantIds(teacherProfileId: string): Promise<string[]> {
  const result: string[] = [];
  let frontier = [teacherProfileId];
  const seen = new Set(frontier);
  while (frontier.length > 0) {
    const children = await prisma.teacherProfile.findMany({
      where: { reportsToId: { in: frontier } },
      select: { id: true },
    });
    frontier = children.map((c) => c.id).filter((id) => !seen.has(id));
    frontier.forEach((id) => seen.add(id));
    result.push(...frontier);
  }
  return result;
}

/** Throws 403 unless the user holds the permission. */
export async function assertPermission(userId: string, key: string): Promise<void> {
  if (!(await hasPermission(userId, key))) {
    throw forbidden(`This action requires the "${key}" permission`, "MISSING_PERMISSION");
  }
}

/**
 * Whether `actorUserId` may manage (edit, grant/revoke, assign subjects to) the given teacher.
 * Allowed: Super Admin; admins holding `adminPermission`; teachers who are ancestors of the target
 * in the reportsTo chain AND hold `teacherPermission` (if provided).
 */
export async function canManageTeacher(
  actorUserId: string,
  targetTeacherProfileId: string,
  opts: { adminPermission: string; teacherPermission?: string }
): Promise<boolean> {
  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { role: true, teacherProfile: { select: { id: true } } },
  });
  if (!actor) return false;

  if (actor.role === "ADMIN") return hasPermission(actorUserId, opts.adminPermission);

  if (actor.role === "TEACHER" && actor.teacherProfile) {
    if (!(await isTeacherAncestorOf(actor.teacherProfile.id, targetTeacherProfileId))) return false;
    return opts.teacherPermission ? hasPermission(actorUserId, opts.teacherPermission) : true;
  }
  return false;
}
