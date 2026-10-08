"use client";
import { useApi } from "@/lib/hooks";
import {
  Badge,
  EmptyState,
  ErrorState,
  PageHeader,
  SkeletonRows,
  Table,
  Td,
  Th,
} from "@/components/ui";

type Row = {
  id: string;
  section?: string | null;
  academicYear: number;
  studentCount: number;
  subject: {
    id: string;
    code: string;
    name: string;
    semester: number;
    branch: { shortCode: string; name: string };
  };
};
export default function Subjects() {
  const { data, error, loading, reload } = useApi<Row[]>("/teacher/subjects");
  if (error) return <ErrorState error={error} onRetry={reload} />;
  return (
    <>
      <PageHeader
        title="My subjects"
        description="Subjects assigned to you for teaching."
      />
      <Table>
        <thead>
          <tr>
            <Th>Subject</Th>
            <Th>Branch</Th>
            <Th>Semester</Th>
            <Th>Section</Th>
            <Th>Academic year</Th>
            <Th>Eligible students</Th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonRows cols={6} />
          ) : data?.length ? (
            data.map((r) => (
              <tr key={r.id}>
                <Td className="font-bold">
                  {r.subject.code} · {r.subject.name}
                </Td>
                <Td>{r.subject.branch.shortCode}</Td>
                <Td>
                  <Badge>{r.subject.semester}</Badge>
                </Td>
                <Td>{r.section || "All"}</Td>
                <Td>{r.academicYear}</Td>
                <Td>{r.studentCount}</Td>
              </tr>
            ))
          ) : (
            <tr>
              <Td colSpan={6}>
                <EmptyState title="No subjects assigned" />
              </Td>
            </tr>
          )}
        </tbody>
      </Table>
    </>
  );
}
