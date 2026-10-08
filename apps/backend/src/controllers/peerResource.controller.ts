/**
 * Share with Peers — student-to-student study material (/me/peer-resources)
 * and the moderation view for teachers/admins with MODERATE_PEER_RESOURCES (/admin/peer-resources).
 *
 * Scope semantics (stored from the uploader's profile at post time):
 *   CLASS    → same branch + semester + section
 *   BRANCH   → same branch, any semester
 *   SEMESTER → same semester, any branch
 * Uploaders always see their own posts.
 */
import { Request, Response } from "express";
import type { PeerResourceCategory, PeerResourceScope, Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import { PEER_RESOURCE_DAILY_LIMIT } from "../config/validation.js";
import { audit } from "../services/audit.service.js";
import { getStudentProfileForUser } from "../services/student.service.js";
import { studentDisplayName } from "../services/teacher.service.js";
import { deleteS3Object, fileExtension, generatePresignedUploadUrl, signFileUrl, verifyOwnedUpload } from "../utils/s3.js";
import { HttpError, badRequest, created, notFound, ok, pagination, param, queryInt, queryString } from "../utils/http.js";

const CATEGORIES: PeerResourceCategory[] = [
  "PREVIOUS_YEAR_PAPER",
  "LAB_MANUAL",
  "REFERENCE_MATERIAL",
  "USEFUL_LINK",
  "CHEATSHEET",
  "OTHER",
];
const SCOPES: PeerResourceScope[] = ["CLASS", "BRANCH", "SEMESTER"];

const asCategory = (v: string | undefined) => (v && (CATEGORIES as string[]).includes(v) ? (v as PeerResourceCategory) : undefined);
const asScope = (v: string | undefined) => (v && (SCOPES as string[]).includes(v) ? (v as PeerResourceScope) : undefined);

const peerInclude = {
  uploadedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      profileImageUrl: true,
      currentSemester: true,
      branch: { select: { id: true, shortCode: true } },
    },
  },
  subject: { select: { id: true, name: true, code: true } },
} satisfies Prisma.PeerResourceInclude;

type PeerRow = Prisma.PeerResourceGetPayload<{ include: typeof peerInclude }>;

/** Card shape shared by the student feed and moderation view. Never exposes email/enrollment number. */
async function serializePeer(r: PeerRow, viewerProfileId?: string) {
  const u = r.uploadedBy;
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    scope: r.scope,
    subject: r.subject,
    kind: r.fileUrl ? ("FILE" as const) : ("LINK" as const),
    fileUrl: await signFileUrl(r.fileUrl, undefined, r.fileName),
    fileName: r.fileName,
    fileSize: r.fileSize,
    fileType: r.fileUrl ? (fileExtension(r.fileName) ?? fileExtension(r.fileUrl)) : null,
    linkUrl: r.linkUrl,
    createdAt: r.createdAt,
    isMine: viewerProfileId ? u.id === viewerProfileId : undefined,
    uploader: {
      name: studentDisplayName(u, null),
      avatarUrl: await signFileUrl(u.profileImageUrl),
      branch: u.branch.shortCode,
      semester: u.currentSemester,
    },
  };
}

function searchWhere(q: string | undefined): Prisma.PeerResourceWhereInput {
  if (!q) return {};
  const term = q.slice(0, 100);
  return {
    OR: [
      { title: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
    ],
  };
}

async function page(where: Prisma.PeerResourceWhereInput, query: Record<string, unknown>) {
  const { page, limit, skip } = pagination(query, { limit: 20, max: 50 });
  const rows = await prisma.peerResource.findMany({
    where,
    include: peerInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip,
    take: limit + 1,
  });
  return { rows: rows.slice(0, limit), page, limit, hasMore: rows.length > limit };
}

// ── Student ─────────────────────────────────────────────────────────────────

/** POST /me/peer-resources/upload-url — presigned PUT into the student's own peer-resources prefix */
export async function requestPeerUpload(req: Request, res: Response): Promise<void> {
  const profile = await getStudentProfileForUser(req.user!.userId);
  const { fileName, fileType, fileSize } = req.body as { fileName: string; fileType: string; fileSize: number };
  ok(res, await generatePresignedUploadUrl("peer-resource", profile.id, fileType, fileSize, undefined, fileName));
}

/** GET /me/peer-resources?q=&category=&scope=&subjectId=&mine=true&page=&limit= */
export async function listPeerResources(req: Request, res: Response): Promise<void> {
  const profile = await getStudentProfileForUser(req.user!.userId);
  const mine = queryString(req.query, "mine") === "true";
  const category = asCategory(queryString(req.query, "category"));
  const scope = asScope(queryString(req.query, "scope"));
  const subjectId = queryString(req.query, "subjectId");

  const visible: Prisma.PeerResourceWhereInput[] = [
    { scope: "BRANCH", scopeBranchId: profile.branchId },
    { scope: "SEMESTER", scopeSemester: profile.currentSemester },
    { uploadedById: profile.id },
  ];
  if (profile.section) {
    visible.push({
      scope: "CLASS",
      scopeBranchId: profile.branchId,
      scopeSemester: profile.currentSemester,
      scopeSection: { equals: profile.section.trim(), mode: "insensitive" },
    });
  }

  const where: Prisma.PeerResourceWhereInput = {
    AND: [
      mine ? { uploadedById: profile.id } : { OR: visible },
      searchWhere(queryString(req.query, "q")),
      category ? { category } : {},
      scope ? { scope } : {},
      subjectId ? { subjectId } : {},
    ],
  };

  const { rows, ...meta } = await page(where, req.query);
  ok(res, { items: await Promise.all(rows.map((r) => serializePeer(r, profile.id))), ...meta });
}

/** POST /me/peer-resources — exactly one of fileUrl / linkUrl */
export async function createPeerResource(req: Request, res: Response): Promise<void> {
  const profile = await getStudentProfileForUser(req.user!.userId);
  const body = req.body as {
    title: string;
    description?: string | null;
    category: PeerResourceCategory;
    subjectId?: string | null;
    scope: PeerResourceScope;
    fileUrl?: string | null;
    fileName?: string | null;
    linkUrl?: string | null;
  };

  if (!!body.fileUrl === !!body.linkUrl) throw badRequest("Attach either a file or a link (not both).", "FILE_OR_LINK");

  const section = profile.section?.trim() || null;
  if (body.scope === "CLASS" && !section) {
    throw badRequest(
      "Your section isn't set on your profile, so you can't share with your class yet. Choose Branch or Semester instead.",
      "SECTION_NOT_SET"
    );
  }

  if (body.subjectId) {
    const subject = await prisma.subject.findUnique({ where: { id: body.subjectId }, select: { branchId: true } });
    if (!subject || subject.branchId !== profile.branchId) throw badRequest("Pick a subject from your branch.", "INVALID_SUBJECT");
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.peerResource.count({ where: { uploadedById: profile.id, createdAt: { gte: since } } });
  if (recent >= PEER_RESOURCE_DAILY_LIMIT) {
    throw new HttpError(429, "You've shared a lot today. Please try again tomorrow.", "PEER_DAILY_LIMIT");
  }

  let file: { url: string; size: number } | null = null;
  if (body.fileUrl) file = await verifyOwnedUpload(body.fileUrl, "peer-resource", profile.id);

  const row = await prisma.peerResource.create({
    data: {
      uploadedById: profile.id,
      title: body.title,
      description: body.description ?? null,
      category: body.category,
      subjectId: body.subjectId ?? null,
      fileUrl: file?.url ?? null,
      fileName: file ? (body.fileName ?? null) : null,
      fileSize: file?.size || null,
      linkUrl: file ? null : (body.linkUrl ?? null),
      scope: body.scope,
      scopeBranchId: profile.branchId,
      scopeSemester: body.scope === "BRANCH" ? null : profile.currentSemester,
      scopeSection: body.scope === "CLASS" ? section : null,
    },
    include: peerInclude,
  });
  created(res, await serializePeer(row, profile.id), { message: "Shared with your peers" });
}

/** DELETE /me/peer-resources/:id — own posts only */
export async function deleteMyPeerResource(req: Request, res: Response): Promise<void> {
  const profile = await getStudentProfileForUser(req.user!.userId);
  const row = await prisma.peerResource.findUnique({ where: { id: param(req.params["id"]) } });
  if (!row || row.uploadedById !== profile.id) throw notFound("Post not found");
  if (row.fileUrl) await deleteS3Object(row.fileUrl);
  await prisma.peerResource.delete({ where: { id: row.id } });
  ok(res, undefined, { message: "Post deleted" });
}

// ── Moderation (teacher/admin with MODERATE_PEER_RESOURCES) ─────────────────

/** GET /admin/peer-resources?q=&category=&scope=&branchId=&semester=&page=&limit= */
export async function moderationList(req: Request, res: Response): Promise<void> {
  const category = asCategory(queryString(req.query, "category"));
  const scope = asScope(queryString(req.query, "scope"));
  const branchId = queryString(req.query, "branchId");
  const semester = queryInt(req.query, "semester");

  const where: Prisma.PeerResourceWhereInput = {
    AND: [
      searchWhere(queryString(req.query, "q")),
      category ? { category } : {},
      scope ? { scope } : {},
      branchId ? { scopeBranchId: branchId } : {},
      semester ? { scopeSemester: semester } : {},
    ],
  };

  const [{ rows, ...meta }, total] = await Promise.all([page(where, req.query), prisma.peerResource.count({ where })]);
  ok(res, {
    items: await Promise.all(
      rows.map(async (r) => ({ ...(await serializePeer(r)), scopeSection: r.scopeSection, scopeSemester: r.scopeSemester }))
    ),
    total,
    ...meta,
  });
}

/** DELETE /admin/peer-resources/:id */
export async function moderationDelete(req: Request, res: Response): Promise<void> {
  const row = await prisma.peerResource.findUnique({ where: { id: param(req.params["id"]) } });
  if (!row) throw notFound("Post not found");
  if (row.fileUrl) await deleteS3Object(row.fileUrl);
  await prisma.peerResource.delete({ where: { id: row.id } });
  await audit({
    actorUserId: req.user!.userId,
    action: "PEER_RESOURCE_REMOVED",
    targetEntity: "PeerResource",
    targetId: row.id,
    metadata: { title: row.title, uploadedById: row.uploadedById, category: row.category, scope: row.scope },
  });
  ok(res, undefined, { message: "Post removed" });
}
