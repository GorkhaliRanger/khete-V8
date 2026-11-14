import { extractEntities } from "./entities";
import type { IntentRecognizer, IntentResult, ConversationState } from "./types";

/**
 * Rule-based intent recognizer for the prototype. It looks for cue words in
 * the normalized input and combines them with the conversation state so that
 * follow-up answers ("hilly, around 8 ropani") are understood in context.
 * A future model-backed recognizer can implement the same interface.
 */

export class RuleIntentRecognizer implements IntentRecognizer {
  recognize(rawInput: string, state: ConversationState): IntentResult {
    const input = rawInput.toLowerCase();
    const entities = extractEntities(rawInput);
    const inProductFlow = state.constraints !== null && state.professionalConstraints === null;
    const inExpertFlow = state.professionalConstraints !== null;

    if (/^(hi|hello|hey|namaste|नमस्ते|नमस्कार)\b/.test(input.trim()) && !inProductFlow && !inExpertFlow) {
      return { intent: "greeting", entities };
    }
    if (/restart|start over|reset|सुरुबाट|फेरि सुरु/.test(input)) {
      return { intent: "restart", entities };
    }
    if (/^(yes|yeah|ok|okay|sure|हो|ठीक छ|ठीकै छ|हुन्छ|ok ho)$/.test(input.trim())) {
      return { intent: "confirm", entities };
    }
    if (/^(no|nope|not really|होइन|छैन)$/.test(input.trim())) {
      return { intent: "deny", entities };
    }

    const wantsExpert = /expert|advisor|adviser|specialist|engineer|doctor|विशेषज्ञ|सल्लाहकार|इन्जिनियर|पशु चिकित्सक|veterinar|consultant/.test(input);
    const wantsProject = /build|construct|setup|set up|planning|निर्माण|बनाउन|बनाउँछु|योजना/.test(input);
    if (wantsExpert || (entities.projectType && (wantsProject || entities.capacity))) {
      return { intent: "expert_search", entities };
    }

    if (/rent|rental|भाडा|hire.*machine|machine.*hire/.test(input)) {
      return { intent: "rental", entities };
    }
    if (/service|maintenance|repair|servicing|mर्मत|सर्भिस|मर्मत|फिक्स/.test(input)) {
      return { intent: "service_maintenance", entities };
    }
    if (/compare|versus|vs\b|तुलना/.test(input)) {
      return { intent: "comparison", entities };
    }
    if (/price|cost|rate|how much|मूल्य|मूल्य कति|कति|भाउ|दाम/.test(input) && !entities.productType && !inProductFlow) {
      return { intent: "price_query", entities };
    }
    if (/track|order|account|login|signin|cart|wishlist|profile|profile|खाता|अर्डर|search the site|website|navigate/.test(input)) {
      return { intent: "navigation", entities };
    }

    const productCue =
      entities.productType !== null ||
      /machine|machinery|equipment|seed|fertilizer|मेसिन|सामग्री|बीउ|मल|उपकरण|irrigation|सिँचाइ|सिंचाई|sprayer|thresher|harvester|चाप कट्टर/.test(input) ||
      (inProductFlow && (entities.budgetNpr !== null || entities.terrain !== null || entities.district !== null || entities.farmArea !== null || entities.season !== null));

    if (productCue) {
      return { intent: "product_search", entities };
    }

    return { intent: "unknown", entities };
  }
}
