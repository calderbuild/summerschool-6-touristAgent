import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PLACES } from "../places";
import { apply, merge, type Override } from "../overrides";

/**
 * The correction layer's guarantees.
 *
 * The console can now change what the assistant tells a wheelchair user, which is
 * the most consequential surface in this product. Three things therefore have to
 * hold mechanically rather than by care: an edit cannot blank a record it did not
 * mean to touch, a claim cannot arrive without the date somebody checked it, and
 * nothing reachable from a browser can write the table.
 *
 * Every check here was written by putting its defect back and watching it fail.
 */

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const SCHEMA = readFileSync(join(root, "supabase", "schema.sql"), "utf8");
const ROUTE = readFileSync(join(root, "app", "api", "admin", "places", "route.ts"), "utf8");
const EDITOR = readFileSync(join(root, "components", "admin", "PlaceEditor.tsx"), "utf8");
const CONSOLE = readFileSync(join(root, "components", "admin", "AdminConsole.tsx"), "utf8");

const base = PLACES.find((p) => p.id === "pantheon")!;

const row = (over: Partial<Override> = {}): Override => ({
  place_id: base.id,
  wheelchair: null,
  station_step_free: null,
  notes: null,
  status: null,
  last_verified: null,
  hidden: false,
  updated_at: "2026-07-28T09:00:00.000Z",
  updated_by: null,
  ...over,
});

describe("an override corrects one field and leaves the rest alone", () => {
  it("a row of nulls changes nothing at all", () => {
    // The failure mode of a merge layer that stores whole rows: correcting the
    // notes silently blanks the opening hours.
    const out = apply(base, row());
    expect(out.wheelchair).toBe(base.wheelchair);
    expect(out.stationStepFree).toBe(base.stationStepFree);
    expect(out.notes).toBe(base.notes);
    expect(out.openingHours).toBe(base.openingHours);
    expect(out.budget).toBe(base.budget);
    expect(out.status).toBe(base.status);
  });

  it("a corrected field wins and its neighbours do not move", () => {
    const out = apply(base, row({ wheelchair: "Lift to the nave out of service", last_verified: "2026-07-28" }));
    expect(out.wheelchair).toBe("Lift to the nave out of service");
    expect(out.notes).toBe(base.notes);
    expect(out.lastVerified).toBe("2026-07-28");
  });

  it("the correction's own provenance replaces the committed source", () => {
    // Keeping the old source string would cite a check that did not produce this
    // value, which is the same defect as citing a dataset we never read.
    const out = apply(base, row({ notes: "Closed for works", last_verified: "2026-07-28", updated_by: "Surui" }));
    expect(out.source).toContain("2026-07-28");
    expect(out.source).toContain("Surui");
    expect(out.source).not.toBe(base.source);
  });

  it("no override leaves the record untouched", () => {
    expect(apply(base, undefined)).toBe(base);
  });

  it("hidden takes a place out of the assistant entirely", () => {
    const out = merge([row({ hidden: true })]);
    expect(out.find((p) => p.id === base.id)).toBeUndefined();
    expect(out.length).toBe(PLACES.length - 1);
  });

  it("closed is not hidden: a traveller still hears about it", () => {
    const out = merge([row({ status: "closed", last_verified: "2026-07-28" })]);
    const hit = out.find((p) => p.id === base.id);
    expect(hit?.status).toBe("closed");
  });

  it("an empty correction set returns the committed data by identity", () => {
    expect(merge([])).toBe(PLACES);
  });
});

describe("a claim cannot arrive without the date somebody checked it", () => {
  it("the route refuses a correction with no date", () => {
    expect(ROUTE).toMatch(/if \(claims && !dated\)/);
    expect(ROUTE).toMatch(/reason: "date_required"/);
  });

  it("hiding a record is exempt, because it is not a claim about the venue", () => {
    // `hidden` is deliberately absent from the list that requires a date.
    const claims = ROUTE.match(/const claims = \(\[([^\]]*)\]/)?.[1] ?? "";
    expect(claims).toContain("wheelchair");
    expect(claims).toContain("notes");
    expect(claims).not.toContain("hidden");
  });

  it("the editor says so before the server has to", () => {
    expect(EDITOR).toMatch(/date_required/);
  });
});

describe("nothing in a browser can write the correction table", () => {
  it("the schema grants public read and no write policy at all", () => {
    expect(SCHEMA).toMatch(/create policy "overrides are public" on public\.place_overrides\s*\n\s*for select using \(true\)/);
    // Any of these would open the table to the publishable key.
    expect(SCHEMA).not.toMatch(/on public\.place_overrides\s*\n\s*for (insert|update|delete|all)/);
    expect(SCHEMA).toMatch(/alter table public\.place_overrides enable row level security/);
  });

  it("the secret key is read in exactly one module, and it is server-only", () => {
    const server = readFileSync(join(root, "lib", "supabase", "server.ts"), "utf8");
    expect(server).toMatch(/process\.env\.SUPABASE_SECRET_KEY/);
    // Never prefixed for the browser, which would publish it in the bundle.
    expect(server).not.toMatch(/NEXT_PUBLIC_SUPABASE_SECRET/);
    for (const f of ["lib/supabase/browser.ts", "components/admin/PlaceEditor.tsx", "components/admin/AdminConsole.tsx"]) {
      expect(readFileSync(join(root, f), "utf8"), f).not.toMatch(/SUPABASE_SECRET_KEY|serviceClient/);
    }
  });

  it("the write route checks the admin session before anything else", () => {
    for (const verb of ["export async function GET", "export async function POST"]) {
      const at = ROUTE.indexOf(verb);
      expect(at, verb).toBeGreaterThan(-1);
      // The auth check is the first statement in the body, not somewhere after a
      // parse that could already have had a side effect.
      expect(ROUTE.slice(at, at + 220), verb).toMatch(/if \(!\(await authed\(\)\)\)/);
    }
  });

  it("only ids from the committed knowledge base can be corrected", () => {
    expect(ROUTE).toMatch(/const IDS = new Set\(PLACES\.map/);
    expect(ROUTE).toMatch(/if \(!IDS\.has\(placeId\)\)/);
  });
});

describe("the console shows what the assistant is actually answering from", () => {
  it("the table renders the corrected record, not the committed one", () => {
    // A console that shows the shipped value after somebody corrected it is showing
    // the wrong data to the one person who needs the right data.
    expect(CONSOLE).toMatch(/const p = apply\(base, row\)/);
  });

  it("a corrected record is labelled as corrected", () => {
    expect(CONSOLE).toMatch(/corrected/);
  });

  it("there is a trail, and it is shown", () => {
    expect(ROUTE).toMatch(/place_override_log/);
    expect(CONSOLE).toMatch(/Last corrections/);
  });
});
