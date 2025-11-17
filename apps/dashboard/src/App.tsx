import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Clock,
  Cpu,
  Database,
  PauseCircle,
  PlayCircle,
  Server,
  Zap
} from "lucide-react";

type Job = {
  id: string;
  name: string;
  type: string;
  schedule_cron: string;
  tz: string;
  paused?: boolean;
  next_fire_utc: string | null;
  created_at: string;
};

type Run = {
  id: string;
  jobId: string;
  projectId: string;
  triggerAt: string;
  status: "running" | "success" | "failed";
  attempts: number;
  durationMs: number | null;
  firstError: string | null;
};

type SeedResponse = {
  tenantId: string;
  projectId: string;
};

const API_BASE = "http://localhost:8080";

export const App: React.FC = () => {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loadingSeed, setLoadingSeed] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingJob, setCreatingJob] = useState(false);
  const [jobCreateError, setJobCreateError] = useState<string | null>(null);


  const seedDemo = async () => {
    try {
      setLoadingSeed(true);
      setError(null);
      const res = await fetch(`${API_BASE}/dev/seed`, { method: "POST" });
      if (!res.ok) {
        throw new Error(`Seed failed: ${res.statusText}`);
      }
      const data: SeedResponse = await res.json();
      setProjectId(data.projectId);
      setJobs([]);
      setSelectedJobId(null);
      setRuns([]);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to seed demo");
    } finally {
      setLoadingSeed(false);
    }
  };

  const createDemoJob = async () => {
    if (!projectId) return;
    try {
      setCreatingJob(true);
      setJobCreateError(null);

      const res = await fetch(`${API_BASE}/projects/${projectId}/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: "Ping httpbin.org",
          type: "http",
          schedule_cron: "* * * * *",
          tz: "Europe/Berlin",
          target_url: "https://httpbin.org/get",
          target_method: "GET"
        })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Create job failed: ${res.status} ${text}`);
      }

      // reload jobs after creating
      await loadJobs(projectId);
    } catch (err: any) {
      console.error(err);
      setJobCreateError(err.message ?? "Failed to create job");
    } finally {
      setCreatingJob(false);
    }
  };

  const loadJobs = async (pid: string) => {
    try {
      setLoadingJobs(true);
      setError(null);
      const res = await fetch(`${API_BASE}/projects/${pid}/jobs`);
      if (!res.ok) throw new Error("Failed to load jobs");
      const data = await res.json();
      setJobs(data);
      if (data.length > 0) {
        setSelectedJobId(data[0].id);
      } else {
        setSelectedJobId(null);
        setRuns([]);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to load jobs");
    } finally {
      setLoadingJobs(false);
    }
  };

  const loadRuns = async (pid: string, jid: string) => {
    try {
      setLoadingRuns(true);
      setError(null);
      const res = await fetch(
        `${API_BASE}/projects/${pid}/jobs/${jid}/runs?limit=20`
      );
      if (!res.ok) throw new Error("Failed to load runs");
      const data = await res.json();
      setRuns(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to load runs");
    } finally {
      setLoadingRuns(false);
    }
  };

  useEffect(() => {
    if (!projectId) return;
    loadJobs(projectId);
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !selectedJobId) return;
    loadRuns(projectId, selectedJobId);
  }, [projectId, selectedJobId]);

  useEffect(() => {
  if (!projectId || !selectedJobId) return;

  const interval = setInterval(() => {
    loadRuns(projectId, selectedJobId);
  }, 5000); // 5 seconds

  return () => clearInterval(interval);
  }, [projectId, selectedJobId]);

  const fmt = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "2-digit"
    });
  };

  const currentJob = jobs.find((j) => j.id === selectedJobId) ?? null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      {/* background orbs */}
      <div className="pointer-events-none fixed inset-0 opacity-50">
        <div className="absolute -top-32 -left-32 h-72 w-72 rounded-full bg-brand-600/40 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-emerald-500/30 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/20 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900/70 ring-1 ring-slate-700/60 backdrop-blur">
              <Zap className="h-5 w-5 text-brand-500" />
            </div>
            <div>
              <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                CronFleet
                <span className="rounded-full bg-emerald-500/10 px-2 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/40">
                  Internal Scheduler
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Multi-tenant cron orchestration · Postgres · Redis · BullMQ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-2xl bg-slate-900/70 px-3 py-2 text-xs text-slate-300 ring-1 ring-slate-700/60 backdrop-blur sm:flex">
              <Server className="h-3.5 w-3.5 text-emerald-400" />
              <span>API: http://localhost:8080</span>
            </div>
            <button
              onClick={seedDemo}
              disabled={loadingSeed}
              className="group inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-xs font-medium shadow-lg shadow-brand-500/40 transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Database className="h-3.5 w-3.5" />
              {loadingSeed ? "Seeding demo…" : "Seed Demo Project"}
            </button>
          </div>
        </header>

        {/* Main layout */}
        <main className="flex flex-1 gap-4 px-4 pb-6 sm:px-6 lg:px-8">
          {/* Left panel: Jobs */}
          <motion.section
            key={projectId ?? "no-project"}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="flex w-full flex-col gap-3 rounded-3xl bg-slate-900/60 p-4 ring-1 ring-slate-800/80 backdrop-blur-xl lg:w-2/5"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  Project
                </p>
                <div className="mt-1 flex items-center gap-2 text-sm">
                  <span className="font-semibold">
                    {projectId ? "Demo Project" : "No project loaded"}
                  </span>
                  {projectId && (
                    <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-400 ring-1 ring-slate-700">
                      {projectId}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Cpu className="h-3.5 w-3.5 text-cyan-400" />
                <span>{jobs.length} jobs</span>
              </div>
            </div>

            {projectId && (
              <div className="mt-2 flex items-center justify-between gap-2">
                <button
                  onClick={createDemoJob}
                  disabled={creatingJob}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100/5 px-3 py-1.5 text-[11px] font-medium text-slate-100 ring-1 ring-brand-500/60 shadow shadow-brand-500/30 transition hover:bg-slate-100/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <PlayCircle className="h-3.5 w-3.5 text-brand-400" />
                  {creatingJob ? "Creating job…" : "Create demo HTTP job"}
                </button>
                <span className="text-[11px] text-slate-500">
                  Fires every minute against <span className="text-slate-300">httpbin.org</span>
                </span>
              </div>
            )}

            <div className="mt-1 h-px bg-gradient-to-r from-slate-800 via-slate-700/50 to-slate-800" />

            <div className="flex-1 space-y-2 overflow-hidden">
              {error && (
                <div className="rounded-2xl bg-red-500/10 px-3 py-2 text-xs text-red-200 ring-1 ring-red-500/40">
                  {error}
                </div>
              )}

              {jobCreateError && (
                <div className="rounded-2xl bg-red-500/10 px-3 py-2 text-xs text-red-200 ring-1 ring-red-500/40">
                  {jobCreateError}
                </div>
              )}

              {!projectId && (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  Click <span className="mx-1 font-semibold">Seed Demo Project</span> to
                  start.
                </div>
              )}

              {projectId && loadingJobs && jobs.length === 0 && (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  Loading jobs…
                </div>
              )}

              {projectId && !loadingJobs && jobs.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-xs text-slate-400">
                  <Activity className="h-5 w-5 text-slate-600" />
                  <p>No jobs yet for this project.</p>
                  <p className="text-[11px] text-slate-500">
                    Create them via your API, they’ll appear live here.
                  </p>
                </div>
              )}

              {jobs.length > 0 && (
                <div className="max-h-[420px] space-y-1 overflow-y-auto pt-1">
                  {jobs.map((job) => {
                    const isActive = job.id === selectedJobId;
                    const isPaused = job.paused;
                    return (
                      <button
                        key={job.id}
                        onClick={() => setSelectedJobId(job.id)}
                        className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-xs transition ${
                          isActive
                            ? "bg-slate-100/5 ring-1 ring-brand-500/60 shadow-lg shadow-brand-500/30"
                            : "hover:bg-slate-800/60 ring-1 ring-slate-800/80"
                        }`}
                      >
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-900/90 ring-1 ring-slate-700/80">
                          <Clock
                            className={`h-4 w-4 ${
                              isActive ? "text-brand-400" : "text-slate-400"
                            }`}
                          />
                        </div>
                        <div className="flex flex-1 flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-semibold text-slate-50">
                              {job.name}
                            </span>
                            <span className="rounded-full bg-slate-800/90 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                              {job.type}
                            </span>
                            {isPaused && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300 ring-1 ring-amber-500/40">
                                <PauseCircle className="h-3 w-3" />
                                paused
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                            <span className="inline-flex items-center gap-1">
                              <span className="rounded-sm bg-slate-900/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                                {job.schedule_cron}
                              </span>
                              <span className="text-slate-500">({job.tz})</span>
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <ArrowRight className="h-3 w-3 text-emerald-400" />
                              next:{" "}
                              <span className="font-medium text-slate-300">
                                {fmt(job.next_fire_utc)}
                              </span>
                            </span>
                            <span className="hidden text-slate-500 sm:inline">
                              created {fmt(job.created_at)}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.section>

          {/* Right panel: Runs timeline */}
          <motion.section
            key={selectedJobId ?? "no-job"}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 }}
            className="hidden flex-1 flex-col gap-3 rounded-3xl bg-slate-900/70 p-4 ring-1 ring-slate-800/80 backdrop-blur-xl lg:flex"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  Job runs
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-50">
                    {currentJob ? currentJob.name : "No job selected"}
                  </h2>
                  {currentJob && (
                    <span className="rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] text-slate-400 ring-1 ring-slate-700">
                      {currentJob.id}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                {currentJob && (
                  <button
                    onClick={() => projectId && selectedJobId && loadRuns(projectId, selectedJobId)}
                    className="rounded-xl bg-slate-800/80 px-2.5 py-1 text-[11px] font-medium text-slate-100 ring-1 ring-slate-700 hover:bg-slate-700/80"
                  >
                    Refresh runs
                  </button>
                )}
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span>success</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-rose-400" />
                  <span>failed</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-300" />
                  <span>running</span>
                </div>
              </div>
            </div>

            <div className="mt-1 h-px bg-gradient-to-r from-slate-800 via-slate-700/40 to-slate-800" />

            <div className="relative flex-1 overflow-hidden">
              {!currentJob && (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  Select a job on the left to inspect its run history.
                </div>
              )}

              {currentJob && loadingRuns && runs.length === 0 && (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  Loading runs…
                </div>
              )}

              {currentJob && !loadingRuns && runs.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-1 text-xs text-slate-400">
                  <Activity className="h-5 w-5 text-slate-600" />
                  <p>No executions yet for this job.</p>
                </div>
              )}

              {currentJob && runs.length > 0 && (
                <div className="relative mt-2 grid h-full grid-cols-[auto,1fr] gap-4 overflow-y-auto pr-1">
                  {/* Vertical line */}
                  <div className="relative">
                    <div className="absolute left-3 top-0 h-full w-px bg-gradient-to-b from-slate-700 via-slate-600/60 to-slate-800" />
                  </div>

                  <div className="space-y-3 pb-4">
                    {runs.map((run, index) => {
                      const status = run.status;
                      const color =
                        status === "success"
                          ? "emerald"
                          : status === "failed"
                          ? "rose"
                          : "amber";

                      const statusLabel =
                        status === "success"
                          ? "Success"
                          : status === "failed"
                          ? "Failed"
                          : "Running";

                      return (
                        <motion.div
                          key={run.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="relative grid grid-cols-[auto,1fr] gap-4"
                        >
                          {/* Timeline dot */}
                          <div className="relative flex items-center justify-center">
                            <div className="relative flex h-6 w-6 items-center justify-center">
                              <span
                                className={`absolute inline-flex h-full w-full animate-ping rounded-full bg-${color}-500/30`}
                              />
                              <span
                                className={`relative inline-flex h-3 w-3 rounded-full bg-${color}-400`}
                              />
                            </div>
                          </div>

                          {/* Card */}
                          <div className="rounded-2xl bg-slate-900/90 p-3 text-xs ring-1 ring-slate-800/80 shadow-sm shadow-black/40">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full bg-${color}-500/10 px-2 py-0.5 text-[10px] font-medium text-${color}-200 ring-1 ring-${color}-500/40`}
                                >
                                  {status === "running" ? (
                                    <Activity className="h-3 w-3" />
                                  ) : status === "success" ? (
                                    <PlayCircle className="h-3 w-3" />
                                  ) : (
                                    <PauseCircle className="h-3 w-3" />
                                  )}
                                  {statusLabel}
                                </span>
                                <span className="font-mono text-[11px] text-slate-400">
                                  {run.id}
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-400">
                                {fmt(run.triggerAt)}
                              </span>
                            </div>

                            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-slate-400">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-slate-500" />
                                <span>
                                  Duration:{" "}
                                  <span className="text-slate-200">
                                    {run.durationMs != null
                                      ? `${run.durationMs} ms`
                                      : "—"}
                                  </span>
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Activity className="h-3 w-3 text-slate-500" />
                                <span>
                                  Attempts:{" "}
                                  <span className="text-slate-200">
                                    {run.attempts}
                                  </span>
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Server className="h-3 w-3 text-slate-500" />
                                <span>
                                  Project:{" "}
                                  <span className="text-slate-200">
                                    {run.projectId.slice(0, 8)}…
                                  </span>
                                </span>
                              </div>
                            </div>

                            {run.firstError && (
                              <div className="mt-2 rounded-xl bg-rose-500/10 px-2 py-1 text-[11px] text-rose-100 ring-1 ring-rose-500/40">
                                {run.firstError}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.section>
        </main>

        {/* Footer */}
        <footer className="flex items-center justify-between px-8 pb-4 pt-2 text-[10px] text-slate-500">
          <span>Built for fun · CronFleet</span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            live preview from API
          </span>
        </footer>
      </div>
    </div>
  );
};