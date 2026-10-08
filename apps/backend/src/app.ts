import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import { env } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import meRoutes from "./routes/me.routes.js";
import teacherRoutes from "./routes/teacher.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import peerModerationRoutes from "./routes/peerModeration.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

function corsOrigin(): cors.CorsOptions["origin"] {
  const configured = (process.env["ALLOWED_ORIGINS"] ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (configured.length > 0) return configured;
  // Dev convenience only; in production ALLOWED_ORIGINS must list the admin panel origin(s).
  // (The mobile app is not subject to CORS.)
  return env.NODE_ENV === "production" ? false : true;
}

export function createApp() {
  const app = express();

  // Behind one reverse proxy / load balancer — needed for correct client IPs in rate limiting.
  app.set("trust proxy", Number(process.env["TRUST_PROXY_HOPS"] ?? 1));
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(cors({ origin: corsOrigin(), credentials: true }));
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
  app.use(express.json({ limit: "2mb" }));
  app.use(express.text({ type: ["text/csv", "application/csv"], limit: "5mb" }));
  app.use(express.urlencoded({ extended: false, limit: "100kb" }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", ts: new Date().toISOString() });
  });

  app.use("/auth", authRoutes);
  app.use("/me", meRoutes);
  app.use("/teacher", teacherRoutes);
  app.use("/admin/peer-resources", peerModerationRoutes); // ADMIN + TEACHER — must precede /admin
  app.use("/admin", adminRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
