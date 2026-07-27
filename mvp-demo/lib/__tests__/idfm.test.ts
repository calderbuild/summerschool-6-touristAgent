import { describe, expect, it } from "vitest";
import { ACCESS_LEVELS, findStation, stationKey, toiletsAt, type NetworkFacts } from "../idfm";
import { ROUTES } from "../data";

/**
 * Matching our stop names to the operator's register.
 *
 * This is where a real-data layer goes wrong quietly: a name that fails to match
 * shows "not listed", which reads as a fact about the station rather than a bug
 * in a regex. Worse is a match that is too loose, which would put a neighbouring
 * station's accessibility class under our stop.
 */

// Shaped exactly like the live payload, with the real wording from the dataset.
const FACTS: NetworkFacts = {
  fetchedAt: "2026-07-27T07:32:33.835Z",
  stations: [
    { stop: "Gare de Lyon", level: 3, levelFr: "train accessible sur réservation préalable auprès du service AssistenGare", note: null },
    {
      stop: "Châtelet les Halles",
      level: 1,
      levelFr: "gare ou arrêt non accessible",
      note: "Ligne A et B accessibles sur demande auprès d'un agent en station. Ligne D non accessible.",
    },
    { stop: "Champ de Mars Tour Eiffel", level: 3, levelFr: "train accessible sur réservation préalable auprès du service AssistenGare", note: null },
    { stop: "Nation", level: 4, levelFr: "train accessible sur demande auprès d'un agent en station", note: null },
  ],
  toilets: [
    { line: "A", station: "Nation", free: true, insideGates: true, where: "Sur le quai direction Paris." },
    { line: "14", station: "Bibliotheque Francois Mitterrand", free: true, insideGates: false, where: null },
  ],
};

describe("stationKey", () => {
  it("ignores accents, case, punctuation and the filler words", () => {
    expect(stationKey("Châtelet")).toBe(stationKey("Chatelet"));
    expect(stationKey("Gare de Lyon")).toBe(stationKey("gare-de-lyon"));
    expect(stationKey("Champ de Mars–Tour Eiffel")).toBe(stationKey("Champ de Mars Tour Eiffel"));
  });

  it("keeps enough to tell two stations apart", () => {
    // The filler-word strip must not reduce distinct names to the same key.
    expect(stationKey("Gare de Lyon")).not.toBe(stationKey("Gare du Nord"));
    expect(stationKey("Nation")).not.toBe(stationKey("Invalides"));
  });
});

describe("findStation", () => {
  it("matches our stop names to the operator's, en dash and all", () => {
    expect(findStation(FACTS, "Gare de Lyon")?.level).toBe(3);
    expect(findStation(FACTS, "Châtelet")?.stop).toBe("Châtelet les Halles");
    expect(findStation(FACTS, "Champ de Mars–Tour Eiffel")?.level).toBe(3);
  });

  it("returns nothing rather than a neighbour when the stop is not listed", () => {
    // Their register covers RER and rail; a métro-only station is absent, and
    // absence has to stay absence.
    expect(findStation(FACTS, "Bastille")).toBeNull();
    expect(findStation(FACTS, "Tour Eiffel")).toBeNull();
  });

  it("is null when the register could not be fetched at all", () => {
    expect(findStation(null, "Gare de Lyon")).toBeNull();
  });
});

describe("toiletsAt", () => {
  it("finds the accessible toilet at a station that has one", () => {
    const wc = toiletsAt(FACTS, "Nation");
    expect(wc).toHaveLength(1);
    expect(wc[0].free).toBe(true);
    expect(wc[0].insideGates).toBe(true);
  });

  it("returns an empty list, never a guess, where none is published", () => {
    expect(toiletsAt(FACTS, "Gare de Lyon")).toEqual([]);
    expect(toiletsAt(null, "Nation")).toEqual([]);
  });
});

describe("access level vocabulary", () => {
  it("covers exactly the four classes the dataset uses", () => {
    expect(Object.keys(ACCESS_LEVELS).map(Number).sort()).toEqual([1, 3, 4, 6]);
  });

  it("never translates a conditional class into a plain yes", () => {
    // "Accessible on prior booking" is not "accessible". A gloss that drops the
    // condition would send someone to a station they cannot use today.
    for (const lang of ["en", "fr", "zh"] as const) {
      expect(ACCESS_LEVELS[3][lang]).toMatch(/booking|réservation|预约/i);
      expect(ACCESS_LEVELS[4][lang]).toMatch(/staff|agent|工作人员/i);
      expect(ACCESS_LEVELS[1][lang]).toMatch(/not accessible|non accessible|不可/i);
    }
  });
});

describe("no fabricated disruption", () => {
  it("leaves the disruption banner empty until a live feed fills it", () => {
    // A hand-written "metro strike today" is indistinguishable from a real one to
    // a traveller and to a juror, which is why the field stays empty while the
    // feed that would fill it is behind a licence we do not hold.
    for (const route of ROUTES) {
      expect(route.disruption, `${route.id} carries a hand-written disruption`).toBeUndefined();
    }
  });

  it("keeps route titles free of invented conditions", () => {
    for (const route of ROUTES) {
      for (const lang of ["en", "fr", "zh"] as const) {
        expect(route.title[lang]).not.toMatch(/strike|grève|罢工/i);
      }
    }
  });
});
