"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { post } from "@/lib/api";
import { StudentAccountError, useAuth } from "@/lib/auth";
import { useCountdown } from "@/lib/hooks";
import { Button, Card, Input } from "@/components/ui";

type Step = "request" | "otp" | "password";
export default function ForgotPage() {
  const router = useRouter();
  const { adoptToken } = useAuth();
  const [step, setStep] = useState<Step>("request");
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [masked, setMasked] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [wait, setWait] = useCountdown();
  const [done, setDone] = useState("");
  async function request(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const r = await post<{
        maskedEmail: string;
        resendAvailableInSeconds: number;
      }>("/auth/request-password-reset", { identifier }, null);
      setMasked(r.maskedEmail);
      setWait(r.resendAvailableInSeconds);
      setStep("otp");
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
      const r = await post<{ resetToken: string }>(
        "/auth/verify-otp",
        { identifier, otp, purpose: "PASSWORD_RESET" },
        null,
      );
      setResetToken(r.resetToken);
      setStep("password");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function resend() {
    setLoading(true);
    setError("");
    try {
      const r = await post<{
        maskedEmail: string;
        resendAvailableInSeconds: number;
      }>("/auth/resend-otp", { identifier, purpose: "PASSWORD_RESET" }, null);
      setMasked(r.maskedEmail);
      setWait(r.resendAvailableInSeconds);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function reset(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const r = await post<{ token: string; role: string }>(
        "/auth/reset-password",
        { password },
        resetToken,
      );
      const me = await adoptToken(r.token);
      router.replace(me.role === "TEACHER" ? "/teacher/dashboard" : "/admin");
    } catch (e) {
      if (e instanceof StudentAccountError) {
        setDone(
          "Your password has been reset. Students sign in on the My GGITS mobile app.",
        );
        return;
      }
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md p-7">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-primary font-black text-white">
            G
          </div>
          <h1 className="text-2xl font-black">Reset password</h1>
          <p className="text-sm text-slate-500">
            Verify your email with an OTP.
          </p>
        </div>
        {!done && step === "request" && (
          <form onSubmit={request} className="space-y-4">
            <Input
              label="Email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
            <Button className="w-full" loading={loading}>
              Send reset code
            </Button>
          </form>
        )}
        {!done && step === "otp" && (
          <form onSubmit={verify} className="space-y-4">
            <p className="text-sm text-slate-600">
              Code sent to <b>{masked}</b>.
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
          <form onSubmit={reset} className="space-y-4">
            <Input
              label="New password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Input
              label="Confirm password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <Button className="w-full" loading={loading}>
              Reset password
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
      </Card>
    </main>
  );
}
