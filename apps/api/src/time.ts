import { Cron } from "croner";

/**
 * Compute the next occurrence for a cron string in a given IANA timezone.
 * Returns a JS Date in UTC.
 */
export function nextFireFrom(cron: string, tz: string, fromISO?: string): Date {
    const base = fromISO ? new Date(fromISO) : new Date();
    const c = new Cron(cron, { timezone: tz, startAt: base, legacyMode: false });
    const next = c.nextRun();
    if (!next) {
        throw new Error("No next run could be computed for the given cron expression");
    }

    return next;
}