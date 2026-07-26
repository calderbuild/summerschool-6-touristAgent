import { describe, expect, it } from "vitest";
import { PLACES, SERVICES } from "../places";
import { ROUTES } from "../data";
import { legendKey, statusHex } from "../status";

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
