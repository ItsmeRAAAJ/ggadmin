"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "./api";

type ApiState<T> = {
  path: string | null;
  data: T | null;
  error: ApiError | Error | null;
};

/**
 * Fetches `path` whenever it changes (pass null to skip).
 * - `loading` is true only until the current path has loaded, so `reload()`
 *   after a mutation refreshes in place instead of flashing a skeleton.
 * - Responses for a superseded path are ignored (no stale data on fast filter changes).
 */
export function useApi<T>(path: string | null) {
  const [state, setState] = useState<ApiState<T>>({
    path: null,
    data: null,
    error: null,
  });
  const latestPath = useRef(path);
  useEffect(() => {
    latestPath.current = path;
  }, [path]);

  const fetchPath = useCallback(async (p: string) => {
    try {
      const data = await api<T>(p);
      if (latestPath.current === p) setState({ path: p, data, error: null });
    } catch (e) {
      if (latestPath.current === p)
        setState((s) => ({
          path: p,
          data: s.path === p ? s.data : null,
          error: e as Error,
        }));
    }
  }, []);

  useEffect(() => {
    if (path) void fetchPath(path);
  }, [path, fetchPath]);

  const reload = useCallback(
    () => (path ? fetchPath(path) : Promise.resolve()),
    [path, fetchPath],
  );
  const setData = useCallback(
    (next: T | null | ((prev: T | null) => T | null)) =>
      setState((s) => ({
        ...s,
        data:
          typeof next === "function"
            ? (next as (prev: T | null) => T | null)(s.data)
            : next,
      })),
    [],
  );

  return {
    data: state.data,
    setData,
    error: state.path === path ? state.error : null,
    loading: Boolean(path) && state.path !== path,
    reload,
  };
}

/** Seconds-remaining countdown for OTP resend buttons. */
export function useCountdown() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [seconds]);
  return [seconds, setSeconds] as const;
}

type TeacherSubjectRow = {
  subject: { id: string; code: string; name: string };
};

/** Subjects the signed-in teacher is assigned to, de-duplicated across sections/years. */
export function useMySubjects() {
  const { data, error, loading } =
    useApi<TeacherSubjectRow[]>("/teacher/subjects");
  const subjects = data
    ? [...new Map(data.map((r) => [r.subject.id, r.subject])).values()]
    : null;
  return { subjects, error, loading };
}
