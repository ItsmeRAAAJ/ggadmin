import { Router } from "express";
import * as auth from "../controllers/auth.controller.js";
import { authenticate, authenticateOnboarding, authenticateReset } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { authIpLimiter, loginIdentifierLimiter, otpIdentifierLimiter } from "../middleware/rateLimit.js";
import {
  lookupSchema,
  resendOtpSchema,
  verifyOtpSchema,
  onboardSchema,
  loginSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "../schemas/index.js";

const router = Router();

router.use(authIpLimiter);

// Public
router.get("/login-categories", auth.loginCategories);
router.post("/lookup", validate(lookupSchema), otpIdentifierLimiter, auth.lookup);
router.post("/resend-otp", validate(resendOtpSchema), otpIdentifierLimiter, auth.resendOtp);
router.post("/verify-otp", validate(verifyOtpSchema), otpIdentifierLimiter, auth.verifyOtpHandler);
router.post("/login", validate(loginSchema), loginIdentifierLimiter, auth.login);
router.post("/request-password-reset", validate(requestPasswordResetSchema), otpIdentifierLimiter, auth.requestPasswordReset);
router.post("/logout", auth.logout);

// Short-lived purpose tokens
router.post("/onboard", authenticateOnboarding, validate(onboardSchema), auth.onboard);
router.post("/reset-password", authenticateReset, validate(resetPasswordSchema), auth.resetPassword);

// Session
router.get("/me", authenticate, auth.me);
router.post("/change-password", authenticate, validate(changePasswordSchema), auth.changePassword);
router.post("/logout-all", authenticate, auth.logoutAll);

export default router;
