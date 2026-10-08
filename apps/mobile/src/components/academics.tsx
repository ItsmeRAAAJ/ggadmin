import {
  BookMarked,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  Link2,
  NotebookPen,
  Presentation,
  ScrollText,
  Sparkles,
  type LucideIcon,
} from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import type { PeerCategory, PeerScope } from "@/lib/types";
import { colors, radius } from "@/theme";

type Tint = { icon: LucideIcon; fg: string; bg: string };

const FILE_TYPES: Record<string, Tint> = {
  pdf: { icon: FileText, fg: "#DC2626", bg: "#FEF2F2" },
  pptx: { icon: Presentation, fg: "#EA580C", bg: "#FFF7ED" },
  docx: { icon: FileText, fg: colors.primaryDark, bg: colors.primaryTint },
  xlsx: { icon: FileSpreadsheet, fg: colors.accentDark, bg: colors.accentSoft },
  png: { icon: FileImage, fg: "#7C3AED", bg: "#F5F3FF" },
  jpg: { icon: FileImage, fg: "#7C3AED", bg: "#F5F3FF" },
  jpeg: { icon: FileImage, fg: "#7C3AED", bg: "#F5F3FF" },
  heic: { icon: FileImage, fg: "#7C3AED", bg: "#F5F3FF" },
  heif: { icon: FileImage, fg: "#7C3AED", bg: "#F5F3FF" },
  link: { icon: Link2, fg: "#0E7490", bg: "#ECFEFF" },
};
const FALLBACK: Tint = { icon: FileArchive, fg: colors.textSecondary, bg: colors.surfaceMuted };

export function fileTint(type: string | null | undefined): Tint {
  return (type && FILE_TYPES[type.toLowerCase()]) || FALLBACK;
}

/** Rounded square icon for a file extension ("pdf", "pptx"…) or "link". */
export function FileTypeIcon({ type, size = 40 }: { type: string | null | undefined; size?: number }) {
  const t = fileTint(type);
  const Icon = t.icon;
  return (
    <View style={[styles.icon, { width: size, height: size, backgroundColor: t.bg }]}>
      <Icon size={Math.round(size * 0.5)} color={t.fg} />
    </View>
  );
}

export const PEER_CATEGORIES: { value: PeerCategory; label: string; icon: LucideIcon }[] = [
  { value: "PREVIOUS_YEAR_PAPER", label: "Previous year paper", icon: ScrollText },
  { value: "LAB_MANUAL", label: "Lab manual", icon: FlaskConical },
  { value: "REFERENCE_MATERIAL", label: "Reference material", icon: BookMarked },
  { value: "USEFUL_LINK", label: "Useful link", icon: Link2 },
  { value: "CHEATSHEET", label: "Cheatsheet", icon: NotebookPen },
  { value: "OTHER", label: "Other", icon: Sparkles },
];

export const categoryLabel = (c: PeerCategory) => PEER_CATEGORIES.find((x) => x.value === c)?.label ?? "Other";

export const PEER_SCOPES: { value: PeerScope; label: string; description: string }[] = [
  { value: "CLASS", label: "My class", description: "Your branch, semester and section" },
  { value: "BRANCH", label: "My branch", description: "Everyone in your branch, all semesters" },
  { value: "SEMESTER", label: "My semester", description: "Everyone in your semester, all branches" },
];

export const scopeLabel = (s: PeerScope) => (s === "CLASS" ? "Class" : s === "BRANCH" ? "Branch" : "Semester");

const styles = StyleSheet.create({
  icon: { borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
});
