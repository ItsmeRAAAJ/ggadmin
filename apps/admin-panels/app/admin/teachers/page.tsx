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
  SearchBox,
  Select,
  SkeletonRows,
  StatusBadge,
  Table,
  Td,
  Th,
  ToastHost,
} from "@/components/ui";

type Branch = { id: string; shortCode: string; name: string };
type Teacher = {
  id: string;
  name: string;
  department?: string | null;
  tier: string;
  user: { email: string; status: string };
  primaryBranch?: Branch | null;
  reportsTo?: { name: string } | null;
  _count?: { assignments: number; manages: number };
};
export default function TeachersPage() {
  const { hasPermission } = useAuth();
  const { data, error, loading, reload } = useApi<Teacher[]>("/admin/teachers");
  const { data: branches } = useApi<Branch[]>("/admin/branches");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const rows = (data || []).filter(
    (t) =>
      !search ||
      `${t.name} ${t.user.email}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        title="Teachers"
        description="Create faculty accounts and manage hierarchy, status and permissions."
        actions={
          hasPermission("MANAGE_TEACHERS") && (
            <Button onClick={() => setOpen(true)}>Add teacher</Button>
          )
        }
      />
      <div className="mb-4 max-w-md">
        <SearchBox
          placeholder="Search teachers"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Email</Th>
            <Th>Tier</Th>
            <Th>Branch</Th>
            <Th>Status</Th>
            <Th>Reports to</Th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonRows cols={6} />
          ) : rows.length ? (
            rows.map((t) => (
              <tr key={t.id}>
                <Td>
                  <Link
                    className="font-bold text-brand-primary"
                    href={`/admin/teachers/${t.id}`}
                  >
                    {t.name}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {t.department || "—"}
                  </div>
                </Td>
                <Td>{t.user.email}</Td>
                <Td>{t.tier.replaceAll("_", " ")}</Td>
                <Td>{t.primaryBranch?.shortCode || "—"}</Td>
                <Td>
                  <StatusBadge status={t.user.status} />
                </Td>
                <Td>{t.reportsTo?.name || "—"}</Td>
              </tr>
            ))
          ) : (
            <tr>
              <Td colSpan={6}>
                <EmptyState title="No teachers" />
              </Td>
            </tr>
          )}
        </tbody>
      </Table>
      <TeacherModal
        key={open ? "open" : "closed"}
        open={open}
        branches={branches || []}
        teachers={data || []}
        onClose={() => setOpen(false)}
        onDone={() => {
          setOpen(false);
          void reload();
          setToast("Teacher created");
        }}
      />
      <ToastHost message={toast} onClose={() => setToast(null)} />
    </>
  );
}
function TeacherModal({
  open,
  onClose,
  onDone,
  branches,
  teachers,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  branches: Branch[];
  teachers: Teacher[];
}) {
  const [f, setF] = useState({
    email: "",
    name: "",
    department: "",
    tier: "SUBJECT_TEACHER",
    primaryBranchId: "",
    reportsToId: "",
  });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  async function save() {
    setErr("");
    const email = f.email.trim().toLowerCase();
    const name = f.name.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return setErr("Enter a valid email address.");
    if (!name) return setErr("Name is required.");
    setLoading(true);
    try {
      await post("/admin/teachers", {
        ...f,
        email,
        name,
        department: f.department.trim() || null,
        primaryBranchId: f.primaryBranchId || null,
        reportsToId: f.reportsToId || null,
      });
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
      title="Add teacher"
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
      <div className="grid gap-4 sm:grid-cols-2">
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
        <Input
          label="Department"
          value={f.department}
          onChange={(e) => setF({ ...f, department: e.target.value })}
        />
        <Select
          label="Tier"
          value={f.tier}
          onChange={(e) => setF({ ...f, tier: e.target.value })}
        >
          <option value="HOD">HOD</option>
          <option value="INCHARGE">Incharge</option>
          <option value="SUBJECT_TEACHER">Subject teacher</option>
        </Select>
        <Select
          label="Primary branch"
          value={f.primaryBranchId}
          onChange={(e) => setF({ ...f, primaryBranchId: e.target.value })}
        >
          <option value="">None</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.shortCode}
            </option>
          ))}
        </Select>
        <Select
          label="Reports to"
          value={f.reportsToId}
          onChange={(e) => setF({ ...f, reportsToId: e.target.value })}
        >
          <option value="">None</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>
      {err && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {err}
        </p>
      )}
    </Modal>
  );
}
