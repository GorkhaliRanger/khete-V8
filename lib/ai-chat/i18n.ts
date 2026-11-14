import type { ChatLanguage } from "./types";

/**
 * UI strings and predefined dialogues for the prototype.
 *
 * The mock engine only covers the dialogues defined here; it is not a real
 * translation system and never claims to be one.
 */

const STRINGS = {
  en: {
    name: "khetE कृषि साथी",
    subtitle: "Your Agricultural Shopping & Services Assistant",
    demoBadge: "Prototype — simulated responses, no live AI",
    launcherLabel: "Chat with कृषि साथी",
    inputPlaceholder: "Type your question…",
    inputAriaLabel: "Message",
    send: "Send",
    micStart: "Start voice input",
    micStop: "Stop voice input",
    micUnsupportedTitle: "Voice input is not available in this browser",
    micUnsupportedBody:
      "This browser does not support the free built-in speech recognition (or permission was denied). You can type your message instead. On supported browsers, speech may be processed outside your device by the browser's speech service.",
    micListening: "Listening… speak now",
    micPreviewLabel: "Heard:",
    micConfirm: "Send",
    micEditPlaceholder: "Edit the text before sending",
    restart: "Restart",
    restartConfirm: "Conversation restarted.",
    languageLabel: "नेपाली",
    speaking: "Speaking…",
    speakLabel: "Read aloud",
    stopSpeakLabel: "Stop reading",
    noVoiceTitle: "Voice playback unavailable",
    noVoiceBody: "This browser has no compatible voice for the selected language. The text reply stays on screen.",
    greeting:
      "Namaste! I'm khetE कृषि साथी. I can help you find agricultural products, compare prices and connect with suitable farming professionals. How can I help you today?",
    demoNote:
      "This is a rule-based prototype simulation. A production version will use Gemini 2.5 Flash-Lite for conversation and Groq Whisper for speech.",
    suggestions: [
      "I need a power tiller",
      "I want paddy seeds for Chitwan",
      "I want to build a 5,000-chick hatchery",
      "I want to rent a tractor for 2 days",
      "Show drip irrigation options",
    ],
    footerNote: "Demonstration only — product and expert records are samples, not live marketplace listings.",
  },
  ne: {
    name: "khetE कृषि साथी",
    subtitle: "तपाईंको कृषि खरिद तथा सेवा सहायक",
    demoBadge: "प्रोटोटाइप — अभ्यास उत्तर, लाइभ AI होइन",
    launcherLabel: "कृषि साथीसँग कुरा गर्नुहोस्",
    inputPlaceholder: "आफ्नो प्रश्न लेख्नुहोस्…",
    inputAriaLabel: "सन्देश",
    send: "पठाउनुहोस्",
    micStart: "आवाजबाट लेख्न सुरु गर्नुहोस्",
    micStop: "रोक्नुहोस्",
    micUnsupportedTitle: "यस ब्राउजरमा आवाज इनपुट उपलब्ध छैन",
    micUnsupportedBody:
      "यो ब्राउजरले निःशुल्क भित्री speech recognition लाई समर्थन गर्दैन (वा अनुमति अस्वीकृत भयो)। तपाईं सन्देश टाइप गर्न सक्नुहुन्छ। समर्थित ब्राउजरमा आवाज ब्राउजरको सेवाद्वारा यन्त्र बाहिर प्रशोधन हुन सक्छ।",
    micListening: "सुनिरहेको छु… बोल्नुहोस्",
    micPreviewLabel: "सुनिएको:",
    micConfirm: "पठाउनुहोस्",
    micEditPlaceholder: "पठाउनुअघि सच्याउनुहोस्",
    restart: "सुरुबाट",
    restartConfirm: "कुराकानी सुरुबाट सुरु भयो।",
    languageLabel: "English",
    speaking: "बोलिरहेको छ…",
    speakLabel: "जोरले पढ्नुहोस्",
    stopSpeakLabel: "पढ्न रोक्नुहोस्",
    noVoiceTitle: "आवाज प्रसारण उपलब्ध छैन",
    noVoiceBody: "यस ब्राउजरमा छानिएको भाषाको उपयुक्त आवाज छैन। पाठ उत्तर स्क्रिनमै रहन्छ।",
    greeting:
      "नमस्कार! म khetE कृषि साथी हुँ। तपाईंलाई कृषि सामग्री खोज्न, मूल्य तुलना गर्न वा कृषि विशेषज्ञसँग जोडिन सहयोग गर्न सक्छु। आज तपाईंलाई के चाहिएको छ?",
    demoNote:
      "यो नियम-आधारित प्रोटोटाइप हो। उत्पादन संस्करणमा Gemini 2.5 Flash-Lite र Groq Whisper प्रयोग हुनेछ।",
    suggestions: [
      "मलाई पावर टिलर चाहिन्छ",
      "चितवनका लागि धानको बीउ चाहिन्छ",
      "५ हजार कुखुराको ह्याचरी बनाउन चाहन्छु",
      "ट्याक्टर २ दिन भाडामा चाहिन्छ",
      "थोपा सिँचाइका विकल्प देखाउनुहोस्",
    ],
    footerNote: "केवल प्रदर्शन — उत्पादन र विज्ञका अभिलेख नमुना मात्र हुन्।",
  },
};

export type UiStrings = (typeof STRINGS)["en"];

export function getStrings(language: ChatLanguage): UiStrings {
  return STRINGS[language];
}

/** Formats an NPR amount with Nepali grouping (1,20,000). */
export function formatNpr(amount: number): string {
  return `NPR ${amount.toLocaleString("en-IN")}`;
}

export function t(language: ChatLanguage, key: keyof UiStrings): UiStrings[keyof UiStrings] {
  return STRINGS[language][key];
}
