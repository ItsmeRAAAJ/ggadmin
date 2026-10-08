"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { post } from "@/lib/api";
import { useMySubjects } from "@/lib/hooks";
import { isoFromInput } from "@/lib/format";
import {
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";

type Created = { id: string };

export default function NewAssignment() {
  const router = useRouter();
  const { subjects, loading: subjectsLoading } = useMySubjects();
  const [f, setF] = useState({
    subjectId: "",
    title: "",
    description: "",
    dueAt: "",
    maxMarks: "",
  });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const dueAt = isoFromInput(f.dueAt);
    const maxMarks = f.maxMarks.trim() ? Number(f.maxMarks) : null;
    if (!f.subjectId) return setErr("Select a subject.");
    if (!f.title.trim()) return setErr("Title is required.");
    if (!dueAt) return setErr("Due date is required.");
    if (
      maxMarks !== null &&
      (!Number.isInteger(maxMarks) || maxMarks < 1 || maxMarks > 1000)
    )
      return setErr("Max marks must be a whole number between 1 and 1000.");
    setLoading(true);
    try {
      const a = await post<Created>("/teacher/assignments", {
        subjectId: f.subjectId,
        title: f.title.trim(),
        description: f.description.trim() || null,
        dueAt,
        maxMarks,
      });
      router.replace(`/teacher/assignments/${a.id}`);
    } catch (e) {
      setErr((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="New assignment"
        description="Create a draft assignment, then publish from the detail page."
        actions={
          <Link href="/teacher/assignments">
            <Button variant="outline">Cancel</Button>
          </Link>
        }
      />
      {!subjectsLoading && subjects?.length === 0 ? (
        <EmptyState
          title="No subjects assigned"
          description="Ask your admin or HOD to assign you a subject before creating assignments."
        />
      ) : (
        <Card className="max-w-3xl p-5">
          <form noValidate onSubmit={save}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Subject"
                value={f.subjectId}
                onChange={(e) => setF({ ...f, subjectId: e.target.value })}
              >
                <option value="">Select subject</option>
                {subjects?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </Select>
              <Input
                label="Due date"
                type="datetime-local"
                value={f.dueAt}
                onChange={(e) => setF({ ...f, dueAt: e.target.value })}
              />
              <Input
                label="Title"
                containerClassName="sm:col-span-2"
                maxLength={300}
                value={f.title}
                onChange={(e) => setF({ ...f, title: e.target.value })}
              />
              <Textarea
                label="Description"
                containerClassName="sm:col-span-2"
                value={f.description}
                onChange={(e) => setF({ ...f, description: e.target.value })}
              />
              <Input
                label="Max marks (optional)"
                type="number"
                min={1}
                max={1000}
                placeholder="Leave empty for ungraded"
                value={f.maxMarks}
                onChange={(e) => setF({ ...f, maxMarks: e.target.value })}
              />
            </div>
            {err && (
              <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {err}
              </p>
            )}
            <Button className="mt-5" type="submit" loading={loading}>
              Create draft
            </Button>
          </form>
        </Card>
      )}
    </>
  );
}
