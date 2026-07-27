import { describe, expect, it } from "vitest";
import { speakable } from "../speakable";

/**
 * These are the cases that were actually wrong in production, kept as tests so
 * they cannot come back. The assistant is required to cite an official link for
 * every price, and read-aloud used to speak those links character by character
 * to the people least able to read the screen.
 */
describe("speakable", () => {
  it("keeps a link's words and drops its address", () => {
    const out = speakable("[Official site](https://www.louvre.fr/en) has the prices.");
    expect(out).toBe("Official site has the prices.");
  });

  it("removes a bare URL without spelling it out", () => {
    expect(speakable("See https://example.com/a?b=c for details.")).not.toMatch(/http|example/);
  });

  it("closes the sentence when stripping an address leaves a hanging colon", () => {
    const out = speakable("Check the accessibility page first: https://www.louvre.fr/en");
    expect(out).toBe("Check the accessibility page first.");
  });

  it("keeps a colon that is doing real work mid-line", () => {
    expect(speakable("Bottom line: it is free.")).toBe("Bottom line: it is free.");
  });

  it("unwraps emphasis and inline code rather than reading the markers", () => {
    expect(speakable("**Le Trésor** is `step-free` and *flat*.")).toBe(
      "Le Trésor is step-free and flat."
    );
  });

  it("strips the app's own route markers", () => {
    expect(speakable("[[route:bastille-louvre:wheelchair]]\n\nTake Line 14.")).toBe("Take Line 14.");
    // The computed-route marker carries a pipe and spaces, which the earlier
    // pattern would have read as prose and spoken aloud.
    expect(speakable("[[plan:Bastille|Eiffel Tower]]\n\nTake Line 1.")).toBe("Take Line 1.");
  });

  it("drops list and heading punctuation but keeps the line breaks that pace speech", () => {
    const out = speakable("### Day plan\n\n1. Louvre\n2. Panthéon");
    expect(out).toBe("Day plan\n\nLouvre\nPanthéon");
  });

  it("leaves plain prose untouched", () => {
    const plain = "The lift at Châtelet is out of service today.";
    expect(speakable(plain)).toBe(plain);
  });
});
