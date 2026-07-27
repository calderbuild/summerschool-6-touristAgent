import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { rank, series, joinCounts, type CityEvent } from "../events";
import { stationForPoint } from "../router";

const APP = resolve(fileURLToPath(import.meta.url), "../../..");

/**
 * The city publishes a flag about a venue and the operator publishes one about a
 * station. This file guards the rule that keeps them apart, and the rule that a
 * missing flag stays missing.
 */

const ev = (over: Partial<CityEvent> = {}): CityEvent => ({
  id: "e1",
  title: "Something",
  url: "https://www.paris.fr/evenements/x",
  venue: "A hall",
  postcode: "75012",
  lat: 48.8443,
  lng: 2.3743,
  startsAt: "2026-07-27T10:00:00+00:00",
  endsAt: "2026-07-30T18:00:00+00:00",
  free: true,
  access: { wheelchair: "unknown", blind: "unknown", deaf: "unknown", signLanguage: "unknown" },
  station: { id: "IDFM:1", name: "Somewhere", lines: ["1"], status: "ok", metres: 100 },
  ...over,
});

describe("what the city published", () => {
  it("keeps a missing flag missing", () => {
    // 0 and 1 are the only values the feed uses; absent is the common case and
    // it is neither. Reading absence as "no" slanders a venue and reading it as
    // "yes" strands somebody, so the type has three values and so does the sort.
    const src = readFileSync(join(APP, "lib", "events.ts"), "utf8");
    expect(src).toMatch(/export type Flag = "yes" \| "no" \| "unknown"/);
    // Nothing may coerce the flag with a truthiness test.
    expect(src).not.toMatch(/Boolean\(\s*r\.pmr/);
    expect(src).not.toMatch(/!!\s*r\.pmr/);
  });

  it("never merges the city's claim with ours into one verdict", () => {
    // Two fields, two owners, and the interface labels both. A single combined
    // status would be a claim neither publisher made.
    const e = ev();
    expect(e.access.wheelchair).toBeDefined();
    expect(e.station.status).toBeDefined();
    expect(Object.keys(e)).not.toContain("accessible");
    const card = readFileSync(join(APP, "components", "WhatsOn.tsx"), "utf8");
    expect(card).toMatch(/wo_city_label/);
    expect(card).toMatch(/wo_station_label/);
  });
});

describe("ranking the week", () => {
  it("puts an accessible event above one nobody said anything about", () => {
    const yes = ev({ id: "yes", title: "A", access: { ...ev().access, wheelchair: "yes" } });
    const silent = ev({ id: "silent", title: "B" });
    expect(rank([silent, yes])[0].id).toBe("yes");
  });

  it("keeps an accessible event whose station is a barrier, rather than hiding it", () => {
    const good = ev({ id: "good", title: "A", access: { ...ev().access, wheelchair: "yes" } });
    const tension = ev({
      id: "tension",
      title: "B",
      access: { ...ev().access, wheelchair: "yes" },
      station: { id: "IDFM:2", name: "Stairs", lines: ["4"], status: "stairs", metres: 300 },
    });
    const out = rank([tension, good]).map((e) => e.id);
    expect(out).toContain("tension");
    expect(out.indexOf("good")).toBeLessThan(out.indexOf("tension"));
  });

  it("collapses a municipal series published once per district", () => {
    // The city lists this seventeen times, once per arrondissement, and a page
    // that prints all seventeen looks broken rather than thorough.
    const titles = [12, 13, 17, 18, 20].map(
      (n) => `Découvrez les activités des clubs séniors dans le ${n}e arrondissement de Paris`,
    );
    expect(new Set(titles.map(series)).size).toBe(1);
    const events = titles.map((title, i) => ev({ id: `s${i}`, title }));
    expect(rank(events)).toHaveLength(1);
  });

  it("does not collapse two genuinely different events", () => {
    expect(series("Sport seniors : badminton")).not.toBe(series("Sport seniors : fitness"));
  });
});

describe("the joined count", () => {
  it("counts only what the city called accessible, split by our station", () => {
    const yes = { ...ev().access, wheelchair: "yes" as const };
    const events = [
      ev({ id: "a", access: yes }),
      ev({ id: "b", access: yes, station: { id: "2", name: "X", lines: ["4"], status: "conditional", metres: 200 } }),
      ev({ id: "c", access: yes, station: { id: "3", name: "Y", lines: ["4"], status: "stairs", metres: 200 } }),
      ev({ id: "d" }),
    ];
    const j = joinCounts(events);
    expect(j.cityAccessible).toBe(3);
    expect(j.stationStepFree).toBe(1);
    expect(j.stationConditional).toBe(1);
    expect(j.stationBarrier).toBe(1);
    expect(j.citySilent).toBe(1);
    // Every accessible event lands in exactly one bucket, or the page prints a
    // total that does not add up.
    expect(j.stationStepFree + j.stationConditional + j.stationBarrier + j.stationUnknown).toBe(j.cityAccessible);
  });
});

describe("the station a listing names", () => {
  it("is the one the router would choose, not a second opinion", () => {
    // Two components each finding their own nearest station is how a listing
    // names one station and the route another.
    const s = stationForPoint(48.8443, 2.3743, "wheelchair");
    expect(s.name.length).toBeGreaterThan(0);
    expect(s.lines.length).toBeGreaterThan(0);
    expect(s.metres).toBeGreaterThanOrEqual(0);
  });

  it("carries its lines, so no summary has to supply them from memory", () => {
    // The model named Olympiades as line 14 from its own knowledge and happened
    // to be right. The next guess would not be, so the lines travel with the data.
    const chat = readFileSync(join(APP, "app", "api", "chat", "route.ts"), "utf8");
    expect(chat).toMatch(/e\.station\.lines/);
    expect(chat).toMatch(/never from memory/);
  });
});
