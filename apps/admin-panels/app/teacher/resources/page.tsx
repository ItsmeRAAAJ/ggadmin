"use client";
import Link from "next/link";
import { BookOpen, FolderOpen, FileText } from "lucide-react";
import { useApi } from "@/lib/hooks";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  StatCard,
} from "@/components/ui";

type ResourceSubject = {
  id: string;
  name: string;
  code: string;
  semester: number;
  branch: { shortCode: string; name?: string };
  folderCount: number;
  fileCount: number;
};

export default function ResourcesPage() {
  const { data, error, loading, reload } = useApi<ResourceSubject[]>(
    "/teacher/resources/subjects",
  );
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const folders = data?.reduce((sum, s) => sum + s.folderCount, 0) ?? 0;
  const files = data?.reduce((sum, s) => sum + s.fileCount, 0) ?? 0;
  return (
    <>
      <PageHeader
        title="Resources"
        description="Organize official subject material into folders and files."
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Subjects" value={loading ? "—" : (data?.length ?? 0)} icon={<BookOpen />} />
        <StatCard label="Folders" value={loading ? "—" : folders} icon={<FolderOpen />} />
        <StatCard label="Files" value={loading ? "—" : files} icon={<FileText />} />
      </div>
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-40 animate-pulse bg-slate-100">
              <span className="sr-only">Loading resource subject</span>
            </Card>
          ))}
        </div>
      ) : data?.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((s) => (
            <Card key={s.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-brand-primary">
                    {s.branch.shortCode} · Sem {s.semester}
                  </p>
                  <h2 className="mt-1 text-lg font-black text-slate-950">
                    {s.code}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">{s.name}</p>
                </div>
                <FolderOpen className="h-6 w-6 text-slate-400" />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500">Folders</p>
                  <p className="text-2xl font-black text-slate-950">{s.folderCount}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500">Files</p>
                  <p className="text-2xl font-black text-slate-950">{s.fileCount}</p>
                </div>
              </div>
              <Link href={`/teacher/resources/${s.id}`}>
                <Button className="mt-5 w-full" variant="outline">
                  Manage folders
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No subjects assigned"
          description="Ask your admin or HOD to assign you a subject before adding resources."
        />
      )}
    </>
  );
}
