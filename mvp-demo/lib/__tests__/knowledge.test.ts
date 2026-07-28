import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { PLACES, SERVICES } from "../places";
import { ROUTES } from "../data";
import { legendKey, statusHex } from "../status";

/** Resolved from this file, so the suite answers the same from either directory. */
const APP = resolve(fileURLToPath(import.meta.url), "../../..");

/**
 * The honesty rules, enforced rather than remembered.
 *
 * Every claim this product makes rests on the knowledge base saying what it does
 * and does not know. A record that quietly loses its source, its check date, or
 * its caveat is the exact failure the whole product is supposed to prevent, and
 * it would never show up as a broken build.
 */

describe("places", () => {
  it("has one unique id each", () => {
    const ids = PLACES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("names a source and a check date for every record", () => {
    for (const p of PLACES) {
      expect(p.source, `${p.id} source`).toBeTruthy();
      expect(p.lastVerified, `${p.id} lastVerified`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("gives an official link for every record, so a price can be confirmed", () => {
    for (const p of PLACES) {
      expect(p.officialUrl, `${p.id} officialUrl`).toMatch(/^https?:\/\//);
    }
  });

  it("never leaves a field blank: unknown is written, not omitted", () => {
    for (const p of PLACES) {
      for (const field of ["budget", "openingHours", "wheelchair", "nearestTransit"] as const) {
        expect(p[field], `${p.id}.${field}`).not.toBe("");
      }
    }
  });

  it("says where an OpenStreetMap-sourced record came from, since it is the weaker tier", () => {
    // These records are a contributor's observation, not the venue's word. If one
    // ever stops saying so, the assistant would present it as if it were checked.
    const osm = PLACES.filter((p) => /openstreetmap|osm/i.test(p.source));
    expect(osm.length).toBeGreaterThan(0);
    for (const p of osm) {
      expect(`${p.notes} ${p.wheelchair}`.toLowerCase(), `${p.id} should admit it is unconfirmed`).toMatch(
        /not confirmed|unconfirmed|osm/
      );
    }
  });

  it("covers all ten categories the written spec asks for", () => {
    const have = new Set<string>([
      ...PLACES.map((p) => p.category),
      ...SERVICES.map((s) => s.category),
    ]);
    // heritage, museums, monuments, shopping, restaurants, leisure, transport,
    // health, emergency, public services
    for (const group of [
      ["Cathedral", "Basilica", "Palace"],
      ["Museum"],
      ["Monument"],
      ["Shopping"],
      ["Restaurant"],
      ["Park"],
      ["Transportation"],
      ["Pharmacy", "Health services"],
      ["Emergency services"],
      ["Useful public services"],
    ]) {
      expect(group.some((c) => have.has(c)), `missing: ${group.join(" / ")}`).toBe(true);
    }
  });
});

describe("practical services", () => {
  it("carries a caveat on every entry", () => {
    // The caveat is the field that decides whether an entitlement applies to a
    // foreign visitor. An empty one means the assistant would quote only the good
    // half, and someone gets turned away at a desk.
    for (const s of SERVICES) {
      expect(s.caveat.length, `${s.id} caveat`).toBeGreaterThan(20);
      expect(s.officialUrl, `${s.id} officialUrl`).toMatch(/^https?:\/\//);
      expect(s.lastVerified, `${s.id} lastVerified`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("includes the emergency number that works without a voice call", () => {
    const relay = SERVICES.find((s) => /114/.test(s.nameEn));
    expect(relay, "114 must be present: it is the route for anyone who cannot speak or hear").toBeTruthy();
  });
});

describe("routes", () => {
  it("has unique ids and at least two stops each", () => {
    const ids = ROUTES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of ROUTES) expect(r.nodes.length, `${r.id} nodes`).toBeGreaterThan(1);
  });

  it("cites sources on every route", () => {
    for (const r of ROUTES) expect(r.sources.length, `${r.id} sources`).toBeGreaterThan(0);
  });

  it("writes an unknown step count as null rather than zero", () => {
    // Zero would read as "no steps", which is the opposite of "we do not know".
    for (const r of ROUTES) {
      for (const n of r.nodes) {
        if (n.at === "unknown" && n.steps === 0) {
          throw new Error(`${r.id}/${n.name}: unknown status with steps 0 reads as step-free`);
        }
      }
    }
  });

  it("offers a step-free alternative wherever it reports a barrier", () => {
    // A barrier with no way around it is a dead end, and the product's promise is
    // the way around.
    for (const r of ROUTES) {
      for (const n of r.nodes) {
        if (n.barrier) expect(n.alt, `${r.id}/${n.name} barrier without an alternative`).toBeTruthy();
      }
    }
  });

  it("translates every traveller-facing string into all three languages", () => {
    for (const r of ROUTES) {
      for (const lang of ["en", "fr", "zh"] as const) {
        expect(r.title[lang], `${r.id} title.${lang}`).toBeTruthy();
        for (const n of r.nodes) {
          expect(n.atText[lang], `${r.id}/${n.name} atText.${lang}`).toBeTruthy();
          if (n.barrier) expect(n.barrier[lang], `${r.id}/${n.name} barrier.${lang}`).toBeTruthy();
          if (n.alt) expect(n.alt[lang], `${r.id}/${n.name} alt.${lang}`).toBeTruthy();
        }
      }
    }
  });
});

describe("status vocabulary", () => {
  it("gives every status a colour and a legend label", () => {
    for (const s of ["ok", "lift", "lift_down", "stairs", "unknown"] as const) {
      expect(statusHex(s), `${s} hex`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(legendKey[s], `${s} legend`).toBeTruthy();
    }
  });

  it("keeps passable, blocked and unknown visually apart", () => {
    // Deliberately three colours, not five: step-free and working-lift are both
    // "you can get through" and share green, a dead lift and stairs both mean
    // "you cannot" and share red. Those two are told apart by icon and label
    // instead. What must never collapse is the distinction between the groups,
    // because that is the one a traveller acts on.
    const passable = new Set([statusHex("ok"), statusHex("lift")]);
    const blocked = new Set([statusHex("lift_down"), statusHex("stairs")]);
    const unknown = statusHex("unknown");
    expect(passable.size).toBe(1);
    expect(blocked.size).toBe(1);
    expect(new Set([...passable, ...blocked, unknown]).size).toBe(3);
  });
});

/**
 * The hand-written routes state facts a dataset can check. These are the checks.
 *
 * Written after a review found three of them wrong at once on the same route: it
 * called a one-stop ride "3 stops", changed onto RER C at Chatelet where RER C
 * does not call, and built its whole story on a lift "reported out of service
 * today", which is a live status from the one dataset this app cannot read. Two of
 * the three were verifiable against files already in the repository, so from here
 * the machine checks them rather than a reader.
 */
describe("what a hand-written route may claim", () => {
  const network = JSON.parse(
    readFileSync(join(APP, "lib", "network.json"), "utf8"),
  ) as { stations: Record<string, { name: string; lines: string[] }>; hops: { a: string; b: string; line: string }[] };

  const norm = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const idOf = (name: string) =>
    Object.entries(network.stations).find(([, s]) => norm(s.name) === norm(name))?.[0];
  /** "M14" -> "14", "RER B" -> "B", which is how the timetable names them. */
  const lineId = (label: string) => label.replace(/^M/, "").replace(/^RER\s+/, "").trim();

  function hopsBetween(a: string, b: string, line: string): number | null {
    const A = idOf(a), B = idOf(b);
    if (!A || !B) return null;
    const adj = new Map<string, Set<string>>();
    for (const h of network.hops) {
      if (h.line !== line) continue;
      (adj.get(h.a) ?? adj.set(h.a, new Set()).get(h.a)!).add(h.b);
      (adj.get(h.b) ?? adj.set(h.b, new Set()).get(h.b)!).add(h.a);
    }
    const seen = new Set([A]);
    let edge = [A], d = 0;
    while (edge.length) {
      if (edge.includes(B)) return d;
      const next: string[] = [];
      for (const n of edge) for (const m of adj.get(n) ?? []) if (!seen.has(m)) { seen.add(m); next.push(m); }
      edge = next; d += 1;
    }
    return null;
  }

  it("never states a stop count the timetable contradicts", () => {
    const problems: string[] = [];
    for (const r of ROUTES) {
      r.nodes.forEach((node, i) => {
        const said = node.into?.text.en.match(/\b(\d+)\s+stops?\b/);
        if (!said || i === 0 || !node.line) return;
        const from = r.nodes[i - 1].name;
        const real = hopsBetween(from, node.name, lineId(node.line.label));
        // A leg the graph cannot see is a separate finding, covered below.
        if (real === null) return;
        if (real !== Number(said[1])) {
          problems.push(`${r.id}: ${from} -> ${node.name} says ${said[1]}, timetable says ${real}`);
        }
      });
    }
    expect(problems).toEqual([]);
  });

  it("never rides a line the timetable does not run through that station", () => {
    const problems: string[] = [];
    for (const r of ROUTES) {
      for (const node of r.nodes) {
        if (!node.line) continue;
        const id = idOf(node.name);
        if (!id) continue; // a landmark rather than a station
        const lines = network.stations[id].lines;
        if (!lines.includes(lineId(node.line.label))) {
          problems.push(`${r.id}: ${node.name} is drawn on ${node.line.label}, which the timetable does not run there (${lines.join(", ")})`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("never reports a lift as out of service, because no feed here says so", () => {
    // `lift_down` is a real status the type carries for the day a live feed exists.
    // Until then a hand-written one is a fabricated outage, and a traveller cannot
    // tell it from a real one.
    for (const r of ROUTES) {
      for (const node of r.nodes) {
        expect(node.at, `${r.id} / ${node.name}`).not.toBe("lift_down");
        expect(node.into?.status, `${r.id} / into ${node.name}`).not.toBe("lift_down");
      }
    }
  });

  it("cites only datasets this project has actually read", () => {
    // This app does read the lift feed now, so the reason has changed rather than
    // gone away: these routes are the ones the team walked, every status in them
    // came from standing there, and none of it came from the feed. Citing the feed
    // on a hand-written route would attribute our own observation to somebody
    // else's dataset, which is the same defect as citing a dataset we never read.
    for (const r of ROUTES) {
      for (const s of r.sources) {
        expect(s, `${r.id} sources`).not.toMatch(/ascenseurs/i);
        expect(s, `${r.id} sources`).not.toMatch(/^RATP · accessible stations$/);
        expect(s, `${r.id} sources`).not.toMatch(/^SNCF · gare accessibility$/);
      }
    }
  });

  /**
   * The graph has no buses, and the prompt used to ask for one anyway.
   *
   * "When a lift is out of service, the reply gives a step-free alternative: a
   * level-boarding bus" was in the prompt while not one bus route existed in any
   * file here, so the model supplied the missing half from memory. On production it
   * told a wheelchair user to "board bus 40 at the tram stop; it is level-boarding
   * and stops much closer to the basilica entrance", which is three claims this app
   * cannot make about a route it does not have. Found by reading the reply, not the
   * code.
   *
   * Both directions, because the rule is only honest while the gap is real: if the
   * graph ever gains a bus, this fails and the prompt has to be revisited.
   */
  /**
   * The route and the prompt have to mean the same traveller.
   *
   * When nobody picked a profile, `computedRoute` was called with ["wheelchair"] and
   * `systemPrompt` was handed the empty array, so the model described the strictest
   * journey in Paris as though it were the ordinary one. A stroller user who picked
   * nothing got a longer route through different stations and no sentence explaining
   * why. Nothing was broken and every test passed: two call sites simply answered
   * the same question differently, which is the shape of entries 5 and 12.
   */
  it("plans and describes the same traveller, and says when it assumed one", () => {
    const route = readFileSync(join(APP, "app", "api", "chat", "route.ts"), "utf8");

    // Resolved once, then both consumers get the same value.
    expect(route).toMatch(/const stated = profiles\.length > 0 \? profiles : null;/);
    expect(route).toMatch(/const planned: ProfileId\[\] = stated \?\? \["wheelchair"\];/);
    expect(route).toMatch(/computedRoute\(lastUser, planned, lifts\)/);
    // The defect itself: defaulting inline at one call site only.
    expect(route).not.toMatch(/computedRoute\([^)]*profiles\.length \?/);

    // And an assumed constraint has to be disclosed, not worn silently.
    expect(route).toMatch(/has not said how they travel/);
    expect(route).toMatch(/That assumption is the app's, not theirs/);
  });

  it("has no bus data, and a prompt that says so", () => {
    const net = JSON.parse(readFileSync(join(APP, "lib", "network.json"), "utf8")) as {
      lines: { mode?: string }[];
    };
    const modes = new Set(net.lines.map((l) => l.mode));
    expect(modes.has("bus"), "the graph gained buses, so the prompt's ban is now wrong").toBe(false);

    const prompt = readFileSync(join(APP, "app", "api", "chat", "route.ts"), "utf8");
    expect(prompt).toMatch(/no bus or Montmartrobus data anywhere in this app/);
    expect(prompt).toMatch(/never name a bus route/);
    // The sanctioned exception has to stay narrow. Production named bus 87, which is
    // genuinely in the walked-route notes, and then said it "runs from Bastille to
    // the Louvre area", which no note here says. A permitted noun is not a permitted
    // sentence about that noun.
    expect(prompt).toMatch(/only repeat what that note says/);
    expect(prompt).toMatch(/They do not say where it goes/);
    for (const r of ROUTES) {
      for (const node of r.nodes) {
        const alt = node.alt ? Object.values(node.alt).join(" ") : "";
        if (!/bus \d/.test(alt)) continue;
        // If a note ever starts claiming a destination, the prompt rule above becomes
        // false and this is the thing that says so.
        expect(alt, `${r.id} / ${node.name} alt`).not.toMatch(/\bto the\b|\bruns to\b|\bgoes to\b/i);
      }
    }
    // And it must not go back to asking for the thing it cannot supply.
    expect(prompt).not.toMatch(/alternative: a level-boarding bus/);
  });
});
