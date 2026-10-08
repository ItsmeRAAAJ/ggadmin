import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import * as profile from "../controllers/profile.controller.js";
import * as assignment from "../controllers/assignment.controller.js";
import * as academics from "../controllers/academics.controller.js";
import * as peers from "../controllers/peerResource.controller.js";
import {
  updateProfileSchema,
  uploadRequestSchema,
  confirmUploadSchema,
  createCertificateSchema,
  updateCertificateSchema,
  createProjectSchema,
  updateProjectSchema,
  createAchievementSchema,
  updateAchievementSchema,
  createSocialLinkSchema,
  updateSocialLinkSchema,
  createPeerResourceSchema,
} from "../schemas/index.js";

const router = Router();

router.use(authenticate, requireRole("STUDENT"));

// ── Profile ─────────────────────────────────────────────────────────────────
router.get("/profile", profile.getMyProfile);
router.patch("/profile", validate(updateProfileSchema), profile.updateMyProfile);

// Photo: POST → presigned PUT, PUT → confirm, DELETE → remove
router.post("/profile/photo", validate(uploadRequestSchema), profile.requestPhotoUpload);
router.put("/profile/photo", validate(confirmUploadSchema), profile.confirmPhotoUpload);
router.delete("/profile/photo", profile.deletePhoto);

// Resumes: :kind = tech | non-tech
router.post("/profile/resume/:kind", validate(uploadRequestSchema), profile.requestResumeUpload);
router.put("/profile/resume/:kind", validate(confirmUploadSchema), profile.confirmResumeUpload);
router.delete("/profile/resume/:kind", profile.deleteResume);

// Presigned uploads for supporting documents
router.post("/profile/certificate-upload", validate(uploadRequestSchema), profile.requestCertificateUpload);
router.post("/profile/achievement-upload", validate(uploadRequestSchema), profile.requestAchievementUpload);

// ── Certificates / projects / achievements / social links ───────────────────
router.post("/certificates", validate(createCertificateSchema), profile.addCertificate);
router.patch("/certificates/:id", validate(updateCertificateSchema), profile.updateCertificate);
router.delete("/certificates/:id", profile.deleteCertificate);

router.post("/projects", validate(createProjectSchema), profile.addProject);
router.patch("/projects/:id", validate(updateProjectSchema), profile.updateProject);
router.delete("/projects/:id", profile.deleteProject);

router.post("/achievements", validate(createAchievementSchema), profile.addAchievement);
router.patch("/achievements/:id", validate(updateAchievementSchema), profile.updateAchievement);
router.delete("/achievements/:id", profile.deleteAchievement);

router.post("/social-links", validate(createSocialLinkSchema), profile.addSocialLink);
router.patch("/social-links/:id", validate(updateSocialLinkSchema), profile.updateSocialLink);
router.delete("/social-links/:id", profile.deleteSocialLink);

// ── Assignments ─────────────────────────────────────────────────────────────
router.get("/assignments", assignment.getMyAssignments);
router.get("/assignments/:id", assignment.getAssignmentDetail);
router.post("/assignments/:id/upload-url", validate(uploadRequestSchema), assignment.requestSubmissionUpload);
router.post("/assignments/:id/submit", validate(confirmUploadSchema), assignment.submitAssignment);

// ── Academics: deadlines, subjects & resources ──────────────────────────────
router.get("/deadlines", academics.getMyDeadlines);
router.get("/subjects", academics.getMySubjects);
router.get("/subjects/:subjectId/resources", academics.getSubjectResources);
router.get("/resource-folders/:id", academics.getResourceFolder);

// ── Share with Peers ────────────────────────────────────────────────────────
router.post("/peer-resources/upload-url", validate(uploadRequestSchema), peers.requestPeerUpload);
router.get("/peer-resources", peers.listPeerResources);
router.post("/peer-resources", validate(createPeerResourceSchema), peers.createPeerResource);
router.delete("/peer-resources/:id", peers.deleteMyPeerResource);

export default router;
