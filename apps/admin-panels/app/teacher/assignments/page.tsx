"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { query } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { fmtDate } from "@/lib/format";
import {
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  Select,
  SkeletonRows,
  StatusBadge,
  Table,
  Td,
  Th,
} from "@/components/ui";

type Assignment = {
  id: string;
  title: string;
  status: string;
  dueAt: string;
  maxMarks?: number | null;
  isOwner: boolean;
  eligibleCount: number;
  submittedCount: number;
  subject: { code: string; name: string; branch: { shortCode: string } };
};
export default function Assignments() {
  const [status, setStatus] = useState("");
  const qs = useMemo(() => query({ status }), [status]);
  const { data, error, loading, reload } = useApi<Assignment[]>(
    `/teacher/assignments${qs}`,
  );
  if (error) return <ErrorState error={error} onRetry={reload} />;
  return (
    <>
      <PageHeader
        title="Assignments"
        description="Create, publish, close and grade assignment submissions."
        actions={
          <Link href="/teacher/assignments/new">
            <Button>New assignment</Button>
          </Link>
        }
      />
      <div className="mb-4 max-w-xs">
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option>DRAFT</option>
          <option>PUBLISHED</option>
          <option>CLOSED</option>
        </Select>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Title</Th>
            <Th>Subject</Th>
            <Th>Due</Th>
            <Th>Status</Th>
            <Th>Submissions</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonRows cols={6} />
          ) : data?.length ? (
            data.map((a) => (
              <tr key={a.id}>
                <Td className="font-bold">
                  {a.title}
                  <div className="text-xs text-slate-500">
                    Max marks {a.maxMarks ?? "—"}
                  </div>
                </Td>
                <Td>{a.subject.code}</Td>
                <Td>{fmtDate(a.dueAt)}</Td>
                <Td>
                  <StatusBadge status={a.status} />
                </Td>
                <Td>
                  {a.submittedCount}/{a.eligibleCount}
                </Td>
                <Td>
                  <Link href={`/teacher/assignments/${a.id}`}>
                    <Button size="sm" variant="outline">
                      Open
                    </Button>
                  </Link>
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
    </>
  );
}
