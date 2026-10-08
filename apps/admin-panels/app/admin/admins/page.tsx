"use client";
import Link from "next/link";
import { useState } from "react";
import { post } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  Select,
  SkeletonRows,
  StatusBadge,
  Table,
  Td,
  Th,
  ToastHost,
} from "@/components/ui";

type Role = { key: string; label: string };
type Admin = {
  id: string;
  name: string;
  user: { email: string; status: string };
  parentAdmin?: { name: string } | null;
  roleAssignments: { adminRole: Role }[];
  isSelf: boolean;
  isSuperAdmin: boolean;
  _count?: { managedAdmins: number; permissionGrantsReceived: number };
};
export default function AdminsPage() {
  const { hasPermission } = useAuth();
  const { data, error, loading, reload } = useApi<Admin[]>("/admin/admins");
  const { data: roles } = useApi<Role[]>("/admin/admin-roles");
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  return (
    <>
      <PageHeader
        title="Admins"
        description="Hierarchy-scoped administrator accounts and role types."
        actions={
          hasPermission("MANAGE_ADMIN_HIERARCHY") && (
            <Button onClick={() => setOpen(true)}>Add admin</Button>
          )
        }
      />
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Email</Th>
            <Th>Roles</Th>
            <Th>Reports to</Th>
            <Th>Status</Th>
            <Th>Managed</Th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonRows cols={6} />
          ) : data?.length ? (
            data.map((a) => (
              <tr key={a.id}>
                <Td>
                  <Link
                    className="font-bold text-brand-primary"
                    href={`/admin/admins/${a.id}`}
                  >
                    {a.name}
                  </Link>
                  {a.isSelf && (
                    <span className="ml-2 text-xs text-slate-500">You</span>
                  )}
                </Td>
                <Td>{a.user.email}</Td>
                <Td>
                  {a.roleAssignments.map((r) => r.adminRole.label).join(", ")}
                </Td>
                <Td>{a.parentAdmin?.name || "Root"}</Td>
                <Td>
                  <StatusBadge status={a.user.status} />
                </Td>
                <Td>{a._count?.managedAdmins ?? 0}</Td>
              </tr>
            ))
          ) : (
            <tr>
              <Td colSpan={6}>
                <EmptyState title="No admins" />
              </Td>
            </tr>
          )}
        </tbody>
      </Table>
      <AdminModal
        key={open ? "open" : "closed"}
        open={open}
        roles={roles || []}
        onClose={() => setOpen(false)}
        onDone={() => {
          setOpen(false);
          void reload();
          setToast("Admin created");
        }}
      />
      <ToastHost message={toast} onClose={() => setToast(null)} />
    </>
  );
}
function AdminModal({
  open,
  onClose,
  onDone,
  roles,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  roles: Role[];
}) {
  const [f, setF] = useState({ email: "", name: "", adminRoleKey: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  async function save() {
    setErr("");
    const email = f.email.trim().toLowerCase();
    const name = f.name.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return setErr("Enter a valid email address.");
    if (!name) return setErr("Name is required.");
    if (!f.adminRoleKey) return setErr("Select a role.");
    setLoading(true);
    try {
      await post("/admin/admins", { ...f, email, name });
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
      title="Add admin"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={loading} onClick={save}>
            Create
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Email"
          type="email"
          autoComplete="off"
          value={f.email}
          onChange={(e) => setF({ ...f, email: e.target.value })}
        />
        <Input
          label="Name"
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
        />
        <Select
          label="Role"
          value={f.adminRoleKey}
          onChange={(e) => setF({ ...f, adminRoleKey: e.target.value })}
        >
          <option value="">Select role</option>
          {roles.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </Select>
        {err && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>
        )}
      </div>
    </Modal>
  );
}
