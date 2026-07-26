import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkLockout, clearFailures, clientIp, recordFailure, safeEqual, sessionToken } from "../admin";

/**
 * The gate on the staff console. Worth testing rather than eyeballing, because
 * every failure here is silent: a lockout that never triggers looks exactly like
 * a lockout that works until someone is guessing passwords at full speed.
 */
describe("admin session token", () => {
  it("cannot be produced without the secret", () => {
    expect(sessionToken("correct")).not.toBe(sessionToken("wrong"));
  });

  it("is stable for the same secret, so a session survives a cold start", () => {
    expect(sessionToken("correct")).toBe(sessionToken("correct"));
  });

  it("is not the secret itself", () => {
    expect(sessionToken("hunter2")).not.toContain("hunter2");
  });
});

describe("safeEqual", () => {
  it("accepts an exact match and rejects everything else", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
  });

  it("handles different lengths without throwing", () => {
    // timingSafeEqual rejects unequal buffer lengths, which is why both sides are
    // hashed to a fixed width first. A throw here would be a 500, not a 401.
    expect(() => safeEqual("a", "a much longer password")).not.toThrow();
    expect(safeEqual("a", "a much longer password")).toBe(false);
  });
});

describe("login lockout", () => {
  // Each test uses its own address, because the store is module-level and shared.
  let n = 0;
  let ip = "";
  beforeEach(() => {
    vi.useRealTimers();
    ip = `test-${n++}`;
    clearFailures(ip);
  });

  it("allows the first attempts and then locks", () => {
    for (let i = 0; i < 8; i++) {
      expect(checkLockout(ip).locked).toBe(false);
      recordFailure(ip);
    }
    const state = checkLockout(ip);
    expect(state.locked).toBe(true);
    expect(state.retryAfter).toBeGreaterThan(0);
  });

  it("forgets the failures once the password is right", () => {
    for (let i = 0; i < 8; i++) recordFailure(ip);
    expect(checkLockout(ip).locked).toBe(true);
    clearFailures(ip);
    expect(checkLockout(ip).locked).toBe(false);
  });

  it("locks one address without locking another", () => {
    const other = `test-${n++}`;
    for (let i = 0; i < 8; i++) recordFailure(ip);
    expect(checkLockout(ip).locked).toBe(true);
    expect(checkLockout(other).locked).toBe(false);
  });

  it("releases after the window passes", () => {
    for (let i = 0; i < 8; i++) recordFailure(ip);
    expect(checkLockout(ip).locked).toBe(true);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 16 * 60_000);
    expect(checkLockout(ip).locked).toBe(false);
  });
});

describe("clientIp", () => {
  it("prefers the platform header over the one a caller can set", () => {
    const req = new Request("https://example.com", {
      headers: { "x-real-ip": "10.0.0.1", "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    // Trusting the forwarded header would let an attacker mint a fresh allowance
    // per request by changing one string, which makes the lockout decorative.
    expect(clientIp(req)).toBe("10.0.0.1");
  });

  it("falls back to the first forwarded hop, then to a constant", () => {
    expect(clientIp(new Request("https://e.com", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } }))).toBe("1.2.3.4");
    expect(clientIp(new Request("https://e.com"))).toBe("anon");
  });
});
