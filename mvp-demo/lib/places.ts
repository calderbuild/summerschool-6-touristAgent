// Curated Paris places knowledge base for the touristAgent chatbot grounding.
// Generated from data/build_places.py; human-facing copy: data/paris-places.xlsx.
// Verified 2026-07-23 (2026 prices + open/closed status). Unknowns are honest, not guessed.

export type PlaceCategory =
  | "Monument"
  | "Museum"
  | "Cathedral"
  | "Basilica"
  | "Park"
  | "Palace"
  | "Shopping"
  | "Restaurant"
  | "Pharmacy";

export interface Place {
  id: string;
  nameEn: string;
  nameFr: string;
  category: PlaceCategory;
  arrondissement: string;
  coord: { lat: number; lng: number };
  visitDuration: string;
  budget: string; // adult entry cost in EUR, or "Free"
  free: boolean; // entry to the site is free
  openingHours: string;
  nearestTransit: string;
  stationStepFree: string;
  wheelchair: string;
  accessibleToilet: string;
  status: "open" | "closed";
  officialUrl: string;
  source: string;
  lastVerified: string;
  notes: string;
}

export const PLACES: Place[] = [
  {
    id: "eiffel-tower",
    nameEn: "Eiffel Tower",
    nameFr: "Tour Eiffel",
    category: "Monument",
    arrondissement: "7th (75007)",
    coord: { lat: 48.8584, lng: 2.2945 },
    visitDuration: "2-3 h",
    budget: "€36.70 summit (lift); €23.50 2nd floor (lift); €14.80 stairs to 2nd",
    free: false,
    openingHours: "≈09:30-23:45 daily (extended in summer)",
    nearestTransit: "RER C Champ de Mars-Tour Eiffel; M6 Bir-Hakeim",
    stationStepFree: "Partial (RER C Champ de Mars step-free; M6 Bir-Hakeim not)",
    wheelchair: "Partial (1st & 2nd floors by lift; summit not accessible)",
    accessibleToilet: "Yes",
    status: "open",
    officialUrl: "https://www.toureiffel.paris/en",
    source: "Official site + web search 2026-07-23",
    lastVerified: "2026-07-23",
    notes: "Summit closed to wheelchair users. Book online in advance.",
  },
  {
    id: "louvre",
    nameEn: "Louvre Museum",
    nameFr: "Musée du Louvre",
    category: "Museum",
    arrondissement: "1st (75001)",
    coord: { lat: 48.8606, lng: 2.3376 },
    visitDuration: "3-4 h (half day)",
    budget: "€22 (EEA residents); €32 (non-EEA)",
    free: false,
    openingHours: "09:00-18:00; late to 21:45 Wed & Fri; closed Tue",
    nearestTransit: "M1/M7 Palais Royal-Musée du Louvre",
    stationStepFree: "Partial (line 14 Pyramides/Châtelet nearby are step-free)",
    wheelchair:
      "Yes (fully accessible; free for a disabled visitor + 1 companion, supporting document required at the desk)",
    accessibleToilet: "Yes",
    status: "open",
    officialUrl: "https://www.louvre.fr/en",
    source: "Official site + web search 2026-07-23",
    lastVerified: "2026-07-23",
    notes:
      "New 2026 dual pricing (EEA vs non-EEA). Free under 18, EU 18-25, 1st Sat evening. A disabled visitor and their companion are exempt from the 1 Jul to 31 Aug 2026 reservation requirement and have priority access without queuing (louvre.fr accessibility pages, checked 2026-07-26).",
  },
  {
    id: "notre-dame",
    nameEn: "Notre-Dame Cathedral",
    nameFr: "Cathédrale Notre-Dame de Paris",
    category: "Cathedral",
    arrondissement: "4th (75004)",
    coord: { lat: 48.853, lng: 2.3499 },
    visitDuration: "1 h (cathedral)",
    budget: "Cathedral free; Bell Towers €16",
    free: true,
    openingHours: "≈08:00-19:00 (free reservation online)",
    nearestTransit: "M4 Cité; RER B/C Saint-Michel-Notre-Dame",
    stationStepFree: "Partial (Cité limited)",
    wheelchair: "Yes (cathedral, step-free entrance); No (towers, ~424 steps)",
    accessibleToilet: "Unknown (public toilets nearby)",
    status: "open",
    officialUrl: "https://www.notredamedeparis.fr/en/",
    source: "Official site + web search 2026-07-23",
    lastVerified: "2026-07-23",
    notes: "Reopened Dec 2024; towers reopened Sep 2025. Free timed reservation recommended.",
  },
  {
    id: "arc-de-triomphe",
    nameEn: "Arc de Triomphe",
    nameFr: "Arc de Triomphe",
    category: "Monument",
    arrondissement: "8th (75008)",
    coord: { lat: 48.8738, lng: 2.295 },
    visitDuration: "1 h",
    budget: "€16 (rooftop); free to view from below",
    free: false,
    openingHours: "10:00-22:30 (seasonal)",
    nearestTransit: "M1/M2/M6, RER A Charles de Gaulle-Étoile",
    stationStepFree: "Partial",
    wheelchair: "Partial (rooftop ~284 steps; lift for reduced-mobility visitors on request)",
    accessibleToilet: "Unknown",
    status: "open",
    officialUrl: "https://www.paris-arc-de-triomphe.fr/en",
    source: "Official site (CMN) + web search 2026-07-23",
    lastVerified: "2026-07-23",
    notes: "Reach the arch via the underground passage (no street crossing). Free under 18, EU 18-25.",
  },
  {
    id: "musee-orsay",
    nameEn: "Musée d'Orsay",
    nameFr: "Musée d'Orsay",
    category: "Museum",
    arrondissement: "7th (75007)",
    coord: { lat: 48.86, lng: 2.3266 },
    visitDuration: "2-3 h",
    budget: "€16 online (€14 on-site; €12 Thu evening)",
    free: false,
    openingHours: "09:30-18:00 Tue-Sun; to 21:45 Thu; closed Mon",
    nearestTransit: "RER C Musée d'Orsay; M12 Solférino",
    stationStepFree: "Partial",
    wheelchair: "Yes (accessible)",
    accessibleToilet: "Yes",
    status: "open",
    officialUrl: "https://www.musee-orsay.fr/en",
    source: "Official site + web search 2026-07-23",
    lastVerified: "2026-07-23",
    notes: "Free 1st Sunday of month; free under 18, EU 18-25. Reservation mandatory.",
  },
  {
    id: "sacre-coeur",
    nameEn: "Sacré-Cœur Basilica",
    nameFr: "Basilique du Sacré-Cœur",
    category: "Basilica",
    arrondissement: "18th (75018)",
    coord: { lat: 48.8867, lng: 2.3431 },
    visitDuration: "1-1.5 h",
    budget: "Basilica free; dome ≈€8 (confirm)",
    free: true,
    openingHours: "06:30-22:30 (basilica)",
    nearestTransit: "M2 Anvers + funicular; M12 Abbesses",
    stationStepFree: "No (hilltop; deep stations with stairs; funicular to summit)",
    wheelchair: "Partial (step-free side access to basilica; hill is difficult; dome not accessible)",
    accessibleToilet: "Unknown",
    status: "open",
    officialUrl: "https://www.sacre-coeur-montmartre.com/english/",
    source: "Official site + knowledge; dome price not re-verified",
    lastVerified: "2026-07-23",
    notes: "Confirm dome price/access on official site. Funicular covered by a metro ticket.",
  },
  {
    id: "sainte-chapelle",
    nameEn: "Sainte-Chapelle",
    nameFr: "Sainte-Chapelle",
    category: "Monument",
    arrondissement: "1st (75001)",
    coord: { lat: 48.8554, lng: 2.345 },
    visitDuration: "45 min-1 h",
    budget: "€12 (combo with Conciergerie €20)",
    free: false,
    openingHours: "09:00-19:00 (seasonal)",
    nearestTransit: "M4 Cité; RER B/C Saint-Michel",
    stationStepFree: "Partial",
    wheelchair: "Partial (lower chapel step-free; upper chapel via spiral stairs, not accessible)",
    accessibleToilet: "Unknown",
    status: "open",
    officialUrl: "https://www.sainte-chapelle.fr/en",
    source: "Official site (CMN) + web search 2026-07-23",
    lastVerified: "2026-07-23",
    notes: "Airport-style security (active courthouse). Upper-chapel stained glass is the highlight.",
  },
  {
    id: "pantheon",
    nameEn: "Panthéon",
    nameFr: "Panthéon",
    category: "Monument",
    arrondissement: "5th (75005)",
    coord: { lat: 48.8462, lng: 2.3464 },
    visitDuration: "1 h",
    budget: "≈€13 (2025 estimate; confirm 2026)",
    free: false,
    openingHours: "10:00-18:30 (seasonal)",
    nearestTransit: "RER B Luxembourg; M10 Cardinal Lemoine",
    stationStepFree: "Partial",
    wheelchair: "Partial (nave accessible; dome via stairs, not accessible)",
    accessibleToilet: "Unknown",
    status: "open",
    officialUrl: "https://www.paris-pantheon.fr/en",
    source: "Official site (CMN); 2026 price NOT verified",
    lastVerified: "2026-07-23 (price is a 2025 estimate)",
    notes: "Price is a 2025 estimate, confirm 2026 on the official site. Crypt of French notables; Foucault pendulum.",
  },
  {
    id: "jardin-luxembourg",
    nameEn: "Luxembourg Garden",
    nameFr: "Jardin du Luxembourg",
    category: "Park",
    arrondissement: "6th (75006)",
    coord: { lat: 48.8462, lng: 2.3372 },
    visitDuration: "1 h",
    budget: "Free",
    free: true,
    openingHours: "≈07:30-21:00 (seasonal, dawn-dusk)",
    nearestTransit: "RER B Luxembourg; M4 Saint-Sulpice",
    stationStepFree: "Partial",
    wheelchair: "Yes (main paths; some gravel surfaces)",
    accessibleToilet: "Yes",
    status: "open",
    officialUrl: "https://www.senat.fr/visite/jardin/index.html",
    source: "Official site + knowledge",
    lastVerified: "2026-07-23",
    notes: "Free public garden. Gravel paths can be hard for small wheels.",
  },
  {
    id: "jardin-tuileries",
    nameEn: "Tuileries Garden",
    nameFr: "Jardin des Tuileries",
    category: "Park",
    arrondissement: "1st (75001)",
    coord: { lat: 48.8635, lng: 2.3275 },
    visitDuration: "1 h",
    budget: "Free",
    free: true,
    openingHours: "≈07:00-21:00 (seasonal)",
    nearestTransit: "M1 Tuileries / Concorde",
    stationStepFree: "Partial",
    wheelchair: "Yes (mostly flat; gravel surfaces)",
    accessibleToilet: "Yes",
    status: "open",
    officialUrl: "https://www.louvre.fr/en/explore/the-palace/the-tuileries-garden",
    source: "Official site + knowledge",
    lastVerified: "2026-07-23",
    notes: "Links the Louvre to Place de la Concorde. Gravel paths.",
  },
  {
    id: "chateau-versailles",
    nameEn: "Palace of Versailles",
    nameFr: "Château de Versailles",
    category: "Palace",
    arrondissement: "Versailles (78000, Yvelines)",
    coord: { lat: 48.8049, lng: 2.1204 },
    visitDuration: "half-full day",
    budget: "Passport €25 (low)-€35 (high); Palace only €21",
    free: false,
    openingHours: "09:00-18:30; closed Mon",
    nearestTransit: "RER C Versailles Château Rive Gauche",
    stationStepFree: "Partial",
    wheelchair:
      "Yes (accessible; free for a disabled visitor + companion on presentation of a disability card or a European disabled parking permit; adapted routes)",
    accessibleToilet: "Yes",
    status: "open",
    officialUrl: "https://en.chateauversailles.fr",
    source: "Official site + web search 2026-07-23",
    lastVerified: "2026-07-23",
    notes:
      "Outside Paris (~40 min by RER C). EEA reduced rates. Gardens paid on Musical Fountains days. Free entry still requires booking a free timeslot online, and disabled visitors enter through entrance A (en.chateauversailles.fr, checked 2026-07-26).",
  },
  {
    id: "galeries-lafayette",
    nameEn: "Galeries Lafayette Haussmann",
    nameFr: "Galeries Lafayette Haussmann",
    category: "Shopping",
    arrondissement: "9th (75009)",
    coord: { lat: 48.8738, lng: 2.332 },
    visitDuration: "1-2 h",
    budget: "Free entry (shopping)",
    free: true,
    openingHours: "10:00-20:00; Sun 11:00-20:00",
    nearestTransit: "M7/M9 Chaussée d'Antin-La Fayette; RER A Auber",
    stationStepFree: "Partial",
    wheelchair: "Yes (department store with lifts)",
    accessibleToilet: "Yes",
    status: "open",
    officialUrl: "https://haussmann.galerieslafayette.com/en/",
    source: "Official site + knowledge",
    lastVerified: "2026-07-23",
    notes: "Belle Époque glass dome; free rooftop terrace with city views.",
  },
  {
    id: "centre-pompidou",
    nameEn: "Centre Pompidou",
    nameFr: "Centre Pompidou",
    category: "Museum",
    arrondissement: "4th (75004)",
    coord: { lat: 48.8607, lng: 2.3522 },
    visitDuration: "N/A",
    budget: "N/A (closed)",
    free: false,
    openingHours: "Closed",
    nearestTransit: "M11 Rambuteau; M1/4/7/11/14 Châtelet",
    stationStepFree: "Partial",
    wheelchair: "N/A (closed)",
    accessibleToilet: "N/A",
    status: "closed",
    officialUrl: "https://www.centrepompidou.fr/en/",
    source: "Official site + web search 2026-07-23",
    lastVerified: "2026-07-23",
    notes: "Closed for a 5-year renovation until 2030. Collection shown at partner venues (Constellation programme). Do NOT recommend visiting.",
  },

  // ---------------------------------------------------------------------------
  // Restaurants and pharmacies, pulled from OpenStreetMap on 2026-07-26 by
  // querying Overpass for `wheelchair=yes` inside central Paris. Unlike the
  // sights above, these were not checked one by one against each venue's own
  // site, so anything OSM does not carry stays "Unknown" here rather than being
  // filled in from a guess. That is why none of them claims a step-free station
  // or a price: OSM does not know, so neither do we.
  // ---------------------------------------------------------------------------
  {
    id: "nelsons",
    nameEn: "Nelson's",
    nameFr: "Nelson's",
    category: "Restaurant",
    arrondissement: "1st (75001)",
    coord: { lat: 48.86368, lng: 2.34312 },
    visitDuration: "1-2 h",
    budget: "Unknown (menu prices are on the official site)",
    free: false,
    openingHours: "Mo-Su 08:00-00:00",
    nearestTransit: "Unknown",
    stationStepFree: "Unknown",
    wheelchair: "Step-free entrance (OSM wheelchair=yes)",
    accessibleToilet: "Yes (OSM toilets:wheelchair=yes)",
    status: "open",
    officialUrl: "https://nelsons.paris/",
    source: "OpenStreetMap (Overpass, wheelchair=yes) 2026-07-26",
    lastVerified: "2026-07-26 (OSM tags, not confirmed with the venue)",
    notes: "16 Rue Coquillière. Tel +33 1 42 36 74 24. Both the entrance and the toilet are tagged accessible, which is rare enough to be worth saying out loud. Ring ahead to confirm before relying on it.",
  },
  {
    id: "le-tresor",
    nameEn: "Le Trésor",
    nameFr: "Le Trésor",
    category: "Restaurant",
    arrondissement: "Unknown (no postcode in OSM)",
    coord: { lat: 48.85703, lng: 2.35771 },
    visitDuration: "1-2 h",
    budget: "Unknown (menu prices are on the official site)",
    free: false,
    openingHours: "Mo-Fr 12:00-01:00; Sa-Su 12:00-02:00",
    nearestTransit: "Unknown",
    stationStepFree: "Unknown",
    wheelchair: "Step-free entrance (OSM wheelchair=yes)",
    accessibleToilet: "Yes (OSM toilets:wheelchair=yes)",
    status: "open",
    officialUrl: "http://restaurantletresor.com/",
    source: "OpenStreetMap (Overpass, wheelchair=yes) 2026-07-26",
    lastVerified: "2026-07-26 (OSM tags, not confirmed with the venue)",
    notes: "9 Rue du Trésor, in the Marais. Tel +33 1 42 71 35 17. Entrance and toilet both tagged accessible. Ring ahead to confirm before relying on it.",
  },
  {
    id: "le-louchebem",
    nameEn: "Le Louchébem",
    nameFr: "Le Louchébem",
    category: "Restaurant",
    arrondissement: "1st (75001)",
    coord: { lat: 48.86164, lng: 2.34439 },
    visitDuration: "1-2 h",
    budget: "Unknown (menu prices are on the official site)",
    free: false,
    openingHours: "Mo-Fr 12:00-14:30,19:00-23:30; Sa 12:00-23:30; Su off. Closed Sunday.",
    nearestTransit: "Unknown",
    stationStepFree: "Unknown",
    wheelchair: "Step-free entrance (OSM wheelchair=yes)",
    accessibleToilet: "No (OSM toilets:wheelchair=no)",
    status: "open",
    officialUrl: "http://www.le-louchebem.fr/",
    source: "OpenStreetMap (Overpass, wheelchair=yes) 2026-07-26",
    lastVerified: "2026-07-26 (OSM tags, not confirmed with the venue)",
    notes: "31 Rue Berger. Tel +33 1 42 33 12 99. You can get in, but the toilet is explicitly NOT accessible, so say that when recommending it: for a wheelchair user a long meal here may not work even though the door does.",
  },
  {
    id: "pharmabest-les-halles",
    nameEn: "Pharma Best, Forum des Halles",
    nameFr: "Pharma Best, Forum des Halles",
    category: "Pharmacy",
    arrondissement: "1st (75001)",
    coord: { lat: 48.86245, lng: 2.3471 },
    visitDuration: "15 min",
    budget: "Free to enter",
    free: true,
    openingHours: "Mo-Sa 10:00-20:00; Su 11:00-19:00",
    nearestTransit: "Unknown",
    stationStepFree: "Unknown",
    wheelchair: "Step-free entrance (OSM wheelchair=yes)",
    accessibleToilet: "Unknown",
    status: "open",
    officialUrl: "https://pharmacie-forum-des-halles-paris.pharmabest.com/",
    source: "OpenStreetMap (Overpass, wheelchair=yes) 2026-07-26",
    lastVerified: "2026-07-26 (OSM tags, not confirmed with the venue)",
    notes: "Rue Rambuteau, inside the Forum des Halles. Tel +33 1 40 41 91 45. Open Sundays, which most Paris pharmacies are not. For a pharmacy on duty outside these hours, call 15 or 112 and ask.",
  },
];

// -----------------------------------------------------------------------------
// Practical services. These are the parts of the knowledge base you reach by
// phone or by right rather than by travelling to a coordinate, so they get their
// own shape: giving them a lat/lng would have meant inventing one.
//
// Every record below was read off an official source on 2026-07-26, and each
// carries the limitation that matters for a foreign visitor in `caveat`. The
// caveats are the point. A traveller who is told about a free companion ticket
// and then refused at the desk is worse off than one who was never told.
// -----------------------------------------------------------------------------

export type ServiceCategory =
  | "Emergency services"
  | "Health services"
  | "Transportation"
  | "Useful public services";

export interface PracticalService {
  id: string;
  nameEn: string;
  nameFr: string;
  category: ServiceCategory;
  /** How you actually reach it: a number, an app, a counter. */
  reach: string;
  availability: string;
  cost: string;
  /** Why someone planning a step-free trip should care. */
  whyItMatters: string;
  /** The honest limitation. Empty string only when there genuinely is none. */
  caveat: string;
  officialUrl: string;
  source: string;
  lastVerified: string;
}

export const SERVICES: PracticalService[] = [
  {
    id: "urgence-114",
    nameEn: "114, emergency number for deaf and hard-of-hearing people",
    nameFr: "114, numéro d'urgence pour les personnes sourdes et malentendantes",
    category: "Emergency services",
    reach:
      "Free text message to 114, or by videophone and chat through the Urgence 114 app. You communicate in writing, so you never have to speak or hear.",
    availability: "24 hours a day, 7 days a week, everywhere in France",
    cost: "Free",
    whyItMatters:
      "It is the one emergency route that works when a phone call does not. Requests go to a national relay centre whose agents then contact the ambulance service, the police or the fire brigade for you.",
    caveat:
      "It is for people who cannot use a voice call. Anyone who can speak should dial 15, 17, 18 or 112 directly, which is faster.",
    officialUrl: "https://www.service-public.gouv.fr/particuliers/vosdroits/F33954?lang=en",
    source: "service-public.gouv.fr (French government) + handicap.gouv.fr, read 2026-07-26",
    lastVerified: "2026-07-26",
  },
  {
    id: "urgences-france",
    nameEn: "French emergency numbers: 15, 17, 18 and 112",
    nameFr: "Numéros d'urgence en France : 15, 17, 18 et 112",
    category: "Emergency services",
    reach:
      "15 for the ambulance service (Samu), 17 for the police, 18 for the fire brigade, and 112 from anywhere in the European Union, which routes you to the right one.",
    availability: "24 hours a day, 7 days a week",
    cost: "Free",
    whyItMatters:
      "112 is the number to remember if you are visiting: it works across the EU and you do not have to decide which service you need first.",
    caveat:
      "These are voice calls. If you cannot use one, send a text to 114 instead.",
    officialUrl: "https://www.service-public.gouv.fr/particuliers/vosdroits/F33954?lang=en",
    source: "service-public.gouv.fr (French government), read 2026-07-26",
    lastVerified: "2026-07-26",
  },
  {
    id: "infomobi",
    nameEn: "Île-de-France transport accessibility information line",
    nameFr: "Service d'information pour l'accessibilité des transports en Île-de-France",
    category: "Transportation",
    reach: "Call 09 70 81 83 85. Île-de-France Mobilités also lists interpreting services in French Sign Language, real-time speech transcription and cued speech.",
    availability: "07:00 to 22:00, 7 days a week, except 1 May",
    cost: "Non-surcharged number",
    whyItMatters:
      "It is the official place to ask whether a specific station is step-free today, which is the question our own data cannot always answer.",
    caveat:
      "It is a phone line in French. Plan for a language barrier, or ask someone at your hotel to call.",
    officialUrl: "https://www.iledefrance-mobilites.fr/en/le-reseau/transports-faciles-d-acces",
    source: "Île-de-France Mobilités official site, read 2026-07-26",
    lastVerified: "2026-07-26",
  },
  {
    id: "service-pam",
    nameEn: "PAM, on-demand door-to-door transport",
    nameFr: "Service PAM, transport à la demande de porte à porte",
    category: "Transportation",
    reach: "Booked through Île-de-France Mobilités, per the PAM service pages",
    availability: "Unknown, it varies by département and has to be booked in advance",
    cost: "Unknown",
    whyItMatters:
      "Where no step-free route exists at all, door-to-door transport is the fallback rather than giving up on the trip.",
    caveat:
      "Eligibility applies and it is built for residents, so a short-stay visitor most likely cannot use it. Worth knowing it exists, but do not plan a visitor's day around it without checking first.",
    officialUrl: "https://www.iledefrance-mobilites.fr/en/services-mobilite-alternative/pam",
    source: "Île-de-France Mobilités official site, read 2026-07-26",
    lastVerified: "2026-07-26",
  },
  {
    id: "cmi-accompagnateur",
    nameEn: "Free entry for a disabled visitor and one companion at national monuments",
    nameFr: "Gratuité pour la personne handicapée et son accompagnateur, monuments nationaux",
    category: "Useful public services",
    reach:
      "Show valid proof of disability at the ticket desk of a Centre des monuments nationaux site. Its own ticketing pages state that the disabled visitor and their companion get free entry and a free guided visit.",
    availability: "During each monument's opening hours",
    cost: "Free for the visitor and one companion",
    whyItMatters:
      "It can change what a day costs, which for a traveller on a fixed daily budget decides how much of the city they see.",
    caveat:
      "The proof the official page names is the French carte Mobilité Inclusion, described as being for the French public. A foreign visitor should not assume a card from home will be accepted: ask the specific venue what proof it takes before counting on the discount. Rules also differ between national monuments and city or private museums.",
    officialUrl: "https://tickets.monuments-nationaux.fr/fr-FR/conditions-de-gratuite",
    source: "Centre des monuments nationaux official ticketing site, read 2026-07-26",
    lastVerified: "2026-07-26",
  },
];
