import type { ChatLanguage, SpeechRecognizer, TextToSpeech } from "./types";

/**
 * Browser-native speech prototypes. Both classes implement the provider
 * interfaces from types.ts, so they can later be swapped for Groq Whisper
 * (recognition) and a hosted Nepali TTS service without UI changes.
 *
 * No audio is ever recorded or stored: recognition happens inside the
 * browser (which may send audio to its own speech service depending on the
 * browser), and nothing is persisted by this code.
 */

type SpeechRecognitionResultHandler = (transcript: string, isFinal: boolean) => void;
type SpeechErrorHandler = (message: string) => void;

type RecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getRecognitionConstructor(): (new () => RecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => RecognitionLike;
    webkitSpeechRecognition?: new () => RecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export class BrowserSpeechRecognizer implements SpeechRecognizer {
  private recognition: RecognitionLike | null = null;
  private language: ChatLanguage = "en";
  private transcript = "";
  private onResult: SpeechRecognitionResultHandler | null = null;
  private onError: SpeechErrorHandler | null = null;

  isSupported(): boolean {
    return getRecognitionConstructor() !== null;
  }

  /** BCP-47 tags: Nepali (Nepal) for Nepali, US English for English. */
  getLanguage(): string {
    return this.language === "ne" ? "ne-NP" : "en-US";
  }

  setLanguage(language: ChatLanguage): void {
    this.language = language;
    if (this.recognition) this.recognition.lang = this.getLanguage();
  }

  start(onResult: SpeechRecognitionResultHandler, onError: SpeechErrorHandler): void {
    const Ctor = getRecognitionConstructor();
    this.stop();
    this.transcript = "";
    this.onResult = onResult;
    this.onError = onError;
    if (!Ctor) {
      onError("unsupported");
      return;
    }
    const recognition = new Ctor();
    recognition.lang = this.getLanguage();
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event: unknown) => {
      const resultEvent = event as { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>; resultIndex: number };
      let interim = "";
      for (let i = resultEvent.resultIndex; i < resultEvent.results.length; i += 1) {
        const result = resultEvent.results[i];
        if (result.isFinal) this.transcript += result[0].transcript;
        else interim += result[0].transcript;
      }
      this.onResult?.((this.transcript + interim).trim(), false);
    };
    recognition.onerror = (event: unknown) => {
      const errorEvent = event as { error?: string };
      this.onError?.(errorEvent.error ?? "unknown");
    };
    recognition.onend = () => {
      const finalText = this.transcript.trim();
      if (finalText) this.onResult?.(finalText, true);
    };

    this.recognition = recognition;
    try {
      recognition.start();
    } catch {
      this.onError?.("start-failed");
    }
  }

  stop(): string {
    const finalText = this.transcript.trim();
    if (this.recognition) {
      try {
        this.recognition.onresult = null;
        this.recognition.onerror = null;
        this.recognition.onend = null;
        this.recognition.stop();
      } catch {
        /* already stopped */
      }
      this.recognition = null;
    }
    this.transcript = "";
    return finalText;
  }

  abort(): void {
    if (this.recognition) {
      try {
        this.recognition.onresult = null;
        this.recognition.onerror = null;
        this.recognition.onend = null;
        this.recognition.abort();
      } catch {
        /* noop */
      }
      this.recognition = null;
    }
    this.transcript = "";
  }
}

export class BrowserTextToSpeech implements TextToSpeech {
  private voiceCache: Partial<Record<ChatLanguage, SpeechSynthesisVoice | null>> = {};

  isSupported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  private findVoice(language: ChatLanguage): SpeechSynthesisVoice | null {
    if (!this.isSupported()) return null;
    if (language in this.voiceCache) return this.voiceCache[language] ?? null;
    const voices = window.speechSynthesis.getVoices();
    const wanted = language === "ne" ? ["ne-NP", "ne", "hi-IN", "hi"] : ["en-US", "en-GB", "en"];
    let found: SpeechSynthesisVoice | null = null;
    for (const tag of wanted) {
      const exact = voices.find((voice) => voice.lang === tag);
      const prefix = voices.find((voice) => voice.lang.startsWith(tag.split("-")[0]));
      found = exact ?? prefix ?? null;
      if (found) break;
    }
    this.voiceCache[language] = found;
    return found;
  }

  hasVoiceFor(language: ChatLanguage): boolean {
    return this.findVoice(language) !== null;
  }

  speak(text: string, language: ChatLanguage, onEnd?: () => void): void {
    if (!this.isSupported()) {
      onEnd?.();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = this.findVoice(language);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? (language === "ne" ? "ne-NP" : "en-US");
    utterance.rate = 1;
    if (onEnd) {
      utterance.onend = () => onEnd();
      utterance.onerror = () => onEnd();
    }
    window.speechSynthesis.speak(utterance);
  }

  cancel(): void {
    if (this.isSupported()) window.speechSynthesis.cancel();
  }
}
