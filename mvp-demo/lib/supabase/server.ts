import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Two server clients, and the difference between them is the whole security model.
 *
 * `userClient()` acts as whoever is signed in. It carries the publishable key and
 * the request's cookies, so row-level security applies exactly as it does in the
 * browser: it can read one traveller's rows because that traveller is asking.
 *
 * `serviceClient()` carries the secret key and therefore bypasses row-level
 * security entirely. It exists for one job: writing the staff console's
 * corrections to `place_overrides`, which has no write policy at all precisely so
 * that this is the only door. Every call site must already have checked the admin
 * session, and there is exactly one call site.
 *
 * Both return null when the project is not configured, for the reason in
 * `browser.ts`: no database is a state this app has to keep working in.
 */

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;

export async function userClient(): Promise<SupabaseClient | null> {
  if (!URL_ || !PUBLISHABLE) return null;
  const jar = await cookies();
  return createServerClient(URL_, PUBLISHABLE, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) jar.set(name, value, options);
        } catch {
          // Called from a Server Component, where the cookie jar is read-only.
          // The middleware refreshes the session, so losing the write here is a
          // missed refresh rather than a broken request.
        }
      },
    },
  });
}

/**
 * An anonymous reader, with no request cookies attached.
 *
 * For the one table that is public by policy: the staff console's corrections,
 * which are meant to reach every traveller signed in or not. Kept separate from
 * `userClient()` because that one needs a request scope to reach the cookie jar,
 * and this is called from a cached path that has no request of its own.
 */
export function publicClient(): SupabaseClient | null {
  if (!URL_ || !PUBLISHABLE) return null;
  return createClient(URL_, PUBLISHABLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Bypasses row-level security. Only ever behind the admin password. */
export function serviceClient(): SupabaseClient | null {
  if (!URL_ || !SECRET) return null;
  return createClient(URL_, SECRET, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const accountsEnabled = !!URL_ && !!PUBLISHABLE;
export const overridesWritable = !!URL_ && !!SECRET;
