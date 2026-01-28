-- CreateTable
CREATE TABLE "qbo_tokens" (
    "id" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "realmId" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qbo_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "qbo_tokens_realmId_key" ON "qbo_tokens"("realmId");

-- CreateIndex
CREATE INDEX "qbo_tokens_expiresAt_idx" ON "qbo_tokens"("expiresAt");
