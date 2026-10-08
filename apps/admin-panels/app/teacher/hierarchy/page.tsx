"use client";
import { useState } from "react";
import { del, post } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  Select,
  Table,
  Td,
  Th,
  ToastHost,
  Toggle,
} from "@/components/ui";

type Teacher = {
  id: string;
  name: string;
  tier: string;
  department?: string | null;
  user: { email: string; status: string };
  reportsTo?: { name: string } | null;
  assignments: {
    id: string;
    section?: string | null;
    academicYear: number;
    subject: {
      id: string;
      code: string;
      name: string;
      semester: number;
      branch: { shortCode: string };
    };
  }[];
  permissions: { key: string; label: string }[];
};
type Hier = {
  self: { id: string; name: string; tier: string };
  reportsToChain: { id: string; name: string; tier: string }[];
  directReports: { id: string; name: string; tier: string }[];
};
type Subject = {
  id: string;
  code: string;
  name: string;
  semester: number;
  branch: { shortCode: string };
};
type Perm = { key: string; label: string };
export default function Hierarchy() {
  const { hasPermission, identity } = useAuth();
  const { data: hier, error, reload } = useApi<Hier>("/teacher/hierarchy");
  const team = useApi<Teacher[]>("/teacher/team");
  const { data: subjects } = useApi<Subject[]>("/teacher/scope-subjects");
  const { data: perms } = useApi<{ permissions: Perm[]; grantable: Perm[] }>(
    "/teacher/permissions",
  );
  const [assign, setAssign] = useState<Teacher | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [unassign, setUnassign] = useState<{
    id: string;
    teacher: string;
    code: string;
  } | null>(null);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const show =
    identity?.teacher?.tier === "HOD" ||
    identity?.teacher?.tier === "INCHARGE" ||
    (team.data?.length || 0) > 0;
  if (!show)
    return (
      <>
        <PageHeader
          title="Hierarchy"
          description="Team management is available to HOD/Incharge tiers or teachers with descendants."
        />
        <EmptyState title="No team hierarchy" />
      </>
    );
  async function togglePerm(t: Teacher, key: string, on: boolean) {
    setErr("");
    try {
      if (on)
        await post(`/teacher/team/${t.id}/permissions`, { permissionKey: key });
      else await del(`/teacher/team/${t.id}/permissions/${key}`);
      setToast("Permission updated");
      await team.reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  async function removeAssignment() {
    if (!unassign) return;
    const id = unassign.id;
    setUnassign(null);
    setErr("");
    try {
      await del(`/teacher/subject-assignments/${id}`);
      setToast("Assignment removed");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      await team.reload();
    }
  }
  return (
    <>
      <PageHeader
        title="Teacher hierarchy"
        description="Manage descendants, subject assignments and grantable permissions within your scope."
      />
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader title="Reporting chain" />
          <div className="p-5">
            <p className="font-bold">{hier?.self.name}</p>
            <p className="text-sm text-slate-500">{hier?.self.tier}</p>
            <div className="mt-4 space-y-2">
              {hier?.reportsToChain.map((t) => (
                <div key={t.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                  Reports to {t.name} · {t.tier}
                </div>
              ))}
            </div>
            <h3 className="mt-6 font-bold">Direct reports</h3>
            {hier?.directReports.length ? (
              hier.directReports.map((t) => (
                <div key={t.id} className="mt-2 rounded-xl border p-3 text-sm">
                  {t.name} · {t.tier}
                </div>
              ))
            ) : (
              <p className="mt-2 text-sm text-slate-500">No direct reports</p>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Team" />
          <Table>
            <thead>
              <tr>
                <Th>Teacher</Th>
                <Th>Assignments</Th>
                <Th>Permissions</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {team.data?.length ? (
                team.data.map((t) => {
                  const granted = new Set(t.permissions.map((p) => p.key));
                  return (
                    <tr key={t.id} className="align-top">
                      <Td>
                        {t.name}
                        <div className="text-xs text-slate-500">
                          {t.tier} · {t.user.email}
                        </div>
                      </Td>
                      <Td>
                        {t.assignments.length
                          ? t.assignments.map((a) => (
                              <div key={a.id} className="mb-1">
                                <Badge>{a.subject.code}</Badge>{" "}
                                {a.section || "All"} · {a.academicYear}{" "}
                                {hasPermission(
                                  "MANAGE_TEACHER_ASSIGNMENTS",
                                ) && (
                                  <button
                                    type="button"
                                    className="ml-1 text-xs font-semibold text-red-600 hover:underline"
                                    onClick={() =>
                                      setUnassign({
                                        id: a.id,
                                        teacher: t.name,
                                        code: a.subject.code,
                                      })
                                    }
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            ))
                          : "—"}
                      </Td>
                      <Td>
                        <div className="space-y-2">
                          {perms?.grantable.map((p) => (
                            <div
                              key={p.key}
                              className="flex items-center justify-between gap-2"
                            >
                              <span className="text-xs">{p.label}</span>
                              <Toggle
                                checked={granted.has(p.key)}
                                onChange={(v) => void togglePerm(t, p.key, v)}
                              />
                            </div>
                          ))}
                        </div>
                      </Td>
                      <Td>
                        {hasPermission("MANAGE_TEACHER_ASSIGNMENTS") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setAssign(t)}
                          >
                            Assign subject
                          </Button>
                        )}
                      </Td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <Td colSpan={4}>
                    <EmptyState title="No descendants" />
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>
      </div>
      {err && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {err}
        </p>
      )}
      <AssignModal
        key={assign?.id ?? "closed"}
        teacher={assign}
        subjects={subjects || []}
        onClose={() => setAssign(null)}
        onDone={() => {
          setAssign(null);
          void team.reload();
          setToast("Assignment created");
        }}
      />
      <ConfirmDialog
        open={!!unassign}
        title="Remove subject assignment"
        message={
          unassign ? `Remove ${unassign.teacher} from ${unassign.code}?` : ""
        }
        confirmText="Remove"
        danger
        onClose={() => setUnassign(null)}
        onConfirm={() => void removeAssignment()}
      />
      <ToastHost message={toast} onClose={() => setToast(null)} />
    </>
  );
}
function AssignModal({
  teacher,
  subjects,
  onClose,
  onDone,
}: {
  teacher: Teacher | null;
  subjects: Subject[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [f, setF] = useState({
    subjectId: "",
    section: "",
    academicYear: String(new Date().getFullYear()),
  });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  async function save() {
    if (!teacher) return;
    setLoading(true);
    setErr("");
    try {
      await post("/teacher/subject-assignments", {
        teacherProfileId: teacher.id,
        subjectId: f.subjectId,
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
      open={!!teacher}
      title={`Assign ${teacher?.name || ""}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={loading} onClick={save}>
            Assign
          </Button>
        </>
      }
    >
      <div className="space-y-4">
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
          label="Section"
          value={f.section}
          onChange={(e) => setF({ ...f, section: e.target.value })}
        />
        <Input
          label="Academic year"
          value={f.academicYear}
          onChange={(e) => setF({ ...f, academicYear: e.target.value })}
        />
        {err && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>
        )}
      </div>
    </Modal>
  );
}
