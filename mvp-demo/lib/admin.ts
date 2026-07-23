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
