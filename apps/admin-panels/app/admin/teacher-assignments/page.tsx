"use client";
import { useState } from "react";
import { del, post } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  Select,
  SkeletonRows,
  Table,
  Td,
  Th,
  ToastHost,
} from "@/components/ui";

type Teacher = { id: string; name: string; tier: string };
type Subject = {
  id: string;
  name: string;
  code: string;
  semester: number;
  branch: { shortCode: string };
};
type Row = {
  id: string;
  teacherProfile: Teacher;
  subject: Subject;
  section?: string | null;
  academicYear: number;
};
export default function TeacherAssignments() {
  const { hasPermission } = useAuth();
  const { data, error, loading, reload } = useApi<Row[]>(
    "/admin/teacher-assignments",
  );
  const { data: teachers } = useApi<Teacher[]>("/admin/teachers");
  const { data: subjects } = useApi<Subject[]>("/admin/subjects");
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Row | null>(null);
  const [err, setErr] = useState("");
  if (error) return <ErrorState error={error} onRetry={reload} />;
  async function remove() {
    if (!removing) return;
    const id = removing.id;
    setRemoving(null);
    setErr("");
    try {
      await del(`/admin/teacher-assignments/${id}`);
      setToast("Assignment removed");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      void reload();
    }
  }
  return (
    <>
      <PageHeader
        title="Teacher assignments"
        description="Map teachers to subjects, section and academic year."
        actions={
          hasPermission("MANAGE_TEACHER_ASSIGNMENTS") && (
            <Button onClick={() => setOpen(true)}>Create assignment</Button>
          )
        }
      />
      <Table>
        <thead>
          <tr>
            <Th>Teacher</Th>
            <Th>Subject</Th>
            <Th>Branch</Th>
            <Th>Section</Th>
            <Th>Year</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonRows cols={6} />
          ) : data?.length ? (
            data.map((r) => (
              <tr key={r.id}>
                <Td>
                  {r.teacherProfile.name}
                  <div className="text-xs text-slate-500">
                    {r.teacherProfile.tier}
                  </div>
                </Td>
                <Td>
                  {r.subject.code} · {r.subject.name}
                </Td>
                <Td>{r.subject.branch.shortCode}</Td>
                <Td>{r.section || "All"}</Td>
                <Td>{r.academicYear}</Td>
                <Td>
                  {hasPermission("MANAGE_TEACHER_ASSIGNMENTS") && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setRemoving(r)}
                    >
                      Remove
                    </Button>
                  )}
                </Td>
              </tr>
            ))
          ) : (
            <tr>
              <Td colSpan={6}>
                <EmptyState title="No assignments" />
              </Td>
            </tr>
          )}
        </tbody>
      </Table>
      {err && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {err}
        </p>
      )}
      <ConfirmDialog
        open={!!removing}
        title="Remove teacher assignment"
        message={
          removing
            ? `Remove ${removing.teacherProfile.name} from ${removing.subject.code} (${removing.section || "all sections"}, ${removing.academicYear})?`
            : ""
        }
        confirmText="Remove"
        danger
        onClose={() => setRemoving(null)}
        onConfirm={() => void remove()}
      />
      <AssignModal
        key={open ? "open" : "closed"}
        open={open}
        onClose={() => setOpen(false)}
        teachers={teachers || []}
        subjects={subjects || []}
        onDone={() => {
          setOpen(false);
          void reload();
          setToast("Assignment created");
        }}
      />
      <ToastHost message={toast} onClose={() => setToast(null)} />
    </>
  );
}
function AssignModal({
  open,
  onClose,
  onDone,
  teachers,
  subjects,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  teachers: Teacher[];
  subjects: Subject[];
}) {
  const [f, setF] = useState({
    teacherProfileId: "",
    subjectId: "",
    section: "",
    academicYear: String(new Date().getFullYear()),
  });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  async function save() {
    setLoading(true);
    setErr("");
    try {
      await post("/admin/teacher-assignments", {
        ...f,
        section: f.section || null,
        academicYear: Number(f.academicYear),
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
      title="Assign teacher"
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
      <div className="grid gap-4">
        <Select
          label="Teacher"
          value={f.teacherProfileId}
          onChange={(e) => setF({ ...f, teacherProfileId: e.target.value })}
        >
          <option value="">Select teacher</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.tier})
            </option>
          ))}
        </Select>
        <Select
          label="Subject"
          value={f.subjectId}
          onChange={(e) => setF({ ...f, subjectId: e.target.value })}
        >
          <option value="">Select subject</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} · {s.name} · {s.branch.shortCode}
            </option>
          ))}
        </Select>
        <Input
          label="Section (optional)"
          value={f.section}
          onChange={(e) => setF({ ...f, section: e.target.value })}
        />
        <Input
          label="Academic year"
          value={f.academicYear}
          onChange={(e) => setF({ ...f, academicYear: e.target.value })}
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
