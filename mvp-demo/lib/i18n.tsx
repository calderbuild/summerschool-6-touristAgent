"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "fr" | "zh";

export const LANGS: { id: Lang; label: string; a11y: string }[] = [
  { id: "en", label: "EN", a11y: "English" },
  { id: "fr", label: "FR", a11y: "Français" },
  { id: "zh", label: "中", a11y: "中文" },
];

const LANG_STORAGE_KEY = "voie-libre-lang";

function isLang(value: string | null): value is Lang {
  return value === "en" || value === "fr" || value === "zh";
}

function readInitialLang(): Lang {
  if (typeof window === "undefined") return "en";
  const params = new URLSearchParams(window.location.search);
  const queryLang = params.get("lang");
  if (isLang(queryLang)) return queryLang;
  const storedLang = window.localStorage.getItem(LANG_STORAGE_KEY);
  if (isLang(storedLang)) return storedLang;
  return "en";
}

type Entry = Record<Lang, string>;

const DICT: Record<string, Entry> = {
  brand_tag: {
    en: "step-free routes across Paris",
    fr: "itinéraires sans marches dans Paris",
    zh: "巴黎无楼梯路线",
  },

  hero_title: {
    en: "Get across Paris without the stairs.",
    fr: "Traversez Paris sans les escaliers.",
    zh: "穿越巴黎，不必爬楼梯。",
  },
  hero_sub: {
    en: "Step-free routes that tell you when a lift is working, when there is a climb, and when we honestly do not know.",
    fr: "Des itinéraires sans marches qui indiquent si l'ascenseur fonctionne, s'il y a des marches, et quand nous ne le savons pas.",
    zh: "无楼梯路线：电梯是否可用、哪里有台阶、以及我们确实不确定的地方，都如实告诉你。",
  },
  hero_reality: {
    en: "The honest baseline: only Métro Line 14 is fully step-free, and about 30 of 300+ stations have a working lift.",
    fr: "Le constat honnête : seule la ligne 14 est entièrement sans marches, et environ 30 stations sur plus de 300 ont un ascenseur en service.",
    zh: "诚实的现状：只有 14 号线全线无楼梯，300 多座车站中约 30 座有可用电梯。",
  },

  profile_q: {
    en: "Who is travelling?",
    fr: "Qui voyage ?",
    zh: "谁在出行？",
  },
  profile_wheelchair: { en: "Wheelchair", fr: "Fauteuil roulant", zh: "轮椅" },
  profile_stroller: { en: "With a stroller", fr: "Avec poussette", zh: "推婴儿车" },
  profile_senior: { en: "Older traveller", fr: "Voyageur âgé", zh: "年长者" },
  profile_lowenergy: { en: "Low energy", fr: "Peu d'énergie", zh: "体力有限" },
  profile_note: {
    en: "This sets how many stairs and how far a walk the route will accept.",
    fr: "Cela règle le nombre de marches et la distance de marche acceptés.",
    zh: "这会设定路线可接受的台阶数与步行距离。",
  },
  for_word: { en: "For", fr: "Pour", zh: "为" },

  disruption_today: { en: "Today", fr: "Aujourd'hui", zh: "今日" },

  result_title: { en: "Your step-free route", fr: "Votre itinéraire sans marches", zh: "你的无楼梯路线" },
  map_title: { en: "On the map", fr: "Sur la carte", zh: "地图" },
  map_view_group: { en: "Map view", fr: "Type de carte", zh: "地图视图" },
  map_view_map: { en: "Map", fr: "Plan", zh: "地图" },
  map_view_3d: { en: "3D", fr: "3D", zh: "3D" },
  map_missing: {
    en: "Live map appears once a Google Maps key is set. The route below is fully usable without it.",
    fr: "La carte s'affiche dès qu'une clé Google Maps est configurée. L'itinéraire ci-dessous fonctionne sans elle.",
    zh: "配置 Google Maps 密钥后即显示实时地图。下方路线无需地图即可使用。",
  },
  route_map_label: { en: "Route diagram", fr: "Schéma d'itinéraire", zh: "路线示意图" },
  map_3d_failed: {
    en: "The 3D map could not load. The route details are unaffected.",
    fr: "La carte 3D n'a pas pu se charger. Les détails de l'itinéraire restent disponibles.",
    zh: "3D 地图加载失败。路线信息不受影响。",
  },

  legend_ok: { en: "Step-free", fr: "Sans marches", zh: "无楼梯" },
  legend_lift: { en: "Working lift", fr: "Ascenseur en service", zh: "电梯可用" },
  legend_liftdown: { en: "Lift out of service", fr: "Ascenseur hors service", zh: "电梯故障" },
  legend_stairs: { en: "Stairs", fr: "Escaliers", zh: "台阶" },
  legend_unknown: { en: "Unknown", fr: "Inconnu", zh: "未知" },

  steps_unit: { en: "steps", fr: "marches", zh: "级台阶" },
  steps_unknown: { en: "step count unknown", fr: "nombre de marches inconnu", zh: "台阶数未知" },
  barrier_label: { en: "Barrier", fr: "Obstacle", zh: "障碍" },
  alt_label: { en: "Step-free alternative", fr: "Alternative sans marches", zh: "无楼梯替代方案" },
  walk_label: { en: "walk", fr: "à pied", zh: "步行" },
  restroom_ok: { en: "Accessible toilet on site", fr: "Toilettes accessibles sur place", zh: "现场有无障碍厕所" },

  verdict_clear: { en: "Step-free the whole way", fr: "Sans marches sur tout le trajet", zh: "全程无楼梯" },
  verdict_barrier: { en: "step barrier", fr: "obstacle", zh: "处台阶障碍" },
  verdict_unknown: { en: "lift status unknown", fr: "ascenseur inconnu", zh: "电梯状态未知" },
  freshness_note: {
    en: "Lift status is as of this morning, not a live feed.",
    fr: "État des ascenseurs de ce matin, pas un flux en direct.",
    zh: "电梯状态为今晨数据，非实时更新。",
  },

  honesty_title: { en: "We would rather say “unknown” than guess", fr: "Nous préférons dire « inconnu » plutôt que deviner", zh: "我们宁可说“未知”，也不猜测" },
  honesty_body: {
    en: "Other trip planners invent hours, prices, and routes. Every line here is drawn from open transit and map data, and a gap is shown as unknown, never filled in.",
    fr: "D'autres planificateurs inventent horaires, prix et itinéraires. Ici, chaque élément vient de données ouvertes de transport et de cartographie ; un manque est indiqué comme inconnu, jamais comblé.",
    zh: "别的行程助手会编造营业时间、价格和路线。这里每一条都来自公开的交通与地图数据；缺失的部分标为未知，绝不填补。",
  },

  chat_intro_title: {
    en: "Where do you need to go?",
    fr: "Où devez-vous aller ?",
    zh: "你想去哪里？",
  },
  chat_intro_body: {
    en: "Tell me your start, your destination, and how you travel. I plan the step-free way and I am honest when the data is unknown.",
    fr: "Dites-moi votre départ, votre destination et comment vous voyagez. Je trace l'itinéraire sans marches et je reste honnête quand la donnée est inconnue.",
    zh: "告诉我起点、终点和你的出行方式。我会规划无楼梯路线，数据未知时如实说明。",
  },
  chat_placeholder: {
    en: "Start and destination",
    fr: "Départ et destination",
    zh: "起点和终点",
  },
  chat_input_label: {
    en: "Ask for a step-free route",
    fr: "Demandez un itinéraire sans marches",
    zh: "询问无楼梯路线",
  },
  chat_send: { en: "Send", fr: "Envoyer", zh: "发送" },
  chat_stop: { en: "Stop", fr: "Arrêter", zh: "停止" },
  voice_input: { en: "Speak your request", fr: "Dictez votre demande", zh: "语音输入" },
  voice_listening: { en: "Listening. Tap to stop", fr: "Écoute. Touchez pour arrêter", zh: "聆听中，点击停止" },
  read_aloud: { en: "Read answer aloud", fr: "Lire la réponse à voix haute", zh: "朗读回答" },
  stop_reading: { en: "Stop reading", fr: "Arrêter la lecture", zh: "停止朗读" },
  chat_retry: { en: "Retry", fr: "Réessayer", zh: "重试" },
  chat_thinking: { en: "Thinking", fr: "Réflexion", zh: "思考中" },
  chat_reasoning: { en: "Reasoning", fr: "Raisonnement", zh: "推理过程" },
  chat_new: { en: "New chat", fr: "Nouvelle conversation", zh: "新对话" },
  chat_taking_longer: {
    en: "This is taking longer than expected…",
    fr: "Cela prend plus de temps que prévu…",
    zh: "响应时间比预期长……",
  },
  chat_error: {
    en: "Something went wrong reaching the assistant.",
    fr: "Impossible de joindre l'assistant.",
    zh: "连接助手时出错。",
  },
  chat_error_busy: {
    en: "Too many requests just now. Wait a moment, then try again.",
    fr: "Trop de demandes en ce moment. Patientez un instant, puis réessayez.",
    zh: "当前请求过多。请稍候片刻再试。",
  },
  chat_suggest_1: {
    en: "I use a wheelchair, Gare de Lyon to the Eiffel Tower today",
    fr: "En fauteuil, de Gare de Lyon à la Tour Eiffel aujourd'hui",
    zh: "我坐轮椅，今天从里昂车站到埃菲尔铁塔",
  },
  chat_suggest_2: {
    en: "Step-free from Bastille to the Louvre with a stroller",
    fr: "Sans marches de Bastille au Louvre avec une poussette",
    zh: "推婴儿车，从巴士底到卢浮宫的无楼梯路线",
  },
  chat_suggest_3: {
    en: "Reaching Notre-Dame from Gare du Nord without stairs",
    fr: "Aller à Notre-Dame depuis Gare du Nord sans escaliers",
    zh: "从北站到巴黎圣母院，避开楼梯",
  },
  chat_example_intro: {
    en: "One prepared route: real step counts, honest unknowns.",
    fr: "Un itinéraire préparé : vraies marches, inconnus assumés.",
    zh: "一条预设路线：真实台阶数，诚实标注未知。",
  },
  chat_try: {
    en: "Or start with",
    fr: "Ou commencez par",
    zh: "或从这些开始",
  },
  hero_line_label: {
    en: "A step-free line that honestly marks the stretch we do not know.",
    fr: "Une ligne sans marches qui signale honnêtement le tronçon que nous ne connaissons pas.",
    zh: "一条无楼梯路线，如实标出我们不确定的路段。",
  },
  conversation_label: { en: "Conversation", fr: "Conversation", zh: "对话" },
  routes_link: { en: "Routes", fr: "Itinéraires", zh: "路线一览" },
  browse_routes: {
    en: "Browse all prepared routes",
    fr: "Voir tous les itinéraires préparés",
    zh: "浏览全部预设路线",
  },
  back_to_assistant: { en: "Assistant", fr: "Assistant", zh: "返回对话" },
  lang_group: { en: "Language", fr: "Langue", zh: "语言" },

  map_legend_lines: {
    en: "Segments coloured by line · dashed = walking or unknown",
    fr: "Segments colorés par ligne · pointillés = à pied ou inconnu",
    zh: "路段按线路配色 · 虚线为步行或未知",
  },

  assistant_name: { en: "Voie Libre assistant", fr: "Assistant Voie Libre", zh: "Voie Libre 助手" },
  view_on_map: { en: "View on the map", fr: "Voir sur la carte", zh: "在地图上查看" },
  hide_map: { en: "Hide the map", fr: "Masquer la carte", zh: "收起地图" },

  weather_label: { en: "Paris weather right now", fr: "Météo à Paris en ce moment", zh: "巴黎此刻天气" },
  weather_live: { en: "live", fr: "en direct", zh: "实时" },
  weather_rain_hint: {
    en: "Rain can change a step-free plan",
    fr: "La pluie peut modifier un itinéraire sans marches",
    zh: "下雨可能改变无楼梯路线",
  },
  weather_clear: { en: "clear", fr: "ciel dégagé", zh: "晴" },
  weather_mostly_clear: { en: "mostly clear", fr: "plutôt dégagé", zh: "大致晴朗" },
  weather_overcast: { en: "overcast", fr: "couvert", zh: "阴" },
  weather_foggy: { en: "foggy", fr: "brumeux", zh: "有雾" },
  weather_rainy: { en: "rainy", fr: "pluvieux", zh: "有雨" },
  weather_snowy: { en: "snowy", fr: "neigeux", zh: "有雪" },
  weather_showers: { en: "rain showers", fr: "averses", zh: "阵雨" },
  weather_storm: { en: "thunderstorm", fr: "orage", zh: "雷雨" },
  weather_unsettled: { en: "unsettled", fr: "variable", zh: "天气不稳" },

  sources_label: { en: "Sources", fr: "Sources", zh: "数据来源" },
  disclaimer: {
    en: "Prototype with curated demo data. Live lift status and routing connect to IDFM, RATP, OpenStreetMap and Google Maps.",
    fr: "Prototype avec données de démonstration. L'état des ascenseurs et le calcul d'itinéraire se connectent à IDFM, RATP, OpenStreetMap et Google Maps.",
    zh: "原型，使用精选演示数据。实时电梯状态与路线计算将接入 IDFM、RATP、OpenStreetMap 与 Google Maps。",
  },
};

const I18nCtx = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: string) => string;
}>({ lang: "en", setLang: () => {}, t: (k) => k });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    window.localStorage.setItem(LANG_STORAGE_KEY, next);
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.history.replaceState(window.history.state, "", url);
  }, []);

  // Read the saved language (URL ?lang / localStorage) only after mount: doing it
  // in a useState initializer would touch window during SSR and cause a hydration
  // mismatch. The one-shot setState here is intentional, hence the disable.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLangState(readInitialLang());
  }, []);

  // Keep the document language in sync so screen readers pronounce FR/中 correctly.
  useEffect(() => {
    document.documentElement.lang = lang;
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  }, [lang]);
  const t = (k: string) => DICT[k]?.[lang] ?? k;
  return <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>;
}

export const useI18n = () => useContext(I18nCtx);
