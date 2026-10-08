import Constants from "expo-constants";

/**
 * API base URL.
 * - Production/preview builds: EXPO_PUBLIC_API_URL must be set (e.g. https://api.myggits.in).
 * - Development: falls back to the Metro host's IP on port 3001 so a physical device on the same
 *   Wi-Fi reaches the local backend without extra setup.
 */
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  if (__DEV__) {
    const host = Constants.expoConfig?.hostUri?.split(":")[0];
    if (host) return `http://${host}:3001`;
    return "http://localhost:3001";
  }
  return "";
}

export const API_URL = resolveApiUrl();
export const REQUEST_TIMEOUT_MS = 20_000;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/** Share with Peers / study material (matches the backend allowlist). */
export const MAX_STUDY_UPLOAD_BYTES = 25 * 1024 * 1024;
export const OTP_LENGTH = 6;
export const PASSWORD_MIN = 8;
