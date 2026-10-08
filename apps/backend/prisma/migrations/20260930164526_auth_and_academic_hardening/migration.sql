-- DropForeignKey
ALTER TABLE "Question" DROP CONSTRAINT "Question_assessmentId_fkey";

-- DropForeignKey
ALTER TABLE "QuestionOption" DROP CONSTRAINT "QuestionOption_questionId_fkey";

-- DropIndex
DROP INDEX "OtpVerification_userId_purpose_idx";

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "instructions" TEXT;

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "maxMarks" INTEGER;

-- AlterTable
ALTER TABLE "OtpVerification" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "OtpVerification_userId_purpose_createdAt_idx" ON "OtpVerification"("userId", "purpose", "createdAt");

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionOption" ADD CONSTRAINT "QuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
