"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpDown, Search, Train, MapPin, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * Two fields and one button, which is the whole of the product's front door.
 *
 * The one decision worth explaining: the suggestion list is not a dropdown that
 * has to be obeyed. Typing "Bastille" and pressing the button works without ever
 * opening the list, because a picker that refuses to act until you have chosen
 * from its own menu is the friction this app exists to remove. The list is help,
 * not a gate.
 *
 * It is still reachable with the arrow keys, and that is not a checkbox exercise:
 * an app whose subject is people who cannot use the stairs cannot ship a front
 * door that needs a mouse. Nothing is selected until an arrow key says so, so
 * Enter on a freshly typed name submits the journey rather than silently choosing
 * the first suggestion.
 */

interface Suggestion {
  value: string;
  label: string;
  kind: "station" | "place";
  detail: string;
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  onPick,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onPick: (s: Suggestion) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  /** -1 means "nothing chosen", which is what makes Enter submit instead of pick. */
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const typed = useRef(false);

  useEffect(() => {
    if (!typed.current || value.trim().length < 2) {
      setItems([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stations?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        setItems(data.results ?? []);
        setActive(-1);
        setOpen(true);
      } catch {
        setItems([]);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  return (
    <div ref={box} className="relative">
      <label htmlFor={id} className="block text-[12px] font-bold uppercase tracking-wide text-ink-soft">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => {
          typed.current = true;
          onChange(e.target.value);
        }}
        onFocus={() => items.length > 0 && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setActive(-1);
            return;
          }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            if (items.length === 0) return;
            e.preventDefault();
            setOpen(true);
            const step = e.key === "ArrowDown" ? 1 : -1;
            setActive((i) => {
              const next = i + step;
              if (next < 0) return items.length - 1;
              if (next >= items.length) return 0;
              return next;
            });
            return;
          }
          if (e.key === "Enter" && open && active >= 0 && items[active]) {
            // Only when an arrow key put something under the cursor. Otherwise the
            // form submits what was typed, which is the whole point of the comment
            // at the top of this file.
            e.preventDefault();
            onPick(items[active]);
            setOpen(false);
            setActive(-1);
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${id}-opt-${active}` : undefined}
        aria-controls={`${id}-list`}
        className="mt-1 min-h-11 w-full rounded-xl border border-ink/20 bg-canvas px-3 text-[15px] text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none"
      />
      {open && items.length > 0 && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-ink/15 bg-surface py-1 shadow-lg shadow-ink/10"
        >
          {items.map((s, i) => {
            const Icon = s.kind === "place" ? MapPin : Train;
            return (
              <li
                key={`${s.kind}-${s.value}`}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onPick(s);
                    setOpen(false);
                    setActive(-1);
                  }}
                  className={`flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-signal/10 ${
                    i === active ? "bg-signal/12" : ""
                  }`}
                >
                  <Icon size={15} strokeWidth={2.2} aria-hidden className="mt-0.5 shrink-0 text-ink-faint" />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold text-ink">{s.label}</span>
                    {s.detail && (
                      <span className="block truncate font-mono text-[11px] text-ink-soft">{s.detail}</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function JourneyPicker({
  from,
  to,
  fromLabel,
  busy,
  onFrom,
  onTo,
  onSubmit,
}: {
  from: string;
  to: string;
  /** What to show for the opening `from`, whose value is a station id. */
  fromLabel?: string;
  busy: boolean;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  onSubmit: () => void;
}) {
  const { t } = useI18n();
  // What the field shows and what the router is asked for are two different
  // things: a station is sent as its id (two stations share a name in Paris),
  // a place is sent as its name.
  const [fromValue, setFromValue] = useState(fromLabel ?? from);
  const [toValue, setToValue] = useState(to);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="mt-3"
    >
      <div className="grid gap-2.5 sm:grid-cols-[1fr_auto_1fr]">
        <Field
          label={t("plan_from")}
          placeholder={t("plan_from_ph")}
          value={fromValue}
          onChange={(v) => {
            setFromValue(v);
            onFrom(v);
          }}
          onPick={(s) => {
            setFromValue(s.label);
            onFrom(s.value);
          }}
        />
        <button
          type="button"
          aria-label={t("plan_swap")}
          onClick={() => {
            const a = fromValue;
            const b = toValue;
            setFromValue(b);
            setToValue(a);
            onFrom(to);
            onTo(from);
          }}
          className="grid min-h-11 min-w-11 place-items-center self-end rounded-xl border border-ink/15 text-ink-soft transition-colors hover:border-signal/50 hover:text-ink"
        >
          <ArrowUpDown size={17} strokeWidth={2.2} aria-hidden className="sm:rotate-90" />
        </button>
        <Field
          label={t("plan_to")}
          placeholder={t("plan_to_ph")}
          value={toValue}
          onChange={(v) => {
            setToValue(v);
            onTo(v);
          }}
          onPick={(s) => {
            setToValue(s.label);
            onTo(s.value);
          }}
        />
      </div>
      {/* One primary action on the screen, filled and full width on a phone.
          Everything else here is an outline or a plain control. */}
      <button
        type="submit"
        disabled={busy || !from.trim() || !to.trim()}
        className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-signal px-5 text-[15px] font-bold text-white transition-colors hover:bg-signal/90 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
      >
        {busy ? (
          <Loader2 size={17} strokeWidth={2.4} aria-hidden className="animate-spin" />
        ) : (
          <Search size={17} strokeWidth={2.4} aria-hidden />
        )}
        {busy ? t("plan_working") : t("plan_submit")}
      </button>
    </form>
  );
}
