"use client";
import Link from "next/link";
import { BookOpen, ClipboardList, FolderOpen, Users } from "lucide-react";
import { useApi } from "@/lib/hooks";
import { fmtDate } from "@/lib/format";
import { dueInLabel } from "@/lib/academics";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  StatCard,
  Table,
  Td,
  Th,
} from "@/components/ui";

type Dash = {
  subjects: number;
  assignments: Record<string, number>;
  ungradedSubmissions: number;
  academicDeadlines: {
    id: string;
    title: string;
    dueAt: string;
    subject: { name: string; code: string };
  }[];
  resourceFiles: number;
  teamSize: number;
};
export default function TeacherDashboard() {
  const { data, error, loading, reload } = useApi<Dash>("/teacher/dashboard");
  if (error) return <ErrorState error={error} onRetry={reload} />;
  return (
    <>
      <PageHeader
        title="Teacher dashboard"
        description="Your subjects, assignments, deadlines and resources."
        actions={
          <>
            <Link href="/teacher/deadlines">
              <Button>Post deadline</Button>
            </Link>
            <Link href="/teacher/assignments/new">
              <Button variant="outline">Create assignment</Button>
            </Link>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Subjects"
          value={loading ? "—" : (data?.subjects ?? 0)}
          icon={<BookOpen />}
        />
        <StatCard
          label="Resource files"
          value={loading ? "—" : (data?.resourceFiles ?? 0)}
          icon={<FolderOpen />}
        />
        <StatCard
          label="Published assignments"
          value={loading ? "—" : (data?.assignments?.PUBLISHED ?? 0)}
          icon={<ClipboardList />}
        />
        <StatCard
          label="Ungraded submissions"
          value={loading ? "—" : (data?.ungradedSubmissions ?? 0)}
        />
        <StatCard
          label="Team members"
          value={loading ? "—" : (data?.teamSize ?? 0)}
          icon={<Users />}
        />
      </div>
      <Card className="mt-6">
        <CardHeader title="Upcoming academic deadlines" />
        <Table>
          <thead>
            <tr>
              <Th>Deadline</Th>
              <Th>Subject</Th>
              <Th>Due</Th>
            </tr>
          </thead>
          <tbody>
            {data?.academicDeadlines?.length ? (
              data.academicDeadlines.map((d) => (
                <tr key={d.id}>
                  <Td>
                    <Link
                      className="font-bold text-brand-primary"
                      href="/teacher/deadlines"
                    >
                      {d.title}
                    </Link>
                  </Td>
                  <Td>{d.subject.code}</Td>
                  <Td>
                    {fmtDate(d.dueAt)}
                    <div className="mt-1">
                      <Badge tone="amber">{dueInLabel(d.dueAt)}</Badge>
                    </div>
                  </Td>
                </tr>
              ))
            ) : (
              <tr>
                <Td colSpan={3}>
                  <EmptyState title="No upcoming deadlines" />
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
