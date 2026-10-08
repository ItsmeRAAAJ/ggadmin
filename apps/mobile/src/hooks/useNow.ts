import { useEffect, useState } from "react";
import { AppState } from "react-native";

/** Ticking clock (ms) — re-syncs immediately when the app returns to the foreground. */
export function useNow(intervalMs = 1000, enabled = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") setNow(Date.now());
    });
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, [intervalMs, enabled]);
  return now;
}
