import type { Lang } from "./i18n";

export type L = Record<Lang, string>;

// ok = step-free · lift = working lift · lift_down = lift out of service
// conditional = there is a way through, but it has a condition on it: a booking,
//   a member of staff, or only some of the platforms
// stairs = steps required · unknown = we honestly do not know
//
// `conditional` exists because it is the commonest real answer and none of the
// other statuses can say it: 216 of the 945 stations are staff-or-booking in the
// operator's station register, and another 473 have some accessible platforms and
// some not in their stop register. "Working lift" would be a promise we cannot
// keep and "unknown" would throw away the part the traveller needs. Calling them "working lift" would be
// a promise we cannot keep, and calling them "unknown" would throw away a fact
// the traveller needs: there is a route, and it costs you a conversation.
export type Status = "ok" | "lift" | "conditional" | "lift_down" | "stairs" | "unknown";

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
  /** Today's disruption, and ONLY from a live feed. It is empty on every route
   *  because the feed that carries it (IDFM `etat-des-ascenseurs` and the
   *  real-time disruption endpoints) is published under Licence Mobilité and
   *  refuses our requests without a PRIM token. Writing a plausible strike here
   *  by hand is the one thing this field must never hold: a traveller cannot
   *  tell a fabricated disruption from a real one, and neither can a juror. */
  disruption?: L;
  sources: string[];
  nodes: RouteNode[];
  /** Every station the journey passes, for the map line. Present on a computed
   *  route; a route whose nodes are its whole shape can leave it out. */
  shape?: { lat: number; lng: number }[];
  /** The last walk in numbers, present on a computed route. See the comment on
   *  `PlannedRoute.finalWalk`: neither a hill nor twenty minutes of pushing is a
   *  station, so a summary that counts stations cannot see either. */
  finalWalk?: { metres: number; climbM: number | null; minutes: number } | null;
}

const M1 = { label: "M1", color: "#FFCD00" };
const RERB = { label: "RER B", color: "#7BA3DC" };

/**
 * What a hand-written route is allowed to cite.
 *
 * All three used to list "IDFM · État des ascenseurs", which is the live lift
 * dataset this app cannot read: it answers ForbiddenAccess without a registered
 * token, and /how-it-works says so on the same site. Two of them also cited
 * "RATP · accessible stations" and "SNCF · gare accessibility", neither of which
 * anything here has ever fetched. A source line is a claim about provenance, so it
 * names only what was actually read.
 */
function ROUTE_SOURCES(venue?: string): string[] {
  return [
    "IDFM · Accessibilité en gare (Licence Ouverte)",
    "IDFM · Référentiel des arrêts (Licence Ouverte)",
    "OpenStreetMap (lifts and stairways, ODbL)",
    ...(venue ? [venue] : []),
  ];
}

export const ROUTES: DemoRoute[] = [
  // The Gare de Lyon to Eiffel Tower route used to sit here and it has been
  // removed rather than corrected, because nothing in it could be corrected
  // without writing a new journey by hand. It changed onto RER C at Chatelet,
  // where RER C does not call (its central stops are Saint-Michel Notre-Dame,
  // Musee d'Orsay, Invalides, Pont de l'Alma, Champ de Mars). It said Gare de
  // Lyon to Chatelet on line 14 was three stops; the timetable says one. And its
  // centrepiece was a lift "reported out of service today" with 28 steps as the
  // consequence, which is a live status from the one dataset this app cannot read
  // and a step count from nowhere.
  //
  // The journey itself is still answerable and the router answers it for real:
  // there is no step-free station near the tower in the open timetable, so a
  // wheelchair is sent to Invalides and told the last 1,451 m are on foot. That is
  // a worse-sounding answer and a true one, which is the trade this product makes.
  {
    id: "bastille-louvre",
    from: "Bastille",
    to: "Musée du Louvre",
    title: {
      en: "Bastille → the Louvre",
      fr: "Bastille → le Louvre",
      zh: "巴士底 → 卢浮宫",
    },
    sources: ROUTE_SOURCES("Musée du Louvre official access page"),
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
            en: "Ride Line 1, 5 stops. Trains are level with the platform, but exit lifts vary by station.",
            fr: "Ligne 1, 5 stations. Les rames sont de plain-pied, mais les ascenseurs de sortie varient selon les stations.",
            zh: "乘 1 号线，5 站。车厢与站台齐平，但各站出口电梯情况不一。",
          },
        },
        at: "unknown",
        steps: null,
        atText: {
          en: "Lift to street at this exit is not reported, so it counts as unknown.",
          fr: "L'ascenseur vers la rue à cette sortie n'est pas renseigné, donc inconnu.",
          zh: "此出口通往地面的电梯无数据，按未知处理。",
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
      en: "Gare du Nord → Notre-Dame",
      fr: "Gare du Nord → Notre-Dame",
      zh: "北站 → 巴黎圣母院",
    },
    sources: ROUTE_SOURCES(),
    nodes: [
      {
        name: "Gare du Nord",
        line: RERB,
        coord: { lat: 48.8809, lng: 2.3553 },
        at: "unknown",
        steps: null,
        atText: {
          en: "Gare du Nord is large; lift availability to the RER platform varies, so treat it as unknown.",
          fr: "Gare du Nord est vaste ; la disponibilité des ascenseurs vers le quai RER varie, à considérer comme inconnu.",
          zh: "北站规模大，通往 RER 站台的电梯情况不一，按“未知”处理。",
        },
      },
      {
        name: "Saint-Michel–Notre-Dame",
        line: RERB,
        coord: { lat: 48.853, lng: 2.3444 },
        into: {
          status: "unknown",
          text: {
            en: "RER B towards Saint-Michel, 2 stops.",
            fr: "RER B vers Saint-Michel, 2 stations.",
            zh: "乘 RER B 往 Saint-Michel 方向，2 站。",
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
