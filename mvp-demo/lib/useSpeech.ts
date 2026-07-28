"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Lang } from "./i18n";
import { speakable } from "./speakable";

// Feature detection that is SSR-safe (server snapshot = unsupported) and avoids
// setState-in-effect: the control simply appears after hydration where supported.
const noopSubscribe = () => () => {};
const serverUnsupported = () => false;

// Browser-native voice, no API key or cost. Both features are feature-detected
// and their controls are hidden where the browser does not support them, so we
// never show a button that cannot work (honest about capability).

const BCP47: Record<Lang, string> = { en: "en-US", fr: "fr-FR", zh: "zh-CN" };

// --- Minimal typing for the (still non-standard) SpeechRecognition API ---
interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
/** The spec calls this `SpeechRecognitionErrorEvent`; only `error` matters here.
 *  Values seen in the wild: `not-allowed` and `service-not-allowed` (permission),
 *  `audio-capture` (no usable microphone, which is what an input-device switch
 *  looks like), `network`, `no-speech`, `aborted`. */
interface RecognitionErrorEvent {
  error?: string;
}

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  start(): void;
  stop(): void;
  abort?(): void;
}
type RecognitionCtor = new () => RecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Voice input: transcribe speech into text in the given UI language.
 *
 * `error` exists because the previous version threw the reason away. `onerror`
 * set `listening` to false and did nothing else, so on a desktop where the
 * microphone was unavailable or permission had been refused the button lit up,
 * went dark, and said nothing at all. The user cannot distinguish that from a
 * broken product, and neither could we: the browser knows exactly which of
 * `not-allowed`, `audio-capture` and `network` happened, and it was being
 * discarded one line before it could be shown. Any code we have no wording for is
 * surfaced verbatim rather than hidden, because a code a person can read out is
 * worth more than a shrug.
 */
export function useSpeechInput(lang: Lang, onText: (text: string) => void) {
  const supported = useSyncExternalStore(noopSubscribe, () => !!recognitionCtor(), serverUnsupported);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<RecognitionLike | null>(null);
  /** Set while we are the ones stopping it, so a deliberate stop is not reported
   *  as a failure: `stop()` and `abort()` both fire `onerror` with `aborted`. */
  const stoppingRef = useRef(false);

  useEffect(() => () => recRef.current?.stop(), []);

  const stop = useCallback(() => {
    stoppingRef.current = true;
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    setError(null);
    stoppingRef.current = true;
    recRef.current?.stop();
    stoppingRef.current = false;
    const rec = new Ctor();
    rec.lang = BCP47[lang];
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) text += e.results[i][0].transcript;
      onText(text);
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
    };
    rec.onerror = (e) => {
      recRef.current = null;
      setListening(false);
      const code = e?.error ?? "unknown";
      // A stop we asked for is not a failure, and neither is a silence: both end
      // the session normally and reporting them would train people to ignore the
      // line that matters.
      if (stoppingRef.current || code === "aborted" || code === "no-speech") return;
      setError(code);
    };
    recRef.current = rec;
    setListening(true);
    rec.start();
  }, [lang, onText]);

  return { supported, listening, error, start, stop };
}

/** Read-aloud: speak a piece of text in the given language, one at a time. */
export function useSpeechOutput() {
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => typeof window !== "undefined" && "speechSynthesis" in window,
    serverUnsupported
  );
  const [speakingKey, setSpeakingKey] = useState<number | null>(null);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeakingKey(null);
  }, []);

  const speak = useCallback(
    (key: number, text: string, lang: Lang) => {
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const clean = speakable(text);
      if (!clean) return;
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = BCP47[lang];
      u.onend = () => setSpeakingKey((k) => (k === key ? null : k));
      u.onerror = () => setSpeakingKey((k) => (k === key ? null : k));
      setSpeakingKey(key);
      window.speechSynthesis.speak(u);
    },
    []
  );

  return { supported, speakingKey, speak, stop };
}
