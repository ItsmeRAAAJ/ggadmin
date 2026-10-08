import { StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors, radius } from "@/theme";
import { Text } from "./Text";

export function ProgressRing({
  percent,
  size = 72,
  stroke = 7,
  color = colors.accent,
  track = colors.border,
  labelColor = colors.text,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  labelColor?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent));
  return (
    <View style={{ width: size, height: size }} accessibilityLabel={`${Math.round(p)} percent`}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - p / 100)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text variant="subheading" color={labelColor} style={{ fontSize: size * 0.22 }}>
          {Math.round(p)}%
        </Text>
      </View>
    </View>
  );
}

export function ProgressBar({ value, color = colors.primary, height = 6 }: { value: number; color?: string; height?: number }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <View style={[styles.track, { height }]}>
      <View style={{ width: `${v * 100}%`, height, backgroundColor: color, borderRadius: radius.full }} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  track: { backgroundColor: colors.border, borderRadius: radius.full, overflow: "hidden", width: "100%" },
});
