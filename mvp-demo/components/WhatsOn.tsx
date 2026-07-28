"use client";

import Link from "next/link";
import { useI18n, LANGS, type Lang } from "@/lib/i18n";
import { statusColorVar, legendKey } from "@/lib/status";
import type { CityEvent, EventFeed, joinCounts } from "@/lib/events";
import { ArrowLeft, ExternalLink, Route } from "lucide-react";

/**
 * This week in Paris, with the way in attached.
 *
 * The page exists because neither half is worth much alone. The city knows what
 * is on and whether the room has a ramp. The transport operator knows whether
 * the station has a lift. A wheelchair user needs both to be true on the same
 * evening, and nobody publishes that, so the two claims are put side by side and
 * kept labelled: "the city says" and "the operator says". They are never merged
 * into one tick, because an accessible hall above an inaccessible station is not
 * a contradiction to resolve, it is the answer.
 */

type Join = ReturnType<typeof joinCounts>;

const LOCALE: Record<Lang, string> = { en: "en-GB", fr: "fr-FR", zh: "zh-CN" };

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

function when(e: CityEvent, lang: Lang, t: (k: string) => string): string {
  const start = new Date(e.startsAt);
  const end = new Date(e.endsAt);
  if (Number.isNaN(start.valueOf())) return "";
  // The year only when it is not this one. A long exhibition ending on 1 January
  // 2027 printed as "1 Jan" reads as a date that has already passed, which is the
  // opposite of what it says.
  const here = new Date().getFullYear();
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat(LOCALE[lang], {
      day: "numeric",
      month: "short",
      ...(d.getFullYear() === here ? {} : { year: "numeric" }),
    }).format(d);
  if (start.valueOf() <= Date.now()) {
    return Number.isNaN(end.valueOf()) ? t("wo_on_now") : `${t("wo_on_now")} ${t("wo_until")} ${fmt(end)}`;
  }
  return `${t("wo_from")} ${fmt(start)}`;
}

function EventCard({ e }: { e: CityEvent }) {
  const { t, lang } = useI18n();
  const cityKey =
    e.access.wheelchair === "yes" ? "wo_city_yes" : e.access.wheelchair === "no" ? "wo_city_no" : "wo_city_unknown";
  const alsoFor = [
    e.access.deaf === "yes" ? t("wo_deaf") : null,
    e.access.blind === "yes" ? t("wo_blind") : null,
    e.access.signLanguage === "yes" ? t("wo_sign") : null,
  ].filter(Boolean) as string[];

  return (
    <li className="rounded-2xl border border-ink/10 bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h3 className="font-display text-[15.5px] font-bold leading-snug text-ink">{e.title}</h3>
        <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink-faint">{when(e, lang, t)}</span>
      </div>
      {e.venue && <p className="mt-1 text-[12.5px] text-ink-soft">{e.venue}</p>}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {/* The city's claim, about the room. */}
        <div className="rounded-xl border border-ink/10 bg-canvas p-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-soft">
            {t("wo_city_label")}
          </p>
          <p className="mt-1.5 flex items-start gap-2 text-[13px] font-semibold leading-snug text-ink">
            <span
              aria-hidden
              className={`mt-1 inline-block size-2.5 shrink-0 rounded-full ${
                e.access.wheelchair === "unknown" ? "hatch-unknown" : ""
              }`}
              style={{
                background:
                  e.access.wheelchair === "yes"
                    ? "var(--color-ok)"
                    : e.access.wheelchair === "no"
                      ? "var(--color-barrier)"
                      : "var(--color-unknown)",
              }}
            />
            {t(cityKey)}
          </p>
          {alsoFor.length > 0 && (
            <p className="mt-1.5 text-[12px] leading-snug text-ink-soft">
              {t("wo_also")} {alsoFor.join(", ")}
            </p>
          )}
        </div>

        {/* Ours, about the journey. */}
        <div className="rounded-xl border border-ink/10 bg-canvas p-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-soft">
            {t("wo_station_label")}
          </p>
          <p className="mt-1.5 flex items-start gap-2 text-[13px] font-semibold leading-snug text-ink">
            <span
              aria-hidden
              className={`mt-1 inline-block size-2.5 shrink-0 rounded-full ${
                e.station.status === "unknown" ? "hatch-unknown" : ""
              }`}
              style={{ background: statusColorVar(e.station.status) }}
            />
            <span>
              {e.station.name}
              <span className="font-normal text-ink-soft">
                {" "}
                · {e.station.lines.join(" · ")} · {e.station.metres} m
              </span>
            </span>
          </p>
          <p className="mt-1.5 text-[12px] leading-snug text-ink-soft">{t(legendKey[e.station.status])}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">
          {e.free === true ? t("wo_free") : e.free === false ? t("wo_paid") : t("wo_price_unknown")}
        </span>
        <Link
          href={`/routes?to=${encodeURIComponent(e.station.name)}`}
          className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-signal transition-colors hover:text-ink"
        >
          <Route size={15} strokeWidth={2.2} aria-hidden />
          {t("wo_plan")}
        </Link>
        <a
          href={e.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-signal transition-colors hover:text-ink"
        >
          <ExternalLink size={15} strokeWidth={2.2} aria-hidden />
          {t("wo_official")}
        </a>
      </div>
    </li>
  );
}

export default function WhatsOn({
  feed,
  reachable,
  tension,
  join,
  held,
}: {
  feed: Pick<EventFeed, "fetchedAt" | "totals"> | null;
  /** City says accessible, and the station agrees. */
  reachable: CityEvent[];
  /** City says accessible, and the station does not. The reason for the page. */
  tension: CityEvent[];
  join: Join | null;
  /** How many events a station was looked up for, which is the denominator the
   *  three joined counts are over. Printed, because a count without its
   *  denominator is the shape of every misleading statistic. */
  held: number;
}) {
  const { t, lang } = useI18n();

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-white/5 bg-navy pt-[env(safe-area-inset-top)] text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-2.5">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-1.5 rounded-lg bg-white/10 pl-2 pr-3 font-semibold text-white/90 transition-colors hover:bg-white/15 hover:text-white"
          >
            <ArrowLeft size={18} strokeWidth={2.4} aria-hidden />
            <span className="text-[14px]">{t("back_to_assistant")}</span>
          </Link>
          <LangSwitch />
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16">
        <section className="pt-9 pb-2">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-faint">
            {t("wo_eyebrow")}
          </p>
          <h1 className="mt-2.5 max-w-2xl font-display text-[30px] font-extrabold leading-[1.08] tracking-tight text-ink sm:text-[40px]">
            {t("wo_title")}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink/70 sm:text-[16px]">{t("wo_intro")}</p>
        </section>

        {!feed || !join || reachable.length + tension.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-caution/35 bg-caution/8 p-4 text-[13.5px] leading-relaxed text-ink-soft">
            {t("wo_unavailable")}
          </p>
        ) : (
          <>
            {/* The join, which is the only number here neither publisher could
                have produced on their own. */}
            <section aria-labelledby="join" className="mt-7">
              <h2 id="join" className="font-display text-[17px] font-bold text-ink">
                {t("wo_join_title")}
              </h2>
              <dl className="mt-3 grid gap-2.5 sm:grid-cols-4">
                {[
                  { n: feed.totals.wheelchairYes, k: "wo_stat_city" },
                  { n: join.stationStepFree, k: "wo_stat_stepfree" },
                  { n: join.stationConditional, k: "wo_stat_conditional" },
                  { n: join.citySilent, k: "wo_stat_silent" },
                ].map((s) => (
                  <div key={s.k} className="rounded-2xl border border-ink/10 bg-surface p-4">
                    <dt className="font-display text-[27px] font-extrabold leading-none tracking-tight text-ink tabular-nums">
                      {s.n}
                    </dt>
                    <dd className="mt-2 text-[12.5px] leading-snug text-ink-soft">{t(s.k)}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-soft">{t("wo_join_note")}</p>
            </section>

            <p className="mt-6 text-[12.5px] text-ink-soft">
              {t("wo_shown_1")} {held} {t("wo_shown_2")} {reachable.length + tension.length} {t("wo_shown_3")}
            </p>

            <section aria-labelledby="reachable" className="mt-7">
              <h2 id="reachable" className="font-display text-[17px] font-bold text-ink">
                {t("wo_group_reachable")}
              </h2>
              <ul className="mt-3 grid gap-3">
                {reachable.map((e) => (
                  <EventCard key={e.id} e={e} />
                ))}
              </ul>
            </section>

            {tension.length > 0 && (
              <section aria-labelledby="tension" className="mt-10">
                <h2 id="tension" className="font-display text-[17px] font-bold text-ink">
                  {t("wo_group_tension")}
                </h2>
                <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-ink-soft">{t("wo_group_tension_note")}</p>
                <ul className="mt-3 grid gap-3">
                  {tension.map((e) => (
                    <EventCard key={e.id} e={e} />
                  ))}
                </ul>
              </section>
            )}

            <p className="mt-6 font-mono text-[10.5px] uppercase tracking-wide text-ink-faint">
              {t("wo_source")} ·{" "}
              {new Intl.DateTimeFormat(LOCALE[lang], { dateStyle: "medium", timeStyle: "short" }).format(
                new Date(feed.fetchedAt),
              )}
            </p>
          </>
        )}
      </main>
    </>
  );
}
