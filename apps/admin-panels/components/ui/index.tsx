"use client";
import {
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
  Search,
} from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin", className)} />;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?:
    "primary" | "secondary" | "ghost" | "danger" | "outline" | "success";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}) {
  const variants = {
    primary:
      "bg-brand-primary text-white hover:bg-brand-primary-dark shadow-sm",
    secondary: "bg-slate-900 text-white hover:bg-slate-800 shadow-sm",
    success:
      "bg-brand-success text-white hover:bg-brand-success-dark shadow-sm",
    danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
    outline:
      "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    ghost: "text-slate-600 hover:bg-slate-100",
  };
  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-5 text-base",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
      disabled={props.disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function Input({
  label,
  error,
  hint,
  className,
  containerClassName,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
}) {
  return (
    <label className={cn("block", containerClassName)}>
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
        </span>
      )}
      <input
        className={cn(
          "h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-primary focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500",
          error && "border-red-400 focus:border-red-500 focus:ring-red-100",
          className,
        )}
        {...props}
      />
      {hint && !error && (
        <span className="mt-1 block text-xs text-slate-500">{hint}</span>
      )}
      {error && (
        <span className="mt-1 block text-xs font-medium text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}
export function Textarea({
  label,
  error,
  hint,
  className,
  containerClassName,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  containerClassName?: string;
  error?: string;
  hint?: string;
}) {
  return (
    <label className={cn("block", containerClassName)}>
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
        </span>
      )}
      <textarea
        className={cn(
          "min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-primary focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500",
          error && "border-red-400 focus:border-red-500 focus:ring-red-100",
          className,
        )}
        {...props}
      />
      {hint && !error && (
        <span className="mt-1 block text-xs text-slate-500">{hint}</span>
      )}
      {error && (
        <span className="mt-1 block text-xs font-medium text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}
export function Select({
  label,
  error,
  children,
  className,
  containerClassName,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  containerClassName?: string;
  error?: string;
}) {
  return (
    <label className={cn("block", containerClassName)}>
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
        </span>
      )}
      <select
        className={cn(
          "h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-brand-primary focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500",
          error && "border-red-400 focus:border-red-500 focus:ring-red-100",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error && (
        <span className="mt-1 block text-xs font-medium text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}
export function Checkbox({
  label,
  hint,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
}) {
  return (
    <label className={cn("flex items-start gap-3 text-sm", className)}>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
        {...props}
      />
      <span>
        <span className="font-medium text-slate-800">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}
export function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 rounded-full transition disabled:opacity-50",
        checked ? "bg-brand-primary" : "bg-slate-300",
      )}
    >
      <span
        className={cn(
          "absolute top-1 h-4 w-4 rounded-full bg-white transition",
          checked ? "left-6" : "left-1",
        )}
      />
    </button>
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}
export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
export function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "blue" | "green" | "amber" | "red" | "slate" | "cyan";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    cyan: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
export function statusTone(
  status?: string | null,
): "blue" | "green" | "amber" | "red" | "slate" | "cyan" {
  const s = (status || "").toUpperCase();
  if (["ACTIVE", "PUBLISHED", "OPEN", "GRADED", "SUBMITTED"].includes(s))
    return "green";
  if (
    [
      "PENDING_ACTIVATION",
      "DRAFT",
      "UPCOMING",
      "PENDING",
      "IN_PROGRESS",
    ].includes(s)
  )
    return "amber";
  if (["DISABLED", "CLOSED", "ENDED", "LATE"].includes(s)) return "red";
  return "slate";
}
export function StatusBadge({ status }: { status?: string | null }) {
  return (
    <Badge tone={statusTone(status)}>
      {(status || "—").replaceAll("_", " ")}
    </Badge>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <div className="mt-2 text-3xl font-bold text-slate-950">{value}</div>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
        {icon && (
          <div className="rounded-2xl bg-blue-50 p-3 text-brand-primary">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          {children}
        </table>
      </div>
    </div>
  );
}
export function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}
export function Td({
  children,
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & {
  children: React.ReactNode;
}) {
  return (
    <td
      className={cn("whitespace-nowrap px-4 py-3 text-slate-700", className)}
      {...props}
    >
      {children}
    </td>
  );
}
export function SkeletonRows({
  rows = 5,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((__, j) => (
            <Td key={j}>
              <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
            </Td>
          ))}
        </tr>
      ))}
    </>
  );
}
export function EmptyState({
  title = "Nothing here yet",
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <Info className="mx-auto h-8 w-8 text-slate-400" />
      <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
      {description && (
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const msg = error instanceof Error ? error.message : "Something went wrong";
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5" />
        <div>
          <p className="font-semibold">Couldn’t load this screen</p>
          <p className="mt-1 text-sm">{msg}</p>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={onRetry}
            >
              Retry
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Modal({
  open,
  title,
  children,
  onClose,
  footer,
  max = "max-w-xl",
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  max?: string;
}) {
  const titleId = useId();
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "max-h-[90vh] w-full overflow-hidden rounded-2xl bg-white shadow-2xl",
          max,
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id={titleId} className="font-bold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Confirm",
  danger,
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      max="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{message}</p>
    </Modal>
  );
}

export function ToastHost({
  message,
  type = "success",
  onClose,
}: {
  message: string | null;
  type?: "success" | "error";
  onClose?: () => void;
}) {
  if (!message) return null;
  return (
    <div
      className={cn(
        "fixed right-4 top-4 z-[60] flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-xl",
        type === "success"
          ? "bg-emerald-600 text-white"
          : "bg-red-600 text-white",
      )}
    >
      <CheckCircle2 className="h-5 w-5" />
      {message}
      <button onClick={onClose} className="ml-2 opacity-80 hover:opacity-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
export function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-4 text-sm text-slate-600">
      <span>
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
export function SearchBox(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
      <input
        className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-primary focus:ring-4 focus:ring-blue-100"
        {...props}
      />
    </div>
  );
}
