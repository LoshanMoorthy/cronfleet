import dotenv from "dotenv";
import { Prisma, PrismaClient } from "@prisma/client";
import { nextFireFrom } from "./time";

dotenv.config();

const prisma = new PrismaClient();
const BATCH = 50;

/**
 * Runs one pass: locks due jobs, advances nextAt, writes a 'running' Run.
 * Returns how many items were processed.
 */
async function tickOnce(): Promise<number> {
  const due = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const rows = await tx.$queryRaw<
      { job_id: string; next_at: Date; version: number }[]
    >`
      SELECT "jobId" as job_id, "nextAt" as next_at, "version"
      FROM "JobNextFire"
      WHERE "nextAt" <= (NOW() AT TIME ZONE 'UTC')
      ORDER BY "nextAt" ASC
      LIMIT ${BATCH}
      FOR UPDATE SKIP LOCKED
    `;

    for (const row of rows) {
      const job = await tx.job.findUnique({ where: { id: row.job_id } });
      if (!job || job.paused || !job.scheduleCron) continue;

      console.log(`[scheduler] dispatch ${job.name} (${job.id}) @ ${row.next_at.toISOString()}`);

      let nextAtUtc: Date;
      try {
        nextAtUtc = nextFireFrom(job.scheduleCron, job.tz, new Date().toISOString());
      } catch (e) {
        console.error(`[scheduler] invalid cron for job ${job.id}:`, e);
        continue;
      }

      await tx.$executeRaw`
        UPDATE "JobNextFire"
        SET "nextAt" = ${nextAtUtc}, "version" = "version" + 1
        WHERE "jobId" = ${row.job_id} AND "nextAt" = ${row.next_at}
      `;

      await tx.run.create({
        data: {
          jobId: job.id,
          projectId: job.projectId,
          triggerAt: row.next_at,
          status: "running",
          attempts: 0,
        },
      });
    }

    return rows.length;
  });

  return due;
}

async function main() {
  console.log("[scheduler] started");
  let processedTotal = 0;
  while (true) {
    const processed = await tickOnce();
    processedTotal += processed;
    if (processed === 0) break;
  }
  console.log(`[scheduler] idle (processed ${processedTotal})`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("[scheduler] fatal", e);
  process.exit(1);
});