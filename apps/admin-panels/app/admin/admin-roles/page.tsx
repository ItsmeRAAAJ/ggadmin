"use client";
import { useState } from "react";
import { patch, post } from "@/lib/api";
import { useApi } from "@/lib/hooks";
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

type Role = {
  id: string;
  key: string;
  label: string;
  _count?: { assignments: number };
};
export default function RolesPage() {
  const { data, error, loading, reload } = useApi<Role[]>("/admin/admin-roles");
  const [open, setOpen] = useState<Role | null | "new">(null);
  const [toast, setToast] = useState<string | null>(null);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  return (
    <>
      <PageHeader
        title="Admin roles"
        description="Role types shown in the login category dropdown."
        actions={<Button onClick={() => setOpen("new")}>Add role</Button>}
      />
      <Table>
        <thead>
          <tr>
            <Th>Key</Th>
            <Th>Label</Th>
            <Th>Assigned admins</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonRows cols={4} />
          ) : data?.length ? (
            data.map((r) => (
              <tr key={r.id}>
                <Td className="font-mono text-xs font-bold">{r.key}</Td>
                <Td>{r.label}</Td>
                <Td>{r._count?.assignments ?? 0}</Td>
                <Td>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setOpen(r)}
                  >
                    Edit
                  </Button>
                </Td>
              </tr>
            ))
          ) : (
            <tr>
              <Td colSpan={4}>
                <EmptyState title="No roles" />
              </Td>
            </tr>
          )}
        </tbody>
      </Table>
      <RoleModal
        key={open === "new" ? "new" : (open?.id ?? "closed")}
        open={!!open}
        role={open === "new" ? null : open}
        onClose={() => setOpen(null)}
        onDone={() => {
          setOpen(null);
          void reload();
          setToast("Role saved");
        }}
      />
      <ToastHost message={toast} onClose={() => setToast(null)} />
    </>
  );
}
function RoleModal({
  open,
  onClose,
  onDone,
  role,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  role: Role | null;
}) {
  const [key, setKey] = useState(role?.key || "");
  const [label, setLabel] = useState(role?.label || "");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  async function save() {
    setLoading(true);
    setErr("");
    try {
      if (role) await patch(`/admin/admin-roles/${role.id}`, { label });
      else await post("/admin/admin-roles", { key, label });
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
      title={role ? "Edit role" : "Add role"}
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
          label="Key"
          disabled={!!role}
          value={key}
          onChange={(e) => setKey(e.target.value.toUpperCase())}
        />
        <Input
          label="Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        {err && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>
        )}
      </div>
    </Modal>
  );
}
