import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Alert, Linking } from "react-native";
import { MAX_STUDY_UPLOAD_BYTES, MAX_UPLOAD_BYTES } from "./config";
import type { LocalFile } from "./types";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Study material allowlist (Resources / Share with Peers) — mirrors the backend. */
const STUDY_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/heic", "image/heif", PPTX, DOCX, XLSX];

export type DocumentKind = "pdf" | "pdf-or-image" | "study";

const DOC_KINDS: Record<DocumentKind, { types: string[]; maxBytes: number; message: string }> = {
  pdf: { types: ["application/pdf"], maxBytes: MAX_UPLOAD_BYTES, message: "Please choose a PDF file." },
  "pdf-or-image": { types: ["application/pdf", ...IMAGE_TYPES], maxBytes: MAX_UPLOAD_BYTES, message: "Please choose a PDF, JPG, PNG or WEBP file." },
  study: { types: STUDY_TYPES, maxBytes: MAX_STUDY_UPLOAD_BYTES, message: "Please choose a PDF, image (JPG/PNG/HEIC), PPTX, DOCX or XLSX file." },
};

function extToMime(name: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "heic":
    case "heif":
      return "image/heic";
    case "pdf":
      return "application/pdf";
    case "pptx":
      return PPTX;
    case "docx":
      return DOCX;
    case "xlsx":
      return XLSX;
    default:
      return null;
  }
}

function tooLarge(size?: number | null, maxBytes: number = MAX_UPLOAD_BYTES) {
  if (size && size > maxBytes) {
    Alert.alert("File too large", `Please choose a file smaller than ${Math.round(maxBytes / 1024 / 1024)} MB.`);
    return true;
  }
  return false;
}

function permissionDenied(what: string) {
  Alert.alert(`${what} access needed`, `Allow My GGITS to access your ${what.toLowerCase()} in Settings to continue.`, [
    { text: "Not now", style: "cancel" },
    { text: "Open Settings", onPress: () => void Linking.openSettings() },
  ]);
}

function normaliseImage(asset: ImagePicker.ImagePickerAsset, maxBytes?: number): LocalFile | null {
  // Images are re-encoded to JPEG by the picker when edited/compressed; HEIC etc. are converted too.
  let mimeType = asset.mimeType ?? extToMime(asset.fileName ?? asset.uri) ?? "image/jpeg";
  if (!(IMAGE_TYPES as readonly string[]).includes(mimeType)) mimeType = "image/jpeg";
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const base = (asset.fileName ?? `image-${Date.now()}`).replace(/\.[^.]+$/, "");
  if (tooLarge(asset.fileSize, maxBytes)) return null;
  return { uri: asset.uri, name: `${base}.${ext}`, mimeType, size: asset.fileSize };
}

type ImageOptions = { square?: boolean; maxBytes?: number };

export async function pickImageFromLibrary(opts: ImageOptions = {}): Promise<LocalFile | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    permissionDenied("Photos");
    return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: !!opts.square,
    ...(opts.square ? { aspect: [1, 1] as [number, number] } : {}),
    quality: 0.8,
  });
  if (res.canceled || !res.assets[0]) return null;
  return normaliseImage(res.assets[0], opts.maxBytes);
}

export async function takePhoto(opts: ImageOptions = {}): Promise<LocalFile | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    permissionDenied("Camera");
    return null;
  }
  const res = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    allowsEditing: !!opts.square,
    ...(opts.square ? { aspect: [1, 1] as [number, number] } : {}),
    quality: 0.7,
  });
  if (res.canceled || !res.assets[0]) return null;
  return normaliseImage(res.assets[0], opts.maxBytes);
}

export async function pickDocument(kind: DocumentKind): Promise<LocalFile | null> {
  const cfg = DOC_KINDS[kind];
  const res = await DocumentPicker.getDocumentAsync({
    // Android's picker filters by MIME; some providers report Office files oddly, so "study" stays permissive and is validated below.
    type: kind === "study" ? "*/*" : cfg.types,
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  const reported = a.mimeType && a.mimeType !== "application/octet-stream" ? (a.mimeType === "image/heif" ? "image/heic" : a.mimeType) : null;
  const mimeType = reported && cfg.types.includes(reported) ? reported : extToMime(a.name);
  if (!mimeType || !cfg.types.includes(mimeType)) {
    Alert.alert("Unsupported file", cfg.message);
    return null;
  }
  if (tooLarge(a.size, cfg.maxBytes)) return null;
  return { uri: a.uri, name: a.name, mimeType, size: a.size ?? undefined };
}

export { DOC_KINDS };
