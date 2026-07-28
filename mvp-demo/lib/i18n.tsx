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
  profile_pick_hint: {
    en: "Pick as many as apply.",
    fr: "Choisissez-en autant que nécessaire.",
    zh: "可多选。",
  },
  // One clause per constraint, each naming the consequence rather than the
  // mechanism, and each resting on the weight the search actually uses:
  // `router.test.ts` fails if the weight a clause calls the heaviest stops being
  // the heaviest. "This sets how many stairs the route will accept" used to sit
  // here instead, which described the setting to somebody who wanted to know what
  // it would do to their journey.
  profile_fx_wheelchair: {
    en: "Stairs count as a barrier, and a climb costs more than distance.",
    fr: "Les marches comptent comme un obstacle, et une montée coûte plus que la distance.",
    zh: "台阶按障碍处理，爬坡的代价高于距离。",
  },
  profile_fx_stroller: {
    en: "A few steps are acceptable; each one counted is weighed the hardest.",
    fr: "Quelques marches passent ; chaque marche comptée pèse le plus lourd.",
    zh: "少量台阶可以接受，但每一级已知台阶的权重最高。",
  },
  profile_fx_senior: {
    en: "A station nobody has published anything about is avoided most strongly.",
    fr: "Une station sur laquelle personne n'a rien publié est évitée le plus fortement.",
    zh: "对完全没有公开无障碍信息的车站回避得最强。",
  },
  profile_fx_lowenergy: {
    en: "Long walks and any climb weigh heavily against a longer ride.",
    fr: "Les longues marches et toute montée pèsent lourd face à un trajet plus long.",
    zh: "长距离步行和爬坡的权重高于多坐几站。",
  },
  profile_fx_strictest: {
    en: "Where these differ, the stricter one decides the route.",
    fr: "En cas de divergence, c'est la contrainte la plus stricte qui décide.",
    zh: "两者不一致时，按更严格的一方规划。",
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
  route_lift_out_one: {
    en: "lift on this journey is out of service, per the operator",
    fr: "ascenseur de ce trajet est hors service, selon l'exploitant",
    zh: "\u53f0\u7535\u68af\u5728\u8fd9\u8d9f\u884c\u7a0b\u4e0a\u6b63\u5728\u505c\u7528\uff08\u8fd0\u8425\u65b9\u53d1\u5e03\uff09",
  },
  route_lift_out_many: {
    en: "lifts on this journey are out of service, per the operator",
    fr: "ascenseurs de ce trajet sont hors service, selon l'exploitant",
    zh: "\u53f0\u7535\u68af\u5728\u8fd9\u8d9f\u884c\u7a0b\u4e0a\u6b63\u5728\u505c\u7528\uff08\u8fd0\u8425\u65b9\u53d1\u5e03\uff09",
  },
  route_lift_updated: { en: "updated", fr: "mis \u00e0 jour", zh: "\u66f4\u65b0\u4e8e" },
  route_lift_note: {
    en: "The location is the operator's own wording for where in the station the lift sits. A stop that is not listed here is one the operator reports no outage at, which is not the same as every lift working.",
    fr: "L'emplacement reprend les mots de l'exploitant pour situer l'ascenseur dans la gare. Un arr\u00eat absent de cette liste est un arr\u00eat o\u00f9 l'exploitant ne signale aucune panne, ce qui n'\u00e9quivaut pas \u00e0 tous les ascenseurs en service.",
    zh: "\u4f4d\u7f6e\u63cf\u8ff0\u7528\u7684\u662f\u8fd0\u8425\u65b9\u81ea\u5df1\u7684\u8bf4\u6cd5\uff0c\u6307\u7535\u68af\u5728\u7ad9\u5185\u7684\u54ea\u4e00\u6bb5\u3002\u6ca1\u51fa\u73b0\u5728\u8fd9\u4efd\u5217\u8868\u91cc\u7684\u7ad9\uff0c\u53ea\u662f\u8fd0\u8425\u65b9\u6ca1\u62a5\u544a\u6545\u969c\uff0c\u8ddf\u300c\u6240\u6709\u7535\u68af\u90fd\u597d\u7528\u300d\u4e0d\u662f\u4e00\u56de\u4e8b\u3002",
  },
  rail_title: {
    en: "Paris, right now",
    fr: "Paris, en ce moment",
    zh: "\u6b64\u523b\u7684\u5df4\u9ece",
  },
  rail_out_label: {
    en: "lifts the operator reports out of service",
    fr: "ascenseurs signal\u00e9s hors service par l'exploitant",
    zh: "\u53f0\u7535\u68af\u88ab\u8fd0\u8425\u65b9\u62a5\u4e3a\u505c\u7528",
  },
  rail_link: {
    en: "Where every figure comes from",
    fr: "D'o\u00f9 vient chaque chiffre",
    zh: "\u6bcf\u4e2a\u6570\u5b57\u7684\u6765\u6e90",
  },
  rail_more_1: { en: "and", fr: "et", zh: "\u53e6\u6709" },
  rail_more_2: {
    en: "more stations",
    fr: "autres gares",
    zh: "\u5ea7\u8f66\u7ad9",
  },
  voice_err_denied: {
    en: "Microphone blocked. Allow it for this site in the address bar, then try again.",
    fr: "Micro bloqu\u00e9. Autorisez-le pour ce site dans la barre d'adresse, puis r\u00e9essayez.",
    zh: "\u9ea6\u514b\u98ce\u88ab\u963b\u6b62\u3002\u5728\u5730\u5740\u680f\u91cc\u5141\u8bb8\u672c\u7ad9\u4f7f\u7528\uff0c\u7136\u540e\u91cd\u8bd5\u3002",
  },
  voice_err_capture: {
    en: "No microphone the browser can use. Check the input device, then try again.",
    fr: "Aucun micro utilisable par le navigateur. V\u00e9rifiez le p\u00e9riph\u00e9rique d'entr\u00e9e, puis r\u00e9essayez.",
    zh: "\u6d4f\u89c8\u5668\u627e\u4e0d\u5230\u53ef\u7528\u7684\u9ea6\u514b\u98ce\u3002\u68c0\u67e5\u8f93\u5165\u8bbe\u5907\u540e\u91cd\u8bd5\u3002",
  },
  voice_err_network: {
    en: "Voice needs the network and the request did not get through. Typing works.",
    fr: "La voix a besoin du r\u00e9seau et la requ\u00eate n'est pas pass\u00e9e. La saisie fonctionne.",
    zh: "\u8bed\u97f3\u8bc6\u522b\u9700\u8054\u7f51\uff0c\u8bf7\u6c42\u6ca1\u6210\u529f\u3002\u76f4\u63a5\u6253\u5b57\u53ef\u7528\u3002",
  },
  voice_err_other: {
    en: "Voice input stopped. The browser reported:",
    fr: "La saisie vocale s'est arr\u00eat\u00e9e. Le navigateur indique :",
    zh: "\u8bed\u97f3\u8f93\u5165\u5df2\u505c\u6b62\u3002\u6d4f\u89c8\u5668\u62a5\u544a\uff1a",
  },
  doors_title: { en: "What else is here", fr: "Ce qu'il y a d'autre ici", zh: "\u8fd8\u6709\u4ec0\u4e48" },
  door_routes: {
    en: "The same routing on a map, stop by stop, with a profile picker.",
    fr: "Le m\u00eame calcul d'itin\u00e9raire sur une carte, arr\u00eat par arr\u00eat, avec choix du profil.",
    zh: "\u540c\u4e00\u5957\u8def\u7ebf\u8ba1\u7b97\uff0c\u753b\u5728\u5730\u56fe\u4e0a\uff0c\u9010\u7ad9\u5c55\u5f00\uff0c\u5e26\u51fa\u884c\u8005\u9009\u9879\u3002",
  },
  door_whats_on: {
    en: "What is on in Paris this week, each event paired with whether you can reach it.",
    fr: "Ce qui se passe \u00e0 Paris cette semaine, chaque \u00e9v\u00e9nement avec la question de savoir si vous pouvez y aller.",
    zh: "\u672c\u5468\u5df4\u9ece\u6709\u4ec0\u4e48\u6d3b\u52a8\uff0c\u6bcf\u4e2a\u90fd\u914d\u4e0a\u300c\u4f60\u80fd\u4e0d\u80fd\u5230\u300d\u3002",
  },
  door_hiw: {
    en: "Every dataset behind these answers, and the one thing we still cannot tell you.",
    fr: "Toutes les donn\u00e9es derri\u00e8re ces r\u00e9ponses, et la seule chose que nous ne pouvons pas encore dire.",
    zh: "\u8fd9\u4e9b\u7b54\u6848\u80cc\u540e\u7684\u6bcf\u4e00\u4efd\u6570\u636e\uff0c\u4ee5\u53ca\u6211\u4eec\u4ecd\u7136\u544a\u8bc9\u4e0d\u4e86\u4f60\u7684\u4e8b\u3002",
  },
  door_legal: {
    en: "Licences, what we store, and how this site treats a screen reader.",
    fr: "Licences, ce que nous conservons, et comment ce site traite un lecteur d'\u00e9cran.",
    zh: "\u8bb8\u53ef\u534f\u8bae\u3001\u6211\u4eec\u5b58\u4e86\u4ec0\u4e48\uff0c\u4ee5\u53ca\u672c\u7ad9\u5bf9\u5c4f\u5e55\u9605\u8bfb\u5668\u7684\u5904\u7406\u3002",
  },
  nav_group: { en: "Sections", fr: "Sections", zh: "\u5bfc\u822a" },
  lift_dark_title: {
    en: "Live lift state: this app is not reading it right now",
    fr: "État des ascenseurs en direct : non lu en ce moment",
    zh: "电梯实时状态：此刻没在读",
  },
  lift_dark_body: {
    en: "The feed is licensed, so it answers only a registered token. When that token is missing or the request fails, this box says so instead of falling back to silence, because silence reads as no lift being broken.",
    fr: "Le flux est sous licence et ne répond qu'à un jeton enregistré. Si ce jeton manque ou si la requête échoue, cet encadré le dit plutôt que de se taire : le silence se lirait comme aucun ascenseur en panne.",
    zh: "这份数据流有许可限制，只回应注册过的 token。token 缺失或请求失败时，这里会直说，而不是干脆不提：不提会被读成「没有电梯坏掉」。",
  },
  lift_live_title: {
    en: "Live lift state: read from the operator",
    fr: "État des ascenseurs en direct : lu chez l'exploitant",
    zh: "电梯实时状态：已从运营方读取",
  },
  lift_live_pre: { en: "", fr: "", zh: "读取到运营方的 " },
  lift_live_mid_1: {
    en: "lifts read from the operator.",
    fr: "ascenseurs lus chez l'exploitant.",
    zh: " 台电梯，其中 ",
  },
  lift_live_mid_2: {
    en: "are reported out of service right now.",
    fr: "sont signalés hors service en ce moment.",
    zh: " 台此刻报修停用，",
  },
  lift_live_suffix: {
    en: "the operator itself does not commit either way, and those are shown in its own words rather than guessed at.",
    fr: "sur lesquels l'exploitant lui-même ne se prononce pas : ceux-là sont affichés avec ses mots plutôt que devinés.",
    zh: " 台运营方自己也没给结论，这些按它的原文显示，不去猜。",
  },
  lift_checking: { en: "Checking.", fr: "Vérification.", zh: "正在检查。" },
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
  plan_walk_1: {
    en: "The last",
    fr: "Les derniers",
    zh: "最后",
  },
  plan_walk_2: {
    en: "m on foot take about",
    fr: "m à pied prennent environ",
    zh: "米步行约需",
  },
  plan_walk_3: {
    en: "min at this traveller's pace. Nobody publishes the pavement, so that is a walking model rather than a promise.",
    fr: "min à l'allure de ce voyageur. Personne ne publie le trottoir : c'est un modèle de marche, pas une promesse.",
    zh: "分钟（按这位出行者的速度）。人行道数据没人公布，所以这是步行模型，不是承诺。",
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
  verdict_walk: { en: "min on foot at the end", fr: "min à pied pour finir", zh: "分钟步行收尾" },
  // A station the operator will only get you through with a member of staff or a
  // booking is not step-free, and calling the trip clear because nothing is
  // literally broken is how a traveller ends up stranded at a gate.
  // Deliberately vague in the summary and precise on the stop: the condition is
  // a booking at one station, a member of staff at another, and the wrong platform
  // at a third, so the line that counts them cannot name one of the three.
  verdict_conditional: { en: "with a condition", fr: "sous condition", zh: "有条件"},
  // This used to read "lift status is as of this morning, not a live feed", which
  // claimed a snapshot we have never held: the lift dataset refuses us without a
  // token, so there is no lift status here of any age. What is read live is the
  // station's accessibility class, and saying which of the two you are looking at
  // is the whole point.
  freshness_note: {
    en: "Station accessibility and lift state are both read live from the operator. Where the operator says it does not know, so do we.",
    fr: "L'accessibilité des gares et l'état des ascenseurs sont lus en direct chez l'exploitant. Là où l'exploitant dit ne pas savoir, nous le disons aussi.",
    zh: "车站无障碍等级和电梯状态都是实时从运营方读取的。运营方说不知道的地方，我们也说不知道。",
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
  // Says what happened rather than only that something did: the answer above is
  // part of an answer, so the reader knows not to act on it as if it were whole.
  chat_error_truncated: {
    en: "The answer stopped before it finished. What is above is incomplete.",
    fr: "La réponse s'est interrompue avant la fin. Ce qui précède est incomplet.",
    zh: "回答没有结束就中断了，上面的内容不完整。",
  },
  chat_error_cut: {
    en: "The assistant reached its length limit, so the last sentence is cut. Ask for one leg at a time for a fuller answer.",
    fr: "L'assistant a atteint sa limite de longueur, la dernière phrase est coupée. Demandez un trajet à la fois pour une réponse complète.",
    zh: "回答达到长度上限，最后一句被截断。分段提问可以得到完整答案。",
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
    en: "Not sure how to ask? Tap one",
    fr: "Vous ne savez pas comment demander ? Touchez-en un",
    zh: "不知道怎么问？点一条试试",
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
    en: "What the operator will, and will not, say about a lift",
    fr: "Ce que l'exploitant dit, et ne dit pas, d'un ascenseur",
    zh: "运营方会说、和不会说的电梯状态",
  },
  hiw_gap_body: {
    en: "For most of this week the answer was nothing at all. \u00cele-de-France Mobilit\u00e9s publishes 944 lifts under a licence that answers only a registered token, so the box below reported, correctly, that it could not see them. It is registered now and reads the feed for real, which changes what this page may claim and also what it must still refuse to claim: the operator marks a large minority of those lifts unknown itself, and where it does we pass that through rather than round it up. A lift called available is the operator's word with its own timestamp, not our inspection, and it is matched to a station by distance and name together, never by an id, because the zone ids in that feed do not match the timetable's.",
    fr: "Pendant l'essentiel de cette semaine, la r\u00e9ponse \u00e9tait : rien du tout. \u00cele-de-France Mobilit\u00e9s publie 944 ascenseurs sous une licence qui ne r\u00e9pond qu'\u00e0 un jeton enregistr\u00e9 ; l'encadr\u00e9 ci-dessous indiquait donc, \u00e0 juste titre, qu'il ne les voyait pas. Il est enregistr\u00e9 d\u00e9sormais et lit le flux pour de vrai, ce qui change ce que cette page peut affirmer et aussi ce qu'elle doit continuer de refuser : l'exploitant marque lui-m\u00eame une part importante de ces ascenseurs comme inconnus, et nous transmettons cela tel quel plut\u00f4t que de l'arrondir. Un ascenseur dit disponible, c'est sa parole horodat\u00e9e, pas notre inspection, et il est rattach\u00e9 \u00e0 une gare par la distance et le nom ensemble, jamais par un identifiant : les identifiants de zone de ce flux ne correspondent pas \u00e0 ceux des horaires.",
    zh: "\u8fd9\u5468\u7684\u5927\u90e8\u5206\u65f6\u95f4\u91cc\uff0c\u7b54\u6848\u662f\u300c\u4ec0\u4e48\u90fd\u62ff\u4e0d\u5230\u300d\u3002\u6cd5\u5170\u897f\u5c9b\u4ea4\u901a\u5c40\u53d1\u5e03\u4e86 944 \u53f0\u7535\u68af\uff0c\u4f46\u8bb8\u53ef\u534f\u8bae\u53ea\u56de\u5e94\u6ce8\u518c\u8fc7\u7684 token\uff0c\u6240\u4ee5\u4e0b\u9762\u90a3\u4e2a\u65b9\u6846\u5982\u5b9e\u62a5\u544a\uff1a\u770b\u4e0d\u5230\u7535\u68af\u3002\u73b0\u5728\u5df2\u7ecf\u6ce8\u518c\uff0c\u771f\u7684\u5728\u8bfb\u8fd9\u4efd\u6570\u636e\u6d41\uff0c\u4e8e\u662f\u8fd9\u4e00\u9875\u80fd\u8bf4\u7684\u8bdd\u53d8\u4e86\uff0c\u5fc5\u987b\u7ee7\u7eed\u62d2\u7edd\u8bf4\u7684\u8bdd\u4e5f\u53d8\u4e86\uff1a\u8fd0\u8425\u65b9\u81ea\u5df1\u5c31\u628a\u5176\u4e2d\u76f8\u5f53\u4e00\u90e8\u5206\u6807\u4e3a\u300c\u672a\u77e5\u300d\uff0c\u51e1\u662f\u8fd9\u79cd\u6211\u4eec\u7167\u6837\u900f\u4f20\uff0c\u4e0d\u5f80\u597d\u7684\u65b9\u5411\u51d1\u3002\u8bf4\u67d0\u53f0\u7535\u68af\u300c\u53ef\u7528\u300d\u662f\u8fd0\u8425\u65b9\u5e26\u65f6\u95f4\u6233\u7684\u8bf4\u6cd5\uff0c\u4e0d\u662f\u6211\u4eec\u7684\u68c0\u67e5\u7ed3\u679c\uff1b\u800c\u5b83\u4e0e\u8f66\u7ad9\u7684\u5bf9\u5e94\u9760\u8ddd\u79bb\u52a0\u540d\u79f0\u4e24\u4e2a\u6761\u4ef6\u540c\u65f6\u6210\u7acb\uff0c\u7edd\u4e0d\u9760 ID\uff0c\u56e0\u4e3a\u8fd9\u4efd\u6570\u636e\u6d41\u91cc\u7684\u6362\u4e58\u533a ID \u548c\u65f6\u523b\u8868\u91cc\u7684\u5bf9\u4e0d\u4e0a\u3002",
  },
  hiw_gap2_title: {
    en: "The gap that is still open, and it is in the timetable",
    fr: "La lacune encore ouverte, et elle est dans les horaires",
    zh: "\u8fd8\u6ca1\u586b\u4e0a\u7684\u90a3\u4e2a\u7f3a\u53e3\uff0c\u5728\u65f6\u523b\u8868\u91cc",
  },
  hiw_gap2_body: {
    en: "This graph is metro, tram, RER and Transilien, and the open timetable's RER C stops at Gare d'Austerlitz: its Paris branch, Champ de Mars Tour Eiffel included, has no trains in the file, and buses are not modelled at all. So the Eiffel Tower has no step-free station near it that we can see. A wheelchair journey there is sent to Invalides and told, in the route itself, that the last 1,451 m are on foot and roughly 23 minutes. Another app draws a line to the tower and says nothing. We would rather give you the number and let you decide.",
    fr: "Ce graphe couvre métro, tram, RER et Transilien, et le RER C des horaires ouverts s'arrête à la gare d'Austerlitz : sa branche parisienne, Champ de Mars Tour Eiffel comprise, n'a aucun train dans le fichier, et les bus ne sont pas modélisés. La tour Eiffel n'a donc aucune gare sans marches visible pour nous. Un trajet en fauteuil est dirigé vers Invalides, et l'itinéraire dit lui-même que les 1 451 derniers mètres se font à pied, soit environ 23 minutes. Une autre application trace un trait jusqu'à la tour sans rien dire. Nous préférons donner le chiffre et vous laisser décider.",
    zh: "这张图谱包含地铁、有轨电车、RER 和 Transilien，而开放时刻表里的 RER C 到奥斯特里茨站就断了：它的巴黎段（包括战神广场埃菲尔铁塔站）在文件里没有任何列车，公交则完全没有建模。所以在我们能看到的数据里，埃菲尔铁塔附近没有无台阶车站。轮椅出行会被送到荣军院站，并在路线里直接说明：最后 1451 米要靠步行，大约 23 分钟。别的应用会画一条线直达铁塔，然后什么也不说。我们宁愿把这个数字给你，让你自己决定。",
  },
  wo_eyebrow: { en: "This week, from the city", fr: "Cette semaine, par la Ville", zh: "本周，来自巴黎市政府" },
  wo_title: {
    en: "What is on, and whether you can get there",
    fr: "Ce qui se passe, et si vous pouvez y aller",
    zh: "有什么活动，以及你能不能过去",
  },
  wo_intro: {
    en: "Paris publishes an accessibility flag on every event it lists. Île-de-France Mobilités publishes one on every station. Each is useful and neither is enough: a hall with a ramp can sit above a staircase. Here they are side by side, still labelled with who said what.",
    fr: "Paris publie une information d'accessibilité sur chaque événement. Île-de-France Mobilités en publie une sur chaque gare. Chacune est utile et aucune ne suffit : une salle avec une rampe peut se trouver au-dessus d'un escalier. Les voici côte à côte, chacune attribuée à qui l'affirme.",
    zh: "巴黎市为每个活动都标了无障碍信息，法兰西岛交通局为每个车站也标了。两边都有用，但都不够：一个有坡道的场馆，可能就在一段楼梯上面。这里把两边并排放着，并且始终写明是谁说的。",
  },
  wo_join_title: {
    en: "The number neither publisher could produce alone",
    fr: "Le chiffre qu'aucune des deux sources ne pouvait produire seule",
    zh: "两边单独都算不出来的那个数",
  },
  wo_stat_city: {
    en: "events on this week the city marks wheelchair accessible",
    fr: "événements cette semaine que la Ville déclare accessibles en fauteuil",
    zh: "本周被市政府标为轮椅可达的活动",
  },
  wo_stat_stepfree: {
    en: "of the ones held here whose nearest station is step-free",
    fr: "parmi ceux affichés ici dont la gare la plus proche est sans marches",
    zh: "在本页收录的活动里，最近车站真正无台阶的",
  },
  wo_stat_conditional: {
    en: "whose nearest station needs a booking or a member of staff",
    fr: "dont la gare la plus proche exige une réservation ou un agent",
    zh: "最近车站需要预约或站务员协助的",
  },
  wo_stat_silent: {
    en: "held here where the city published nothing about access",
    fr: "affichés ici pour lesquels la Ville n'a rien publié sur l'accessibilité",
    zh: "本页收录但市政府完全没写无障碍信息的",
  },
  wo_join_note: {
    en: "The first number is the whole feed for the week. The other three are counted over the events this app has looked a station up for, which is more than the page shows and less than the feed holds. An event the city calls accessible whose station is not still appears below: that pairing is the reason this page exists.",
    fr: "Le premier chiffre porte sur tout le flux de la semaine. Les trois autres sont comptés sur les événements dont cette application a cherché la gare, soit plus que ce que la page affiche et moins que ce que contient le flux. Un événement déclaré accessible dont la gare ne l'est pas reste affiché ci-dessous : c'est précisément pour ce cas que cette page existe.",
    zh: "第一个数字是本周整份数据。后三个统计的是本应用查过车站的那些活动，比页面显示的多，比整份数据少。市政府说无障碍、但车站不是的活动照样列在下面：这一组对照正是这一页存在的理由。",
  },
  wo_city_label: { en: "The city says, about the venue", fr: "La Ville dit, sur le lieu", zh: "市政府对场地的说法" },
  wo_station_label: {
    en: "The operator says, about the way in",
    fr: "L'exploitant dit, sur le trajet",
    zh: "运营方对进出通道的说法",
  },
  wo_city_yes: { en: "Wheelchair accessible", fr: "Accessible en fauteuil", zh: "轮椅可达" },
  wo_city_no: { en: "Not wheelchair accessible", fr: "Non accessible en fauteuil", zh: "轮椅不可达" },
  wo_city_unknown: { en: "Nothing published about access", fr: "Rien de publié sur l'accessibilité", zh: "没有公布无障碍信息" },
  wo_also: { en: "Also listed for:", fr: "Également indiqué pour :", zh: "另外还标注了：" },
  wo_deaf: { en: "deaf visitors", fr: "public sourd", zh: "听障观众" },
  wo_blind: { en: "blind visitors", fr: "public aveugle", zh: "视障观众" },
  wo_sign: { en: "sign language", fr: "langue des signes", zh: "手语" },
  wo_free: { en: "Free", fr: "Gratuit", zh: "免费" },
  wo_paid: { en: "Paid", fr: "Payant", zh: "收费" },
  wo_price_unknown: { en: "Price not published", fr: "Tarif non publié", zh: "票价未公布" },
  wo_on_now: { en: "On now", fr: "En cours", zh: "正在进行" },
  wo_until: { en: "until", fr: "jusqu'au", zh: "至" },
  wo_from: { en: "From", fr: "À partir du", zh: "自" },
  wo_plan: { en: "Plan a step-free route", fr: "Calculer un trajet sans marches", zh: "规划无台阶路线" },
  wo_official: { en: "The city's page", fr: "La page de la Ville", zh: "市政府页面" },
  wo_source: {
    en: "Source: Que Faire à Paris, Ville de Paris, ODbL. Read at",
    fr: "Source : Que Faire à Paris, Ville de Paris, ODbL. Lu le",
    zh: "数据来源：Que Faire à Paris（巴黎市，ODbL）。读取于",
  },
  wo_unavailable: {
    en: "The city's events feed did not answer just now, so this page has no listing to show. It says so rather than showing an older copy, because an event that has already happened is worse than no event at all.",
    fr: "Le flux d'événements de la Ville n'a pas répondu, cette page n'a donc rien à afficher. Elle le dit plutôt que de montrer une ancienne copie : un événement déjà passé vaut moins que pas d'événement du tout.",
    zh: "市政府的活动数据此刻没有响应，所以本页没有可显示的列表。我们直接说明，而不是拿旧副本顶上：一个已经结束的活动，比没有活动更糟。",
  },
  wo_group_reachable: {
    en: "Accessible, and you can reach it",
    fr: "Accessible, et vous pouvez y aller",
    zh: "无障碍，而且你到得了",
  },
  wo_group_tension: {
    en: "Accessible, and you cannot reach it the same way",
    fr: "Accessible, mais pas par le même chemin",
    zh: "无障碍，但过去的路不是",
  },
  wo_group_tension_note: {
    en: "The city marks each of these wheelchair accessible and the operator marks the nearest station as needing a booking, a member of staff, or as having stairs. Neither publisher is wrong. Both had to be read to know, which is the only reason to put them on one page.",
    fr: "La Ville déclare chacun de ces événements accessible en fauteuil, et l'exploitant signale la gare la plus proche comme exigeant une réservation, un agent, ou comportant des escaliers. Aucune des deux sources ne se trompe. Il fallait lire les deux pour le savoir : c'est la seule raison de les réunir sur une page.",
    zh: "下面这些活动，市政府都标了轮椅可达，而运营方标注的最近车站需要预约、需要工作人员协助，或者有台阶。两边都没说错。只有把两边都读一遍才知道，这也正是把它们放在同一页的唯一理由。",
  },
  wo_shown_1: { en: "Stations looked up for", fr: "Gare recherchée pour", zh: "已查车站的活动数：" },
  wo_shown_2: { en: "events this week;", fr: "événements cette semaine ;", zh: "个（本周）；本页显示" },
  wo_shown_3: { en: "shown here, ranked accessible first.", fr: "affichés ici, les plus accessibles d'abord.", zh: "个，按可达性优先排序。" },
  whats_on_link: { en: "This week", fr: "Cette semaine", zh: "本周活动" },
  routes_link: { en: "Routes", fr: "Itinéraires", zh: "路线一览" },
  browse_routes: {
    en: "Plan a journey on the map",
    fr: "Planifier un trajet sur la carte",
    zh: "在地图上规划行程",
  },
  // The projected page. No "scan the code" anywhere: the instruction a QR does not
  // need is the kind of caption that papers over a layout mistake.
  qr_title: {
    en: "Open it on your own phone",
    fr: "Ouvrez-le sur votre téléphone",
    zh: "用你自己的手机打开",
  },
  qr_alt: {
    en: "QR code for voie-libre.vercel.app",
    fr: "QR code vers voie-libre.vercel.app",
    zh: "voie-libre.vercel.app 的二维码",
  },
  qr_promise: {
    en: "No sign-in, and nothing you type is stored on our side.",
    fr: "Aucune connexion, et rien de ce que vous tapez n'est conservé chez nous.",
    zh: "无需登录，你输入的内容也不会存在我们这边。",
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
    en: "Sources: \u00cele-de-France Mobilit\u00e9s (timetable, accessibility register, live lift outages) and OpenStreetMap (lifts and stairways).",
    fr: "Sources : \u00cele-de-France Mobilit\u00e9s (horaires, registre d'accessibilit\u00e9, pannes d'ascenseur en direct) et OpenStreetMap (ascenseurs et escaliers).",
    zh: "\u6570\u636e\u6765\u6e90\uff1a\u00cele-de-France Mobilit\u00e9s\uff08\u65f6\u523b\u8868\u3001\u65e0\u969c\u788d\u767b\u8bb0\u3001\u7535\u68af\u5b9e\u65f6\u6545\u969c\uff09\u4e0e OpenStreetMap\uff08\u7535\u68af\u4e0e\u697c\u68af\u4f4d\u7f6e\uff09\u3002",
  },
  // The caveat, split off the line above so a phone is not handed four lines of
  // fine print at the exact moment it wants to type. It is not dropped: the
  // composer shows it from sm up and /how-it-works carries it in full at every
  // width, which is where a gap this consequential belongs anyway.
  disclaimer_gap: {
    en: "What is still missing is RER C through Paris: the open timetable runs no trains on that branch.",
    fr: "Ce qui manque encore : le RER C dans Paris, absent des horaires ouverts.",
    zh: "\u76ee\u524d\u8fd8\u7f3a\u7684\u662f\u7a7f\u8fc7\u5df4\u9ece\u7684 RER C\uff1a\u5f00\u653e\u65f6\u523b\u8868\u91cc\u90a3\u4e00\u6bb5\u6ca1\u6709\u4efb\u4f55\u5217\u8f66\u3002",
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
