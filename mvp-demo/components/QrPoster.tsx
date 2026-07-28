"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LANGS, useI18n, type Lang } from "@/lib/i18n";

/**
 * The page we project so a room can open the app on their own phones.
 *
 * It is read from thirty rows back rather than held, so nearly every decision here
 * is legibility at distance instead of composition. The code is sized off the
 * viewport's shorter side, which keeps it square and as large as the hall's screen
 * allows whatever aspect ratio that turns out to be.
 *
 * Every size here is capped in vh rather than px because the page has to fit the
 * hall's screen without scrolling: a projected page whose address has fallen below
 * the fold is a page that has failed at its one job. Measured at 390x780, 1280x720
 * and 1024x768.
 *
 * The address is set in mono underneath, big enough to type from the back row,
 * because a camera that will not focus is the exact failure this page exists to
 * survive. It is the one piece of redundancy worth the height.
 *
 * There is deliberately no "scan me", no step numbers and no arrow pointing at the
 * code. A QR needs no instruction, and a caption explaining a control is a symptom
 * that the control is in the wrong place.
 */

const URL = "https://voie-libre.vercel.app/";
/** Shown without the scheme: nobody types https:// and it costs real height. */
const TYPEABLE = "voie-libre.vercel.app";

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

export default function QrPoster() {
  const { t } = useI18n();

  return (
    <>
      {/* Hidden when this is projected full screen or printed, and the only way
          back for somebody who reached it on a phone. */}
      <header className="sticky top-0 z-20 border-b border-white/5 bg-navy pt-[env(safe-area-inset-top)] text-white print:hidden">
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

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-5 px-5 py-5 sm:gap-6">
        <div className="text-center">
          <p className="font-mono text-[11px] font-bold tracking-[0.16em] text-ink-faint uppercase">
            Voie Libre, {t("brand_tag")}
          </p>
          <h1 className="mt-2 font-display text-[27px] leading-[1.08] font-extrabold tracking-tight text-ink sm:text-[38px]">
            {t("qr_title")}
          </h1>
        </div>

        {/*
          The corner brackets are the spine's own crop marks, reused rather than
          invented, so the single decorative thing on this page is borrowed from the
          product it points at.

          The code embedded here is the borderless variant, and the white padding
          around it is the quiet zone. Using the file that bakes its own zone in put
          an invisible white margin between the code and the frame, which read as a
          white card with brackets floating off it rather than a frame around a code.
        */}
        <div className="relative bg-white p-[4.5%]">
          <span aria-hidden className="absolute -top-2.5 -left-2.5 size-6 border-t-2 border-l-2 border-navy/30" />
          <span aria-hidden className="absolute -top-2.5 -right-2.5 size-6 border-t-2 border-r-2 border-navy/30" />
          <span aria-hidden className="absolute -bottom-2.5 -left-2.5 size-6 border-b-2 border-l-2 border-navy/30" />
          <span aria-hidden className="absolute -right-2.5 -bottom-2.5 size-6 border-r-2 border-b-2 border-navy/30" />
          {/* eslint-disable-next-line @next/next/no-img-element -- a committed SVG
              at one known size. next/image would add a loader and a layout shift
              for no benefit, and this has to render with JS disabled. */}
          <img
            src="/qr/qr-voie-libre-tight.svg"
            alt={t("qr_alt")}
            width={520}
            height={520}
            className="block h-[min(44vh,430px)] w-[min(44vh,430px)] max-w-[70vw]"
          />
        </div>

        <div className="text-center">
          <a
            href={URL}
            className="font-mono text-[19px] font-medium tracking-tight text-signal underline decoration-signal/30 decoration-2 underline-offset-4 transition-colors hover:decoration-signal sm:text-[26px]"
          >
            {TYPEABLE}
          </a>
          <p className="mx-auto mt-2.5 max-w-md text-[14px] leading-relaxed text-ink/70 sm:text-[15px]">{t("qr_promise")}</p>
        </div>
      </main>
    </>
  );
}
