"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { FolderOpen } from "lucide-react";
import { del, patch, post } from "@/lib/api";
import { useApi } from "@/lib/hooks";
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

type Folder = {
  id: string;
  name: string;
  order: number;
  fileCount: number;
  createdBy?: { id: string; name: string } | null;
};
type FolderPayload = {
  subject: {
    id: string;
    name: string;
    code: string;
    semester: number;
    branch: { shortCode: string };
  };
  folders: Folder[];
};

export default function SubjectFoldersPage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const { data, error, loading, reload } = useApi<FolderPayload>(
    subjectId ? `/teacher/subjects/${subjectId}/resource-folders` : null,
  );
  const [modal, setModal] = useState<Folder | null | "new">(null);
  const [remove, setRemove] = useState<Folder | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  if (error) return <ErrorState error={error} onRetry={reload} />;

  async function deleteFolder() {
    if (!remove) return;
    setDeleteLoading(true);
    try {
      await del(`/teacher/resource-folders/${remove.id}`);
      setToast("Folder deleted");
      setRemove(null);
      void reload();
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title={data ? `${data.subject.code} resources` : "Resources"}
        description={
          data
            ? `${data.subject.name} · ${data.subject.branch.shortCode} · Semester ${data.subject.semester}`
            : "Loading folders..."
        }
        actions={
          <>
            <Link href="/teacher/resources">
              <Button variant="outline">Back</Button>
            </Link>
            <Button onClick={() => setModal("new")}>New folder</Button>
          </>
        }
      />
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Folder</Th>
              <Th>Order</Th>
              <Th>Files</Th>
              <Th>Created by</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows cols={5} />
            ) : data?.folders.length ? (
              data.folders.map((f) => (
                <tr key={f.id}>
                  <Td className="font-bold">
                    <Link className="text-brand-primary" href={`/teacher/resources/folders/${f.id}`}>
                      {f.name}
                    </Link>
                  </Td>
                  <Td>{f.order}</Td>
                  <Td>
                    <Badge>{f.fileCount} files</Badge>
                  </Td>
                  <Td>{f.createdBy?.name || "—"}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/teacher/resources/folders/${f.id}`}>
                        <Button size="sm" variant="outline">
                          Open
                        </Button>
                      </Link>
                      <Button size="sm" variant="outline" onClick={() => setModal(f)}>
                        Rename
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setRemove(f)}>
                        Delete
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))
            ) : (
              <tr>
                <Td colSpan={5}>
                  <EmptyState
                    title="No folders"
                    description="Create folders such as Unit 1, Lab Manuals or Previous Year Papers."
                    action={<FolderOpen className="mx-auto h-8 w-8 text-slate-400" />}
                  />
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
      <FolderModal
        key={modal === "new" ? "new" : (modal?.id ?? "closed")}
        open={!!modal}
        folder={modal === "new" ? null : modal}
        subjectId={subjectId}
        onClose={() => setModal(null)}
        onDone={() => {
          setModal(null);
          setToast("Folder saved");
          void reload();
        }}
      />
      <ConfirmDialog
        open={!!remove}
        danger
        title="Delete folder"
        message={`Delete "${remove?.name || "this folder"}"? All files inside it will be deleted too.`}
        confirmText="Delete folder"
        loading={deleteLoading}
        onClose={() => setRemove(null)}
        onConfirm={deleteFolder}
      />
      <ToastHost message={toast} onClose={() => setToast(null)} />
    </>
  );
}

function FolderModal({
  open,
  onClose,
  onDone,
  folder,
  subjectId,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  folder: Folder | null;
  subjectId: string;
}) {
  const [name, setName] = useState(folder?.name || "");
  const [order, setOrder] = useState(String(folder?.order ?? 0));
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function save() {
    setErr("");
    if (!name.trim()) return setErr("Folder name is required.");
    const numericOrder = Number(order || 0);
    if (!Number.isInteger(numericOrder)) return setErr("Order must be a whole number.");
    setLoading(true);
    try {
      if (folder) {
        await patch(`/teacher/resource-folders/${folder.id}`, {
          name: name.trim(),
          order: numericOrder,
        });
      } else {
        await post(`/teacher/subjects/${subjectId}/resource-folders`, {
          name: name.trim(),
          order: numericOrder,
        });
      }
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      title={folder ? "Edit folder" : "New folder"}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={loading} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Folder name"
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          hint="Slashes are not allowed."
        />
        <Input
          label="Order"
          type="number"
          value={order}
          onChange={(e) => setOrder(e.target.value)}
        />
      </div>
      {err && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
    </Modal>
  );
}
