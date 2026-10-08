import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { validate } from "../middleware/validate.js";
import { PERMISSIONS } from "../config/permissions.js";
import * as teacher from "../controllers/teacher.controller.js";
import * as assignments from "../controllers/teacherAssignment.controller.js";
import * as deadlines from "../controllers/teacherDeadline.controller.js";
import * as resources from "../controllers/teacherResource.controller.js";
import {
  createAssignmentSchema,
  updateAssignmentSchema,
  gradeSubmissionSchema,
  createTeacherAssignmentSchema,
  grantPermissionSchema,
  createDeadlineSchema,
  updateDeadlineSchema,
  createResourceFolderSchema,
  updateResourceFolderSchema,
  createResourceFileSchema,
  uploadRequestSchema,
} from "../schemas/index.js";

const router = Router();

router.use(authenticate, requireRole("TEACHER"));

// ── Workspace ───────────────────────────────────────────────────────────────
router.get("/dashboard", teacher.getDashboard);
router.get("/subjects", teacher.getMySubjects);
router.get("/hierarchy", teacher.getHierarchy);
router.get("/team", teacher.getTeam);
router.get("/scope-subjects", teacher.getScopeSubjects);
router.get("/permissions", teacher.getMyPermissions);

// ── Team management (HOD / Incharge) ────────────────────────────────────────
router.post("/subject-assignments", validate(createTeacherAssignmentSchema), teacher.createSubjectAssignment);
router.delete("/subject-assignments/:id", teacher.removeSubjectAssignment);
router.post("/team/:teacherId/permissions", validate(grantPermissionSchema), teacher.grantTeamPermission);
router.delete("/team/:teacherId/permissions/:permissionKey", teacher.revokeTeamPermission);

// ── Assignments ─────────────────────────────────────────────────────────────
router.get("/assignments", assignments.listAssignments);
router.post("/assignments", requirePermission(PERMISSIONS.CREATE_ASSIGNMENT), validate(createAssignmentSchema), assignments.createAssignment);
router.get("/assignments/:id", assignments.getAssignment);
router.patch("/assignments/:id", validate(updateAssignmentSchema), assignments.updateAssignment);
router.delete("/assignments/:id", assignments.deleteAssignment);
router.patch("/assignments/:id/publish", assignments.publishAssignment);
router.patch("/assignments/:id/close", assignments.closeAssignment);
router.get("/assignments/:id/summary", assignments.getAssignmentSummary);
router.get("/assignments/:id/submissions", assignments.getSubmissions);
router.patch("/assignments/:id/submissions/:submissionId/grade", validate(gradeSubmissionSchema), assignments.gradeSubmission);

// ── Academic deadlines ──────────────────────────────────────────────────────
router.get("/deadlines", deadlines.listDeadlines);
router.post("/deadlines", validate(createDeadlineSchema), deadlines.createDeadline);
router.patch("/deadlines/:id", validate(updateDeadlineSchema), deadlines.updateDeadline);
router.delete("/deadlines/:id", deadlines.deleteDeadline);

// ── Subject resources (folders → files) ─────────────────────────────────────
router.get("/resources/subjects", resources.listResourceSubjects);
router.get("/subjects/:subjectId/resource-folders", resources.listFolders);
router.post("/subjects/:subjectId/resource-folders", validate(createResourceFolderSchema), resources.createFolder);
router.get("/resource-folders/:id", resources.getFolder);
router.patch("/resource-folders/:id", validate(updateResourceFolderSchema), resources.updateFolder);
router.delete("/resource-folders/:id", resources.deleteFolder);
router.post("/resource-folders/:id/upload-url", validate(uploadRequestSchema), resources.requestFileUpload);
router.post("/resource-folders/:id/files", validate(createResourceFileSchema), resources.addFile);
router.delete("/resource-files/:id", resources.deleteFile);

export default router;
