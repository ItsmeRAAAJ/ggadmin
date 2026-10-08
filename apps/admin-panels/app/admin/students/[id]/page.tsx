"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { patch } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { fmtDate } from "@/lib/format";
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
  PageHeader,
  Select,
  StatusBadge,
  Table,
  Td,
  Th,
  ToastHost,
} from "@/components/ui";

type Student = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  section?: string | null;
  currentSemester?: number | null;
  admissionYear: number;
  passoutYear?: number | null;
  profileImageUrl?: string | null;
  techResumeUrl?: string | null;
  nonTechResumeUrl?: string | null;
  user: {
    id: string;
    enrollmentNumber: string;
    email: string;
    status: string;
    createdAt: string;
  };
  branch: { shortCode: string; name: string };
  certificates: {
    id: string;
    title: string;
    issuer?: string | null;
    fileUrl: string;
    issueDate?: string | null;
  }[];
  projects: {
    id: string;
    title: string;
    description?: string | null;
    link?: string | null;
    techStack?: string[];
  }[];
  achievements: {
    id: string;
    title: string;
    category: string;
    description?: string | null;
    fileUrl?: string | null;
    date?: string | null;
  }[];
  socialLinks: { id: string; platform: string; url: string }[];
};
export default function StudentDetail() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const { data, error, loading, reload } = useApi<Student>(
    id ? `/admin/students/${id}` : null,
  );
  const [toast, setToast] = useState<string | null>(null);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data)
    return <PageHeader title="Student profile" description="Loading..." />;
  const name =
    `${data!.firstName || ""} ${data!.lastName || ""}`.trim() ||
    data!.user.enrollmentNumber;
  return (
    <>
      <PageHeader
        title={name}
        description={`${data!.user.enrollmentNumber} · ${data!.branch.shortCode} · admitted ${data!.admissionYear}`}
        actions={
          <Link href="/admin/students">
            <Button variant="outline">Back</Button>
          </Link>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex gap-5">
              <div className="h-24 w-24 overflow-hidden rounded-3xl bg-blue-100">
                {data!.profileImageUrl && (
                  // Short-lived signed S3 URL; next/image optimisation would cache an expiring URL.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data!.profileImageUrl}
                    alt="Student"
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <Info label="Email" value={data!.user.email} />
                <Info label="Phone" value={data!.phone} />
                <Info
                  label="Status"
                  value={<StatusBadge status={data!.user.status} />}
                />
                <Info label="Created" value={fmtDate(data!.user.createdAt)} />
                <Info label="Semester" value={data!.currentSemester} />
                <Info label="Section" value={data!.section} />
              </div>
            </div>
          </Card>
          <Files
            title="Documents"
            items={[
              { label: "Technical resume", url: data!.techResumeUrl },
              { label: "Non-technical resume", url: data!.nonTechResumeUrl },
            ]}
          />
          <Section title="Certificates">
            <Table>
              <thead>
                <tr>
                  <Th>Title</Th>
                  <Th>Issuer</Th>
                  <Th>Date</Th>
                  <Th>File</Th>
                </tr>
              </thead>
              <tbody>
                {data!.certificates.length ? (
                  data!.certificates.map((c) => (
                    <tr key={c.id}>
                      <Td>{c.title}</Td>
                      <Td>{c.issuer || "—"}</Td>
                      <Td>{fmtDate(c.issueDate, { timeStyle: undefined })}</Td>
                      <Td>
                        <Open url={c.fileUrl} />
                      </Td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <Td colSpan={4}>
                      <EmptyState title="No certificates" />
                    </Td>
                  </tr>
                )}
              </tbody>
            </Table>
          </Section>
          <Section title="Projects">
            <div className="grid gap-3">
              {data!.projects.length ? (
                data!.projects.map((p) => (
                  <Card key={p.id} className="p-4">
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="font-bold">{p.title}</p>
                        <p className="text-sm text-slate-500">
                          {p.description || "No description"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {p.techStack?.map((t) => (
                            <Badge key={t}>{t}</Badge>
                          ))}
                        </div>
                      </div>
                      <Open url={p.link} />
                    </div>
                  </Card>
                ))
              ) : (
                <EmptyState title="No projects" />
              )}
            </div>
          </Section>
          <Section title="Achievements">
            <div className="grid gap-3">
              {data!.achievements.length ? (
                data!.achievements.map((a) => (
                  <Card key={a.id} className="p-4">
                    <div className="flex justify-between">
                      <div>
                        <p className="font-bold">{a.title}</p>
                        <Badge>{a.category.replaceAll("_", " ")}</Badge>
                        <p className="mt-2 text-sm text-slate-500">
                          {a.description || "—"}
                        </p>
                      </div>
                      <Open url={a.fileUrl} />
                    </div>
                  </Card>
                ))
              ) : (
                <EmptyState title="No achievements" />
              )}
            </div>
          </Section>
          <Section title="Social links">
            <div className="flex flex-wrap gap-2">
              {data!.socialLinks.length ? (
                data!.socialLinks.map((s) => (
                  <a
                    key={s.id}
                    className="rounded-xl border px-3 py-2 text-sm font-semibold text-brand-primary"
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {s.platform}
                  </a>
                ))
              ) : (
                <span className="text-sm text-slate-500">No links</span>
              )}
            </div>
          </Section>
        </div>
        <AdminUpdates
          key={`${data!.currentSemester}|${data!.section}|${data!.user.status}`}
          student={data!}
          canEdit={hasPermission("MANAGE_STUDENTS")}
          onSaved={async () => {
            setToast("Student updated");
            await reload();
          }}
        />
      </div>
      <ToastHost message={toast} onClose={() => setToast(null)} />
    </>
  );
}
function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <div className="mt-1 font-semibold text-slate-900">{value || "—"}</div>
    </div>
  );
}
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} />
      <div className="p-5">{children}</div>
    </Card>
  );
}
function Open({ url }: { url?: string | null }) {
  return url ? (
    <a
      className="inline-flex items-center gap-1 text-sm font-semibold text-brand-primary"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <ExternalLink className="h-4 w-4" />
      Open
    </a>
  ) : (
    <span className="text-sm text-slate-400">—</span>
  );
}
function Files({
  title,
  items,
}: {
  title: string;
  items: { label: string; url?: string | null }[];
}) {
  return (
    <Section title={title}>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((i) => (
          <Card key={i.label} className="p-4">
            <p className="font-semibold">{i.label}</p>
            <div className="mt-2">
              <Open url={i.url} />
            </div>
          </Card>
        ))}
      </div>
    </Section>
  );
}

function AdminUpdates({
  student,
  canEdit,
  onSaved,
}: {
  student: Student;
  canEdit: boolean;
  onSaved: () => Promise<void>;
}) {
  const [semester, setSemester] = useState(
    student.currentSemester ? String(student.currentSemester) : "",
  );
  const [section, setSection] = useState(student.section || "");
  const [status, setStatus] = useState(student.user.status);
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  function buildChanges() {
    const body: Record<string, unknown> = {};
    const sem = Number(semester);
    if (semester.trim() && sem !== student.currentSemester) {
      if (!Number.isInteger(sem) || sem < 1 || sem > 8)
        throw new Error("Semester must be a whole number from 1 to 8.");
      body.currentSemester = sem;
    }
    const nextSection = section.trim().toUpperCase();
    if (nextSection !== (student.section || "")) {
      if (nextSection.length > 10)
        throw new Error("Section can be at most 10 characters.");
      body.section = nextSection || null;
    }
    if (status !== student.user.status) body.status = status;
    return body;
  }

  async function save(body: Record<string, unknown>) {
    setSaving(true);
    setErr("");
    try {
      await patch(`/admin/students/${student.id}`, body);
      setConfirm(false);
      await onSaved();
    } catch (e) {
      setErr((e as Error).message);
      setConfirm(false);
    } finally {
      setSaving(false);
    }
  }

  function submit() {
    setErr("");
    let body: Record<string, unknown>;
    try {
      body = buildChanges();
    } catch (e) {
      return setErr((e as Error).message);
    }
    if (!Object.keys(body).length) return setErr("No changes to save.");
    if (body.status === "DISABLED" || body.status === "PENDING_ACTIVATION")
      return setConfirm(true);
    void save(body);
  }

  return (
    <Card className="h-fit p-5">
      <h2 className="font-bold">Admin updates</h2>
      <p className="mb-4 text-sm text-slate-500">
        Semester, section and account status changes apply immediately.
      </p>
      <div className="space-y-4">
        <Input
          label="Semester"
          type="number"
          min={1}
          max={8}
          value={semester}
          disabled={!canEdit}
          onChange={(e) => setSemester(e.target.value)}
        />
        <Input
          label="Section"
          maxLength={10}
          placeholder="Not set"
          value={section}
          disabled={!canEdit}
          onChange={(e) => setSection(e.target.value)}
        />
        <Select
          label="Account status"
          value={status}
          disabled={!canEdit}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="ACTIVE">Active</option>
          <option value="PENDING_ACTIVATION">Pending activation</option>
          <option value="DISABLED">Disabled</option>
        </Select>
        {status === "ACTIVE" && student.user.status !== "ACTIVE" && (
          <p className="text-xs text-slate-500">
            Students who have never set a password must activate from the app
            instead.
          </p>
        )}
        {err && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>
        )}
        <Button
          className="w-full"
          loading={saving && !confirm}
          disabled={!canEdit}
          onClick={submit}
        >
          Save changes
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        title={
          status === "DISABLED"
            ? "Disable student account?"
            : "Reset activation?"
        }
        message={
          status === "DISABLED"
            ? "The student will be signed out on all devices and can't sign in until re-enabled."
            : "The student will be signed out, their password cleared, and they'll need to activate again with an OTP."
        }
        confirmText={status === "DISABLED" ? "Disable account" : "Reset"}
        danger
        loading={saving}
        onConfirm={() => {
          try {
            void save(buildChanges());
          } catch (e) {
            setErr((e as Error).message);
            setConfirm(false);
          }
        }}
        onClose={() => setConfirm(false)}
      />
    </Card>
  );
}
