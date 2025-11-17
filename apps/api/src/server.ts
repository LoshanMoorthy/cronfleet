import Fastify from "fastify";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { jobsRoutes } from "./routes.jobs.js";
import cors from "@fastify/cors";

dotenv.config();
const prisma = new PrismaClient();
const app = Fastify({
	logger: { transport: { target: "pino-pretty" } }
});

app.register(cors, {
	origin: true
});

app.get("/health", async () => ({ ok: true }));

app.post("/dev/seed", async () => {
	const tenant = await prisma.tenant.create({ data: { name: "Demo Tenant" } });
	const project = await prisma.project.create({
		data: { tenantId: tenant.id, name: "Demo Project", timezone: "Europe/Berlin" }
	});
	return { tenantId: tenant.id, projectId: project.id };
});

app.get("/runs/:runId", async (req, reply) => {
	const { runId } = req.params as any;

	const run = await prisma.run.findUnique({
		where: { id: runId },
		include: {
			job: true
		}
	});

	if (!run) {
		return reply.code(404).send({ error: "Run not found" });
	}

	const attempts = await prisma.attempt.findMany({
		where: { runId },
		orderBy: { attemptNo: "asc" }
	});

	return {
		...run,
		attempts
	};
});

jobsRoutes(app, prisma);

const port = Number(process.env.PORT ?? 8080);
app
	.listen({ port, host: "0.0.0.0" })
	.catch((err) => {
		app.log.error(err);
		process.exit(1);
	});
