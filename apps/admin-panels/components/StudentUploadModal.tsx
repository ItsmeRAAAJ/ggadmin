"use client";
import { useMemo, useState } from "react";
import Papa from "papaparse";
import { Upload } from "lucide-react";
import { api } from "@/lib/api";
import {
  Badge,
  Button,
  EmptyState,
  Modal,
  Select,
  Table,
  Td,
  Th,
} from "@/components/ui";

type SeedRow = {
  line?: number;
  row?: number;
  enrollmentNumber?: string;
  outcome: string;
  reason?: string;
};
type SeedResult = {
  totalRows: number;
  inserted: number;
  updated: number;
  skippedProtected: number;
  invalidFormat: number;
  rows: SeedRow[];
};

export default function StudentUploadModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [filter, setFilter] = useState("");
  function read(file: File | undefined) {
    if (!file) return;
    setError("");
    setResult(null);
    setFileName(file.name);
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (r) => {
        if (r.errors.length) {
          setError(r.errors[0]?.message || "Could not parse CSV");
          return;
        }
        setRows(r.data);
      },
    });
  }
  async function upload() {
    setLoading(true);
    setError("");
    try {
      const data = await api<SeedResult>("/admin/students/seed", {
        method: "POST",
        body: JSON.stringify({ rows }),
      });
      setResult(data);
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }
  const visible = useMemo(
    () => result?.rows.filter((r) => !filter || r.outcome === filter) || [],
    [result, filter],
  );
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import students"
      max="max-w-5xl"
      footer={
        result ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button loading={loading} disabled={!rows.length} onClick={upload}>
              Upload {rows.length ? `${rows.length} rows` : "CSV"}
            </Button>
          </>
        )
      }
    >
      {!result && (
        <div className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center hover:border-brand-primary hover:bg-blue-50">
            <Upload className="mb-3 h-8 w-8 text-brand-primary" />
            <span className="font-semibold text-slate-900">
              Choose CSV file
            </span>
            <span className="mt-1 text-sm text-slate-500">
              Headers: enrollmentNumber, email, branchCode, admissionYear,
              passoutYear, currentSemester, section
            </span>
            <input
              className="hidden"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => read(e.target.files?.[0])}
            />
          </label>
          {fileName && (
            <p className="text-sm text-slate-600">
              Previewing <b>{fileName}</b> ({rows.length} rows)
            </p>
          )}
          {error && (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {rows.length > 0 ? (
            <Table>
              <thead>
                <tr>
                  {Object.keys(rows[0] || {})
                    .slice(0, 8)
                    .map((h) => (
                      <Th key={h}>{h}</Th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((r, i) => (
                  <tr key={i}>
                    {Object.keys(rows[0] || {})
                      .slice(0, 8)
                      .map((h) => (
                        <Td key={h}>{String(r[h] ?? "")}</Td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState
              title="No CSV selected"
              description="Preview appears here before upload."
            />
          )}
        </div>
      )}
      {result && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              ["Total", result.totalRows],
              ["Inserted", result.inserted],
              ["Updated", result.updated],
              ["Protected", result.skippedProtected],
              ["Invalid", result.invalidFormat],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  {k}
                </p>
                <p className="text-2xl font-black text-slate-950">{v}</p>
              </div>
            ))}
          </div>
          <Select
            label="Filter by outcome"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">All outcomes</option>
            <option value="inserted">Inserted</option>
            <option value="updated">Updated</option>
            <option value="skipped-protected">Skipped protected</option>
            <option value="invalid">Invalid</option>
          </Select>
          <Table>
            <thead>
              <tr>
                <Th>Row</Th>
                <Th>Enrollment</Th>
                <Th>Outcome</Th>
                <Th>Reason</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r, i) => (
                <tr key={i}>
                  <Td>{r.line ?? r.row ?? i + 2}</Td>
                  <Td>{r.enrollmentNumber || "—"}</Td>
                  <Td>
                    <Badge
                      tone={
                        r.outcome === "invalid"
                          ? "red"
                          : r.outcome === "skipped-protected"
                            ? "amber"
                            : "green"
                      }
                    >
                      {r.outcome}
                    </Badge>
                  </Td>
                  <Td className="whitespace-normal">{r.reason || "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </Modal>
  );
}
