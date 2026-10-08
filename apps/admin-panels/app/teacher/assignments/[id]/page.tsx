"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { del, patch, query } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { dateInput, fmtDate, isoFromInput } from "@/lib/format";
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
  SearchBox,
  Select,
  StatCard,
  StatusBadge,
  Table,
  Td,
  Textarea,
  Th,
  ToastHost,
} from "@/components/ui";

type Assignment = {
  id: string;
  title: string;
  description?: string | null;
  dueAt: string;
  maxMarks?: number | null;
  status: string;
  isOwner: boolean;
  subject: { code: string; name: string; branch: { shortCode: string } };
  summary: {
    eligible: number;
    pending: number;
    submitted: number;
    late: number;
    graded: number;
    ungraded: number;
  };
};
type Sub = {
  id: string | null;
  student: {
    id: string;
    name: string;
    enrollmentNumber: string;
    section?: string | null;
  };
  status: string;
  isLate: boolean;
  submittedAt?: string | null;
  fileUrl?: string | null;
  marksAwarded?: number | null;
  feedback?: string | null;
};
type Subs = {
  assignment: {
    id: string;
    title: string;
    maxMarks?: number | null;
    status: string;
  };
  summary: Assignment["summary"];
  rows: Sub[];
};
export default function AssignmentDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, error, loading, reload } = useApi<Assignment>(
    id ? `/teacher/assignments/${id}` : null,
  );
  const [sf, setSf] = useState({ status: "", search: "" });
  const sqs = useMemo(() => query(sf), [sf]);
  const subs = useApi<Subs>(
    id ? `/teacher/assignments/${id}/submissions${sqs}` : null,
  );
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState<null | "publish" | "close" | "delete">(
    null,
  );
  const [grade, setGrade] = useState<Sub | null>(null);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data)
    return <PageHeader title="Assignment" description="Loading..." />;
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = String(formData.get("title") || "").trim();
    const dueAt = isoFromInput(String(formData.get("dueAt") || ""));
    const rawMax = String(formData.get("maxMarks") || "").trim();
    const maxMarks = rawMax ? Number(rawMax) : null;
    setErr("");
    if (!title) return setErr("Title is required.");
    if (!dueAt) return setErr("Due date is required.");
    if (
      maxMarks !== null &&
      (!Number.isInteger(maxMarks) || maxMarks < 1 || maxMarks > 1000)
    )
      return setErr("Max marks must be a whole number between 1 and 1000.");
    setSaving(true);
    try {
      await patch(`/teacher/assignments/${data!.id}`, {
        title,
        description: String(formData.get("description") || "").trim() || null,
        dueAt,
        maxMarks,
      });
      setToast("Assignment saved");
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function action() {
    if (!confirm) return;
    try {
      if (confirm === "delete") {
        await del(`/teacher/assignments/${data!.id}`);
        router.replace("/teacher/assignments");
        return;
      }
      await patch(`/teacher/assignments/${data!.id}/${confirm}`);
      setToast(
        confirm === "publish" ? "Assignment published" : "Assignment closed",
      );
      setConfirm(null);
      await reload();
      await subs.reload();
    } catch (e) {
      setErr((e as Error).message);
      setConfirm(null);
    }
  }
  return (
    <>
      <PageHeader
        title={data!.title}
        description={`${data!.subject.code} · due ${fmtDate(data!.dueAt)}`}
        actions={
          <>
            <Link href="/teacher/assignments">
              <Button variant="outline">Back</Button>
            </Link>
            {data!.status === "DRAFT" && (
              <Button onClick={() => setConfirm("publish")}>Publish</Button>
            )}
            {data!.status === "PUBLISHED" && (
              <Button variant="danger" onClick={() => setConfirm("close")}>
                Close
              </Button>
            )}
            {data!.status === "DRAFT" && (
              <Button variant="danger" onClick={() => setConfirm("delete")}>
                Delete draft
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Eligible" value={data!.summary.eligible} />
        <StatCard label="Pending" value={data!.summary.pending} />
        <StatCard label="Submitted" value={data!.summary.submitted} />
        <StatCard label="Late" value={data!.summary.late} />
        <StatCard label="Graded" value={data!.summary.graded} />
        <StatCard label="Ungraded" value={data!.summary.ungraded} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[400px_1fr]">
        <Card className="h-fit p-5">
          <form noValidate onSubmit={save} className="space-y-4">
            <Input name="title" label="Title" defaultValue={data!.title} />
            <Textarea
              name="description"
              label="Description"
              defaultValue={data!.description || ""}
            />
            <Input
              name="dueAt"
              label="Due date"
              type="datetime-local"
              defaultValue={dateInput(data!.dueAt)}
            />
            <Input
              name="maxMarks"
              label="Max marks"
              type="number"
              min={1}
              max={1000}
              placeholder="Ungraded / no maximum"
              defaultValue={data!.maxMarks || ""}
            />
            <div className="flex gap-2">
              <StatusBadge status={data!.status} />
              <Badge>{data!.maxMarks ?? "No max"} marks</Badge>
            </div>
            {err && (
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {err}
              </p>
            )}
            <Button
              type="submit"
              loading={saving}
              disabled={!data!.isOwner || data!.status === "CLOSED"}
            >
              Save details
            </Button>
          </form>
        </Card>
        <Card>
          <CardHeader title="Submissions" />
          <div className="grid gap-3 p-4 md:grid-cols-2">
            <Select
              value={sf.status}
              onChange={(e) => setSf({ ...sf, status: e.target.value })}
            >
              <option value="">All</option>
              <option>PENDING</option>
              <option>SUBMITTED</option>
              <option>LATE</option>
              <option>GRADED</option>
              <option>UNGRADED</option>
            </Select>
            <SearchBox
              placeholder="Search student"
              value={sf.search}
              onChange={(e) => setSf({ ...sf, search: e.target.value })}
            />
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Student</Th>
                <Th>Status</Th>
                <Th>Submitted</Th>
                <Th>File</Th>
                <Th>Marks</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody>
              {subs.data?.rows.length ? (
                subs.data!.rows.map((r) => (
                  <tr key={r.student.id}>
                    <Td>
                      {r.student.name}
                      <div className="text-xs text-slate-500">
                        {r.student.enrollmentNumber}
                      </div>
                    </Td>
                    <Td>
                      <StatusBadge status={r.status} />
                    </Td>
                    <Td>{fmtDate(r.submittedAt)}</Td>
                    <Td>
                      {r.fileUrl ? (
                        <a
                          className="font-semibold text-brand-primary"
                          target="_blank"
                          rel="noopener noreferrer"
                          href={r.fileUrl}
                        >
                          Open
                        </a>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>{r.marksAwarded ?? "—"}</Td>
                    <Td>
                      {r.id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setGrade(r)}
                        >
                          Grade
                        </Button>
                      )}
                    </Td>
                  </tr>
                ))
              ) : (
                <tr>
                  <Td colSpan={6}>
                    <EmptyState title="No submissions" />
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>
      </div>
      <GradeModal
        key={grade?.id ?? "closed"}
        open={!!grade}
        sub={grade}
        assignmentId={data!.id}
        max={data!.maxMarks}
        onClose={() => setGrade(null)}
        onDone={() => {
          setGrade(null);
          void subs.reload();
          void reload();
          setToast("Grade saved");
        }}
      />
      <ConfirmDialog
        open={!!confirm}
        danger={confirm === "close" || confirm === "delete"}
        title={
          confirm === "publish"
            ? "Publish assignment?"
            : confirm === "close"
              ? "Close assignment?"
              : "Delete draft?"
        }
        message={
          confirm === "publish"
            ? "Students in this subject will see it and can start submitting."
            : confirm === "close"
              ? "Students will no longer be able to submit or replace files. You can still grade."
              : "This draft will be permanently deleted."
        }
        confirmText={
          confirm === "publish"
            ? "Publish"
            : confirm === "close"
              ? "Close assignment"
              : "Delete"
        }
        onClose={() => setConfirm(null)}
        onConfirm={() => void action()}
      />
      <ToastHost message={toast} onClose={() => setToast(null)} />
    </>
  );
}
function GradeModal({
  open,
  onClose,
  onDone,
  sub,
  assignmentId,
  max,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  sub: Sub | null;
  assignmentId: string;
  max?: number | null;
}) {
  const [marks, setMarks] = useState(String(sub?.marksAwarded ?? ""));
  const [feedback, setFeedback] = useState(sub?.feedback || "");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  async function save() {
    const value = Number(marks);
    if (marks.trim() === "" || !Number.isInteger(value) || value < 0) {
      setErr("Enter whole-number marks (0 or more).");
      return;
    }
    if (max != null && value > max) {
      setErr(`Marks can't exceed ${max}.`);
      return;
    }
    setLoading(true);
    setErr("");
    try {
      await patch(
        `/teacher/assignments/${assignmentId}/submissions/${sub?.id}/grade`,
        { marksAwarded: value, feedback: feedback.trim() || null },
      );
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
      title={`Grade ${sub?.student.name || ""}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={loading} onClick={save}>
            Save grade
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label={`Marks${max ? ` / ${max}` : ""}`}
          value={marks}
          onChange={(e) => setMarks(e.target.value)}
        />
        <Textarea
          label="Feedback"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
        {err && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>
        )}
      </div>
    </Modal>
  );
}
