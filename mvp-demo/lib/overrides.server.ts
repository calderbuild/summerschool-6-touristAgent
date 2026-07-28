import { PLACES, type Place } from "./places";
import { merge, type Override } from "./overrides";
import { publicClient } from "./supabase/server";

/**
 * Reading the correction layer. Server only: `publicClient` reaches for the
 * environment, and this file's one job is to hand `merge` some rows.
 */

/** Short, because the point of an override is that it takes effect without a
 *  deploy. Sixty seconds keeps a correction near-live while still collapsing the
 *  many prompt builds a single conversation causes into one read. */
const CACHE_MS = 60 * 1000;

let cache: { at: number; rows: Override[] } | null = null;

export async function overrides(): Promise<Override[]> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.rows;

  const db = publicClient();
  if (!db) return cache?.rows ?? [];

  try {
    const { data, error } = await db
      .from("place_overrides")
      .select("place_id,wheelchair,station_step_free,notes,status,last_verified,hidden,updated_at,updated_by");
    if (error || !data) return cache?.rows ?? [];
    const rows = data as Override[];
    cache = { at: now, rows };
    return rows;
  } catch {
    return cache?.rows ?? [];
  }
}

/** Every place the assistant may talk about, corrected, with hidden ones removed. */
export async function livePlaces(): Promise<Place[]> {
  const rows = await overrides();
  return rows.length === 0 ? PLACES : merge(rows);
}
