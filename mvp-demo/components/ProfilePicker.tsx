"use client";

import { Accessibility, Baby, BatteryLow, PersonStanding, type LucideIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { ProfileId } from "@/lib/router";

/**
 * Who is travelling, and what saying so changes.
 *
 * Two things were wrong with the two copies of this row that used to live in
 * `ChatShell` and `App`.
 *
 * **It only took one answer.** People do not arrive as one profile: the wheelchair
 * user is often also the one with no energy left by six, and a parent with a
 * pushchair is often travelling with a grandparent. Forcing a single choice made
 * the traveller decide which of their constraints to drop, which is exactly the
 * arithmetic the router should be doing. It is a set now, and the router takes the
 * strictest requirement on every dimension.
 *
 * **It did not say what it did.** A row of four buttons that visibly changes
 * nothing is a control a person is right to distrust, and "this sets how many
 * stairs the route will accept" (the sentence that used to sit under it) explains
 * the mechanism rather than the consequence. Each chip now states its own
 * consequence in one clause, and the clauses come from the same weights the search
 * uses: `router.test.ts` fails if the weight a clause describes stops being the
 * strongest one.
 */

export const PROFILE_META: { id: ProfileId; labelKey: string; icon: LucideIcon }[] = [
  { id: "wheelchair", labelKey: "profile_wheelchair", icon: Accessibility },
  { id: "stroller", labelKey: "profile_stroller", icon: Baby },
  { id: "senior", labelKey: "profile_senior", icon: PersonStanding },
  { id: "lowenergy", labelKey: "profile_lowenergy", icon: BatteryLow },
];

/** Toggle one id in a selection, preserving the order the chips are shown in, so
 *  the effect lines below never reorder themselves as a person picks. */
export function toggleProfile(selected: ProfileId[], id: ProfileId): ProfileId[] {
  const next = selected.includes(id) ? selected.filter((p) => p !== id) : [...selected, id];
  return PROFILE_META.map((p) => p.id).filter((p) => next.includes(p));
}

export default function ProfilePicker({
  selected,
  onChange,
  size = "compact",
}: {
  selected: ProfileId[];
  onChange: (next: ProfileId[]) => void;
  /** `roomy` on the planner page, which has a card to fill; `compact` under the
   *  chat headline, where the input above it is the thing that matters. */
  size?: "compact" | "roomy";
}) {
  const { t } = useI18n();
  const roomy = size === "roomy";

  return (
    <div>
      <div className={`grid grid-cols-2 gap-2.5 sm:grid-cols-4 ${roomy ? "gap-2" : ""}`}>
        {PROFILE_META.map((p) => {
          const Icon = p.icon;
          const on = selected.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(toggleProfile(selected, p.id))}
              // Checkbox, not a radio: the control accepts more than one answer and
              // must say so to anyone who cannot see that two chips are lit.
              role="checkbox"
              aria-checked={on}
              className={`flex touch-manipulation items-center gap-2 rounded-xl border px-3 py-2.5 text-left font-semibold transition-colors ${
                roomy ? "min-h-[52px] text-[14px]" : "min-h-12 text-[13px]"
              } ${
                on
                  ? "border-signal bg-signal/15 text-ink"
                  : "border-ink/15 bg-surface text-ink hover:border-signal/50"
              }`}
            >
              <Icon
                size={roomy ? 20 : 18}
                strokeWidth={2}
                aria-hidden
                className={`shrink-0 ${on ? "text-signal" : "text-ink-soft"}`}
              />
              <span className="leading-tight">{t(p.labelKey)}</span>
            </button>
          );
        })}
      </div>

      {/* What the choice does, once there is a choice, in one line either way.
          Nothing selected says nothing: an empty selection routes for a wheelchair,
          and a line of prose about a setting nobody has touched is noise on the one
          screen whose job is to get a destination typed.

          One clause per selection was the first attempt, and three chips produced
          four sentences of small grey text under an input box, which is the same
          mistake this screen has already been through once. A person who wants the
          detail of one constraint can select it on its own; a person who has
          selected three needs to know only that nothing they said gets dropped. */}
      {selected.length > 0 && (
        <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-soft">
          {selected.length === 1 ? t(`profile_fx_${selected[0]}`) : t("profile_fx_strictest")}
        </p>
      )}
    </div>
  );
}
