import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiError, profileApi } from "@/lib/api";
import type { StudentProfile } from "@/lib/types";

type ProfileContextValue = {
  profile: StudentProfile | undefined;
  error: ApiError | null;
  loading: boolean;
  refreshing: boolean;
  /** Pull-to-refresh (shows spinner). */
  refresh: () => Promise<void>;
  /** Background refresh after a mutation (always refetches). */
  revalidate: () => Promise<void>;
  /** Background refresh on screen focus (skipped if data is fresh or a request is running). */
  revalidateIfStale: () => Promise<void>;
  reload: () => Promise<void>;
};

const FOCUS_REVALIDATE_MS = 5_000;

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<StudentProfile | undefined>(undefined);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const reqId = useRef(0);
  const hasData = useRef(false);
  const inFlight = useRef(false);
  const lastFetchedAt = useRef(0);

  const load = useCallback(async (mode: "initial" | "refresh" | "silent" | "focus") => {
    if (mode === "focus") {
      if (inFlight.current || Date.now() - lastFetchedAt.current < FOCUS_REVALIDATE_MS) return;
      mode = "silent";
    }
    const id = ++reqId.current;
    inFlight.current = true;
    if (mode === "initial") {
      setLoading(!hasData.current);
      setError(null);
    }
    if (mode === "refresh") setRefreshing(true);
    try {
      const data = await profileApi.get();
      if (id !== reqId.current) return;
      hasData.current = true;
      lastFetchedAt.current = Date.now();
      setProfile(data);
      setError(null);
    } catch (e) {
      if (id !== reqId.current) return;
      if (!(mode === "silent" && hasData.current)) {
        setError(e instanceof ApiError ? e : new ApiError(0, "UNKNOWN", "Something went wrong. Please try again."));
      }
    } finally {
      if (id === reqId.current) {
        inFlight.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load("initial");
  }, [load]);

  // Stable identities: screens use these in focus-effect deps, so recreating them per render
  // would refetch on every profile update (an infinite request loop).
  const refresh = useCallback(() => load("refresh"), [load]);
  const revalidate = useCallback(() => load("silent"), [load]);
  const revalidateIfStale = useCallback(() => load("focus"), [load]);
  const reload = useCallback(() => load("initial"), [load]);

  const value = useMemo<ProfileContextValue>(
    () => ({ profile, error, loading, refreshing, refresh, revalidate, revalidateIfStale, reload }),
    [profile, error, loading, refreshing, refresh, revalidate, revalidateIfStale, reload]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used inside ProfileProvider");
  return ctx;
}
