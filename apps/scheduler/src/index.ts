import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { nextFireFrom } from "./time.js";

const prisma = new PrismaClient();

async function runOnce() {
	console.log("[scheduler] tick");

	const now = new Date();

	const due = await prisma.jobNextFire.findMany({
		where: {
			nextAt: { lte: now }
		},
		include: {
			job: true
		},
		orderBy: {
			nextAt: "asc"
		},
		take: 50
	});

	if (due.length === 0) {
		console.log("[scheduler] no due jobs");
		return;
	}

	console.log(`[scheduler] found ${due.length} due jobs`);

	for (const row of due) {
		const job = row.job;
		if (!job) continue;

		if (job.paused) {
			console.log(
				`[scheduler] skip paused job ${job.name} (${job.id}) scheduled at ${row.nextAt.toISOString()}`
			);
			continue;
		}

		// Create a Run entry
		const run = await prisma.run.create({
			data: {
				jobId: job.id,
				projectId: job.projectId,
				triggerAt: new Date(),
				status: "running" as any,
				attempts: 0
			}
		});

		console.log(`[scheduler] dispatch ${job.name} (${run.id})`);

		const next = nextFireFrom(job.scheduleCron!, job.tz!);

		await prisma.jobNextFire.updateMany({
			where: {
				jobId: job.id,
				nextAt: row.nextAt
			},
			data: {
				nextAt: next,
				version: { increment: 1 }
			}
		});
	}

	console.log("[scheduler] done");
}

setInterval(runOnce, 10_000);

console.log("[scheduler] started (loop every 10s)");
