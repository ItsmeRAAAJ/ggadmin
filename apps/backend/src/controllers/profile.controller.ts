import { Request, Response } from "express";
import prisma from "../db/prisma.js";
import {
  generatePresignedUploadUrl,
  assertOwnedUploadedFile,
  signFileUrl,
  deleteS3Object,
  S3UploadContext,
} from "../utils/s3.js";
import { getStudentProfileForUser } from "../services/student.service.js";
import { badRequest, created, notFound, ok, param } from "../utils/http.js";

type UploadBody = { fileName: string; fileType: string; fileSize: number };

const toDate = (v: string | null | undefined) => (v === undefined ? undefined : v === null ? null : new Date(v));

/** Remove undefined keys so Prisma treats them as "no change" (exactOptionalPropertyTypes-safe). */
function defined<T extends Record<string, unknown>>(obj: T): { [K in keyof T]: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as never;
}

function completeness(p: {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  dateOfBirth: Date | null;
  profileImageUrl: string | null;
  techResumeUrl: string | null;
  nonTechResumeUrl: string | null;
  _count: { certificates: number; projects: number; achievements: number; socialLinks: number };
}) {
  const checks = [
    { key: "name", label: "Add your name", done: !!(p.firstName && p.lastName) },
    { key: "phone", label: "Add a phone number", done: !!p.phone },
    { key: "dob", label: "Add your date of birth", done: !!p.dateOfBirth },
    { key: "photo", label: "Upload a profile photo", done: !!p.profileImageUrl },
    { key: "resume", label: "Upload a resume", done: !!(p.techResumeUrl || p.nonTechResumeUrl) },
    { key: "projects", label: "Add a project", done: p._count.projects > 0 },
    { key: "certificates", label: "Add a certificate", done: p._count.certificates > 0 },
    { key: "achievements", label: "Add an achievement", done: p._count.achievements > 0 },
    { key: "socialLinks", label: "Add a social link", done: p._count.socialLinks > 0 },
  ];
  const doneCount = checks.filter((c) => c.done).length;
  return { percent: Math.round((doneCount / checks.length) * 100), missing: checks.filter((c) => !c.done) };
}

/** GET /me/profile */
export async function getMyProfile(req: Request, res: Response): Promise<void> {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId: req.user!.userId },
    include: {
      user: { select: { email: true, enrollmentNumber: true } },
      branch: true,
      certificates: { orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }] },
      projects: { orderBy: [{ startDate: "desc" }, { createdAt: "desc" }] },
      achievements: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
      socialLinks: { orderBy: { platform: "asc" } },
      _count: { select: { certificates: true, projects: true, achievements: true, socialLinks: true } },
    },
  });
  if (!profile) throw notFound("Student profile not found");

  const { _count, user, ...rest } = profile;
  ok(res, {
    ...rest,
    email: user.email,
    enrollmentNumber: user.enrollmentNumber,
    profileImageUrl: await signFileUrl(profile.profileImageUrl),
    techResumeUrl: await signFileUrl(profile.techResumeUrl),
    nonTechResumeUrl: await signFileUrl(profile.nonTechResumeUrl),
    certificates: await Promise.all(
      profile.certificates.map(async (c) => ({ ...c, fileUrl: await signFileUrl(c.fileUrl) }))
    ),
    achievements: await Promise.all(
      profile.achievements.map(async (a) => ({ ...a, fileUrl: await signFileUrl(a.fileUrl) }))
    ),
    completeness: completeness(profile),
  });
}

/** PATCH /me/profile — personal details only (academic fields are admin-managed). */
export async function updateMyProfile(req: Request, res: Response): Promise<void> {
  const profile = await getStudentProfileForUser(req.user!.userId);
  const body = req.body as {
    firstName?: string;
    lastName?: string;
    phone?: string | null;
    dateOfBirth?: string | null;
    section?: string | null;
  };

  if (body.dateOfBirth) {
    const dob = new Date(body.dateOfBirth);
    const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (age < 14 || age > 80) throw badRequest("Please enter a valid date of birth", "INVALID_DOB");
  }

  const updated = await prisma.studentProfile.update({
    where: { id: profile.id },
    data: defined({
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
      section: body.section,
      dateOfBirth: toDate(body.dateOfBirth),
    }),
  });
  ok(res, updated);
}

// ── Uploads: presign → client PUTs to S3 → confirm ───────────────────────────

async function presign(req: Request, res: Response, context: S3UploadContext): Promise<void> {
  const profile = await getStudentProfileForUser(req.user!.userId);
  const { fileName, fileType, fileSize } = req.body as UploadBody;
  const result = await generatePresignedUploadUrl(context, profile.id, fileType, fileSize, undefined, fileName);
  ok(res, { uploadUrl: result.uploadUrl, fileUrl: result.fileUrl, expiresIn: result.expiresIn });
}

/** POST /me/profile/photo — presign */
export const requestPhotoUpload = (req: Request, res: Response) => presign(req, res, "profile-photo");
/** POST /me/profile/certificate-upload — presign */
export const requestCertificateUpload = (req: Request, res: Response) => presign(req, res, "certificate");
/** POST /me/profile/achievement-upload — presign */
export const requestAchievementUpload = (req: Request, res: Response) => presign(req, res, "achievement");

function resumeContext(kind: string): { context: S3UploadContext; field: "techResumeUrl" | "nonTechResumeUrl" } {
  if (kind === "tech") return { context: "resume-tech", field: "techResumeUrl" };
  if (kind === "non-tech") return { context: "resume-non-tech", field: "nonTechResumeUrl" };
  throw notFound("Unknown resume type");
}

/** POST /me/profile/resume/:kind — presign */
export async function requestResumeUpload(req: Request, res: Response): Promise<void> {
  const { context } = resumeContext(param(req.params["kind"]));
  await presign(req, res, context);
}

/** PUT /me/profile/photo — confirm upload and set as profile photo */
export async function confirmPhotoUpload(req: Request, res: Response): Promise<void> {
  const profile = await getStudentProfileForUser(req.user!.userId);
  const fileUrl = await assertOwnedUploadedFile((req.body as { fileUrl: string }).fileUrl, "profile-photo", profile.id);
  if (profile.profileImageUrl && profile.profileImageUrl !== fileUrl) await deleteS3Object(profile.profileImageUrl);
  await prisma.studentProfile.update({ where: { id: profile.id }, data: { profileImageUrl: fileUrl } });
  ok(res, { profileImageUrl: await signFileUrl(fileUrl) });
}

/** DELETE /me/profile/photo */
export async function deletePhoto(req: Request, res: Response): Promise<void> {
  const profile = await getStudentProfileForUser(req.user!.userId);
  if (profile.profileImageUrl) await deleteS3Object(profile.profileImageUrl);
  await prisma.studentProfile.update({ where: { id: profile.id }, data: { profileImageUrl: null } });
  ok(res, { profileImageUrl: null });
}

/** PUT /me/profile/resume/:kind — confirm upload (replaces the previous file) */
export async function confirmResumeUpload(req: Request, res: Response): Promise<void> {
  const { context, field } = resumeContext(param(req.params["kind"]));
  const profile = await getStudentProfileForUser(req.user!.userId);
  const { fileUrl: submittedFileUrl } = req.body as { fileUrl: string };
  const fileUrl = await assertOwnedUploadedFile(submittedFileUrl, context, profile.id);
  const previous = profile[field];
  if (previous && previous !== fileUrl) await deleteS3Object(previous);
  await prisma.studentProfile.update({ where: { id: profile.id }, data: { [field]: fileUrl } });
  ok(res, { [field]: await signFileUrl(fileUrl) });
}

/** DELETE /me/profile/resume/:kind */
export async function deleteResume(req: Request, res: Response): Promise<void> {
  const { field } = resumeContext(param(req.params["kind"]));
  const profile = await getStudentProfileForUser(req.user!.userId);
  if (profile[field]) await deleteS3Object(profile[field]);
  await prisma.studentProfile.update({ where: { id: profile.id }, data: { [field]: null } });
  ok(res, { [field]: null });
}

// ── Owned child records (certificates, projects, achievements, social links) ─

async function findOwned<T extends { studentProfileId: string }>(
  finder: () => Promise<T | null>,
  profileId: string,
  label: string
): Promise<T> {
  const record = await finder();
  if (!record || record.studentProfileId !== profileId) throw notFound(`${label} not found`);
  return record;
}

// Certificates

export async function addCertificate(req: Request, res: Response): Promise<void> {
  const profile = await getStudentProfileForUser(req.user!.userId);
  const body = req.body as { title: string; issuer?: string | null; issueDate?: string | null; fileUrl: string };
  const fileUrl = await assertOwnedUploadedFile(body.fileUrl, "certificate", profile.id);
  const cert = await prisma.certificate.create({
    data: {
      studentProfileId: profile.id,
      title: body.title,
      issuer: body.issuer ?? null,
      issueDate: toDate(body.issueDate) ?? null,
      fileUrl,
    },
  });
  created(res, { ...cert, fileUrl: await signFileUrl(cert.fileUrl) });
}

export async function updateCertificate(req: Request, res: Response): Promise<void> {
  const profile = await getStudentProfileForUser(req.user!.userId);
  const id = param(req.params["id"]);
  const existing = await findOwned(() => prisma.certificate.findUnique({ where: { id } }), profile.id, "Certificate");
  const body = req.body as { title?: string; issuer?: string | null; issueDate?: string | null; fileUrl?: string };
  const fileUrl = body.fileUrl ? await assertOwnedUploadedFile(body.fileUrl, "certificate", profile.id) : undefined;
  if (fileUrl && fileUrl !== existing.fileUrl) await deleteS3Object(existing.fileUrl);
  const cert = await prisma.certificate.update({
    where: { id },
    data: defined({ title: body.title, issuer: body.issuer, issueDate: toDate(body.issueDate), fileUrl }),
  });
  ok(res, { ...cert, fileUrl: await signFileUrl(cert.fileUrl) });
}

export async function deleteCertificate(req: Request, res: Response): Promise<void> {
  const profile = await getStudentProfileForUser(req.user!.userId);
  const id = param(req.params["id"]);
  const cert = await findOwned(() => prisma.certificate.findUnique({ where: { id } }), profile.id, "Certificate");
  await deleteS3Object(cert.fileUrl);
  await prisma.certificate.delete({ where: { id } });
  ok(res, undefined, { message: "Certificate deleted" });
}

// Projects

type ProjectBody = {
  title?: string;
  description?: string | null;
  techStack?: string[];
  link?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

export async function addProject(req: Request, res: Response): Promise<void> {
  const profile = await getStudentProfileForUser(req.user!.userId);
  const body = req.body as ProjectBody & { title: string };
  const project = await prisma.project.create({
    data: {
      studentProfileId: profile.id,
      title: body.title,
      description: body.description ?? null,
      techStack: body.techStack ?? [],
      link: body.link ?? null,
      startDate: toDate(body.startDate) ?? null,
      endDate: toDate(body.endDate) ?? null,
    },
  });
  created(res, project);
}

export async function updateProject(req: Request, res: Response): Promise<void> {
  const profile = await getStudentProfileForUser(req.user!.userId);
  const id = param(req.params["id"]);
  await findOwned(() => prisma.project.findUnique({ where: { id } }), profile.id, "Project");
  const body = req.body as ProjectBody;
  const project = await prisma.project.update({
    where: { id },
    data: defined({
      title: body.title,
      description: body.description,
      techStack: body.techStack,
      link: body.link,
      startDate: toDate(body.startDate),
      endDate: toDate(body.endDate),
    }),
  });
  ok(res, project);
}

export async function deleteProject(req: Request, res: Response): Promise<void> {
  const profile = await getStudentProfileForUser(req.user!.userId);
  const id = param(req.params["id"]);
  await findOwned(() => prisma.project.findUnique({ where: { id } }), profile.id, "Project");
  await prisma.project.delete({ where: { id } });
  ok(res, undefined, { message: "Project deleted" });
}

// Achievements

type AchievementBody = {
  title?: string;
  description?: string | null;
  date?: string | null;
  fileUrl?: string | null;
  category?: "ACADEMIC" | "CO_CURRICULAR" | "EXTRA_CURRICULAR";
};

export async function addAchievement(req: Request, res: Response): Promise<void> {
  const profile = await getStudentProfileForUser(req.user!.userId);
  const body = req.body as AchievementBody & { title: string; category: NonNullable<AchievementBody["category"]> };
  const fileUrl = body.fileUrl ? await assertOwnedUploadedFile(body.fileUrl, "achievement", profile.id) : null;
  const achievement = await prisma.achievement.create({
    data: {
      studentProfileId: profile.id,
      title: body.title,
      description: body.description ?? null,
      date: toDate(body.date) ?? null,
      category: body.category,
      fileUrl,
    },
  });
  created(res, { ...achievement, fileUrl: await signFileUrl(achievement.fileUrl) });
}

export async function updateAchievement(req: Request, res: Response): Promise<void> {
  const profile = await getStudentProfileForUser(req.user!.userId);
  const id = param(req.params["id"]);
  const existing = await findOwned(() => prisma.achievement.findUnique({ where: { id } }), profile.id, "Achievement");
  const body = req.body as AchievementBody;
  let fileUrl: string | null | undefined;
  if (body.fileUrl === null) fileUrl = null;
  else if (body.fileUrl) fileUrl = await assertOwnedUploadedFile(body.fileUrl, "achievement", profile.id);

  if (fileUrl !== undefined && existing.fileUrl && fileUrl !== existing.fileUrl) await deleteS3Object(existing.fileUrl);
  const achievement = await prisma.achievement.update({
    where: { id },
    data: defined({
      title: body.title,
      description: body.description,
      date: toDate(body.date),
      category: body.category,
      fileUrl,
    }),
  });
  ok(res, { ...achievement, fileUrl: await signFileUrl(achievement.fileUrl) });
}

export async function deleteAchievement(req: Request, res: Response): Promise<void> {
  const profile = await getStudentProfileForUser(req.user!.userId);
  const id = param(req.params["id"]);
  const achievement = await findOwned(() => prisma.achievement.findUnique({ where: { id } }), profile.id, "Achievement");
  if (achievement.fileUrl) await deleteS3Object(achievement.fileUrl);
  await prisma.achievement.delete({ where: { id } });
  ok(res, undefined, { message: "Achievement deleted" });
}

// Social links

export async function addSocialLink(req: Request, res: Response): Promise<void> {
  const profile = await getStudentProfileForUser(req.user!.userId);
  const { platform, url } = req.body as { platform: string; url: string };
  const count = await prisma.socialLink.count({ where: { studentProfileId: profile.id } });
  if (count >= 10) throw badRequest("You can add up to 10 links", "LIMIT_REACHED");
  const link = await prisma.socialLink.create({ data: { studentProfileId: profile.id, platform, url } });
  created(res, link);
}

export async function updateSocialLink(req: Request, res: Response): Promise<void> {
  const profile = await getStudentProfileForUser(req.user!.userId);
  const id = param(req.params["id"]);
  await findOwned(() => prisma.socialLink.findUnique({ where: { id } }), profile.id, "Link");
  const body = req.body as { platform?: string; url?: string };
  const link = await prisma.socialLink.update({ where: { id }, data: defined({ platform: body.platform, url: body.url }) });
  ok(res, link);
}

export async function deleteSocialLink(req: Request, res: Response): Promise<void> {
  const profile = await getStudentProfileForUser(req.user!.userId);
  const id = param(req.params["id"]);
  await findOwned(() => prisma.socialLink.findUnique({ where: { id } }), profile.id, "Link");
  await prisma.socialLink.delete({ where: { id } });
  ok(res, undefined, { message: "Link deleted" });
}
