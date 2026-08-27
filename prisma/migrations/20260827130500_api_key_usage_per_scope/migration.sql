-- AlterTable
ALTER TABLE "ApiKeyUsage" ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'default';

-- DropIndex
DROP INDEX "ApiKeyUsage_apiKeyId_windowStart_key";

-- CreateIndex
CREATE UNIQUE INDEX "ApiKeyUsage_apiKeyId_scope_windowStart_key" ON "ApiKeyUsage"("apiKeyId", "scope", "windowStart");
