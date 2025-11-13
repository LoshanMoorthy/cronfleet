import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Queue } from "bullmq";

const prisma = new PrismaClient();

const connection = {
	host: "localhost",
	port: 6379,
	maxRetriesPerRequest: null as any
};

type DispatchJobPayload = {
	runId: string;
	jobId: string;
	projectId: string;
	target_url: string | null;
	method?: string | null;
	headers?: Record<string, string> | null;
	body?: unknown;
	timeout?: number | null;
};

const jobQueue = new Queue<DispatchJobPayload>("jobs", {
	connection
});

async function main() {
	console.log("[dispatcher] scanning runs...");

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
		process.exit(0);
	}

	console.log(`[dispatcher] enqueueing ${runs.length} runs...`);

	for (const run of runs) {
		const job = run.job;
		if (!job) {
			console.warn(`[dispatcher] run ${run.id} has no job, skipping`);
			continue;
		}

		await jobQueue.add(
			"execute",
			{
				runId: run.id,
				jobId: job.id,
				projectId: run.projectId,
				target_url: job.targetUrl,
				method: job.targetMethod,
				headers: (job.headersJson ?? undefined) as any,
				body: job.bodyTemplate ?? undefined,
				timeout: job.timeoutMs ?? undefined
			},
			{
				removeOnComplete: 100,
				removeOnFail: 500,
				attempts: job.retryMax ?? 3,
				backoff: {
					type: "exponential",
					delay: 2000
				}
			}
		);

		await prisma.run.update({
			where: { id: run.id },
			data: {
				attempts: {
					increment: 1
				}
			}
		});

		console.log(`[dispatcher] enqueued run ${run.id} for job ${job.id}`);
	}

	console.log("[dispatcher] done");
	process.exit(0);
}

main().catch((err) => {
	console.error("[dispatcher] fatal", err);
	process.exit(1);
});