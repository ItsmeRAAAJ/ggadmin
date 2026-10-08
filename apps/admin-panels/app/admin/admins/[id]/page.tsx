"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { del, patch, post } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorState,
  Input,
  PageHeader,
  Select,
  StatusBadge,
  ToastHost,
  Toggle,
} from "@/components/ui";

type Role = { key: string; label: string };
type Permission = {
  id: string;
  key: string;
  label: string;
  description?: string | null;
  category: string;
};
type Admin = {
  id: string;
  name: string;
  user: { email: string; status: string };
  roleAssignments: { adminRole: Role }[];
  permissionGrantsReceived: { permission: Permission }[];
  managedAdmins: { id: string; name: string; user: { email: string } }[];
  isSelf: boolean;
  isSuperAdmin: boolean;
  canManage: boolean;
};
export default function AdminDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading, reload } = useApi<Admin>(
    id ? `/admin/admins/${id}` : null,
  );
  const { data: perms } = useApi<Permission[]>("/admin/permissions");
  const { data: roles } = useApi<Role[]>("/admin/admin-roles");
  const [toast, setToast] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [rowLoading, setRowLoading] = useState("");
  const grouped = useMemo(() => {
    const g: Record<string, Permission[]> = {};
    (perms || []).forEach((p) => {
      (g[p.category] ||= []).push(p);
    });
    return g;
  }, [perms]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data)
    return <PageHeader title="Admin" description="Loading..." />;
  const granted = new Set(
    data!.permissionGrantsReceived.map((g) => g.permission.key),
  );
  async function toggle(key: string, on: boolean) {
    if (rowLoading) return;
    setRowLoading(key);
    setErr("");
    try {
      if (on)
        await post(`/admin/admins/${data!.id}/permissions`, {
          permissionKey: key,
        });
      else await del(`/admin/admins/${data!.id}/permissions/${key}`);
      setToast(`${key} ${on ? "granted" : "revoked"}`);
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setRowLoading("");
    }
  }
  return (
    <>
      <PageHeader
        title={data!.name}
        description={data!.user.email}
        actions={
          <Link href="/admin/admins">
            <Button variant="outline">Back</Button>
          </Link>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <AdminDetailsForm
          key={`${data!.name}|${data!.user.status}|${data!.roleAssignments.map((r) => r.adminRole.key).join(",")}`}
          admin={data!}
          roles={roles || []}
          onSaved={async () => {
            setToast("Admin updated");
            await reload();
          }}
        />
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Permission grants"
              description={
                data!.canManage
                  ? "Toggle permissions. Changes take effect immediately."
                  : "Read-only: you cannot manage this admin."
              }
            />
            {err && (
              <p className="mx-4 mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {err}
              </p>
            )}
            <div className="divide-y divide-slate-100">
              {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat} className="p-4">
                  <h3 className="mb-3 font-bold text-slate-900">
                    {cat.replaceAll("_", " ")}
                  </h3>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {items.map((p) => (
                      <div
                        key={p.key}
                        className="flex items-center justify-between rounded-2xl border border-slate-100 p-3"
                      >
                        <div>
                          <p className="font-semibold">{p.label}</p>
                          <p className="text-xs text-slate-500">{p.key}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {rowLoading === p.key && <Badge>Saving</Badge>}
                          <Toggle
                            disabled={!data!.canManage || rowLoading !== ""}
                            checked={granted.has(p.key)}
                            onChange={(v) => void toggle(p.key, v)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="Managed admins" />
            <div className="p-5">
              {data!.managedAdmins.length ? (
                data!.managedAdmins.map((a) => (
                  <Link
                    key={a.id}
                    className="mr-2 inline-flex rounded-xl border px-3 py-2 text-sm font-semibold text-brand-primary"
                    href={`/admin/admins/${a.id}`}
                  >
                    {a.name}
                  </Link>
                ))
              ) : (
                <span className="text-sm text-slate-500">
                  No direct children
                </span>
              )}
            </div>
          </Card>
        </div>
      </div>
      <ToastHost message={toast} onClose={() => setToast(null)} />
    </>
  );
}

function AdminDetailsForm({
  admin,
  roles,
  onSaved,
}: {
  admin: Admin;
  roles: Role[];
  onSaved: () => Promise<void>;
}) {
  const initialRoles = admin.roleAssignments.map((r) => r.adminRole.key);
  const [name, setName] = useState(admin.name);
  const [status, setStatus] = useState(admin.user.status);
  const [roleKeys, setRoleKeys] = useState<string[]>(initialRoles);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const canEditName = admin.canManage || admin.isSelf;
  const pending = admin.user.status === "PENDING_ACTIVATION";

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const body: Record<string, unknown> = {};
    const trimmed = name.trim();
    if (!trimmed) return setErr("Name is required.");
    if (trimmed !== admin.name) body.name = trimmed;
    if (admin.canManage) {
      if (!pending && status !== admin.user.status) body.status = status;
      const changed =
        roleKeys.length !== initialRoles.length ||
        roleKeys.some((k) => !initialRoles.includes(k));
      if (changed) {
        if (!roleKeys.length) return setErr("Select at least one role.");
        body.adminRoleKeys = roleKeys;
      }
    }
    if (!Object.keys(body).length) return setErr("No changes to save.");
    setSaving(true);
    try {
      await patch(`/admin/admins/${admin.id}`, body);
      await onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="h-fit p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">Admin details</h2>
        <StatusBadge status={admin.user.status} />
      </div>
      <form noValidate onSubmit={save} className="mt-4 space-y-4">
        <Input
          label="Name"
          value={name}
          maxLength={150}
          disabled={!canEditName}
          onChange={(e) => setName(e.target.value)}
        />
        {pending ? (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            This admin hasn&apos;t activated their account yet.
          </p>
        ) : (
          <Select
            label="Account status"
            value={status}
            disabled={!admin.canManage}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="ACTIVE">Active</option>
            <option value="DISABLED">Disabled</option>
          </Select>
        )}
        <fieldset disabled={!admin.canManage}>
          <legend className="mb-2 text-sm font-medium text-slate-700">
            Roles
          </legend>
          <div className="space-y-2">
            {roles.map((r) => (
              <label
                key={r.key}
                className="flex items-center gap-2 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 accent-brand-primary"
                  checked={roleKeys.includes(r.key)}
                  onChange={(e) =>
                    setRoleKeys((prev) =>
                      e.target.checked
                        ? [...prev, r.key]
                        : prev.filter((k) => k !== r.key),
                    )
                  }
                />
                {r.label}
              </label>
            ))}
          </div>
        </fieldset>
        {err && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>
        )}
        <Button type="submit" loading={saving} disabled={!canEditName}>
          Save
        </Button>
      </form>
    </Card>
  );
}
