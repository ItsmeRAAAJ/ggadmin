"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, post } from "@/lib/api";
import { StudentAccountError, useAuth } from "@/lib/auth";
import { useCountdown } from "@/lib/hooks";
import { Button, Card, Input } from "@/components/ui";

type Step = "lookup" | "otp" | "password";
export default function ActivatePage() {
  const router = useRouter();
  const { adoptToken } = useAuth();
  const [step, setStep] = useState<Step>("lookup");
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [masked, setMasked] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [wait, setWait] = useCountdown();
  const [done, setDone] = useState("");
  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const r = await post<{
        next: string;
        maskedEmail?: string;
        resendAvailableInSeconds?: number;
      }>("/auth/lookup", { identifier }, null);
      if (r.next === "PASSWORD") {
        setError("This account is already activated. Please sign in.");
      } else {
        setMasked(r.maskedEmail || "");
        setWait(r.resendAvailableInSeconds || 0);
        setStep("otp");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const r = await post<{ type: string; onboardingToken: string }>(
        "/auth/verify-otp",
        { identifier, otp, purpose: "FIRST_LOGIN" },
        null,
      );
      setToken(r.onboardingToken);
      setStep("password");
    } catch (e) {
      const err = e as ApiError;
      setError(
        `${err.message}${err.details && typeof err.details === "object" && "attemptsRemaining" in err.details ? ` (${String((err.details as { attemptsRemaining: unknown }).attemptsRemaining)} attempts left)` : ""}`,
      );
    } finally {
      setLoading(false);
    }
  }
  async function resend() {
    setLoading(true);
    setError("");
    try {
      const r = await post<{
        resendAvailableInSeconds: number;
        maskedEmail: string;
      }>("/auth/resend-otp", { identifier, purpose: "FIRST_LOGIN" }, null);
      setWait(r.resendAvailableInSeconds);
      setMasked(r.maskedEmail);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function onboard(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const r = await post<{ token: string; role: string }>(
        "/auth/onboard",
        { password },
        token,
      );
      const me = await adoptToken(r.token);
      router.replace(me.role === "TEACHER" ? "/teacher/dashboard" : "/admin");
    } catch (e) {
      if (e instanceof StudentAccountError) {
        setDone(
          "Your account is activated. Students sign in on the My GGITS mobile app.",
        );
        return;
      }
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <AuthCard
      title="First-time activation"
      subtitle="Activate a staff account created by an admin."
    >
      {!done && step === "lookup" && (
        <form onSubmit={lookup} className="space-y-4">
          <Input
            label="Staff email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
          <Button className="w-full" loading={loading}>
            Send OTP
          </Button>
        </form>
      )}
      {!done && step === "otp" && (
        <form onSubmit={verify} className="space-y-4">
          <p className="text-sm text-slate-600">
            Enter the 6-digit code sent to <b>{masked}</b>.
          </p>
          <Input
            label="OTP"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) =>
              setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
          />
          <Button className="w-full" loading={loading}>
            Verify code
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={wait > 0 || loading}
            onClick={resend}
          >
            {wait > 0 ? `Resend in ${wait}s` : "Resend OTP"}
          </Button>
        </form>
      )}
      {!done && step === "password" && (
        <form onSubmit={onboard} className="space-y-4">
          <Input
            label="New password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="At least 8 characters, uppercase, lowercase and number."
          />
          <Input
            label="Confirm password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <Button className="w-full" loading={loading}>
            Activate account
          </Button>
        </form>
      )}
      {done && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          {done}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <p className="mt-5 text-center text-sm">
        <Link className="font-semibold text-brand-primary" href="/">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}
function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md p-7">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-primary font-black text-white">
            G
          </div>
          <h1 className="text-2xl font-black">{title}</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        {children}
      </Card>
    </main>
  );
}
