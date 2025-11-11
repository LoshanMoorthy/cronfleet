import { FastifyInstance } from "fastify";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { nextFireFrom } from "./time.js";

const createJobSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["http", "queue", "internal"]),
  schedule_cron: z.string().min(1),
  tz: z.string().default("Europe/Berlin"),
  target_url: z.string().url().optional(),
  target_method: z.string().optional(),
  headers: z.record(z.string()).optional(),
  body_template: z.any().optional(),
  retry_max: z.number().int().min(0).default(3),
  timeout_ms: z.number().int().min(1000).max(300000).default(15000),
  concurrency: z.number().int().min(1).max(100).default(1),
});

export async function jobsRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.post<{ Params: { pid: string }; Body: z.infer<typeof createJobSchema> }>(
    "/projects/:pid/jobs",
    async (req, reply) => {
      const pid = req.params.pid;
      const parsed = createJobSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const b = parsed.data;

      const project = await prisma.project.findUnique({ where: { id: pid } });
      if (!project) return reply.code(404).send({ error: "project_not_found" });

      const job = await prisma.job.create({
        data: {
          projectId: pid,
          name: b.name,
          type: b.type,
          scheduleCron: b.schedule_cron,
          tz: b.tz,
          targetUrl: b.target_url,
          targetMethod: b.target_method,
          headersJson: b.headers ?? undefined,
          bodyTemplate: b.body_template ?? undefined,
          retryMax: b.retry_max,
          timeoutMs: b.timeout_ms,
          concurrency: b.concurrency,
        },
      });

      let nextAtUtc: Date;
      try {
        nextAtUtc = nextFireFrom(job.scheduleCron!, job.tz);
      } catch (e) {
        await prisma.job.delete({ where: { id: job.id } });
        return reply.code(400).send({ error: "invalid_cron", details: String(e) });
      }

      await prisma.jobNextFire.create({
        data: { jobId: job.id, nextAt: nextAtUtc, version: 0 },
      });

      return reply.code(201).send({ id: job.id, next_fire_utc: nextAtUtc.toISOString() });
    }
  );

  app.get<{ Params: { pid: string } }>("/projects/:pid/jobs", async (req) => {
    const jobs = await prisma.job.findMany({
      where: { projectId: req.params.pid },
      orderBy: { createdAt: "desc" },
      include: { nextfires: { orderBy: { nextAt: "asc" }, take: 1 } },
    });

    return jobs.map((j: (typeof jobs)[number]) => ({
      id: j.id,
      name: j.name,
      type: j.type,
      schedule_cron: j.scheduleCron,
      tz: j.tz,
      next_fire_utc: j.nextfires[0]?.nextAt ?? null,
      created_at: j.createdAt,
    }));
  });
}
