"use client";
import { useMemo, useState } from "react";
import { query } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { fmtDate } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Pagination,
  Select,
  SkeletonRows,
  Table,
  Td,
  Th,
} from "@/components/ui";

type Log = {
  id: string;
  actor?: { email: string; role: string } | null;
  action: string;
  targetEntity?: string | null;
  targetId?: string | null;
  metadata?: unknown;
  createdAt: string;
};
type Resp = {
  items: Log[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  actions: string[];
};
export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [f, setF] = useState({ action: "", actor: "", from: "", to: "" });
  const qs = useMemo(() => query({ ...f, page, limit: 20 }), [f, page]);
  const { data, error, loading, reload } = useApi<Resp>(
    `/admin/audit-logs${qs}`,
  );
  const [expanded, setExpanded] = useState("");
  if (error) return <ErrorState error={error} onRetry={reload} />;
  return (
    <>
      <PageHeader
        title="Audit logs"
        description="Chronological audit trail for sensitive actions."
      />
      <Card className="mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <Select
            value={f.action}
            onChange={(e) => {
              setPage(1);
              setF({ ...f, action: e.target.value });
            }}
          >
            <option value="">All actions</option>
            {data?.actions.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
          <Input
            placeholder="Actor email"
            value={f.actor}
            onChange={(e) => {
              setPage(1);
              setF({ ...f, actor: e.target.value });
            }}
          />
          <Input
            type="date"
            value={f.from}
            onChange={(e) => {
              setPage(1);
              setF({ ...f, from: e.target.value });
            }}
          />
          <Input
            type="date"
            value={f.to}
            onChange={(e) => {
              setPage(1);
              setF({ ...f, to: e.target.value });
            }}
          />
          <Button
            variant="outline"
            onClick={() => setF({ action: "", actor: "", from: "", to: "" })}
          >
            Clear
          </Button>
        </div>
      </Card>
      <Table>
        <thead>
          <tr>
            <Th>Actor</Th>
            <Th>Action</Th>
            <Th>Target</Th>
            <Th>Timestamp</Th>
            <Th>Metadata</Th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonRows cols={5} />
          ) : data?.items.length ? (
            data.items.map((l) => (
              <tr key={l.id} className="align-top">
                <Td>
                  {l.actor?.email || "System"}
                  <div className="text-xs text-slate-500">{l.actor?.role}</div>
                </Td>
                <Td>
                  <Badge>{l.action}</Badge>
                </Td>
                <Td>
                  {l.targetEntity || "—"}
                  <div className="max-w-40 truncate text-xs text-slate-500">
                    {l.targetId}
                  </div>
                </Td>
                <Td>{fmtDate(l.createdAt)}</Td>
                <Td>
                  <button
                    className="font-semibold text-brand-primary"
                    onClick={() => setExpanded(expanded === l.id ? "" : l.id)}
                  >
                    {expanded === l.id ? "Hide" : "View"}
                  </button>
                  {expanded === l.id && (
                    <pre className="mt-2 max-w-lg whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs">
                      {JSON.stringify(l.metadata, null, 2)}
                    </pre>
                  )}
                </Td>
              </tr>
            ))
          ) : (
            <tr>
              <Td colSpan={5}>
                <EmptyState title="No logs" />
              </Td>
            </tr>
          )}
        </tbody>
      </Table>
      {data && (
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          onPage={setPage}
        />
      )}
    </>
  );
}
