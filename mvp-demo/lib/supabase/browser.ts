"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The browser's client, or null when this build has no Supabase configured.
 *
 * Null rather than a throw, because an account is an addition to this product and
 * never a precondition for one. Every caller treats "no client" the same way it
 * treats "not signed in": route the journey, answer the question, keep the
 * conversation on the device. A missing environment variable must not be able to
 * take the app down, and during most of this project there was no database at all.
 *
 * The publishable key is safe here by design: every table it can reach has
 * row-level security on, with policies keyed to the signed-in user, so this key
 * grants a browser exactly what the person holding it is entitled to and nothing
 * else. That is also why the secret key is never imported into a client file.
 */

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!URL_ || !KEY) return null;
  // One instance per tab. Two would each hold their own auth listener and fight
  // over the same refresh token.
  client ??= createBrowserClient(URL_, KEY);
  return client;
}

export const accountsEnabled = !!URL_ && !!KEY;
