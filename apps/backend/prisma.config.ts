// prisma.config.ts — Prisma 7 config
// DATABASE_URL is read from process.env.
// - Local dev: dotenv loads it from apps/backend/.env
// - Docker: already in process.env via docker-compose environment block
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL as string,
  },
});