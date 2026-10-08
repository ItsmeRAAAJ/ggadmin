"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, Plus, Upload } from "lucide-react";
import StudentUploadModal from "@/components/StudentUploadModal";
import { download, post, query } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
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
  Pagination,
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
type Student = {
  id: string;
  enrollmentNumber: string;
  email: string;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  branch: Branch;
  admissionYear: number;
  passoutYear?: number | null;
  currentSemester?: number | null;
  section?: string | null;
  status: string;
  updatedAt: string;
};
type List = {
  items: Student[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  visibility: { email: boolean; phone: boolean };
};
export default function StudentsPage() {
  const { hasPermission } = useAuth();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    search: "",
    branchId: "",
    currentSemester: "",
    status: "",
    admissionYear: "",
  });
  const qs = useMemo(
    () => query({ ...filters, page, limit: 20 }),
    [filters, page],
  );
  const { data, error, loading, reload } = useApi<List>(`/admin/students${qs}`);
  const { data: branches } = useApi<Branch[]>("/admin/branches");
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const updateFilter = (k: string, v: string) => {
    setPage(1);
    setFilters((f) => ({ ...f, [k]: v }));
  };
  return (
    <>
      <PageHeader
        title="Students"
        description="Search, seed, update and export real student profiles."
        actions={
          <>
            {hasPermission("MANAGE_STUDENTS") && (
              <>
                <Button onClick={() => setImportOpen(true)}>
                  <Upload className="h-4 w-4" />
                  Import students
                </Button>
                <Button variant="outline" onClick={() => setAddOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add student
                </Button>
                <Button variant="outline" onClick={() => setBulkOpen(true)}>
                  Bulk semester
                </Button>
              </>
            )}
            {hasPermission("EXPORT_STUDENT_PROFILES") && (
              <Button
                variant="outline"
                onClick={() =>
                  download(
                    `/admin/students/export${qs}`,
                    `students-${Date.now()}.csv`,
                  )
                }
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            )}
          </>
        }
      />
      <Card className="mb-5 p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <SearchBox
            placeholder="Search name, email, enrollment"
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
          />
          <Select
            value={filters.branchId}
            onChange={(e) => updateFilter("branchId", e.target.value)}
          >
            <option value="">All branches</option>
            {branches?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.shortCode}
              </option>
            ))}
          </Select>
          <Select
            value={filters.currentSemester}
            onChange={(e) => updateFilter("currentSemester", e.target.value)}
          >
            <option value="">All semesters</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <option key={s} value={s}>
                Semester {s}
              </option>
            ))}
          </Select>
          <Select
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value)}
          >
            <option value="">All statuses</option>
            <option>ACTIVE</option>
            <option>PENDING_ACTIVATION</option>
            <option>DISABLED</option>
          </Select>
          <Input
            placeholder="Admission year"
            value={filters.admissionYear}
            onChange={(e) => updateFilter("admissionYear", e.target.value)}
          />
        </div>
      </Card>
      <Table>
        <thead>
          <tr>
            <Th>Student</Th>
            <Th>Branch</Th>
            <Th>Semester</Th>
            <Th>Status</Th>
            <Th>Email</Th>
            <Th>Updated</Th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonRows rows={8} cols={6} />
          ) : data?.items.length ? (
            data.items.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <Td>
                  <Link
                    className="font-bold text-brand-primary hover:underline"
                    href={`/admin/students/${s.id}`}
                  >
                    {s.firstName || s.lastName
                      ? `${s.firstName || ""} ${s.lastName || ""}`
                      : s.enrollmentNumber}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {s.enrollmentNumber}
                  </div>
                </Td>
                <Td>{s.branch?.shortCode}</Td>
                <Td>
                  {s.currentSemester || "—"}
                  {s.section && <Badge>{s.section}</Badge>}
                </Td>
                <Td>
                  <StatusBadge status={s.status} />
                </Td>
                <Td>{s.email}</Td>
                <Td>{fmtDate(s.updatedAt)}</Td>
              </tr>
            ))
          ) : (
            <tr>
              <Td colSpan={6}>
                <EmptyState title="No students found" />
              </Td>
            </tr>
          )}
        </tbody>
      </Table>
      {data && (
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          onPage={setPage}
        />
      )}
      <StudentUploadModal
        key={importOpen ? "open" : "closed"}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => {
          void reload();
          setToast("Import complete");
        }}
      />
      <AddStudentModal
        key={addOpen ? "open" : "closed"}
        open={addOpen}
        branches={branches || []}
        onClose={() => setAddOpen(false)}
        onDone={() => {
          setAddOpen(false);
          void reload();
          setToast("Student saved");
        }}
      />
      <BulkModal
        key={bulkOpen ? "open" : "closed"}
        open={bulkOpen}
        branches={branches || []}
        onClose={() => setBulkOpen(false)}
        onDone={() => {
          setBulkOpen(false);
          void reload();
          setToast("Semester updated");
        }}
      />
      <ToastHost message={toast} onClose={() => setToast(null)} />
    </>
  );
}
function AddStudentModal({
  open,
  onClose,
  onDone,
  branches,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  branches: Branch[];
}) {
  const [f, setF] = useState({
    enrollmentNumber: "",
    email: "",
    branchCode: "",
    admissionYear: String(new Date().getFullYear()),
    passoutYear: "",
    currentSemester: "1",
    section: "",
  });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  async function save() {
    setLoading(true);
    setErr("");
    try {
      await post("/admin/students", {
        ...f,
        admissionYear: Number(f.admissionYear),
        passoutYear: f.passoutYear ? Number(f.passoutYear) : undefined,
        currentSemester: f.currentSemester
          ? Number(f.currentSemester)
          : undefined,
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
      title="Add student"
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
          label="Enrollment"
          value={f.enrollmentNumber}
          onChange={(e) =>
            setF({ ...f, enrollmentNumber: e.target.value.toUpperCase() })
          }
          hint="e.g. 0201CS231234"
        />
        <Input
          label="Institutional email"
          value={f.email}
          onChange={(e) => setF({ ...f, email: e.target.value })}
          hint="first.last.cs23@ggits.net"
        />
        <Select
          label="Branch code"
          value={f.branchCode}
          onChange={(e) => setF({ ...f, branchCode: e.target.value })}
        >
          <option value="">Select</option>
          {branches.map((b) => (
            <option key={b.id} value={b.shortCode}>
              {b.shortCode} — {b.name}
            </option>
          ))}
        </Select>
        <Input
          label="Admission year"
          value={f.admissionYear}
          onChange={(e) => setF({ ...f, admissionYear: e.target.value })}
        />
        <Input
          label="Passout year"
          value={f.passoutYear}
          onChange={(e) => setF({ ...f, passoutYear: e.target.value })}
        />
        <Input
          label="Current semester"
          value={f.currentSemester}
          onChange={(e) => setF({ ...f, currentSemester: e.target.value })}
        />
        <Input
          label="Section"
          value={f.section}
          onChange={(e) => setF({ ...f, section: e.target.value })}
        />
      </div>
      {err && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {err}
        </p>
      )}
    </Modal>
  );
}
function BulkModal({
  open,
  onClose,
  onDone,
  branches,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  branches: Branch[];
}) {
  const [f, setF] = useState({
    branchId: "",
    admissionYear: String(new Date().getFullYear()),
    currentSemester: "1",
  });
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  async function save() {
    setLoading(true);
    setErr("");
    try {
      await post("/admin/students/bulk-semester", {
        branchId: f.branchId,
        admissionYear: Number(f.admissionYear),
        currentSemester: Number(f.currentSemester),
      });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <Modal
        open={open}
        title="Bulk set semester"
        onClose={onClose}
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => setConfirm(true)}>Review</Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Select
            label="Branch"
            value={f.branchId}
            onChange={(e) => setF({ ...f, branchId: e.target.value })}
          >
            <option value="">Select branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.shortCode} — {b.name}
              </option>
            ))}
          </Select>
          <Input
            label="Admission year"
            value={f.admissionYear}
            onChange={(e) => setF({ ...f, admissionYear: e.target.value })}
          />
          <Input
            label="New current semester"
            value={f.currentSemester}
            onChange={(e) => setF({ ...f, currentSemester: e.target.value })}
          />
          {err && (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {err}
            </p>
          )}
        </div>
      </Modal>
      <ConfirmDialog
        open={confirm}
        title="Confirm bulk update"
        message="This updates every matching student. Continue?"
        confirmText="Update students"
        loading={loading}
        onConfirm={save}
        onClose={() => setConfirm(false)}
      />
    </>
  );
}
