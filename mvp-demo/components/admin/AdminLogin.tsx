"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

/**
 * Password gate for the knowledge base console. The password is checked on the
 * server; the browser only ever receives a pass/fail and an httpOnly cookie.
 */
export default function AdminLogin({ configured }: { configured: boolean }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setPassword("");
        router.refresh();
        return;
      }
      const body = await res.json().catch(() => ({}));
      setError(
        body?.error === "admin_not_configured"
          ? "No admin password is set on the server. Add ADMIN_PASSWORD to the environment."
          : "That password does not match. Try again."
      );
    } catch {
      setError("Could not reach the server. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
      <div className="rounded-2xl border border-ink/10 bg-surface p-6 sm:p-7">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-navy text-paper" aria-hidden>
          <Lock size={18} strokeWidth={2.2} />
        </span>
        <h1 className="mt-4 font-display text-[22px] font-bold leading-tight text-ink">
          Knowledge base console
        </h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">
          Staff access to the places and routes that Voie Libre answers from.
        </p>

        {!configured && (
          <p className="mt-4 rounded-lg border border-caution/30 bg-caution/10 px-3 py-2 text-[13px] leading-snug text-ink">
            No admin password is configured on this deployment yet. Set{" "}
            <code className="font-mono text-[12px]">ADMIN_PASSWORD</code> to enable sign-in.
          </p>
        )}

        <form onSubmit={submit} className="mt-5">
          <label htmlFor="admin-password" className="block text-[13px] font-semibold text-ink">
            Password
          </label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-ink/15 bg-surface-2 px-3.5 py-2.5 text-[16px] text-ink outline-none focus:border-signal"
            placeholder="Enter the staff password"
          />

          {error && (
            <p role="alert" className="mt-2.5 text-[13px] leading-snug text-barrier">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !password}
            className="mt-4 grid min-h-11 w-full place-items-center rounded-xl bg-signal px-4 text-[14px] font-bold text-paper transition-colors hover:bg-signal/90 disabled:opacity-40"
          >
            {busy ? "Checking..." : "Sign in"}
          </button>
        </form>
      </div>

      <p className="mt-4 text-center text-[12px] text-ink-faint">
        Voie Libre · staff area
      </p>
    </main>
  );
}
