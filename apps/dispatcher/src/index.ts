import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Queue } from "bullmq";

const prisma = new PrismaClient();

const connection = {
	host: "localhost",
	port: 6379,
	maxRetriesPerRequest: null as any
};

const queue = new Queue("jobs", {
	connection
});

async function runOnce() {
	console.log("[dispatcher] tick");

	const runs = await prisma.run.findMany({
		where: {
			status: "running" as any,
			attempts: 0
		},
		include: {
			job: true
		},
		orderBy: {
			triggerAt: "asc"
		},
		take: 50
	});

	if (runs.length === 0) {
		console.log("[dispatcher] no runs to enqueue");
		return;
	}

	console.log(`[dispatcher] enqueueing ${runs.length} runs`);

	for (const run of runs) {
		const job = run.job;
		if (!job) continue;

		await queue.add(
			"execute",
			{
				runId: run.id,
				jobId: job.id,
				projectId: run.projectId,
				target_url: job.targetUrl,
				method: job.targetMethod,
				headers: job.headersJson as any,
				body: job.bodyTemplate as any,
				timeout: job.timeoutMs ?? undefined
			},
			{
				removeOnComplete: 100,
				removeOnFail: 500
			}
		);

		console.log(`[dispatcher] enqueued run ${run.id}`);

		await prisma.run.update({
			where: { id: run.id },
			data: {
				attempts: { increment: 1 }
			}
		});
	}

	console.log("[dispatcher] done");
}

setInterval(runOnce, 5_000);

console.log("[dispatcher] started (loop every 5s)");
