/*
  Warnings:

  - You are about to drop the `Assessment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AssessmentAttempt` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Question` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QuestionOption` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StudentAnswer` table. If the table is not empty, all the data it contains will be lost.

*/
-- Remove the retired CREATE_ASSESSMENT permission (and any grants of it) from the master list.
DELETE FROM "TeacherPermissionGrant" WHERE "permissionId" IN (SELECT "id" FROM "Permission" WHERE "key" = 'CREATE_ASSESSMENT');
DELETE FROM "AdminPermissionGrant" WHERE "permissionId" IN (SELECT "id" FROM "Permission" WHERE "key" = 'CREATE_ASSESSMENT');
DELETE FROM "Permission" WHERE "key" = 'CREATE_ASSESSMENT';

-- CreateEnum
CREATE TYPE "PeerResourceCategory" AS ENUM ('PREVIOUS_YEAR_PAPER', 'LAB_MANUAL', 'REFERENCE_MATERIAL', 'USEFUL_LINK', 'CHEATSHEET', 'OTHER');

-- CreateEnum
CREATE TYPE "PeerResourceScope" AS ENUM ('CLASS', 'BRANCH', 'SEMESTER');

-- DropForeignKey
ALTER TABLE "Assessment" DROP CONSTRAINT "Assessment_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Assessment" DROP CONSTRAINT "Assessment_subjectId_fkey";

-- DropForeignKey
ALTER TABLE "AssessmentAttempt" DROP CONSTRAINT "AssessmentAttempt_assessmentId_fkey";

-- DropForeignKey
ALTER TABLE "AssessmentAttempt" DROP CONSTRAINT "AssessmentAttempt_studentProfileId_fkey";

-- DropForeignKey
ALTER TABLE "Question" DROP CONSTRAINT "Question_assessmentId_fkey";

-- DropForeignKey
ALTER TABLE "QuestionOption" DROP CONSTRAINT "QuestionOption_questionId_fkey";

-- DropForeignKey
ALTER TABLE "StudentAnswer" DROP CONSTRAINT "StudentAnswer_attemptId_fkey";

-- DropForeignKey
ALTER TABLE "StudentAnswer" DROP CONSTRAINT "StudentAnswer_questionId_fkey";

-- DropForeignKey
ALTER TABLE "StudentAnswer" DROP CONSTRAINT "StudentAnswer_selectedOptionId_fkey";

-- DropTable
DROP TABLE "Assessment";

-- DropTable
DROP TABLE "AssessmentAttempt";

-- DropTable
DROP TABLE "Question";

-- DropTable
DROP TABLE "QuestionOption";

-- DropTable
DROP TABLE "StudentAnswer";

-- DropEnum
DROP TYPE "AssessmentStatus";

-- DropEnum
DROP TYPE "AssessmentType";

-- DropEnum
DROP TYPE "AttemptStatus";

-- DropEnum
DROP TYPE "QuestionType";

-- CreateTable
CREATE TABLE "AcademicDeadline" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicDeadline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceFolder" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceFile" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeerResource" (
    "id" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "PeerResourceCategory" NOT NULL DEFAULT 'OTHER',
    "subjectId" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "linkUrl" TEXT,
    "scope" "PeerResourceScope" NOT NULL,
    "scopeBranchId" TEXT NOT NULL,
    "scopeSemester" INTEGER,
    "scopeSection" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeerResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AcademicDeadline_subjectId_dueAt_idx" ON "AcademicDeadline"("subjectId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceFolder_subjectId_name_key" ON "ResourceFolder"("subjectId", "name");

-- CreateIndex
CREATE INDEX "ResourceFile_folderId_createdAt_idx" ON "ResourceFile"("folderId", "createdAt");

-- CreateIndex
CREATE INDEX "PeerResource_scopeBranchId_scopeSemester_scopeSection_idx" ON "PeerResource"("scopeBranchId", "scopeSemester", "scopeSection");

-- CreateIndex
CREATE INDEX "PeerResource_category_idx" ON "PeerResource"("category");

-- CreateIndex
CREATE INDEX "PeerResource_createdAt_idx" ON "PeerResource"("createdAt");

-- CreateIndex
CREATE INDEX "PeerResource_uploadedById_idx" ON "PeerResource"("uploadedById");

-- AddForeignKey
ALTER TABLE "AcademicDeadline" ADD CONSTRAINT "AcademicDeadline_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicDeadline" ADD CONSTRAINT "AcademicDeadline_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceFolder" ADD CONSTRAINT "ResourceFolder_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceFolder" ADD CONSTRAINT "ResourceFolder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceFile" ADD CONSTRAINT "ResourceFile_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "ResourceFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceFile" ADD CONSTRAINT "ResourceFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeerResource" ADD CONSTRAINT "PeerResource_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeerResource" ADD CONSTRAINT "PeerResource_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
