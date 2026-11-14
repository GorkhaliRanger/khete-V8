import { RuleIntentRecognizer } from "./intents";
import { DemoProductSearch, DemoProfessionalSearch, disciplinesForProject } from "./search";
import { DEMO_PRODUCTS } from "./data";
import type {
  ChatLanguage,
  ConversationEngine,
  ConversationState,
  EngineReply,
  ProductConstraints,
  ProfessionalConstraints,
} from "./types";

/**
 * Deterministic mock conversation engine implementing the ConversationEngine
 * interface. It is a prototype simulation — it does not pretend to be a
 * language model. A Gemini-backed engine can later replace this class without
 * any UI changes.
 *
 * Supported conversation flows:
 *  - product search with budget / terrain / area / district / season follow-ups
 *  - rentals and service & maintenance
 *  - expert/professional discovery (hatchery project scenario and general)
 *  - comparisons, price questions, navigation help, fallback answers
 */

function emptyProductConstraints(): ProductConstraints {
  return {
    category: "",
    productType: "",
    budgetNpr: null,
    terrain: null,
    farmArea: null,
    district: null,
    season: null,
    application: null,
    rental: false,
    duration: null,
  };
}

function emptyProfessionalConstraints(): ProfessionalConstraints {
  return { projectType: "", disciplines: [], capacity: null, landAvailable: null, powerAvailable: null, serviceScope: null, budgetNpr: null, district: null };
}

function bi(lang: ChatLanguage, en: string, ne: string) {
  return lang === "ne" ? ne : en;
}

type ProductFlowStep = "askBudget" | "askTerrain" | "askArea" | "askDistrict" | "askSeason" | "askDuration" | "done";
type ExpertFlowStep = "askFacility" | "askLand" | "askCapacity" | "askPower" | "askScope" | "askBudget" | "done";

const MACHINERY_TYPES = ["power tiller", "tractor", "thresher", "harvester"];

export class MockConversationEngine implements ConversationEngine {
  private state: ConversationState;
  private recognizer = new RuleIntentRecognizer();
  private productSearch = new DemoProductSearch();
  private professionalSearch = new DemoProfessionalSearch();
  private productStep: ProductFlowStep = "done";
  private expertStep: ExpertFlowStep = "done";

  constructor(language: ChatLanguage = "en") {
    this.state = this.freshState(language);
  }

  private freshState(language: ChatLanguage): ConversationState {
    return { language, constraints: null, professionalConstraints: null, memory: {} };
  }

  reset(language: ChatLanguage): void {
    this.state = this.freshState(language);
    this.productStep = "done";
    this.expertStep = "done";
  }

  setLanguage(language: ChatLanguage): void {
    this.state.language = language;
  }

  getLanguage(): ChatLanguage {
    return this.state.language;
  }

  getState(): ConversationState {
    return JSON.parse(JSON.stringify(this.state)) as ConversationState;
  }

  greet(): EngineReply {
    const lang = this.state.language;
    return {
      text: bi(
        lang,
        "Namaste! I'm khetE कृषि साथी. I can help you find agricultural products, compare prices and connect with suitable farming professionals. How can I help you today?",
        "नमस्कार! म khetE कृषि साथी हुँ। तपाईंलाई कृषि सामग्री खोज्न, मूल्य तुलना गर्न वा कृषि विशेषज्ञसँग जोडिन सहयोग गर्न सक्छु। आज तपाईंलाई के चाहिएको छ?",
      ),
      suggestions: this.starters(),
    };
  }

  private starters(): string[] {
    const lang = this.state.language;
    return lang === "ne"
      ? ["मलाई पावर टिलर चाहिन्छ", "चितवनका लागि धानको बीउ चाहिन्छ", "५ हजार कुखुराको ह्याचरी बनाउन चाहन्छु", "ट्याक्टर २ दिन भाडामा चाहिन्छ", "थोपा सिँचाइका विकल्प देखाउनुहोस्"]
      : ["I need a power tiller", "I want paddy seeds for Chitwan", "I want to build a 5,000-chick hatchery", "I want to rent a tractor for 2 days", "Show drip irrigation options"];
  }

  reply(rawInput: string): EngineReply {
    const input = rawInput.trim();
    if (!input) {
      return { text: bi(this.state.language, "Please type a message.", "कृपया सन्देश लेख्नुहोस्।"), suggestions: [] };
    }
    const { intent, entities } = this.recognizer.recognize(input, this.state);

    if (intent === "restart") {
      const lang = this.state.language;
      this.reset(lang);
      return {
        text: bi(lang, "Conversation restarted. How can I help you today?", "कुराकानी सुरुबाट सुरु भयो। आज के चाहिएको छ?"),
        suggestions: this.starters(),
      };
    }

    if (this.state.professionalConstraints && this.expertStep !== "done" && intent !== "greeting") {
      return this.continueExpertFlow(input, entities);
    }
    if (this.state.constraints && this.productStep !== "done" && intent !== "greeting") {
      return this.continueProductFlow(input, entities);
    }

    switch (intent) {
      case "greeting":
        return this.greet();
      case "product_search":
        return this.startProductFlow(entities);
      case "rental":
        return this.startRentalFlow(entities);
      case "service_maintenance":
        return this.startServiceFlow();
      case "expert_search":
        return this.startExpertFlow(entities);
      case "comparison":
        return this.handleComparison(input);
      case "price_query":
        return {
          text: bi(
            this.state.language,
            "Which product's price would you like to know? For example: power tiller, paddy seed, fertilizer.",
            "कुन सामग्रीको मूल्य जान्न चाहनुहुन्छ? उदाहरण: पावर टिलर, धानको बीउ, मल।",
          ),
          suggestions: this.starters(),
        };
      case "navigation":
        return {
          text: bi(
            this.state.language,
            "You can browse the marketplace at /products, explore services and rentals at /services, and find experts at /experts. Your account, orders and wishlist live under /account.",
            "तपाईं /products मा बजार हेर्न सक्नुहुन्छ, /services मा सेवा तथा भाडा, र /experts मा विज्ञहरू। खाता, अर्डर र wishlist /account मा छन्।",
          ),
          suggestions: this.starters(),
        };
      case "confirm":
      case "deny":
        return {
          text: bi(
            this.state.language,
            "I did not catch what you are confirming — could you rephrase your request?",
            "के पुष्टि गर्न खोज्नुभयो भनेर बुझिनँ — कृपया आफ्नो अनुरोध फेरि लेख्नुहोस्।",
          ),
          suggestions: this.starters(),
        };
      default:
        return this.fallback();
    }
  }

  private fallback(): EngineReply {
    const lang = this.state.language;
    return {
      text: bi(
        lang,
        "I am a prototype assistant, so I only understand requests about agricultural products, prices, rentals, services and farming experts so far. I will not invent an answer I do not have. Could you rephrase, or pick one of the suggestions below? You can also browse the marketplace directly at /products.",
        "म प्रोटोटाइप सहायक भएकाले अहिले कृषि सामग्री, मूल्य, भाडा, सेवा र कृषि विज्ञसम्बन्धी अनुरोध मात्र बुझ्छु। नथाहा भएको कुरा म बनाउँदिनँ। कृपया फरक शब्दमा लेख्नुहोस् वा तलको सुझाव छान्नुहोस्।",
      ),
      suggestions: this.starters(),
    };
  }

  /* ------------------------------ product flow ------------------------------ */

  private startProductFlow(entities: ReturnType<RuleIntentRecognizer["recognize"]>["entities"]): EngineReply {
    const constraints = emptyProductConstraints();
    constraints.productType = entities.productType ?? "";
    constraints.budgetNpr = entities.budgetNpr;
    constraints.terrain = entities.terrain;
    constraints.farmArea = entities.farmArea;
    constraints.district = entities.district;
    constraints.season = entities.season;
    this.state.constraints = constraints;
    this.state.professionalConstraints = null;

    if (constraints.productType === "seed" && !constraints.season) constraints.season = null;

    return this.advanceProductFlow();
  }

  private startRentalFlow(entities: ReturnType<RuleIntentRecognizer["recognize"]>["entities"]): EngineReply {
    const constraints = emptyProductConstraints();
    constraints.rental = true;
    constraints.category = "rental";
    constraints.productType = entities.productType ?? "";
    constraints.duration = entities.duration;
    constraints.district = entities.district;
    this.state.constraints = constraints;
    this.state.professionalConstraints = null;
    return this.advanceProductFlow();
  }

  private startServiceFlow(): EngineReply {
    const lang = this.state.language;
    this.state.constraints = null;
    const matches = this.productSearch.search(
      { ...emptyProductConstraints(), category: "service", productType: "maintenance" },
      lang,
    );
    return {
      text: bi(
        lang,
        "Here is the service & maintenance option in the demo directory. A real version would check your district and machinery type first.",
        "डेमो सूचीमा यस्तो सर्भिस तथा मर्मत विकल्प छ। वास्तविक संस्करणमा जिल्ला र मेसिनको प्रकार पनि सोधिनेछ।",
      ),
      attachment: { kind: "products", items: matches.matches },
      suggestions: this.starters(),
    };
  }

  private advanceProductFlow(): EngineReply {
    const lang = this.state.language;
    const c = this.state.constraints;
    if (!c) return this.fallback();

    const isMachinery = MACHINERY_TYPES.includes(c.productType);
    const isSeed = c.productType?.includes("seed") ?? false;

    if (!c.budgetNpr && !isSeed && c.category !== "rental") {
      this.productStep = "askBudget";
      return {
        text: bi(lang, "What is your approximate budget?", "तपाईंको अन्दाजी बजेट कति हो?"),
        suggestions: lang === "ne" ? ["१ लाख २० हजार", "डेढ लाख", "८० हजार"] : ["Around 1.2 lakh", "About 1.5 lakh", "Under 1 lakh"],
      };
    }
    if (isMachinery && !c.rental && !c.terrain) {
      this.productStep = "askTerrain";
      return {
        text: bi(lang, "Will you use it on flat land or hilly terrain?", "समथर भूमिमा हो कि पहाडीमा?"),
        suggestions: lang === "ne" ? ["पहाडी", "समथर", "तराई"] : ["Hilly", "Flat"],
      };
    }
    if (isMachinery && !c.rental && c.terrain && !c.farmArea) {
      this.productStep = "askArea";
      return {
        text: bi(lang, "About how much land will you work on? (for example 8 ropani)", "करिब कति जमिनमा काम गर्नुहुन्छ? (उदाहरण: ८ रोपनी)"),
        suggestions: lang === "ne" ? ["८ रोपनी", "१ बिघा"] : ["8 ropani", "1 bigha"],
      };
    }
    if (isSeed && !c.district) {
      this.productStep = "askDistrict";
      return {
        text: bi(lang, "Which district is the field in?", "खेत कुन जिल्लामा छ?"),
        suggestions: lang === "ne" ? ["चितवन", "काठमाडौं", "दाङ"] : ["Chitwan", "Kathmandu", "Dang"],
      };
    }
    if (isSeed && !c.season) {
      this.productStep = "askSeason";
      return {
        text: bi(lang, "Which season are you planting in — monsoon (kharif) or winter (rabi)?", "कुन याममा रोप्ने हो — मनसुन (खरीफ) कि जाडो (रबि)?"),
        suggestions: lang === "ne" ? ["मनसुन", "जाडो"] : ["Monsoon (kharif)", "Winter (rabi)"],
      };
    }
    if (c.category === "rental" && !c.duration) {
      this.productStep = "askDuration";
      return {
        text: bi(lang, "For how long do you need the rental?", "कति दिनका लागि भाडामा चाहिन्छ?"),
        suggestions: lang === "ne" ? ["२ दिन", "१ हप्ता"] : ["2 days", "1 week"],
      };
    }

    this.productStep = "done";
    return this.presentProducts();
  }

  private continueProductFlow(input: string, entities: ReturnType<RuleIntentRecognizer["recognize"]>["entities"]): EngineReply {
    const c = this.state.constraints;
    if (!c) return this.fallback();

    if (entities.budgetNpr !== null) c.budgetNpr = entities.budgetNpr;
    if (entities.terrain) c.terrain = entities.terrain;
    if (entities.farmArea) c.farmArea = entities.farmArea;
    if (entities.district) c.district = entities.district;
    if (entities.season) c.season = entities.season;
    if (entities.duration) c.duration = entities.duration;
    if (!c.productType && entities.productType) c.productType = entities.productType;

    return this.advanceProductFlow();
  }

  private presentProducts(): EngineReply {
    const lang = this.state.language;
    const c = this.state.constraints;
    if (!c) return this.fallback();

    const { matches, alternatives } = this.productSearch.search(c, lang);
    this.state.memory.lastMatches = matches.map((m) => m.product.nameEn).join(", ");

    if (!matches.length && !alternatives.length) {
      return {
        text: bi(
          lang,
          "I could not find any suitable product even close to those requirements in the demo catalog. A production version would search the full marketplace. Could you relax a constraint (budget, terrain or product type)?",
          "डेमो सूचीमा ती आवश्यकताअनुसार उपयुक्त सामग्री भेटिएन। उत्पादन संस्करणमा पूरै बजार खोजिनेछ। बजेट, भू-बनोट वा प्रकारमध्ये केही लचिलो बनाउन सक्नुहुन्छ?",
        ),
        suggestions: this.starters(),
      };
    }

    const lines: string[] = [];
    if (matches.length) {
      lines.push(
        bi(
          lang,
          c.rental
            ? `Here are the closest rental matches${c.duration ? ` for ${c.duration}` : ""} (demo records):`
            : `Based on what you told me${c.budgetNpr ? ` (budget ${c.budgetNpr.toLocaleString("en-IN")} NPR)` : ""}, these demo products fit best:`,
          c.rental
            ? `तपाईंको अनुरोधअनुसारका भाडाका सम्भावित विकल्प (डेमो अभिलेख):`
            : `तपाईंले बताएअनुसार (बजेट ${c.budgetNpr ? c.budgetNpr.toLocaleString("en-IN") : "—"} NPR) यी डेमो सामग्री उपयुक्त छन्:`,
        ),
      );
    }
    if (!matches.length && alternatives.length) {
      lines.push(
        bi(
          lang,
          `Nothing suitable fits that budget. The closest alternatives are over budget by the amounts shown (demo records):`,
          `त्यो बजेटमा उपयुक्त केही भेटिएन। नजिकका विकल्पहरू बजेटभन्दा देखाइएको रकमले बढी छन् (डेमो अभिलेख):`,
        ),
      );
    } else if (alternatives.length) {
      lines.push(
        bi(
          lang,
          "These are close but over your budget — shown separately with the excess amount:",
          "यी बजेटनजिक तर बढी महँगा छन् — थप रकमसहित छुट्टै देखाइएको छ:",
        ),
      );
    }
    lines.push(bi(lang, "(Demo data — not live marketplace listings.)", "(डेमो डाटा — लाइभ सूची होइन।)"));

    const attachment =
      matches.length && alternatives.length
        ? { kind: "products" as const, items: [...matches, ...alternatives] }
        : matches.length
          ? { kind: "products" as const, items: matches }
          : { kind: "products" as const, items: alternatives };

    return { text: lines.join("\n"), attachment, suggestions: this.starters() };
  }

  /* ------------------------------ expert flow ------------------------------ */

  private startExpertFlow(entities: ReturnType<RuleIntentRecognizer["recognize"]>["entities"]): EngineReply {
    const p = emptyProfessionalConstraints();
    p.projectType = entities.projectType ?? "";
    p.capacity = entities.capacity;
    p.district = entities.district;
    p.budgetNpr = entities.budgetNpr;
    this.state.professionalConstraints = p;
    this.state.constraints = null;

    if (entities.discipline) p.disciplines.push(entities.discipline);

    return this.advanceExpertFlow();
  }

  private advanceExpertFlow(): EngineReply {
    const lang = this.state.language;
    const p = this.state.professionalConstraints;
    if (!p) return this.fallback();

    if (!p.projectType) {
      this.expertStep = "askFacility";
      return {
        text: bi(lang, "What kind of project do you need experts for? (for example a chick hatchery, poultry rearing, greenhouse or irrigation)", "कुन किसिमका परियोजनाका लागि विज्ञ चाहिन्छ? (उदाहरण: चल्ला ह्याचरी, कुखुरा पालन, पोलिहाउस वा सिँचाइ)"),
        suggestions: lang === "ne" ? ["चल्ला ह्याचरी", "कुखुरा पालन", "थोपा सिँचाइ"] : ["Chick hatchery", "Poultry rearing", "Drip irrigation"],
      };
    }
    if (p.landAvailable === null) {
      this.expertStep = "askLand";
      return {
        text: bi(lang, "Is the land for this project already available?", "यस परियोजनाका लागि जग्गा पहिल्यै तयार छ?"),
        suggestions: lang === "ne" ? ["हो", "होइन"] : ["Yes", "No"],
      };
    }
    if (!p.capacity) {
      this.expertStep = "askCapacity";
      return {
        text: bi(lang, "What is the desired capacity? (for example 5,000 chicks)", "लक्ष्य क्षमता कति हो? (उदाहरण: ५ हजार चल्ला)"),
        suggestions: lang === "ne" ? ["५ हजार चल्ला", "१ हजार कुखुरा"] : ["5,000 chicks", "1,000 birds"],
      };
    }
    if (p.powerAvailable === null) {
      this.expertStep = "askPower";
      return {
        text: bi(lang, "Is reliable electricity (with backup power if needed) available at the site?", "घडेरीमा नियमित बिजुली (आवश्यकता अनुसार ब्याकअपसहित) छ?"),
        suggestions: lang === "ne" ? ["छ", "छैन"] : ["Yes", "No"],
      };
    }
    if (!p.serviceScope) {
      this.expertStep = "askScope";
      return {
        text: bi(
          lang,
          "What scope of help do you need — construction design, equipment selection, veterinary advice, or complete project consultancy?",
          "कस्तो सहयोग चाहिन्छ — निर्माण डिजाइन, उपकरण छनोट, पशु चिकित्सा सल्लाह, वा पूरै परियोजना परामर्श?",
        ),
        suggestions: lang === "ne" ? ["पूरै परामर्श", "निर्माण डिजाइन", "उपकरण छनोट"] : ["Complete consultancy", "Construction design", "Equipment selection"],
      };
    }
    if (p.budgetNpr === null) {
      this.expertStep = "askBudget";
      return {
        text: bi(lang, "What is your approximate overall budget for this project?", "यस परियोजनाका लागि अन्दाजी कुल बजेट कति हो?"),
        suggestions: lang === "ne" ? ["१० लाख", "२५ लाख"] : ["Around 10 lakh", "Around 25 lakh"],
      };
    }

    this.expertStep = "done";
    return this.presentProfessionals();
  }

  private continueExpertFlow(input: string, entities: ReturnType<RuleIntentRecognizer["recognize"]>["entities"]): EngineReply {
    const p = this.state.professionalConstraints;
    if (!p) return this.fallback();
    const text = input.toLowerCase();

    if (this.expertStep === "askFacility" && !p.projectType) {
      if (/hatchery|ह्याचरी/.test(text)) p.projectType = "hatchery";
      else if (/poultry|कुखुरा|chick|चल्ला/.test(text)) p.projectType = "poultry";
      else if (/greenhouse|poly|पोलि/.test(text)) p.projectType = "greenhouse";
      else if (/drip|सिँचाइ|सिंचाई|irrigation/.test(text)) p.projectType = "irrigation";
      else p.projectType = text.slice(0, 40);
      return this.advanceExpertFlow();
    }
    if (this.expertStep === "askLand") {
      p.landAvailable = /^(yes|ho|हो|छ|h|y)$/.test(text.trim()) || /yes|available|छ$|तयार छ/.test(text);
      if (/no|होइन|छैन/.test(text)) p.landAvailable = false;
      return this.advanceExpertFlow();
    }
    if (!p.capacity && entities.capacity) p.capacity = entities.capacity;
    if (entities.budgetNpr !== null) p.budgetNpr = entities.budgetNpr;
    if (entities.district) p.district = entities.district;
    if (this.expertStep === "askPower") {
      p.powerAvailable = /yes|available|छ$|नियमित/.test(text);
      if (/no|होइन|छैन|unreliable|अनियमित/.test(text)) p.powerAvailable = false;
      return this.advanceExpertFlow();
    }
    if (this.expertStep === "askScope") {
      p.serviceScope = input.trim().slice(0, 120);
      return this.advanceExpertFlow();
    }
    if (entities.capacity || entities.budgetNpr !== null || entities.district) {
      return this.advanceExpertFlow();
    }
    return this.advanceExpertFlow();
  }

  private presentProfessionals(): EngineReply {
    const lang = this.state.language;
    const p = this.state.professionalConstraints;
    if (!p) return this.fallback();

    const disciplines = disciplinesForProject(p);
    const matches = this.professionalSearch.search({ ...p, disciplines }, lang);

    if (!matches.length) {
      return {
        text: bi(
          lang,
          "I could not match a suitable professional in the demo directory for that combination. In production, khet E's support team would review open requirements like yours and suggest the right professionals.",
          "डेमो सूचीमा त्यस्तो संयोजनका लागि उपयुक्त विज्ञ भेटिएन। उत्पादनमा khet E को सहयोग टोलीले यस्ता खुला आवश्यकता हेरेर उपयुक्त विज्ञ सुझाउनेछ।",
        ),
        suggestions: this.starters(),
      };
    }

    const summary = bi(
      lang,
      `For a ${p.projectType} project${p.capacity ? ` (${p.capacity})` : ""}, these disciplines may be relevant: ${disciplines.join(", ")}. Not every project needs every specialist — here are the closest demo profiles:`,
      `${p.projectType} परियोजनाका लागि (क्षमता: ${p.capacity ?? "—"}) यी क्षेत्र सम्बन्धित हुन सक्छन्: ${disciplines.join(", ")}। हरेक परियोजनालाई हरेक विज्ञ चाहिँदैन — नजिकका डेमो प्रोफाइल यहाँ छन्:`,
    );

    return {
      text: `${summary}\n${bi(lang, "(Demo profiles — availability and certificates are not verified here.)", "(डेमो प्रोफाइल — उपलब्धता र प्रमाणपत्र यहाँ प्रमाणित छैन।)")}`,
      attachment: { kind: "professionals", items: matches },
      suggestions: this.starters(),
    };
  }

  /* ------------------------------ comparison ------------------------------ */

  private handleComparison(input: string): EngineReply {
    const lang = this.state.language;
    const text = input.toLowerCase();
    const find = (type: string) => DEMO_PRODUCTS.filter((product) => product.productType === type && product.category === "machinery");
    const tillerPrices = find("power tiller").map((p) => `${p.nameEn.replace(" (Demo)", "")}: ${p.priceNpr.toLocaleString("en-IN")} NPR`);
    const tractorPrices = find("tractor").map((p) => `${p.nameEn.replace(" (Demo)", "")}: ${p.priceNpr.toLocaleString("en-IN")} NPR`);

    if (/tiller/.test(text) && /tractor/.test(text)) {
      return {
        text: bi(
          lang,
          `Quick demo comparison:\n• Power tillers: ${tillerPrices.join(" · ")}\n• Tractors: ${tractorPrices.join(" · ")}\nTillers suit smaller and hilly plots; tractors suit larger flat land. Tell me your budget and land type and I will narrow it down.`,
          `छोटो डेमो तुलना:\n• पावर टिलर: ${tillerPrices.join(" · ")}\n• ट्याक्टर: ${tractorPrices.join(" · ")}\nसानो तथा पहाडी जमिनमा टिलर, ठूलो समथर जमिनमा ट्याक्टर उपयुक्त। बजेट र जमिनको प्रकार बताउनुहोस्, म सिफारिस घटाउँछु।`,
        ),
        suggestions: lang === "ne" ? ["मलाई पावर टिलर चाहिन्छ"] : ["I need a power tiller"],
      };
    }

    return {
      text: bi(
        lang,
        "Which two options should I compare? For example: power tiller vs tractor.",
        "कुन दुई विकल्पको तुलना गर्ने? उदाहरण: पावर टिलर बनाम ट्याक्टर।",
      ),
      suggestions: lang === "ne" ? ["पावर टिलर बनाम ट्याक्टर"] : ["Power tiller vs tractor"],
    };
  }
}
