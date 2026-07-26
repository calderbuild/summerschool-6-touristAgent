"use client";

import Link from "next/link";
import { ArrowRight, MessageSquare, Route } from "lucide-react";
import { useI18n, LANGS, type Lang } from "@/lib/i18n";

/**
 * The page nobody designs, which is exactly why it is worth designing.
 *
 * A mistyped link is a dead end, and every other screen in this product exists
 * to get someone around a dead end. Sending them to the framework's default
 * black-on-white "404 This page could not be found" would break that promise at
 * the one moment they are already lost, in a language they may not read.
 */
export default function NotFound() {
  const { t, lang, setLang } = useI18n();

  const ways = [
    { href: "/", icon: MessageSquare, title: t("nf_chat"), hint: t("nf_chat_hint") },
    { href: "/routes", icon: Route, title: t("nf_routes"), hint: t("nf_routes_hint") },
  ];

  return (
    <>
      <header className="border-b border-white/5 bg-navy pt-[env(safe-area-inset-top)] text-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/" className="flex min-h-11 items-center font-display text-[15px] font-bold text-white">
            Voie Libre
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

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16 pt-12">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-faint">
          404 · {t("nf_code")}
        </p>
        <h1 className="mt-2.5 font-display text-[30px] font-extrabold leading-[1.08] tracking-tight text-ink sm:text-[38px]">
          {t("nf_title")}
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink/70 sm:text-[16px]">{t("nf_body")}</p>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {ways.map(({ href, icon: Icon, title, hint }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col rounded-2xl border border-ink/10 bg-surface p-4 transition-colors hover:border-ink/25"
            >
              <span className="flex items-center gap-2">
                <Icon size={17} strokeWidth={2} className="text-ink-soft" aria-hidden />
                <span className="font-display text-[15px] font-bold text-ink">{title}</span>
                <ArrowRight
                  size={15}
                  strokeWidth={2.4}
                  aria-hidden
                  className="ml-auto text-ink-faint transition-transform group-hover:translate-x-0.5"
                />
              </span>
              <span className="mt-2 text-[12.5px] leading-snug text-ink-soft">{hint}</span>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
