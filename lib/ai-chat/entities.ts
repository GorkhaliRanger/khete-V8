import type { ExtractedEntities } from "./types";

/**
 * Input normalization and entity extraction for the mock engine.
 *
 * Handles Nepali (Devanagari) digits, English digits, Romanized Nepali and
 * mixed input. Only the expressions listed here are understood — anything
 * else simply yields no entity, which the engine treats as "not mentioned".
 */

const DEVANAGARI_DIGITS: Record<string, string> = {
  "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
  "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
};

export function normalizeDigits(input: string): string {
  return input.replace(/[०-९]/g, (digit) => DEVANAGARI_DIGITS[digit] ?? digit);
}

export function normalizeInput(input: string): string {
  return normalizeDigits(input)
    .toLowerCase()
    .replace(/[?!.,।॥]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  ek: 1, dui: 2, tin: 3, char: 4, paanch: 5, chha: 6, saat: 7, aath: 8, nau: 9, das: 10,
  ekkaunna: 51,
};

const LAKH_ALIASES = ["lakh", "lakhs", "लाख", "lac", "lacs"];
const THOUSAND_ALIASES = ["thousand", "hajar", "hajjar", "ajjar", "हजार", "k"];

const DEVANAGARI_NUMBER_WORDS: Record<string, number> = {
  "एक": 1, "दुई": 2, "तीन": 3, "चार": 4, "पाँच": 5, "छ": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10,
};

/** Fixed Nepali expressions that numeral parsing alone cannot compose. */
const FIXED_BUDGET_EXPRESSIONS: Array<[RegExp, number]> = [
  [/dedh lakh|डेढ लाख/, 150000],
  [/धेरै सय हजार/, 100000],
  [/sava lakh|सवा लाख/, 125000],
];

/**
 * Extracts a budget in NPR from free text. Understands:
 *   "1.2 lakh", "120000", "1 lakh 20 hajar", "एक लाख बीस हजार",
 *   "डेढ लाख", "80 hajar", "around 1.2 lakh", "दुई लाख ५० हजार".
 * Returns null when no budget is mentioned.
 */
export function parseBudget(rawInput: string): number | null {
  const input = normalizeDigits(rawInput).toLowerCase().trim();

  for (const [pattern, value] of FIXED_BUDGET_EXPRESSIONS) {
    if (pattern.test(input)) return value;
  }

  // Nepali number words + unit words: "एक लाख बीस हजार"
  const deva = input.match(/([ए-ह]+)\s*लाख(?:\s*([ए-ह]+)\s*हजार)?/);
  if (deva) {
    const lakhs = DEVANAGARI_NUMBER_WORDS[deva[1]] ?? 0;
    const thousands = deva[2] ? DEVANAGARI_NUMBER_WORDS[deva[2]] ?? 0 : 0;
    if (lakhs || thousands) return lakhs * 100000 + thousands * 1000;
  }

  // Romanized + English mixed: "1 lakh 20 hajar", "two lakh fifty thousand"
  let total = 0;
  let matched = false;
  const unitPattern = new RegExp(
    `(\\d+(?:\\.\\d+)?|${Object.keys(NUMBER_WORDS).join("|")})\\s*(${[...LAKH_ALIASES, ...THOUSAND_ALIASES].join("|")})`,
    "g",
  );
  let match: RegExpExecArray | null;
  while ((match = unitPattern.exec(input)) !== null) {
    const rawValue = match[1];
    const amount = /^\d/.test(rawValue) ? Number.parseFloat(rawValue) : NUMBER_WORDS[rawValue] ?? 0;
    const unit = match[2];
    if (LAKH_ALIASES.includes(unit)) total += amount * 100000;
    else total += amount * 1000;
    matched = true;
  }
  if (matched) return total;

  // Bare numerals, e.g. "around 95000" or "१,२०,०००".
  // Numbers bound to a quantity unit (5,000 chicks, 50 kg, 8 ropani, 2 days)
  // are capacities/areas/durations, never budgets — strip them first.
  const withoutQuantities = input.replace(
    /(\d[\d,]*)\s*-?\s*(chick|chicks|challa|चल्ला|bird|birds|kg|केजी|ltr|liter|ropani|ropanis|bigha|bighas|katha|kattha|रोपनी|बिघा|कठ्ठा|day|days|din|दिन|week|weeks|hafta|hapta|हप्ता|month|months|mahina|महिना)\b/g,
    " ",
  );
  const bare = withoutQuantities.replace(/,/g, "").match(/\b(\d{4,9})\b/);
  if (bare) {
    const value = Number(bare[1]);
    if (Number.isFinite(value)) return value;
  }

  return null;
}

const TERRAIN_HILLY = ["hilly", "hill", "pahad", "pahadi", "पहाड", "पहाडी", "गोरेटो", " slope"];
const TERRAIN_FLAT = ["flat", "terai", "plain", "tarai", "भित्री", "मधेश", "समथर", "बेसी"];

export function parseTerrain(input: string): "hilly" | "flat" | null {
  const text = normalizeInput(input);
  if (TERRAIN_HILLY.some((word) => text.includes(word))) return "hilly";
  if (TERRAIN_FLAT.some((word) => text.includes(word))) return "flat";
  return null;
}

const DISTRICTS = [
  "achham", "arghakhanchi", "baglung", "baitadi", "baksa", "banke", "bara", "bardiya", "bhaktapur",
  "bhojpur", "chitwan", "chitawan", "dadeldhura", "dailekh", "dang", "darchula", "dhading", "dhankuta",
  "dhanusha", "dolakha", "dolpa", "doti", "gorkha", "gulmi", "humla", "ilam", "jajarkot", "jhapa",
  "jumla", "kailali", "kalikot", "kanchanpur", "kapilvastu", "kaski", "kathmandu", "kavre", "khotang",
  "lalitpur", "lamjung", "mahottari", "makwanpur", "manang", "morang", "mustang", "myagdi", "nawalparasi",
  "nuwakot", "okhaldhunga", "palpa", "panchthar", "parbat", "parsa", "pyuthan", "ramechhap", "rasuwa",
  "rautahat", "rolpa", "rukum", "rupandehi", "salyan", "sankhuwasabha", "saptari", "sarlahi", "sindhuli",
  "sindhupalchok", "siraha", "solukhumbu", "sunsari", "surkhet", "syangja", "tanahu", "taplejung", "terhathum",
  "udayapur", "चितवन", "काठमाडौं", "पोखरा", "कास्की",
];

export function parseDistrict(input: string): string | null {
  const text = normalizeInput(input);
  for (const district of DISTRICTS) {
    if (text.includes(district)) return district === "chitawan" ? "chitwan" : district;
  }
  return null;
}

const SEASONS: Array<[RegExp, string]> = [
  [/kharif|monsoon|ashadh|shrawan|saun|खरीफ|मनसुन|साउन|भदौ/, "kharif/monsoon"],
  [/rabi|winter|mangsir|poush|magh|रबि|जाडो|मंसिर|पुस|माघ/, "rabi/winter"],
  [/summer|spring|ches|baisakh|jestha|गर्मी|वसन्त|वैशाख|जेठ/, "summer/spring"],
];

export function parseSeason(input: string): string | null {
  const text = normalizeInput(input);
  for (const [pattern, season] of SEASONS) {
    if (pattern.test(text)) return season;
  }
  return null;
}

export function parseFarmArea(input: string): string | null {
  const text = normalizeDigits(input).toLowerCase().replace(/[?!।॥]/g, " ").replace(/\s+/g, " ").trim();
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(ropani|ropanis|bigha|bighas|katha|kattha|बिघा|कठ्ठा|रोपनी)/);
  if (match) return `${match[1]} ${match[2]}`;
  return null;
}

export function parseDuration(input: string): string | null {
  const text = normalizeDigits(input).toLowerCase().replace(/[?!.,।॥]/g, " ").replace(/\s+/g, " ").trim();
  const match = text.match(/(\d+)\s*(days|day|din|दिन|weeks|week|hafta|hapta|हप्ता|months|month|mahina|महिना)/);
  if (match) return `${match[1]} ${match[2]}`;
  return null;
}

export function extractEntities(input: string): ExtractedEntities {
  const text = normalizeInput(input);
  // Comma-preserving normalization for quantity parsers ("5,000 chicks").
  const digitsOnly = normalizeDigits(input).toLowerCase().replace(/[?!.।॥]/g, " ").replace(/\s+/g, " ").trim();
  return {
    budgetNpr: parseBudget(input),
    terrain: parseTerrain(input),
    productCategory: null,
    productType: detectProductType(text),
    district: parseDistrict(input),
    season: parseSeason(input),
    farmArea: parseFarmArea(input),
    duration: parseDuration(digitsOnly),
    projectType: detectProjectType(text),
    capacity: parseCapacity(digitsOnly),
    discipline: null,
  };
}

const PRODUCT_TYPES: Array<[RegExp, string]> = [
  [/power tiller|टिलर|टीलर/, "power tiller"],
  [/tractor|ट्याक्टर/, "tractor"],
  [/paddy seed|rice seed|धानको बीउ|धान बीउ/, "paddy seed"],
  [/wheat seed|गहुँको बीउ|गहुँ बीउ/, "wheat seed"],
  [/mustard seed|तोरीको बीउ|तोरी बीउ/, "mustard seed"],
  [/vegetable seed|तरकारी बीउ/, "vegetable seed"],
  [/seed|बीउ|biu/, "seed"],
  [/fertilizer|मल|urea|dap|npk|युरिया/, "fertilizer"],
  [/drip|थोपा/, "drip irrigation"],
  [/sprinkler|छर्कौनी/, "sprinkler"],
  [/pump|मोटर/, "pump"],
  [/sprayer|स्प्रेयर/, "sprayer"],
  [/thresher|थ्रेसर/, "thresher"],
  [/hatchery|ह्याचरी/, "hatchery"],
];

export function detectProductType(text: string): string | null {
  for (const [pattern, type] of PRODUCT_TYPES) {
    if (pattern.test(text)) return type;
  }
  return null;
}

function detectProjectType(text: string): string | null {
  if (/hatchery|ह्याचरी/.test(text)) return "hatchery";
  if (/poultry|कुखुरा|chick|chicks|चल्ला/.test(text)) return "poultry";
  if (/greenhouse|पोलिहाउस|polyhouse|poly house|tunnel/.test(text)) return "greenhouse";
  if (/fish|माछा|pond|पोखरी/.test(text)) return "fishery";
  if (/drip|सिँचाइ|सिंचाई|irrigation/.test(text)) return "irrigation";
  return null;
}

function parseCapacity(text: string): string | null {
  const match = text.match(/(\d[\d,]*)\s*-?\s*(chicks|chick|challa|चल्ला|birds|bird|kg|केजी|ltr|liters|litres|liter|litre|l)\b/);
  if (match) return `${match[1]} ${match[2]}`;
  return null;
}
