-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('http', 'queue', 'internal');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('success', 'failed', 'running');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('success', 'failed', 'timeout');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passhash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Berlin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "scheduleCron" TEXT,
    "scheduleHuman" TEXT,
    "tz" TEXT NOT NULL DEFAULT 'Europe/Berlin',
    "targetUrl" TEXT,
    "targetMethod" TEXT,
    "headersJson" JSONB,
    "bodyTemplate" JSONB,
    "queueName" TEXT,
    "messageTemplate" JSONB,
    "internalHandler" TEXT,
    "handlerArgsJson" JSONB,
    "retryMax" INTEGER NOT NULL DEFAULT 3,
    "timeoutMs" INTEGER NOT NULL DEFAULT 15000,
    "concurrency" INTEGER NOT NULL DEFAULT 1,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobNextFire" (
    "jobId" TEXT NOT NULL,
    "nextAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "JobNextFire_pkey" PRIMARY KEY ("jobId","nextAt")
);

-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "triggerAt" TIMESTAMP(3) NOT NULL,
    "status" "RunStatus" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "firstError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "attemptNo" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "status" "AttemptStatus" NOT NULL,
    "httpStatus" INTEGER,
    "latencyMs" INTEGER,
    "errorMsg" TEXT,
    "responseExcerpt" TEXT,
    "idempotencyKey" TEXT,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "JobNextFire_nextAt_idx" ON "JobNextFire"("nextAt");

-- CreateIndex
CREATE INDEX "Run_jobId_createdAt_idx" ON "Run"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "Attempt_status_idx" ON "Attempt"("status");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobNextFire" ADD CONSTRAINT "JobNextFire_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
