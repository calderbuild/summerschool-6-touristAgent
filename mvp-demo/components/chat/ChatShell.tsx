"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useI18n, LANGS, type Lang } from "@/lib/i18n";
import { ROUTES, type ProfileId } from "@/lib/data";
import { useSpeechInput, useSpeechOutput } from "@/lib/useSpeech";
import ChatRouteCard from "./ChatRouteCard";
import {
  ArrowUp,
  Square,
  ChevronRight,
  Plus,
  Accessibility,
  Baby,
  PersonStanding,
  BatteryLow,
  Map as MapIcon,
  RotateCcw,
  TriangleAlert,
  Mic,
  Volume2,
  VolumeX,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; reasoning: string };

const ROUTE_ID_SET = new Set(ROUTES.map((r) => r.id));

const PROFILE_META: { id: ProfileId; labelKey: string; icon: LucideIcon }[] = [
  { id: "wheelchair", labelKey: "profile_wheelchair", icon: Accessibility },
  { id: "stroller", labelKey: "profile_stroller", icon: Baby },
  { id: "senior", labelKey: "profile_senior", icon: PersonStanding },
  { id: "lowenergy", labelKey: "profile_lowenergy", icon: BatteryLow },
];

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

/** Splits an answer into text runs and [[route:id(:profile)]] cards. Always hides a
 *  half-streamed trailing marker; an unknown id falls back to visible text. */
function renderAnswer(content: string, streaming: boolean, profile: ProfileId | null) {
  const clean = content.replace(/\[\[[^\]]*$/, "");
  const parts = clean.split(/(\[\[route:[\w-]+(?::[\w-]+)?\]\])/g);
  return parts.map((p, i) => {
    const m = p.match(/^\[\[route:([\w-]+)(?::([\w-]+))?\]\]$/);
    if (m) {
      // Unknown id (model typo/hallucination): drop it silently rather than echo
      // the raw [[route:...]] protocol syntax into the demo. Prose still renders.
      if (ROUTE_ID_SET.has(m[1])) {
        return <ChatRouteCard key={i} id={m[1]} profile={m[2] ?? profile} />;
      }
      return null;
    }
    if (!p) return null;
    return (
      <span key={i} className="whitespace-pre-wrap break-words">
        {p}
      </span>
    );
  });
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
        <div ref={bodyRef} className="max-h-48 overflow-y-auto border-t border-ink/10 px-3 py-2">
          <p className="whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-ink-soft">{text}</p>
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
  profile,
  index,
  speak,
  stopSpeak,
  speakingKey,
  speechSupported,
}: {
  message: Msg;
  streaming: boolean;
  isLast: boolean;
  profile: ProfileId | null;
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
        <div className="max-w-[85%] break-words rounded-2xl rounded-br-md bg-navy px-4 py-2.5 text-[14px] leading-relaxed text-white">
          {message.content}
        </div>
      </li>
    );
  }
  const speaking = speakingKey === index;
  // The settled answer is announced once via the shell's single live region, so
  // the streaming text itself is NOT a live region (avoids token-by-token noise).
  return (
    <li className="max-w-[92%]">
      {message.reasoning && (
        <Reasoning text={message.reasoning} streaming={streaming} hasContent={!!message.content} isLast={isLast} />
      )}
      {message.content ? (
        <>
          <div className="text-[15px] leading-relaxed text-ink">
            {renderAnswer(message.content, streaming, profile)}
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
    </li>
  );
});

export default function ChatShell() {
  const { t, lang } = useI18n();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(false);
  const [tookLong, setTookLong] = useState(false);
  const [profile, setProfile] = useState<ProfileId | null>(null);
  const [announce, setAnnounce] = useState("");

  const speech = useSpeechOutput();
  const handleVoiceText = useCallback((text: string) => setInput(text), []);
  const voice = useSpeechInput(lang, handleVoiceText);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const longTimerRef = useRef<number | null>(null);
  const lastReqRef = useRef<{ history: Msg[]; assistantIndex: number } | null>(null);

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
    setError(false);
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
        body: JSON.stringify({ messages: history.map((m) => ({ role: m.role, content: m.content })), profile }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error("bad response");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
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
            acc += obj.text;
            patch("content", obj.text);
          } else if (obj.type === "reasoning") {
            firstToken();
            patch("reasoning", obj.text);
          } else if (obj.type === "error") {
            setError(true);
          }
        }
      }
      // Announce the settled answer once (markers stripped) via the shell's live region.
      setAnnounce(acc.replace(/\[\[[^\]]*\]\]/g, "").trim());
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setError(true);
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

  return (
    <div className="flex h-app flex-col overflow-hidden bg-paper">
      {/* header */}
      <header className="z-20 shrink-0 bg-navy pt-[env(safe-area-inset-top)] text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="leading-none">
              <span className="block font-display text-[18px] font-bold tracking-tight">Voie Libre</span>
              <span className="hidden text-[11px] text-white/65 sm:block">{t("brand_tag")}</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
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
            <Link
              href="/routes"
              className="flex min-h-11 items-center gap-1 rounded-lg bg-white/10 px-2.5 text-[13px] font-semibold text-white/80 transition-colors hover:text-white"
              aria-label={t("routes_link")}
            >
              <MapIcon size={16} strokeWidth={2.2} aria-hidden />
              <span className="hidden sm:inline">{t("routes_link")}</span>
            </Link>
            <LangSwitch />
          </div>
        </div>
      </header>

      {/* conversation */}
      <main ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto overscroll-contain" aria-label={t("conversation_label")}>
        <div className="mx-auto w-full max-w-3xl px-4 py-6">
          {empty ? (
            <EmptyState profile={profile} setProfile={setProfile} onSend={send} />
          ) : (
            <>
              <h1 className="sr-only">Voie Libre</h1>
              <ul role="log" aria-label={t("conversation_label")} className="space-y-5">
                {messages.map((m, i) => (
                  <MessageItem
                    key={i}
                    message={m}
                    streaming={streaming && i === messages.length - 1 && m.role === "assistant"}
                    isLast={i === messages.length - 1}
                    profile={profile}
                    index={i}
                    speak={speech.speak}
                    stopSpeak={speech.stop}
                    speakingKey={speech.speakingKey}
                    speechSupported={speech.supported}
                  />
                ))}
                {showTakingLong && <li className="text-[13px] text-ink-soft">{t("chat_taking_longer")}</li>}
                {error && (
                  <li role="alert" className="flex flex-wrap items-center gap-2 text-[13px] text-barrier">
                    {t("chat_error")}
                    <button
                      onClick={retry}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-barrier/40 px-2.5 font-semibold text-barrier hover:bg-barrier/5"
                    >
                      <RotateCcw size={13} strokeWidth={2.4} aria-hidden />
                      {t("chat_retry")}
                    </button>
                  </li>
                )}
                <div ref={bottomRef} />
              </ul>
            </>
          )}
        </div>
      </main>

      {/* single polite live region: announces the settled answer once to screen readers */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announce}
      </div>

      {/* composer */}
      <div className="shrink-0 border-t border-ink/10 bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-4 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2 rounded-2xl border border-ink/15 bg-white p-1.5 pl-3.5 focus-within:border-navy/50"
          >
            <textarea
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
              placeholder={t("chat_placeholder")}
              className="max-h-32 flex-1 resize-none bg-transparent py-2.5 text-[16px] leading-relaxed text-ink outline-none placeholder:text-ink-soft/70"
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
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-navy text-white transition-colors hover:bg-navy/90 disabled:opacity-30"
              >
                <ArrowUp size={18} strokeWidth={2.4} aria-hidden />
              </button>
            )}
          </form>
          <p className="mt-1.5 px-1 text-[11px] text-ink-soft">{t("disclaimer")}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  profile,
  setProfile,
  onSend,
}: {
  profile: ProfileId | null;
  setProfile: (p: ProfileId | null) => void;
  onSend: (text: string) => void;
}) {
  const { t } = useI18n();
  const demo = ROUTES[0];
  const barriers = demo.nodes.filter((n) => n.barrier).length;
  const unknowns = demo.nodes.filter((n) => n.at === "unknown").length;

  return (
    <div className="relative pt-6">
      <h1 className="sr-only">Voie Libre</h1>
      <span className="text-navy">
        <Logo w={52} />
      </span>
      <p className="mt-4 max-w-lg font-display text-[26px] font-extrabold leading-tight tracking-tight text-ink sm:text-[30px]">
        {t("chat_intro_title")}
      </p>
      <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-ink-soft">{t("chat_intro_body")}</p>

      {/* mobility profile — the personalization Google Maps can't do */}
      <p className="mt-6 text-[11px] font-bold uppercase tracking-wide text-ink-soft">{t("profile_q")}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:max-w-xl sm:grid-cols-4">
        {PROFILE_META.map((p) => {
          const Icon = p.icon;
          const on = profile === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setProfile(on ? null : p.id)}
              aria-pressed={on}
              className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-semibold transition-colors ${
                on ? "border-navy bg-navy text-white" : "border-ink/15 bg-white text-ink hover:border-navy/40"
              }`}
            >
              <Icon size={17} strokeWidth={2} aria-hidden className="shrink-0" />
              <span className="truncate">{t(p.labelKey)}</span>
            </button>
          );
        })}
      </div>

      {/* honest teaser: real step counts + honest unknowns, before you type */}
      <div className="mt-6 max-w-md rounded-xl border border-ink/12 bg-white p-3">
        <p className="text-[11px] text-ink-soft">{t("chat_example_intro")}</p>
        <p className="mt-1 font-display text-[14px] font-bold text-ink">
          {demo.from} <span className="text-ink/45" aria-hidden>→</span> {demo.to}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {barriers > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-barrier/10 px-2 py-1 text-[12px] font-bold text-barrier">
              <TriangleAlert size={12} strokeWidth={2.4} aria-hidden />
              {barriers} {t("verdict_barrier")}
            </span>
          )}
          {unknowns > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md border border-unknown/35 bg-unknown/5 px-2 py-1 text-[12px] font-semibold text-ink-soft">
              <span className="hatch-unknown inline-block h-2.5 w-2.5 rounded-[2px]" aria-hidden />
              {unknowns} {t("verdict_unknown")}
            </span>
          )}
        </div>
      </div>

      {/* quick starts */}
      <div className="mt-6 grid gap-2 sm:max-w-xl">
        {["chat_suggest_1", "chat_suggest_2", "chat_suggest_3"].map((k) => (
          <button
            key={k}
            onClick={() => onSend(t(k))}
            className="rounded-xl border border-ink/12 bg-white px-4 py-3 text-left text-[14px] font-medium text-ink/80 transition-colors hover:border-navy/40 hover:text-ink"
          >
            {t(k)}
          </button>
        ))}
      </div>

      {/* a plainly-labeled path to the route browser, so it is never a hidden feature */}
      <Link
        href="/routes"
        className="mt-6 inline-flex min-h-11 items-center gap-1.5 text-[13.5px] font-semibold text-signal transition-colors hover:text-navy"
      >
        {t("browse_routes")}
        <ArrowRight size={15} strokeWidth={2.4} aria-hidden />
      </Link>
    </div>
  );
}
