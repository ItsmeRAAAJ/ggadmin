/**
 * Admin: placement-cell access to complete student profiles, branch-wise (/admin/placement).
 * Read-only JSON meant to be consumed by any placement dashboard / frontend.
 */
import { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import { audit } from "../services/audit.service.js";
import { PAGINATION_MAX_LIMIT, S3_SIGNED_GET_EXPIRY_SECONDS } from "../config/validation.js";
import { signFileUrl } from "../utils/s3.js";
import { badRequest, notFound, ok, pagination, param, queryInt, queryString } from "../utils/http.js";
import { maskEmail, maskPhone, visibility } from "./adminStudents.controller.js";

const DEFAULT_LIMIT = 50;
const STATUSES = ["ACTIVE", "PENDING_ACTIVATION", "DISABLED"] as const;

const profileInclude = {
  user: { select: { id: true, enrollmentNumber: true, email: true, status: true, createdAt: true } },
  branch: { select: { id: true, shortCode: true, name: true } },
  certificates: { orderBy: [{ issueDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }] },
  projects: { orderBy: [{ startDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }] },
  achievements: { orderBy: [{ date: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }] },
  socialLinks: true,
} satisfies Prisma.StudentProfileInclude;

type FullProfile = Prisma.StudentProfileGetPayload<{ include: typeof profileInclude }>;
type Visibility = { email: boolean; phone: boolean };

function setNoStore(res: Response): void {
  res.setHeader("Cache-Control", "no-store");
}

async function serializeProfile(s: FullProfile, vis: Visibility) {
  const link = (platform: string) => s.socialLinks.find((l) => l.platform === platform)?.url ?? null;
  const fullName = [s.firstName, s.lastName].filter(Boolean).join(" ").trim() || null;

  const [profileImageUrl, techResumeUrl, nonTechResumeUrl, certificates, achievements] = await Promise.all([
    signFileUrl(s.profileImageUrl),
    signFileUrl(s.techResumeUrl),
    signFileUrl(s.nonTechResumeUrl),
    Promise.all(
      s.certificates.map(async (c) => ({
        id: c.id,
        title: c.title,
        issuer: c.issuer,
        issueDate: c.issueDate,
        fileUrl: await signFileUrl(c.fileUrl),
        createdAt: c.createdAt,
      }))
    ),
    Promise.all(
      s.achievements.map(async (a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        category: a.category,
        date: a.date,
        fileUrl: await signFileUrl(a.fileUrl),
        createdAt: a.createdAt,
      }))
    ),
  ]);

  return {
    id: s.id,
    userId: s.user.id,
    enrollmentNumber: s.user.enrollmentNumber,
    status: s.user.status,
    firstName: s.firstName,
    lastName: s.lastName,
    fullName,
    email: vis.email ? s.user.email : maskEmail(s.user.email),
    phone: vis.phone ? s.phone : maskPhone(s.phone),
    dateOfBirth: s.dateOfBirth,
    profileImageUrl,
    academic: {
      branch: s.branch,
      admissionYear: s.admissionYear,
      passoutYear: s.passoutYear,
      currentSemester: s.currentSemester,
      section: s.section,
    },
    resumes: { tech: techResumeUrl, nonTech: nonTechResumeUrl },
    links: { linkedin: link("LINKEDIN"), github: link("GITHUB"), portfolio: link("PORTFOLIO") },
    socialLinks: s.socialLinks.map((l) => ({ id: l.id, platform: l.platform, url: l.url })),
    certificates,
    projects: s.projects.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      techStack: p.techStack,
      link: p.link,
      startDate: p.startDate,
      endDate: p.endDate,
      createdAt: p.createdAt,
    })),
    achievements,
    counts: { certificates: s.certificates.length, projects: s.projects.length, achievements: s.achievements.length },
    joinedAt: s.user.createdAt,
    updatedAt: s.updatedAt,
  };
}

/** `status` query: one of STATUSES, or "ALL". Defaults to ACTIVE (students who completed onboarding). */
function statusFilter(query: Record<string, unknown>): Prisma.UserWhereInput | undefined {
  const raw = (queryString(query, "status") ?? "ACTIVE").toUpperCase();
  if (raw === "ALL") return undefined;
  if (!(STATUSES as readonly string[]).includes(raw)) {
    throw badRequest(`Invalid status. Use one of: ${[...STATUSES, "ALL"].join(", ")}`, "INVALID_STATUS");
  }
  return { status: raw as (typeof STATUSES)[number] };
}

/** GET /admin/placement/branches — every branch with its student count. */
export async function listPlacementBranches(req: Request, res: Response): Promise<void> {
  const userWhere = statusFilter(req.query);
  const branches = await prisma.branch.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      shortCode: true,
      name: true,
      _count: { select: { studentProfiles: userWhere ? { where: { user: userWhere } } : true } },
    },
  });
  setNoStore(res);
  ok(res, {
    items: branches.map((b) => ({ id: b.id, shortCode: b.shortCode, name: b.name, studentCount: b._count.studentProfiles })),
    total: branches.length,
  });
}

/** GET /admin/placement/branches/:branchCode/students — complete profiles for one branch (paginated). */
export async function listBranchProfiles(req: Request, res: Response): Promise<void> {
  const code = param(req.params["branchCode"]).trim();
  const branch = await prisma.branch.findFirst({
    where: { OR: [{ shortCode: { equals: code, mode: "insensitive" } }, { id: code }] },
    select: { id: true, shortCode: true, name: true },
  });
  if (!branch) throw notFound("Branch not found");

  const userWhere = statusFilter(req.query);
  const where: Prisma.StudentProfileWhereInput = { branchId: branch.id };
  if (userWhere) where.user = userWhere;

  const admissionYear = queryInt(req.query, "admissionYear");
  const passoutYear = queryInt(req.query, "passoutYear");
  const currentSemester = queryInt(req.query, "currentSemester");
  const section = queryString(req.query, "section");
  const search = queryString(req.query, "search");
  if (admissionYear) where.admissionYear = admissionYear;
  if (passoutYear) where.passoutYear = passoutYear;
  if (currentSemester) where.currentSemester = currentSemester;
  if (section) where.section = { equals: section, mode: "insensitive" };
  if (search) {
    where.OR = [
      { user: { enrollmentNumber: { contains: search, mode: "insensitive" } } },
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
    ];
  }

  const { page, limit, skip } = pagination(req.query, { limit: DEFAULT_LIMIT, max: PAGINATION_MAX_LIMIT });
  const vis = await visibility(req.user!.userId);

  const [total, students] = await Promise.all([
    prisma.studentProfile.count({ where }),
    prisma.studentProfile.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ passoutYear: "asc" }, { user: { enrollmentNumber: "asc" } }],
      include: profileInclude,
    }),
  ]);
  const items = await Promise.all(students.map((s) => serializeProfile(s, vis)));

  await audit({
    actorUserId: req.user!.userId,
    action: "VIEW_PLACEMENT_PROFILES",
    targetEntity: "StudentProfile",
    metadata: { branch: branch.shortCode, page, limit, returned: items.length, filters: req.query, emailVisible: vis.email, phoneVisible: vis.phone },
  });

  setNoStore(res);
  ok(res, {
    branch,
    items,
    total,
    page,
    limit,
    totalPages: Math.max(Math.ceil(total / limit), 1),
    visibility: vis,
    linksExpireInSeconds: S3_SIGNED_GET_EXPIRY_SECONDS,
  });
}

/** GET /admin/placement/students/:id — one complete profile (by profile id or enrollment number). */
export async function getPlacementProfile(req: Request, res: Response): Promise<void> {
  const id = param(req.params["id"]).trim();
  const s = await prisma.studentProfile.findFirst({
    where: { OR: [{ id }, { user: { enrollmentNumber: { equals: id, mode: "insensitive" } } }] },
    include: profileInclude,
  });
  if (!s) throw notFound("Student not found");
  const vis = await visibility(req.user!.userId);
  const profile = await serializeProfile(s, vis);

  await audit({
    actorUserId: req.user!.userId,
    action: "VIEW_PLACEMENT_PROFILE",
    targetEntity: "StudentProfile",
    targetId: s.id,
    metadata: { enrollmentNumber: s.user.enrollmentNumber, emailVisible: vis.email, phoneVisible: vis.phone },
  });

  setNoStore(res);
  ok(res, { ...profile, visibility: vis, linksExpireInSeconds: S3_SIGNED_GET_EXPIRY_SECONDS });
}
