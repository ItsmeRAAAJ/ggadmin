import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";

type State<T> = { data: T | undefined; error: ApiError | null; loading: boolean; refreshing: boolean };

/**
 * Small data-fetching hook:
 * - first load shows `loading`, pull-to-refresh uses `refreshing`
 * - silently refetches when the screen regains focus (stale data never blocks the UI)
 * - ignores results from stale requests
 */
export function useQuery<T>(fetcher: () => Promise<T>, opts: { refetchOnFocus?: boolean; deps?: unknown[] } = {}) {
  const { refetchOnFocus = true, deps = [] } = opts;
  const [state, setState] = useState<State<T>>({ data: undefined, error: null, loading: true, refreshing: false });
  const reqId = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const hasData = useRef(false);
  const focusedOnce = useRef(false);

  const run = useCallback(async (mode: "initial" | "refresh" | "silent") => {
    const id = ++reqId.current;
    setState((s) => ({
      ...s,
      loading: mode === "initial" && !hasData.current,
      refreshing: mode === "refresh",
      error: mode === "silent" ? s.error : null,
    }));
    try {
      const data = await fetcherRef.current();
      if (id !== reqId.current) return;
      hasData.current = true;
      setState({ data, error: null, loading: false, refreshing: false });
    } catch (e) {
      if (id !== reqId.current) return;
      const err = e instanceof ApiError ? e : new ApiError(0, "UNKNOWN", "Something went wrong. Please try again.");
      // A failed background refresh keeps showing the last good data.
      setState((s) => ({ ...s, error: mode === "silent" && hasData.current ? s.error : err, loading: false, refreshing: false }));
    }
  }, []);

  useEffect(() => {
    hasData.current = false;
    void run("initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        return;
      }
      if (refetchOnFocus) void run("silent");
    }, [refetchOnFocus, run])
  );

  const refresh = useCallback(() => run("refresh"), [run]);
  const reload = useCallback(() => run("initial"), [run]);
  const setData = useCallback((updater: (prev: T | undefined) => T | undefined) => {
    setState((s) => ({ ...s, data: updater(s.data) }));
  }, []);

  return { ...state, refresh, reload, setData };
}
