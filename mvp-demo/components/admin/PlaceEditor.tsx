"use client";

import { useState } from "react";
import type { Place } from "@/lib/places";
import { Check, Loader2, TriangleAlert, X } from "lucide-react";

/**
 * Correcting one record, from the console, without a deploy.
 *
 * The console was read-only for the whole project, which was defensible while the
 * knowledge base was a committed file reviewed in a pull request. What it could not
 * do was fix a lift that got boarded up on a Tuesday: the correct value existed, a
 * person had seen it with their own eyes, and it still needed a code change and a
 * deploy to reach a traveller. This is that gap closed.
 *
 * Three deliberate constraints, all of them enforced on the server as well, because
 * a form is a suggestion and a route handler is a rule.
 *
 * **Nothing is overwritten, only overridden.** The committed value stays visible in
 * grey beside every field, and an empty field means "no correction" rather than
 * "the answer is nothing". Clearing a box therefore restores the shipped value,
 * which is the only undo a person will look for.
 *
 * **A claim needs a date.** Changing what a wheelchair user will meet requires the
 * date somebody checked it, because that date is what the assistant cites and what
 * makes the correction re-checkable. The date field is pre-filled with today, and
 * the server refuses the write without it.
 *
 * **Hiding is not closing.** "Closed" is a fact about the venue and worth telling a
 * traveller. Hidden means we no longer trust our own record enough to repeat it,
 * so it leaves the assistant's knowledge base entirely.
 */

export interface OverrideRow {
  place_id: string;
  wheelchair: string | null;
  station_step_free: string | null;
  notes: string | null;
  status: "open" | "closed" | null;
  last_verified: string | null;
  hidden: boolean;
  updated_at: string;
  updated_by: string | null;
}

type Draft = {
  wheelchair: string;
  station_step_free: string;
  notes: string;
  status: "" | "open" | "closed";
  last_verified: string;
  hidden: boolean;
  updated_by: string;
};

function draftOf(row: OverrideRow | undefined, today: string): Draft {
  return {
    wheelchair: row?.wheelchair ?? "",
    station_step_free: row?.station_step_free ?? "",
    notes: row?.notes ?? "",
    status: row?.status ?? "",
    last_verified: row?.last_verified ?? today,
    hidden: row?.hidden ?? false,
    updated_by: row?.updated_by ?? "",
  };
}

function Field({
  label,
  shipped,
  value,
  onChange,
  rows,
}: {
  label: string;
  shipped: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10.5px] font-bold uppercase tracking-wide text-ink-faint">{label}</span>
      {rows ? (
        <textarea
          value={value}
          rows={rows}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full resize-y rounded-lg border border-ink/15 bg-surface px-3 py-2 text-[13.5px] leading-relaxed text-ink outline-none focus:border-signal"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 min-h-10 w-full rounded-lg border border-ink/15 bg-surface px-3 text-[13.5px] text-ink outline-none focus:border-signal"
        />
      )}
      {/* What ships in the code, so a corrector can see what they are disagreeing
          with rather than typing over a value they cannot read. */}
      <span className="mt-1 block text-[12px] leading-snug text-ink-faint">
        Shipped: {shipped || "nothing"}
      </span>
    </label>
  );
}

export default function PlaceEditor({
  place,
  row,
  onClose,
  onSaved,
}: {
  place: Place;
  row: OverrideRow | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Read once, on mount, and this only ever mounts from a click: reading the clock
  // during a server render would disagree with the browser's and React calls that a
  // hydration error. The parent keys this component by place id, so switching
  // records remounts it rather than needing an effect to reset the draft.
  const [draft, setDraft] = useState<Draft>(() => draftOf(row, new Date().toISOString().slice(0, 10)));
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  async function save() {
    setSaving(true);
    setProblem(null);
    try {
      const res = await fetch("/api/admin/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          place_id: place.id,
          wheelchair: draft.wheelchair.trim() || null,
          station_step_free: draft.station_step_free.trim() || null,
          notes: draft.notes.trim() || null,
          status: draft.status || null,
          last_verified: draft.last_verified || null,
          hidden: draft.hidden,
          updated_by: draft.updated_by.trim() || null,
        }),
      });
      const body = (await res.json()) as { ok?: boolean; reason?: string };
      if (!res.ok || !body.ok) {
        setProblem(REASONS[body.reason ?? ""] ?? "The correction was not saved.");
        return;
      }
      setSaved(true);
      onSaved();
    } catch {
      setProblem("Could not reach the server. Nothing was saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-signal/30 bg-signal/[0.04] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-[16px] font-bold text-ink">Correct {place.nameEn}</h3>
          <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-ink-soft">
            An empty field keeps what ships in the code. Anything you fill in reaches travellers
            within a minute, with the date below shown as its source.
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close the editor"
          className="grid min-h-10 min-w-10 place-items-center rounded-lg border border-ink/15 bg-surface text-ink-soft hover:text-ink"
        >
          <X size={16} strokeWidth={2.4} aria-hidden />
        </button>
      </div>

      <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
        <Field
          label="Wheelchair access at the venue"
          shipped={place.wheelchair}
          value={draft.wheelchair}
          onChange={(v) => set("wheelchair", v)}
        />
        <Field
          label="Step-free from the station"
          shipped={place.stationStepFree}
          value={draft.station_step_free}
          onChange={(v) => set("station_step_free", v)}
        />
        <div className="sm:col-span-2">
          <Field
            label="Notes the assistant may repeat"
            shipped={place.notes}
            value={draft.notes}
            rows={3}
            onChange={(v) => set("notes", v)}
          />
        </div>

        <label className="block">
          <span className="font-mono text-[10.5px] font-bold uppercase tracking-wide text-ink-faint">
            Open or closed
          </span>
          <select
            value={draft.status}
            onChange={(e) => set("status", e.target.value as Draft["status"])}
            className="mt-1 min-h-10 w-full rounded-lg border border-ink/15 bg-surface px-3 text-[13.5px] font-semibold text-ink outline-none focus:border-signal"
          >
            <option value="">No correction (shipped: {place.status})</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </label>

        <label className="block">
          <span className="font-mono text-[10.5px] font-bold uppercase tracking-wide text-ink-faint">
            Date you checked
          </span>
          <input
            type="date"
            value={draft.last_verified}
            onChange={(e) => set("last_verified", e.target.value)}
            className="mt-1 min-h-10 w-full rounded-lg border border-ink/15 bg-surface px-3 text-[13.5px] text-ink outline-none focus:border-signal"
          />
          <span className="mt-1 block text-[12px] leading-snug text-ink-faint">
            Required for any correction above. It becomes the source the assistant cites.
          </span>
        </label>

        <label className="block">
          <span className="font-mono text-[10.5px] font-bold uppercase tracking-wide text-ink-faint">
            Who checked it
          </span>
          <input
            type="text"
            value={draft.updated_by}
            onChange={(e) => set("updated_by", e.target.value)}
            placeholder="A name, so the trail means something"
            className="mt-1 min-h-10 w-full rounded-lg border border-ink/15 bg-surface px-3 text-[13.5px] text-ink outline-none focus:border-signal placeholder:text-ink-faint"
          />
        </label>

        <label className="flex items-start gap-2.5 rounded-lg border border-ink/15 bg-surface px-3 py-2.5">
          <input
            type="checkbox"
            checked={draft.hidden}
            onChange={(e) => set("hidden", e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-barrier"
          />
          <span className="min-w-0">
            <span className="block text-[13.5px] font-semibold text-ink">
              Take this place out of the assistant
            </span>
            <span className="mt-0.5 block text-[12px] leading-snug text-ink-soft">
              For a record we no longer trust. Different from closed, which is worth telling a
              traveller.
            </span>
          </span>
        </label>
      </div>

      {problem && (
        <p role="alert" className="mt-3.5 flex items-start gap-2 text-[13px] font-semibold text-barrier">
          <TriangleAlert size={15} strokeWidth={2.4} aria-hidden className="mt-0.5 shrink-0" />
          {problem}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-signal px-4 text-[14px] font-bold text-canvas transition-colors hover:bg-signal/90 disabled:opacity-50"
        >
          {saving ? <Loader2 size={15} strokeWidth={2.4} aria-hidden className="animate-spin" /> : null}
          {saving ? "Saving" : "Save the correction"}
        </button>
        {saved && !problem && (
          <span role="status" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ok-ink">
            <Check size={15} strokeWidth={2.6} aria-hidden />
            Live for travellers within a minute
          </span>
        )}
      </div>
    </div>
  );
}

/** The server's reasons, said in words a person can act on. */
const REASONS: Record<string, string> = {
  date_required: "Add the date you checked. A correction without one is a rumour.",
  no_database: "This build has no database configured, so corrections cannot be saved.",
  unauthorised: "Your session expired. Sign in again.",
  unknown_place: "That place is not in the shipped knowledge base.",
  bad_date: "The date needs to look like 2026-07-28.",
  bad_status: "Status must be open or closed.",
  nothing_to_change: "Nothing was different from what is already saved.",
  write_failed: "The database refused the write. Nothing was saved.",
};
