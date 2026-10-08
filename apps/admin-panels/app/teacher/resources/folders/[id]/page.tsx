"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Download, FileText, ImageIcon, Trash2, Upload } from "lucide-react";
import { del, post } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { fmtDate } from "@/lib/format";
import {
  fileExtension,
  formatBytes,
  isAllowedResourceFile,
  RESOURCE_ACCEPT,
  RESOURCE_MAX_BYTES,
} from "@/lib/academics";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  SkeletonRows,
  Table,
  Td,
  Th,
  ToastHost,
} from "@/components/ui";

type ResourceFile = {
  id: string;
  title: string;
  fileName?: string | null;
  fileSize?: number | null;
  fileType?: string | null;
  fileUrl: string;
  createdAt: string;
  uploadedBy?: { id: string; name: string } | null;
};
type FolderDetail = {
  id: string;
  name: string;
  subject: {
    id: string;
    name: string;
    code: string;
    semester: number;
    branch: { shortCode: string };
  };
  files: ResourceFile[];
};
type UploadUrl = { uploadUrl: string; fileUrl: string; key: string };

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  heic: "image/heic",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export default function FolderFilesPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading, reload } = useApi<FolderDetail>(
    id ? `/teacher/resource-folders/${id}` : null,
  );
  const [uploadOpen, setUploadOpen] = useState(false);
  const [remove, setRemove] = useState<ResourceFile | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  if (error) return <ErrorState error={error} onRetry={reload} />;

  async function deleteFile() {
    if (!remove) return;
    setDeleteLoading(true);
    try {
      await del(`/teacher/resource-files/${remove.id}`);
      setToast("File deleted");
      setRemove(null);
      void reload();
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title={data ? data.name : "Resource folder"}
        description={
          data
            ? `${data.subject.code} · ${data.subject.name} · ${data.subject.branch.shortCode}`
            : "Loading files..."
        }
        actions={
          <>
            {data && (
              <Link href={`/teacher/resources/${data.subject.id}`}>
                <Button variant="outline">Back</Button>
              </Link>
            )}
            <Button onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4" /> Upload file
            </Button>
          </>
        }
      />
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>File</Th>
              <Th>Type</Th>
              <Th>Size</Th>
              <Th>Uploaded by</Th>
              <Th>Uploaded</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows cols={6} />
            ) : data?.files.length ? (
              data.files.map((f) => (
                <tr key={f.id}>
                  <Td className="font-bold">
                    <div className="flex items-center gap-3">
                      <FileIcon type={f.fileType || f.fileName} />
                      <span>
                        {f.title}
                        <span className="block text-xs font-normal text-slate-500">
                          {f.fileName || "Resource file"}
                        </span>
                      </span>
                    </div>
                  </Td>
                  <Td>
                    <Badge>{(f.fileType || fileExtension(f.fileName)).toUpperCase()}</Badge>
                  </Td>
                  <Td>{formatBytes(f.fileSize)}</Td>
                  <Td>{f.uploadedBy?.name || "—"}</Td>
                  <Td>{fmtDate(f.createdAt)}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-2">
                      <a href={f.fileUrl} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4" /> Open
                        </Button>
                      </a>
                      <Button size="sm" variant="danger" onClick={() => setRemove(f)}>
                        <Trash2 className="h-4 w-4" /> Delete
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))
            ) : (
              <tr>
                <Td colSpan={6}>
                  <EmptyState
                    title="No files"
                    description="Upload PDFs, images or Office documents up to 25 MB."
                  />
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
      <UploadModal
        key={uploadOpen ? "open" : "closed"}
        open={uploadOpen}
        folderId={id}
        onClose={() => setUploadOpen(false)}
        onDone={() => {
          setUploadOpen(false);
          setToast("File uploaded");
          void reload();
        }}
      />
      <ConfirmDialog
        open={!!remove}
        danger
        title="Delete file"
        message={`Delete "${remove?.title || "this file"}"? This also removes the stored object.`}
        confirmText="Delete file"
        loading={deleteLoading}
        onClose={() => setRemove(null)}
        onConfirm={deleteFile}
      />
      <ToastHost message={toast} onClose={() => setToast(null)} />
    </>
  );
}

function FileIcon({ type }: { type?: string | null }) {
  const ext = fileExtension(type).toLowerCase();
  const cls = "h-5 w-5 text-brand-primary";
  if (["png", "jpg", "jpeg", "heic"].includes(ext)) return <ImageIcon className={cls} />;
  return <FileText className={cls} />;
}

function UploadModal({
  open,
  onClose,
  onDone,
  folderId,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  folderId: string;
}) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  function choose(next: File | undefined) {
    setErr("");
    setProgress(null);
    if (!next) return setFile(null);
    if (!isAllowedResourceFile(next)) {
      setFile(null);
      return setErr("Allowed file types: pdf, png, jpg/jpeg, heic, pptx, docx and xlsx.");
    }
    if (next.size > RESOURCE_MAX_BYTES) {
      setFile(null);
      return setErr("File must be 25 MB or smaller.");
    }
    setFile(next);
    if (!title.trim()) setTitle(next.name.replace(/\.[^.]+$/, ""));
  }

  async function upload() {
    setErr("");
    if (!file) return setErr("Choose a file.");
    if (!title.trim()) return setErr("Title is required.");
    const ext = fileExtension(file.name);
    const fileType = file.type || MIME_BY_EXT[ext] || "application/octet-stream";
    setLoading(true);
    try {
      const signed = await post<UploadUrl>(`/teacher/resource-folders/${folderId}/upload-url`, {
        fileName: file.name,
        fileType,
        fileSize: file.size,
      });
      await putFile(signed.uploadUrl, file, fileType, setProgress);
      await post(`/teacher/resource-folders/${folderId}/files`, {
        title: title.trim(),
        fileUrl: signed.fileUrl,
        fileName: file.name,
      });
      onDone();
    } catch (e) {
      setErr((e as Error).message || "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Upload resource file"
      onClose={loading ? () => {} : onClose}
      footer={
        <>
          <Button variant="ghost" disabled={loading} onClick={onClose}>
            Cancel
          </Button>
          <Button loading={loading} onClick={upload}>
            Upload
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
        />
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center hover:border-brand-primary hover:bg-blue-50">
          <Upload className="mb-3 h-8 w-8 text-brand-primary" />
          <span className="font-semibold text-slate-900">Choose file</span>
          <span className="mt-1 text-sm text-slate-500">
            PDF, PNG, JPG, HEIC, PPTX, DOCX or XLSX · max 25 MB
          </span>
          <input
            className="hidden"
            type="file"
            accept={RESOURCE_ACCEPT}
            disabled={loading}
            onChange={(e) => choose(e.target.files?.[0])}
          />
        </label>
        {file && (
          <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            {file.name} · {formatBytes(file.size)}
          </p>
        )}
        {progress !== null && (
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-brand-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-1 text-xs text-slate-500">Uploading {progress}%</p>
          </div>
        )}
        {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      </div>
    </Modal>
  );
}

function putFile(
  uploadUrl: string,
  file: File,
  fileType: string,
  onProgress: (progress: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", fileType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });
}
