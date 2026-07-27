"use client";

import Link from "next/link";
import { ArrowLeft, Accessibility, ShieldCheck } from "lucide-react";
import { useI18n, LANGS, type Lang } from "@/lib/i18n";
import { A11Y_CLAIMS, DATA_CLAIMS, type Claim } from "@/lib/legal";

/**
 * Two statements a product like this owes its readers: where their words go, and
 * how far its own accessibility claims actually reach.
 *
 * Written as answers rather than as a policy. A policy is read by nobody and
 * protects the people who wrote it; the interesting sentence here is the one
 * admitting that a message mentioning a wheelchair leaves the European Union to
 * reach the model, and that sentence has to be the easiest one to find.
 */
function ClaimList({ claims }: { claims: Claim[] }) {
  const { t, lang } = useI18n();
  return (
    <ul className="mt-3 grid gap-2.5">
      {claims.map((claim) => (
        <li key={claim.title.en} className="rounded-2xl border border-ink/10 bg-surface p-4 sm:p-5">
          <h3 className="font-display text-[15px] font-bold leading-tight text-ink">{claim.title[lang]}</h3>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">{claim.body[lang]}</p>
          {claim.check && (
            <p className="mt-2 border-l-2 border-ok/40 pl-2.5 font-mono text-[11px] leading-snug text-ink-faint">
              {t("legal_check")}: {claim.check[lang]}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function Legal() {
  const { t, lang, setLang } = useI18n();

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
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16">
        <section className="pt-9">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-faint">{t("legal_eyebrow")}</p>
          <h1 className="mt-2.5 max-w-2xl font-display text-[30px] font-extrabold leading-[1.08] tracking-tight text-ink sm:text-[38px]">
            {t("legal_title")}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink/70 sm:text-[16px]">{t("legal_intro")}</p>
        </section>

        <section aria-labelledby="data" className="mt-8">
          <h2 id="data" className="flex items-center gap-2 font-display text-[17px] font-bold text-ink">
            <ShieldCheck size={18} strokeWidth={2.2} className="text-ok-ink" aria-hidden />
            {t("legal_data_title")}
          </h2>
          <ClaimList claims={DATA_CLAIMS} />
        </section>

        <section aria-labelledby="a11y" className="mt-10">
          <h2 id="a11y" className="flex items-center gap-2 font-display text-[17px] font-bold text-ink">
            <Accessibility size={18} strokeWidth={2.2} className="text-signal" aria-hidden />
            {t("legal_a11y_title")}
          </h2>
          <ClaimList claims={A11Y_CLAIMS} />
        </section>

        <p className="mt-8 font-mono text-[10.5px] uppercase tracking-wide text-ink-faint">{t("legal_updated")}</p>
      </main>
    </>
  );
}
