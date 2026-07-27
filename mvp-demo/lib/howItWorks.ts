import type { Lang } from "./i18n";

/**
 * The content of the "How this works" page.
 *
 * It lives in the product rather than only in the pitch deck for one reason: two
 * of the things we are asked to demonstrate are claims about the build, and a
 * claim on a slide is worth less than a claim a juror can check while using the
 * thing. Every reason below is a reason that would change if the product were
 * different, which is the test for whether a justification is real. "Popular",
 * "free" and "what we already knew" are not on this page.
 */

export type Tri = Record<Lang, string>;

export interface Choice {
  /** The layer this belongs to, so the page reads as an architecture. */
  layer: "front" | "back" | "model" | "data";
  name: string;
  /** What it does here. Plain, from the user's side where possible. */
  role: Tri;
  /** Why this and not the obvious alternative. */
  because: Tri;
}

export const CHOICES: Choice[] = [
  {
    layer: "front",
    name: "Next.js 16, App Router",
    role: {
      en: "Renders both surfaces: the assistant at / and the route browser at /routes.",
      fr: "Rend les deux surfaces : l'assistant sur / et le navigateur d'itinéraires sur /routes.",
      zh: "渲染两个界面：/ 上的助手和 /routes 上的路线浏览页。",
    },
    because: {
      en: "The model key must never reach the browser, so we needed server code next to the interface rather than a separate backend to deploy and keep in sync. One framework, one deploy, and the key stays on the server.",
      fr: "La clé du modèle ne doit jamais atteindre le navigateur : il fallait du code serveur à côté de l'interface plutôt qu'un backend séparé à déployer et à synchroniser. Un framework, un déploiement, et la clé reste sur le serveur.",
      zh: "模型密钥绝不能到达浏览器，所以我们需要紧贴界面的服务端代码，而不是另一个需要部署和同步的后端。一个框架、一次部署，密钥留在服务端。",
    },
  },
  {
    layer: "front",
    name: "TypeScript",
    role: {
      en: "Types the one distinction the product is built on: a stop is step-free, has a lift, has a broken lift, has stairs, or is unknown.",
      fr: "Type la seule distinction sur laquelle repose le produit : un arrêt est sans marches, a un ascenseur, un ascenseur en panne, des escaliers, ou est inconnu.",
      zh: "为产品赖以成立的那个区分提供类型：一个站点是无楼梯、有电梯、电梯故障、有台阶，还是未知。",
    },
    because: {
      en: "Unknown is a value here, not a missing value. A step count is a number, or null meaning nobody recorded it, or absent meaning the question does not apply. The compiler refuses to let any screen quietly treat those three as the same thing, which is how a guess would get in.",
      fr: "Inconnu est ici une valeur, pas une valeur manquante. Un nombre de marches est un nombre, ou null si personne ne l'a relevé, ou absent si la question ne s'applique pas. Le compilateur interdit à tout écran de confondre ces trois cas, ce qui est la porte d'entrée d'une supposition.",
      zh: "未知在这里是一个值，不是缺失值。台阶数是一个数字，或 null 表示没人记录过，或不存在表示这个问题不适用。编译器不允许任何界面把这三者混为一谈，而混淆正是猜测溜进来的入口。",
    },
  },
  {
    layer: "front",
    name: "Tailwind v4 design tokens",
    role: {
      en: "Declares the status palette once, including the real RATP line colours.",
      fr: "Déclare la palette de statuts une seule fois, avec les vraies couleurs de lignes RATP.",
      zh: "只声明一次状态色板，包含真实的 RATP 线路颜色。",
    },
    because: {
      en: "The step diagram, the map markers and the chat card all draw the same trip. Declared once, they cannot disagree about what unknown looks like. Unknown is also hatched, never colour alone, so it survives colour blindness and a projector.",
      fr: "Le schéma, les marqueurs de carte et la carte de chat dessinent le même trajet. Déclarés une fois, ils ne peuvent pas se contredire sur l'apparence d'inconnu. Inconnu est aussi hachuré, jamais la couleur seule, pour résister au daltonisme et à un projecteur.",
      zh: "台阶示意图、地图标记和聊天卡片画的是同一趟行程。只声明一次，它们就不可能对未知的样子产生分歧。未知还带斜纹，从不只靠颜色，因此色盲和投影仪都不会毁掉它。",
    },
  },
  {
    layer: "back",
    name: "One server route for the model",
    role: {
      en: "Builds the prompt from the knowledge base, calls the model, and streams the answer back as it arrives.",
      fr: "Construit le prompt depuis la base de connaissances, appelle le modèle et diffuse la réponse au fil de son arrivée.",
      zh: "从知识库构建 prompt、调用模型，并在回答生成时逐步流式返回。",
    },
    because: {
      en: "The prompt is generated from the same data the screens read, so the model cannot know a price the app does not. It also caps history and body size, rate-limits per address, times out on connecting rather than mid-answer, and falls through to a second model if the first refuses.",
      fr: "Le prompt est généré depuis les mêmes données que lisent les écrans : le modèle ne peut pas connaître un prix que l'application ignore. Elle limite aussi l'historique et la taille du corps, restreint le débit par adresse, expire à la connexion et non en pleine réponse, et bascule sur un second modèle si le premier refuse.",
      zh: "prompt 由界面读取的同一份数据生成，所以模型不可能知道应用不知道的价格。它同时限制历史长度和请求体大小、按地址限流、只在建立连接时超时而不在回答中途超时，并在首选模型拒绝时切换到备用模型。",
    },
  },
  {
    layer: "model",
    name: "DeepSeek, a reasoning model",
    role: {
      en: "Reads the request, weighs it against the route data, and writes the answer. Its reasoning is shown to you as it thinks.",
      fr: "Lit la demande, la confronte aux données d'itinéraire et rédige la réponse. Son raisonnement vous est montré pendant qu'il réfléchit.",
      zh: "读取请求、对照路线数据权衡，然后写出回答。它的推理过程会实时展示给你。",
    },
    because: {
      en: "We chose a model that returns its reasoning separately from its answer, because this product's whole claim is that it is honest about what it does not know. A model that only returns conclusions would have made that reasoning invisible, and you would have had to take our word for it.",
      fr: "Nous avons choisi un modèle qui renvoie son raisonnement séparément de sa réponse, car toute la promesse de ce produit est d'être honnête sur ce qu'il ignore. Un modèle qui ne renvoie que des conclusions aurait rendu ce raisonnement invisible, et il aurait fallu nous croire sur parole.",
      zh: "我们选了一个把推理和答案分开返回的模型，因为这个产品的全部主张就是对自己不知道的东西保持诚实。只返回结论的模型会让推理过程不可见，你就只能听我们空口一说。",
    },
  },
  {
    layer: "data",
    name: "No database",
    role: {
      en: "The knowledge base is a typed file in the codebase: 17 places, 5 practical services, 3 routes.",
      fr: "La base de connaissances est un fichier typé dans le code : 17 lieux, 5 services pratiques, 3 itinéraires.",
      zh: "知识库是代码库里的一个带类型的文件：17 个地点、5 项实用服务、3 条路线。",
    },
    because: {
      en: "Every record was checked by a person and carries how confident that check was. A database would add something to run, back up and keep available during a demo, and it would not add a single verified fact. When a fact changes we change the file and redeploy, and the change is in the git history with a reason.",
      fr: "Chaque enregistrement a été vérifié par une personne et porte le degré de confiance de cette vérification. Une base de données ajouterait quelque chose à faire tourner, sauvegarder et maintenir disponible pendant une démo, sans ajouter un seul fait vérifié. Quand un fait change, nous changeons le fichier et redéployons, et le changement est dans l'historique git avec sa raison.",
      zh: "每条记录都由人核对过，并记录了这次核对的可信程度。数据库会增加一个需要运行、备份、并在演示期间保持可用的东西，却不会增加任何一条已核实的事实。事实变了，我们就改文件并重新部署，改动连同理由都留在 git 历史里。",
    },
  },
  {
    layer: "data",
    name: "OpenStreetMap, Paris and Île-de-France open data",
    role: {
      en: "Metro entrances, lifts, stairways and step-free venues. Cached to disk, with the URL, the time and a checksum for each file.",
      fr: "Entrées de métro, ascenseurs, escaliers et lieux sans marches. Mis en cache sur disque, avec l'URL, l'heure et une somme de contrôle par fichier.",
      zh: "地铁出入口、电梯、楼梯和无楼梯场所。缓存到磁盘，每个文件都记录 URL、时间和校验和。",
    },
    because: {
      en: "A live query during a demo depends on the venue's wifi and on a free shared service staying up for the ten minutes that matter. Cached, it also means anyone can re-run the fetch and compare, which is what makes the open-data claim checkable rather than stated.",
      fr: "Une requête en direct pendant une démo dépend du wifi de la salle et d'un service gratuit partagé qui doit tenir les dix minutes qui comptent. En cache, cela permet aussi à quiconque de relancer la récupération et de comparer, ce qui rend la revendication de données ouvertes vérifiable plutôt qu'affirmée.",
      zh: "演示时的实时查询取决于场地 wifi，以及一个免费共享服务能否在关键的十分钟里不出问题。缓存之后，任何人都可以重跑抓取并比对，这才让开放数据这个说法可核查，而不只是一句声明。",
    },
  },
  {
    layer: "data",
    name: "Open-Meteo, live",
    role: {
      en: "The one source fetched while you use the app. Current Paris weather, in the header and in the model's context.",
      fr: "La seule source récupérée pendant que vous utilisez l'application. Météo actuelle de Paris, dans l'en-tête et dans le contexte du modèle.",
      zh: "使用应用期间唯一实时抓取的数据源。当前巴黎天气，出现在页头和模型上下文里。",
    },
    because: {
      en: "Rain changes a step-free plan: an outdoor walk that works in the sun is a different trip in a downpour. No key is needed, it is cached for ten minutes, and if it is unavailable the assistant loses one sentence of context and nothing else.",
      fr: "La pluie change un plan sans marches : une marche extérieure qui passe au soleil est un autre trajet sous une averse. Aucune clé n'est requise, c'est mis en cache dix minutes, et en cas d'indisponibilité l'assistant perd une phrase de contexte, rien de plus.",
      zh: "下雨会改变无楼梯方案：晴天走得通的户外路段，在暴雨里是另一趟行程。不需要密钥，缓存十分钟，若不可用助手只少一句上下文，别无影响。",
    },
  },
  {
    layer: "data",
    name: "Two maps, on purpose",
    role: {
      en: "Google Maps for the flat view, and a keyless 3D view built on OpenStreetMap vector tiles.",
      fr: "Google Maps pour la vue plane, et une vue 3D sans clé construite sur des tuiles vectorielles OpenStreetMap.",
      zh: "平面视图用 Google Maps，3D 视图基于 OpenStreetMap 矢量瓦片、无需密钥。",
    },
    because: {
      en: "The flat map is the one that renders anywhere, so it is the default. The 3D view shows the terrain a long walk actually crosses, which a flat map hides. Either can fail on the day, so each says so out loud instead of leaving a grey rectangle, and the 3D view falls back to the flat one.",
      fr: "La carte plane s'affiche partout, c'est donc la valeur par défaut. La vue 3D montre le relief qu'une longue marche traverse réellement, ce qu'une carte plane masque. Les deux peuvent échouer le jour J : chacune le dit clairement au lieu de laisser un rectangle gris, et la 3D bascule sur la vue plane.",
      zh: "平面地图在任何环境都能渲染，所以是默认。3D 视图能显示一段长距离步行真正要穿过的地形，而平面地图会把它藏起来。两者当天都可能失败，所以各自都会明说，而不是留下一块灰色矩形，且 3D 会退回平面视图。",
    },
  },
];

export interface Guard {
  title: Tri;
  body: Tri;
}

/**
 * How we keep the assistant from inventing things. This is the section the
 * course asks for under "AI content verification", and it is also the reason the
 * product exists: a confident wrong answer about a lift is worse than no answer,
 * because someone acts on it and then cannot get back out.
 */
export const GUARDS: Guard[] = [
  {
    title: {
      en: "The model can only use facts we put in front of it",
      fr: "Le modèle ne peut utiliser que les faits que nous lui présentons",
      zh: "模型只能使用我们摆在它面前的事实",
    },
    body: {
      en: "Prices, opening hours, lift statuses and step counts come from the knowledge base, injected into the prompt from the same file the screens read. The assistant is told that anything missing is unknown or a pointer to the official site, never a reasonable guess.",
      fr: "Prix, horaires, états d'ascenseurs et nombres de marches viennent de la base de connaissances, injectés dans le prompt depuis le fichier même que lisent les écrans. Il est indiqué à l'assistant que tout ce qui manque est inconnu ou un renvoi au site officiel, jamais une supposition plausible.",
      zh: "价格、开放时间、电梯状态和台阶数都来自知识库，从界面读取的同一个文件注入 prompt。助手被告知：缺失的内容一律是未知，或指向官方网站，绝不是一个看起来合理的猜测。",
    },
  },
  {
    title: {
      en: "Two tiers of fact, labelled as such",
      fr: "Deux niveaux de fait, étiquetés comme tels",
      zh: "两层事实，并如实标注",
    },
    body: {
      en: "The sights were checked one at a time against each venue's own site. The restaurants and the pharmacy come from OpenStreetMap accessibility tags, which are a contributor's observation and not the venue's confirmation, so those records say they are unconfirmed and give you a number to ring ahead. One is step-free at the door and explicitly not at the toilet.",
      fr: "Les sites ont été vérifiés un par un sur le site de chaque lieu. Les restaurants et la pharmacie viennent d'étiquettes d'accessibilité OpenStreetMap, qui sont l'observation d'un contributeur et non la confirmation du lieu : ces fiches indiquent qu'elles ne sont pas confirmées et donnent un numéro pour appeler avant. L'un est sans marches à l'entrée et explicitement pas aux toilettes.",
      zh: "景点是逐个对照各场所官网核对的。餐厅和药店来自 OpenStreetMap 的无障碍标签，那是贡献者的观察而不是场所的确认，所以这些记录会说明自己未经确认，并给出可以提前打的电话。其中一家门口无台阶，而卫生间明确不是。",
    },
  },
  {
    title: {
      en: "An entitlement is never quoted without its condition",
      fr: "Un droit n'est jamais cité sans sa condition",
      zh: "任何权益都不会脱离条件被引用",
    },
    body: {
      en: "Free entry for a disabled visitor and a companion is real at several sites, and at every one of them it depends on something: a document at the desk, a timeslot booked in advance, a particular entrance. The Louvre does not publish which non-French documents count. So the condition is stated in the same sentence as the entitlement, because a traveller told only the good half books a flight and is refused at the desk.",
      fr: "La gratuité pour une personne handicapée et son accompagnateur existe sur plusieurs sites, et dépend partout de quelque chose : un justificatif au guichet, un créneau réservé, une entrée précise. Le Louvre ne publie pas quels justificatifs non français sont acceptés. La condition est donc énoncée dans la même phrase que le droit, car un voyageur à qui l'on ne dit que la bonne moitié réserve un vol et se voit refuser au guichet.",
      zh: "残障游客及一名陪同免费入场在多个场所是真的，而每一处都取决于某个条件：售票处的证明文件、提前预约的时段、特定的入口。卢浮宫并未公布哪些非法国证件被接受。所以条件必须和权益写在同一句里，否则只被告知好的一半的旅客会订好机票，然后在售票处被拒。",
    },
  },
  {
    title: {
      en: "Every answer carries where it came from and when",
      fr: "Chaque réponse indique sa source et sa date",
      zh: "每个回答都带着来源和日期",
    },
    body: {
      en: "Prices and opening times are given with the date they were checked and a link to the official site, so you can confirm before you travel. Lift status is described as of this morning, not as live, because we do not have a live feed and saying otherwise would be the most dangerous sentence in the product.",
      fr: "Les prix et horaires sont donnés avec la date de vérification et un lien vers le site officiel, pour confirmer avant de partir. L'état des ascenseurs est présenté comme celui de ce matin, non comme du temps réel, car nous n'avons pas de flux en direct et prétendre le contraire serait la phrase la plus dangereuse du produit.",
      zh: "价格和开放时间都附带核对日期和官方网站链接，方便你出行前确认。电梯状态被描述为今早的情况，而不是实时，因为我们没有实时数据源，声称有会是这个产品里最危险的一句话。",
    },
  },
  {
    title: {
      en: "A person reads the answers, and it is not the person who wrote the code",
      fr: "Une personne relit les réponses, et ce n'est pas celle qui a écrit le code",
      zh: "有人在读这些回答，而且不是写代码的那个人",
    },
    body: {
      en: "Three of us test the assistant and flag answers that are wrong, missing something, or invented, and those reports are what changed the data and the prompt. Review by someone who did not build it is the only part of this that catches a mistake the builder cannot see.",
      fr: "Trois d'entre nous testent l'assistant et signalent les réponses fausses, incomplètes ou inventées, et ces signalements sont ce qui a fait évoluer les données et le prompt. La relecture par quelqu'un qui n'a pas construit l'outil est la seule partie qui attrape une erreur invisible pour son auteur.",
      zh: "我们三个人测试助手，把错误的、缺失的或编造的回答标出来，正是这些反馈改动了数据和 prompt。由没参与搭建的人来审查，是这里唯一能抓住搭建者自己看不见的错误的环节。",
    },
  },
];

/** Counted from the cached open data on 2026-07-26, central Paris. */
/** The two registers the app reads at runtime rather than copying into the repo,
 *  listed here because "we use open data" means nothing without the dataset id,
 *  the licence, and what breaks if it is missing. */
export const LIVE_SOURCES: { name: string; licence: string; url: string; role: Tri }[] = [
  {
    name: "IDFM · Accessibilité en gare",
    licence: "Licence Ouverte v2.0 (Etalab)",
    url: "https://data.iledefrance-mobilites.fr/explore/dataset/accessibilite-en-gare/",
    role: {
      en: "The operator's own accessibility class for 459 stops, shown beside every stop on a route. 213 are simply not accessible, 174 need a booking made in advance, 58 need a member of staff, 14 work on your own.",
      fr: "La classe d'accessibilité de l'exploitant pour 459 arrêts, affichée à côté de chaque arrêt d'un itinéraire. 213 ne sont pas accessibles, 174 exigent une réservation préalable, 58 l'aide d'un agent, 14 fonctionnent en autonomie.",
      zh: "运营方对 459 个站点的无障碍等级，显示在路线的每一站旁边。其中 213 站完全不可通行，174 站需提前预约，58 站需站内工作人员协助，14 站可自行通行。",
    },
  },
  {
    name: "IDFM · Toilettes publiques dans le réseau RATP",
    licence: "Licence ODbL",
    url: "https://data.iledefrance-mobilites.fr/explore/dataset/sanitaires-reseau-ratp/",
    role: {
      en: "The 43 toilets in the network marked usable by someone with reduced mobility, with whether they are free and whether they sit inside the ticket gates, which decides whether reaching one costs a fare.",
      fr: "Les 43 toilettes du réseau signalées utilisables par une personne à mobilité réduite, avec la gratuité et la position par rapport aux valideurs, qui décide si y accéder coûte un ticket.",
      zh: "网络中 43 处标注为行动不便者可用的厕所，并说明是否免费、是否在闸机内（这决定了去一趟是否要额外付费）。",
    },
  },
];

export const MEASURED: { value: string; label: Tri }[] = [
  {
    value: "95.7%",
    label: {
      en: "of metro entrances record whether they are wheelchair accessible (529 of 553)",
      fr: "des entrées de métro indiquent si elles sont accessibles en fauteuil (529 sur 553)",
      zh: "的地铁出入口记录了是否轮椅可达（553 处中 529 处）",
    },
  },
  {
    value: "40.4%",
    label: {
      en: "of stairways record how many steps they are (1,313 of 3,246)",
      fr: "des escaliers indiquent leur nombre de marches (1 313 sur 3 246)",
      zh: "的楼梯记录了台阶数量（3,246 处中 1,313 处）",
    },
  },
  {
    value: "269",
    label: {
      en: "of 1,121 step-free venues say anything about their toilet",
      fr: "sur 1 121 lieux sans marches disent quelque chose de leurs toilettes",
      zh: "在 1,121 个无楼梯场所中，只有这些说明了卫生间情况",
    },
  },
];
