import type { Lang } from "./i18n";

export type L = Record<Lang, string>;

// ok = step-free · lift = working lift · lift_down = lift out of service
// stairs = steps required · unknown = we honestly do not know
export type Status = "ok" | "lift" | "lift_down" | "stairs" | "unknown";

export interface RouteNode {
  name: string; // proper noun, not translated
  line?: { label: string; color: string };
  coord: { lat: number; lng: number };
  into?: { status: Status; text: L }; // the segment leading INTO this node
  at: Status; // accessibility AT this node (entrance / exit / platform)
  atText: L;
  steps?: number | null; // number, or null = unknown, or omit = not applicable
  walkM?: number;
  barrier?: L;
  alt?: L;
  restroom?: boolean;
}

export interface DemoRoute {
  id: string;
  from: string;
  to: string;
  title: L;
  disruption?: L;
  sources: string[];
  nodes: RouteNode[];
}

const M14 = { label: "M14", color: "#62259D" };
const M1 = { label: "M1", color: "#FFCD00" };
const RERC = { label: "RER C", color: "#F3D311" };
const RERB = { label: "RER B", color: "#7BA3DC" };

export const ROUTES: DemoRoute[] = [
  {
    id: "gdl-eiffel",
    from: "Gare de Lyon",
    to: "Tour Eiffel",
    title: {
      en: "Wheelchair · Gare de Lyon → Eiffel Tower, on a strike day",
      fr: "Fauteuil roulant · Gare de Lyon → Tour Eiffel, un jour de grève",
      zh: "轮椅 · 里昂车站 → 埃菲尔铁塔，罢工日",
    },
    disruption: {
      en: "Metro strike. Only the automated lines 1, 4 and 14 run near-normal; other lines are heavily reduced.",
      fr: "Grève dans le métro. Seules les lignes automatiques 1, 4 et 14 circulent presque normalement ; les autres sont très réduites.",
      zh: "地铁罢工。只有自动运行的 1、4、14 号线接近正常运行，其余线路大幅减少。",
    },
    sources: ["IDFM · État des ascenseurs", "RATP · accessible stations", "OpenStreetMap", "Tour Eiffel access info"],
    nodes: [
      {
        name: "Gare de Lyon",
        line: M14,
        coord: { lat: 48.8443, lng: 2.3743 },
        at: "ok",
        steps: 0,
        atText: {
          en: "Step-free lift from the concourse down to the Line 14 platform.",
          fr: "Ascenseur sans marches du hall jusqu'au quai de la ligne 14.",
          zh: "从大厅到 14 号线站台有无障碍电梯，全程无楼梯。",
        },
      },
      {
        name: "Châtelet",
        line: M14,
        coord: { lat: 48.8583, lng: 2.347 },
        into: {
          status: "ok",
          text: {
            en: "Ride Line 14 towards Saint-Lazare — 3 stops, fully step-free.",
            fr: "Ligne 14 vers Saint-Lazare — 3 stations, entièrement sans marches.",
            zh: "乘 14 号线往 Saint-Lazare 方向，3 站，全程无楼梯。",
          },
        },
        at: "unknown",
        steps: null,
        atText: {
          en: "Change here for RER C. The lift at this interchange is not reported — treat it as unknown.",
          fr: "Correspondance vers le RER C. L'ascenseur de cette correspondance n'est pas renseigné — à considérer comme inconnu.",
          zh: "在此换乘 RER C。此换乘处的电梯无数据，按“未知”处理。",
        },
      },
      {
        name: "Champ de Mars–Tour Eiffel",
        line: RERC,
        coord: { lat: 48.8556, lng: 2.2894 },
        into: {
          status: "unknown",
          text: {
            en: "Take RER C — 4 stops. Some RER C stations are step-free; confirm platform access on the day.",
            fr: "RER C — 4 stations. Certaines gares du RER C sont sans marches ; vérifiez l'accès au quai le jour même.",
            zh: "乘 RER C，4 站。RER C 部分车站无楼梯，请当天确认站台通行。",
          },
        },
        at: "lift_down",
        steps: 28,
        atText: {
          en: "The lift to street level is reported out of service today.",
          fr: "L'ascenseur vers la rue est signalé hors service aujourd'hui.",
          zh: "通往地面的电梯今日报告为故障。",
        },
        barrier: {
          en: "Out of service means 28 steps up to the exit.",
          fr: "Hors service signifie 28 marches jusqu'à la sortie.",
          zh: "电梯故障意味着出站要走 28 级台阶。",
        },
        alt: {
          en: "Stay on one more stop and take the level-boarding bus 82 back to the Tower.",
          fr: "Descendez une station plus loin et prenez le bus 82, à plancher bas, jusqu'à la Tour.",
          zh: "多坐一站，换乘低地板的 82 路公交返回铁塔。",
        },
      },
      {
        name: "Tour Eiffel",
        coord: { lat: 48.8584, lng: 2.2945 },
        into: {
          status: "ok",
          text: {
            en: "Level walk of about 700 m along the Champ de Mars (paved, gentle slope).",
            fr: "Marche à plat d'environ 700 m le long du Champ-de-Mars (pavé, légère pente).",
            zh: "沿战神广场步行约 700 米（铺装路面，缓坡），全程平坦。",
          },
        },
        walkM: 700,
        at: "lift",
        atText: {
          en: "The Tower's own lifts reach the 1st and 2nd floors.",
          fr: "Les ascenseurs de la Tour desservent les 1er et 2e étages.",
          zh: "铁塔自有电梯可达一层与二层。",
        },
        restroom: true,
      },
    ],
  },
  {
    id: "bastille-louvre",
    from: "Bastille",
    to: "Musée du Louvre",
    title: {
      en: "With a stroller · Bastille → the Louvre",
      fr: "Avec poussette · Bastille → le Louvre",
      zh: "推婴儿车 · 巴士底 → 卢浮宫",
    },
    sources: ["IDFM · État des ascenseurs", "RATP · accessible stations", "OpenStreetMap", "Louvre access info"],
    nodes: [
      {
        name: "Bastille",
        line: M1,
        coord: { lat: 48.8531, lng: 2.3692 },
        at: "stairs",
        steps: 34,
        atText: {
          en: "Line 1 is automated, but Bastille has no lift to the platform.",
          fr: "La ligne 1 est automatique, mais Bastille n'a pas d'ascenseur vers le quai.",
          zh: "1 号线为自动运行，但巴士底站没有通往站台的电梯。",
        },
        barrier: {
          en: "34 steps down to the platform, no lift.",
          fr: "34 marches jusqu'au quai, sans ascenseur.",
          zh: "下到站台要走 34 级台阶，无电梯。",
        },
        alt: {
          en: "Board a Line 14 station instead, or take the level-boarding bus 87.",
          fr: "Partez plutôt d'une station de la ligne 14, ou prenez le bus 87 à plancher bas.",
          zh: "改从 14 号线车站上车，或乘坐低地板的 87 路公交。",
        },
      },
      {
        name: "Palais Royal–Musée du Louvre",
        line: M1,
        coord: { lat: 48.8615, lng: 2.3364 },
        into: {
          status: "unknown",
          text: {
            en: "Ride Line 1 — 5 stops. Trains are level with the platform, but exit lifts vary by station.",
            fr: "Ligne 1 — 5 stations. Les rames sont de plain-pied, mais les ascenseurs de sortie varient selon les stations.",
            zh: "乘 1 号线，5 站。车厢与站台齐平，但各站出口电梯情况不一。",
          },
        },
        at: "unknown",
        steps: null,
        atText: {
          en: "Lift to street at this exit is not reported — unknown.",
          fr: "L'ascenseur vers la rue à cette sortie n'est pas renseigné — inconnu.",
          zh: "此出口通往地面的电梯无数据——未知。",
        },
      },
      {
        name: "Musée du Louvre",
        coord: { lat: 48.8606, lng: 2.3376 },
        into: {
          status: "ok",
          text: {
            en: "Short level walk (~250 m) to the Carrousel entrance.",
            fr: "Courte marche à plat (~250 m) jusqu'à l'entrée du Carrousel.",
            zh: "平坦步行约 250 米到 Carrousel 入口。",
          },
        },
        walkM: 250,
        at: "lift",
        atText: {
          en: "Step-free entry via the Carrousel lift, under the pyramid.",
          fr: "Entrée sans marches par l'ascenseur du Carrousel, sous la pyramide.",
          zh: "经金字塔下方的 Carrousel 电梯无障碍入馆。",
        },
        restroom: true,
      },
    ],
  },
  {
    id: "nord-cite",
    from: "Gare du Nord",
    to: "Île de la Cité",
    title: {
      en: "Older traveller · Gare du Nord → Notre-Dame",
      fr: "Voyageur âgé · Gare du Nord → Notre-Dame",
      zh: "年长者 · 北站 → 巴黎圣母院",
    },
    sources: ["IDFM · État des ascenseurs", "SNCF · gare accessibility", "OpenStreetMap"],
    nodes: [
      {
        name: "Gare du Nord",
        line: RERB,
        coord: { lat: 48.8809, lng: 2.3553 },
        at: "unknown",
        steps: null,
        atText: {
          en: "Gare du Nord is large; lift availability to the RER platform varies — treat as unknown.",
          fr: "Gare du Nord est vaste ; la disponibilité des ascenseurs vers le quai RER varie — à considérer comme inconnu.",
          zh: "北站规模大，通往 RER 站台的电梯情况不一——按“未知”处理。",
        },
      },
      {
        name: "Saint-Michel–Notre-Dame",
        line: RERB,
        coord: { lat: 48.853, lng: 2.3444 },
        into: {
          status: "unknown",
          text: {
            en: "RER B towards Saint-Michel — 3 stops.",
            fr: "RER B vers Saint-Michel — 3 stations.",
            zh: "乘 RER B 往 Saint-Michel 方向，3 站。",
          },
        },
        at: "stairs",
        steps: 40,
        atText: {
          en: "No step-free exit at Saint-Michel–Notre-Dame.",
          fr: "Pas de sortie sans marches à Saint-Michel–Notre-Dame.",
          zh: "Saint-Michel–Notre-Dame 站没有无楼梯出口。",
        },
        barrier: {
          en: "40 steps to street, no lift.",
          fr: "40 marches jusqu'à la rue, sans ascenseur.",
          zh: "出站到街面要走 40 级台阶，无电梯。",
        },
        alt: {
          en: "The level-boarding bus 47 stops near the cathedral forecourt.",
          fr: "Le bus 47, à plancher bas, s'arrête près du parvis de la cathédrale.",
          zh: "低地板的 47 路公交在圣母院广场附近停靠。",
        },
      },
      {
        name: "Île de la Cité",
        coord: { lat: 48.853, lng: 2.3499 },
        into: {
          status: "ok",
          text: {
            en: "Level walk ~300 m across the bridge to the forecourt.",
            fr: "Marche à plat ~300 m sur le pont jusqu'au parvis.",
            zh: "过桥平坦步行约 300 米到广场。",
          },
        },
        walkM: 300,
        at: "ok",
        atText: {
          en: "The cathedral forecourt is step-free.",
          fr: "Le parvis de la cathédrale est sans marches.",
          zh: "圣母院前广场无楼梯。",
        },
        restroom: false,
      },
    ],
  },
];

export const PROFILES = [
  { id: "wheelchair", labelKey: "profile_wheelchair" },
  { id: "stroller", labelKey: "profile_stroller" },
  { id: "senior", labelKey: "profile_senior" },
  { id: "lowenergy", labelKey: "profile_lowenergy" },
] as const;

export type ProfileId = (typeof PROFILES)[number]["id"];
