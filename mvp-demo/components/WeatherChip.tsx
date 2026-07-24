"use client";

import { useEffect, useState } from "react";
import { CloudRain } from "lucide-react";
import { useI18n } from "@/lib/i18n";

// The chat backend already feeds live Paris weather to the model; this makes the
// same open data visible. Weather is an ambient bonus, not core, so on any
// failure the chip renders nothing rather than showing a broken state. The
// condition maps a WMO code to a translated label so the chip stays trilingual.

type WeatherNow = { tempC: number; code: number; raining: boolean };

function conditionKey(code: number): string {
  if (code === 0) return "weather_clear";
  if (code <= 2) return "weather_mostly_clear";
  if (code === 3) return "weather_overcast";
  if (code >= 45 && code <= 48) return "weather_foggy";
  if (code >= 51 && code <= 67) return "weather_rainy";
  if (code >= 71 && code <= 77) return "weather_snowy";
  if (code >= 80 && code <= 82) return "weather_showers";
  if (code >= 95) return "weather_storm";
  return "weather_unsettled";
}

export default function WeatherChip({
  className = "",
  variant = "light",
}: {
  className?: string;
  // "dark" tunes the chip for the navy header band; "light" for paper surfaces.
  variant?: "light" | "dark";
}) {
  const { t } = useI18n();
  const [w, setW] = useState<WeatherNow | null>(null);
  const [ready, setReady] = useState(false);
  const dark = variant === "dark";

  useEffect(() => {
    let alive = true;
    fetch("/api/weather")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        if (d && typeof d.tempC === "number") setW(d);
        setReady(true);
      })
      .catch(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  // Loading: a quiet placeholder that holds the space without drawing attention.
  if (!ready) {
    return (
      <span
        className={`inline-flex h-7 w-40 animate-pulse items-center rounded-full ${dark ? "bg-white/10" : "bg-ink/[0.06]"} ${className}`}
        aria-hidden
      />
    );
  }

  // Failure or no data: stay silent, the rest of the page is unaffected.
  if (!w) return null;

  const raining = w.raining;
  // Rain is the one weather state that actually changes a step-free plan, so it
  // is the only one that borrows the caution colour; otherwise the chip is calm.
  const dot = raining ? "var(--color-caution)" : "var(--color-ok)";

  return (
    <span
      className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1 font-mono text-[12px] ${
        dark ? "border-white/15 bg-white/10 text-white/70" : "border-ink/12 bg-surface text-ink-soft"
      } ${className}`}
      title={raining ? t("weather_rain_hint") : undefined}
      aria-label={`${t("weather_label")}: ${w.tempC}°C, ${t(conditionKey(w.code))}`}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} aria-hidden />
      <span className={`font-semibold ${dark ? "text-white" : "text-ink"}`}>Paris {w.tempC}°</span>
      <span>{t(conditionKey(w.code))}</span>
      {raining && (
        <CloudRain size={13} strokeWidth={2.2} className={dark ? "text-caution" : "text-caution-ink"} aria-hidden />
      )}
      <span className={`ml-0.5 inline-flex items-center gap-1 ${dark ? "text-white/55" : "text-ink-faint"}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-ok/70" aria-hidden />
        {t("weather_live")}
      </span>
    </span>
  );
}
