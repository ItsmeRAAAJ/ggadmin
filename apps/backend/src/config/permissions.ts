import type { PermissionCategory, TeacherTier } from "@prisma/client";

/**
 * Permission keys referenced in code. The master list lives in the Permission table (seeded from
 * PERMISSION_SEED); new keys can be added at runtime, but keys used here must never be renamed.
 */
export const PERMISSIONS = {
  MANAGE_ADMIN_HIERARCHY: "MANAGE_ADMIN_HIERARCHY",
  MANAGE_ADMIN_ROLES: "MANAGE_ADMIN_ROLES",
  MANAGE_STUDENTS: "MANAGE_STUDENTS",
  VIEW_STUDENTS: "VIEW_STUDENTS",
  EXPORT_STUDENT_PROFILES: "EXPORT_STUDENT_PROFILES",
  MANAGE_ACADEMIC_STRUCTURE: "MANAGE_ACADEMIC_STRUCTURE",
  MANAGE_TEACHERS: "MANAGE_TEACHERS",
  VIEW_AUDIT_LOGS: "VIEW_AUDIT_LOGS",
  VIEW_STUDENT_MOBILE_NUMBER: "VIEW_STUDENT_MOBILE_NUMBER",
  VIEW_STUDENT_EMAIL: "VIEW_STUDENT_EMAIL",
  VIEW_STUDENT_ADDRESS: "VIEW_STUDENT_ADDRESS",
  MANAGE_TEACHER_ASSIGNMENTS: "MANAGE_TEACHER_ASSIGNMENTS",
  CREATE_ASSIGNMENT: "CREATE_ASSIGNMENT",
  VIEW_STUDENT_MARKS: "VIEW_STUDENT_MARKS",
  MODERATE_PEER_RESOURCES: "MODERATE_PEER_RESOURCES",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_SEED: { key: PermissionKey; label: string; description: string; category: PermissionCategory }[] = [
  { key: "MANAGE_ADMIN_HIERARCHY", label: "Create/manage admins below you", description: "Create admins under yourself and grant/revoke their permissions.", category: "ADMIN_MANAGEMENT" },
  { key: "MANAGE_ADMIN_ROLES", label: "Create/edit admin role types", description: "Maintain admin role types and the permission master list.", category: "ADMIN_MANAGEMENT" },
  { key: "MANAGE_STUDENTS", label: "Seed and add students", description: "Bulk-seed students from CSV/JSON and add students manually.", category: "ADMIN_MANAGEMENT" },
  { key: "VIEW_STUDENTS", label: "View student directory", description: "Browse and filter student profiles.", category: "ADMIN_MANAGEMENT" },
  { key: "EXPORT_STUDENT_PROFILES", label: "Export student data (CSV)", description: "Download filtered student profiles as CSV.", category: "ADMIN_MANAGEMENT" },
  { key: "MANAGE_ACADEMIC_STRUCTURE", label: "Manage branches & subjects", description: "Create and edit branches and subjects.", category: "ADMIN_MANAGEMENT" },
  { key: "MANAGE_TEACHERS", label: "Manage teachers", description: "Create teachers, set tier/reporting line and manage their permissions.", category: "ADMIN_MANAGEMENT" },
  { key: "VIEW_AUDIT_LOGS", label: "View audit log", description: "Read the audit trail of sensitive actions.", category: "ADMIN_MANAGEMENT" },
  { key: "VIEW_STUDENT_MOBILE_NUMBER", label: "View student mobile number", description: "See students' phone numbers in listings and exports.", category: "STUDENT_DATA_FIELD" },
  { key: "VIEW_STUDENT_EMAIL", label: "View student email", description: "See students' email addresses in listings and exports.", category: "STUDENT_DATA_FIELD" },
  { key: "VIEW_STUDENT_ADDRESS", label: "View student address", description: "See students' address details.", category: "STUDENT_DATA_FIELD" },
  { key: "MANAGE_TEACHER_ASSIGNMENTS", label: "Assign teachers to subjects within scope", description: "Assign/unassign teachers to subjects inside your scope.", category: "TEACHER_CAPABILITY" },
  { key: "CREATE_ASSIGNMENT", label: "Create assignments", description: "Create and publish assignments for your subjects.", category: "TEACHER_CAPABILITY" },
  { key: "MODERATE_PEER_RESOURCES", label: "Moderate Share with Peers", description: "Remove any student's post from the Share with Peers feed.", category: "TEACHER_CAPABILITY" },
  { key: "VIEW_STUDENT_MARKS", label: "View student marks/scores", description: "See marks outside the subjects you teach.", category: "ASSESSMENT_AND_MARKS" },
];

/** Grants every new teacher receives on creation (revocable afterwards). */
export const DEFAULT_TEACHER_GRANTS: Record<TeacherTier, PermissionKey[]> = {
  SUBJECT_TEACHER: ["CREATE_ASSIGNMENT"],
  INCHARGE: ["CREATE_ASSIGNMENT", "MANAGE_TEACHER_ASSIGNMENTS"],
  HOD: ["CREATE_ASSIGNMENT", "MANAGE_TEACHER_ASSIGNMENTS"],
};

/** Categories that make sense to grant to teachers (admin-management keys are admin-only). */
export const TEACHER_GRANTABLE_CATEGORIES: PermissionCategory[] = [
  "STUDENT_DATA_FIELD",
  "TEACHER_CAPABILITY",
  "ASSESSMENT_AND_MARKS",
];

export const SUPERADMIN_ROLE_KEY = "SUPERADMIN";
