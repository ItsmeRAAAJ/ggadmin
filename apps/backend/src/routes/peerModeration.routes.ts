/**
 * Share with Peers moderation — open to ADMIN and TEACHER accounts holding MODERATE_PEER_RESOURCES
 * (super admin always passes). Mounted at /admin/peer-resources ahead of the ADMIN-only /admin router.
 */
import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { PERMISSIONS } from "../config/permissions.js";
import * as peers from "../controllers/peerResource.controller.js";

const router = Router();

router.use(authenticate, requireRole("ADMIN", "TEACHER"), requirePermission(PERMISSIONS.MODERATE_PEER_RESOURCES));

router.get("/", peers.moderationList);
router.delete("/:id", peers.moderationDelete);

export default router;
