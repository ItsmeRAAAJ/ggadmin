"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { del, patch, post } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Select,
  StatusBadge,
  Table,
  Td,
  Th,
  ToastHost,
  Toggle,
} from "@/components/ui";

type Branch = { id: string; shortCode: string; name: string };
type Permission = {
  id: string;
  key: string;
  label: string;
  description?: string | null;
  category: string;
};
type Teacher = {
  id: string;
  name: string;
  department?: string | null;
  tier: string;
  user: { email: string; status: string };
  primaryBranch?: Branch | null;
  reportsTo?: { id: string; name: string } | null;
  assignments: {
    id: string;
    section?: string | null;
    academicYear: number;
    subject: {
      code: string;
      name: string;
      semester: number;
      branch: { shortCode: string };
    };
  }[];
  permissionGrants: { permission: Permission }[];
  manages: { id: string; name: string; tier: string }[];
};
export default function TeacherDetail() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const { data, error, loading, reload } = useApi<Teacher>(
    id ? `/admin/teachers/${id}` : null,
  );
  const { data: branches } = useApi<Branch[]>("/admin/branches");
  const { data: allTeachers } =
    useApi<{ id: string; name: string }[]>("/admin/teachers");
  const { data: perms } = useApi<Permission[]>("/admin/permissions");
  const [toast, setToast] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [permErr, setPermErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data)
    return <PageHeader title="Teacher" description="Loading..." />;
  const granted = new Set(data!.permissionGrants.map((g) => g.permission.key));
  const canManage = hasPermission("MANAGE_TEACHERS");
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "").trim();
    setErr("");
    if (!name) return setErr("Name is required.");
    const status = String(fd.get("status") || "");
    setSaving(true);
    try {
      await patch(`/admin/teachers/${data!.id}`, {
        name,
        department: String(fd.get("department") || "").trim() || null,
        tier: fd.get("tier"),
        primaryBranchId: fd.get("primaryBranchId") || null,
        reportsToId: fd.get("reportsToId") || null,
        ...(status && status !== data!.user.status ? { status } : {}),
      });
      setToast("Teacher updated");
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function toggle(key: string, on: boolean) {
    if (pendingKey) return;
    setPendingKey(key);
    setPermErr("");
    try {
      if (on)
        await post(`/admin/teachers/${data!.id}/permissions`, {
          permissionKey: key,
        });
      else await del(`/admin/teachers/${data!.id}/permissions/${key}`);
      setToast(on ? "Permission granted" : "Permission revoked");
      await reload();
    } catch (e) {
      setPermErr((e as Error).message);
    } finally {
      setPendingKey(null);
    }
  }
  return (
    <>
      <PageHeader
        title={data!.name}
        description={data!.user.email}
        actions={
          <Link href="/admin/teachers">
            <Button variant="outline">Back</Button>
          </Link>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card className="p-5">
          <form
            key={`${data!.name}|${data!.tier}|${data!.user.status}|${data!.reportsTo?.id}|${data!.primaryBranch?.id}|${data!.department}`}
            noValidate
            onSubmit={save}
            className="space-y-4"
          >
            <Input name="name" label="Name" defaultValue={data!.name} />
            <Input
              name="department"
              label="Department"
              defaultValue={data!.department || ""}
            />
            <Select name="tier" label="Tier" defaultValue={data!.tier}>
              <option value="HOD">HOD</option>
              <option value="INCHARGE">Incharge</option>
              <option value="SUBJECT_TEACHER">Subject teacher</option>
            </Select>
            <Select
              name="primaryBranchId"
              label="Primary branch"
              defaultValue={data!.primaryBranch?.id || ""}
            >
              <option value="">None</option>
              {branches?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.shortCode} · {b.name}
                </option>
              ))}
            </Select>
            <Select
              name="reportsToId"
              label="Reports to"
              defaultValue={data!.reportsTo?.id || ""}
            >
              <option value="">None</option>
              {allTeachers
                ?.filter((t) => t.id !== data!.id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </Select>
            {data!.user.status === "PENDING_ACTIVATION" ? (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                This teacher hasn&apos;t activated their account yet.
              </p>
            ) : (
              <Select
                name="status"
                label="Account status"
                defaultValue={data!.user.status}
              >
                <option value="ACTIVE">Active</option>
                <option value="DISABLED">Disabled</option>
              </Select>
            )}
            {err && (
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {err}
              </p>
            )}
            <Button type="submit" loading={saving} disabled={!canManage}>
              Save teacher
            </Button>
          </form>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Status and team" />
            <div className="grid gap-3 p-5 sm:grid-cols-3">
              <Info
                label="Status"
                value={<StatusBadge status={data!.user.status} />}
              />
              <Info label="Manages" value={data!.manages.length} />
              <Info
                label="Subject assignments"
                value={data!.assignments.length}
              />
            </div>
          </Card>
          <Card>
            <CardHeader title="Subject assignments" />
            <Table>
              <thead>
                <tr>
                  <Th>Subject</Th>
                  <Th>Branch</Th>
                  <Th>Semester</Th>
                  <Th>Section</Th>
                  <Th>Year</Th>
                </tr>
              </thead>
              <tbody>
                {data!.assignments.length ? (
                  data!.assignments.map((a) => (
                    <tr key={a.id}>
                      <Td>
                        {a.subject.code} · {a.subject.name}
                      </Td>
                      <Td>{a.subject.branch.shortCode}</Td>
                      <Td>{a.subject.semester}</Td>
                      <Td>{a.section || "All"}</Td>
                      <Td>{a.academicYear}</Td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <Td colSpan={5}>
                      <EmptyState title="No assignments" />
                    </Td>
                  </tr>
                )}
              </tbody>
            </Table>
          </Card>
          <Card>
            <CardHeader
              title="Permission grants"
              description="Teacher grantable permissions only."
            />
            {permErr && (
              <p className="mx-4 mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {permErr}
              </p>
            )}
            <div className="divide-y divide-slate-100">
              {perms
                ?.filter((p) => p.category !== "ADMIN_MANAGEMENT")
                .map((p) => (
                  <div
                    key={p.key}
                    className="flex items-center justify-between gap-4 p-4"
                  >
                    <div>
                      <p className="font-semibold">{p.label}</p>
                      <p className="text-xs text-slate-500">{p.key}</p>
                    </div>
                    <Toggle
                      checked={granted.has(p.key)}
                      disabled={!canManage || pendingKey !== null}
                      onChange={(v) => void toggle(p.key, v)}
                    />
                  </div>
                ))}
            </div>
          </Card>
        </div>
      </div>
      <ToastHost message={toast} onClose={() => setToast(null)} />
    </>
  );
}
function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <div className="mt-1 text-lg font-black">{value}</div>
    </div>
  );
}
