import { Cron } from "croner";

/** Compute the next occurrence in a given IANA timezone. Returns a Date (UTC instant). */
export function nextFireFrom(cron: string, tz: string, fromISO?: string): Date {
  const base = fromISO ? new Date(fromISO) : new Date();
  const c = new Cron(cron, { timezone: tz, startAt: base, legacyMode: false });
  const next = c.nextRun();
  if (!next) throw new Error("No next run for the given cron expression");
  return next;
}