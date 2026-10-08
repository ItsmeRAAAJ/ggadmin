"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, getStoredToken, post, setStoredToken } from "./api";

export type Role = "ADMIN" | "TEACHER" | "STUDENT" | string;
export type Identity = {
  id: string;
  email: string;
  role: Role;
  isSuperAdmin?: boolean;
  permissions: string[];
  admin?: {
    profileId: string;
    name: string;
    roles?: { key: string; label: string }[];
  } | null;
  teacher?: {
    profileId: string;
    name: string;
    tier?: string;
    primaryBranchId?: string | null;
  } | null;
  studentProfileId?: string | null;
};

type LoginResult = { success: true; token: string; role: string };
type AuthContextType = {
  identity: Identity | null;
  token: string | null;
  isLoading: boolean;
  login: (
    identifier: string,
    password: string,
    expectedCategory: string,
  ) => Promise<Identity>;
  refresh: () => Promise<Identity | null>;
  adoptToken: (token: string) => Promise<Identity>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<void>;
  hasPermission: (key: string) => boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

const PANEL_ROLES = new Set(["ADMIN", "TEACHER"]);

/** Students have a token-valid account but must use the mobile app. */
export class StudentAccountError extends Error {
  constructor() {
    super("Students sign in on the My GGITS mobile app, not the staff panel.");
    this.name = "StudentAccountError";
  }
}

async function fetchIdentity(token: string): Promise<Identity> {
  const me = await api<Identity>("/auth/me", { token });
  if (!PANEL_ROLES.has(me.role)) throw new StudentAccountError();
  return me;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    setStoredToken(null);
    setToken(null);
    setIdentity(null);
  }, []);

  const refresh = useCallback(async () => {
    const saved = getStoredToken();
    if (!saved) {
      setToken(null);
      setIdentity(null);
      return null;
    }
    try {
      const me = await fetchIdentity(saved);
      setToken(saved);
      setIdentity(me);
      return me;
    } catch {
      clearSession();
      return null;
    }
  }, [clearSession]);

  useEffect(() => {
    let active = true;
    const saved = getStoredToken();
    (saved ? fetchIdentity(saved) : Promise.resolve(null))
      .then((me) => {
        if (!active) return;
        setToken(me ? saved : null);
        setIdentity(me);
      })
      .catch(() => {
        if (active) clearSession();
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    const onCleared = () => {
      setIdentity(null);
      setToken(null);
    };
    window.addEventListener("mg-auth-cleared", onCleared);
    return () => {
      active = false;
      window.removeEventListener("mg-auth-cleared", onCleared);
    };
  }, [clearSession]);

  /** Stores a freshly issued session token and loads the identity for it. */
  const adoptToken = useCallback(
    async (newToken: string) => {
      try {
        const me = await fetchIdentity(newToken);
        setStoredToken(newToken);
        setToken(newToken);
        setIdentity(me);
        return me;
      } catch (e) {
        clearSession();
        throw e;
      }
    },
    [clearSession],
  );

  const login = useCallback(
    async (identifier: string, password: string, expectedCategory: string) => {
      const res = await post<LoginResult>(
        "/auth/login",
        { identifier, password, expectedCategory },
        null,
      );
      return adoptToken(res.token);
    },
    [adoptToken],
  );

  const logout = useCallback(async () => {
    try {
      await post("/auth/logout");
    } catch {
      // Tokens are stateless; dropping it locally is what matters.
    }
    clearSession();
  }, [clearSession]);

  const logoutAll = useCallback(async () => {
    await post("/auth/logout-all");
    clearSession();
  }, [clearSession]);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const res = await post<{ success: true; token: string }>(
        "/auth/change-password",
        { currentPassword, newPassword },
      );
      await adoptToken(res.token);
    },
    [adoptToken],
  );

  const hasPermission = useCallback(
    (key: string) =>
      Boolean(identity?.isSuperAdmin || identity?.permissions?.includes(key)),
    [identity],
  );

  const value = useMemo(
    () => ({
      identity,
      token,
      isLoading,
      login,
      refresh,
      adoptToken,
      logout,
      logoutAll,
      changePassword,
      hasPermission,
    }),
    [
      identity,
      token,
      isLoading,
      login,
      refresh,
      adoptToken,
      logout,
      logoutAll,
      changePassword,
      hasPermission,
    ],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
