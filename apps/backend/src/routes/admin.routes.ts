import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { requireAnyPermission, requirePermission } from "../middleware/requirePermission.js";
import { validate } from "../middleware/validate.js";
import { PERMISSIONS as P } from "../config/permissions.js";
import * as students from "../controllers/adminStudents.controller.js";
import * as academic from "../controllers/adminAcademic.controller.js";
import * as staff from "../controllers/adminStaff.controller.js";
import * as placement from "../controllers/adminPlacement.controller.js";
import {
  seedStudentSchema,
  updateStudentSchema,
  bulkSemesterSchema,
  createBranchSchema,
  updateBranchSchema,
  createSubjectSchema,
  updateSubjectSchema,
  createTeacherAssignmentSchema,
  createTeacherSchema,
  updateTeacherSchema,
  createAdminSchema,
  updateAdminSchema,
  grantPermissionSchema,
  createPermissionSchema,
  updatePermissionSchema,
  createAdminRoleSchema,
  updateAdminRoleSchema,
} from "../schemas/index.js";

const router = Router();

router.use(authenticate, requireRole("ADMIN"));

router.get("/dashboard", staff.getDashboard);

// ── Students ────────────────────────────────────────────────────────────────
router.post("/students/seed", requirePermission(P.MANAGE_STUDENTS), students.seedStudentsHandler);
router.post("/students/bulk-semester", requirePermission(P.MANAGE_STUDENTS), validate(bulkSemesterSchema), students.bulkSetSemester);
router.get("/students/export", requirePermission(P.EXPORT_STUDENT_PROFILES), students.exportStudents);
router.post("/students", requirePermission(P.MANAGE_STUDENTS), validate(seedStudentSchema), students.addStudent);
router.get("/students", requirePermission(P.VIEW_STUDENTS), students.listStudents);
router.get("/students/:id", requirePermission(P.VIEW_STUDENTS), students.getStudent);
router.patch("/students/:id", requirePermission(P.MANAGE_STUDENTS), validate(updateStudentSchema), students.updateStudent);

// ── Student Portfolio (complete profiles, branch-wise) ─────────────────────────
router.get("/portfolio/branches", requirePermission(P.EXPORT_STUDENT_PROFILES), placement.listPlacementBranches);
router.get("/portfolio/branches/:branchCode/students", requirePermission(P.EXPORT_STUDENT_PROFILES), placement.listBranchProfiles);
router.get("/portfolio/students/:id", requirePermission(P.EXPORT_STUDENT_PROFILES), placement.getPlacementProfile);

// ── Academic structure ──────────────────────────────────────────────────────
router.get("/branches", academic.listBranches);
router.post("/branches", requirePermission(P.MANAGE_ACADEMIC_STRUCTURE), validate(createBranchSchema), academic.createBranch);
router.patch("/branches/:id", requirePermission(P.MANAGE_ACADEMIC_STRUCTURE), validate(updateBranchSchema), academic.updateBranch);

router.get("/subjects", academic.listSubjects);
router.post("/subjects", requirePermission(P.MANAGE_ACADEMIC_STRUCTURE), validate(createSubjectSchema), academic.createSubject);
router.patch("/subjects/:id", requirePermission(P.MANAGE_ACADEMIC_STRUCTURE), validate(updateSubjectSchema), academic.updateSubject);
router.delete("/subjects/:id", requirePermission(P.MANAGE_ACADEMIC_STRUCTURE), academic.deleteSubject);

router.get("/teacher-assignments", requireAnyPermission(P.MANAGE_TEACHER_ASSIGNMENTS, P.MANAGE_TEACHERS), academic.listTeacherAssignments);
router.post("/teacher-assignments", requirePermission(P.MANAGE_TEACHER_ASSIGNMENTS), validate(createTeacherAssignmentSchema), academic.createTeacherAssignment);
router.delete("/teacher-assignments/:id", requirePermission(P.MANAGE_TEACHER_ASSIGNMENTS), academic.deleteTeacherAssignment);

// ── Teachers ────────────────────────────────────────────────────────────────
router.get("/teachers", requireAnyPermission(P.MANAGE_TEACHERS, P.MANAGE_TEACHER_ASSIGNMENTS), staff.listTeachers);
router.post("/teachers", requirePermission(P.MANAGE_TEACHERS), validate(createTeacherSchema), staff.createTeacher);
router.get("/teachers/:id", requireAnyPermission(P.MANAGE_TEACHERS, P.MANAGE_TEACHER_ASSIGNMENTS), staff.getTeacher);
router.patch("/teachers/:id", requirePermission(P.MANAGE_TEACHERS), validate(updateTeacherSchema), staff.updateTeacher);
router.post("/teachers/:id/permissions", requirePermission(P.MANAGE_TEACHERS), validate(grantPermissionSchema), staff.grantTeacherPermission);
router.delete("/teachers/:id/permissions/:permissionKey", requirePermission(P.MANAGE_TEACHERS), staff.revokeTeacherPermission);

// ── Admins (hierarchy-scoped inside the controller) ─────────────────────────
router.get("/admins", staff.listAdmins);
router.post("/admins", requirePermission(P.MANAGE_ADMIN_HIERARCHY), validate(createAdminSchema), staff.createAdmin);
router.get("/admins/:id", staff.getAdmin);
router.patch("/admins/:id", validate(updateAdminSchema), staff.updateAdmin);
router.post("/admins/:id/permissions", validate(grantPermissionSchema), staff.grantAdminPermission);
router.delete("/admins/:id/permissions/:permissionKey", staff.revokeAdminPermission);

// ── Permission master list & role types ─────────────────────────────────────
router.get("/permissions", staff.listPermissions);
router.post("/permissions", requirePermission(P.MANAGE_ADMIN_ROLES), validate(createPermissionSchema), staff.createPermission);
router.patch("/permissions/:id", requirePermission(P.MANAGE_ADMIN_ROLES), validate(updatePermissionSchema), staff.updatePermission);

router.get("/admin-roles", staff.listAdminRoles);
router.post("/admin-roles", validate(createAdminRoleSchema), staff.createAdminRole);
router.patch("/admin-roles/:id", validate(updateAdminRoleSchema), staff.updateAdminRole);

// ── Audit log ───────────────────────────────────────────────────────────────
router.get("/audit-logs", requirePermission(P.VIEW_AUDIT_LOGS), staff.listAuditLogs);

export default router;
