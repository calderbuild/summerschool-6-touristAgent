"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n, LANGS, type Lang } from "@/lib/i18n";
import ChatRouteCard from "./ChatRouteCard";
import { ArrowUp, ChevronRight, Plus, Accessibility } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; reasoning: string };

function Logo() {
  return (
    <svg width="20" height="24" viewBox="0 0 22 26" fill="none" aria-hidden>
      <path d="M6 3v20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="6" cy="8" r="3" fill="currentColor" />
      <path d="M12 15h7m0 0-3-3m3 3-3 3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LangSwitch() {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-white/10 p-0.5" role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button
          key={l.id}
          onClick={() => setLang(l.id as Lang)}
          aria-pressed={lang === l.id}
          aria-label={l.a11y}
          className={`min-h-8 rounded-md px-2.5 py-1 text-[13px] font-bold transition-colors ${
            lang === l.id ? "bg-white text-navy" : "text-white/75 hover:text-white"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

/** Splits an answer into text runs and [[route:id]] cards; hides a half-streamed marker. */
function renderAnswer(content: string, streaming: boolean) {
  const clean = streaming ? content.replace(/\[\[[^\]]*$/, "") : content;
  const parts = clean.split(/(\[\[route:[\w-]+\]\])/g);
  return parts.map((p, i) => {
    const m = p.match(/^\[\[route:([\w-]+)\]\]$/);
    if (m) return <ChatRouteCard key={i} id={m[1]} />;
    if (!p) return null;
    return (
      <span key={i} className="whitespace-pre-wrap">
        {p}
      </span>
    );
  });
}

function Reasoning({ text, streaming, hasContent }: { text: string; streaming: boolean; hasContent: boolean }) {
  const { t } = useI18n();
  const thinking = streaming && !hasContent;
  const [open, setOpen] = useState(thinking);
  const collapsedOnce = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  // auto-collapse once, the moment the final answer starts arriving
  useEffect(() => {
    if (hasContent && !collapsedOnce.current) {
      collapsedOnce.current = true;
      setOpen(false);
    }
  }, [hasContent]);

  // keep following the reasoning while it streams and the panel is open
  useEffect(() => {
    if (open && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [text, open]);

  return (
    <div className="mb-2 rounded-lg border border-ink/12 bg-ink/[0.025]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[12px] font-semibold text-ink/60 hover:text-ink"
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
          <p className="whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed text-ink/55">{text}</p>
        </div>
      )}
    </div>
  );
}

function ThinkingDots() {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-ink/50">
      <span className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal [animation-delay:300ms]" />
      </span>
      {t("chat_thinking")}
    </span>
  );
}

export default function ChatShell() {
  const { t } = useI18n();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || streaming) return;

    const history: Msg[] = [...messages, { role: "user", content: clean, reasoning: "" }];
    const assistantIndex = history.length;
    setMessages([...history, { role: "assistant", content: "", reasoning: "" }]);
    setInput("");
    setError(false);
    setStreaming(true);

    const patch = (kind: "content" | "reasoning", chunk: string) =>
      setMessages((prev) => {
        const next = [...prev];
        const m = next[assistantIndex];
        if (m) next[assistantIndex] = { ...m, [kind]: m[kind] + chunk };
        return next;
      });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.map((m) => ({ role: m.role, content: m.content })) }),
      });
      if (!res.ok || !res.body) throw new Error("bad response");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
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
          if (obj.type === "content") patch("content", obj.text);
          else if (obj.type === "reasoning") patch("reasoning", obj.text);
          else if (obj.type === "error") setError(true);
        }
      }
    } catch {
      setError(true);
    } finally {
      setStreaming(false);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-[100dvh] flex-col bg-paper">
      {/* header */}
      <header className="z-20 shrink-0 bg-navy text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="leading-none">
              <span className="block font-display text-[18px] font-bold tracking-tight">Voie Libre</span>
              <span className="block text-[11px] text-white/60">{t("brand_tag")}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!empty && (
              <button
                onClick={() => !streaming && setMessages([])}
                className="flex min-h-8 items-center gap-1 rounded-lg bg-white/10 px-2.5 text-[13px] font-semibold text-white/80 transition-colors hover:text-white disabled:opacity-40"
                disabled={streaming}
              >
                <Plus size={14} strokeWidth={2.4} aria-hidden />
                {t("chat_new")}
              </button>
            )}
            <LangSwitch />
          </div>
        </div>
      </header>

      {/* conversation */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6">
          {empty ? (
            <div className="pt-8">
              <span className="text-navy">
                <Accessibility size={30} strokeWidth={1.8} aria-hidden />
              </span>
              <h1 className="mt-3 max-w-lg font-display text-[26px] font-extrabold leading-tight tracking-tight text-ink sm:text-[30px]">
                {t("chat_intro_title")}
              </h1>
              <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-ink/65">{t("chat_intro_body")}</p>
              <div className="mt-5 grid gap-2 sm:max-w-xl">
                {["chat_suggest_1", "chat_suggest_2", "chat_suggest_3"].map((k) => (
                  <button
                    key={k}
                    onClick={() => send(t(k))}
                    className="rounded-xl border border-ink/12 bg-white px-4 py-3 text-left text-[14px] font-medium text-ink/80 transition-colors hover:border-navy/40 hover:text-ink"
                  >
                    {t(k)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ul className="space-y-5">
              {messages.map((m, i) => {
                const isLast = i === messages.length - 1;
                const isStreamingThis = streaming && isLast && m.role === "assistant";
                if (m.role === "user") {
                  return (
                    <li key={i} className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-navy px-4 py-2.5 text-[14px] leading-relaxed text-white">
                        {m.content}
                      </div>
                    </li>
                  );
                }
                return (
                  <li key={i} className="max-w-[92%]">
                    {m.reasoning && (
                      <Reasoning text={m.reasoning} streaming={isStreamingThis} hasContent={!!m.content} />
                    )}
                    {m.content ? (
                      <div className="text-[14.5px] leading-relaxed text-ink">
                        {renderAnswer(m.content, isStreamingThis)}
                      </div>
                    ) : (
                      isStreamingThis && !m.reasoning && <ThinkingDots />
                    )}
                  </li>
                );
              })}
              {error && <li className="text-[13px] text-barrier">{t("chat_error")}</li>}
              <div ref={bottomRef} />
            </ul>
          )}
        </div>
      </div>

      {/* composer */}
      <div className="shrink-0 border-t border-ink/10 bg-paper/95 backdrop-blur">
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
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder={t("chat_placeholder")}
              className="max-h-32 flex-1 resize-none bg-transparent py-2 text-[14.5px] leading-relaxed text-ink outline-none placeholder:text-ink/35"
            />
            <button
              type="submit"
              disabled={!input.trim() || streaming}
              aria-label={t("chat_send")}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-navy text-white transition-colors hover:bg-navy/90 disabled:opacity-30"
            >
              <ArrowUp size={18} strokeWidth={2.4} aria-hidden />
            </button>
          </form>
          <p className="mt-1.5 px-1 text-[11px] text-ink/40">{t("disclaimer")}</p>
        </div>
      </div>
    </div>
  );
}
