"use client";
import { useMemo, useState } from "react";
import { ExternalLink, FileText, LinkIcon, Trash2 } from "lucide-react";
import { del, query } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { fmtDate } from "@/lib/format";
import { formatBytes, labelize, PEER_CATEGORIES, PEER_SCOPES } from "@/lib/academics";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  PageHeader,
  SearchBox,
  Select,
  SkeletonRows,
  Table,
  Td,
  Th,
  ToastHost,
} from "@/components/ui";

type PeerPost = {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  scope: string;
  scopeSemester?: number | null;
  scopeSection?: string | null;
  kind: "FILE" | "LINK";
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  fileType?: string | null;
  linkUrl?: string | null;
  subject?: { id: string; name: string; code: string } | null;
  createdAt: string;
  uploader: { name: string; branch: string; semester: number; avatarUrl?: string | null };
};
type PeerResponse = {
  items: PeerPost[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
};
type Branch = { id: string; shortCode: string; name?: string };
type ScopeSubject = { branch: Branch };

type Props = { mode: "admin" | "teacher" };

export default function PeerResourcesModeration({ mode }: Props) {
  const [filters, setFilters] = useState({
    q: "",
    category: "",
    scope: "",
    branchId: "",
    semester: "",
    page: 1,
    limit: 20,
  });
  const qs = useMemo(() => query(filters), [filters]);
  const { data, error, loading, reload } = useApi<PeerResponse>(
    `/admin/peer-resources${qs}`,
  );
  const { data: adminBranches } = useApi<Branch[]>(
    mode === "admin" ? "/admin/branches" : null,
  );
  const { data: teacherSubjects } = useApi<ScopeSubject[]>(
    mode === "teacher" ? "/teacher/scope-subjects" : null,
  );
  const branches = useMemo(() => {
    if (mode === "admin") return adminBranches || [];
    const map = new Map<string, Branch>();
    teacherSubjects?.forEach((s) => map.set(s.branch.id, s.branch));
    return [...map.values()].sort((a, b) => a.shortCode.localeCompare(b.shortCode));
  }, [adminBranches, mode, teacherSubjects]);
  const [remove, setRemove] = useState<PeerPost | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  function setFilter(next: Partial<typeof filters>) {
    setFilters((current) => ({ ...current, ...next, page: next.page ?? 1 }));
  }

  async function deletePost() {
    if (!remove) return;
    setDeleteLoading(true);
    try {
      await del(`/admin/peer-resources/${remove.id}`);
      setToast("Peer post removed");
      setRemove(null);
      void reload();
    } finally {
      setDeleteLoading(false);
    }
  }

  if (error) return <ErrorState error={error} onRetry={reload} />;

  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / filters.limit));

  return (
    <>
      <PageHeader
        title="Peer posts"
        description="Moderate student Share with Peers posts and remove unsafe or irrelevant content."
      />
      <Card className="mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          <SearchBox
            placeholder="Search title or description"
            value={filters.q}
            onChange={(e) => setFilter({ q: e.target.value })}
          />
          <Select
            value={filters.category}
            onChange={(e) => setFilter({ category: e.target.value })}
          >
            <option value="">All categories</option>
            {PEER_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {labelize(c)}
              </option>
            ))}
          </Select>
          <Select
            value={filters.scope}
            onChange={(e) => setFilter({ scope: e.target.value })}
          >
            <option value="">All scopes</option>
            {PEER_SCOPES.map((s) => (
              <option key={s} value={s}>
                {labelize(s)}
              </option>
            ))}
          </Select>
          <Select
            value={filters.branchId}
            onChange={(e) => setFilter({ branchId: e.target.value })}
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.shortCode}
              </option>
            ))}
          </Select>
          <Select
            value={filters.semester}
            onChange={(e) => setFilter({ semester: e.target.value })}
          >
            <option value="">All semesters</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <option key={s} value={s}>
                Semester {s}
              </option>
            ))}
          </Select>
        </div>
      </Card>
      <Table>
        <thead>
          <tr>
            <Th>Post</Th>
            <Th>Scope</Th>
            <Th>Uploader</Th>
            <Th>Subject</Th>
            <Th>File/link</Th>
            <Th>Created</Th>
            <Th>Action</Th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonRows cols={7} />
          ) : data?.items.length ? (
            data.items.map((p) => (
              <tr key={p.id}>
                <Td className="font-bold">
                  {p.title}
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge tone="cyan">{labelize(p.category)}</Badge>
                    <Badge>{labelize(p.kind)}</Badge>
                  </div>
                  {p.description && (
                    <div className="mt-1 max-w-xs truncate text-xs font-normal text-slate-500">
                      {p.description}
                    </div>
                  )}
                </Td>
                <Td>
                  <Badge tone="blue">{labelize(p.scope)}</Badge>
                  <div className="mt-1 text-xs text-slate-500">
                    {scopeDetails(p)}
                  </div>
                </Td>
                <Td>
                  <div className="font-semibold text-slate-900">{p.uploader.name}</div>
                  <div className="text-xs text-slate-500">
                    {p.uploader.branch} · Sem {p.uploader.semester}
                  </div>
                </Td>
                <Td>{p.subject ? `${p.subject.code} · ${p.subject.name}` : "—"}</Td>
                <Td>
                  <ResourceLink post={p} />
                </Td>
                <Td>{fmtDate(p.createdAt)}</Td>
                <Td>
                  <Button size="sm" variant="danger" onClick={() => setRemove(p)}>
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                </Td>
              </tr>
            ))
          ) : (
            <tr>
              <Td colSpan={7}>
                <EmptyState title="No peer posts" description="Posts matching the filters will appear here." />
              </Td>
            </tr>
          )}
        </tbody>
      </Table>
      <div className="flex items-center justify-between gap-3 py-4 text-sm text-slate-600">
        <span>
          Page {filters.page} of {totalPages} · {data?.total ?? 0} posts
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page <= 1}
            onClick={() => setFilter({ page: filters.page - 1 })}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!data?.hasMore}
            onClick={() => setFilter({ page: filters.page + 1 })}
          >
            Next
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={!!remove}
        danger
        title="Delete peer post"
        message={`Remove "${remove?.title || "this post"}" from Share with Peers?`}
        confirmText="Delete post"
        loading={deleteLoading}
        onClose={() => setRemove(null)}
        onConfirm={deletePost}
      />
      <ToastHost message={toast} onClose={() => setToast(null)} />
    </>
  );
}

function scopeDetails(post: PeerPost) {
  if (post.scope === "CLASS") {
    return `Sem ${post.scopeSemester ?? "—"}${post.scopeSection ? ` · Section ${post.scopeSection}` : ""}`;
  }
  if (post.scope === "SEMESTER") return `Semester ${post.scopeSemester ?? "—"}`;
  return "Entire branch";
}

function ResourceLink({ post }: { post: PeerPost }) {
  if (post.kind === "LINK" && post.linkUrl) {
    return (
      <a className="inline-flex items-center gap-2 font-semibold text-brand-primary" href={post.linkUrl} target="_blank" rel="noopener noreferrer">
        <LinkIcon className="h-4 w-4" /> Open link
      </a>
    );
  }
  if (post.fileUrl) {
    return (
      <a className="inline-flex items-center gap-2 font-semibold text-brand-primary" href={post.fileUrl} target="_blank" rel="noopener noreferrer">
        <FileText className="h-4 w-4" />
        <span>
          {post.fileName || "Open file"}
          {post.fileSize ? <span className="block text-xs font-normal text-slate-500">{formatBytes(post.fileSize)}</span> : null}
        </span>
        <ExternalLink className="h-3 w-3" />
      </a>
    );
  }
  return "—";
}
