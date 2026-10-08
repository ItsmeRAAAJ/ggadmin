"use client";
import { useState } from "react";
import { patch, post } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";
import {
  Button,
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

type Branch = {
  id: string;
  shortCode: string;
  name: string;
  _count?: { subjects: number; studentProfiles: number };
};
export default function BranchesPage() {
  const { hasPermission } = useAuth();
  const { data, error, loading, reload } = useApi<Branch[]>("/admin/branches");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Branch | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  return (
    <>
      <PageHeader
        title="Branches"
        description="Department branches used by students and subjects."
        actions={
          hasPermission("MANAGE_ACADEMIC_STRUCTURE") && (
            <Button onClick={() => setOpen(true)}>Add branch</Button>
          )
        }
      />
      <Table>
        <thead>
          <tr>
            <Th>Code</Th>
            <Th>Name</Th>
            <Th>Subjects</Th>
            <Th>Students</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonRows cols={5} />
          ) : data?.length ? (
            data.map((b) => (
              <tr key={b.id}>
                <Td className="font-bold">{b.shortCode}</Td>
                <Td>{b.name}</Td>
                <Td>{b._count?.subjects ?? 0}</Td>
                <Td>{b._count?.studentProfiles ?? 0}</Td>
                <Td>
                  {hasPermission("MANAGE_ACADEMIC_STRUCTURE") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEdit(b)}
                    >
                      Edit
                    </Button>
                  )}
                </Td>
              </tr>
            ))
          ) : (
            <tr>
              <Td colSpan={5}>
                <EmptyState title="No branches" />
              </Td>
            </tr>
          )}
        </tbody>
      </Table>
      <BranchModal
        key={edit?.id ?? (open ? "new" : "closed")}
        open={open || !!edit}
        branch={edit}
        onClose={() => {
          setOpen(false);
          setEdit(null);
        }}
        onDone={() => {
          setOpen(false);
          setEdit(null);
          void reload();
          setToast("Branch saved");
        }}
      />
      <ToastHost message={toast} onClose={() => setToast(null)} />
    </>
  );
}
function BranchModal({
  open,
  onClose,
  onDone,
  branch,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  branch: Branch | null;
}) {
  const [shortCode, setShortCode] = useState(branch?.shortCode || "");
  const [name, setName] = useState(branch?.name || "");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  async function save() {
    setLoading(true);
    setErr("");
    try {
      if (branch) await patch(`/admin/branches/${branch.id}`, { name });
      else await post("/admin/branches", { shortCode, name });
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
      title={branch ? "Edit branch" : "Add branch"}
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
      <div className="space-y-4">
        <Input
          label="Short code"
          value={shortCode}
          disabled={!!branch}
          onChange={(e) => setShortCode(e.target.value.toUpperCase())}
        />
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {err && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>
        )}
      </div>
    </Modal>
  );
}
