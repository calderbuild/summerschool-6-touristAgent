"use client";

import Link from "next/link";
import { useI18n, LANGS, type Lang } from "@/lib/i18n";
import { CHOICES, CRITERIA, GUARDS, LIVE_SOURCES, MEASURED } from "@/lib/howItWorks";
import { ArrowLeft, ShieldCheck } from "lucide-react";

const LAYER_KEY: Record<string, string> = {
  front: "layer_front",
  back: "layer_back",
  model: "layer_model",
  data: "layer_data",
};
const LAYER_ORDER = ["front", "back", "model", "data"] as const;

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

export default function HowItWorks() {
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
            {t("hiw_eyebrow")}
          </p>
          <h1 className="mt-2.5 max-w-2xl font-display text-[30px] font-extrabold leading-[1.08] tracking-tight text-ink sm:text-[40px]">
            {t("hiw_title")}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink/70 sm:text-[16px]">{t("hiw_intro")}</p>
        </section>

        {/* What the data actually says. Numbers first, because they are the only
            part of this page that cannot be argued with. */}
        <section aria-labelledby="measured" className="mt-7">
          <h2 id="measured" className="font-display text-[17px] font-bold text-ink">
            {t("hiw_measured_title")}
          </h2>
          <dl className="mt-3 grid gap-2.5 sm:grid-cols-3">
            {MEASURED.map((m) => (
              <div key={m.value} className="rounded-2xl border border-ink/10 bg-surface p-4">
                <dt className="font-display text-[27px] font-extrabold leading-none tracking-tight text-ink tabular-nums">
                  {m.value}
                </dt>
                <dd className="mt-2 text-[12.5px] leading-snug text-ink-soft">{m.label[lang]}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2.5 font-mono text-[10.5px] uppercase tracking-wide text-ink-faint">
            {t("hiw_measured_source")}
          </p>
        </section>

        {/* Read at runtime, not copied in. This section exists because "we use
            open data" is a claim anyone can make; the dataset id, the licence and
            what it decides on screen are the parts that can be checked. */}
        <section aria-labelledby="live" className="mt-10">
          <h2 id="live" className="font-display text-[17px] font-bold text-ink">
            {t("hiw_live_title")}
          </h2>
          <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-ink-soft">{t("hiw_live_intro")}</p>
          <ul className="mt-3 grid gap-2.5">
            {LIVE_SOURCES.map((s) => (
              <li key={s.name} className="rounded-2xl border border-ink/10 bg-surface p-4">
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-display text-[14.5px] font-bold text-ink underline decoration-ink/25 underline-offset-2 hover:decoration-ink"
                  >
                    {s.name}
                  </a>
                  <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink-faint">{s.licence}</span>
                </div>
                <p className="mt-1.5 text-[12.5px] leading-snug text-ink-soft">{s.role[lang]}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* How we keep it from inventing things. This sits above the tech list on
            purpose: it is the reason the product exists, and the tech is only how
            we held to it. */}
        <section aria-labelledby="guards" className="mt-10">
          <h2 id="guards" className="flex items-center gap-2 font-display text-[17px] font-bold text-ink">
            <ShieldCheck size={18} strokeWidth={2.2} className="text-ok-ink" aria-hidden />
            {t("hiw_guards_title")}
          </h2>
          <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-ink-soft">{t("hiw_guards_intro")}</p>
          <ol className="mt-4 space-y-3">
            {GUARDS.map((g, i) => (
              <li key={i} className="rounded-2xl border border-ink/10 bg-surface p-4 sm:p-5">
                <div className="flex gap-3.5">
                  <span
                    className="mt-0.5 shrink-0 font-mono text-[12px] font-bold text-ink-faint tabular-nums"
                    aria-hidden
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display text-[15px] font-bold leading-snug text-ink">{g.title[lang]}</h3>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">{g.body[lang]}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Every technology, with a reason that would change if the product were
            different. Grouped by layer so it reads as an architecture. */}
        <section aria-labelledby="stack" className="mt-10">
          <h2 id="stack" className="font-display text-[17px] font-bold text-ink">
            {t("hiw_stack_title")}
          </h2>
          <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-ink-soft">{t("hiw_stack_intro")}</p>

          <div className="mt-4 space-y-6">
            {LAYER_ORDER.map((layer) => {
              const rows = CHOICES.filter((c) => c.layer === layer);
              if (!rows.length) return null;
              return (
                <div key={layer}>
                  <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-faint">
                    {t(LAYER_KEY[layer])}
                  </h3>
                  <ul className="mt-2.5 space-y-2.5">
                    {rows.map((c) => (
                      <li key={c.name} className="rounded-2xl border border-ink/10 bg-surface p-4 sm:p-5">
                        <p className="font-display text-[15px] font-bold text-ink">{c.name}</p>
                        <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">{c.role[lang]}</p>
                        {/* The label matters: the course asks for justification,
                            so the reason is marked as one rather than buried. */}
                        <p className="mt-2.5 border-l-2 border-signal/40 pl-3 text-[13.5px] leading-relaxed text-ink">
                          <span className="font-mono text-[10.5px] font-bold uppercase tracking-wide text-ink-faint">
                            {t("hiw_because")}
                          </span>
                          <br />
                          {c.because[lang]}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        {/* The one decision that shaped everything else, judged on the five
            criteria an architecture is normally judged on. Each answer names its
            cost, because a list of only benefits is a sales page. */}
        <section aria-labelledby="criteria" className="mt-10">
          <h2 id="criteria" className="font-display text-[17px] font-bold text-ink">
            {t("hiw_criteria_title")}
          </h2>
          <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-ink-soft">
            {t("hiw_criteria_intro")}
          </p>
          <dl className="mt-4 space-y-2.5">
            {CRITERIA.map((c) => (
              <div
                key={c.name.en}
                className="rounded-2xl border border-ink/10 bg-surface p-4 sm:grid sm:grid-cols-[9.5rem_1fr] sm:gap-4 sm:p-5"
              >
                <dt className="font-display text-[14px] font-bold text-ink">{c.name[lang]}</dt>
                <dd className="mt-1 text-[13.5px] leading-relaxed text-ink-soft sm:mt-0">
                  {c.answer[lang]}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-10 rounded-2xl border border-ink/10 bg-surface p-5 sm:p-7">
          <h2 className="max-w-xl font-display text-[19px] font-bold leading-tight text-ink sm:text-[22px]">
            {t("hiw_gap_title")}
          </h2>
          <p className="mt-2.5 max-w-2xl text-[14px] leading-relaxed text-ink-soft">{t("hiw_gap_body")}</p>
          <Link
            href="/routes"
            className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-[13.5px] font-semibold text-signal transition-colors hover:text-ink"
          >
            {t("browse_routes")}
          </Link>
        </section>
      </main>
    </>
  );
}
