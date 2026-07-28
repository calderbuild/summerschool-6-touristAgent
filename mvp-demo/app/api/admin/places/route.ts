import { cookies } from "next/headers";
import { ADMIN_COOKIE, sessionToken } from "@/lib/admin";
import { PLACES } from "@/lib/places";
import { overridesWritable, serviceClient } from "@/lib/supabase/server";

/**
 * The only door into the knowledge base's correction layer.
 *
 * `place_overrides` has a public select policy and **no write policy at all**, so
 * row-level security refuses every write from a browser holding the publishable
 * key however it is called. Writes reach it only through the secret key, and the
 * secret key exists in exactly one place: this file, behind the admin session
 * cookie the console already gates on.
 *
 * Three things this route insists on.
 *
 * **A known place.** `place_id` must be one of the ids in the committed knowledge
 * base. An override is a correction to a record we ship, not a way to invent a
 * venue that no pull request ever reviewed.
 *
 * **A date with a claim.** Changing what a wheelchair user will meet requires
 * saying when somebody checked, because a dated correction can be re-checked and
 * an undated one is a rumour with better formatting. The product's whole argument
 * is that its facts carry provenance; an edit surface that let staff bypass that
 * would be the one place it did not.
 *
 * **A trail.** Every changed field is appended to `place_override_log` with its
 * old and new value, before/after being written. A data-management console with no
 * history cannot answer "who changed this and when", which is the first question
 * anyone asks when an answer turns out to be wrong.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIELDS = ["wheelchair", "station_step_free", "notes", "status", "last_verified", "hidden"] as const;
type Field = (typeof FIELDS)[number];

const IDS = new Set(PLACES.map((p) => p.id));

async function authed(): Promise<boolean> {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return false;
  const jar = await cookies();
  return jar.get(ADMIN_COOKIE)?.value === sessionToken(secret);
}

export async function GET() {
  if (!(await authed())) return Response.json({ ok: false, reason: "unauthorised" }, { status: 401 });

  const db = serviceClient();
  if (!db) return Response.json({ ok: true, configured: false, rows: [], log: [] });

  const [rows, log] = await Promise.all([
    db.from("place_overrides").select("*").order("updated_at", { ascending: false }),
    db.from("place_override_log").select("*").order("at", { ascending: false }).limit(40),
  ]);

  return Response.json({
    ok: true,
    configured: true,
    rows: rows.data ?? [],
    log: log.data ?? [],
  });
}

export async function POST(request: Request) {
  if (!(await authed())) return Response.json({ ok: false, reason: "unauthorised" }, { status: 401 });
  if (!overridesWritable) {
    // Named, not a 500: the console can then say "this build has no database"
    // rather than showing a failure that looks like the edit was rejected.
    return Response.json({ ok: false, reason: "no_database" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const placeId = typeof body.place_id === "string" ? body.place_id : "";
  if (!IDS.has(placeId)) {
    return Response.json({ ok: false, reason: "unknown_place" }, { status: 400 });
  }

  const patch: Record<string, string | boolean | null> = {};
  for (const f of FIELDS) {
    if (!(f in body)) continue;
    const v = body[f];
    if (f === "hidden") {
      patch.hidden = v === true;
      continue;
    }
    if (v === null || v === "") {
      // An emptied field means "drop the correction", not "the answer is empty
      // string", which would replace a real committed value with nothing.
      patch[f] = null;
      continue;
    }
    if (typeof v !== "string") return Response.json({ ok: false, reason: "bad_field" }, { status: 400 });
    if (f === "status" && v !== "open" && v !== "closed") {
      return Response.json({ ok: false, reason: "bad_status" }, { status: 400 });
    }
    if (f === "last_verified" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      return Response.json({ ok: false, reason: "bad_date" }, { status: 400 });
    }
    patch[f] = v.slice(0, 2000);
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ ok: false, reason: "nothing_to_change" }, { status: 400 });
  }

  // A correction to what a traveller will meet has to carry the date it was
  // checked. Hiding a place does not: that is a statement about our own record
  // rather than about the venue.
  const claims = (["wheelchair", "station_step_free", "notes", "status"] as Field[]).some(
    (f) => f in patch && patch[f] !== null,
  );
  const dated = typeof patch.last_verified === "string";
  if (claims && !dated) {
    return Response.json({ ok: false, reason: "date_required" }, { status: 400 });
  }

  const by = typeof body.updated_by === "string" ? body.updated_by.slice(0, 80) : null;
  const db = serviceClient()!;

  const before = await db.from("place_overrides").select("*").eq("place_id", placeId).maybeSingle();
  const prior = (before.data ?? {}) as Record<string, unknown>;

  const { error } = await db
    .from("place_overrides")
    .upsert(
      { place_id: placeId, ...patch, updated_by: by, updated_at: new Date().toISOString() },
      { onConflict: "place_id" },
    );
  if (error) return Response.json({ ok: false, reason: "write_failed" }, { status: 502 });

  // After the write, and per field, so the trail records what actually landed
  // rather than what was attempted.
  const entries = Object.entries(patch)
    .filter(([f, v]) => String(prior[f] ?? "") !== String(v ?? ""))
    .map(([field, v]) => ({
      place_id: placeId,
      field,
      old_value: prior[field] === null || prior[field] === undefined ? null : String(prior[field]),
      new_value: v === null ? null : String(v),
      updated_by: by,
    }));
  if (entries.length) await db.from("place_override_log").insert(entries);

  return Response.json({ ok: true, changed: entries.length });
}
