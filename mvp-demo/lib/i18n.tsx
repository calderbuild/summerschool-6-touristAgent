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
  // Three fragments rather than one sentence, because the numbers between them
  // are read out of the operator's register at build time. A hardcoded "about 30
  // of 300+" was the previous version and nobody could check it.
  hero_reality_1: {
    en: "Counted, not estimated: of the",
    fr: "Compté, pas estimé : sur les",
    zh: "这是数出来的，不是估的：在",
  },
  hero_reality_2: {
    en: "stations Île-de-France Mobilités publishes a timetable for, the operator marks every platform accessible at",
    fr: "stations dont Île-de-France Mobilités publie les horaires, l'exploitant marque tous les quais accessibles dans",
    zh: "座 Île-de-France Mobilités 公布时刻表的车站中，运营方标记「全部站台可通行」的有",
  },
  hero_reality_3: {
    en: "of them, some but not all at",
    fr: "d'entre elles, certains mais pas tous dans",
    zh: "座，「部分站台可通行」的有",
  },
  hero_reality_4: {
    en: "and none at all at",
    fr: "et aucun dans",
    zh: "座，「全部不可通行」的有",
  },
  hero_reality_5: {
    en: "Seven stations say nothing either way, and those are the ones this app calls unknown rather than guessing.",
    fr: "Sept stations ne disent rien, et ce sont celles que cette application appelle inconnues plutôt que de deviner.",
    zh: "另有 7 座车站两边都没说，这 7 座就是本应用标为「未知」而不去猜的那些。",
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

  plan_q: { en: "Where are you going?", fr: "Où allez-vous ?", zh: "你要去哪里？" },
  plan_from: { en: "From", fr: "Départ", zh: "出发" },
  plan_to: { en: "To", fr: "Arrivée", zh: "到达" },
  plan_from_ph: { en: "Station or place", fr: "Station ou lieu", zh: "车站或地点" },
  plan_to_ph: { en: "Station or place", fr: "Station ou lieu", zh: "车站或地点" },
  plan_swap: { en: "Swap start and destination", fr: "Inverser départ et arrivée", zh: "交换起点与终点" },
  plan_submit: { en: "Find a step-free route", fr: "Trouver un itinéraire sans marches", zh: "查找无楼梯路线" },
  plan_working: { en: "Searching the network", fr: "Recherche sur le réseau", zh: "正在搜索线网" },
  plan_idle: {
    en: "Pick a start and a destination. Any of the 945 metro, tram, RER and Transilien stations Île-de-France Mobilités publishes a timetable for, or one of the places in the guide.",
    fr: "Choisissez un départ et une arrivée : l'une des 945 stations de métro, tram, RER et Transilien dont Île-de-France Mobilités publie les horaires, ou un lieu du guide.",
    zh: "选择起点和终点：Île-de-France Mobilités 公布时刻表的 945 座地铁、电车、RER 与 Transilien 车站，或指南中的任一地点。",
  },
  plan_err_unknown_from: {
    en: "That start is not in the timetable. Try a station name, or a place such as the Louvre.",
    fr: "Ce départ n'est pas dans les horaires. Essayez un nom de station, ou un lieu comme le Louvre.",
    zh: "时刻表中没有这个起点。试试车站名，或像卢浮宫这样的地点。",
  },
  plan_err_unknown_to: {
    en: "That destination is not in the timetable. Try a station name, or a place such as the Louvre.",
    fr: "Cette arrivée n'est pas dans les horaires. Essayez un nom de station, ou un lieu comme le Louvre.",
    zh: "时刻表中没有这个终点。试试车站名，或像卢浮宫这样的地点。",
  },
  plan_err_same_place: {
    en: "Start and destination are the same station. Change one of them.",
    fr: "Le départ et l'arrivée sont la même station. Changez-en une.",
    zh: "起点和终点是同一座车站，请修改其中一个。",
  },
  plan_err_no_route: {
    en: "No metro, tram, RER or Transilien route connects these two in the published timetable. A bus may, and this app does not rate buses: a bus is step-free for reasons no feed here carries, a ramp and a kerb and a driver.",
    fr: "Aucun métro, tram, RER ou Transilien ne relie ces deux points dans les horaires publiés. Un bus le fait peut-être, et cette application n'évalue pas les bus : un bus est accessible pour des raisons qu'aucune donnée ici ne porte, une rampe, une bordure, un conducteur.",
    zh: "已公布的时刻表中没有地铁、电车、RER 或 Transilien 连接这两点。公交车可能可以，但本应用不评估公交：公交是否无障碍取决于坡板、路缘和司机，这些都不在现有数据里。",
  },
  plan_err_missing_endpoints: {
    en: "Fill in both ends of the journey and the route will follow.",
    fr: "Renseignez les deux extrémités du trajet et l'itinéraire suivra.",
    zh: "把起点和终点都填上，路线就会出来。",
  },
  plan_err_offline: {
    en: "The route could not be fetched. Check the connection and press the button again.",
    fr: "L'itinéraire n'a pas pu être récupéré. Vérifiez la connexion et appuyez à nouveau.",
    zh: "未能获取路线。请检查网络后再次点击按钮。",
  },
  plan_minutes: { en: "min", fr: "min", zh: "分钟" },
  plan_changes: { en: "changes", fr: "changements", zh: "换乘" },
  plan_stops: { en: "stops", fr: "arrêts", zh: "站" },
  plan_barriers_none: {
    en: "No station on this route is marked inaccessible by the operator.",
    fr: "Aucune station de cet itinéraire n'est signalée inaccessible par l'opérateur.",
    zh: "此路线上没有被运营方标记为不可通行的车站。",
  },
  plan_barriers_some: {
    en: "Marked inaccessible by the operator:",
    fr: "Signalées inaccessibles par l'opérateur :",
    zh: "被运营方标记为不可通行：",
  },
  plan_unknown_count: {
    en: "stations with nothing published either way",
    fr: "stations sans information publiée",
    zh: "座车站没有任何公开信息",
  },
  plan_unknown_count_one: {
    en: "station with nothing published either way",
    fr: "station sans information publiée",
    zh: "座车站没有任何公开信息",
  },
  plan_climb_1: {
    en: "The last",
    fr: "Les derniers",
    zh: "最后",
  },
  plan_climb_2: {
    en: "m on foot climb about",
    fr: "m à pied montent d'environ",
    zh: "米步行需上行约",
  },
  plan_climb_3: {
    en: "m. That gradient is terrain data, not a rated route: nobody publishes the pavement.",
    fr: "m. Cette pente vient des données de terrain, pas d'un itinéraire évalué : personne ne publie le trottoir.",
    zh: "米。这个坡度来自地形数据，不是经过评级的路线：人行道数据没人公布。",
  },
  plan_graph: { en: "Timetable graph built", fr: "Graphe des horaires construit", zh: "时刻表图谱构建于" },
  hiw_criteria_title: {
    en: "The decision, and what it cost",
    fr: "La décision, et ce qu'elle a coûté",
    zh: "这个决定，以及它的代价",
  },
  hiw_criteria_intro: {
    en: "One choice shaped the rest: routing in our own code over a graph built from the operator's timetable, rather than calling a routing API. Here it is against the five criteria an architecture is judged on.",
    fr: "Un choix a déterminé le reste : calculer les itinéraires dans notre propre code, sur un graphe construit depuis les horaires de l'exploitant, plutôt que d'appeler une API. Le voici face aux cinq critères qui jugent une architecture.",
    zh: "一个选择决定了其余部分：在我们自己的代码里、基于运营方时刻表构建的图谱上做路线计算，而不是调用现成的路线 API。下面按评判架构的五个标准逐条摆出来。",
  },

  legal_eyebrow: { en: "Data and access", fr: "Données et accès", zh: "数据与无障碍" },
  legal_title: {
    en: "What we do with what you type, and how far our accessibility goes",
    fr: "Ce que nous faisons de ce que vous écrivez, et jusqu'où va notre accessibilité",
    zh: "我们如何处理你输入的内容，以及本站的无障碍做到了哪一步",
  },
  legal_intro: {
    en: "Two questions a product like this owes you an answer to. Both are answered as claims you can check, not as a policy.",
    fr: "Deux questions auxquelles un produit comme celui-ci vous doit une réponse. Les deux sont formulées comme des affirmations vérifiables, pas comme une politique.",
    zh: "这类产品有义务回答两个问题。下面的回答都写成可以核对的断言，而不是一份条款。",
  },
  legal_data_title: { en: "Your words", fr: "Vos données", zh: "你的数据" },
  legal_a11y_title: { en: "This site's own accessibility", fr: "L'accessibilité de ce site", zh: "本站自身的无障碍" },
  legal_check: { en: "Check it", fr: "Vérifier", zh: "如何核对" },
  legal_updated: {
    en: "Written 2026-07-27. Changed whenever the answer changes.",
    fr: "Rédigé le 27/07/2026. Modifié dès que la réponse change.",
    zh: "撰写于 2026-07-27，答案变化时同步更新。",
  },
  legal_link: { en: "Data and accessibility", fr: "Données et accessibilité", zh: "数据与无障碍" },

  plan_computed: {
    en: "Computed, not written by hand",
    fr: "Calculé, non rédigé à la main",
    zh: "计算得出，非人工撰写",
  },

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
  map_3d_fell_back: {
    en: "The 3D view could not load, so the flat map is showing instead. Press 3D to try again.",
    fr: "La vue 3D n'a pas pu se charger, le plan est affiché à la place. Appuyez sur 3D pour réessayer.",
    zh: "3D 视图未能加载，已改为显示平面地图。点击 3D 可重试。",
  },
  map_failed: {
    en: "The map could not load. This is the map service, not the route: every stop and lift status below is unchanged.",
    fr: "La carte n'a pas pu se charger. C'est le service de cartographie, pas l'itinéraire : chaque arrêt et chaque ascenseur ci-dessous sont inchangés.",
    zh: "地图未能加载。问题在地图服务，不在路线：下方每个站点和电梯状态均不受影响。",
  },
  map_slow: {
    en: "The map is taking longer than usual to load.",
    fr: "La carte met plus de temps que d'habitude à charger.",
    zh: "地图加载时间比平时长。",
  },

  legend_ok: { en: "Step-free", fr: "Sans marches", zh: "无楼梯" },
  legend_lift: { en: "Working lift", fr: "Ascenseur en service", zh: "电梯可用" },
  legend_conditional: {
    en: "Gets you through, with a condition",
    fr: "Praticable, sous condition",
    zh: "有条件可通行",
  },
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
  verdict_unknown: { en: "nothing published", fr: "rien de publié", zh: "无公开信息" },
  // Metres of hill on the final walk. It sits in the verdict beside the station
  // counts because on the way to Sacré-Cœur it is the journey's real obstacle,
  // and no count of stations can see it.
  verdict_climb: { en: "m of climb on foot", fr: "m de montée à pied", zh: "米步行上坡" },
  // A station the operator will only get you through with a member of staff or a
  // booking is not step-free, and calling the trip clear because nothing is
  // literally broken is how a traveller ends up stranded at a gate.
  // Deliberately vague in the summary and precise on the stop: the condition is
  // a booking at one station, a member of staff at another, and the wrong platform
  // at a third, so the line that counts them cannot name one of the three.
  verdict_conditional: { en: "with a condition", fr: "sous condition", zh: "有条件"},
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
    en: "A diagram of central Paris: the Seine, Line 14 drawn as the one fully step-free line, and every other line hatched because its accessibility cannot be promised.",
    fr: "Un schéma du centre de Paris : la Seine, la ligne 14 tracée comme la seule ligne entièrement sans marches, et toutes les autres hachurées car leur accessibilité n'est pas garantie.",
    zh: "巴黎市中心示意图：塞纳河、被画成唯一全程无楼梯的 14 号线，以及以斜纹标出的其他线路，因为它们的无障碍状况无法保证。",
  },
  hero_stat_caption: {
    en: "of stairways in central Paris do not record how many steps they are.",
    fr: "des escaliers du centre de Paris n'indiquent pas leur nombre de marches.",
    zh: "的巴黎市中心楼梯没有记录台阶数量。",
  },
  hero_stat_source: {
    en: "1,313 of 3,246 · OpenStreetMap, counted 2026-07-26",
    fr: "1 313 sur 3 246 · OpenStreetMap, comptés le 26/07/2026",
    zh: "3,246 处中 1,313 处 · OpenStreetMap，2026-07-26 统计",
  },
  legend_m14: { en: "Line 14, step-free", fr: "Ligne 14, sans marches", zh: "14 号线，无楼梯" },
  legend_interchange_unknown: {
    en: "Change here, lift unverified",
    fr: "Changement ici, ascenseur non vérifié",
    zh: "此处换乘，电梯未核实",
  },
  conversation_label: { en: "Conversation", fr: "Conversation", zh: "对话" },

  // "How this works" page
  hiw_link: { en: "How this works", fr: "Comment ça marche", zh: "工作原理" },
  hiw_eyebrow: { en: "Under the hood", fr: "Sous le capot", zh: "技术说明" },
  hiw_title: {
    en: "What this is built from, and why each part is there.",
    fr: "Avec quoi c'est construit, et pourquoi chaque brique est là.",
    zh: "这个产品由什么构成，以及每一部分为什么在这里。",
  },
  hiw_intro: {
    en: "A confident wrong answer about a lift is worse than no answer, because someone acts on it and then cannot get back out. Everything below exists to make that harder.",
    fr: "Une réponse fausse mais assurée sur un ascenseur est pire que pas de réponse : quelqu'un s'y fie, puis ne peut plus faire demi-tour. Tout ce qui suit existe pour rendre cela plus difficile.",
    zh: "关于电梯的一个自信但错误的回答，比没有回答更糟，因为有人会照着做，然后出不来。下面这一切的存在，都是为了让这种事更难发生。",
  },
  hiw_measured_title: {
    en: "What the open data actually contains",
    fr: "Ce que contiennent réellement les données ouvertes",
    zh: "开放数据里实际有什么",
  },
  hiw_measured_source: {
    en: "Counted from our own cached OpenStreetMap extract, central Paris, 2026-07-26",
    fr: "Comptés depuis notre propre extrait OpenStreetMap en cache, centre de Paris, 26/07/2026",
    zh: "根据我们自己缓存的 OpenStreetMap 数据统计，巴黎市中心，2026-07-26",
  },
  hiw_guards_title: {
    en: "The checks on what the assistant says",
    fr: "Les garde-fous sur ce que dit l'assistant",
    zh: "对助手所说内容的把关",
  },
  hiw_guards_intro: {
    en: "A language model will fill a gap with something plausible unless it is stopped. These are the five things that stop it here.",
    fr: "Un modèle de langage comblera un vide avec quelque chose de plausible si rien ne l'en empêche. Voici les cinq choses qui l'en empêchent ici.",
    zh: "语言模型如果不加约束，就会用听起来合理的内容填补空白。以下五点是在这里约束它的东西。",
  },
  hiw_stack_title: {
    en: "Every technology, and the reason for it",
    fr: "Chaque technologie, et sa raison",
    zh: "每项技术，以及选它的理由",
  },
  hiw_stack_intro: {
    en: "Each reason below would change if the product were different. That is the test: \"popular\", \"free\" and \"what we already knew\" are not reasons, so they are not on this page.",
    fr: "Chaque raison ci-dessous changerait si le produit était différent. C'est le test : « populaire », « gratuit » et « ce que nous savions déjà » ne sont pas des raisons, donc elles ne figurent pas ici.",
    zh: "下面每一条理由，如果产品换了就不再成立。这就是判据：「流行」「免费」「我们本来就会」不算理由，所以不出现在这一页。",
  },
  hiw_because: { en: "Why this and not the obvious alternative", fr: "Pourquoi celui-ci plutôt que l'évident", zh: "为什么选它而不是那个显而易见的选项" },
  layer_front: { en: "Front end", fr: "Front-end", zh: "前端" },
  layer_back: { en: "Back end", fr: "Back-end", zh: "后端" },
  layer_model: { en: "The model", fr: "Le modèle", zh: "模型" },
  layer_data: { en: "Data layer", fr: "Couche de données", zh: "数据层" },
  hiw_gap_title: {
    en: "The gap we have not closed",
    fr: "La lacune que nous n'avons pas comblée",
    zh: "我们还没有填上的缺口",
  },
  hiw_gap_body: {
    en: "Whether a particular lift is working right now is the one thing this cannot tell you. Île-de-France Mobilités publishes it, 944 lifts each with its own update time, under a licence that requires a registered token: without one the records answer \u201cForbiddenAccess\u201d, and we have not registered. So the station classes on this site are read live from their open register, and every individual lift status is described as of this morning. The gap is named rather than papered over.",
    fr: "Savoir si un ascenseur précis fonctionne en ce moment est la seule chose que ce site ne peut pas vous dire. Île-de-France Mobilités le publie, 944 ascenseurs avec leur heure de mise à jour, sous une licence exigeant un jeton enregistré : sans jeton, les enregistrements répondent « ForbiddenAccess », et nous ne sommes pas enregistrés. Les classes d'accessibilité des gares sont donc lues en direct dans leur registre ouvert, et chaque état d'ascenseur est présenté comme celui de ce matin. Le manque est nommé, pas masqué.",
    zh: "某一台电梯此刻是否正常，是本站唯一无法告诉你的事。法兰西岛交通局确实发布了这份数据（944 台电梯，各带更新时间），但它使用需注册 token 的许可协议：没有 token 时接口直接返回 ForbiddenAccess，而我们没有注册。因此站点的车站无障碍等级是从其开放名录实时读取的，而每一台电梯的状态都标注为今早的情况。这个缺口我们直接说明，而不是掩盖。",
  },
  routes_link: { en: "Routes", fr: "Itinéraires", zh: "路线一览" },
  browse_routes: {
    en: "Plan a journey on the map",
    fr: "Planifier un trajet sur la carte",
    zh: "在地图上规划行程",
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

  // A wrong address is a dead end, and a dead end is the one thing this product
  // is against. So the 404 does what a blocked lift does here: says what
  // happened plainly, then offers the way round.
  nf_code: { en: "Page not found", fr: "Page introuvable", zh: "页面不存在" },
  nf_title: {
    en: "This address leads nowhere.",
    fr: "Cette adresse ne mène nulle part.",
    zh: "这个地址没有内容。",
  },
  nf_body: {
    en: "The link may be old, or a word may be mistyped. Both ways into Voie Libre still work:",
    fr: "Le lien est peut-être ancien, ou un mot mal saisi. Les deux entrées de Voie Libre fonctionnent toujours :",
    zh: "链接可能已失效，或地址里有拼写错误。进入 Voie Libre 的两个入口都还在：",
  },
  nf_chat: {
    en: "Ask the assistant",
    fr: "Interroger l'assistant",
    zh: "向助手提问",
  },
  nf_chat_hint: {
    en: "Describe where you are going and how far you can walk.",
    fr: "Décrivez votre destination et la distance que vous pouvez marcher.",
    zh: "说出你要去哪里、能走多远。",
  },
  nf_routes: {
    en: "Browse the step-free routes",
    fr: "Parcourir les itinéraires sans marches",
    zh: "浏览无楼梯路线",
  },
  nf_routes_hint: {
    en: "Four checked routes across Paris, with the barriers named.",
    fr: "Quatre itinéraires vérifiés dans Paris, avec les obstacles nommés.",
    zh: "四条已核对的巴黎路线，逐段标出障碍。",
  },

  map_3d_focus: {
    en: "Street level around",
    fr: "Le quartier autour de",
    zh: "这一站周边的街道：",
  },

  // The operator's own record, shown next to ours. Named as theirs on purpose:
  // when the two disagree, a traveller has to be able to tell whose claim is
  // whose.
  official_label: {
    en: "Operator's record",
    fr: "Registre de l'exploitant",
    zh: "运营方记录",
  },
  official_source: {
    en: "Île-de-France Mobilités, read live",
    fr: "Île-de-France Mobilités, lu en direct",
    zh: "法兰西岛交通局，实时读取",
  },
  official_missing: {
    en: "Not in the operator's station record, which covers RER and rail stops rather than the métro.",
    fr: "Absent du registre des gares de l'exploitant, qui couvre le RER et le rail plutôt que le métro.",
    zh: "运营方车站名录中没有这一站：该名录覆盖 RER 与铁路，不含地铁。",
  },
  official_unavailable: {
    en: "The operator's record could not be reached just now, so only our own checks are shown.",
    fr: "Le registre de l'exploitant est injoignable pour le moment ; seules nos vérifications sont affichées.",
    zh: "此刻无法连接运营方记录，页面只显示我们自己核对的内容。",
  },
  wc_label: {
    en: "Accessible toilet in the station",
    fr: "Toilettes accessibles dans la station",
    zh: "站内有无障碍厕所",
  },
  wc_free: { en: "free", fr: "gratuites", zh: "免费" },
  wc_paid: { en: "paid", fr: "payantes", zh: "收费" },
  wc_inside: { en: "inside the gates", fr: "en zone contrôlée", zh: "在闸机内" },
  wc_outside: { en: "outside the gates", fr: "hors zone contrôlée", zh: "在闸机外" },

  hiw_live_title: {
    en: "Read from the source while you use it",
    fr: "Lu à la source pendant que vous l'utilisez",
    zh: "使用时实时读取来源",
  },
  hiw_live_intro: {
    en: "These two registers are not copied into this project. They are fetched when a page loads, cached for six hours, and if they cannot be reached the page says so instead of showing an old answer.",
    fr: "Ces deux registres ne sont pas copiés dans ce projet. Ils sont récupérés au chargement d'une page, mis en cache six heures, et s'ils sont injoignables la page le dit au lieu d'afficher une ancienne réponse.",
    zh: "这两份名录没有被复制进项目。它们在页面加载时获取、缓存六小时；连接不上时页面会直接说明，而不是拿旧答案顶上。",
  },

  sources_label: { en: "Sources", fr: "Sources", zh: "数据来源" },
  // This line used to say "prototype with curated demo data", which stopped being
  // true when routing moved onto the operator's own timetable. What is still
  // missing is named instead of glossed over.
  disclaimer: {
    en: "Routes are computed from Île-de-France Mobilités' published timetable and their accessibility register, with lifts and stairways from OpenStreetMap. Whether a specific lift is working right now is the one thing this cannot tell you: that feed is licensed and needs a token we do not have.",
    fr: "Les itinéraires sont calculés à partir des horaires publiés par Île-de-France Mobilités et de leur registre d'accessibilité, les ascenseurs et escaliers venant d'OpenStreetMap. La seule chose que nous ne pouvons pas dire : si un ascenseur précis fonctionne en ce moment. Ce flux est sous licence et exige un jeton que nous n'avons pas.",
    zh: "路线由 Île-de-France Mobilités 公布的时刻表与无障碍登记计算得出，电梯与楼梯数据来自 OpenStreetMap。唯一无法告诉你的是某台电梯此刻是否运行：那个数据源有许可限制，需要我们尚未取得的 token。",
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
