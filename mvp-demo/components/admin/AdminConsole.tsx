"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PLACES } from "@/lib/places";
import { ROUTES } from "@/lib/data";
import { ArrowLeft, ExternalLink, Search } from "lucide-react";

/**
 * Staff console for the knowledge base the assistant answers from. It is a
 * management and review surface: what data exists, how fresh it is, and where
 * the gaps are. Gaps are the point of this product, so they are measured here
 * rather than hidden.
 */

const UNKNOWN = /unknown|inconnu|未知/i;

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "warn" | "bad" }) {
  const valueTone = tone === "bad" ? "text-barrier" : tone === "warn" ? "text-caution-ink" : "text-ink";
  return (
    <div className="rounded-xl border border-ink/10 bg-surface px-4 py-3">
      <p className="font-mono text-[10.5px] font-bold uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={`mt-1 font-display text-[24px] font-extrabold leading-none ${valueTone}`}>{value}</p>
    </div>
  );
}

export default function AdminConsole() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [signingOut, setSigningOut] = useState(false);

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(PLACES.map((p) => p.category))).sort()],
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PLACES.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (!q) return true;
      return (
        p.nameEn.toLowerCase().includes(q) ||
        p.nameFr.toLowerCase().includes(q) ||
        p.arrondissement.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [query, category]);

  const health = useMemo(() => {
    const closed = PLACES.filter((p) => p.status === "closed").length;
    const accessUnknown = PLACES.filter((p) => UNKNOWN.test(p.wheelchair)).length;
    const hoursUnknown = PLACES.filter((p) => UNKNOWN.test(p.openingHours)).length;
    const verified = PLACES.map((p) => p.lastVerified).filter(Boolean).sort();
    const nodes = ROUTES.flatMap((r) => r.nodes);
    return {
      closed,
      accessUnknown,
      hoursUnknown,
      oldestVerified: verified[0] ?? "unknown",
      barriers: nodes.filter((n) => n.barrier).length,
      unknownNodes: nodes.filter((n) => n.at === "unknown").length,
      unknownSteps: nodes.filter((n) => n.steps === null).length,
    };
  }, []);

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/admin/login", { method: "DELETE" });
      router.refresh();
    } catch {
      // A dropped connection should not reject out of the click handler. The
      // session cookie still expires on its own and the button comes back.
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-white/5 bg-navy pt-[env(safe-area-inset-top)] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-1.5 rounded-lg bg-white/10 pl-2 pr-3 text-[14px] font-semibold text-white/90 transition-colors hover:bg-white/15 hover:text-white"
          >
            <ArrowLeft size={18} strokeWidth={2.4} aria-hidden />
            Back to the assistant
          </Link>
          <span className="hidden font-display text-[15px] font-bold sm:block">Knowledge base console</span>
          <button
            onClick={signOut}
            disabled={signingOut}
            className="min-h-11 rounded-lg bg-white/10 px-3 text-[13px] font-semibold text-white/85 transition-colors hover:text-white disabled:opacity-50"
          >
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-7">
        <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-tight text-ink sm:text-[32px]">
          What the assistant answers from
        </h1>
        <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-ink-soft">
          Every place and route below is injected into the assistant&apos;s prompt. If a field is
          unknown here, the assistant says &quot;unknown&quot; instead of inventing it.
        </p>

        <section aria-label="Coverage" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Places" value={PLACES.length} />
          <Stat label="Routes" value={ROUTES.length} />
          <Stat label="Categories" value={categories.length - 1} />
          <Stat label="Verified since" value={health.oldestVerified} />
        </section>

        <section aria-label="Data health" className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Closed sites" value={health.closed} tone={health.closed ? "warn" : undefined} />
          <Stat
            label="Access unknown"
            value={health.accessUnknown}
            tone={health.accessUnknown ? "warn" : undefined}
          />
          <Stat label="Route barriers" value={health.barriers} tone={health.barriers ? "bad" : undefined} />
          <Stat
            label="Unknown step counts"
            value={health.unknownSteps}
            tone={health.unknownSteps ? "warn" : undefined}
          />
        </section>

        {/* Places */}
        <section aria-labelledby="places" className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="places" className="font-display text-[18px] font-bold text-ink">
              Places ({filtered.length})
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search
                  size={15}
                  strokeWidth={2.2}
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search a place"
                  aria-label="Search places"
                  className="min-h-10 w-56 rounded-lg border border-ink/15 bg-surface pl-9 pr-3 text-[14px] text-ink outline-none focus:border-signal"
                />
              </div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label="Filter by category"
                className="min-h-10 rounded-lg border border-ink/15 bg-surface px-3 text-[14px] font-semibold text-ink outline-none focus:border-signal"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c === "all" ? "All categories" : c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 overflow-x-auto rounded-2xl border border-ink/10 bg-surface">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="border-b border-ink/10 font-mono text-[10.5px] uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-2.5 font-bold">Place</th>
                  <th className="px-3 py-2.5 font-bold">Category</th>
                  <th className="px-3 py-2.5 font-bold">Budget</th>
                  <th className="px-3 py-2.5 font-bold">Hours</th>
                  <th className="px-3 py-2.5 font-bold">Wheelchair</th>
                  <th className="px-3 py-2.5 font-bold">Verified</th>
                  <th className="px-3 py-2.5 font-bold">Source</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-ink/[0.06] align-top last:border-0">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                        {p.nameEn}
                        {p.status === "closed" && (
                          <span className="rounded bg-barrier/10 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-barrier">
                            closed
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[12.5px] text-ink-soft">
                        {p.nameFr} · {p.arrondissement}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[13px] text-ink-soft">{p.category}</td>
                    <td className="px-3 py-3 text-[13px] text-ink-soft">{p.free ? "Free" : p.budget}</td>
                    <td className="px-3 py-3 text-[13px] text-ink-soft">{p.openingHours}</td>
                    <td
                      className={`px-3 py-3 text-[13px] ${UNKNOWN.test(p.wheelchair) ? "text-caution-ink" : "text-ink-soft"}`}
                    >
                      {p.wheelchair}
                    </td>
                    <td className="px-3 py-3 font-mono text-[12px] text-ink-soft">{p.lastVerified}</td>
                    <td className="px-3 py-3 text-[12.5px] text-ink-soft">
                      {p.officialUrl ? (
                        <a
                          href={p.officialUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 font-semibold text-signal hover:underline"
                        >
                          Official
                          <ExternalLink size={12} strokeWidth={2.2} aria-hidden />
                        </a>
                      ) : (
                        <span className="text-ink-faint">unknown</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-[14px] text-ink-soft">
                      No place matches &quot;{query}&quot;. Clear the search or pick another category.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Routes */}
        <section aria-labelledby="routes" className="mt-8">
          <h2 id="routes" className="font-display text-[18px] font-bold text-ink">
            Step-free routes ({ROUTES.length})
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ROUTES.map((r) => {
              const barriers = r.nodes.filter((n) => n.barrier).length;
              const unknowns = r.nodes.filter((n) => n.at === "unknown").length;
              return (
                <div key={r.id} className="rounded-2xl border border-ink/10 bg-surface p-4">
                  <p className="font-mono text-[11px] text-ink-faint">{r.id}</p>
                  <p className="mt-1 font-display text-[15px] font-bold text-ink">
                    {r.from} <span className="text-ink/40">→</span> {r.to}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded bg-ink/[0.06] px-2 py-0.5 font-mono text-[11px] text-ink-soft">
                      {r.nodes.length} stops
                    </span>
                    {barriers > 0 && (
                      <span className="rounded bg-barrier/10 px-2 py-0.5 font-mono text-[11px] font-bold text-barrier">
                        {barriers} barrier
                      </span>
                    )}
                    {unknowns > 0 && (
                      <span className="rounded bg-caution/15 px-2 py-0.5 font-mono text-[11px] font-bold text-caution-ink">
                        {unknowns} unknown
                      </span>
                    )}
                  </div>
                  <p className="mt-2 font-mono text-[11px] leading-relaxed text-ink-faint">
                    {r.sources.join(" · ")}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Honest note about where the data lives */}
        <section className="mt-8 mb-2 rounded-2xl border border-ink/10 bg-surface p-5 sm:p-6">
          <h2 className="font-display text-[16px] font-bold text-ink">Editing this data</h2>
          <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-ink-soft">
            The knowledge base is versioned with the application: places come from{" "}
            <code className="font-mono text-[12.5px]">data/paris-places.xlsx</code> and build into{" "}
            <code className="font-mono text-[12.5px]">lib/places.ts</code>; routes live in{" "}
            <code className="font-mono text-[12.5px]">lib/data.ts</code>. Every row carries its own
            source and verification date, so a reviewer can check any claim the assistant makes.
            Editing from this screen needs a hosted datastore, which is the next step on the roadmap.
          </p>
        </section>
      </main>
    </>
  );
}
