#!/usr/bin/env tsx
/**
 * seed.ts — One-time seed script for the My GGITS database.
 *
 * Run ONCE after running `prisma migrate dev` or `prisma migrate deploy`:
 *   npx tsx prisma/seed.ts
 *
 * This script creates:
 *   1. All GGITS branches
 *   2. The SUPERADMIN role
 *   3. The initial superadmin user account
 */
import "dotenv/config";
import prisma from "../src/db/prisma.js";
import bcrypt from "bcryptjs";
import { PERMISSION_SEED } from "../src/config/permissions.js";

// ─── Config ──────────────────────────────────────────────────────────────────
const SUPERADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@ggits.ac.in";
const SUPERADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "Admin@GGITS2024!";
if (process.env.NODE_ENV === "production" && !process.env.SEED_ADMIN_PASSWORD) {
  console.error("❌  Set SEED_ADMIN_PASSWORD when seeding a production database.");
  process.exit(1);
}
const SUPERADMIN_NAME = "System Administrator";

// All GGITS branches — update/extend as needed
const BRANCHES = [
  { shortCode: "CSE", name: "Computer Science & Engineering" },
  { shortCode: "AIML", name: "Artificial Intelligence & Machine Learning" },
  { shortCode: "DS", name: "Data Science" },
  { shortCode: "IOTCSBT", name: "Internet of Things, Cyber Security & Blockchain Technology" },
  { shortCode: "CSBS", name: "Computer Science & Business System" },
  { shortCode: "AIR", name: "Artificial Intelligence & robotics" },
  { shortCode: "CSD", name: "Computer Science & Design" },
];

// ─── Seed ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🌱  Starting My GGITS seed...\n");

  // 1. Seed branches
  console.log("📚  Seeding branches...");
  for (const branch of BRANCHES) {
    await prisma.branch.upsert({
      where: { shortCode: branch.shortCode },
      update: { name: branch.name },
      create: branch,
    });
    console.log(`   ✔  ${branch.shortCode} — ${branch.name}`);
  }

  // 2. Seed admin roles
  console.log("\n👑  Seeding admin roles...");
  const superadminRole = await prisma.adminRole.upsert({
    where: { key: "SUPERADMIN" },
    update: { label: "Super Administrator" },
    create: { key: "SUPERADMIN", label: "Super Administrator" },
  });
  console.log(`   ✔  SUPERADMIN role`);

  await prisma.adminRole.upsert({
    where: { key: "TPO" },
    update: { label: "Training & Placement Officer" },
    create: { key: "TPO", label: "Training & Placement Officer" },
  });
  console.log(`   ✔  TPO role`);

  // 2.5 Seed permissions (master list lives in src/config/permissions.ts)
  console.log("\n🔑  Seeding permissions...");
  for (const perm of PERMISSION_SEED) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { category: perm.category },
      create: perm,
    });
  }
  console.log(`   ✔  Seeded ${PERMISSION_SEED.length} permissions`);

  // 3. Seed superadmin user
  console.log("\n🔐  Seeding superadmin user...");
  const existingAdmin = await prisma.user.findUnique({
    where: { email: SUPERADMIN_EMAIL },
  });

  if (existingAdmin) {
    console.log(`   ⚠️  Admin user already exists: ${SUPERADMIN_EMAIL} — skipping.`);
  } else {
    const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, 12);

    const adminUser = await prisma.user.create({
      data: {
        email: SUPERADMIN_EMAIL,
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
        adminProfile: {
          create: {
            name: SUPERADMIN_NAME,
            roleAssignments: {
              create: {
                adminRoleId: superadminRole.id,
              },
            },
          },
        },
      },
    });

    console.log(`   ✔  Created superadmin: ${SUPERADMIN_EMAIL}`);
    console.log(`   ✔  User ID: ${adminUser.id}`);
  }

  console.log("\n✅  Seed complete!\n");
  console.log("─────────────────────────────────────────────────");
  console.log("  Admin Panel Login:");
  console.log(`  Email:    ${SUPERADMIN_EMAIL}`);
  console.log(`  Password: ${process.env.SEED_ADMIN_PASSWORD ? "(from SEED_ADMIN_PASSWORD)" : SUPERADMIN_PASSWORD}`);
  console.log("─────────────────────────────────────────────────");
  console.log("\n  ⚠️  CHANGE THE PASSWORD AFTER FIRST LOGIN in production!\n");
}

main()
  .catch((e) => {
    console.error("❌  Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
