import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { asProfiles, hillWeight, oneInterchange, plan, type ProfileId } from "../router";

/**
 * The conversation's own guarantees: that a half answer is announced as one, that
 * what a traveller typed survives leaving the page, and that the sentence naming
 * what the profile chips do is still true of the routing.
 *
 * Every check here was written by putting its defect back and watching this file
 * go red. They are source reads where the behaviour lives in a client component
 * that this suite has no browser to mount, which is the same approach
 * `lifts.test.ts` and `knowledge.test.ts` already take: a claim about the product
 * that nothing can check is exactly the kind this project keeps shipping by
 * accident.
 */

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const SHELL = readFileSync(join(root, "components", "chat", "ChatShell.tsx"), "utf8");
const API = readFileSync(join(root, "app", "api", "chat", "route.ts"), "utf8");
const PICKER = readFileSync(join(root, "components", "ProfilePicker.tsx"), "utf8");
const I18N = readFileSync(join(root, "lib", "i18n.tsx"), "utf8");

/** One dictionary entry, read from the source: `DICT` is private to the module and
 *  exporting it only so a test can see it would widen the module's surface for no
 *  other caller. Returns null when the key is absent, which is itself something
 *  the tests below assert. */
function entry(key: string): { en: string; fr: string; zh: string } | null {
  const m = I18N.match(new RegExp(`\\n  ${key}: \\{([\\s\\S]*?)\\n?  \\},?\\n`));
  const body = m?.[1] ?? I18N.match(new RegExp(`\\n  ${key}: \\{([^}]*)\\}`))?.[1];
  if (!body) return null;
  const of = (lang: string) => body.match(new RegExp(`${lang}: "((?:[^"\\\\]|\\\\.)*)"`))?.[1] ?? "";
  return { en: of("en"), fr: of("fr"), zh: of("zh") };
}

const PROFILES: ProfileId[] = ["wheelchair", "stroller", "senior", "lowenergy"];

describe("a truncated answer is never presented as a whole one", () => {
  it("the server ends a complete stream with a sentinel", () => {
    // Both halves matter: the flag is only set after the read loop finishes, and
    // the sentinel is only pushed with it.
    expect(API).toMatch(/complete = true;\s*\n\s*push\(\{ type: "done", finish \}\)/);
  });

  it("the server reports a stream that leaves without finishing", () => {
    expect(API).toMatch(/if \(!complete\) push\(\{ type: "truncated", finish \}\)/);
  });

  it("the server carries the model's own stop reason", () => {
    expect(API).toMatch(/finish_reason/);
  });

  it("the client treats a missing sentinel as truncation, not as an answer", () => {
    expect(SHELL).toMatch(/if \(obj\.type === "done"\)|obj\.type === "done"/);
    expect(SHELL).toMatch(/else if \(!sawDone\) setError\("truncated"\)/);
  });

  it("the client says so when the answer hit the length ceiling", () => {
    expect(SHELL).toMatch(/=== "length"\) cut = true/);
    expect(SHELL).toMatch(/else if \(cut\) setError\("cut"\)/);
  });

  it("both messages exist in all three languages", () => {
    for (const key of ["chat_error_truncated", "chat_error_cut"]) {
      const e = entry(key);
      expect(e, key).toBeTruthy();
      for (const lang of ["en", "fr", "zh"] as const) {
        expect(e![lang].length, `${key}.${lang}`).toBeGreaterThan(8);
      }
    }
  });
});

describe("what the traveller typed survives leaving the page", () => {
  it("is kept in localStorage, not only for the life of the tab", () => {
    expect(SHELL).toMatch(/localStorage\.setItem\(CHAT_STORAGE_KEY/);
  });

  it("is written when the question is sent, before any answer exists", () => {
    // The settle-effect deliberately skips a streaming turn, so without this a
    // first question whose answer never arrived left nothing behind at all.
    expect(SHELL).toMatch(/writeStored\(history, profiles\)/);
  });

  it("is written on the way out, mid-answer included", () => {
    expect(SHELL).toMatch(/addEventListener\("pagehide", save\)/);
    expect(SHELL).toMatch(/visibilitychange/);
  });

  it("reads the shape written before the picker took more than one answer", () => {
    expect(SHELL).toMatch(/parsed\.profile\s*\n?\s*\?\s*\[parsed\.profile\]/);
  });

  it("clearing the conversation clears both stores", () => {
    // The session copy would otherwise be restored on the next load, bringing back
    // a conversation somebody had just cleared.
    expect(SHELL).toMatch(/localStorage\.removeItem\(CHAT_STORAGE_KEY\);[\s\S]{0,240}sessionStorage\.removeItem\(CHAT_STORAGE_KEY\)/);
  });
});

describe("only a block that says it is the conclusion is drawn as one", () => {
  it("does not promote the last block of an unlabelled answer", () => {
    // This is the defect a screenshot caught: twenty ordinary lines rendered as a
    // highlighted verdict because they happened to be last.
    expect(SHELL).not.toMatch(/blocks\.length - 1/);
    expect(SHELL).toMatch(/looksLikeConclusion\(b\) && b\.trim\(\)\.split\("\\n"\)\.length <= 3/);
  });
});

describe("more than one traveller at once", () => {
  it("a single id and a one-element set are the same journey", () => {
    // The claim that made this safe to change two days before it is demonstrated.
    for (const p of PROFILES) {
      const one = plan("Bastille", "Louvre - Rivoli", p);
      const set = plan("Bastille", "Louvre - Rivoli", [p]);
      expect(one.ok, p).toBe(true);
      expect(set.ok, p).toBe(true);
      if (one.ok && set.ok) {
        expect(set.route.nodes.map((n) => n.name), p).toEqual(one.route.nodes.map((n) => n.name));
        expect(set.route.minutes, p).toBe(one.route.minutes);
      }
    }
  });

  it("an empty selection is the strictest profile, never the loosest", () => {
    expect(asProfiles([])).toEqual(["wheelchair"]);
    expect(asProfiles("stroller")).toEqual(["stroller"]);
    expect(asProfiles(["senior", "senior"])).toEqual(["senior"]);
  });

  it("a selection is at least as strict as any profile in it", () => {
    // The property the whole design rests on: combining constraints can only add
    // cost, so a combined journey is never routed more loosely than either alone.
    for (const a of PROFILES) {
      for (const b of PROFILES) {
        const pair = [a, b];
        expect(Math.max(...pair.map(hillWeight)), `${a}+${b}`).toBeGreaterThanOrEqual(hillWeight(a));
        expect(Math.max(...pair.map(oneInterchange)), `${a}+${b}`).toBeGreaterThanOrEqual(
          oneInterchange(b),
        );
      }
    }
  });

  it("a two-profile journey is a real route with both named", () => {
    const both = plan("Gare du Nord", "Eiffel Tower", ["wheelchair", "lowenergy"]);
    expect(both.ok).toBe(true);
    if (both.ok) {
      expect(both.route.profiles).toEqual(["wheelchair", "lowenergy"]);
      expect(both.route.nodes.length).toBeGreaterThan(1);
    }
  });
});

describe("the chips say what they change, and it is true of the routing", () => {
  it("every chip has an effect line in all three languages", () => {
    for (const p of PROFILES) {
      const e = entry(`profile_fx_${p}`);
      expect(e, p).toBeTruthy();
      for (const lang of ["en", "fr", "zh"] as const) {
        expect(e![lang].length, `${p}.${lang}`).toBeGreaterThan(8);
      }
    }
    expect(entry("profile_fx_strictest")?.en.length).toBeGreaterThan(8);
  });

  it("the wheelchair line's claim about climbing is the strongest weight", () => {
    // "a climb costs more than distance" / "weighed heaviest": if another profile
    // ever weighs a hill harder, that sentence is false and this fails.
    const others = PROFILES.filter((p) => p !== "wheelchair");
    for (const p of others) {
      expect(hillWeight("wheelchair"), p).toBeGreaterThan(hillWeight(p));
    }
  });

  it("the stroller line's claim about counted steps is the strongest weight", () => {
    const src = readFileSync(join(root, "lib", "router.ts"), "utf8");
    // The per-step cost is internal to `onePenalty`; the sentence rests on stroller
    // being the highest, so the constant is pinned here rather than left to drift.
    expect(src).toMatch(/const perStep = profile === "stroller" \? 12 : 8;/);
  });

  it("the older-traveller line's claim about unpublished stations holds", () => {
    const src = readFileSync(join(root, "lib", "router.ts"), "utf8");
    expect(src).toMatch(/const unknownCost = profile === "senior" \? 240 : 180;/);
  });

  it("the effect line is not shown for a selection nobody made", () => {
    expect(PICKER).toMatch(/selected\.length > 0 && \(/);
  });

  it("the picker announces itself as accepting more than one answer", () => {
    expect(PICKER).toMatch(/role="checkbox"/);
    expect(PICKER).toMatch(/aria-checked=\{on\}/);
  });

  it("the retired sentence describing the mechanism is gone", () => {
    // "This sets how many stairs and how far a walk the route will accept" told a
    // traveller about a setting. Nothing renders it now, and a dictionary entry
    // nothing renders is a string that ships in the bundle.
    expect(entry("profile_note")).toBeNull();
    for (const file of ["components/App.tsx", "components/chat/ChatShell.tsx"]) {
      expect(readFileSync(join(root, file), "utf8"), file).not.toMatch(/profile_note/);
    }
  });
});
