import { CircleAlert, CircleCheck, Info } from "lucide-react-native";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, shadow, spacing } from "@/theme";
import { Text } from "./Text";

type ToastKind = "success" | "error" | "info";
type ToastMsg = { id: number; kind: ToastKind; message: string };
type ToastApi = { show: (message: string, kind?: ToastKind) => void; success: (m: string) => void; error: (m: string) => void };

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const counter = useRef(0);

  const show = useCallback((message: string, kind: ToastKind = "info") => {
    counter.current += 1;
    setToast({ id: counter.current, kind, message });
  }, []);

  const api = useMemo<ToastApi>(
    () => ({ show, success: (m) => show(m, "success"), error: (m) => show(m, "error") }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? <ToastView key={toast.id} toast={toast} onDone={() => setToast((t) => (t?.id === toast.id ? null : t))} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDone }: { toast: ToastMsg; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;

  const hide = useCallback(() => {
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => onDone());
  }, [anim, onDone]);

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 8, tension: 80 }).start();
    const t = setTimeout(hide, toast.kind === "error" ? 4000 : 2600);
    return () => clearTimeout(t);
  }, [anim, hide, toast.kind]);

  const Icon = toast.kind === "success" ? CircleCheck : toast.kind === "error" ? CircleAlert : Info;
  const tint = toast.kind === "success" ? colors.accent : toast.kind === "error" ? colors.danger : colors.primary;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.host,
        {
          top: insets.top + spacing.sm,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
        },
      ]}
    >
      <Pressable onPress={hide} style={styles.toast} accessibilityRole="alert" accessibilityLiveRegion="polite">
        <Icon size={20} color={tint} />
        <Text variant="smallMedium" color={colors.white} style={styles.msg}>
          {toast.message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

const styles = StyleSheet.create({
  host: { position: "absolute", left: spacing.base, right: spacing.base, zIndex: 1000, alignItems: "center" },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    backgroundColor: "#0F172A",
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    maxWidth: 520,
    width: "100%",
    ...shadow.lg,
  },
  msg: { flex: 1 },
});
