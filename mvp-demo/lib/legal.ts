import type { Lang } from "./i18n";

/**
 * What happens to what you type, and how accessible this thing actually is.
 *
 * Both statements are here as data rather than prose in a component because both
 * are lists of checkable claims, and every one of them is written to be checked:
 * "nothing is logged" is `grep -rn "console\." app lib components` coming back
 * empty, "no analytics" is the absence of a script tag, "your words go to
 * DeepSeek" is one fetch in one route handler.
 *
 * The uncomfortable line is the third one. Someone who types "I use a
 * wheelchair" has told us something about their health, and that sentence
 * leaves the European Union to reach the model. We store none of it and log none
 * of it, and a product that would not say so out loud has no business claiming
 * the honesty this one claims.
 */

export type Tri = Record<Lang, string>;

export interface Claim {
  /** Short label, so the page scans as a list of answers rather than a policy. */
  title: Tri;
  body: Tri;
  /** How a reader could check it themselves, where that is possible. */
  check?: Tri;
}

export const DATA_CLAIMS: Claim[] = [
  {
    title: {
      en: "Your question leaves Europe",
      fr: "Votre question quitte l'Europe",
      zh: "你的问题会离开欧洲",
    },
    body: {
      en: "The assistant is DeepSeek, a model hosted in China. Your message and the conversation above it are sent to api.deepseek.com to be answered, and the answer streams straight back to you. If you write that you use a wheelchair, that sentence goes with it. We do not send your address, your name or your location, because we never ask for them, and we do not send anything you have not typed.",
      fr: "L'assistant est DeepSeek, un modèle hébergé en Chine. Votre message et la conversation qui le précède sont envoyés à api.deepseek.com pour obtenir une réponse, qui vous revient directement. Si vous écrivez que vous utilisez un fauteuil roulant, cette phrase part avec. Nous n'envoyons ni votre nom, ni votre adresse, ni votre position : nous ne les demandons jamais, et rien de ce que vous n'avez pas tapé n'est transmis.",
      zh: "助手使用的是 DeepSeek，一个部署在中国的模型。你的消息以及上方的对话会被发送到 api.deepseek.com 以生成回答，回答再直接流回给你。如果你写了自己使用轮椅，这句话也会一起发过去。我们不会发送你的姓名、地址或位置 —— 因为我们从不索取，也不会传输任何你没有输入的内容。",
    },
    check: {
      en: "It is the only request made while answering you that carries anything you typed, and it is one fetch in app/api/chat/route.ts. Two other requests go out with your answer, the weather and the operator's accessibility register, and neither sends any part of your message.",
      fr: "C'est la seule requête émise pour vous répondre qui transporte ce que vous avez écrit, et c'est un seul fetch dans app/api/chat/route.ts. Deux autres requêtes partent avec votre réponse, la météo et le registre d'accessibilité de l'opérateur, et aucune n'envoie une partie de votre message.",
      zh: "这是回答你的过程中唯一携带你输入内容的请求，就是 app/api/chat/route.ts 里的一次 fetch。另有两个请求会一同发出（天气、运营方无障碍登记），它们都不发送你消息的任何部分。",
    },
  },
  {
    title: {
      en: "Nothing you type is stored on our side",
      fr: "Rien de ce que vous tapez n'est conservé chez nous",
      zh: "你输入的内容不会存在我们这边",
    },
    body: {
      en: "Your conversation is held by your own browser and never reaches our database. There is a database, and what it holds is our own staff's corrections to public information about Paris landmarks, which is the same data this site already shows everybody. Your messages are not in it, cannot be put in it, and there is no table they would fit. Our server forwards your message, streams the answer back, and forgets both: no copy, no log line. Nobody on the team can read what you asked.",
      fr: "Votre conversation est conservée par votre navigateur et n'atteint jamais notre base de données. Une base existe, et elle ne contient que les corrections apportées par notre équipe à des informations publiques sur les monuments parisiens, les mêmes que ce site affiche déjà à tout le monde. Vos messages n'y sont pas, ne peuvent pas y être mis, et aucune table ne pourrait les accueillir. Notre serveur transmet votre message, renvoie la réponse en flux, puis oublie les deux : aucune copie, aucune ligne de journal. Personne dans l'équipe ne peut lire vos questions.",
      zh: "你的对话由你自己的浏览器保存，永远不会进入我们的数据库。数据库是有的，里面装的是我们团队对巴黎景点公开信息的校正 —— 也就是本站已经展示给所有人的同一批数据。你的消息不在里面，也放不进去，那里根本没有能装它的表。我们的服务器转发你的消息、把回答流式送回，然后两者都忘掉：不留副本、不写日志。团队里没有人能读到你问了什么。",
    },
    check: {
      en: "The project contains no logging call at all: grep for console. in app, lib and components comes back empty. And you can read the database's shape: supabase/schema.sql is in the repository. Two tables are written, place_overrides and the log of who changed it, and their columns are a landmark's wheelchair access, its step-free route from the station, a note, open or closed, and the date somebody checked. Not one column could hold a message.",
      fr: "Le projet ne contient aucun appel de journalisation : un grep de console. dans app, lib et components ne renvoie rien. Et la forme de la base est lisible : supabase/schema.sql est dans le dépôt. Deux tables sont écrites, place_overrides et le journal de ses modifications, et leurs colonnes sont l'accès en fauteuil d'un monument, son trajet sans marches depuis la gare, une note, ouvert ou fermé, et la date du dernier contrôle. Aucune colonne ne pourrait contenir un message.",
      zh: "项目里没有任何日志调用：在 app、lib、components 里 grep console. 结果为空。数据库的结构也是可读的：supabase/schema.sql 就在仓库里。被写入的表只有两张 —— place_overrides 和它的修改日志，字段是某个景点的轮椅通行情况、从车站进去的无楼梯路径、一条备注、开放或关闭、以及最后一次核对的日期。没有任何一个字段能装下一条消息。",
    },
  },
  {
    title: {
      en: "No account, no tracking, no cookie banner",
      fr: "Pas de compte, pas de traçage, pas de bandeau cookies",
      zh: "无需账号、无追踪、无 cookie 横幅",
    },
    body: {
      en: "You are not asked to sign in and you are not counted. There is deliberately no traveller account, even though the database that would hold one now exists: an account here would mean storing that a named person uses a wheelchair, and cross-device convenience is not worth holding that. There is no analytics script, no advertising pixel and no third-party tracker, which is also why there is no consent banner to click away: the only cookie this site can set belongs to the staff console and only exists once somebody logs into it. Your language choice and your conversation are kept in your browser's own storage, not sent anywhere.",
      fr: "Aucune connexion demandée, aucun comptage. Il n'y a délibérément aucun compte voyageur, alors que la base qui pourrait en héberger un existe désormais : un compte signifierait conserver qu'une personne nommée utilise un fauteuil roulant, et la commodité multi-appareils ne vaut pas cela. Pas de script d'analyse, pas de pixel publicitaire, pas de traceur tiers, et donc pas de bandeau de consentement à écarter : le seul cookie possible appartient à la console d'équipe et n'existe qu'après une connexion. Votre choix de langue et votre conversation restent dans le stockage de votre navigateur.",
      zh: "不需要登录，也不会被计数。旅客账号是刻意不做的 —— 即便现在已经有了能装账号的数据库：做账号就意味着要保存「某个具名的人使用轮椅」，跨设备的方便不值这个代价。没有分析脚本、没有广告像素、没有第三方追踪器 —— 所以也没有需要点掉的同意横幅：本站唯一可能设置的 cookie 属于团队后台，且只在有人登录后才存在。语言选择和对话内容都留在你浏览器的本地存储里，不会外发。",
    },
  },
  {
    title: {
      en: "The map and the data sources you touch",
      fr: "La carte et les sources de données que vous sollicitez",
      zh: "你会接触到的地图与数据源",
    },
    body: {
      en: "Loading a map asks Google (flat view) or OpenFreeMap (3D view) for tiles, so those services see that a browser somewhere requested a piece of Paris. The weather, the transport accessibility register and the accessible toilets are fetched by our server rather than by you, so those three see our server and never your browser.",
      fr: "Afficher une carte demande des tuiles à Google (plan) ou à OpenFreeMap (3D) : ces services voient donc qu'un navigateur a demandé un morceau de Paris. La météo, le registre d'accessibilité des gares et les toilettes accessibles sont récupérés par notre serveur et non par vous : ces trois-là voient notre serveur, jamais votre navigateur.",
      zh: "加载地图会向 Google（平面）或 OpenFreeMap（3D）请求瓦片，所以这两个服务会知道「某个浏览器请求了巴黎的某一块」。天气、车站无障碍名录、无障碍厕所这三项由我们的服务器获取，它们只看到我们的服务器，永远看不到你的浏览器。",
    },
  },
  {
    title: {
      en: "Nothing here asks for permissions",
      fr: "Rien ici ne demande d'autorisation",
      zh: "本站不索取任何权限",
    },
    body: {
      en: "The site does not ask for your location, your camera or a payment method, and the browser is told to refuse all three on our behalf even if some future code asked. The microphone is the one exception, used only while you hold the dictation button, and the words are transcribed by your own browser rather than sent to us.",
      fr: "Le site ne demande ni votre position, ni votre caméra, ni un moyen de paiement, et le navigateur a pour instruction de refuser les trois pour nous, même si un code futur les demandait. Le micro est la seule exception, actif uniquement pendant que vous appuyez sur la dictée, et la transcription est faite par votre navigateur, pas envoyée chez nous.",
      zh: "本站不索取你的位置、摄像头或支付方式，而且我们已在响应头里让浏览器代为拒绝这三项 —— 即便将来有代码去请求也一样。麦克风是唯一例外：只在你按住语音输入时启用，且转写由你的浏览器完成，不会发给我们。",
    },
    check: {
      en: "Permissions-Policy: camera=(), geolocation=(), payment=(), usb=(), microphone=(self)",
      fr: "Permissions-Policy : camera=(), geolocation=(), payment=(), usb=(), microphone=(self)",
      zh: "Permissions-Policy: camera=(), geolocation=(), payment=(), usb=(), microphone=(self)",
    },
  },
];

export const A11Y_CLAIMS: Claim[] = [
  {
    title: {
      en: "What we aim at, and what we have not done",
      fr: "Ce que nous visons, et ce que nous n'avons pas fait",
      zh: "我们的目标，以及我们没做的事",
    },
    body: {
      en: "The target is WCAG 2.2 level AA. It has not been audited by anyone outside the team, and a product about accessibility should not imply otherwise. What follows is what we built and tested ourselves, so you know which parts to trust and which to check.",
      fr: "L'objectif est le niveau AA des WCAG 2.2. Aucun audit externe n'a été réalisé, et un produit qui parle d'accessibilité ne devrait pas laisser croire le contraire. Voici ce que nous avons construit et testé nous-mêmes, pour que vous sachiez quoi croire et quoi vérifier.",
      zh: "目标是 WCAG 2.2 AA 级。没有经过团队之外的任何审计，而一个讲无障碍的产品不该让人以为有。下面是我们自己做过并测过的部分，好让你知道哪些可以信、哪些需要自己核。",
    },
  },
  {
    title: {
      en: "Never colour alone",
      fr: "Jamais la couleur seule",
      zh: "从不只靠颜色",
    },
    body: {
      en: "Every accessibility status carries an icon and a word as well as a colour, and the unknown status also carries a hatched pattern. Nobody has to distinguish green from red to use this.",
      fr: "Chaque état d'accessibilité porte une icône et un mot en plus de la couleur, et l'état inconnu porte aussi une trame hachurée. Personne n'a besoin de distinguer le vert du rouge pour s'en servir.",
      zh: "每一种无障碍状态除了颜色，还带图标和文字，「未知」状态另外带斜纹图案。不需要分辨红绿也能使用。",
    },
  },
  {
    title: {
      en: "Keyboard and screen reader",
      fr: "Clavier et lecteur d'écran",
      zh: "键盘与屏幕阅读器",
    },
    body: {
      en: "Every control is reachable by keyboard with a visible focus ring, the suggestion list under each journey field moves with the arrow keys and is chosen with Enter, touch targets are at least 44 pixels, the answer is announced to a screen reader as it arrives, and read-aloud speaks the words of a link rather than spelling out its address. Expanding panels say whether they are open and what they control.",
      fr: "Chaque commande est accessible au clavier avec un anneau de focus visible, la liste de suggestions sous chaque champ se parcourt aux flèches et se valide avec Entrée, les cibles tactiles font au moins 44 pixels, la réponse est annoncée au lecteur d'écran à mesure qu'elle arrive, et la lecture à voix haute prononce le libellé d'un lien plutôt que son adresse. Les panneaux dépliables indiquent leur état et ce qu'ils contrôlent.",
      zh: "所有控件都可用键盘操作并有可见焦点环，起终点输入框下方的建议列表可用方向键上下移动、回车选中，触摸目标不小于 44 像素，回答在生成过程中会播报给屏幕阅读器，朗读时读的是链接的文字而不是拼读网址。可展开面板会说明自己是否展开、控制的是哪一块。",
    },
  },
  {
    title: {
      en: "Motion is optional",
      fr: "Le mouvement est optionnel",
      zh: "动效可以关掉",
    },
    body: {
      en: "If your system asks for reduced motion, animation stops. Nothing on the page needs an animation to finish before it can be read: the one drawn line starts from its finished state, so with motion off it is simply already there.",
      fr: "Si votre système demande une réduction des animations, elles s'arrêtent. Rien sur la page n'a besoin qu'une animation se termine pour être lisible : le seul tracé animé part de son état final, donc sans animation il est déjà là.",
      zh: "如果你的系统要求减少动效，动画就会停止。页面上没有任何内容需要等动画播完才能读：唯一那条绘制线的默认状态就是画完的状态，关掉动效它本来就在那里。",
    },
  },
  {
    title: {
      en: "Three languages, and the operator's own words",
      fr: "Trois langues, et les mots de l'exploitant",
      zh: "三种语言，以及运营方的原话",
    },
    body: {
      en: "Everything a traveller reads exists in English, French and Chinese. Where we show the transport operator's accessibility class we keep their French underneath the translation, because a translation is an interpretation and this one decides whether somebody can leave a station.",
      fr: "Tout ce que lit un voyageur existe en anglais, en français et en chinois. Quand nous affichons la classe d'accessibilité de l'exploitant, nous gardons son français sous la traduction : une traduction est une interprétation, et celle-ci décide si quelqu'un peut sortir d'une gare.",
      zh: "出行者读到的所有内容都有英文、法文、中文三版。展示运营方的无障碍等级时，我们在译文下保留他们的法文原文 —— 翻译就是一种解读，而这一句决定的是一个人能不能出站。",
    },
  },
  {
    title: {
      en: "If something here blocks you",
      fr: "Si quelque chose vous bloque ici",
      zh: "如果这里有东西挡住了你",
    },
    body: {
      en: "Tell us and it gets fixed rather than argued about. The project is public and issues are open to anyone: github.com/calderbuild/summerschool-6-touristAgent. A barrier in a website about barriers is worth reporting.",
      fr: "Dites-le nous et ce sera corrigé plutôt que discuté. Le projet est public et les tickets sont ouverts à tous : github.com/calderbuild/summerschool-6-touristAgent. Un obstacle dans un site qui parle d'obstacles mérite d'être signalé.",
      zh: "告诉我们，我们会修，而不是辩解。项目是公开的，任何人都可以提 issue：github.com/calderbuild/summerschool-6-touristAgent。一个讲障碍的网站里出现障碍，值得被指出来。",
    },
  },
];
