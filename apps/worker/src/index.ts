import "dotenv/config";
import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type JobPayload = {
	runId: string;
	jobId: string;
	projectId: string;
	target_url: string;
	method?: string;
	headers?: Record<string, string>;
	body?: unknown;
	timeout?: number;
};

const connection = {
	host: "localhost",
	port: 6379,
	maxRetriesPerRequest: null as any
};

const jobWorker = new Worker<JobPayload>(
	"jobs",
	async (job) => {
		const { runId, jobId, target_url, method, headers, body, timeout } = job.data;
		console.log(`[worker] executing job ${jobId} (run ${runId})`);

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeout ?? 15000);

		try {
			const start = Date.now();
			const res = await fetch(target_url, {
				method: method ?? "GET",
				headers: headers ?? {},
				body: body ? JSON.stringify(body) : undefined,
				signal: controller.signal
			});

			const text = await res.text();
			const latency = Date.now() - start;

			await prisma.attempt.create({
				data: {
					runId,
					attemptNo: 1,
					startedAt: new Date(start),
					finishedAt: new Date(),
					status: (res.ok ? "success" : "failed") as any,
					httpStatus: res.status,
					latencyMs: latency,
					responseExcerpt: text.slice(0, 2000)
				}
			});

			await prisma.run.update({
				where: { id: runId },
				data: {
					status: (res.ok ? "success" : "failed") as any
				}
			});

			console.log(`[worker] job ${jobId} (run ${runId}) done (${res.status})`);
		} catch (err) {
			console.error(`[worker] job ${jobId} (run ${runId}) failed`, err);

			try {
				await prisma.run.update({
					where: { id: runId },
					data: {
						status: "failed" as any
					}
				});
			} catch {
			}
		} finally {
			clearTimeout(timer);
		}
	},
	{ connection }
);

jobWorker.on("failed", (job, err) => {
	if (!job) {
		console.error("[worker] job failed but job is undefined", err);
		return;
	}
	console.error(`[worker] job ${job.id} failed:`, err);
});

console.log("[worker] ready");