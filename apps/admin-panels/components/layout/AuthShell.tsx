"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileText,
  FolderOpen,
  GitBranch,
  GraduationCap,
  KeyRound,
  Layers,
  LogOut,
  Menu,
  Share2,
  Shield,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button, Modal, Input, ToastHost } from "@/components/ui";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  superOnly?: boolean;
  role?: "ADMIN" | "TEACHER";
  show?: boolean;
  section?: string;
};

const adminNav: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: BarChart3, role: "ADMIN" },
  {
    href: "/admin/students",
    label: "Students",
    icon: Users,
    permission: "VIEW_STUDENTS",
    role: "ADMIN",
  },
  {
    href: "/admin/branches",
    label: "Branches",
    icon: GitBranch,
    permission: "MANAGE_ACADEMIC_STRUCTURE",
    role: "ADMIN",
  },
  {
    href: "/admin/subjects",
    label: "Subjects",
    icon: BookOpen,
    permission: "MANAGE_ACADEMIC_STRUCTURE",
    role: "ADMIN",
  },
  {
    href: "/admin/teacher-assignments",
    label: "Teacher assignments",
    icon: Layers,
    permission: "MANAGE_TEACHER_ASSIGNMENTS",
    role: "ADMIN",
  },
  {
    href: "/admin/teachers",
    label: "Teachers",
    icon: GraduationCap,
    permission: "MANAGE_TEACHERS",
    role: "ADMIN",
  },
  { href: "/admin/admins", label: "Admins", icon: Shield, role: "ADMIN" },
  {
    href: "/admin/permissions",
    label: "Permissions",
    icon: KeyRound,
    permission: "MANAGE_ADMIN_ROLES",
    role: "ADMIN",
  },
  {
    href: "/admin/admin-roles",
    label: "Admin roles",
    icon: UserCog,
    superOnly: true,
    role: "ADMIN",
  },
  {
    href: "/admin/audit-logs",
    label: "Audit logs",
    icon: FileText,
    permission: "VIEW_AUDIT_LOGS",
    role: "ADMIN",
  },
  {
    href: "/admin/peer-resources",
    label: "Peer posts",
    icon: Share2,
    permission: "MODERATE_PEER_RESOURCES",
    role: "ADMIN",
    section: "Moderation",
  },
];
const teacherNav: NavItem[] = [
  {
    href: "/teacher/dashboard",
    label: "Dashboard",
    icon: BarChart3,
    role: "TEACHER",
  },
  {
    href: "/teacher/subjects",
    label: "My subjects",
    icon: BookOpen,
    role: "TEACHER",
  },
  {
    href: "/teacher/assignments",
    label: "Assignments",
    icon: ClipboardList,
    role: "TEACHER",
    section: "Academics",
  },
  {
    href: "/teacher/deadlines",
    label: "Deadlines",
    icon: CalendarDays,
    role: "TEACHER",
    section: "Academics",
  },
  {
    href: "/teacher/resources",
    label: "Resources",
    icon: FolderOpen,
    role: "TEACHER",
    section: "Academics",
  },
  {
    href: "/teacher/peer-resources",
    label: "Peer posts",
    icon: Share2,
    permission: "MODERATE_PEER_RESOURCES",
    role: "TEACHER",
    section: "Moderation",
  },
  {
    href: "/teacher/hierarchy",
    label: "Hierarchy",
    icon: Users,
    role: "TEACHER",
  },
];

export function AuthShell({
  children,
  role,
}: {
  children: React.ReactNode;
  role: "ADMIN" | "TEACHER";
}) {
  const {
    identity,
    isLoading,
    logout,
    logoutAll,
    changePassword,
    hasPermission,
  } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!identity) {
      router.replace("/");
      return;
    }
    if (role === "ADMIN" && identity.role !== "ADMIN")
      router.replace("/teacher/dashboard");
    if (role === "TEACHER" && identity.role !== "TEACHER")
      router.replace("/admin");
  }, [identity, isLoading, role, router]);

  const items = useMemo(
    () =>
      (role === "ADMIN" ? adminNav : teacherNav).filter((item) => {
        if (item.superOnly && !identity?.isSuperAdmin) return false;
        if (item.permission && !hasPermission(item.permission)) return false;
        return item.show !== false;
      }),
    [role, identity?.isSuperAdmin, hasPermission],
  );

  if (isLoading || !identity || identity.role !== role)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
      </div>
    );

  const name = role === "ADMIN" ? identity.admin?.name : identity.teacher?.name;
  const subtitle =
    role === "ADMIN"
      ? (identity.admin?.roles || []).map((r) => r.label).join(", ") ||
        "Administrator"
      : identity.teacher?.tier?.replaceAll("_", " ") || "Teacher";

  const nav = (
    <nav className="space-y-1 px-3 py-4">
      {items.map(({ href, label, icon: Icon, section }, index) => {
        const active =
          pathname === href || (href !== "/admin" && pathname.startsWith(href));
        const showSection =
          section && items.findIndex((item) => item.section === section) === index;
        return (
          <div key={href}>
            {showSection && (
              <p className="px-3 pb-1 pt-4 text-[11px] font-black uppercase tracking-wider text-slate-400">
                {section}
              </p>
            )}
            <Link
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                active
                  ? "bg-blue-50 text-brand-primary-dark"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <Brand role={role} />
        {nav}
        <div className="mt-auto border-t border-slate-100 p-4">
          <UserBlock name={name} subtitle={subtitle} />
          <div className="mt-3 grid gap-2">
            <Button variant="outline" size="sm" onClick={() => setPwOpen(true)}>
              Change password
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await logout();
                router.replace("/");
              }}
            >
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-8">
          <button
            className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <p className="text-sm font-bold text-slate-900">My GGITS</p>
            <p className="text-xs text-slate-500">
              {role === "ADMIN" ? "Admin Panel" : "Teacher Panel"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-right text-sm sm:block">
              <span className="block font-semibold text-slate-900">{name}</span>
              <span className="text-xs text-slate-500">{identity.email}</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await logout();
                router.replace("/");
              }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="p-4 lg:p-8">{children}</main>
      </div>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/40 lg:hidden"
          onClick={() => setOpen(false)}
        >
          <div
            className="h-full w-80 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <Brand role={role} />
              <button
                className="mr-3 rounded-xl p-2"
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
          </div>
        </div>
      )}
      <PasswordModal
        key={pwOpen ? "open" : "closed"}
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        onDone={(m) => {
          setToast(m);
          setPwOpen(false);
        }}
        changePassword={changePassword}
        logoutAll={logoutAll}
      />
      <ToastHost message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
function Brand({ role }: { role: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-primary text-xl font-black text-white shadow-sm">
        G
      </div>
      <div>
        <p className="font-black text-slate-950">My GGITS</p>
        <p className="text-xs font-medium text-slate-500">
          {role === "ADMIN" ? "Admin Panel" : "Teacher Panel"}
        </p>
      </div>
    </div>
  );
}
function UserBlock({
  name,
  subtitle,
}: {
  name?: string | null;
  subtitle: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="truncate text-sm font-bold text-slate-900">
        {name || "User"}
      </p>
      <p className="truncate text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}
function PasswordModal({
  open,
  onClose,
  onDone,
  changePassword,
  logoutAll,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (m: string) => void;
  changePassword: (c: string, n: string) => Promise<void>;
  logoutAll: () => Promise<void>;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit() {
    if (next !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      onDone("Password changed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Password change failed");
    } finally {
      setLoading(false);
    }
  }
  return (
    <Modal
      open={open}
      title="Account security"
      onClose={onClose}
      footer={
        <>
          <Button
            variant="outline"
            onClick={async () => {
              await logoutAll();
            }}
          >
            Sign out of all devices
          </Button>
          <Button loading={loading} onClick={submit}>
            Save password
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Current password"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <Input
          label="New password"
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          hint="At least 8 chars with uppercase, lowercase and a number."
        />
        <Input
          label="Confirm new password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
