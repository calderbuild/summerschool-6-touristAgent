import { createHash, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "voie-libre-admin";

/**
 * Session value derived from the admin secret. Storing a bare "1" would be
 * pointless: cookies are client-controlled, so anyone could set the flag by
 * hand. This value cannot be produced without knowing ADMIN_PASSWORD.
 */
export function sessionToken(secret: string): string {
  return createHash("sha256").update(`voie-libre-admin:${secret}`).digest("hex");
}

/** Length-independent comparison, so a wrong password cannot be timed out. */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/* ---- Guessing guard -------------------------------------------------------
 *
 * A constant-time comparison stops an attacker learning the password from how
 * long the answer takes. It does nothing at all about how many answers they can
 * ask for, and until now that number was unlimited: a single password, one
 * endpoint, no cost per attempt. This puts a cost on it.
 *
 * Held in module memory, which means per warm serverless instance rather than
 * globally. That is a real limit and worth naming: an attacker spread across
 * enough cold starts gets more attempts than the number below. It still turns an
 * unlimited online guessing attack into an expensive one, which is the whole job
 * of a lockout, and it needs no third-party store to work.
 */
const ATTEMPT_WINDOW_MS = 15 * 60_000;
const MAX_ATTEMPTS = 8;
const ATTEMPTS = new Map<string, { n: number; first: number }>();

export interface LockoutState {
  locked: boolean;
  /** Seconds until the window resets. Sent to the client so it can say so. */
  retryAfter: number;
}

export function checkLockout(ip: string): LockoutState {
  const now = Date.now();
  // Sweep expired entries rather than growing forever under IP churn.
  if (ATTEMPTS.size > 500) {
    for (const [k, v] of ATTEMPTS) if (now - v.first >= ATTEMPT_WINDOW_MS) ATTEMPTS.delete(k);
  }
  const rec = ATTEMPTS.get(ip);
  if (!rec || now - rec.first >= ATTEMPT_WINDOW_MS) return { locked: false, retryAfter: 0 };
  if (rec.n < MAX_ATTEMPTS) return { locked: false, retryAfter: 0 };
  return { locked: true, retryAfter: Math.ceil((ATTEMPT_WINDOW_MS - (now - rec.first)) / 1000) };
}

/** Counted only on failure, so getting it right never uses up an attempt. */
export function recordFailure(ip: string): void {
  const now = Date.now();
  const rec = ATTEMPTS.get(ip);
  if (!rec || now - rec.first >= ATTEMPT_WINDOW_MS) {
    ATTEMPTS.set(ip, { n: 1, first: now });
    return;
  }
  rec.n++;
}

/** Cleared on success, so one mistyped password does not haunt a real session. */
export function clearFailures(ip: string): void {
  ATTEMPTS.delete(ip);
}

/**
 * Prefer the platform-set client IP over the leftmost X-Forwarded-For hop, which
 * a caller can set to anything and would otherwise mint a fresh allowance per
 * request, making the lockout decorative.
 */
export function clientIp(req: Request): string {
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anon"
  );
}
