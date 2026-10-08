"use client";
import {
  Activity,
  BookOpen,
  Building2,
  GraduationCap,
  Shield,
  Users,
} from "lucide-react";
import { useApi } from "@/lib/hooks";
import { fmtDate } from "@/lib/format";
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  StatCard,
} from "@/components/ui";

type Dashboard = {
  students: {
    total: number;
    active: number;
    pending: number;
    disabled: number;
  };
  teachers: number;
  admins: number;
  branches: number;
  subjects: number;
  studentsPerBranch: {
    id: string;
    shortCode: string;
    name: string;
    count: number;
  }[];
  recentActivity?:
    | {
        id: string;
        action: string;
        targetEntity: string;
        createdAt: string;
        actor?: { email: string };
      }[]
    | null;
};
export default function AdminDashboard() {
  const { data, error, loading, reload } =
    useApi<Dashboard>("/admin/dashboard");
  if (error) return <ErrorState error={error} onRetry={reload} />;
  return (
    <>
      <PageHeader
        title="Admin dashboard"
        description="Live operational overview for My GGITS."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Students"
          value={loading ? "—" : (data?.students.total ?? 0)}
          hint={`${data?.students.active ?? 0} active, ${data?.students.pending ?? 0} pending`}
          icon={<Users />}
        />
        <StatCard
          label="Teachers"
          value={loading ? "—" : (data?.teachers ?? 0)}
          icon={<GraduationCap />}
        />
        <StatCard
          label="Admins"
          value={loading ? "—" : (data?.admins ?? 0)}
          icon={<Shield />}
        />
        <StatCard
          label="Branches"
          value={loading ? "—" : (data?.branches ?? 0)}
          icon={<Building2 />}
        />
        <StatCard
          label="Subjects"
          value={loading ? "—" : (data?.subjects ?? 0)}
          icon={<BookOpen />}
        />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Students by branch" />
          <div className="p-5">
            {loading ? (
              <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
            ) : data?.studentsPerBranch.length ? (
              <div className="space-y-3">
                {data.studentsPerBranch.map((b) => (
                  <div key={b.id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-semibold">
                        {b.shortCode} · {b.name}
                      </span>
                      <span>{b.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-brand-primary"
                        style={{
                          width: `${Math.min(100, (b.count / Math.max(1, data.students.total)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No branch data" />
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Recent activity" />
          {loading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          ) : data?.recentActivity?.length ? (
            <ul className="divide-y divide-slate-100">
              {data.recentActivity.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand-primary">
                    <Activity className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {humanizeAction(a.action)}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {a.actor?.email || "System"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-500">
                    {fmtDate(a.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No recent activity" />
          )}
        </Card>
      </div>
    </>
  );
}

function humanizeAction(action: string) {
  const text = action.toLowerCase().replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
