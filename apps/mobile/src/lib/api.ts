import * as SecureStore from "expo-secure-store";
import { API_URL, REQUEST_TIMEOUT_MS } from "./config";
import type {
  Achievement,
  AcademicSubject,
  AssignmentDetail,
  AssignmentListItem,
  Certificate,
  CreatePeerPost,
  DeadlinesResponse,
  LookupResult,
  OtpPurpose,
  PeerFeedPage,
  PeerFeedQuery,
  PeerPost,
  PresignedUpload,
  Project,
  ResourceFolderDetail,
  SocialLink,
  StudentProfile,
  SubjectResources,
} from "./types";

// ── Errors ────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown> | undefined;
  readonly fieldErrors: Record<string, string>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.fieldErrors = fieldErrors ?? {};
  }

  get isNetwork() {
    return this.code === "NETWORK_ERROR" || this.code === "TIMEOUT";
  }
}

export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err instanceof ApiError || err instanceof Error) return err.message || fallback;
  return fallback;
}

// ── Token storage ─────────────────────────────────────────────────────────────

const TOKEN_KEY = "mg_session_token";

export const tokenStore = {
  get: () => SecureStore.getItemAsync(TOKEN_KEY),
  set: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
  clear: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};

let memoryToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setSessionToken(token: string | null) {
  memoryToken = token;
}
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

// ── Core request ──────────────────────────────────────────────────────────────

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Override the bearer token (onboarding / reset tokens). `null` sends no auth header. */
  token?: string | null;
};

type Envelope<T> = { success: true; data: T; message?: string } & Record<string, unknown>;

async function request<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (!API_URL) throw new ApiError(0, "CONFIG", "The app isn't configured correctly. Please update to the latest version.");

  const token = opts.token === undefined ? memoryToken : opts.token;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body === undefined ? null : JSON.stringify(opts.body),
      signal: controller.signal,
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    throw new ApiError(
      0,
      aborted ? "TIMEOUT" : "NETWORK_ERROR",
      aborted ? "The server took too long to respond. Please try again." : "No internet connection. Check your network and try again."
    );
  } finally {
    clearTimeout(timer);
  }

  let json: Record<string, unknown> | null = null;
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    json = null;
  }

  if (!res.ok || !json || json["success"] === false) {
    const code = (json?.["code"] as string | undefined) ?? (res.status >= 500 ? "SERVER_ERROR" : "REQUEST_FAILED");
    const message =
      (json?.["message"] as string | undefined) ??
      (res.status >= 500 ? "Our servers are having trouble right now. Please try again shortly." : "Request failed.");
    const error = new ApiError(
      res.status,
      code,
      message,
      json?.["details"] as Record<string, unknown> | undefined,
      json?.["errors"] as Record<string, string> | undefined
    );
    // A session token that is no longer valid (expired, logged out elsewhere, password changed, disabled).
    if (res.status === 401 && token && token === memoryToken) onUnauthorized?.();
    throw error;
  }
  return json as T;
}

const get = <T>(path: string) => request<Envelope<T>>(path).then((r) => r.data);
const send = <T>(method: "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown) =>
  request<Envelope<T>>(path, { method, body }).then((r) => r.data);

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  lookup: (identifier: string) => request<LookupResult & { success: true }>("/auth/lookup", { method: "POST", body: { identifier }, token: null }),

  resendOtp: (identifier: string, purpose: OtpPurpose) =>
    request<{ maskedEmail: string; resendAvailableInSeconds: number; message: string }>("/auth/resend-otp", {
      method: "POST",
      body: { identifier, purpose },
      token: null,
    }),

  requestPasswordReset: (identifier: string) =>
    request<{ maskedEmail: string; resendAvailableInSeconds: number; message: string }>("/auth/request-password-reset", {
      method: "POST",
      body: { identifier },
      token: null,
    }),

  verifyOtp: (identifier: string, otp: string, purpose: OtpPurpose) =>
    request<{ type: "ONBOARDING"; onboardingToken: string } | { type: "RESET"; resetToken: string }>("/auth/verify-otp", {
      method: "POST",
      body: { identifier, otp, purpose },
      token: null,
    }),

  onboard: (password: string, onboardingToken: string) =>
    request<{ token: string; role: string }>("/auth/onboard", { method: "POST", body: { password }, token: onboardingToken }),

  resetPassword: (password: string, resetToken: string) =>
    request<{ token: string; role: string }>("/auth/reset-password", { method: "POST", body: { password }, token: resetToken }),

  login: (identifier: string, password: string) =>
    request<{ token: string; role: string }>("/auth/login", {
      method: "POST",
      body: { identifier, password, expectedCategory: "STUDENT" },
      token: null,
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ token: string }>("/auth/change-password", { method: "POST", body: { currentPassword, newPassword } }),

  logoutAll: () => request("/auth/logout-all", { method: "POST" }),

  me: () => get<{ id: string; email: string; role: string; enrollmentNumber: string | null }>("/auth/me"),
};

// ── Profile ───────────────────────────────────────────────────────────────────

export type ProfileUpdate = {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  section?: string | null;
};

export type UploadRequest = { fileName: string; fileType: string; fileSize: number };
export type ResumeKind = "tech" | "non-tech";

export const profileApi = {
  get: () => get<StudentProfile>("/me/profile"),
  update: (body: ProfileUpdate) => send<StudentProfile>("PATCH", "/me/profile", body),

  presignPhoto: (f: UploadRequest) => send<PresignedUpload>("POST", "/me/profile/photo", f),
  confirmPhoto: (fileUrl: string) => send<{ profileImageUrl: string }>("PUT", "/me/profile/photo", { fileUrl }),
  deletePhoto: () => send("DELETE", "/me/profile/photo"),

  presignResume: (kind: ResumeKind, f: UploadRequest) => send<PresignedUpload>("POST", `/me/profile/resume/${kind}`, f),
  confirmResume: (kind: ResumeKind, fileUrl: string) => send("PUT", `/me/profile/resume/${kind}`, { fileUrl }),
  deleteResume: (kind: ResumeKind) => send("DELETE", `/me/profile/resume/${kind}`),

  presignCertificate: (f: UploadRequest) => send<PresignedUpload>("POST", "/me/profile/certificate-upload", f),
  presignAchievement: (f: UploadRequest) => send<PresignedUpload>("POST", "/me/profile/achievement-upload", f),

  addCertificate: (b: { title: string; issuer?: string | null; issueDate?: string | null; fileUrl: string }) =>
    send<Certificate>("POST", "/me/certificates", b),
  updateCertificate: (id: string, b: Partial<{ title: string; issuer: string | null; issueDate: string | null; fileUrl: string }>) =>
    send<Certificate>("PATCH", `/me/certificates/${id}`, b),
  deleteCertificate: (id: string) => send("DELETE", `/me/certificates/${id}`),

  addProject: (b: Omit<Project, "id" | "createdAt">) => send<Project>("POST", "/me/projects", b),
  updateProject: (id: string, b: Partial<Omit<Project, "id" | "createdAt">>) => send<Project>("PATCH", `/me/projects/${id}`, b),
  deleteProject: (id: string) => send("DELETE", `/me/projects/${id}`),

  addAchievement: (b: Omit<Achievement, "id" | "createdAt">) => send<Achievement>("POST", "/me/achievements", b),
  updateAchievement: (id: string, b: Partial<Omit<Achievement, "id" | "createdAt">>) =>
    send<Achievement>("PATCH", `/me/achievements/${id}`, b),
  deleteAchievement: (id: string) => send("DELETE", `/me/achievements/${id}`),

  addSocialLink: (b: Omit<SocialLink, "id">) => send<SocialLink>("POST", "/me/social-links", b),
  updateSocialLink: (id: string, b: Partial<Omit<SocialLink, "id">>) => send<SocialLink>("PATCH", `/me/social-links/${id}`, b),
  deleteSocialLink: (id: string) => send("DELETE", `/me/social-links/${id}`),
};

// ── Assignments ───────────────────────────────────────────────────────────────

export const assignmentApi = {
  list: () => get<AssignmentListItem[]>("/me/assignments"),
  detail: (id: string) => get<AssignmentDetail>(`/me/assignments/${id}`),
  presign: (id: string, f: UploadRequest) => send<PresignedUpload>("POST", `/me/assignments/${id}/upload-url`, f),
  submit: (id: string, fileUrl: string) => send<{ status: string; submittedAt: string }>("POST", `/me/assignments/${id}/submit`, { fileUrl }),
};

// ── Academics ─────────────────────────────────────────────────────────────────

export type DeadlineWindow = "upcoming" | "past" | "all";

export const academicsApi = {
  deadlines: (when: DeadlineWindow = "upcoming") => get<DeadlinesResponse>(`/me/deadlines?when=${when}`),
  subjects: () => get<AcademicSubject[]>("/me/subjects"),
  subjectResources: (subjectId: string) => get<SubjectResources>(`/me/subjects/${encodeURIComponent(subjectId)}/resources`),
  folder: (folderId: string) => get<ResourceFolderDetail>(`/me/resource-folders/${encodeURIComponent(folderId)}`),
};

function toQuery(params: Record<string, string | number | boolean | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "" && v !== false)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export const peersApi = {
  feed: (q: PeerFeedQuery = {}) => get<PeerFeedPage>(`/me/peer-resources${toQuery(q)}`),
  presign: (f: UploadRequest) => send<PresignedUpload>("POST", "/me/peer-resources/upload-url", f),
  create: (body: CreatePeerPost) => send<PeerPost>("POST", "/me/peer-resources", body),
  remove: (id: string) => send("DELETE", `/me/peer-resources/${encodeURIComponent(id)}`),
};
