"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useI18n, LANGS, type Lang } from "@/lib/i18n";
import { type DemoRoute, type ProfileId } from "@/lib/data";
import { statusColorVar } from "@/lib/status";
import type { Status } from "@/lib/data";
import AccessibilitySpine from "./AccessibilitySpine";
import JourneyPicker from "./JourneyPicker";
import MetroMap, { focusIndex } from "./MetroMap";
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
  Route as RouteIcon,
  Accessibility as AccessibilityIcon,
  type LucideIcon,
} from "lucide-react";

const PROFILE_META: { id: ProfileId; labelKey: string; icon: LucideIcon }[] = [
  { id: "wheelchair", labelKey: "profile_wheelchair", icon: Accessibility },
  { id: "stroller", labelKey: "profile_stroller", icon: Baby },
  { id: "senior", labelKey: "profile_senior", icon: PersonStanding },
  { id: "lowenergy", labelKey: "profile_lowenergy", icon: BatteryLow },
];

/** What the routing endpoint returns, kept to the fields this page draws. */
interface Planned extends DemoRoute {
  shape: { lat: number; lng: number }[];
  minutes: number;
  changes: number;
  stops: number;
  barriers: string[];
  unknowns: string[];
}

type PlanState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; route: Planned; graphBuiltAt: string }
  | { kind: "error"; messageKey: string };

/** A figure inside a sentence, in the mono face the rest of the data uses. */
function Count({ n }: { n: number }) {
  return <span className="font-mono font-bold text-ink">{n}</span>;
}

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
  { status: "conditional", key: "legend_conditional", glyph: AccessibilityIcon },
  { status: "lift_down", key: "legend_liftdown", glyph: TriangleAlert },
  { status: "stairs", key: "legend_stairs", glyph: TriangleAlert },
  { status: "unknown", key: "legend_unknown", glyph: CircleHelp },
];

/**
 * Only the statuses this route actually contains.
 *
 * The full vocabulary has six entries and a computed route can only produce four
 * of them, so printing all six taught the reader to look for a "working lift"
 * marker that will never appear on the page.
 */
function Legend({ present }: { present: Set<Status> }) {
  const { t } = useI18n();
  return (
    <ul className="flex flex-wrap gap-x-2.5 gap-y-1.5 sm:gap-x-3.5">
      {LEGEND.filter((item) => present.has(item.status)).map((item) => {
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

export default function App({
  initialFrom,
  initialFromLabel,
  initialTo,
  initialRoute,
  graphBuiltAt,
  coverage,
}: {
  initialFrom: string;
  initialFromLabel: string;
  initialTo: string;
  initialRoute: Planned | null;
  graphBuiltAt: string;
  coverage: {
    stations: number;
    lines: number;
    platformsAllAccessible: number;
    platformsMixed: number;
    platformsNoneAccessible: number;
    silent: number;
  };
}) {
  const { t, lang } = useI18n();
  const [profile, setProfile] = useState<ProfileId>("wheelchair");
  const [mapView, setMapView] = useState<"map" | "3d">("map");
  // The 3D view leans on a free third-party tile service and on WebGL, either of
  // which can be missing on the day. Rather than leave a dead panel on screen,
  // fall back to the flat map and say why, so pressing 3D can retry.
  const [threeDFellBack, setThreeDFellBack] = useState(false);
  // The two fields hold what the router is asked for (a station id, or a place
  // name); the picker keeps the human-readable version it shows.
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [state, setState] = useState<PlanState>(
    initialRoute ? { kind: "ready", route: initialRoute, graphBuiltAt } : { kind: "idle" },
  );

  const find = useCallback(
    async (a: string, b: string, who: ProfileId) => {
      if (!a.trim() || !b.trim()) return;
      setState({ kind: "loading" });
      try {
        const res = await fetch(
          `/api/plan?from=${encodeURIComponent(a)}&to=${encodeURIComponent(b)}&profile=${who}`,
        );
        const data = await res.json();
        // A named reason is worth more than the status code: the endpoint sends
        // one with a 400 as well, and it says more than "offline" would.
        if (!data.ok) {
          setState({
            kind: "error",
            messageKey: data.reason ? `plan_err_${data.reason}` : "plan_err_offline",
          });
          return;
        }
        if (!res.ok) {
          setState({ kind: "error", messageKey: "plan_err_offline" });
          return;
        }
        setState({ kind: "ready", route: data.route, graphBuiltAt: data.graphBuiltAt });
      } catch {
        setState({ kind: "error", messageKey: "plan_err_offline" });
      }
    },
    [],
  );

  const route = state.kind === "ready" ? state.route : null;

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
            {t("hero_reality_1")} <Count n={coverage.stations} /> {t("hero_reality_2")}{" "}
            <Count n={coverage.platformsAllAccessible} /> {t("hero_reality_3")}{" "}
            <Count n={coverage.platformsMixed} /> {t("hero_reality_4")}{" "}
            <Count n={coverage.platformsNoneAccessible} />. {t("hero_reality_5")}
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
                  onClick={() => {
                    setProfile(p.id);
                    // The profile is an input to the search, not a filter over
                    // its result, so the route is recomputed rather than left on
                    // screen under a label that no longer describes it.
                    find(from, to, p.id);
                  }}
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

        {/* Where to */}
        <section aria-labelledby="where" className="mt-4 rounded-2xl border border-ink/10 bg-surface p-4 sm:p-5">
          <h2 id="where" className="font-display text-[15px] font-bold text-ink">
            {t("plan_q")}
          </h2>
          <JourneyPicker
            from={from}
            to={to}
            fromLabel={initialFromLabel}
            busy={state.kind === "loading"}
            onFrom={setFrom}
            onTo={setTo}
            onSubmit={() => find(from, to, profile)}
          />
        </section>

        {/* Disruption */}
        {route?.disruption && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-caution/30 bg-caution/10 p-3.5 text-[13.5px] leading-snug text-ink">
            <TriangleAlert size={18} strokeWidth={2.2} className="mt-0.5 shrink-0 text-caution" aria-hidden />
            <p>
              <span className="font-bold uppercase tracking-wide text-caution-ink">{t("disruption_today")}</span>{" "}
              {route.disruption[lang]}
            </p>
          </div>
        )}

        {/* An error is a sentence that says what to do next, never the word
            "error" on its own. */}
        {state.kind === "error" && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2.5 rounded-xl border border-barrier/35 bg-barrier/[0.07] p-3.5 text-[13.5px] leading-snug text-ink"
          >
            <TriangleAlert size={18} strokeWidth={2.2} className="mt-0.5 shrink-0 text-barrier" aria-hidden />
            <p>{t(state.messageKey)}</p>
          </div>
        )}

        {/* Result: spine + map */}
        <section className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border border-ink/10 bg-surface p-4 sm:p-5">
            <h2 className="font-display text-[16px] font-bold text-ink">{t("result_title")}</h2>

            {state.kind === "loading" && (
              <div className="mt-3 grid gap-2" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-11 animate-pulse rounded-lg bg-canvas" />
                ))}
              </div>
            )}

            {state.kind === "idle" && (
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">{t("plan_idle")}</p>
            )}

            {state.kind === "error" && (
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">{t("plan_idle")}</p>
            )}

            {route && (
              <>
                <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[13px] text-ink-soft">
                  <span>{route.title[lang]}</span>
                  <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink-faint">
                    {t("plan_computed")}
                  </span>
                </p>
                {/* Three numbers, because those are the three a traveller acts on:
                    how long, how many changes, how many stops. */}
                <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
                  {[
                    { v: route.minutes, k: t("plan_minutes") },
                    { v: route.changes, k: t("plan_changes") },
                    { v: route.stops, k: t("plan_stops") },
                  ].map((item) => (
                    <div key={item.k} className="flex items-baseline gap-1.5">
                      <dd className="font-display text-[22px] font-extrabold leading-none text-ink">{item.v}</dd>
                      <dt className="text-[12.5px] text-ink-soft">{item.k}</dt>
                    </div>
                  ))}
                </dl>
                <p className="mt-2.5 flex items-start gap-1.5 text-[12.5px] leading-snug text-ink-soft">
                  <AccessibilityIcon size={14} strokeWidth={2.2} aria-hidden className="mt-0.5 shrink-0" />
                  <span>
                    {route.barriers.length === 0
                      ? t("plan_barriers_none")
                      : `${t("plan_barriers_some")} ${route.barriers.join(", ")}`}
                    {route.unknowns.length > 0 && (
                      <>
                        {" "}
                        {route.unknowns.length}{" "}
                        {t(
                          route.unknowns.length === 1
                            ? "plan_unknown_count_one"
                            : "plan_unknown_count",
                        )}
                        .
                      </>
                    )}
                  </span>
                </p>
                <div className="mt-3 border-t border-ink/10 pt-3">
                  <Legend
                    present={
                      new Set(
                        route.nodes.flatMap((n) =>
                          n.into ? [n.at, n.into.status] : [n.at],
                        ),
                      )
                    }
                  />
                </div>
                <AccessibilitySpine route={route} />
              </>
            )}
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
                      onClick={() => {
                        setMapView(v);
                        if (v === "3d") setThreeDFellBack(false);
                      }}
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
                {!route ? (
                  <div className="grid h-full place-items-center rounded-lg border border-dashed border-ink/15 bg-canvas px-6 text-center">
                    <p className="flex flex-col items-center gap-2 text-[13px] leading-snug text-ink-soft">
                      <RouteIcon size={22} strokeWidth={1.8} aria-hidden className="text-ink-faint" />
                      {t("plan_idle")}
                    </p>
                  </div>
                ) : mapView === "map" ? (
                  <RouteMap route={route} />
                ) : (
                  <MetroMap
                    nodes={route.nodes}
                    className="h-full w-full rounded-lg"
                    onUnavailable={() => {
                      setThreeDFellBack(true);
                      setMapView("map");
                    }}
                  />
                )}
              </div>
              {/* The 3D view is not the same picture tilted: it opens on the one
                  stop that needs looking at, and saying which stop is the
                  difference between a gimmick and a reason to press the button. */}
              {route && mapView === "3d" && !threeDFellBack && (
                <p className="mt-2 text-[12.5px] leading-snug text-ink-soft">
                  {t("map_3d_focus")}{" "}
                  <span className="font-bold text-ink">{route.nodes[focusIndex(route.nodes)].name}</span>
                </p>
              )}
              {threeDFellBack && (
                <p role="status" className="mt-2 text-[12.5px] leading-snug text-caution-ink">
                  {t("map_3d_fell_back")}
                </p>
              )}
            </div>
            {route && (
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
                {state.kind === "ready" && Boolean(state.graphBuiltAt) && (
                  <p className="mt-2 font-mono text-[10.5px] uppercase tracking-wide text-ink-faint">
                    {t("plan_graph")} {state.graphBuiltAt.slice(0, 10)}
                  </p>
                )}
              </div>
            )}
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
        <Link
          href="/privacy"
          className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-[12.5px] font-semibold text-signal transition-colors hover:text-ink"
        >
          {t("legal_link")}
        </Link>
      </footer>
    </>
  );
}
