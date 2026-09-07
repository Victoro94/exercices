-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'COMPLETE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'READY');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepositRequest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "expectedDocs" INTEGER NOT NULL DEFAULT 4,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepositRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "s3Key" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "ipHash" TEXT,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DepositRequest_token_key" ON "DepositRequest"("token");

-- CreateIndex
CREATE INDEX "DepositRequest_userId_idx" ON "DepositRequest"("userId");

-- CreateIndex
CREATE INDEX "DepositRequest_expiresAt_idx" ON "DepositRequest"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Document_s3Key_key" ON "Document"("s3Key");

-- CreateIndex
CREATE INDEX "Document_requestId_idx" ON "Document"("requestId");

-- CreateIndex
CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");

-- AddForeignKey
ALTER TABLE "DepositRequest" ADD CONSTRAINT "DepositRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "DepositRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "DepositRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

