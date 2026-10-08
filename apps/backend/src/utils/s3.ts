import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  GetBucketVersioningCommand,
  HeadObjectCommand,
  ListObjectVersionsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { env } from "../config/env.js";
import {
  S3_PRESIGNED_URL_EXPIRY_SECONDS,
  S3_SIGNED_GET_EXPIRY_SECONDS,
  S3_MAX_FILE_SIZE_BYTES,
  S3_ALLOWED_IMAGE_TYPES,
  S3_ALLOWED_DOCUMENT_TYPES,
  S3_ALLOWED_STUDY_MATERIAL_TYPES,
  S3_STUDY_MATERIAL_MAX_FILE_SIZE_BYTES,
} from "../config/validation.js";
import { HttpError, badRequest } from "./http.js";

const s3 = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

export type S3UploadContext =
  | "profile-photo"
  | "resume-tech"
  | "resume-non-tech"
  | "certificate"
  | "achievement"
  | "assignment"
  | "resource" // teacher-managed subject material; owner = subjectId, subId = folderId
  | "peer-resource"; // Share with Peers; owner = studentProfileId

const ALLOWED_TYPES: Record<S3UploadContext, string[]> = {
  "profile-photo": S3_ALLOWED_IMAGE_TYPES,
  "resume-tech": S3_ALLOWED_DOCUMENT_TYPES,
  "resume-non-tech": S3_ALLOWED_DOCUMENT_TYPES,
  certificate: [...S3_ALLOWED_DOCUMENT_TYPES, ...S3_ALLOWED_IMAGE_TYPES],
  achievement: [...S3_ALLOWED_DOCUMENT_TYPES, ...S3_ALLOWED_IMAGE_TYPES],
  assignment: [...S3_ALLOWED_DOCUMENT_TYPES, ...S3_ALLOWED_IMAGE_TYPES],
  resource: S3_ALLOWED_STUDY_MATERIAL_TYPES,
  "peer-resource": S3_ALLOWED_STUDY_MATERIAL_TYPES,
};

const MAX_SIZE: Partial<Record<S3UploadContext, number>> = {
  resource: S3_STUDY_MATERIAL_MAX_FILE_SIZE_BYTES,
  "peer-resource": S3_STUDY_MATERIAL_MAX_FILE_SIZE_BYTES,
};
const maxSizeFor = (context: S3UploadContext) => MAX_SIZE[context] ?? S3_MAX_FILE_SIZE_BYTES;

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "image/heic": "heic",
  "image/heif": "heic",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

function ensureConfigured(): void {
  if (!env.AWS_S3_BUCKET || !env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
    throw new HttpError(503, "File storage is temporarily unavailable. Please try again later.", "STORAGE_NOT_CONFIGURED");
  }
}

const bucketHost = () => `${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com`;

const STUDENT_FOLDERS: Partial<Record<S3UploadContext, string>> = {
  "profile-photo": "photo",
  "resume-tech": "resume-tech",
  "resume-non-tech": "resume-non-tech",
  certificate: "certificates",
  achievement: "achievements",
  assignment: "assignments",
  "peer-resource": "peer-resources",
};

/** Folder prefix an owner's files of this kind must live under. */
export function uploadPrefix(context: S3UploadContext, ownerId: string, subId?: string): string {
  const sub = subId ? `${subId}/` : "";
  if (context === "resource") return `subjects/${ownerId}/resources/${sub}`;
  return `students/${ownerId}/${STUDENT_FOLDERS[context]}/${sub}`;
}

/** Canonical private-object locator stored in the database; reads use signed GET URLs. */
export function canonicalUrlForKey(key: string): string {
  return `https://${bucketHost()}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/** Extract the object key from one of our bucket URLs, or null if the URL isn't ours. */
export function keyFromUrl(fileUrl: string): string | null {
  try {
    const url = new URL(fileUrl);
    if (url.protocol !== "https:") return null;
    let path = url.pathname.slice(1);
    const host = url.host.toLowerCase();
    const bucket = env.AWS_S3_BUCKET.toLowerCase();
    const globalHost = `${bucket}.s3.amazonaws.com`;
    const dualstackHost = `${bucket}.s3.dualstack.${env.AWS_REGION}.amazonaws.com`;
    const regionalHostSuffix = host.startsWith(`${bucket}.s3.`) ? host.slice(`${bucket}.s3.`.length) : "";
    const virtualHosted =
      host === globalHost ||
      host === dualstackHost ||
      host === `${bucket}.s3-accelerate.amazonaws.com` ||
      /^(?:dualstack\.)?[a-z0-9-]+\.amazonaws\.com$/.test(regionalHostSuffix);
    const pathStyle = host === "s3.amazonaws.com" || /^s3(?:\.dualstack)?\.[a-z0-9-]+\.amazonaws\.com$/.test(host);
    if (virtualHosted) {
      // Virtual-hosted bucket URL.
    } else if (pathStyle && path.toLowerCase().startsWith(`${bucket}/`)) {
      path = path.slice(env.AWS_S3_BUCKET.length + 1);
    } else {
      return null;
    }
    const key = decodeURIComponent(path);
    if (!key || key.split("/").some((part) => part === "." || part === "..")) return null;
    return key;
  } catch {
    return null;
  }
}

export type PresignResult = { uploadUrl: string; fileUrl: string; key: string; expiresIn: number };

/** Short-lived presigned PUT URL. Validates content type and size before signing. */
export async function generatePresignedUploadUrl(
  context: S3UploadContext,
  ownerId: string,
  fileType: string,
  fileSize: number,
  subId?: string,
  fileName?: string
): Promise<PresignResult> {
  const allowed = ALLOWED_TYPES[context];
  if (!allowed.includes(fileType)) {
    const readable = allowed.map((t) => EXT[t]?.toUpperCase() ?? t).join(", ");
    throw badRequest(`Unsupported file type. Allowed: ${readable}`, "INVALID_FILE_TYPE");
  }
  const maxSize = maxSizeFor(context);
  if (fileSize > maxSize) {
    throw badRequest(`File is too large. Maximum size is ${maxSize / 1024 / 1024} MB`, "FILE_TOO_LARGE");
  }
  ensureConfigured();

  const safeName = safeFilename(fileName);
  const key = `${uploadPrefix(context, ownerId, subId)}${randomUUID()}-${safeName}.${EXT[fileType] ?? "bin"}`;
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: key, ContentType: fileType, ContentLength: fileSize }),
    { expiresIn: S3_PRESIGNED_URL_EXPIRY_SECONDS }
  );

  return { uploadUrl, fileUrl: canonicalUrlForKey(key), key, expiresIn: S3_PRESIGNED_URL_EXPIRY_SECONDS };
}

/**
 * Validate that a client-supplied fileUrl points into the owner's own folder for this context,
 * and that the object was actually uploaded. Returns the canonical URL to store and its size.
 */
export async function verifyOwnedUpload(
  fileUrl: string,
  context: S3UploadContext,
  ownerId: string,
  subId?: string
): Promise<{ url: string; size: number }> {
  const key = keyFromUrl(fileUrl);
  const prefix = uploadPrefix(context, ownerId, subId);
  if (!key || !key.startsWith(prefix)) {
    throw badRequest("Invalid file reference. Please upload the file again.", "INVALID_FILE_URL");
  }
  ensureConfigured();
  let size: number;
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: key }));
    size = head.ContentLength ?? 0;
  } catch (error) {
    const awsError = error as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
    if (
      awsError.$metadata?.httpStatusCode === 404 ||
      awsError.name === "NotFound" ||
      awsError.name === "NoSuchKey" ||
      awsError.Code === "NoSuchKey"
    ) {
      throw badRequest("We couldn't find the uploaded file. Please upload it again.", "UPLOAD_NOT_FOUND");
    }
    console.error("[S3] Failed to verify an uploaded object.", error);
    throw new HttpError(502, "Could not verify the uploaded file with S3. Please try again.", "STORAGE_VERIFY_FAILED");
  }
  if (size > maxSizeFor(context)) {
    await deleteS3Object(key);
    throw badRequest("File is too large.", "FILE_TOO_LARGE");
  }
  return { url: canonicalUrlForKey(key), size };
}

/** Same as verifyOwnedUpload, returning only the canonical URL. */
export async function assertOwnedUploadedFile(
  fileUrl: string,
  context: S3UploadContext,
  ownerId: string,
  subId?: string
): Promise<string> {
  return (await verifyOwnedUpload(fileUrl, context, ownerId, subId)).url;
}

/**
 * Turn a stored bucket URL into a time-limited signed GET URL (works with a private bucket).
 * Non-bucket URLs and nulls pass through untouched.
 */
export async function signFileUrl(
  fileUrl: string | null | undefined,
  expiresIn: number = S3_SIGNED_GET_EXPIRY_SECONDS,
  downloadName?: string | null
): Promise<string | null> {
  if (!fileUrl) return null;
  const key = keyFromUrl(fileUrl);
  if (!key) return fileUrl;
  ensureConfigured();
  const disposition = downloadName ? contentDisposition(downloadName) : undefined;
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: key, ResponseContentDisposition: disposition }),
    { expiresIn }
  );
}

/** inline + RFC 5987 filename so opened/downloaded files keep their original, human-readable name. */
function contentDisposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}

/** File extension of a stored bucket URL (e.g. "pdf"), used for file-type icons. */
export function fileExtension(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;
  const m = /\.([a-z0-9]{1,8})(?:$|\?)/i.exec(fileUrl);
  return m ? m[1]!.toLowerCase() : null;
}

/** Delete the exact S3 object represented by its URL or key. */
export async function deleteS3Object(urlOrKey: string): Promise<void> {
  const isUrl = /^https?:\/\//i.test(urlOrKey);
  const key = isUrl ? keyFromUrl(urlOrKey) : urlOrKey;
  if (isUrl && !key) {
    throw new HttpError(
      409,
      "The stored file URL is not in the configured S3 bucket, so it was not deleted.",
      "S3_KEY_MISMATCH"
    );
  }
  if (!key || key.startsWith("/") || key.split("/").some((part) => part === "." || part === "..")) {
    throw new HttpError(400, "Invalid stored-file reference. The file was not deleted.", "INVALID_FILE_URL");
  }
  ensureConfigured();

  try {
    const versioning = await s3.send(new GetBucketVersioningCommand({ Bucket: env.AWS_S3_BUCKET }));
    if (versioning.Status === "Enabled" || versioning.Status === "Suspended") {
      await deleteAllObjectVersions(key);
      return;
    }
    await s3.send(new DeleteObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: key }));
  } catch (error) {
    console.error("[S3] Failed to permanently delete an object.", error);
    throw new HttpError(
      502,
      "Could not permanently delete the stored file from S3. The associated record was not removed.",
      "S3_DELETE_FAILED"
    );
  }
}

/** Delete every exact object before its owning database records are removed. */
export async function deleteS3Objects(urlsOrKeys: Array<string | null | undefined>): Promise<void> {
  const objects = urlsOrKeys.filter((value): value is string => !!value);
  const results = await Promise.allSettled(objects.map(deleteS3Object));
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length) {
    throw new HttpError(
      502,
      `Could not permanently delete ${failures.length} of ${objects.length} stored file(s) from S3. Database records were not removed.`,
      "S3_DELETE_FAILED"
    );
  }
}

async function deleteAllObjectVersions(key: string): Promise<void> {
  let keyMarker: string | undefined;
  let versionIdMarker: string | undefined;
  do {
    const page = await s3.send(
      new ListObjectVersionsCommand({
        Bucket: env.AWS_S3_BUCKET,
        Prefix: key,
        ...(keyMarker ? { KeyMarker: keyMarker } : {}),
        ...(versionIdMarker ? { VersionIdMarker: versionIdMarker } : {}),
        MaxKeys: 1000,
      })
    );
    const versions = [
      ...(page.Versions ?? []).filter((version) => version.Key === key && version.VersionId),
      ...(page.DeleteMarkers ?? []).filter((marker) => marker.Key === key && marker.VersionId),
    ].map((version) => ({ Key: key, VersionId: version.VersionId! }));

    if (versions.length) {
      const deleted = await s3.send(
        new DeleteObjectsCommand({ Bucket: env.AWS_S3_BUCKET, Delete: { Objects: versions, Quiet: true } })
      );
      if (deleted.Errors?.length) {
        throw new Error(`S3 refused to delete ${deleted.Errors.length} version(s) of an object.`);
      }
    }

    keyMarker = page.IsTruncated ? page.NextKeyMarker : undefined;
    versionIdMarker = page.IsTruncated ? page.NextVersionIdMarker : undefined;
  } while (keyMarker || versionIdMarker);
}

function safeFilename(fileName: string | undefined): string {
  const basename = fileName?.replace(/\\/g, "/").split("/").pop() ?? "";
  const stem = basename.replace(/\.[^.]*$/, "");
  const safe = stem
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 80);
  return safe || "file";
}
