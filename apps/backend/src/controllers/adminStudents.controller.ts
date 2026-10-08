/**
 * Admin: student directory, seeding, updates and exports (/admin/students).
 */
import { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import { parse } from "csv-parse/sync";
import prisma from "../db/prisma.js";
import { hasPermission } from "../services/permission.service.js";
import { audit } from "../services/audit.service.js";
import { MAX_SEED_ROWS, seedStudents } from "../services/studentSeed.service.js";
import { PERMISSIONS } from "../config/permissions.js";
import { PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT } from "../config/validation.js";
import { signFileUrl } from "../utils/s3.js";
import { HttpError, badRequest, created, notFound, ok, pagination, param, queryInt, queryString } from "../utils/http.js";

const EXPORT_LINK_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // SigV4 maximum

// ── Masking ─────────────────────────────────────────────────────────────────

export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 2)}${"*".repeat(Math.max(local.length - 2, 3))}@${domain}`;
}
export function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  return `${"*".repeat(Math.max(phone.length - 4, 0))}${phone.slice(-4)}`;
}

export async function visibility(userId: string) {
  const [email, phone] = await Promise.all([
    hasPermission(userId, PERMISSIONS.VIEW_STUDENT_EMAIL),
    hasPermission(userId, PERMISSIONS.VIEW_STUDENT_MOBILE_NUMBER),
  ]);
  return { email, phone };
}

// ── Filters ─────────────────────────────────────────────────────────────────

function studentWhere(query: Record<string, unknown>): Prisma.StudentProfileWhereInput {
  const branchId = queryString(query, "branchId");
  const admissionYear = queryInt(query, "admissionYear");
  const passoutYear = queryInt(query, "passoutYear");
  const currentSemester = queryInt(query, "currentSemester");
  const section = queryString(query, "section");
  const status = queryString(query, "status");
  const search = queryString(query, "search");

  const where: Prisma.StudentProfileWhereInput = {};
  if (branchId) where.branchId = branchId;
  if (admissionYear) where.admissionYear = admissionYear;
  if (passoutYear) where.passoutYear = passoutYear;
  if (currentSemester) where.currentSemester = currentSemester;
  if (section) where.section = { equals: section, mode: "insensitive" };
  if (status && ["ACTIVE", "PENDING_ACTIVATION", "DISABLED"].includes(status)) {
    where.user = { status: status as "ACTIVE" };
  }
  if (search) {
    where.OR = [
      { user: { enrollmentNumber: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
    ];
  }
  return where;
}

// ── Seeding ─────────────────────────────────────────────────────────────────

const HEADER_ALIASES: Record<string, string> = {
  enrollmentnumber: "enrollmentNumber",
  enrollmentno: "enrollmentNumber",
  enrollment: "enrollmentNumber",
  email: "email",
  emailid: "email",
  branchcode: "branchCode",
  branch: "branchCode",
  admissionyear: "admissionYear",
  passoutyear: "passoutYear",
  currentsemester: "currentSemester",
  semester: "currentSemester",
  section: "section",
};

/** Canonicalize header names and drop blank cells so optional fields fall back to defaults. */
function normalizeRow(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const canonical = HEADER_ALIASES[key.replace(/^\uFEFF/, "").toLowerCase().replace(/[^a-z]/g, "")] ?? key;
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    out[canonical] = value;
  }
  return out;
}

function extractRows(req: Request): unknown[] {
  let rows: unknown[];
  if (typeof req.body === "string") {
    try {
      rows = parse(req.body.replace(/^\uFEFF/, ""), { columns: true, skip_empty_lines: true, trim: true, bom: true });
    } catch {
      throw badRequest("Couldn't read the CSV file. Check that it's a valid CSV with a header row.", "INVALID_CSV");
    }
  } else if (Array.isArray(req.body)) {
    rows = req.body;
  } else if (req.body && Array.isArray((req.body as { rows?: unknown }).rows)) {
    rows = (req.body as { rows: unknown[] }).rows;
  } else {
    throw badRequest("Send a CSV file or a JSON array of students.", "INVALID_BODY");
  }
  if (rows.length === 0) throw badRequest("The file has no student rows.", "EMPTY");
  if (rows.length > MAX_SEED_ROWS) throw badRequest(`At most ${MAX_SEED_ROWS} rows per upload.`, "TOO_MANY_ROWS");
  return rows.map(normalizeRow);
}

/** POST /admin/students/seed — CSV (text/csv) or JSON array / { rows } */
export async function seedStudentsHandler(req: Request, res: Response): Promise<void> {
  const rows = extractRows(req);
  const result = await seedStudents(rows);
  await audit({
    actorUserId: req.user!.userId,
    action: "SEED_STUDENTS",
    targetEntity: "StudentProfile",
    metadata: {
      total: result.totalRows,
      inserted: result.inserted,
      updated: result.updated,
      skippedProtected: result.skippedProtected,
      invalid: result.invalidFormat,
    },
  });
  ok(res, result);
}

/** POST /admin/students — add a single student (same rules as seeding) */
export async function addStudent(req: Request, res: Response): Promise<void> {
  const result = await seedStudents([normalizeRow(req.body)]);
  const row = result.rows[0]!;
  if (row.outcome === "invalid") throw badRequest(row.reason ?? "Invalid student details", "INVALID_ROW");
  if (row.outcome === "skipped-protected") {
    throw new HttpError(409, "This student has already activated their account and can't be overwritten.", "ACCOUNT_ACTIVE");
  }
  await audit({
    actorUserId: req.user!.userId,
    action: "ADD_STUDENT",
    targetEntity: "StudentProfile",
    metadata: { enrollmentNumber: row.enrollmentNumber, outcome: row.outcome },
  });
  created(res, row, { message: row.outcome === "inserted" ? "Student added" : "Student details updated" });
}

// ── Directory ───────────────────────────────────────────────────────────────

/** GET /admin/students */
export async function listStudents(req: Request, res: Response): Promise<void> {
  const where = studentWhere(req.query);
  const { page, limit, skip } = pagination(req.query, { limit: PAGINATION_DEFAULT_LIMIT, max: PAGINATION_MAX_LIMIT });
  const vis = await visibility(req.user!.userId);

  const [total, students] = await Promise.all([
    prisma.studentProfile.count({ where }),
    prisma.studentProfile.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ admissionYear: "desc" }, { user: { enrollmentNumber: "asc" } }],
      include: {
        user: { select: { id: true, enrollmentNumber: true, email: true, status: true } },
        branch: { select: { id: true, shortCode: true, name: true } },
      },
    }),
  ]);

  ok(res, {
    items: students.map((s) => ({
      id: s.id,
      userId: s.user.id,
      enrollmentNumber: s.user.enrollmentNumber,
      email: vis.email ? s.user.email : maskEmail(s.user.email),
      phone: vis.phone ? s.phone : maskPhone(s.phone),
      firstName: s.firstName,
      lastName: s.lastName,
      branch: s.branch,
      admissionYear: s.admissionYear,
      passoutYear: s.passoutYear,
      currentSemester: s.currentSemester,
      section: s.section,
      status: s.user.status,
      hasTechResume: !!s.techResumeUrl,
      hasNonTechResume: !!s.nonTechResumeUrl,
      updatedAt: s.updatedAt,
    })),
    total,
    page,
    limit,
    totalPages: Math.max(Math.ceil(total / limit), 1),
    visibility: vis,
  });
}

/** GET /admin/students/:id */
export async function getStudent(req: Request, res: Response): Promise<void> {
  const s = await prisma.studentProfile.findUnique({
    where: { id: param(req.params["id"]) },
    include: {
      user: { select: { id: true, enrollmentNumber: true, email: true, status: true, createdAt: true } },
      branch: true,
      certificates: { orderBy: { createdAt: "desc" } },
      projects: { orderBy: { createdAt: "desc" } },
      achievements: { orderBy: { createdAt: "desc" } },
      socialLinks: true,
    },
  });
  if (!s) throw notFound("Student not found");
  const vis = await visibility(req.user!.userId);

  ok(res, {
    ...s,
    user: { ...s.user, email: vis.email ? s.user.email : maskEmail(s.user.email) },
    phone: vis.phone ? s.phone : maskPhone(s.phone),
    profileImageUrl: await signFileUrl(s.profileImageUrl),
    techResumeUrl: await signFileUrl(s.techResumeUrl),
    nonTechResumeUrl: await signFileUrl(s.nonTechResumeUrl),
    certificates: await Promise.all(s.certificates.map(async (c) => ({ ...c, fileUrl: await signFileUrl(c.fileUrl) }))),
    achievements: await Promise.all(s.achievements.map(async (a) => ({ ...a, fileUrl: await signFileUrl(a.fileUrl) }))),
    visibility: vis,
  });
}

/** PATCH /admin/students/:id — semester / section / account status */
export async function updateStudent(req: Request, res: Response): Promise<void> {
  const body = req.body as { currentSemester?: number; section?: string | null; status?: "ACTIVE" | "DISABLED" | "PENDING_ACTIVATION" };
  const s = await prisma.studentProfile.findUnique({ where: { id: param(req.params["id"]) }, include: { user: true } });
  if (!s) throw notFound("Student not found");

  if (body.status === "ACTIVE" && !s.user.passwordHash) {
    throw badRequest("This student hasn't set a password yet, so the account can't be marked active.", "NOT_ONBOARDED");
  }

  await prisma.$transaction(async (tx) => {
    const profileData: Prisma.StudentProfileUpdateInput = {};
    if (body.currentSemester !== undefined) profileData.currentSemester = body.currentSemester;
    if (body.section !== undefined) profileData.section = body.section;
    if (Object.keys(profileData).length) await tx.studentProfile.update({ where: { id: s.id }, data: profileData });

    if (body.status && body.status !== s.user.status) {
      await tx.user.update({
        where: { id: s.user.id },
        data: {
          status: body.status,
          // Disabling or resetting activation signs the student out everywhere.
          ...(body.status !== "ACTIVE" ? { tokenVersion: { increment: 1 } } : {}),
          ...(body.status === "PENDING_ACTIVATION" ? { passwordHash: null } : {}),
        },
      });
    }
    await audit(
      {
        actorUserId: req.user!.userId,
        action: "UPDATE_STUDENT",
        targetEntity: "StudentProfile",
        targetId: s.id,
        metadata: { enrollmentNumber: s.user.enrollmentNumber, changes: body },
      },
      tx
    );
  });
  ok(res, undefined, { message: "Student updated" });
}

/** POST /admin/students/bulk-semester — move a whole batch to a semester */
export async function bulkSetSemester(req: Request, res: Response): Promise<void> {
  const { branchId, admissionYear, currentSemester } = req.body as { branchId: string; admissionYear: number; currentSemester: number };
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) throw notFound("Branch not found");
  const result = await prisma.studentProfile.updateMany({ where: { branchId, admissionYear }, data: { currentSemester } });
  await audit({
    actorUserId: req.user!.userId,
    action: "BULK_UPDATE_SEMESTER",
    targetEntity: "StudentProfile",
    metadata: { branch: branch.shortCode, admissionYear, currentSemester, count: result.count },
  });
  ok(res, { updated: result.count }, { message: `${result.count} students moved to semester ${currentSemester}` });
}

// ── Export ──────────────────────────────────────────────────────────────────

/** Quote a CSV cell and neutralize spreadsheet formula injection. */
function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** GET /admin/students/export — CSV of the filtered directory */
export async function exportStudents(req: Request, res: Response): Promise<void> {
  const where = studentWhere(req.query);
  const vis = await visibility(req.user!.userId);
  const students = await prisma.studentProfile.findMany({
    where,
    orderBy: [{ branch: { shortCode: "asc" } }, { user: { enrollmentNumber: "asc" } }],
    include: {
      user: { select: { enrollmentNumber: true, email: true, status: true } },
      branch: { select: { shortCode: true } },
      socialLinks: { select: { platform: true, url: true } },
      _count: { select: { certificates: true, projects: true, achievements: true } },
    },
  });

  const header = [
    "Enrollment Number", "First Name", "Last Name", "Email", "Phone", "Branch", "Admission Year", "Passout Year",
    "Semester", "Section", "Status", "Tech Resume", "Non-Tech Resume", "LinkedIn", "GitHub", "Portfolio",
    "Certificates", "Projects", "Achievements",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const s of students) {
    const link = (p: string) => s.socialLinks.find((l) => l.platform === p)?.url ?? "";
    lines.push(
      [
        s.user.enrollmentNumber,
        s.firstName,
        s.lastName,
        vis.email ? s.user.email : maskEmail(s.user.email),
        vis.phone ? s.phone : maskPhone(s.phone),
        s.branch.shortCode,
        s.admissionYear,
        s.passoutYear,
        s.currentSemester,
        s.section,
        s.user.status,
        await signFileUrl(s.techResumeUrl, EXPORT_LINK_EXPIRY_SECONDS),
        await signFileUrl(s.nonTechResumeUrl, EXPORT_LINK_EXPIRY_SECONDS),
        link("LINKEDIN"),
        link("GITHUB"),
        link("PORTFOLIO"),
        s._count.certificates,
        s._count.projects,
        s._count.achievements,
      ]
        .map(csvCell)
        .join(",")
    );
  }

  await audit({
    actorUserId: req.user!.userId,
    action: "EXPORT_STUDENT_PROFILES",
    targetEntity: "StudentProfile",
    metadata: { count: students.length, filters: req.query, emailVisible: vis.email, phoneVisible: vis.phone },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="students_${stamp}.csv"`);
  res.setHeader("Cache-Control", "no-store");
  res.send("\uFEFF" + lines.join("\r\n"));
}
