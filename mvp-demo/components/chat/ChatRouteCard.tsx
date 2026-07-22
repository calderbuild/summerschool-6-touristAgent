"use client";

import { ROUTES } from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import AccessibilitySpine from "../AccessibilitySpine";
import RouteMap from "../RouteMap";
import { TriangleAlert } from "lucide-react";

/** Compact route card rendered inline in a chat answer, from a [[route:id]] marker. */
export default function ChatRouteCard({ id }: { id: string }) {
  const { t, lang } = useI18n();
  const route = ROUTES.find((r) => r.id === id);
  if (!route) return null;

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-ink/12 bg-paper">
      <div className="border-b border-ink/10 px-4 py-2.5">
        <p className="font-display text-[14px] font-bold text-ink">
          {route.from} <span className="text-ink/40">→</span> {route.to}
        </p>
        <p className="mt-0.5 text-[12px] leading-snug text-ink/55">{route.title[lang]}</p>
      </div>

      {route.disruption && (
        <p className="flex items-start gap-1.5 bg-caution/10 px-4 py-2 text-[12px] leading-snug text-ink">
          <TriangleAlert size={14} strokeWidth={2.2} className="mt-0.5 shrink-0 text-caution" aria-hidden />
          <span>{route.disruption[lang]}</span>
        </p>
      )}

      <div className="grid sm:grid-cols-[1fr_0.82fr]">
        <div className="px-4 pb-4 pt-3">
          <AccessibilitySpine route={route} />
        </div>
        <div className="border-t border-ink/10 p-3 sm:border-l sm:border-t-0">
          <div className="h-[220px]">
            <RouteMap route={route} />
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10.5px] text-ink/55">
            {route.sources.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
