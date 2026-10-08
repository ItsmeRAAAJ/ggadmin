/**
 * Teacher-managed subject resources: folders (e.g. "Unit 1", "Lab Manuals") holding files.
 * Any teacher assigned to the subject can manage its folders and files.
 */
import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import { assertTeachesSubject, getTeacherProfileForUser, getTeacherSubjectIds, teachesSubject } from "../services/teacher.service.js";
import { deleteS3Object, deleteS3Objects, fileExtension, generatePresignedUploadUrl, signFileUrl, verifyOwnedUpload } from "../utils/s3.js";
import { conflict, created, notFound, ok, param } from "../utils/http.js";

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

async function loadFolderForTeacher(userId: string, folderId: string) {
  const teacher = await getTeacherProfileForUser(userId);
  const folder = await prisma.resourceFolder.findUnique({ where: { id: folderId } });
  if (!folder || !(await teachesSubject(teacher.id, folder.subjectId))) throw notFound("Folder not found");
  return { teacher, folder };
}

async function serializeFile(f: {
  id: string;
  title: string;
  fileUrl: string;
  fileName: string | null;
  fileSize: number | null;
  createdAt: Date;
  uploadedBy?: { id: string; name: string } | null;
}) {
  return {
    id: f.id,
    title: f.title,
    fileName: f.fileName,
    fileSize: f.fileSize,
    fileType: fileExtension(f.fileName) ?? fileExtension(f.fileUrl),
    fileUrl: await signFileUrl(f.fileUrl, undefined, f.fileName),
    createdAt: f.createdAt,
    uploadedBy: f.uploadedBy ?? null,
  };
}

/** GET /teacher/resources/subjects — the teacher's subjects with folder/file counts */
export async function listResourceSubjects(req: Request, res: Response): Promise<void> {
  const teacher = await getTeacherProfileForUser(req.user!.userId);
  const subjectIds = await getTeacherSubjectIds(teacher.id);
  const subjects = await prisma.subject.findMany({
    where: { id: { in: subjectIds } },
    select: {
      id: true,
      name: true,
      code: true,
      semester: true,
      branch: { select: { id: true, shortCode: true, name: true } },
      resourceFolders: { select: { _count: { select: { files: true } } } },
    },
    orderBy: [{ semester: "asc" }, { name: "asc" }],
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

/** GET /teacher/subjects/:subjectId/resource-folders */
export async function listFolders(req: Request, res: Response): Promise<void> {
  const teacher = await getTeacherProfileForUser(req.user!.userId);
  const subjectId = param(req.params["subjectId"]);
  await assertTeachesSubject(teacher.id, subjectId);
  const [subject, folders] = await Promise.all([
    prisma.subject.findUnique({
      where: { id: subjectId },
      select: { id: true, name: true, code: true, semester: true, branch: { select: { id: true, shortCode: true } } },
    }),
    prisma.resourceFolder.findMany({
      where: { subjectId },
      include: { _count: { select: { files: true } }, createdBy: { select: { id: true, name: true } } },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    }),
  ]);
  if (!subject) throw notFound("Subject not found");
  ok(res, {
    subject,
    folders: folders.map(({ _count, ...f }) => ({ ...f, fileCount: _count.files })),
  });
}

/** POST /teacher/subjects/:subjectId/resource-folders */
export async function createFolder(req: Request, res: Response): Promise<void> {
  const teacher = await getTeacherProfileForUser(req.user!.userId);
  const subjectId = param(req.params["subjectId"]);
  await assertTeachesSubject(teacher.id, subjectId);
  const body = req.body as { name: string; order?: number };
  try {
    const folder = await prisma.resourceFolder.create({
      data: { subjectId, name: body.name, order: body.order ?? 0, createdById: teacher.id },
    });
    created(res, { ...folder, fileCount: 0 }, { message: "Folder created" });
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("A folder with this name already exists for this subject.", "FOLDER_EXISTS");
    throw e;
  }
}

/** GET /teacher/resource-folders/:id */
export async function getFolder(req: Request, res: Response): Promise<void> {
  const { folder } = await loadFolderForTeacher(req.user!.userId, param(req.params["id"]));
  const [subject, files] = await Promise.all([
    prisma.subject.findUnique({
      where: { id: folder.subjectId },
      select: { id: true, name: true, code: true, semester: true, branch: { select: { id: true, shortCode: true } } },
    }),
    prisma.resourceFile.findMany({
      where: { folderId: folder.id },
      include: { uploadedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  ok(res, { ...folder, subject, files: await Promise.all(files.map(serializeFile)) });
}

/** PATCH /teacher/resource-folders/:id */
export async function updateFolder(req: Request, res: Response): Promise<void> {
  const { folder } = await loadFolderForTeacher(req.user!.userId, param(req.params["id"]));
  const body = req.body as { name?: string; order?: number };
  try {
    const updated = await prisma.resourceFolder.update({
      where: { id: folder.id },
      data: { ...(body.name !== undefined ? { name: body.name } : {}), ...(body.order !== undefined ? { order: body.order } : {}) },
    });
    ok(res, updated, { message: "Folder updated" });
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("A folder with this name already exists for this subject.", "FOLDER_EXISTS");
    throw e;
  }
}

/** DELETE /teacher/resource-folders/:id — removes the folder, its files and their S3 objects */
export async function deleteFolder(req: Request, res: Response): Promise<void> {
  const { folder } = await loadFolderForTeacher(req.user!.userId, param(req.params["id"]));
  const files = await prisma.resourceFile.findMany({ where: { folderId: folder.id }, select: { fileUrl: true } });
  await deleteS3Objects(files.map((file) => file.fileUrl));
  await prisma.resourceFolder.delete({ where: { id: folder.id } });
  ok(res, undefined, { message: "Folder deleted" });
}

/** POST /teacher/resource-folders/:id/upload-url — presigned PUT into this folder's S3 prefix */
export async function requestFileUpload(req: Request, res: Response): Promise<void> {
  const { folder } = await loadFolderForTeacher(req.user!.userId, param(req.params["id"]));
  const { fileName, fileType, fileSize } = req.body as { fileName: string; fileType: string; fileSize: number };
  ok(res, await generatePresignedUploadUrl("resource", folder.subjectId, fileType, fileSize, folder.id, fileName));
}

/** POST /teacher/resource-folders/:id/files — body { title, fileUrl, fileName? } after the upload succeeded */
export async function addFile(req: Request, res: Response): Promise<void> {
  const { teacher, folder } = await loadFolderForTeacher(req.user!.userId, param(req.params["id"]));
  const body = req.body as { title: string; fileUrl: string; fileName?: string | null };
  const { url, size } = await verifyOwnedUpload(body.fileUrl, "resource", folder.subjectId, folder.id);
  const file = await prisma.resourceFile.create({
    data: {
      folderId: folder.id,
      title: body.title,
      fileUrl: url,
      fileName: body.fileName ?? null,
      fileSize: size || null,
      uploadedById: teacher.id,
    },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });
  created(res, await serializeFile(file), { message: "File uploaded" });
}

/** DELETE /teacher/resource-files/:id */
export async function deleteFile(req: Request, res: Response): Promise<void> {
  const teacher = await getTeacherProfileForUser(req.user!.userId);
  const file = await prisma.resourceFile.findUnique({
    where: { id: param(req.params["id"]) },
    include: { folder: { select: { subjectId: true } } },
  });
  if (!file || !(await teachesSubject(teacher.id, file.folder.subjectId))) throw notFound("File not found");
  await deleteS3Object(file.fileUrl);
  await prisma.resourceFile.delete({ where: { id: file.id } });
  ok(res, undefined, { message: "File deleted" });
}
