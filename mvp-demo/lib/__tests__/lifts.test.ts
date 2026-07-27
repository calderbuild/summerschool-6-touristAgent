import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { liftsAt, liftsConfigured, type LiftFeed } from "../lifts";

const APP = resolve(fileURLToPath(import.meta.url), "../../..");

/**
 * These tests guard the one thing this file must never do: claim a lift works.
 *
 * The dataset's field names are public but its status *values* are not readable
 * without a token, so the classifier has to stay empty until somebody has seen a
 * real record. A future edit that "helpfully" fills in a plausible English enum
 * is the failure these tests exist to catch.
 */

const feed = (lifts: LiftFeed["lifts"], live = true): LiftFeed => ({
  fetchedAt: "2026-07-27T00:00:00.000Z",
  live,
  lifts,
  seenStatuses: {},
});

const lift = (over: Partial<LiftFeed["lifts"][number]> = {}): LiftFeed["lifts"][number] => ({
  station: "Gare de Lyon",
  lat: 48.8443,
  lng: 2.3743,
  liftId: "L1",
  statusRaw: "Quelque chose",
  status: "unknown",
  reason: null,
  situation: null,
  updatedAt: null,
  ...over,
});

describe("the lift classifier", () => {
  it("has no verified status values yet, and says so in the source", () => {
    const src = readFileSync(join(APP, "lib", "lifts.ts"), "utf8");
    const block = src.slice(
      src.indexOf("const VERIFIED_STATUSES"),
      src.indexOf("function classify"),
    );
    // Any uncommented "key": "working" | "out" pair means somebody added a mapping.
    const mappings = block
      .split("\n")
      .filter((l) => /"\s*:\s*"(working|out)"/.test(l) && !l.trim().startsWith("//"));
    expect(mappings).toEqual([]);
    expect(src).toMatch(/EMPTY ON PURPOSE/);
  });

  it("never reports a working lift while the enum is unverified", async () => {
    const { liftFeed } = await import("../lifts");
    const live = await liftFeed();
    expect(live.lifts.every((l) => l.status !== "working")).toBe(true);
  });

  it("keeps the operator's own wording so an unclassified status is still useful", () => {
    const l = lift({ statusRaw: "État inconnu du système" });
    expect(l.statusRaw.length).toBeGreaterThan(0);
    expect(l.status).toBe("unknown");
  });
});

describe("matching a lift to one of our stations", () => {
  it("requires the coordinate and the name to agree", () => {
    const station = { name: "Gare de Lyon", lat: 48.8443, lng: 2.3743 };
    // Right name, wrong side of Paris.
    expect(liftsAt(feed([lift({ lat: 48.88, lng: 2.29 })]), station)).toEqual([]);
    // Right place, a different station's name.
    expect(liftsAt(feed([lift({ station: "Nation" })]), station)).toEqual([]);
    // Both agree.
    expect(liftsAt(feed([lift()]), station)).toHaveLength(1);
  });

  it("returns nothing at all when the feed is not live", () => {
    const station = { name: "Gare de Lyon", lat: 48.8443, lng: 2.3743 };
    expect(liftsAt(feed([lift()], false), station)).toEqual([]);
    expect(liftsAt(null, station)).toEqual([]);
  });

  it("reports whether a token is configured rather than guessing", () => {
    expect(typeof liftsConfigured()).toBe("boolean");
    // In CI and on a laptop without the token, absence must be the answer.
    if (!process.env.IDFM_PRIM_TOKEN) expect(liftsConfigured()).toBe(false);
  });
});

describe("the endpoint's contract", () => {
  it("never puts the token in a thrown message or a response", () => {
    const src = readFileSync(join(APP, "lib", "lifts.ts"), "utf8");
    // The URL carries the key, so it must never be interpolated into an error.
    expect(src).not.toMatch(/throw new Error\([^)]*url/i);
    // The route may *name* the variable in its help text, which is useful. What
    // it must never do is read the value, which is the only way it could leak.
    const route = readFileSync(join(APP, "app", "api", "lifts", "route.ts"), "utf8");
    expect(route).not.toMatch(/process\.env/);
  });

  it("asks for the fields the dataset actually publishes", () => {
    // Field names read from the dataset's own public metadata on 2026-07-27.
    const src = readFileSync(join(APP, "lib", "lifts.ts"), "utf8");
    for (const f of [
      "zdcid",
      "zdcname",
      "centroidzdc",
      "liftid",
      "liftstatus",
      "liftreason",
      "liftsituation",
      "liftstateupdate",
    ]) {
      expect(src).toContain(f);
    }
  });
});
