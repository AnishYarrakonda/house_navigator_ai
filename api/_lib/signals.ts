// Aggregate, public demand signals for the Foresight agent (data-sources.md).
// EVERY source here is public and aggregate — no person, no PII — which is
// exactly why Foresight is allowed to run unattended (ai-agents.md §D).
//
// Each fetcher degrades gracefully: if the live feed is unreachable (offline
// demo, rate limit), it returns clearly-marked fallback values so the agent
// still produces a believable alert. The `source` field tells you which.
//
// DataSF runs on Socrata (SODA): https://data.sfgov.org/resource/<id>.json,
// filterable with $select / $where / $group / $limit.

import { getSupabaseAdmin } from "./supabase-admin";

export type SignalSource = "live" | "fallback";

export interface ThreeOneOneSignal {
  source: SignalSource;
  /** Recent homeless/encampment 311 counts by district, highest first. */
  byDistrict: { district: string; count: number }[];
  windowHours: number;
}

export interface WaitlistSignal {
  source: SignalSource;
  /** Current emergency-shelter waitlist size (aggregate count). */
  size: number;
  note: string;
}

export interface WeatherSignal {
  source: SignalSource;
  tonight: string; // short forecast text
  lowTempF: number | null;
  /** True when cold/wet enough to drive overflow (a Foresight trigger). */
  harsh: boolean;
}

export interface HeatmapSignal {
  source: SignalSource;
  /** Active (non-expired) open need beacons right now. */
  activeNeeds: number;
  /** k-anonymized hot cells (≥5 signals) — never raw points. */
  hotCells: number;
}

const SODA = "https://data.sfgov.org/resource";
const SF_LAT = 37.7749;
const SF_LNG = -122.4194;
const NWS_UA = "Waypoint/1.0 (housing-dignity hackathon demo)";

async function getJson(url: string, headers?: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return res.json();
}

/** SF311 cases (vw6y-z8j6): recent encampment / homeless-concern reports. */
export async function fetch311(windowHours = 48): Promise<ThreeOneOneSignal> {
  try {
    const since = new Date(Date.now() - windowHours * 3600_000)
      .toISOString()
      .slice(0, 19); // SODA floating timestamp, no Z
    const where = encodeURIComponent(
      `requested_datetime > '${since}' AND ` +
        `(service_name like '%Encampment%' OR service_name like '%Homeless%')`,
    );
    const url =
      `${SODA}/vw6y-z8j6.json?$select=police_district,count(*) as cnt` +
      `&$where=${where}&$group=police_district&$order=cnt DESC&$limit=15`;
    const rows = (await getJson(url)) as Array<Record<string, string>>;
    const byDistrict = rows
      .filter((r) => r.police_district)
      .map((r) => ({ district: r.police_district, count: Number(r.cnt) }))
      .filter((r) => Number.isFinite(r.count));
    if (byDistrict.length === 0) throw new Error("no 311 rows");
    return { source: "live", byDistrict, windowHours };
  } catch {
    return {
      source: "fallback",
      windowHours,
      byDistrict: [
        { district: "TENDERLOIN", count: 41 },
        { district: "MISSION", count: 28 },
        { district: "SOUTHERN", count: 22 },
      ],
    };
  }
}

/** HSH 90-day Emergency Shelter Waitlist (w4sk-nq57): aggregate size. */
export async function fetchWaitlist(): Promise<WaitlistSignal> {
  try {
    const url = `${SODA}/w4sk-nq57.json?$select=count(*) as cnt`;
    const rows = (await getJson(url)) as Array<Record<string, string>>;
    const size = Number(rows?.[0]?.cnt);
    if (!Number.isFinite(size)) throw new Error("no waitlist count");
    return {
      source: "live",
      size,
      note: "Current emergency-shelter waitlist entries (aggregate).",
    };
  } catch {
    return {
      source: "fallback",
      size: 1180,
      note: "Fallback estimate — live HSH waitlist feed unavailable.",
    };
  }
}

/** National Weather Service tonight's forecast for SF (api.weather.gov, free). */
export async function fetchWeather(): Promise<WeatherSignal> {
  try {
    const points = (await getJson(
      `https://api.weather.gov/points/${SF_LAT},${SF_LNG}`,
      { "User-Agent": NWS_UA, Accept: "application/geo+json" },
    )) as { properties?: { forecast?: string } };
    const forecastUrl = points.properties?.forecast;
    if (!forecastUrl) throw new Error("no forecast url");
    const forecast = (await getJson(forecastUrl, {
      "User-Agent": NWS_UA,
      Accept: "application/geo+json",
    })) as {
      properties?: {
        periods?: Array<{
          isDaytime: boolean;
          temperature: number;
          shortForecast: string;
        }>;
      };
    };
    const periods = forecast.properties?.periods ?? [];
    const night = periods.find((p) => !p.isDaytime) ?? periods[0];
    if (!night) throw new Error("no periods");
    const harsh =
      night.temperature <= 45 || /rain|snow|storm|shower/i.test(night.shortForecast);
    return {
      source: "live",
      tonight: night.shortForecast,
      lowTempF: night.temperature,
      harsh,
    };
  } catch {
    return {
      source: "fallback",
      tonight: "Rain likely, low around 42°F",
      lowTempF: 42,
      harsh: true,
    };
  }
}

/** The app's own anonymized signal: active beacons + k-anon hot cells. */
export async function fetchHeatmapSignal(): Promise<HeatmapSignal> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("need")
      .select("fuzzed_geocell, status, expires_at");
    if (error) throw error;
    const now = Date.now();
    const cells = new Map<string, number>();
    let active = 0;
    for (const r of (data ?? []) as Array<{
      fuzzed_geocell: string;
      status: string;
      expires_at: string;
    }>) {
      const expired =
        r.status === "open" && new Date(r.expires_at).getTime() < now;
      if (r.status !== "open" || expired) continue;
      active += 1;
      cells.set(r.fuzzed_geocell, (cells.get(r.fuzzed_geocell) ?? 0) + 1);
    }
    // k-anonymity (=5): only count cells that would actually render.
    const hotCells = [...cells.values()].filter((c) => c >= 5).length;
    return { source: "live", activeNeeds: active, hotCells };
  } catch {
    return { source: "fallback", activeNeeds: 6, hotCells: 1 };
  }
}
