"use client";
import { useMemo, useState, type FormEvent } from "react";
import { CalendarDays } from "lucide-react";
import { del, patch, post, query } from "@/lib/api";
import { useApi, useMySubjects } from "@/lib/hooks";
import { dateInput, fmtDate, isoFromInput } from "@/lib/format";
import { dueInLabel } from "@/lib/academics";
import {
  Badge,
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
  Textarea,
  Th,
  ToastHost,
} from "@/components/ui";

type Subject = { id: string; code: string; name: string };
type Deadline = {
  id: string;
  title: string;
  description?: string | null;
  dueAt: string;
  isOwner: boolean;
  subject: Subject & { branch?: { shortCode: string } };
  createdBy: { id: string; name: string };
};

export default function DeadlinesPage() {
  const { subjects } = useMySubjects();
  const [filters, setFilters] = useState({ when: "upcoming", subjectId: "" });
  const qs = useMemo(() => query(filters), [filters]);
  const { data, error, loading, reload } = useApi<Deadline[]>(
    `/teacher/deadlines${qs}`,
  );
  const [modal, setModal] = useState<Deadline | null | "new">(null);
  const [remove, setRemove] = useState<Deadline | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  if (error) return <ErrorState error={error} onRetry={reload} />;

  async function deleteDeadline() {
    if (!remove) return;
    setDeleteLoading(true);
    try {
      await del(`/teacher/deadlines/${remove.id}`);
      setToast("Deadline deleted");
      setRemove(null);
      void reload();
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Deadlines"
        description="Post upcoming academic deadlines for your assigned subjects."
        actions={<Button onClick={() => setModal("new")}>New deadline</Button>}
      />
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <Select
          label="Timeline"
          value={filters.when}
          onChange={(e) => setFilters({ ...filters, when: e.target.value })}
        >
          <option value="upcoming">Upcoming</option>
          <option value="past">Past</option>
          <option value="all">All</option>
        </Select>
        <Select
          label="Subject"
          value={filters.subjectId}
          onChange={(e) =>
            setFilters({ ...filters, subjectId: e.target.value })
          }
        >
          <option value="">All subjects</option>
          {subjects?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} · {s.name}
            </option>
          ))}
        </Select>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Deadline</Th>
            <Th>Subject</Th>
            <Th>Due</Th>
            <Th>Posted by</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonRows cols={5} />
          ) : data?.length ? (
            data.map((d) => (
              <tr key={d.id}>
                <Td className="font-bold">
                  {d.title}
                  {d.description && (
                    <div className="max-w-md truncate text-xs font-normal text-slate-500">
                      {d.description}
                    </div>
                  )}
                </Td>
                <Td>
                  {d.subject.code}
                  <div className="text-xs text-slate-500">
                    {d.subject.name}
                  </div>
                </Td>
                <Td>
                  <div>{fmtDate(d.dueAt)}</div>
                  <Badge tone={new Date(d.dueAt) < new Date() ? "red" : "amber"}>
                    {dueInLabel(d.dueAt)}
                  </Badge>
                </Td>
                <Td>{d.createdBy?.name || "—"}</Td>
                <Td>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setModal(d)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => setRemove(d)}>
                      Delete
                    </Button>
                  </div>
                </Td>
              </tr>
            ))
          ) : (
            <tr>
              <Td colSpan={5}>
                <EmptyState
                  title="No deadlines"
                  description="Create a deadline to keep students aware of important dates."
                />
              </Td>
            </tr>
          )}
        </tbody>
      </Table>
      <DeadlineModal
        key={modal === "new" ? "new" : (modal?.id ?? "closed")}
        open={!!modal}
        deadline={modal === "new" ? null : modal}
        subjects={subjects || []}
        onClose={() => setModal(null)}
        onDone={() => {
          setModal(null);
          setToast("Deadline saved");
          void reload();
        }}
      />
      <ConfirmDialog
        open={!!remove}
        danger
        title="Delete deadline"
        message={`Delete "${remove?.title || "this deadline"}"? Students will no longer see it.`}
        confirmText="Delete"
        loading={deleteLoading}
        onClose={() => setRemove(null)}
        onConfirm={deleteDeadline}
      />
      <ToastHost message={toast} onClose={() => setToast(null)} />
    </>
  );
}

function DeadlineModal({
  open,
  onClose,
  onDone,
  deadline,
  subjects,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  deadline: Deadline | null;
  subjects: Subject[];
}) {
  const [f, setF] = useState({
    subjectId: deadline?.subject.id || "",
    title: deadline?.title || "",
    description: deadline?.description || "",
    dueAt: dateInput(deadline?.dueAt),
  });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const dueAt = isoFromInput(f.dueAt);
    if (!deadline && !f.subjectId) return setErr("Select a subject.");
    if (!f.title.trim()) return setErr("Title is required.");
    if (!dueAt) return setErr("Due date is required.");
    setLoading(true);
    try {
      if (deadline) {
        await patch(`/teacher/deadlines/${deadline.id}`, {
          title: f.title.trim(),
          description: f.description.trim() || null,
          dueAt,
        });
      } else {
        await post("/teacher/deadlines", {
          subjectId: f.subjectId,
          title: f.title.trim(),
          description: f.description.trim() || null,
          dueAt,
        });
      }
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
      title={deadline ? "Edit deadline" : "New deadline"}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="deadline-form" loading={loading}>
            Save
          </Button>
        </>
      }
    >
      <form id="deadline-form" noValidate onSubmit={save} className="space-y-4">
        <Select
          label="Subject"
          disabled={!!deadline}
          value={f.subjectId}
          onChange={(e) => setF({ ...f, subjectId: e.target.value })}
        >
          <option value="">Select subject</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} · {s.name}
            </option>
          ))}
        </Select>
        <Input
          label="Title"
          maxLength={200}
          value={f.title}
          onChange={(e) => setF({ ...f, title: e.target.value })}
        />
        <Textarea
          label="Description"
          value={f.description}
          onChange={(e) => setF({ ...f, description: e.target.value })}
        />
        <Input
          label="Due date"
          type="datetime-local"
          value={f.dueAt}
          onChange={(e) => setF({ ...f, dueAt: e.target.value })}
        />
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <CalendarDays className="h-4 w-4" /> Dates are saved as ISO timestamps.
        </p>
        {err && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>
        )}
      </form>
    </Modal>
  );
}
