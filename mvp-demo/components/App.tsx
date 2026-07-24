"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n, LANGS, type Lang } from "@/lib/i18n";
import { ROUTES, type ProfileId } from "@/lib/data";
import { statusColorVar } from "@/lib/status";
import type { Status } from "@/lib/data";
import AccessibilitySpine from "./AccessibilitySpine";
import MetroMap from "./MetroMap";
import RouteMap from "./RouteMap";
import WeatherChip from "./WeatherChip";
import {
  Accessibility,
  Baby,
  PersonStanding,
  BatteryLow,
  TriangleAlert,
  Check,
  MoveVertical,
  CircleHelp,
  ArrowLeft,
  type LucideIcon,
} from "lucide-react";

const PROFILE_META: {
  id: ProfileId;
  labelKey: string;
  icon: LucideIcon;
  routeId: string;
}[] = [
  { id: "wheelchair", labelKey: "profile_wheelchair", icon: Accessibility, routeId: "gdl-eiffel" },
  { id: "stroller", labelKey: "profile_stroller", icon: Baby, routeId: "bastille-louvre" },
  { id: "senior", labelKey: "profile_senior", icon: PersonStanding, routeId: "nord-cite" },
  { id: "lowenergy", labelKey: "profile_lowenergy", icon: BatteryLow, routeId: "gdl-eiffel" },
];

function Logo() {
  return (
    <svg width="22" height="26" viewBox="0 0 22 26" fill="none" aria-hidden>
      <path d="M6 3v20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="6" cy="8" r="3" fill="currentColor" />
      <path d="M12 15h7m0 0-3-3m3 3-3 3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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

const LEGEND: { status: Status; key: string; glyph: LucideIcon }[] = [
  { status: "ok", key: "legend_ok", glyph: Check },
  { status: "lift", key: "legend_lift", glyph: MoveVertical },
  { status: "lift_down", key: "legend_liftdown", glyph: TriangleAlert },
  { status: "stairs", key: "legend_stairs", glyph: TriangleAlert },
  { status: "unknown", key: "legend_unknown", glyph: CircleHelp },
];

function Legend() {
  const { t } = useI18n();
  return (
    <ul className="flex flex-wrap gap-x-2.5 gap-y-1.5 sm:gap-x-3.5">
      {LEGEND.map((item) => {
        const G = item.glyph;
        return (
          <li key={item.key} className="flex items-center gap-1.5 text-[12px] text-ink/70">
            <span style={{ color: statusColorVar(item.status) }}>
              <G size={13} strokeWidth={2.4} aria-hidden />
            </span>
            {t(item.key)}
          </li>
        );
      })}
    </ul>
  );
}

export default function App() {
  const { t, lang } = useI18n();
  const [profile, setProfile] = useState<ProfileId>("wheelchair");
  const [mapView, setMapView] = useState<"map" | "3d">("map");
  const active = PROFILE_META.find((p) => p.id === profile)!;
  const route = ROUTES.find((r) => r.id === active.routeId)!;

  return (
    <>
      {/* Header, back to the assistant is the obvious primary action */}
      <header className="sticky top-0 z-20 border-b border-white/5 bg-navy pt-[env(safe-area-inset-top)] text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-1.5 rounded-lg bg-white/10 pl-2 pr-3 font-semibold text-white/90 transition-colors hover:bg-white/15 hover:text-white"
          >
            <ArrowLeft size={18} strokeWidth={2.4} aria-hidden />
            <span className="text-[14px]">{t("back_to_assistant")}</span>
          </Link>
          <Link href="/" className="hidden items-center gap-2 sm:flex" aria-label="Voie Libre">
            <Logo />
            <span className="font-display text-[18px] font-bold tracking-tight">Voie Libre</span>
          </Link>
          <LangSwitch />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4">
        {/* Hero */}
        <section className="pt-9 pb-6">
          <h1 className="max-w-2xl font-display text-[30px] font-extrabold leading-[1.08] tracking-tight text-ink sm:text-[40px]">
            {t("hero_title")}
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink/70 sm:text-[16px]">
            {t("hero_sub")}
          </p>
          <p className="mt-4 max-w-xl border-l-2 border-signal/45 pl-3 text-[13px] leading-relaxed text-ink-soft">
            {t("hero_reality")}
          </p>
          <div className="mt-5">
            <WeatherChip />
          </div>
        </section>

        {/* Controls */}
        <section aria-labelledby="who" className="rounded-2xl border border-ink/10 bg-surface p-4 sm:p-5">
          <h2 id="who" className="font-display text-[15px] font-bold text-ink">
            {t("profile_q")}
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PROFILE_META.map((p) => {
              const Icon = p.icon;
              const on = profile === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setProfile(p.id)}
                  aria-pressed={on}
                  className={`flex min-h-[52px] items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[14px] font-semibold transition-colors ${
                    on
                      ? "border-signal bg-signal/15 text-ink"
                      : "border-ink/15 bg-surface text-ink hover:border-signal/50"
                  }`}
                >
                  <Icon size={20} strokeWidth={2} aria-hidden className="shrink-0" />
                  <span className="leading-tight">{t(p.labelKey)}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2.5 text-[12.5px] text-ink-soft">{t("profile_note")}</p>
        </section>

        {/* Disruption */}
        {route.disruption && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-caution/30 bg-caution/10 p-3.5 text-[13.5px] leading-snug text-ink">
            <TriangleAlert size={18} strokeWidth={2.2} className="mt-0.5 shrink-0 text-caution" aria-hidden />
            <p>
              <span className="font-bold uppercase tracking-wide text-caution-ink">{t("disruption_today")}</span>{" "}
              {route.disruption[lang]}
            </p>
          </div>
        )}

        {/* Result: spine + map */}
        <section className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border border-ink/10 bg-surface p-4 sm:p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-[16px] font-bold text-ink">{t("result_title")}</h2>
            </div>
            <p className="mt-0.5 text-[13px] text-ink-soft">{route.title[lang]}</p>
            <div className="mt-3 border-t border-ink/10 pt-3">
              <Legend />
            </div>
            <AccessibilitySpine route={route} />
          </div>

          <div className="flex flex-col gap-3 lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl border border-ink/10 bg-surface p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-display text-[16px] font-bold text-ink">{t("map_title")}</h2>
                <div
                  className="flex items-center gap-0.5 rounded-lg bg-ink/[0.06] p-0.5"
                  role="group"
                  aria-label={t("map_view_group")}
                >
                  {(["map", "3d"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setMapView(v)}
                      aria-pressed={mapView === v}
                      className={`grid min-h-9 min-w-11 place-items-center rounded-md px-3 text-[12px] font-bold transition-colors ${
                        mapView === v
                          ? "bg-surface text-ink ring-1 ring-ink/10"
                          : "text-ink-soft hover:text-ink"
                      }`}
                    >
                      {v === "map" ? t("map_view_map") : t("map_view_3d")}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-[300px] lg:h-[360px]">
                {mapView === "map" ? (
                  <RouteMap route={route} />
                ) : (
                  <MetroMap nodes={route.nodes} className="h-full w-full rounded-lg" />
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-ink/10 bg-surface p-4 sm:p-5">
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">
                {t("sources_label")}
              </h3>
              {/* Chips, not a wrapped list: four sources separated only by a gap
                  read as one run-on sentence. */}
              <ul className="mt-2 flex flex-wrap gap-1.5 font-mono text-[11.5px] text-ink-soft">
                {route.sources.map((s) => (
                  <li key={s} className="rounded-md border border-ink/10 bg-canvas px-2 py-1 leading-snug">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Honesty */}
        <section className="mt-6 mb-2 rounded-2xl border border-ink/10 bg-surface p-5 text-ink sm:p-7">
          <h2 className="max-w-xl font-display text-[20px] font-bold leading-tight sm:text-[24px]">
            {t("honesty_title")}
          </h2>
          <p className="mt-2.5 max-w-2xl text-[14px] leading-relaxed text-ink-soft">
            {t("honesty_body")}
          </p>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-4 py-6">
        <p className="text-[12px] leading-relaxed text-ink-soft">{t("disclaimer")}</p>
      </footer>
    </>
  );
}
