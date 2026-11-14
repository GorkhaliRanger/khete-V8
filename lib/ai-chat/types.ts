/**
 * khetE कृषि साथी — chatbot prototype core types.
 *
 * Every external capability (conversation engine, speech, search) is defined
 * as an interface here so the mock implementations used in the /ai-demo
 * prototype can later be replaced with real providers (Gemini 2.5 Flash-Lite
 * for conversation, Groq Whisper for speech, a hosted TTS service) without
 * touching the user interface.
 */

export type ChatLanguage = "en" | "ne";

export type ChatRole = "user" | "assistant";

/** A product search constraint accumulated during the conversation. */
export type ProductConstraints = {
  category: string;
  productType: string;
  budgetNpr: number | null;
  terrain: "hilly" | "flat" | null;
  farmArea: string | null;
  district: string | null;
  season: string | null;
  application: string | null;
  rental: boolean;
  duration: string | null;
};

/** A professional/expert search constraint accumulated during the conversation. */
export type ProfessionalConstraints = {
  projectType: string;
  disciplines: string[];
  capacity: string | null;
  landAvailable: boolean | null;
  powerAvailable: boolean | null;
  serviceScope: string | null;
  budgetNpr: number | null;
  district: string | null;
};

export type ConversationState = {
  language: ChatLanguage;
  constraints: ProductConstraints | null;
  professionalConstraints: ProfessionalConstraints | null;
  /** Free-form notes the engine remembers, e.g. mentioned machinery. */
  memory: Record<string, string>;
};

export type DemoProduct = {
  id: string;
  nameEn: string;
  nameNe: string;
  category: "machinery" | "seeds" | "inputs" | "irrigation" | "rental" | "service";
  productType: string;
  priceNpr: number;
  available: boolean;
  inStock: boolean;
  specifications: string[];
  /** Suitability signals used by the recommendation scorer. */
  suitsTerrain: ("hilly" | "flat")[] | "any";
  application: string[];
  image: string;
};

export type ProductMatch = {
  product: DemoProduct;
  score: number;
  reasons: string[];
  /** Negative = within budget, positive = amount above budget. */
  budgetDifference: number | null;
};

export type DemoProfessional = {
  id: string;
  name: string;
  specialization: string;
  specializationNe: string;
  location: string;
  skills: string[];
  verified: boolean;
  photo: string;
};

export type ProfessionalMatch = {
  professional: DemoProfessional;
  score: number;
  matchedSkills: string[];
};

export type ChatAttachment =
  | { kind: "products"; items: ProductMatch[] }
  | { kind: "professionals"; items: ProfessionalMatch[] };

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  attachment?: ChatAttachment;
  createdAt: number;
};

export type EngineReply = {
  text: string;
  attachment?: ChatAttachment;
  suggestions: string[];
};

/**
 * The conversation engine contract. The prototype ships a deterministic mock;
 * a future Gemini-backed engine only has to implement this same interface.
 */
export interface ConversationEngine {
  reset(language: ChatLanguage): void;
  setLanguage(language: ChatLanguage): void;
  getLanguage(): ChatLanguage;
  greet(): EngineReply;
  reply(input: string): EngineReply;
  /** Exposed for the developer test panel. */
  getState(): ConversationState;
}

/** Intent recognition contract (mock now, model-backed later). */
export interface IntentRecognizer {
  recognize(input: string, state: ConversationState): IntentResult;
}

export type IntentResult = {
  intent:
    | "greeting"
    | "product_search"
    | "price_query"
    | "comparison"
    | "expert_search"
    | "rental"
    | "service_maintenance"
    | "navigation"
    | "confirm"
    | "deny"
    | "restart"
    | "unknown";
  /** Raw entity candidates found in the input. */
  entities: ExtractedEntities;
};

export type ExtractedEntities = {
  budgetNpr: number | null;
  terrain: "hilly" | "flat" | null;
  productCategory: string | null;
  productType: string | null;
  district: string | null;
  season: string | null;
  farmArea: string | null;
  duration: string | null;
  projectType: string | null;
  capacity: string | null;
  discipline: string | null;
};

/** Speech recognition contract (browser-native now, Groq Whisper later). */
export interface SpeechRecognizer {
  isSupported(): boolean;
  getLanguage(): string;
  start(onResult: (transcript: string, isFinal: boolean) => void, onError: (message: string) => void): void;
  stop(): string;
}

/** Text-to-speech contract (browser-native now, hosted provider later). */
export interface TextToSpeech {
  isSupported(): boolean;
  hasVoiceFor(language: ChatLanguage): boolean;
  speak(text: string, language: ChatLanguage, onEnd?: () => void): void;
  cancel(): void;
}

/** Product search contract (deterministic filtering, no full-catalog LLM sends). */
export interface ProductSearch {
  search(constraints: ProductConstraints, language: ChatLanguage): { matches: ProductMatch[]; alternatives: ProductMatch[] };
}

/** Professional search contract. */
export interface ProfessionalSearch {
  search(constraints: ProfessionalConstraints, language: ChatLanguage): ProfessionalMatch[];
}
