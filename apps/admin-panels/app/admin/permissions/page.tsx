"use client";
import { useState } from "react";
import { patch, post } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  Select,
  SkeletonRows,
  Table,
  Td,
  Th,
  ToastHost,
} from "@/components/ui";

type Permission = {
  id: string;
  key: string;
  label: string;
  description?: string | null;
  category: string;
  _count?: { adminGrants: number; teacherGrants: number };
};
const CATEGORY_LABELS: Record<string, string> = {
  ADMIN_MANAGEMENT: "Admin management",
  STUDENT_DATA_FIELD: "Student data fields",
  TEACHER_CAPABILITY: "Teacher capability",
  ASSESSMENT_AND_MARKS: "Student marks",
};

function categoryLabel(category: string) {
  return CATEGORY_LABELS[category] || category.replaceAll("_", " ");
}

export default function PermissionsPage() {
  const { data, error, loading, reload } =
    useApi<Permission[]>("/admin/permissions");
  const [open, setOpen] = useState<Permission | null | "new">(null);
  const [toast, setToast] = useState<string | null>(null);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  return (
    <>
      <PageHeader
        title="Permissions"
        description="Master permission list. Adding a permission here has no effect until a developer wires the backend check."
        actions={<Button onClick={() => setOpen("new")}>Add permission</Button>}
      />
      <Card className="mb-4 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        New permission keys are metadata only until code uses them in backend
        authorization.
      </Card>
      <Table>
        <thead>
          <tr>
            <Th>Key</Th>
            <Th>Label</Th>
            <Th>Category</Th>
            <Th>Grants</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonRows cols={5} />
          ) : data?.length ? (
            data.map((p) => (
              <tr key={p.id}>
                <Td className="font-mono text-xs font-bold">{p.key}</Td>
                <Td>
                  {p.label}
                  <div className="text-xs text-slate-500">
                    {p.description || "—"}
                  </div>
                </Td>
                <Td>
                  <Badge>{categoryLabel(p.category)}</Badge>
                </Td>
                <Td>
                  {(p._count?.adminGrants ?? 0) +
                    (p._count?.teacherGrants ?? 0)}
                </Td>
                <Td>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setOpen(p)}
                  >
                    Edit
                  </Button>
                </Td>
              </tr>
            ))
          ) : (
            <tr>
              <Td colSpan={5}>
                <EmptyState title="No permissions" />
              </Td>
            </tr>
          )}
        </tbody>
      </Table>
      <PermissionModal
        key={open === "new" ? "new" : (open?.id ?? "closed")}
        open={!!open}
        permission={open === "new" ? null : open}
        onClose={() => setOpen(null)}
        onDone={() => {
          setOpen(null);
          void reload();
          setToast("Permission saved");
        }}
      />
      <ToastHost message={toast} onClose={() => setToast(null)} />
    </>
  );
}
function PermissionModal({
  open,
  onClose,
  onDone,
  permission,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  permission: Permission | null;
}) {
  const [f, setF] = useState({
    key: permission?.key || "",
    label: permission?.label || "",
    description: permission?.description || "",
    category: permission?.category || "ADMIN_MANAGEMENT",
  });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  async function save() {
    setLoading(true);
    setErr("");
    try {
      if (permission)
        await patch(`/admin/permissions/${permission.id}`, {
          label: f.label,
          description: f.description || null,
        });
      else await post("/admin/permissions", f);
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Modal
      open={open}
      title={permission ? "Edit permission" : "Add permission"}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={loading} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Key"
          disabled={!!permission}
          value={f.key}
          onChange={(e) => setF({ ...f, key: e.target.value.toUpperCase() })}
        />
        <Input
          label="Label"
          value={f.label}
          onChange={(e) => setF({ ...f, label: e.target.value })}
        />
        <Input
          label="Description"
          value={f.description}
          onChange={(e) => setF({ ...f, description: e.target.value })}
        />
        <Select
          label="Category"
          disabled={!!permission}
          value={f.category}
          onChange={(e) => setF({ ...f, category: e.target.value })}
        >
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        {err && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>
        )}
      </div>
    </Modal>
  );
}
