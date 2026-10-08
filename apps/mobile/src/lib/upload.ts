import { ApiError, type UploadRequest } from "./api";
import { MAX_UPLOAD_BYTES } from "./config";
import type { LocalFile, PresignedUpload } from "./types";

export type UploadProgress = (fraction: number) => void;

async function readBlob(uri: string): Promise<Blob> {
  try {
    const res = await fetch(uri);
    return await res.blob();
  } catch {
    throw new ApiError(0, "FILE_READ", "Couldn't read the selected file. Please pick it again.");
  }
}

function putToS3(url: string, blob: Blob, contentType: string, onProgress?: UploadProgress): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.timeout = 300_000; // study material can be up to 25 MB on slow campus Wi-Fi
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) onProgress(Math.min(1, e.loaded / e.total));
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
      } else {
        reject(new ApiError(xhr.status, "UPLOAD_FAILED", "Upload failed. Please try again."));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, "NETWORK_ERROR", "Upload failed — check your connection and try again."));
    xhr.ontimeout = () => reject(new ApiError(0, "TIMEOUT", "Upload timed out. Please try again on a stronger connection."));
    xhr.send(blob);
  });
}

/**
 * Presign → PUT to S3 → return the canonical fileUrl to confirm with the API.
 * The exact byte size is signed into the URL, so it is taken from the blob that is actually sent.
 */
export async function uploadFile(
  file: LocalFile,
  presign: (req: UploadRequest) => Promise<PresignedUpload>,
  onProgress?: UploadProgress,
  maxBytes: number = MAX_UPLOAD_BYTES
): Promise<string> {
  const blob = await readBlob(file.uri);
  const size = blob.size || file.size || 0;
  if (size <= 0) throw new ApiError(0, "FILE_EMPTY", "The selected file is empty.");
  if (size > maxBytes) {
    throw new ApiError(0, "FILE_TOO_LARGE", `File is larger than ${Math.round(maxBytes / 1024 / 1024)} MB. Please choose a smaller file.`);
  }

  onProgress?.(0);
  const { uploadUrl, fileUrl } = await presign({ fileName: file.name, fileType: file.mimeType, fileSize: size });
  await putToS3(uploadUrl, blob, file.mimeType, onProgress);
  return fileUrl;
}
