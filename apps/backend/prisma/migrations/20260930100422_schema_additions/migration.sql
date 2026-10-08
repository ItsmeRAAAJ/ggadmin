-- CreateEnum
CREATE TYPE "PermissionCategory" AS ENUM ('ADMIN_MANAGEMENT', 'STUDENT_DATA_FIELD', 'TEACHER_CAPABILITY', 'ASSESSMENT_AND_MARKS');

-- CreateEnum
CREATE TYPE "TeacherTier" AS ENUM ('HOD', 'INCHARGE', 'SUBJECT_TEACHER');

-- CreateEnum
CREATE TYPE "AchievementCategory" AS ENUM ('ACADEMIC', 'CO_CURRICULAR', 'EXTRA_CURRICULAR');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'SUBMITTED', 'LATE', 'GRADED');

-- AlterTable
ALTER TABLE "Achievement" ADD COLUMN     "category" "AchievementCategory" NOT NULL DEFAULT 'ACADEMIC';

-- AlterTable
ALTER TABLE "AdminProfile" ADD COLUMN     "parentAdminId" TEXT;

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "nonTechResumeUrl" TEXT,
ADD COLUMN     "techResumeUrl" TEXT;

-- AlterTable
ALTER TABLE "TeacherProfile" ADD COLUMN     "primaryBranchId" TEXT,
ADD COLUMN     "reportsToId" TEXT,
ADD COLUMN     "tier" "TeacherTier" NOT NULL DEFAULT 'SUBJECT_TEACHER';

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "category" "PermissionCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminPermissionGrant" (
    "id" TEXT NOT NULL,
    "adminProfileId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "grantedByUserId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminPermissionGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherPermissionGrant" (
    "id" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "grantedByUserId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherPermissionGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentSubmission" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "fileUrl" TEXT,
    "submittedAt" TIMESTAMP(3),
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "marksAwarded" INTEGER,
    "feedback" TEXT,

    CONSTRAINT "AssignmentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE UNIQUE INDEX "AdminPermissionGrant_adminProfileId_permissionId_key" ON "AdminPermissionGrant"("adminProfileId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherPermissionGrant_teacherProfileId_permissionId_key" ON "TeacherPermissionGrant"("teacherProfileId", "permissionId");

-- CreateIndex
CREATE INDEX "Assignment_subjectId_status_idx" ON "Assignment"("subjectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentSubmission_assignmentId_studentProfileId_key" ON "AssignmentSubmission"("assignmentId", "studentProfileId");

-- AddForeignKey
ALTER TABLE "TeacherProfile" ADD CONSTRAINT "TeacherProfile_reportsToId_fkey" FOREIGN KEY ("reportsToId") REFERENCES "TeacherProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherProfile" ADD CONSTRAINT "TeacherProfile_primaryBranchId_fkey" FOREIGN KEY ("primaryBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminProfile" ADD CONSTRAINT "AdminProfile_parentAdminId_fkey" FOREIGN KEY ("parentAdminId") REFERENCES "AdminProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminPermissionGrant" ADD CONSTRAINT "AdminPermissionGrant_adminProfileId_fkey" FOREIGN KEY ("adminProfileId") REFERENCES "AdminProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminPermissionGrant" ADD CONSTRAINT "AdminPermissionGrant_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminPermissionGrant" ADD CONSTRAINT "AdminPermissionGrant_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherPermissionGrant" ADD CONSTRAINT "TeacherPermissionGrant_teacherProfileId_fkey" FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherPermissionGrant" ADD CONSTRAINT "TeacherPermissionGrant_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherPermissionGrant" ADD CONSTRAINT "TeacherPermissionGrant_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
