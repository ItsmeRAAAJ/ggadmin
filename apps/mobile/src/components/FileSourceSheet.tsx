import { Camera, FileText, Image as ImageIcon, Trash2 } from "lucide-react-native";
import { View } from "react-native";
import { BottomSheet, Divider, ListRow } from "@/components/ui";
import { DOC_KINDS, pickDocument, pickImageFromLibrary, takePhoto, type DocumentKind } from "@/lib/pickers";
import type { LocalFile } from "@/lib/types";
import { colors } from "@/theme";

type Source = "document" | "library" | "camera";

/**
 * Action sheet to choose where a file comes from. Resolves the picked file via `onPicked`.
 * The sheet closes before the native picker opens (iOS can't present two modals at once).
 */
export function FileSourceSheet({
  visible,
  onClose,
  onPicked,
  title = "Add file",
  documentKind = "pdf-or-image",
  sources = ["document", "library", "camera"],
  square,
  onRemove,
  removeLabel = "Remove",
}: {
  visible: boolean;
  onClose: () => void;
  onPicked: (file: LocalFile) => void;
  title?: string;
  documentKind?: DocumentKind;
  sources?: Source[];
  square?: boolean;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  const maxBytes = DOC_KINDS[documentKind].maxBytes;
  const maxMb = Math.round(maxBytes / 1024 / 1024);
  const docSubtitle =
    documentKind === "pdf"
      ? `PDF up to ${maxMb} MB`
      : documentKind === "study"
        ? `PDF, image, PPTX, DOCX or XLSX up to ${maxMb} MB`
        : `PDF, JPG, PNG or WEBP up to ${maxMb} MB`;
  const run = (src: Source | "remove") => {
    onClose();
    // Give the sheet's modal time to dismiss before presenting the system picker.
    setTimeout(async () => {
      if (src === "remove") {
        onRemove?.();
        return;
      }
      const file =
        src === "document"
          ? await pickDocument(documentKind)
          : src === "library"
            ? await pickImageFromLibrary({ square, maxBytes })
            : await takePhoto({ square, maxBytes });
      if (file) onPicked(file);
    }, 350);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <View style={{ marginHorizontal: -16 }}>
        {sources.includes("document") ? (
          <ListRow
            icon={FileText}
            title={documentKind === "pdf" ? "Choose PDF" : "Choose file"}
            subtitle={docSubtitle}
            onPress={() => run("document")} chevron={false}
          />
        ) : null}
        {sources.includes("library") ? (
          <ListRow icon={ImageIcon} iconColor={colors.secondary} iconBg={colors.secondarySoft} title="Photo library" subtitle="Pick an existing photo" onPress={() => run("library")} chevron={false} />
        ) : null}
        {sources.includes("camera") ? (
          <ListRow icon={Camera} iconColor={colors.accentDark} iconBg={colors.accentSoft} title="Take photo" subtitle="Use your camera" onPress={() => run("camera")} chevron={false} />
        ) : null}
        {onRemove ? (
          <>
            <Divider inset={16} />
            <ListRow icon={Trash2} title={removeLabel} destructive onPress={() => run("remove")} chevron={false} />
          </>
        ) : null}
      </View>
    </BottomSheet>
  );
}
