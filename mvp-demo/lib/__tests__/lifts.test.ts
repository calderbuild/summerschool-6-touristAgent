import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { liftCounts, liftsAt, liftsConfigured, liftsOut, type LiftFeed } from "../lifts";

const APP = resolve(fileURLToPath(import.meta.url), "../../..");
const SRC = readFileSync(join(APP, "lib", "lifts.ts"), "utf8");

/**
 * These tests guard the one thing this file must never do: claim a lift works on
 * anything other than a value somebody has counted in a live response.
 *
 * They used to assert the opposite invariant, that the map was empty, because the
 * dataset was unreadable without a registered token. The token now exists and the
 * map holds the two values the feed really uses. What has not changed is the rule
 * underneath: a mapping is allowed only with the date and count it was observed
 * with, and a value the operator adds tomorrow must degrade to `unknown` rather
 * than be guessed at.
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
  direction: null,
  mode: null,
  updatedAt: null,
  ...over,
});

function verifiedBlock(): string {
  return SRC.slice(SRC.indexOf("const VERIFIED_STATUSES"), SRC.indexOf("function classify"));
}

describe("the lift classifier", () => {
  it("maps only values that were counted in a real response, each with its date", () => {
    const lines = verifiedBlock()
      .split("\n")
      .filter((l) => /:\s*"(working|out)"/.test(l) && !l.trim().startsWith("//"));
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      // Every mapping carries "observed YYYY-MM-DD in N records". Without that a
      // reader cannot tell a counted value from a plausible-looking guess, which
      // is the whole failure mode.
      expect(l, l.trim()).toMatch(/observed \d{4}-\d{2}-\d{2} in \d+ records/);
    }
  });

  it("maps exactly the two states the feed uses, and leaves its own 'unknown' unknown", async () => {
    const { default: mod } = await import("../lifts").then((m) => ({ default: m }));
    const keys = verifiedBlock()
      .split("\n")
      .filter((l) => /:\s*"(working|out)"/.test(l) && !l.trim().startsWith("//"))
      .map((l) => l.trim().split(":")[0].replace(/["',]/g, "").trim());
    expect(keys.sort()).toEqual(["available", "notavailable"]);
    // The operator publishes a third value, the literal string "unknown", on 136
    // of 944 lifts. Mapping it to anything would turn "we do not know" into an
    // answer.
    expect(keys).not.toContain("unknown");
    expect(typeof mod.liftFeed).toBe("function");
  });

  it("keeps the operator's own wording so an unclassified status is still useful", () => {
    const l = lift({ statusRaw: "État inconnu du système" });
    expect(l.statusRaw.length).toBeGreaterThan(0);
    expect(l.status).toBe("unknown");
  });

  it("does not treat the feed's placeholder slash as a reason", () => {
    // liftreason is "/" on 136 records, which is not a reason and must not be
    // shown to a traveller as one.
    expect(SRC).toMatch(/!==?\s*"\/"/);
  });
});

describe("the counts the interface quotes", () => {
  it("adds up to the feed, so no lift is counted twice or dropped", () => {
    const c = liftCounts(
      feed([
        lift({ status: "working" }),
        lift({ status: "working" }),
        lift({ status: "out" }),
        lift({ status: "unknown" }),
      ]),
    );
    expect(c).toEqual({ total: 4, working: 2, out: 1, unknown: 1 });
    expect(c.working + c.out + c.unknown).toBe(c.total);
  });

  it("lists only the broken ones, and lists them in a stable order", () => {
    const out = liftsOut(
      feed([
        lift({ station: "Nation", status: "out", liftId: "B" }),
        lift({ station: "Châtelet", status: "out", liftId: "A" }),
        lift({ station: "Bastille", status: "working", liftId: "C" }),
        lift({ station: "Opéra", status: "unknown", liftId: "D" }),
      ]),
    );
    expect(out.map((l) => l.station)).toEqual(["Châtelet", "Nation"]);
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
    if (!process.env.IDFM_DATASET_TOKEN) expect(liftsConfigured()).toBe(false);
  });
});

describe("the endpoint's contract", () => {
  it("sends the token as a header, so it never lands in a URL or a log", () => {
    expect(SRC).toMatch(/Authorization:\s*`Apikey \$\{TOKEN\}`/);
    // A query parameter would put the credential in every access log between here
    // and the operator. It was tried against a real request and answers 401
    // anyway, but the reason not to use it is the log.
    const prose = SRC.split("\n").filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//"));
    expect(prose.join("\n")).not.toMatch(/searchParams\.set\(\s*"apikey"/i);
  });

  it("reads the dataset token, not the API token, which does not work here", () => {
    expect(SRC).toMatch(/process\.env\.IDFM_DATASET_TOKEN/);
    expect(SRC).not.toMatch(/process\.env\.IDFM_PRIM_TOKEN/);
  });

  it("never puts the token in a thrown message or a response", () => {
    expect(SRC).not.toMatch(/throw new Error\([^)]*url/i);
    // The route may *name* the variable in its help text, which is useful. What
    // it must never do is read the value, which is the only way it could leak.
    const route = readFileSync(join(APP, "app", "api", "lifts", "route.ts"), "utf8");
    expect(route).not.toMatch(/process\.env/);
  });

  it("asks for the fields the dataset actually publishes", () => {
    // Field names read from a live response on 2026-07-27, not from a doc page.
    for (const f of [
      "zdcid",
      "zdcname",
      "centroidzdc",
      "liftid",
      "liftstatus",
      "liftreason",
      "liftsituation",
      "liftdirection",
      "liftmode",
      "liftstateupdate",
    ]) {
      expect(SRC).toContain(f);
    }
  });
});

describe("what the interface may say about lift freshness", () => {
  const files = [
    join(APP, "lib", "i18n.tsx"),
    join(APP, "lib", "howItWorks.ts"),
    join(APP, "lib", "data.ts"),
  ];

  /** Comments may quote a retired sentence to explain why it went; only the
   *  strings a traveller can read are under test. Checked by running this and
   *  reading the hits, because a negative pattern that matches its own
   *  explanation is a false alarm this repo has already had twice. */
  function prose(f: string): string {
    return readFileSync(f, "utf8")
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
      .join("\n");
  }

  it("never claims a snapshot of lift status, of any age", () => {
    // The chat card printed "Lift status is as of this morning, not a live feed"
    // and /how-it-works repeated it. Both read as careful hedging and both were
    // false at the time: there was no lift status here at all. It is live now, so
    // a morning snapshot would be wrong in the other direction.
    const claim = /(lift status|état des ascenseurs|电梯状态)[^.\n]{0,60}(as of this morning|de ce matin|今早|今晨)/i;
    for (const f of files) expect(prose(f), f).not.toMatch(claim);
  });

  it("no longer tells a traveller we cannot see the lifts", () => {
    // The inverse of the guard above, and the reason both exist: a sentence that
    // was honest on Sunday is a false claim on Monday, and nothing but a test
    // notices the day it turns over.
    const denial =
      /(cannot see the lifts|needs a (registered )?token we do not (yet )?(have|hold)|nous ne pouvons pas voir les ascenseurs|读不到)/i;
    for (const f of files) expect(prose(f), f).not.toMatch(denial);
  });
});
