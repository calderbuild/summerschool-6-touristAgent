"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Lang } from "./i18n";

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
interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
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

/** Voice input: transcribe speech into text in the given UI language. */
export function useSpeechInput(lang: Lang, onText: (text: string) => void) {
  const supported = useSyncExternalStore(noopSubscribe, () => !!recognitionCtor(), serverUnsupported);
  const [listening, setListening] = useState(false);
  const recRef = useRef<RecognitionLike | null>(null);

  useEffect(() => () => recRef.current?.stop(), []);

  const stop = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    recRef.current?.stop();
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
    rec.onerror = () => {
      recRef.current = null;
      setListening(false);
    };
    recRef.current = rec;
    setListening(true);
    rec.start();
  }, [lang, onText]);

  return { supported, listening, start, stop };
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
      const clean = text.replace(/\[\[[^\]]*\]\]/g, "").trim();
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
