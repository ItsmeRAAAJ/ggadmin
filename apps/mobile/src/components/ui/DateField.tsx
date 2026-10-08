import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { dateOnlyToIso, formatDateOnly, isoToDateOnly } from "@/lib/format";
import { colors, radius, spacing } from "@/theme";
import { Button } from "./Button";
import { BottomSheet } from "./Sheet";
import { Text } from "./Text";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

type YMD = { year: number; month: number; day: number };

const cmp = (a: YMD, b: YMD) => a.year - b.year || a.month - b.month || a.day - b.day;
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

function todayYmd(): YMD {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

/** Pure-JS calendar date field. Value is an ISO string at UTC midnight (or null). */
export function DateField({
  label,
  value,
  onChange,
  placeholder = "Select date",
  minYear = 1970,
  maxDate,
  error,
  optional,
  clearable = true,
  initialYear,
}: {
  label: string;
  value: string | null;
  onChange: (iso: string | null) => void;
  placeholder?: string;
  minYear?: number;
  maxDate?: YMD;
  error?: string | null | undefined;
  optional?: boolean;
  clearable?: boolean;
  initialYear?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text variant="smallMedium" color={colors.textSecondary}>
          {label}
        </Text>
        {optional ? (
          <Text variant="small" color={colors.textMuted}>
            Optional
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatDateOnly(value) : "not set"}`}
        style={({ pressed }) => [styles.field, { borderColor: error ? colors.danger : colors.border }, pressed && { backgroundColor: colors.surfaceMuted }]}
      >
        <CalendarDays size={18} color={colors.textMuted} />
        <Text style={styles.value} color={value ? colors.text : colors.textMuted}>
          {value ? formatDateOnly(value) : placeholder}
        </Text>
        <ChevronDown size={18} color={colors.textMuted} />
      </Pressable>
      {error ? (
        <Text variant="small" color={colors.danger}>
          {error}
        </Text>
      ) : null}
      {open ? (
        <CalendarSheet
          title={label}
          initial={isoToDateOnly(value)}
          minYear={minYear}
          maxDate={maxDate}
          initialYear={initialYear}
          clearable={clearable && !!value}
          onClose={() => setOpen(false)}
          onPick={(d) => {
            onChange(d ? dateOnlyToIso(d) : null);
            setOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

function CalendarSheet({
  title,
  initial,
  minYear,
  maxDate,
  initialYear,
  clearable,
  onClose,
  onPick,
}: {
  title: string;
  initial: YMD | null;
  minYear: number;
  maxDate: YMD | undefined;
  initialYear: number | undefined;
  clearable: boolean;
  onClose: () => void;
  onPick: (d: YMD | null) => void;
}) {
  const today = todayYmd();
  const max = maxDate ?? { year: today.year + 10, month: 11, day: 31 };
  const start = initial ?? { year: Math.min(initialYear ?? today.year, max.year), month: initialYear ? 0 : today.month, day: 1 };
  const [view, setView] = useState({ year: start.year, month: start.month });
  const [selected, setSelected] = useState<YMD | null>(initial);
  const [mode, setMode] = useState<"days" | "years">("days");

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(view.year, view.month, 1)).getUTCDay();
    const total = daysIn(view.year, view.month);
    const arr: (number | null)[] = Array.from({ length: first }, () => null);
    for (let d = 1; d <= total; d++) arr.push(d);
    while (arr.length % 7) arr.push(null);
    return arr;
  }, [view]);

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = max.year; y >= minYear; y--) list.push(y);
    return list;
  }, [max.year, minYear]);

  const canPrev = view.year > minYear || view.month > 0;
  const canNext = view.year < max.year || (view.year === max.year && view.month < max.month);

  const shift = (delta: number) => {
    setView((v) => {
      const m = v.month + delta;
      return { year: v.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  };

  return (
    <BottomSheet visible onClose={onClose} title={title}>
      <View style={styles.calHeader}>
        <Pressable
          onPress={() => setMode((m) => (m === "days" ? "years" : "days"))}
          style={styles.monthBtn}
          accessibilityRole="button"
          accessibilityLabel="Choose year"
        >
          <Text variant="subheading">
            {MONTHS[view.month]} {view.year}
          </Text>
          <ChevronDown size={16} color={colors.textSecondary} style={{ transform: [{ rotate: mode === "years" ? "180deg" : "0deg" }] }} />
        </Pressable>
        {mode === "days" ? (
          <View style={styles.navRow}>
            <Pressable onPress={() => shift(-1)} disabled={!canPrev} hitSlop={8} style={[styles.nav, !canPrev && styles.disabled]} accessibilityLabel="Previous month">
              <ChevronLeft size={20} color={colors.text} />
            </Pressable>
            <Pressable onPress={() => shift(1)} disabled={!canNext} hitSlop={8} style={[styles.nav, !canNext && styles.disabled]} accessibilityLabel="Next month">
              <ChevronRight size={20} color={colors.text} />
            </Pressable>
          </View>
        ) : null}
      </View>

      {mode === "years" ? (
        <ScrollView style={styles.yearScroll} contentContainerStyle={styles.yearGrid}>
          {years.map((y) => {
            const active = y === view.year;
            return (
              <Pressable
                key={y}
                onPress={() => {
                  setView((v) => ({ year: y, month: y === max.year ? Math.min(v.month, max.month) : v.month }));
                  setMode("days");
                }}
                style={[styles.yearCell, active && styles.cellActive]}
              >
                <Text variant="bodyMedium" color={active ? colors.white : colors.text}>
                  {y}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <View>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((w, i) => (
              <Text key={i} variant="caption" color={colors.textMuted} style={styles.weekday}>
                {w}
              </Text>
            ))}
          </View>
          <View style={styles.grid}>
            {cells.map((d, i) => {
              if (d === null) return <View key={i} style={styles.cell} />;
              const ymd = { year: view.year, month: view.month, day: d };
              const disabled = cmp(ymd, max) > 0;
              const isSel = !!selected && cmp(ymd, selected) === 0;
              const isToday = cmp(ymd, today) === 0;
              return (
                <Pressable key={i} disabled={disabled} onPress={() => setSelected(ymd)} style={styles.cell} accessibilityLabel={`${d} ${MONTHS[view.month]} ${view.year}`}>
                  <View style={[styles.day, isSel && styles.cellActive, !isSel && isToday && styles.today]}>
                    <Text variant="bodyMedium" color={isSel ? colors.white : disabled ? colors.borderStrong : colors.text}>
                      {d}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <View style={styles.actions}>
        {clearable ? <Button title="Clear" variant="ghost" onPress={() => onPick(null)} style={styles.flex} /> : null}
        <Button title="Done" onPress={() => onPick(selected)} disabled={!selected} style={styles.flex} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs + 2 },
  labelRow: { flexDirection: "row", justifyContent: "space-between" },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    borderWidth: 1.5,
    borderRadius: radius.md,
    minHeight: 50,
    paddingHorizontal: spacing.md + 2,
    backgroundColor: colors.surface,
  },
  value: { flex: 1 },
  calHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  monthBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 },
  navRow: { flexDirection: "row", gap: spacing.sm },
  nav: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.35 },
  weekRow: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center", paddingVertical: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 3 },
  day: { flex: 1, borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
  cellActive: { backgroundColor: colors.primary },
  today: { borderWidth: 1.5, borderColor: colors.primary },
  yearScroll: { maxHeight: 300 },
  yearGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingBottom: spacing.sm },
  yearCell: {
    width: "22.5%",
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
  },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.base },
  flex: { flex: 1 },
});
