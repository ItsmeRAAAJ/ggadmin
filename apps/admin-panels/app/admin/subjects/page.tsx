"use client";
import { useMemo, useState } from "react";
import { del, patch, post, query } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  SearchBox,
  Select,
  SkeletonRows,
  Table,
  Td,
  Th,
  ToastHost,
} from "@/components/ui";

type Branch = { id: string; shortCode: string; name: string };
type Subject = {
  id: string;
  name: string;
  code: string;
  semester: number;
  branch: Branch;
  assignments?: { teacherProfile: { name: string } }[];
  _count?: {
    assignmentsModule: number;
    deadlines: number;
    resourceFolders: number;
  };
};
export default function SubjectsPage() {
  const { hasPermission } = useAuth();
  const [filters, setFilters] = useState({
    search: "",
    branchId: "",
    semester: "",
  });
  const qs = useMemo(() => query(filters), [filters]);
  const { data, error, loading, reload } = useApi<Subject[]>(
    `/admin/subjects${qs}`,
  );
  const { data: branches } = useApi<Branch[]>("/admin/branches");
  const [modal, setModal] = useState<Subject | null | "new">(null);
  const [remove, setRemove] = useState<Subject | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [err, setErr] = useState("");
  if (error) return <ErrorState error={error} onRetry={reload} />;
  async function deleteSubject() {
    if (!remove) return;
    try {
      await del(`/admin/subjects/${remove.id}`);
      setToast("Subject deleted");
      setRemove(null);
      void reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  return (
    <>
      <PageHeader
        title="Subjects"
        description="Branch and semester wise subject catalogue."
        actions={
          hasPermission("MANAGE_ACADEMIC_STRUCTURE") && (
            <Button onClick={() => setModal("new")}>Add subject</Button>
          )
        }
      />
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <SearchBox
          placeholder="Search subject/code"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
        <Select
          value={filters.branchId}
          onChange={(e) => setFilters({ ...filters, branchId: e.target.value })}
        >
          <option value="">All branches</option>
          {branches?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.shortCode}
            </option>
          ))}
        </Select>
        <Select
          value={filters.semester}
          onChange={(e) => setFilters({ ...filters, semester: e.target.value })}
        >
          <option value="">All semesters</option>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
            <option key={s} value={s}>
              Semester {s}
            </option>
          ))}
        </Select>
      </div>
      {err && (
        <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {err}
        </p>
      )}
      <Table>
        <thead>
          <tr>
            <Th>Code</Th>
            <Th>Name</Th>
            <Th>Branch</Th>
            <Th>Semester</Th>
            <Th>Teachers</Th>
            <Th>Academics</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonRows cols={7} />
          ) : data?.length ? (
            data.map((s) => (
              <tr key={s.id}>
                <Td className="font-bold">{s.code}</Td>
                <Td>{s.name}</Td>
                <Td>{s.branch?.shortCode}</Td>
                <Td>
                  <Badge>{s.semester}</Badge>
                </Td>
                <Td>
                  {s.assignments
                    ?.map((a) => a.teacherProfile.name)
                    .join(", ") || "—"}
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    <Badge tone="blue">
                      {s._count?.assignmentsModule ?? 0} assignments
                    </Badge>
                    <Badge tone="amber">{s._count?.deadlines ?? 0} deadlines</Badge>
                    <Badge tone="cyan">
                      {s._count?.resourceFolders ?? 0} folders
                    </Badge>
                  </div>
                </Td>
                <Td className="space-x-2">
                  {hasPermission("MANAGE_ACADEMIC_STRUCTURE") && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setModal(s)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setRemove(s)}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </Td>
              </tr>
            ))
          ) : (
            <tr>
              <Td colSpan={7}>
                <EmptyState title="No subjects" />
              </Td>
            </tr>
          )}
        </tbody>
      </Table>
      <SubjectModal
        key={modal === "new" ? "new" : (modal?.id ?? "closed")}
        open={!!modal}
        subject={modal === "new" ? null : modal}
        branches={branches || []}
        onClose={() => setModal(null)}
        onDone={() => {
          setModal(null);
          void reload();
          setToast("Subject saved");
        }}
      />
      <ConfirmDialog
        open={!!remove}
        danger
        title="Delete subject"
        message="This permanently deletes the subject. Subjects that already have teacher assignments, assignments, deadlines, resources or shared posts can't be deleted."
        confirmText="Delete"
        onClose={() => setRemove(null)}
        onConfirm={deleteSubject}
      />
      <ToastHost message={toast} onClose={() => setToast(null)} />
    </>
  );
}
function SubjectModal({
  open,
  onClose,
  onDone,
  subject,
  branches,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  subject: Subject | null;
  branches: Branch[];
}) {
  const [f, setF] = useState({
    name: subject?.name || "",
    code: subject?.code || "",
    branchId: subject?.branch?.id || "",
    semester: String(subject?.semester || 1),
  });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  async function save() {
    setLoading(true);
    setErr("");
    try {
      if (subject)
        await patch(`/admin/subjects/${subject.id}`, {
          name: f.name,
          semester: Number(f.semester),
        });
      else
        await post("/admin/subjects", { ...f, semester: Number(f.semester) });
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
      title={subject ? "Edit subject" : "Add subject"}
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
          label="Name"
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
        />
        <Input
          label="Code"
          disabled={!!subject}
          value={f.code}
          onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })}
        />
        <Select
          label="Branch"
          disabled={!!subject}
          value={f.branchId}
          onChange={(e) => setF({ ...f, branchId: e.target.value })}
        >
          <option value="">Select</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.shortCode}
            </option>
          ))}
        </Select>
        <Input
          label="Semester"
          value={f.semester}
          onChange={(e) => setF({ ...f, semester: e.target.value })}
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
