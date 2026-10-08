"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Card, Input, Select } from "@/components/ui";

type Category = { key: string; label: string };
export default function LoginPage() {
  const { login, identity, isLoading } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [cat, setCat] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [catLoading, setCatLoading] = useState(true);
  useEffect(() => {
    api<Category[]>("/auth/login-categories", { token: null })
      .then(setCategories)
      .catch(() =>
        setError(
          "Couldn’t load role categories. Check the backend connection.",
        ),
      )
      .finally(() => setCatLoading(false));
  }, []);
  useEffect(() => {
    if (!isLoading && identity)
      router.replace(
        identity.role === "TEACHER" ? "/teacher/dashboard" : "/admin",
      );
  }, [identity, isLoading, router]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cat) {
      setError("Please select your role.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const me = await login(identifier, password, cat);
      router.replace(me.role === "TEACHER" ? "/teacher/dashboard" : "/admin");
    } catch (e) {
      const err = e as ApiError;
      setError(
        err.code === "ROLE_MISMATCH"
          ? "That doesn’t match the role you selected"
          : err.code === "ACCOUNT_NOT_ACTIVATED"
            ? "Your account isn’t activated yet. Use first-time activation."
            : err.message,
      );
    } finally {
      setLoading(false);
    }
  }
  if (isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
      </div>
    );
  return (
    <AuthFrame title="Sign in" subtitle="Use your My GGITS staff account.">
      <form onSubmit={submit} className="space-y-4">
        <Select
          label="Role category"
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          disabled={catLoading}
        >
          <option value="">Please select your role</option>
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </Select>
        <Input
          label="Email"
          type="email"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="admin@ggits.org"
          required
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <Button className="w-full" loading={loading} type="submit">
          Sign in
        </Button>
        <div className="flex justify-between text-sm">
          <Link
            className="font-semibold text-brand-primary hover:underline"
            href="/activate"
          >
            First-time activation
          </Link>
          <Link
            className="font-semibold text-brand-primary hover:underline"
            href="/forgot-password"
          >
            Forgot password?
          </Link>
        </div>
      </form>
    </AuthFrame>
  );
}
function AuthFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#dbeafe,transparent_35%),#f8fafc] p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-80 w-80 items-center justify-center rounded-3xl text-3xl font-black text-white shadow-lg">
            <Image
              src="/logo_withgg.png"
              alt="My GGITS logo"
              width={264}
              height={264}
              className="h-full w-full object-contain"
              priority
            />
          </div>
          <p className="mt-1 text-sm text-slate-500">Admin + Teacher Panel</p>
        </div>
        <Card className="p-7">
          <h2 className="text-xl font-bold text-slate-950">{title}</h2>
          <p className="mb-6 mt-1 text-sm text-slate-500">{subtitle}</p>
          {children}
        </Card>
      </div>
    </main>
  );
}
