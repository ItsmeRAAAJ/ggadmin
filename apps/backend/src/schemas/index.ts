import { z } from "zod";
import {
  ENROLLMENT_NUMBER_REGEX,
  INSTITUTIONAL_EMAIL_ALLOWLIST,
  INSTITUTIONAL_EMAIL_REGEX,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "../config/validation.js";

// ── Shared primitives ────────────────────────────────────────────────────────

const id = z.string().min(1).max(64);
const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();
const isoDate = z.iso.datetime({ offset: true });
const optionalIsoDate = isoDate.nullable().optional();
const httpUrl = z
  .url({ protocol: /^https?$/, message: "Must be a valid http(s) URL" })
  .max(2048);

const password = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`)
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

const identifier = z.string().trim().min(3, "Enter your enrollment number or email").max(254);
const otpPurpose = z.enum(["FIRST_LOGIN", "PASSWORD_RESET"]).default("FIRST_LOGIN");

// ── Auth ─────────────────────────────────────────────────────────────────────

export const lookupSchema = z.object({ identifier });

export const resendOtpSchema = z.object({ identifier, purpose: otpPurpose });

export const verifyOtpSchema = z.object({
  identifier,
  otp: z.string().trim().regex(/^\d{6}$/, "OTP must be exactly 6 digits"),
  purpose: otpPurpose,
});

export const onboardSchema = z.object({ password });
export const resetPasswordSchema = z.object({ password });

export const loginSchema = z.object({
  identifier,
  password: z.string().min(1, "Password is required").max(PASSWORD_MAX_LENGTH),
  expectedCategory: z.string().trim().min(1).max(50).optional(),
});

export const requestPasswordResetSchema = z.object({ identifier });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required").max(PASSWORD_MAX_LENGTH),
  newPassword: password,
});

// ── Student Profile ───────────────────────────────────────────────────────────

export const updateProfileSchema = z
  .object({
    firstName: trimmed(1, 100).optional(),
    lastName: trimmed(1, 100).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{10,15}$/, "Enter a valid phone number (10–15 digits)")
      .nullable()
      .optional(),
    dateOfBirth: optionalIsoDate,
    section: optionalText(10),
  })
  .strict();

export const uploadRequestSchema = z.object({
  fileName: trimmed(1, 255),
  fileType: trimmed(1, 100),
  fileSize: z.number().int().positive(),
});

export const confirmUploadSchema = z.object({ fileUrl: httpUrl });

export const resumeKindSchema = z.enum(["tech", "non-tech"]);

export const createCertificateSchema = z.object({
  title: trimmed(1, 200),
  issuer: optionalText(200),
  issueDate: optionalIsoDate,
  fileUrl: httpUrl,
});
export const updateCertificateSchema = createCertificateSchema.partial();

const projectBase = z.object({
  title: trimmed(1, 200),
  description: optionalText(2000),
  techStack: z.array(trimmed(1, 50)).max(20).default([]),
  link: httpUrl.nullable().optional(),
  startDate: optionalIsoDate,
  endDate: optionalIsoDate,
});
const datesInOrder = (v: { startDate?: string | null | undefined; endDate?: string | null | undefined }) =>
  !v.startDate || !v.endDate || new Date(v.startDate) <= new Date(v.endDate);
export const createProjectSchema = projectBase.refine(datesInOrder, {
  message: "End date must be after start date",
  path: ["endDate"],
});
export const updateProjectSchema = projectBase
  .partial()
  .refine(datesInOrder, { message: "End date must be after start date", path: ["endDate"] });

export const achievementCategory = z.enum(["ACADEMIC", "CO_CURRICULAR", "EXTRA_CURRICULAR"]);
export const createAchievementSchema = z.object({
  title: trimmed(1, 200),
  description: optionalText(2000),
  date: optionalIsoDate,
  fileUrl: httpUrl.nullable().optional(),
  category: achievementCategory,
});
export const updateAchievementSchema = createAchievementSchema.partial();

export const socialPlatform = z.enum(["LINKEDIN", "GITHUB", "PORTFOLIO", "OTHER"]);
export const createSocialLinkSchema = z.object({ platform: socialPlatform, url: httpUrl });
export const updateSocialLinkSchema = createSocialLinkSchema.partial();

// ── Admin: students ──────────────────────────────────────────────────────────

export const seedStudentSchema = z
  .object({
    enrollmentNumber: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .pipe(z.string().regex(ENROLLMENT_NUMBER_REGEX, "Invalid enrollment number format")),
    email: z
      .string()
      .trim()
      .transform((v) => v.toLowerCase())
      .pipe(z.email("Invalid email format"))
      .refine(
        (email) =>
          INSTITUTIONAL_EMAIL_REGEX.test(email) ||
          INSTITUTIONAL_EMAIL_ALLOWLIST.includes(email),
        "Invalid institutional email format",
      ),
    branchCode: z
      .string()
      .trim()
      .min(1)
      .max(20)
      .transform((v) => v.toUpperCase()),
    admissionYear: z.coerce.number().int().min(2000).max(2100),
    passoutYear: z.coerce.number().int().min(2000).max(2110).optional(),
    currentSemester: z.coerce.number().int().min(1).max(8).optional(),
    section: optionalText(10),
  })
  .refine((v) => v.passoutYear === undefined || v.passoutYear > v.admissionYear, {
    message: "Passout year must be after admission year",
    path: ["passoutYear"],
  });

export const updateStudentSchema = z
  .object({
    currentSemester: z.number().int().min(1).max(8).optional(),
    section: optionalText(10),
    status: z.enum(["ACTIVE", "DISABLED", "PENDING_ACTIVATION"]).optional(),
  })
  .strict();

export const bulkSemesterSchema = z.object({
  branchId: id,
  admissionYear: z.number().int().min(2000).max(2100),
  currentSemester: z.number().int().min(1).max(8),
});

// ── Admin: academic structure ────────────────────────────────────────────────

export const createBranchSchema = z.object({
  shortCode: trimmed(1, 20).transform((v) => v.toUpperCase()),
  name: trimmed(1, 200),
});
export const updateBranchSchema = z.object({ name: trimmed(1, 200) });

export const createSubjectSchema = z.object({
  name: trimmed(1, 200),
  code: trimmed(1, 20).transform((v) => v.toUpperCase()),
  branchId: id,
  semester: z.number().int().min(1).max(8),
});
export const updateSubjectSchema = z.object({
  name: trimmed(1, 200).optional(),
  semester: z.number().int().min(1).max(8).optional(),
});

export const createTeacherAssignmentSchema = z.object({
  teacherProfileId: id,
  subjectId: id,
  section: optionalText(10),
  academicYear: z.number().int().min(2000).max(2100),
});

// ── Admin: staff ─────────────────────────────────────────────────────────────

const staffEmail = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email"));
const teacherTier = z.enum(["HOD", "INCHARGE", "SUBJECT_TEACHER"]);

export const createTeacherSchema = z.object({
  email: staffEmail,
  name: trimmed(1, 150),
  department: optionalText(150),
  tier: teacherTier.default("SUBJECT_TEACHER"),
  primaryBranchId: id.nullable().optional(),
  reportsToId: id.nullable().optional(),
});

export const updateTeacherSchema = z
  .object({
    name: trimmed(1, 150).optional(),
    department: optionalText(150),
    tier: teacherTier.optional(),
    primaryBranchId: id.nullable().optional(),
    reportsToId: id.nullable().optional(),
    status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  })
  .strict();

export const createAdminSchema = z.object({
  email: staffEmail,
  name: trimmed(1, 150),
  adminRoleKey: trimmed(1, 50),
});

export const updateAdminSchema = z
  .object({
    name: trimmed(1, 150).optional(),
    status: z.enum(["ACTIVE", "DISABLED"]).optional(),
    adminRoleKeys: z.array(trimmed(1, 50)).min(1).optional(),
  })
  .strict();

export const grantPermissionSchema = z.object({ permissionKey: trimmed(1, 80) });

const permissionKey = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .pipe(z.string().regex(/^[A-Z][A-Z0-9_]{2,79}$/, "Key must be UPPER_SNAKE_CASE"));

export const createPermissionSchema = z.object({
  key: permissionKey,
  label: trimmed(1, 200),
  description: optionalText(500),
  category: z.enum(["ADMIN_MANAGEMENT", "STUDENT_DATA_FIELD", "TEACHER_CAPABILITY", "ASSESSMENT_AND_MARKS"]),
});
export const updatePermissionSchema = z.object({
  label: trimmed(1, 200).optional(),
  description: optionalText(500),
});

export const createAdminRoleSchema = z.object({ key: permissionKey, label: trimmed(1, 100) });
export const updateAdminRoleSchema = z.object({ label: trimmed(1, 100) });

// ── Teacher: assignments ─────────────────────────────────────────────────────

export const createAssignmentSchema = z.object({
  subjectId: id,
  title: trimmed(1, 300),
  description: optionalText(5000),
  dueAt: isoDate,
  maxMarks: z.number().int().min(1).max(1000).nullable().optional(),
});

export const updateAssignmentSchema = z
  .object({
    title: trimmed(1, 300),
    description: optionalText(5000),
    dueAt: isoDate,
    maxMarks: z.number().int().min(1).max(1000).nullable(),
  })
  .partial()
  .strict();

export const gradeSubmissionSchema = z.object({
  marksAwarded: z.number().int().min(0).max(1000),
  feedback: optionalText(2000),
});

// ── Academics: deadlines ─────────────────────────────────────────────────────

export const createDeadlineSchema = z.object({
  subjectId: id,
  title: trimmed(1, 200),
  description: optionalText(2000),
  dueAt: isoDate,
});

export const updateDeadlineSchema = z
  .object({
    title: trimmed(1, 200),
    description: optionalText(2000),
    dueAt: isoDate,
  })
  .partial()
  .strict();

// ── Academics: teacher resources ─────────────────────────────────────────────

const folderName = trimmed(1, 100).refine((v) => !/[\\/]/.test(v), "Folder name can't contain slashes");

export const createResourceFolderSchema = z.object({
  name: folderName,
  order: z.number().int().min(0).max(1000).optional(),
});

export const updateResourceFolderSchema = z
  .object({ name: folderName, order: z.number().int().min(0).max(1000) })
  .partial()
  .strict();

export const createResourceFileSchema = z.object({
  title: trimmed(1, 200),
  fileUrl: httpUrl,
  fileName: optionalText(255),
});

// ── Academics: Share with Peers ──────────────────────────────────────────────

export const peerResourceCategory = z.enum([
  "PREVIOUS_YEAR_PAPER",
  "LAB_MANUAL",
  "REFERENCE_MATERIAL",
  "USEFUL_LINK",
  "CHEATSHEET",
  "OTHER",
]);
export const peerResourceScope = z.enum(["CLASS", "BRANCH", "SEMESTER"]);

export const createPeerResourceSchema = z
  .object({
    title: trimmed(1, 200),
    description: optionalText(2000),
    category: peerResourceCategory.default("OTHER"),
    subjectId: id.nullable().optional(),
    scope: peerResourceScope,
    fileUrl: httpUrl.nullable().optional(),
    fileName: optionalText(255),
    linkUrl: httpUrl.nullable().optional(),
  })
  .strict()
  .refine((v) => !!v.fileUrl !== !!v.linkUrl, {
    message: "Attach either a file or a link (not both).",
    path: ["fileUrl"],
  });
