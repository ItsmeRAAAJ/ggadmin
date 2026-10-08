import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiError, authApi, setSessionToken, setUnauthorizedHandler, tokenStore } from "@/lib/api";

type Status = "loading" | "signedOut" | "signedIn";

type AuthContextValue = {
  status: Status;
  /** Persist a freshly issued session token (login, onboarding, reset, password change). */
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Set when the session was ended by the server (expired / revoked) so the login screen can explain why. */
  sessionEndedReason: string | null;
  clearSessionEndedReason: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [sessionEndedReason, setSessionEndedReason] = useState<string | null>(null);
  const signingOut = useRef(false);

  const clearLocal = useCallback(async () => {
    setSessionToken(null);
    try {
      await tokenStore.clear();
    } catch {
      // Secure store failures shouldn't block sign-out.
    }
  }, []);

  const signOut = useCallback(async () => {
    await clearLocal();
    setStatus("signedOut");
  }, [clearLocal]);

  const signIn = useCallback(async (token: string) => {
    setSessionToken(token);
    await tokenStore.set(token);
    setSessionEndedReason(null);
    setStatus("signedIn");
  }, []);

  // Server says the token is no longer valid → drop the session once.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (signingOut.current) return;
      signingOut.current = true;
      setSessionEndedReason("Your session has ended. Please sign in again.");
      void clearLocal().finally(() => {
        setStatus("signedOut");
        signingOut.current = false;
      });
    });
    return () => setUnauthorizedHandler(null);
  }, [clearLocal]);

  // Restore the session on launch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let token: string | null = null;
      try {
        token = await tokenStore.get();
      } catch {
        token = null;
      }
      if (!token) {
        if (!cancelled) setStatus("signedOut");
        return;
      }
      setSessionToken(token);
      try {
        const me = await authApi.me();
        if (cancelled) return;
        if (me.role !== "STUDENT") {
          await clearLocal();
          setStatus("signedOut");
          return;
        }
        setStatus("signedIn");
      } catch (e) {
        if (cancelled) return;
        // Offline or server hiccup: keep the user signed in; screens show retry states.
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          await clearLocal();
          setStatus("signedOut");
        } else {
          setStatus("signedIn");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clearLocal]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      signIn,
      signOut,
      sessionEndedReason,
      clearSessionEndedReason: () => setSessionEndedReason(null),
    }),
    [status, signIn, signOut, sessionEndedReason]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
