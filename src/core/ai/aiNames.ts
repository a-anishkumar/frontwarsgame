import { flagGlyph } from "../../customization/cosmetics";
import type { BotPersonality } from "../Player";

export const AI_COLORS = [
  "#c68e7e", // warm peach / terracotta (like Uighur Canton)
  "#91a880", // soft sage (like Ethiopian territory)
  "#9e8eb2", // muted violet / lavender (like Serbian Sultanate)
  "#baac8c", // warm tan / khaki (like Tongan Fief)
  "#8aa2af", // slate blue (like Apache Protectorate)
  "#af94a2", // dusty rose (like Hmong Colony)
  "#bc9e76", // golden ochre (like Ghanaian Kingdom)
  "#84ac9e", // soft teal / seafoam
  "#a8ac8a", // olive tan
  "#b28c8c", // brick rose
  "#8e9bb9", // periwinkle slate
  "#c0a884", // pale amber
  "#98b294", // muted mint
  "#ac98b6", // thistle mauve
  "#b99482", // coral clay
  "#8aa8ac", // steel cyan
  "#b6af91", // desert sand
  "#a291a8", // twilight lilac
  "#94ac87", // field green
  "#c39b8e", // salmon tan
  "#8c9eb2", // storm blue
  "#b2a587", // parchment
  "#a5988e", // warm grey
  "#9eb0a5", // celadon
  "#5c616a",
  "#6e7380",
  "#7a8088",
  "#8b9098",
  "#969ba3",
  "#4e535b",
  "#686e76",
  "#818790",
  "#555a62",
  "#747a84",
  "#9aa0a8",
  "#636870",
] as const;

export function aiColor(index: number): string {
  return AI_COLORS[((index % AI_COLORS.length) + AI_COLORS.length) % AI_COLORS.length];
}

export const CULTURES = [
  "Serbian", "Mossi", "Illyrian", "Russian", "Mauryan", "Bhutanese", "Tongan", "Uighur",
  "Hmong", "Apache", "Ghanaian", "Malay", "Tudor", "Saxon", "Nordic", "Celtic",
  "Persian", "Mongol", "Ottoman", "Inca", "Aztec", "Zulu", "Spartan", "Roman",
  "Gothic", "Frankish", "Carthaginian", "Scythian", "Iroquois", "Navajo", "Nubian", "Yoruba",
  "Samurai", "Viking", "Bohemian", "Silesian", "Bavarian", "Catalan", "Breton", "Cossack",
  "Bedouin", "Kurdish", "Tibetan", "Manchu", "Polynesian", "Maori", "Cherokee", "Sioux",
  "Mayan", "Phoenician", "Etruscan", "Venetian", "Genoese", "Burgundian", "Prussian", "Hanoverian",
  "Teutonic", "Castilian", "Aragonese", "Neapolitan", "Sicilian", "Athenian", "Theban", "Corinthian",
  "Macedonian", "Thracian", "Dacian", "Iberian", "Gallic", "Briton", "Pictish", "Hibernian",
  "Lusitanian", "Numidian", "Berber", "Tuareg", "Somali", "Amhara", "Oromo", "Swahili",
  "Kongo", "Shona", "Songhai", "Mandinka", "Hausa", "Ashanti", "Dahomey", "Kushite",
  "Axumite", "Himyarite", "Nabataean", "Aramaean", "Assyrian", "Babylonian", "Sumerian", "Elamite",
  "Median", "Parthian", "Sogdian", "Bactrian", "Kushan", "Chola", "Pandya", "Chera",
  "Gupta", "Maratha", "Sikh", "Rajput", "Bengal", "Sinhalese", "Burmese", "Khmer",
  "Cham", "Viet", "Siam", "Javanese", "Balinese", "Tagalog", "Moluccan", "Yakut",
  "Chukchi", "Inuit", "Aleut", "Cree", "Ojibwe", "Mohawk", "Huron", "Comanche",
  "Shawnee", "Seminole", "Choctaw", "Mapuche", "Guarani", "Aymara", "Quechua", "Tupi"
];

export const REGIMES = [
  "Sultanate", "Brotherhood", "Province", "Assembly", "Nation", "Horde", "Corporation", "Canton",
  "Fief", "Colony", "Protectorate", "Kingdom", "Republic", "Empire", "Duchy", "Federation",
  "Union", "Commonwealth", "Emirate", "Principality", "Confederacy", "Dominion", "Commandery", "Syndicate",
  "Dynasty", "Realm", "League", "Alliance", "Order", "State", "Tribes", "Hegemony",
  "Consortium", "Regency", "Tsardom", "Khanate", "Caliphate", "Shogunate", "Free State", "Council"
];

// Pre-generated FrontWars-style names
export const AI_NAMES: string[] = [];
for (const culture of CULTURES) {
  for (const regime of REGIMES) {
    AI_NAMES.push(`${culture} ${regime}`);
  }
}

const ROMAN = ["", " II", " III", " IV", " V", " VI", " VII", " VIII", " IX", " X"];

export function pickAiNames(count: number, rnd: { shuffle<T>(arr: T[]): T[] }, taken: ReadonlySet<string> = new Set()): string[] {
  const out: string[] = [];
  const used = new Set(taken);
  let generation = 0;
  while (out.length < count) {
    const batch = rnd.shuffle([...AI_NAMES]);
    for (const base of batch) {
      if (out.length >= count) break;
      const suffix = ROMAN[Math.min(generation, ROMAN.length - 1)];
      let name = generation === 0 ? base : `${base}${suffix}`;
      let n = 2;
      while (used.has(name)) {
        name = `${base} ${n}`;
        n++;
      }
      used.add(name);
      out.push(name);
    }
    generation++;
    if (generation > 20) break;
  }
  return out;
}

export const COUNTRY_ISO: Record<string, string> = {
  "united states of america": "US",
  "united states": "US",
  "canada": "CA",
  "united kingdom": "GB",
  "france": "FR",
  "germany": "DE",
  "russia": "RU",
  "china": "CN",
  "japan": "JP",
  "india": "IN",
  "brazil": "BR",
  "australia": "AU",
  "mexico": "MX",
  "argentina": "AR",
  "south africa": "ZA",
  "egypt": "EG",
  "nigeria": "NG",
  "kenya": "KE",
  "italy": "IT",
  "spain": "ES",
  "portugal": "PT",
  "netherlands": "NL",
  "belgium": "BE",
  "switzerland": "CH",
  "austria": "AT",
  "sweden": "SE",
  "norway": "NO",
  "finland": "FI",
  "denmark": "DK",
  "poland": "PL",
  "ukraine": "UA",
  "turkey": "TR",
  "saudi arabia": "SA",
  "iran": "IR",
  "iraq": "IQ",
  "israel": "IL",
  "united arab emirates": "AE",
  "pakistan": "PK",
  "bangladesh": "BD",
  "indonesia": "ID",
  "philippines": "PH",
  "vietnam": "VN",
  "thailand": "TH",
  "malaysia": "MY",
  "south korea": "KR",
  "korea": "KR",
  "new zealand": "NZ",
  "chile": "CL",
  "colombia": "CO",
  "peru": "PE",
  "venezuela": "VE",
  "cuba": "CU",
  "greece": "GR",
  "romania": "RO",
  "czech republic": "CZ",
  "czechia": "CZ",
  "hungary": "HU",
  "ireland": "IE",
  "algeria": "DZ",
  "morocco": "MA",
  "ethiopia": "ET",
  "ghana": "GH",
  "singapore": "SG",
  "kazakhstan": "KZ",
  "mongolia": "MN",
  "iceland": "IS",
  "serbia": "RS",
  "croatia": "HR",
  "bulgaria": "BG",
  "slovakia": "SK",
  "slovenia": "SI",
  "lithuania": "LT",
  "latvia": "LV",
  "estonia": "EE",
  "belarus": "BY",
  "uzbekistan": "UZ",
  "afghanistan": "AF",
  "syria": "SY",
  "jordan": "JO",
  "lebanon": "LB",
  "yemen": "YE",
  "oman": "OM",
  "kuwait": "KW",
  "qatar": "QA",
  "tunisia": "TN",
  "libya": "LY",
  "sudan": "SD",
  "tanzania": "TZ",
  "uganda": "UG",
  "angola": "AO",
  "mozambique": "MZ",
  "zambia": "ZM",
  "zimbabwe": "ZW",
  "namibia": "NA",
  "botswana": "BW",
  "bolivia": "BO",
  "paraguay": "PY",
  "uruguay": "UY",
  "ecuador": "EC",
  "panama": "PA",
  "costa rica": "CR",
  "guatemala": "GT",
  "honduras": "HN",
  "el salvador": "SV",
  "nicaragua": "NI",
  "jamaica": "JM",
  "taiwan": "TW",
  "myanmar": "MM",
  "cambodia": "KH",
  "laos": "LA",
  "nepal": "NP",
  "sri lanka": "LK",
  "antarctica": "AQ",
  "antarctic": "AQ",
  "antarctic peninsula": "AQ",
  "queen maud land": "AQ",
  "wilkes land": "AQ",
  "victoria land": "AQ",
  "marie byrd land": "AQ",
  "enderby land": "AQ",
  "weddell coast": "AQ",
  "ross dependency": "AQ",
};

export function countryFlag(name: string): string {
  if (!name) return "";
  const norm = name.trim().toLowerCase();
  const code = COUNTRY_ISO[norm];
  if (code) return flagGlyph(code);
  for (const [key, val] of Object.entries(COUNTRY_ISO)) {
    if (norm.includes(key) || key.includes(norm)) return flagGlyph(val);
  }
  return "";
}

export function getDoctrineForNation(name: string, fallbackIdx: number): BotPersonality {
  const norm = name.toLowerCase();
  if (norm.includes("switzerland") || norm.includes("sweden") || norm.includes("ireland") || norm.includes("costa rica") || norm.includes("bhutan")) {
    return "Neutral";
  }
  if (norm.includes("russia") || norm.includes("germany") || norm.includes("turkey") || norm.includes("mongolia") || norm.includes("serbia")) {
    return "Aggressive";
  }
  if (norm.includes("united states") || norm.includes("united kingdom") || norm.includes("portugal") || norm.includes("spain") || norm.includes("netherlands") || norm.includes("australia") || norm.includes("japan") || norm.includes("antarctic") || norm.includes("maud") || norm.includes("wilkes") || norm.includes("ross") || norm.includes("byrd")) {
    return "Expansionist";
  }
  if (norm.includes("finland") || norm.includes("ukraine") || norm.includes("poland") || norm.includes("israel") || norm.includes("taiwan") || norm.includes("norway")) {
    return "Defensive";
  }
  if (norm.includes("france") || norm.includes("italy") || norm.includes("china") || norm.includes("austria") || norm.includes("greece") || norm.includes("india")) {
    return "Opportunist";
  }
  const all: BotPersonality[] = ["Neutral", "Aggressive", "Expansionist", "Defensive", "Opportunist"];
  return all[fallbackIdx % all.length];
}

