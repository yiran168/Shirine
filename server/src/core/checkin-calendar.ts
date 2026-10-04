import type { Env } from "../types";

const DEFAULT_TIME_ZONE = "Asia/Shanghai";

/** One site calendar for rewards, the profile and the navigation menu. */
export async function getCheckinCalendar(env: Env, now = new Date()) {
  let timeZone = DEFAULT_TIME_ZONE;
  try {
    const row = await env.DB.prepare("SELECT value FROM site_configs WHERE key = 'site'").first<{ value: string }>();
    const configured = row ? JSON.parse(row.value)?.timeZone : undefined;
    if (typeof configured === "string" && configured) {
      new Intl.DateTimeFormat("en", { timeZone: configured });
      timeZone = configured;
    }
  } catch { /* Invalid legacy configuration must not disable account operations. */ }
  const parts = new Intl.DateTimeFormat("en", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  // Subtract a calendar day, not 24 hours: a DST day may be 23 or 25 hours.
  const yesterday = new Date(Date.UTC(Number(part("year")), Number(part("month")) - 1, Number(part("day")) - 1)).toISOString().slice(0, 10);
  return { today, yesterday, timeZone };
}
