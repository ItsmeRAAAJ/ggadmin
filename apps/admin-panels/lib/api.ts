export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
export const TOKEN_KEY = "mg_admin_token";

export type FieldErrors = Record<string, string>;

type ApiEnvelope<T> = {
  success: true;
  data?: T;
  message?: string;
  token?: string;
  role?: string;
} & Record<string, unknown>;
type ApiFailure = {
  success?: false;
  code?: string;
  message?: string;
  details?: unknown;
  errors?: FieldErrors;
};

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  fieldErrors?: FieldErrors;
  constructor(
    message: string,
    status: number,
    code?: string,
    details?: unknown,
    fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.fieldErrors = fieldErrors;
  }
}

export function getStoredToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function query(
  params: Record<string, string | number | null | undefined | boolean>,
) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v) !== "") sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Drops the session on auth failure; AuthProvider/AuthShell react to the event and route to sign-in. */
function handleUnauthorized(status: number, code?: string) {
  if (status !== 401 && code !== "INVALID_TOKEN") return;
  setStoredToken(null);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("mg-auth-cleared"));
  }
}

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string | null; raw?: boolean } = {},
): Promise<T> {
  const token = options.token === undefined ? getStoredToken() : options.token;
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const hasBody = options.body !== undefined && options.body !== null;
  if (
    hasBody &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  )
    headers.set("Content-Type", "application/json");
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });
  if (options.raw) return res as unknown as T;
  const text = await res.text();
  let payload: ApiEnvelope<T> | ApiFailure | undefined;
  if (text) {
    try {
      payload = JSON.parse(text) as ApiEnvelope<T> | ApiFailure;
    } catch {
      payload = undefined;
    }
  }
  if (!res.ok || payload?.success === false) {
    const failure = (payload || {}) as ApiFailure;
    handleUnauthorized(res.status, failure.code);
    throw new ApiError(
      failure.message || `Request failed (${res.status})`,
      res.status,
      failure.code,
      failure.details,
      failure.errors,
    );
  }
  const ok = payload as ApiEnvelope<T> | undefined;
  if (ok && Object.prototype.hasOwnProperty.call(ok, "data"))
    return ok.data as T;
  return ok as unknown as T;
}

export function post<T>(path: string, body?: unknown, token?: string | null) {
  return api<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
    token,
  });
}
export function patch<T>(path: string, body?: unknown) {
  return api<T>(path, {
    method: "PATCH",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
export function put<T>(path: string, body?: unknown) {
  return api<T>(path, {
    method: "PUT",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
export function del<T>(path: string) {
  return api<T>(path, { method: "DELETE" });
}

export async function download(path: string, filename: string) {
  const token = getStoredToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    let message = "Download failed";
    try {
      message = ((await res.json()) as ApiFailure).message || message;
    } catch {}
    throw new ApiError(message, res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
