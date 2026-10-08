// Validation config — centralized so patterns can be adjusted without touching route handlers.
// Confirm these regexes against real admin-provided sample data before locking them.

export const ENROLLMENT_NUMBER_REGEX = /^\d{4}[A-Z]{2}\d{2}\d{4}$/;
// Pattern: 4 digits + 2 uppercase letters (branch) + 2 digits (year) + 4 digits (roll)
// Example: 0206IS241034

export const INSTITUTIONAL_EMAIL_REGEX =
  /^[a-z]+\.[a-z]+\.[a-z]{2}\d{2}@ggits\.net$/i;
// Pattern: firstname.lastname.branchyear@ggits.net
// Example: john.doe.is24@ggits.net
export const INSTITUTIONAL_EMAIL_ALLOWLIST: readonly string[] = [
  "shubhashish147@gmail.com"
];

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72; // bcrypt ignores bytes beyond 72

export const OTP_EXPIRY_MINUTES = 10;
export const OTP_DIGITS = 6;
export const OTP_MAX_ATTEMPTS = 5; // failed tries before an OTP is burned
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_MAX_PER_HOUR = 5; // per user, per purpose

export const JWT_RESET_EXPIRES_IN = "10m";

export const S3_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const S3_PRESIGNED_URL_EXPIRY_SECONDS = 300; // 5 minutes (upload)
export const S3_SIGNED_GET_EXPIRY_SECONDS = 60 * 60; // 1 hour (download/view)
export const S3_ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const S3_ALLOWED_DOCUMENT_TYPES = ["application/pdf"];
// Academics (teacher Resources + Share with Peers): an allowlist, never a blocklist.
// pdf, png, jpg/jpeg, heic, pptx, docx, xlsx — no video/audio/archives/executables.
export const S3_ALLOWED_STUDY_MATERIAL_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/heic",
  "image/heif",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
export const S3_STUDY_MATERIAL_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB — slides/scanned papers run large

export const PAGINATION_MAX_LIMIT = 100;
export const PAGINATION_DEFAULT_LIMIT = 20;

// Academics
export const ACADEMIC_TIMEZONE = "Asia/Kolkata"; // used to group deadlines by calendar day
export const PEER_RESOURCE_DAILY_LIMIT = 30; // posts per student per rolling 24h — basic anti-spam
