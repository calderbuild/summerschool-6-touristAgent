"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ExternalLink, Toilet } from "lucide-react";
import { LANGS, useI18n, type Lang } from "@/lib/i18n";
import { ease, type Ease, type Place } from "@/lib/places";
import StreetLook from "@/components/StreetLook";

/**
 * The seventeen sights, finally visible.
 *
 * All of this already existed: prices, opening hours, what a wheelchair user meets
 * at the venue, whether the nearest station gets them there, whether there is an
 * accessible toilet, and the date somebody checked. It lived in the model's prompt
 * and in the staff console, so the only way to reach it was to ask the assistant a
 * question whose answer you would then have to trust. A traveller could not browse
 * it, and a reader could not audit it.
 *
 * The ordering is the argument. Sorting by name would make this a directory; sorting
 * by what the data actually says makes it a plan. The ones somebody can definitely
 * use come first, the ones with a condition next, and the ones nobody has checked
 * last, labelled as unchecked rather than quietly dropped to the bottom.
 */

const ORDER: Record<Ease, number> = { yes: 0, depends: 1, no: 2 };

function LangSwitch() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-white/10 p-0.5" role="group" aria-label={t("lang_group")}>
      {LANGS.map((l) => (
        <button
          key={l.id}
          onClick={() => setLang(l.id as Lang)}
          aria-pressed={lang === l.id}
          aria-label={l.a11y}
          className={`grid min-h-11 min-w-9 place-items-center rounded-md px-2.5 text-[13px] font-bold transition-colors ${
            lang === l.id ? "bg-white text-navy" : "text-white/75 hover:text-white"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10.5px] font-bold tracking-[0.14em] text-ink-faint uppercase">{label}</dt>
      <dd className="mt-0.5 text-[13px] leading-snug text-ink">{value}</dd>
    </div>
  );
}

export default function Places({ places }: { places: Place[] }) {
  const { t, lang } = useI18n();
  const [openId, setOpenId] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...places].sort((a, b) => ORDER[ease(a)] - ORDER[ease(b)] || a.nameEn.localeCompare(b.nameEn)),
    [places],
  );
  const counts = useMemo(() => {
    const c = { yes: 0, depends: 0, no: 0 } as Record<Ease, number>;
    for (const p of places) c[ease(p)] += 1;
    return c;
  }, [places]);

  const name = (p: Place) => (lang === "fr" ? p.nameFr : p.nameEn);

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-white/5 bg-navy pt-[env(safe-area-inset-top)] text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-2.5">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-1.5 rounded-lg bg-white/10 pr-3 pl-2 font-semibold text-white/90 transition-colors hover:bg-white/15 hover:text-white"
          >
            <ArrowLeft size={18} strokeWidth={2.4} aria-hidden />
            <span className="text-[14px]">{t("back_to_assistant")}</span>
          </Link>
          <LangSwitch />
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16">
        <section className="pt-9 pb-2">
          <p className="font-mono text-[11px] font-bold tracking-[0.16em] text-ink-faint uppercase">
            {t("places_eyebrow")}
          </p>
          <h1 className="mt-2.5 max-w-2xl font-display text-[30px] leading-[1.08] font-extrabold tracking-tight text-ink sm:text-[40px]">
            {t("places_title")}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink/70 sm:text-[16px]">{t("places_intro")}</p>
        </section>

        {/* Counted from the records below rather than stated, so the number cannot
            drift away from the list a reader is looking at. */}
        <p className="mt-4 font-mono text-[12px] text-ink-soft">
          {t("places_counts")
            .replace("{total}", String(places.length))
            .replace("{yes}", String(counts.yes))
            .replace("{depends}", String(counts.depends))
            .replace("{no}", String(counts.no))}
        </p>

        <ul className="mt-5 grid gap-2.5">
          {sorted.map((p) => {
            const e = ease(p);
            const open = openId === p.id;
            return (
              <li
                key={p.id}
                className="overflow-hidden rounded-2xl border border-ink/10 bg-surface"
              >
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pt-3.5">
                  <div className="min-w-0">
                    <h2 className="text-[16px] leading-snug font-bold text-ink">{name(p)}</h2>
                    <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                      {p.category} · {p.arrondissement} · {p.visitDuration}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2 py-1 text-[11.5px] font-bold ${
                      e === "yes"
                        ? "bg-ok/15 text-ok-ink"
                        : e === "no"
                          ? "bg-barrier/15 text-barrier-ink"
                          : "bg-caution/15 text-caution-ink"
                    }`}
                  >
                    {t(`places_ease_${e}`)}
                  </span>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-4 pt-3 sm:grid-cols-3">
                  <Fact label={t("places_f_wheelchair")} value={p.wheelchair} />
                  <Fact label={t("places_f_station")} value={p.stationStepFree} />
                  <Fact label={t("places_f_toilet")} value={p.accessibleToilet} />
                  <Fact label={t("places_f_budget")} value={p.free ? t("places_free") : p.budget} />
                  <Fact label={t("places_f_hours")} value={p.openingHours} />
                  <Fact label={t("places_f_transit")} value={p.nearestTransit} />
                </dl>

                {p.notes && <p className="px-4 pt-2.5 text-[13px] leading-relaxed text-ink-soft">{p.notes}</p>}

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink/[0.07] px-4 py-2.5">
                  {/* The date is a first-class fact here, not small print: an
                      accessibility claim with no date is a rumour. */}
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-ink/[0.05] px-2 py-1 font-mono text-[11px] text-ink-soft">
                    {t("places_checked").replace("{date}", p.lastVerified)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : p.id)}
                    aria-expanded={open}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-ink/15 bg-surface-2 px-2.5 py-1.5 text-[12.5px] font-semibold text-ink transition-colors hover:border-signal/50"
                  >
                    {open ? t("places_hide_door") : t("places_see_door")}
                  </button>
                  <Link
                    href={`/?ask=${encodeURIComponent(t("places_ask").replace("{place}", name(p)))}`}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-navy px-2.5 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-navy/90"
                  >
                    {t("places_plan")}
                    <ArrowRight size={14} strokeWidth={2.4} aria-hidden />
                  </Link>
                  <a
                    href={p.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] font-semibold text-signal transition-colors hover:underline"
                  >
                    {t("places_official")}
                    <ExternalLink size={13} strokeWidth={2.4} aria-hidden />
                  </a>
                  {p.accessibleToilet.toLowerCase().startsWith("yes") && (
                    <Toilet size={15} strokeWidth={2.2} aria-label={t("places_f_toilet")} className="text-ok-ink" />
                  )}
                </div>

                {/* One panorama at a time, the same discipline the route card uses:
                    seventeen live Street View instances would be seventeen map loads
                    nobody asked for. */}
                {open && (
                  <div className="border-t border-ink/[0.07] px-4 py-3.5">
                    <StreetLook lat={p.coord.lat} lng={p.coord.lng} label={name(p)} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <p className="mt-6 text-[12.5px] leading-relaxed text-ink-soft">{t("places_sources")}</p>
      </main>
    </>
  );
}
