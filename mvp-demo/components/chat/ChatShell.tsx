"use client";

import { memo, useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useI18n, LANGS, type Lang } from "@/lib/i18n";
import { ROUTES, type ProfileId } from "@/lib/data";
import { useSpeechInput, useSpeechOutput } from "@/lib/useSpeech";
import { speakable } from "@/lib/speakable";
import ChatRouteCard from "./ChatRouteCard";
import ProfilePicker from "../ProfilePicker";
import LiveRail from "./LiveRail";
import WeatherChip from "../WeatherChip";
import {
  ArrowUp,
  Square,
  ChevronRight,
  Plus,
  Map as MapIcon,
  QrCode,
  RotateCcw,
  Mic,
  Volume2,
  VolumeX,
  ArrowRight,
} from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; reasoning: string };

const ROUTE_ID_SET = new Set(ROUTES.map((r) => r.id));

/**
 * The conversation, kept on the device.
 *
 * `localStorage`, not `sessionStorage`. The session copy survived a trip to
 * /whats-on and back, which is what it was written for, and died with the tab,
 * which is not what a person means by "is my conversation saved". Nothing here
 * leaves the browser: there is no account, no server-side history and nothing to
 * join a conversation to a person, which for a product that knows a traveller's
 * disability is a deliberate limit rather than a missing feature. Clearing it is
 * one press of New chat.
 */
const CHAT_STORAGE_KEY = "voie-libre-chat";

interface Stored {
  messages: Msg[];
  profiles: ProfileId[];
}

/** Reads either shape: `profiles` as written now, or the single `profile` string
 *  written before the picker took more than one answer. */
function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY) ?? sessionStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      messages?: Msg[];
      profile?: ProfileId | null;
      profiles?: ProfileId[];
    };
    const profiles = Array.isArray(parsed.profiles)
      ? parsed.profiles
      : parsed.profile
        ? [parsed.profile]
        : [];
    return {
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      profiles,
    };
  } catch {
    return null;
  }
}

function writeStored(messages: Msg[], profiles: ProfileId[]) {
  try {
    if (messages.length) {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ messages, profiles }));
    } else {
      localStorage.removeItem(CHAT_STORAGE_KEY);
      // The old session copy would otherwise come back the next time the tab
      // loaded, restoring a conversation the traveller had just cleared.
      sessionStorage.removeItem(CHAT_STORAGE_KEY);
    }
  } catch {
    // Storage full, or blocked in private mode: persistence is a convenience,
    // never a blocker.
  }
}

const CONCLUSION_PATTERNS = [
  /^(bottom line|verdict|conclusion|key point|recommendation)\s*[:：-]/i,
  /^(en bref|conclusion|verdict|recommandation)\s*[:：-]/i,
  /^(结论|結論|重点|重點|建议|建議|最终建议|最終建議)\s*[:：-]/,
];

function looksLikeConclusion(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return CONCLUSION_PATTERNS.some((pattern) => pattern.test(trimmed));
}

// ---- Minimal markdown rendering for streamed answers -----------------------
// Hand-rolled (no dependency) so a half-streamed marker just falls through as
// literal text and self-corrects once its closing marker arrives, the same
// tolerant approach [[route:...]] markers already use below. Headings are
// rendered as styled text rather than real <h*> tags so LLM-authored markdown
// can never intrude on the page's own heading outline for screen readers.
const INLINE_PATTERN = /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(INLINE_PATTERN).map((part, i) => {
    if (!part) return null;
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      return (
        <code key={key} className="rounded bg-ink/8 px-1 py-0.5 font-mono text-[13px]">
          {part.slice(1, -1)}
        </code>
      );
    }
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      return (
        <strong key={key} className="font-semibold text-ink">
          {renderInline(part.slice(2, -2), key)}
        </strong>
      );
    }
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
      return (
        <em key={key} className="italic">
          {renderInline(part.slice(1, -1), key)}
        </em>
      );
    }
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (link) {
      return (
        <a
          key={key}
          href={link[2]}
          target="_blank"
          rel="noreferrer noopener"
          className="underline decoration-signal/50 underline-offset-2 hover:text-signal"
        >
          {link[1]}
        </a>
      );
    }
    // Plain text run: a single \n inside a paragraph is a soft break, not a new block.
    const chunks = part.split("\n");
    return chunks.map((chunk, j) => (
      <span key={`${key}-${j}`}>
        {chunk}
        {j < chunks.length - 1 && <br />}
      </span>
    ));
  });
}

/**
 * One block of the model's answer, laid out so it can be read rather than parsed.
 *
 * Two shapes the model produces constantly used to come out as a single run-on
 * paragraph, and both are fixed here by walking the lines instead of testing the
 * whole block at once.
 *
 * A lead-in followed by bullets ("Here is the plan:" then three dashed lines) was
 * the worse of the two: the old check required *every* line in the block to be a
 * list item, so one sentence of introduction turned the entire list into prose
 * with stray hyphens in the middle of it. And a paragraph written with single
 * newlines lost every one of them, so three stops on three lines arrived as one
 * wall of text. A step-free itinerary is a sequence, and a sequence that does not
 * look like one is the hardest kind of answer to follow while standing on a
 * platform.
 */
function renderMarkdownBlock(block: string, keyPrefix: string): ReactNode {
  const lines = block.split("\n");

  if (lines[0].trim().startsWith("```")) {
    const closingIndex = lines.slice(1).findIndex((l) => l.trim().startsWith("```"));
    const body = closingIndex === -1 ? lines.slice(1) : lines.slice(1, 1 + closingIndex);
    return (
      <pre key={keyPrefix} className="my-1.5 overflow-x-auto rounded-lg bg-ink/[0.06] px-3 py-2 font-mono text-[12.5px] leading-relaxed text-ink">
        <code>{body.join("\n")}</code>
      </pre>
    );
  }

  const BULLET = /^\s*[-*]\s+/;
  const ORDERED = /^\s*\d+[.)]\s+/;
  type Kind = "bullet" | "ordered" | "text";
  const kindOf = (l: string): Kind => (BULLET.test(l) ? "bullet" : ORDERED.test(l) ? "ordered" : "text");

  // Consecutive lines of the same kind form a run. A run of list lines becomes a
  // list; a run of text lines becomes one paragraph whose single newlines are
  // kept as line breaks.
  const runs: { kind: Kind; lines: string[] }[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const kind = kindOf(line);
    const last = runs[runs.length - 1];
    if (last && last.kind === kind) last.lines.push(line);
    else runs.push({ kind, lines: [line] });
  }
  if (runs.length === 0) return null;

  const nodes = runs.map((run, r) => {
    const key = `${keyPrefix}-${r}`;
    if (run.kind === "text") {
      const heading = run.lines.length === 1 ? run.lines[0].match(/^(#{1,6})\s+(.*)$/) : null;
      if (heading) {
        const size = heading[1].length <= 2 ? "text-[16px] font-bold" : "text-[15px] font-semibold";
        return (
          <p key={key} className={`mb-1 mt-2 first:mt-0 ${size} text-ink`}>
            {renderInline(heading[2], key)}
          </p>
        );
      }
      return (
        <p key={key} className="mb-2 last:mb-0">
          {run.lines.map((l, i) => (
            <span key={i}>
              {i > 0 && <br />}
              {renderInline(l, `${key}-${i}`)}
            </span>
          ))}
        </p>
      );
    }
    const items = run.lines.map((l) => l.replace(/^\s*(?:[-*]|\d+[.)])\s+/, ""));
    const ListTag: "ul" | "ol" = run.kind === "bullet" ? "ul" : "ol";
    return (
      // Roomier than it was. These carry the stops of a journey, and 2px between
      // two lines that each name a station reads as one paragraph, not two steps.
      <ListTag
        key={key}
        className={`my-2 space-y-1.5 pl-5 ${run.kind === "bullet" ? "list-disc" : "list-decimal"} marker:text-ink-faint`}
      >
        {items.map((item, i) => (
          <li key={i} className="pl-0.5">
            {renderInline(item, `${key}-li-${i}`)}
          </li>
        ))}
      </ListTag>
    );
  });

  return nodes.length === 1 ? nodes[0] : <div key={keyPrefix}>{nodes}</div>;
}

function Markdown({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter((b) => b.trim());
  // Only a block that says it is the conclusion gets drawn as one.
  //
  // This used to fall back to highlighting the last block whenever the model had
  // not labelled one, and that was a claim the renderer was in no position to
  // make: the last paragraph of an answer is as often a caveat, a source line or
  // a list of side notes as it is the verdict, and the box says "this is the
  // point". A 20-line paragraph came out as one, which is how it was found.
  // Same defect as every other summary in this repo that asserted more than its
  // input supported, and the fix is the same: assert only what is marked.
  const highlit = new Set(
    blocks
      .map((b, i) => ({ b, i }))
      // A verdict is short. Anything longer is a section, and boxing a section in
      // bold text is just shouting.
      .filter(({ b }) => looksLikeConclusion(b) && b.trim().split("\n").length <= 3)
      .map(({ i }) => i),
  );

  return blocks.map((block, i) => {
    const rendered = renderMarkdownBlock(block, `md-${i}`);
    if (!highlit.has(i)) return rendered;
    return (
      <div
        key={`hl-${i}`}
        className="my-1 rounded-lg border border-signal/30 bg-signal/10 px-3 py-2 font-semibold text-ink shadow-[inset_3px_0_0_var(--color-signal)] [&>*]:my-0"
      >
        {rendered}
      </div>
    );
  });
}

function routesHref(lang: Lang) {
  return `/routes?lang=${lang}`;
}

function Logo({ w = 20 }: { w?: number }) {
  const h = Math.round((w * 26) / 22);
  return (
    <svg width={w} height={h} viewBox="0 0 22 26" fill="none" aria-hidden>
      <path d="M6 3v20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="6" cy="8" r="3" fill="currentColor" />
      <path d="M12 15h7m0 0-3-3m3 3-3 3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The assistant's face in the transcript. It is the product's own step-free
 *  glyph rather than a stock robot: the mark already means "a way through
 *  without stairs", which is exactly what the assistant is answering. */
function AssistantAvatar() {
  const { t } = useI18n();
  return (
    <span
      className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-navy text-paper ring-1 ring-ink/10"
      title={t("assistant_name")}
      aria-label={t("assistant_name")}
      role="img"
    >
      <Logo w={13} />
    </span>
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

/** Splits an answer into text runs and route cards, from either marker:
 *  [[route:id(:profile)]] for a walked route, [[plan:A|B]] for a computed one.
 *  Always hides a half-streamed trailing marker; an unknown id is dropped. */
const MARKER = /(\[\[route:[\w-]+(?::[\w-]+)?\]\]|\[\[plan:[^|\]]{1,60}\|[^|\]]{1,60}\]\])/g;

/** `latest` reaches the route cards so the newest answer shows its map without a
 *  click while the ones scrolled above it release theirs. */
function renderAnswer(content: string, profiles: ProfileId[], latest: boolean) {
  const clean = content.replace(/\[\[[^\]]*$/, "");
  const parts = clean.split(MARKER);
  return parts.map((p, i) => {
    const planned = p.match(/^\[\[plan:([^|\]]+)\|([^|\]]+)\]\]$/);
    if (planned) {
      return (
        <ChatRouteCard
          key={i}
          from={planned[1].trim()}
          to={planned[2].trim()}
          profile={profiles}
          latest={latest}
        />
      );
    }
    const m = p.match(/^\[\[route:([\w-]+)(?::([\w-]+))?\]\]$/);
    if (m) {
      // Unknown id (model typo/hallucination): drop it silently rather than echo
      // the raw [[route:...]] protocol syntax into the demo. Prose still renders.
      if (ROUTE_ID_SET.has(m[1])) {
        return <ChatRouteCard key={i} id={m[1]} profile={m[2] ? [m[2]] : profiles} latest={latest} />;
      }
      return null;
    }
    if (!p) return null;
    return (
      <div key={i} className="break-words">
        <Markdown text={p} />
      </div>
    );
  });
}

/** The reasoning stream is the model's raw thought; strip the app-internal
 *  [[route:…]] markers (and any half-streamed trailing one) so the panel reads
 *  as pure accessibility reasoning, not leaked protocol syntax. */
function cleanReasoning(text: string): string {
  return text
    .replace(/\[\[[^\]]*\]\]/g, "")
    .replace(/\[\[[^\]]*$/, "")
    .replace(/[ \t]{2,}/g, " ");
}

function Reasoning({
  text,
  streaming,
  hasContent,
  isLast,
}: {
  text: string;
  streaming: boolean;
  hasContent: boolean;
  isLast: boolean;
}) {
  const { t } = useI18n();
  const thinking = streaming && !hasContent;
  // Latest answer stays open so the juror can read the agent weigh accessibility;
  // older answers collapse once, when their content has settled.
  const [open, setOpen] = useState(true);
  const collapsedOnce = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  // Names the panel this toggle owns. aria-expanded alone tells a screen reader
  // that something is collapsed without telling it what, so there is nothing to
  // move to.
  const panelId = useId();

  useEffect(() => {
    if (!isLast && hasContent && !collapsedOnce.current) {
      collapsedOnce.current = true;
      setOpen(false);
    }
  }, [hasContent, isLast]);

  useEffect(() => {
    if (open && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [text, open]);

  return (
    <div className="mb-2 rounded-lg border border-ink/12 bg-ink/[0.025]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-9 w-full items-center gap-1.5 px-3 py-1.5 text-left text-[12px] font-semibold text-ink-soft hover:text-ink"
        aria-expanded={open}
        // Only while the panel is really there. The body unmounts when collapsed,
        // and aria-controls pointing at an id that does not exist is a broken
        // reference, which is worse than not claiming one.
        aria-controls={open ? panelId : undefined}
      >
        <ChevronRight size={13} strokeWidth={2.4} className={`transition-transform ${open ? "rotate-90" : ""}`} aria-hidden />
        {thinking ? t("chat_thinking") : t("chat_reasoning")}
        {thinking && (
          <span className="ml-0.5 flex gap-0.5" aria-hidden>
            <span className="h-1 w-1 animate-pulse rounded-full bg-signal [animation-delay:0ms]" />
            <span className="h-1 w-1 animate-pulse rounded-full bg-signal [animation-delay:150ms]" />
            <span className="h-1 w-1 animate-pulse rounded-full bg-signal [animation-delay:300ms]" />
          </span>
        )}
      </button>
      {open && (
        <div id={panelId} ref={bodyRef} className="max-h-48 overflow-y-auto border-t border-ink/10 px-3 py-2">
          <p className="whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-ink-soft">{cleanReasoning(text)}</p>
        </div>
      )}
    </div>
  );
}

function ThinkingDots() {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft">
      <span className="flex gap-1" aria-hidden>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal [animation-delay:300ms]" />
      </span>
      {t("chat_thinking")}
    </span>
  );
}

/** One message row. Memoised so a streamed token only re-renders the live message,
 *  not every prior answer + its route card. */
const MessageItem = memo(function MessageItem({
  message,
  streaming,
  isLast,
  profiles,
  index,
  speak,
  stopSpeak,
  speakingKey,
  speechSupported,
}: {
  message: Msg;
  streaming: boolean;
  isLast: boolean;
  profiles: ProfileId[];
  index: number;
  speak: (key: number, text: string, lang: Lang) => void;
  stopSpeak: () => void;
  speakingKey: number | null;
  speechSupported: boolean;
}) {
  const { t, lang } = useI18n();
  if (message.role === "user") {
    return (
      <li className="flex justify-end">
        <div className="max-w-[85%] break-words rounded-2xl rounded-br-md bg-surface-2 px-4 py-2.5 text-[14px] leading-relaxed text-ink ring-1 ring-ink/8">
          {message.content}
        </div>
      </li>
    );
  }
  const speaking = speakingKey === index;
  // The settled answer is announced once via the shell's single live region, so
  // the streaming text itself is NOT a live region (avoids token-by-token noise).
  return (
    <li className="flex max-w-[92%] gap-2.5">
      <AssistantAvatar />
      <div className="min-w-0 flex-1">
      {message.reasoning && (
        <Reasoning text={message.reasoning} streaming={streaming} hasContent={!!message.content} isLast={isLast} />
      )}
      {message.content ? (
        <>
          <div className="text-[15px] leading-relaxed text-ink">
            {renderAnswer(message.content, profiles, isLast)}
          </div>
          {speechSupported && !streaming && (
            <button
              onClick={() => (speaking ? stopSpeak() : speak(index, message.content, lang))}
              aria-label={speaking ? t("stop_reading") : t("read_aloud")}
              aria-pressed={speaking}
              className="mt-1 inline-flex min-h-9 items-center rounded-lg px-1.5 text-ink-soft transition-colors hover:text-ink"
            >
              {speaking ? (
                <VolumeX size={16} strokeWidth={2.2} aria-hidden />
              ) : (
                <Volume2 size={16} strokeWidth={2.2} aria-hidden />
              )}
            </button>
          )}
        </>
      ) : (
        streaming && !message.reasoning && <ThinkingDots />
      )}
      </div>
    </li>
  );
});

export default function ChatShell() {
  const { t, lang } = useI18n();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  // "rate" is the abuse guard answering 429, which needs its own copy: the
  // generic failure line plus a Retry that fails again reads as a dead app.
  // `truncated` = the answer stopped before the server said it was finished.
  // `cut` = the model finished but hit its own token ceiling mid-sentence. The two
  // are different facts and the reader gets told which one happened.
  const [error, setError] = useState<null | "generic" | "rate" | "truncated" | "cut">(null);
  const [tookLong, setTookLong] = useState(false);
  // A set. Empty means the traveller has not said, which the router reads as the
  // strictest profile rather than the loosest.
  const [profiles, setProfiles] = useState<ProfileId[]>([]);
  const [announce, setAnnounce] = useState("");

  const speech = useSpeechOutput();
  const handleVoiceText = useCallback((text: string) => setInput(text), []);
  const voice = useSpeechInput(lang, handleVoiceText);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pinnedRef = useRef(true);
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const longTimerRef = useRef<number | null>(null);
  const lastReqRef = useRef<{ history: Msg[]; assistantIndex: number } | null>(null);

  // Keep the conversation when the traveller opens /routes and comes back.
  // Restored after mount rather than in useState's initialiser, which would
  // desync SSR hydration.
  useEffect(() => {
    try {
      const saved = readStored();
      if (!saved) return;
      if (saved.messages.length) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMessages(saved.messages);
      }
      if (saved.profiles.length) {
        setProfiles(saved.profiles);
      }
    } catch {
      // Corrupt or blocked storage is never worth breaking the chat over.
    }
  }, []);

  // What to write, kept current so that the two writers below do not need the
  // render's closure: `pagehide` fires once, from a listener registered once, and
  // a stale closure there would save the conversation as it was when the tab
  // loaded.
  const stateRef = useRef({ messages, profiles });
  stateRef.current = { messages, profiles };

  // Save once a turn settles, not on every streamed token.
  useEffect(() => {
    if (streaming) return;
    writeStored(messages, profiles);
  }, [messages, profiles, streaming]);

  // And save on the way out, mid-answer included.
  //
  // This is the bug behind "my conversation was not there when I came back". The
  // effect above deliberately skips a streaming turn, so a traveller who opened
  // /whats-on while an answer was still arriving had nothing written: on a first
  // question there was nothing stored at all, and the app they returned to was the
  // home screen, as though they had never asked. `pagehide` covers a link, the
  // back button and closing the tab; `visibilitychange` covers iOS, which can
  // discard a backgrounded tab without ever firing `pagehide`.
  useEffect(() => {
    const save = () => writeStored(stateRef.current.messages, stateRef.current.profiles);
    const onHidden = () => {
      if (document.visibilityState === "hidden") save();
    };
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", onHidden);
      save();
    };
  }, []);

  // Keyboard-aware height: drive --app-h from the visual viewport so the composer
  // stays above the iOS keyboard (Android is handled by interactiveWidget).
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const set = () => {
      // height drives the shell size; offsetTop pins it to the visual viewport so
      // iOS scroll-into-view can't push the composer out of view (see .h-app).
      document.documentElement.style.setProperty("--app-h", vv.height + "px");
      document.documentElement.style.setProperty("--app-top", vv.offsetTop + "px");
    };
    set();
    vv.addEventListener("resize", set);
    vv.addEventListener("scroll", set);
    return () => {
      vv.removeEventListener("resize", set);
      vv.removeEventListener("scroll", set);
    };
  }, []);

  // Grow the composer with what is being typed, up to the same cap the class
  // already sets. Without this the box is one line tall forever: "Gare de Lyon
  // to the Eiffel Tower, no stairs, and she tires quickly" is four lines of
  // text shown through a one-line window, and the traveller cannot see the
  // start of their own sentence. Done in JS rather than with field-sizing
  // because that property is still missing in Safari and Firefox, and the
  // phone in the demo is an iPhone. Voice dictation lands in the same state,
  // so it grows the box too.
  // The ceiling is measured in lines rather than pixels because a pixel cap cuts
  // the last line through the middle of the letters, which reads as broken rather
  // than as scrollable. Four lines is where it stops growing and starts scrolling.
  const MAX_COMPOSER_LINES = 4;
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const line = parseFloat(cs.lineHeight) || 24;
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, line * MAX_COMPOSER_LINES + pad) + "px";
  }, [input]);

  // Only auto-scroll when the user is already at the bottom; instant during a
  // stream so it never fights a finger scrolling up to read.
  useEffect(() => {
    if (pinnedRef.current) bottomRef.current?.scrollIntoView({ block: "end", behavior: streaming ? "auto" : "smooth" });
  }, [messages, streaming]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function stream(history: Msg[], assistantIndex: number) {
    setError(null);
    setStreaming(true);
    setTookLong(false);
    busyRef.current = true;
    lastReqRef.current = { history, assistantIndex };
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    longTimerRef.current = window.setTimeout(() => setTookLong(true), 15000);

    const patch = (kind: "content" | "reasoning", chunk: string) =>
      setMessages((prev) => {
        const next = [...prev];
        const m = next[assistantIndex];
        if (m) next[assistantIndex] = { ...m, [kind]: m[kind] + chunk };
        return next;
      });
    const firstToken = () => {
      if (longTimerRef.current) {
        clearTimeout(longTimerRef.current);
        longTimerRef.current = null;
      }
      setTookLong(false);
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          profile: profiles,
        }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        setError(res.status === 429 ? "rate" : "generic");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      let received = false;
      /** The server's end-of-answer sentinel. Its absence is the only signal that
       *  an answer which looks finished is not. */
      let sawDone = false;
      let cut = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let obj: { type: string; text: string };
          try {
            obj = JSON.parse(line);
          } catch {
            continue;
          }
          if (obj.type === "content") {
            firstToken();
            received = true;
            acc += obj.text;
            patch("content", obj.text);
          } else if (obj.type === "reasoning") {
            firstToken();
            received = true;
            patch("reasoning", obj.text);
          } else if (obj.type === "done") {
            sawDone = true;
            // The model stopped because it ran out of its token allowance, so the
            // answer really does end mid-sentence. Saying so beats leaving the
            // reader to wonder whether that was the end of the thought.
            if ((obj as { finish?: string }).finish === "length") cut = true;
          } else if (obj.type === "truncated") {
            sawDone = false;
          } else if (obj.type === "error") {
            setError("generic");
          }
        }
      }
      // An upstream that dies before its first token (a killed function, a dropped
      // connection) still ends the stream cleanly, which would otherwise settle as
      // a blank answer with no error and no Retry to get out of it.
      if (!received) setError("generic");
      // And an upstream that dies *after* its first token used to be worse: it left
      // a half-written answer, or a chain of reasoning stopped mid-thought, with no
      // error, no Retry, and nothing to say the answer was not simply short. The
      // server now ends a whole answer with a sentinel, so its absence is proof of
      // truncation rather than a guess about one.
      else if (!sawDone) setError("truncated");
      else if (cut) setError("cut");
      // Announce the settled answer once via the shell's live region, put through
      // the same markdown-to-speech pass as read-aloud: a screen reader is handed
      // this string verbatim and would otherwise spell out every cited URL.
      setAnnounce(speakable(acc));
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setError("generic");
    } finally {
      if (longTimerRef.current) {
        clearTimeout(longTimerRef.current);
        longTimerRef.current = null;
      }
      setStreaming(false);
      setTookLong(false);
      busyRef.current = false;
      abortRef.current = null;
    }
  }

  function send(text: string) {
    const clean = text.trim();
    if (!clean || busyRef.current) return;
    speech.stop();
    const history: Msg[] = [...messages, { role: "user", content: clean, reasoning: "" }];
    const assistantIndex = history.length;
    setMessages([...history, { role: "assistant", content: "", reasoning: "" }]);
    // Written now rather than when the turn settles. A traveller's own question is
    // the one thing in this app they typed themselves, and losing it because the
    // answer to it never arrived is the worst way to fail.
    writeStored(history, profiles);
    setInput("");
    pinnedRef.current = true;
    stream(history, assistantIndex);
  }

  function retry() {
    const req = lastReqRef.current;
    if (!req || busyRef.current) return;
    setMessages((prev) => {
      const next = [...prev];
      if (next[req.assistantIndex]) next[req.assistantIndex] = { role: "assistant", content: "", reasoning: "" };
      return next;
    });
    pinnedRef.current = true;
    stream(req.history, req.assistantIndex);
  }

  const empty = messages.length === 0;
  const last = messages[messages.length - 1];
  const showTakingLong = streaming && tookLong && last?.role === "assistant" && !last.content && !last.reasoning;

  /**
   * The one place a person types, built once and rendered in one of two places.
   *
   * On an empty screen it sits directly under the headline, because that screen's
   * single job is to get a destination typed and a docked grey strip at the bottom
   * of the viewport is not where a first-time visitor looks for it. The previous
   * version needed a sentence of instructions saying "the box is at the bottom of
   * the screen", which is the tell: a control that has to be explained is a control
   * in the wrong place. Once there is a conversation it docks, because then the
   * screen's job is reading the answer and the input is a tool you return to.
   *
   * One instance either way, so the ref, the focus and the `composer-disclaimer`
   * id it points at are never duplicated.
   */
  /**
   * Provenance, addressed by the input through `aria-describedby`.
   *
   * Separate from the composer because the two want different places: on an empty
   * screen the input belongs under the headline and this belongs at the foot of the
   * page, where fine print goes. Between the two it read as a legal notice
   * interrupting the flow one line after somebody had been invited to type. An id
   * resolves anywhere in the document, so the screen-reader association survives
   * the split.
   */
  const composerFoot = (
      <p id="composer-disclaimer" className="mt-1.5 px-1 text-[11px] text-ink-soft">
        {t("disclaimer")}
        {/* The gap sentence from sm up only. On a phone the pair ran to four
            lines of fine print under the input, which is noise at the moment
            somebody wants to type. /how-it-works carries it at every width. */}
        <span className="hidden sm:inline"> {t("disclaimer_gap")}</span>
      </p>
  );

  const composer = (
    <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2 rounded-2xl border border-ink/15 bg-surface-2 p-1.5 pl-3.5 focus-within:border-signal/60"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              aria-label={t("chat_input_label")}
              // The line under the composer names what the answers rest on and
              // the one thing they cannot tell you. That is a caveat about the
              // answers, so it belongs to the box you type in, not to a paragraph
              // a screen reader may never reach.
              aria-describedby="composer-disclaimer"
              placeholder={t("chat_placeholder")}
              className="flex-1 resize-none bg-transparent py-2.5 text-[16px] leading-relaxed text-ink outline-none placeholder:text-ink-soft/70"
            />
            {voice.supported && !streaming && (
              <button
                type="button"
                onClick={() => (voice.listening ? voice.stop() : voice.start())}
                aria-label={voice.listening ? t("voice_listening") : t("voice_input")}
                aria-pressed={voice.listening}
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-colors ${
                  voice.listening ? "animate-pulse bg-barrier text-white" : "bg-ink/8 text-ink hover:bg-ink/12"
                }`}
              >
                <Mic size={18} strokeWidth={2.2} aria-hidden />
              </button>
            )}
            {streaming ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                aria-label={t("chat_stop")}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-barrier text-white transition-colors hover:bg-barrier/90"
              >
                <Square size={15} strokeWidth={2.4} fill="currentColor" aria-hidden />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                aria-label={t("chat_send")}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-signal text-canvas transition-colors hover:bg-signal/90 disabled:opacity-30"
              >
                <ArrowUp size={18} strokeWidth={2.4} aria-hidden />
              </button>
            )}
          </form>
          {/* Why the microphone stopped, when it stops for a reason a person can
              act on. It used to fail in silence: the button lit, went dark, and
              the browser's own diagnosis was discarded in `onerror`. */}
          {voice.error && (
            <p role="status" className="mt-1.5 px-1 text-[12px] font-semibold text-barrier-ink">
              {voice.error === "not-allowed" || voice.error === "service-not-allowed"
                ? t("voice_err_denied")
                : voice.error === "audio-capture"
                  ? t("voice_err_capture")
                  : voice.error === "network"
                    ? t("voice_err_network")
                    : `${t("voice_err_other")} ${voice.error}`}
            </p>
          )}

    </>
  );

  return (
    <div className="flex h-app flex-col overflow-hidden bg-paper">
      {/* header */}
      <header className="z-20 shrink-0 border-b border-white/5 bg-navy pt-[env(safe-area-inset-top)] text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2.5">
          {/* The shell is overflow-hidden, so anything that cannot shrink gets
              silently clipped on a narrow phone. Let the wordmark absorb the
              squeeze and keep the controls whole. */}
          <div className="flex min-w-0 items-center gap-2.5">
            <Logo />
            <span className="min-w-0 leading-none">
              <span className="block truncate font-display text-[18px] font-bold tracking-tight">Voie Libre</span>
              <span className="hidden text-[11px] text-white/65 sm:block">{t("brand_tag")}</span>
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {/* Once the conversation starts the empty-state weather chip is gone,
                so keep live weather visible here (desktop, where there is room).
                The visibility lives on this wrapper, not on the chip: the chip sets
                its own `inline-flex`, and a `hidden` passed down through className
                loses to it, because which display utility wins is decided by the
                order Tailwind emits them, not the order they appear in the class
                attribute. Hiding the wrapper cannot collide with anything. */}
            {!empty && (
              <span className="hidden lg:contents">
                <WeatherChip variant="dark" />
              </span>
            )}
            {!empty && (
              <button
                onClick={() => {
                  if (streaming) return;
                  speech.stop();
                  setMessages([]);
                  setAnnounce("");
                }}
                className="grid min-h-11 min-w-11 place-items-center rounded-lg bg-white/10 px-2 text-[13px] font-semibold text-white/80 transition-colors hover:text-white disabled:opacity-40 sm:flex sm:w-auto sm:items-center sm:gap-1"
                disabled={streaming}
                aria-label={t("chat_new")}
              >
                <Plus size={16} strokeWidth={2.4} aria-hidden />
                <span className="hidden sm:inline">{t("chat_new")}</span>
              </button>
            )}
            {/* Navigation belongs where a person looks for it. These three were
                a loose row of links sitting between the example prompts and the
                composer, competing with the one control the screen exists for.
                From lg up they are here; below lg the empty state keeps them, and
                the map is the one destination that stays in the header at every
                width because it is the second surface, not a supporting page. */}
            <nav aria-label={t("nav_group")} className="hidden items-center gap-0.5 lg:flex">
              {[
                { href: "/whats-on", label: t("whats_on_link") },
                { href: "/how-it-works", label: t("hiw_link") },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="flex min-h-11 items-center rounded-lg px-2.5 text-[13px] font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            <Link
              href={routesHref(lang)}
              className="flex min-h-11 items-center gap-1 rounded-lg bg-white/10 px-2.5 text-[13px] font-semibold text-white/80 transition-colors hover:text-white"
              aria-label={t("routes_link")}
            >
              <MapIcon size={16} strokeWidth={2.2} aria-hidden />
              <span className="hidden sm:inline">{t("routes_link")}</span>
            </Link>
            {/* The code lives here as well as in the doors below, because the doors
                are past the fold and this is the one link somebody reaches for while
                standing in front of a room. Icon only: it is a utility, not a
                destination, and it should not compete with the map. */}
            <Link
              href="/qr"
              className="grid min-h-11 min-w-11 place-items-center rounded-lg bg-white/10 text-white/80 transition-colors hover:text-white"
              aria-label={t("qr_link")}
              title={t("qr_link")}
            >
              <QrCode size={16} strokeWidth={2.2} aria-hidden />
            </Link>
            <LangSwitch />
          </div>
        </div>
      </header>

      {/* conversation */}
      {/* No aria-label here. There is one main region, and the log inside already
          carries this exact name, so labelling both made a screen reader say it
          twice on the way in. */}
      <main ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-5xl px-4 py-6">
          {empty ? (
            <EmptyState
              profiles={profiles}
              setProfiles={setProfiles}
              onSend={send}
              composer={composer}
              composerFoot={composerFoot}
            />
          ) : (
            <>
              <h1 className="sr-only">Voie Libre</h1>
              {/* The frame is wide so the empty state can use it; a conversation
                  cannot. Prose set across 1000px is unreadable, so the log keeps
                  its own measure inside the wider shell. */}
              <ul role="log" aria-label={t("conversation_label")} className="mx-auto max-w-3xl space-y-5">
                {messages.map((m, i) => (
                  <MessageItem
                    key={i}
                    message={m}
                    streaming={streaming && i === messages.length - 1 && m.role === "assistant"}
                    isLast={i === messages.length - 1}
                    profiles={profiles}
                    index={i}
                    speak={speech.speak}
                    stopSpeak={speech.stop}
                    speakingKey={speech.speakingKey}
                    speechSupported={speech.supported}
                  />
                ))}
                {/* Announced, not just drawn: this line appears fifteen seconds
                    into a wait with nothing else on the screen, so for anyone not
                    watching the screen it is the only sign the app is still alive. */}
                {showTakingLong && (
                  <li role="status" className="text-[13px] text-ink-soft">
                    {t("chat_taking_longer")}
                  </li>
                )}
                {/* A cut answer is not a failed one: it is there, it is just
                    shorter than the model intended, so it reads as a note and
                    offers no Retry, which would only hit the same ceiling. A
                    truncated one lost part of itself and Retry is the way out. */}
                {error && (
                  <li
                    role={error === "cut" ? "status" : "alert"}
                    className={`flex flex-wrap items-center gap-2 text-[13px] ${
                      error === "cut" ? "text-ink-soft" : "text-barrier"
                    }`}
                  >
                    {t(
                      error === "rate"
                        ? "chat_error_busy"
                        : error === "truncated"
                          ? "chat_error_truncated"
                          : error === "cut"
                            ? "chat_error_cut"
                            : "chat_error",
                    )}
                    {error !== "cut" && (
                      <button
                        onClick={retry}
                        className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-barrier/40 px-2.5 font-semibold text-barrier hover:bg-barrier/5"
                      >
                        <RotateCcw size={13} strokeWidth={2.4} aria-hidden />
                        {t("chat_retry")}
                      </button>
                    )}
                  </li>
                )}
              </ul>
              {/* Scroll sentinel. It sits outside the list because a bare div
                  among the <li> children breaks the log's list semantics. */}
              <div ref={bottomRef} />
            </>
          )}
        </div>
      </main>

      {/* single polite live region: announces the settled answer once to screen readers */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announce}
      </div>

      {/* Docked, and only once there is something above it to read. */}
      {!empty && (
        <div className="shrink-0 border-t border-ink/10 bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="mx-auto w-full max-w-5xl px-4 py-3">
            {composer}
            {composerFoot}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({
  profiles,
  setProfiles,
  onSend,
  composer,
  composerFoot,
}: {
  profiles: ProfileId[];
  setProfiles: (p: ProfileId[]) => void;
  onSend: (text: string) => void;
  /** The real input, rendered here rather than docked at the bottom. */
  composer: ReactNode;
  /** Its provenance line, which belongs at the foot of the page. */
  composerFoot: ReactNode;
}) {
  const { t, lang } = useI18n();

  return (
    <div className="relative pt-3">
      <h1 className="sr-only">Voie Libre</h1>

      {/* Only the hero and the rail are two columns. Wrapping the whole screen in
          the grid left the right side blank from the bottom of the rail all the way
          down past the examples, because the rail is short and the left column is
          not. Everything below is full width and lines up with the composer, which
          is the edge a person's eye is already following. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start lg:gap-x-10">
      <div className="min-w-0">

      {/* Hero: the product's own transit language as the opening thesis, on bare
          paper (not another white card), with a whisper of the unknown-hatch behind. */}
      <section className="relative">
        <div className="hatch-whisper pointer-events-none absolute -right-4 -top-4 h-32 w-56 rounded-3xl" aria-hidden />
        <div className="relative">
          <h2 className="max-w-2xl text-balance font-display text-[34px] font-extrabold leading-[1.02] tracking-tight text-ink sm:text-[54px]">
            {t("chat_intro_title")}
          </h2>
          <p className="mt-3.5 max-w-md text-[15px] leading-relaxed text-ink-soft">{t("chat_intro_body")}</p>
          {/* The drawing, on its own.
              It used to carry a two-item legend and an inline 59.6% figure beside
              it, and the three together read as a chart demanding to be decoded
              on the screen whose only job is to get a destination typed. The
              figure moved to the evidence rail, where it sits with the live lift
              count instead of competing with it, and the legend moved to
              /how-it-works, which is where the product's vocabulary belongs. What
              is left is a mark: the app's own transit language, once. */}
          {/* Small on purpose. Given the width of the left column it grew to about
              200 vertical pixels, which pushed the headline off the top of a laptop
              screen for a drawing that is a schematic rather than data. A mark
              earns its place by being a mark. */}
          {/* The input, first. Everything else on this screen is a way of helping
              somebody fill it in.

              The transit schematic that used to sit under here is gone. It had
              already lost its legend, which left a drawing that was not data
              illustrating nothing in particular, and once the input moved up it was
              stranded mid-page between the question and the profile chips. The
              screen's opening argument is now the headline plus a live count of
              lifts the operator says are broken, which is a stronger thesis than a
              diagram of a network we drew by hand. */}
          <div className="mt-5">{composer}</div>
        </div>
      </section>

      {/* Who is travelling, and what saying so changes. No step number: that was
          scaffolding around an input in the wrong place, and with the input under
          the headline this is what it always was, a modifier on the question above
          it. The row takes more than one answer, because people do. */}
      <div className="mt-7 flex flex-wrap items-baseline gap-x-2">
        <p className="text-[13px] font-semibold text-ink-soft">{t("profile_q")}</p>
        <span className="text-[12.5px] text-ink-soft/80">{t("profile_pick_hint")}</span>
      </div>
      <div className="mt-3">
        <ProfilePicker selected={profiles} onChange={setProfiles} />
      </div>

      </div>

      {/* The rail sets this grid row's height, so the profile chips live inside the
          left cell too: without them the column ran out of content halfway down and
          left a void under the input. */}
      <LiveRail />
      </div>

      {/* Try, one tidy list with a hover cue, not three identical tiles. */}
      <p className="mt-4 text-[12.5px] font-semibold text-ink-soft">{t("chat_try")}</p>
      <ul className="mt-3 divide-y divide-ink/8 overflow-hidden rounded-2xl border border-ink/10 bg-surface">
        {["chat_suggest_1", "chat_suggest_2", "chat_suggest_3"].map((k) => (
          <li key={k}>
            <button
              onClick={() => onSend(t(k))}
              className="group flex w-full touch-manipulation items-center gap-3 px-4 py-3.5 text-left text-[14px] text-ink/90 transition-colors hover:bg-surface-2"
            >
              <span className="min-w-0 flex-1 leading-snug">{t(k)}</span>
              <ArrowRight
                size={15}
                strokeWidth={2.4}
                aria-hidden
                className="shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-signal"
              />
            </button>
          </li>
        ))}
      </ul>

      {/* The doors, each with the one line that says what is behind it.
          These were four bare labels in a row ("Plan a journey on the map", "This
          week", "How this works", "Data and accessibility") and a first-time
          visitor could not tell what any of them contained, which is exactly the
          complaint. The row itself was also sitting directly above the composer,
          competing with the only control the screen exists for. Sentences cost
          three lines and buy the answer to "where is the information". */}
      <p className="mt-10 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-faint">
        {t("doors_title")}
      </p>
      <nav aria-label={t("nav_group")} className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {[
          { href: routesHref(lang), label: t("browse_routes"), body: t("door_routes") },
          { href: "/places", label: t("places_link"), body: t("door_places") },
          { href: "/whats-on", label: t("whats_on_link"), body: t("door_whats_on") },
          { href: "/how-it-works", label: t("hiw_link"), body: t("door_hiw") },
          { href: "/privacy", label: t("legal_link"), body: t("door_legal") },
          // Last, and worded for the only person it helps: somebody reading this on a
          // laptop who wants it in their hand, or wants to pass it to someone else.
          // "Open it on your phone" would be a strange thing to offer a phone.
          { href: "/qr", label: t("qr_link"), body: t("door_qr") },
        ].map((d) => (
          <Link
            key={d.href}
            href={d.href}
            className="group flex items-start gap-3 rounded-2xl border border-ink/10 bg-surface px-4 py-3 transition-colors hover:border-signal/50 hover:bg-surface-2"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold leading-snug text-ink">{d.label}</span>
              <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-soft">{d.body}</span>
            </span>
            <ArrowRight
              size={15}
              strokeWidth={2.4}
              aria-hidden
              className="mt-0.5 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-signal"
            />
          </Link>
        ))}
      </nav>

      <div className="mt-8">{composerFoot}</div>
    </div>
  );
}
