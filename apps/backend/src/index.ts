import "./config/env.js"; // validates env vars first
import { env } from "./config/env.js";
import { createApp } from "./app.js";
import prisma from "./db/prisma.js";

const app = createApp();

async function start() {
  try {
    await prisma.$connect();
    console.log("Database connected");
  } catch (err) {
    console.error("Database connection failed:", err);
    process.exit(1);
  }

  app.listen(env.PORT, () => {
    console.log(`${env.APP_NAME} backend running on port ${env.PORT}`);
    console.log(`   ENV: ${env.NODE_ENV}`);
  });
}

start();

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received. Closing Prisma...");
  await prisma.$disconnect();
  process.exit(0);
});
