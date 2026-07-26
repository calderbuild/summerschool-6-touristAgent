import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  checkLockout,
  clearFailures,
  clientIp,
  recordFailure,
  safeEqual,
  sessionToken,
} from "@/lib/admin";

// The admin password is server-side only; it is never sent to the browser.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) {
    return Response.json({ error: "admin_not_configured" }, { status: 500 });
  }

  // Checked before the body is even read: a locked-out caller should not get to
  // spend our CPU on parsing and hashing.
  const ip = clientIp(req);
  const lock = checkLockout(ip);
  if (lock.locked) {
    return Response.json(
      { error: "too_many_attempts", retryAfter: lock.retryAfter },
      { status: 429, headers: { "Retry-After": String(lock.retryAfter) } }
    );
  }

  let password = "";
  try {
    const body = await req.json();
    password = typeof body?.password === "string" ? body.password.slice(0, 200) : "";
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  if (!password || !safeEqual(password, secret)) {
    recordFailure(ip);
    return Response.json({ error: "invalid_password" }, { status: 401 });
  }

  clearFailures(ip);
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, sessionToken(secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return Response.json({ ok: true });
}

export async function DELETE() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  return Response.json({ ok: true });
}
