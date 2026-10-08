/**
 * Student-facing Academics endpoints: deadlines timeline, current subjects and teacher resources.
 * Visibility follows assignments: a student sees subjects of their branch + current semester (section ignored).
 */
import { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import { ACADEMIC_TIMEZONE } from "../config/validation.js";
import { getStudentProfileForUser, isEligibleForSubject, studentSubjectFilter } from "../services/student.service.js";
import { fileExtension, signFileUrl } from "../utils/s3.js";
import { notFound, ok, param, queryString } from "../utils/http.js";

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ACADEMIC_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar date (YYYY-MM-DD) of an instant in the college's timezone. */
const dayKey = (d: Date) => dayKeyFormatter.format(d);
const dayNumber = (key: string) => Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) / 86_400_000;

/** GET /me/deadlines?when=upcoming|past|all — flat list plus groups by calendar day (Asia/Kolkata). */
export async function getMyDeadlines(req: Request, res: Response): Promise<void> {
  const profile = await getStudentProfileForUser(req.user!.userId);
  const when = queryString(req.query, "when") ?? "upcoming";
  const now = new Date();

  const where: Prisma.AcademicDeadlineWhereInput = { subject: studentSubjectFilter(profile) };
  if (when === "upcoming") where.dueAt = { gte: now };
  else if (when === "past") where.dueAt = { lt: now };

  const deadlines = await prisma.academicDeadline.findMany({
    where,
    include: {
      subject: { select: { id: true, name: true, code: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { dueAt: when === "past" ? "desc" : "asc" },
    take: 300,
  });

  const today = dayNumber(dayKey(now));
  const items = deadlines.map((d) => {
    const date = dayKey(d.dueAt);
    return {
      id: d.id,
      title: d.title,
      description: d.description,
      dueAt: d.dueAt,
      date,
      daysLeft: dayNumber(date) - today, // 0 = today, 1 = tomorrow, negative = past
      isPast: d.dueAt < now,
      subject: d.subject,
      teacherName: d.createdBy.name,
    };
  });

  const groups: { date: string; daysLeft: number; items: typeof items }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.date === item.date) last.items.push(item);
    else groups.push({ date: item.date, daysLeft: item.daysLeft, items: [item] });
  }

  ok(res, { timezone: ACADEMIC_TIMEZONE, items, groups });
}

/** GET /me/subjects — current subjects with resource folder/file counts */
export async function getMySubjects(req: Request, res: Response): Promise<void> {
  const profile = await getStudentProfileForUser(req.user!.userId);
  const subjects = await prisma.subject.findMany({
    where: studentSubjectFilter(profile),
    select: {
      id: true,
      name: true,
      code: true,
      semester: true,
      resourceFolders: { select: { _count: { select: { files: true } } } },
    },
    orderBy: { name: "asc" },
  });
  ok(
    res,
    subjects.map(({ resourceFolders, ...s }) => ({
      ...s,
      folderCount: resourceFolders.length,
      fileCount: resourceFolders.reduce((n, f) => n + f._count.files, 0),
    }))
  );
}

async function loadEligibleSubject(subjectId: string, profile: { branchId: string; currentSemester: number }) {
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: { id: true, name: true, code: true, semester: true, branchId: true },
  });
  if (!subject || !isEligibleForSubject(profile, subject)) throw notFound("Subject not found");
  return subject;
}

/** GET /me/subjects/:subjectId/resources — the subject's folders */
export async function getSubjectResources(req: Request, res: Response): Promise<void> {
  const profile = await getStudentProfileForUser(req.user!.userId);
  const { branchId: _b, ...subject } = await loadEligibleSubject(param(req.params["subjectId"]), profile);
  const folders = await prisma.resourceFolder.findMany({
    where: { subjectId: subject.id },
    select: { id: true, name: true, order: true, createdAt: true, _count: { select: { files: true } } },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  ok(res, {
    subject,
    folders: folders.map(({ _count, ...f }) => ({ ...f, fileCount: _count.files })),
  });
}

/** GET /me/resource-folders/:id — files in a folder, with short-lived signed URLs */
export async function getResourceFolder(req: Request, res: Response): Promise<void> {
  const profile = await getStudentProfileForUser(req.user!.userId);
  const folder = await prisma.resourceFolder.findUnique({
    where: { id: param(req.params["id"]) },
    include: {
      subject: { select: { id: true, name: true, code: true, semester: true, branchId: true } },
      files: { include: { uploadedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!folder || !isEligibleForSubject(profile, folder.subject)) throw notFound("Folder not found");
  const { branchId: _b, ...subject } = folder.subject;

  ok(res, {
    id: folder.id,
    name: folder.name,
    subject,
    files: await Promise.all(
      folder.files.map(async (f) => ({
        id: f.id,
        title: f.title,
        fileName: f.fileName,
        fileSize: f.fileSize,
        fileType: fileExtension(f.fileName) ?? fileExtension(f.fileUrl),
        fileUrl: await signFileUrl(f.fileUrl, undefined, f.fileName),
        teacherName: f.uploadedBy.name,
        createdAt: f.createdAt,
      }))
    ),
  });
}
